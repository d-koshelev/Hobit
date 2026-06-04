import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SkillLibraryWidget } from "./SkillLibraryWidget";
import type { WidgetDefinition, WidgetInstance } from "./types";
import type { KnowledgeDocument, Skill } from "../workspace/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("SkillLibraryWidget", () => {
  it("renders the empty workspace-local safety state", async () => {
    renderWidget({
      onListSkills: vi.fn(async () => []),
      onGetSkill: vi.fn(),
      onListKnowledgeDocuments: vi.fn(async () => []),
    });

    await flush();

    expect(document.body.textContent).toContain("No catalog items yet.");
    expect(document.body.textContent).toContain(
      "Scoped Knowledge Catalog for documents and skills.",
    );
    expect(document.body.textContent).toContain(
      "Global and workspace-local items stay visible.",
    );
    expect(document.body.textContent).toContain(
      "Catalog views combine scoped documents and saved skills.",
    );
    expect(buttonWithText("Active")).toBeDefined();
    expect(buttonWithText("Codebase")).toBeDefined();
    expect(buttonWithText("Prompt templates")).toBeDefined();
    expect(buttonWithText("Archived")).toBeDefined();

    await clickButton("Skills");

    expect(document.body.textContent).toContain("No skills yet.");
  });

  it("attaches the selected Skill to Workspace Agent as visible allowed fields only", async () => {
    const skill = skillFixture({
      prerequisites: "Reviewed working tree",
      reviewStatus: "reviewed",
      risks: "Validation may be slow",
      skillId: "skill_visible",
      steps: "Run typecheck\nRun focused tests",
      tags: "frontend, review",
      title: "Frontend review",
      validation: "npm test passes",
      whenToUse: "Before merging frontend changes",
    });
    const attachToCoordinator = vi.fn();

    renderWidget({
      onAttachContextToCoordinator: attachToCoordinator,
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();
    await clickButton("Skills");

    expect(attachToCoordinator).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Attach uses the last saved Skill. Save edits before attaching. Does not send automatically.",
    );

    await clickButton("Attach to Workspace Agent");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    const request = attachToCoordinator.mock.calls[0][0];
    expect(request.sourceLabel).toBe("Skill Library / Skill");
    expect(request.contextText).toContain("Skill Library Skill");
    expect(request.contextText).toContain("Title: Frontend review");
    expect(request.contextText).toContain(
      "When to use:\nBefore merging frontend changes",
    );
    expect(request.contextText).toContain(
      "Prerequisites:\nReviewed working tree",
    );
    expect(request.contextText).toContain(
      "Steps:\nRun typecheck\nRun focused tests",
    );
    expect(request.contextText).toContain("Validation:\nnpm test passes");
    expect(request.contextText).toContain("Risks:\nValidation may be slow");
    expect(request.contextText).toContain("Tags: frontend, review");
    expect(request.contextText).toContain("Review status: Reviewed");
    expect(request.contextText).not.toMatch(
      /skill_visible|workspace_1|createdAt|updatedAt|created_at|updated_at/i,
    );
    expect(document.body.textContent).toContain(
      "Skill attached to Workspace Agent as visible context.",
    );
  });

  it("does not show Attach to Workspace Agent when Workspace Agent is not visible", async () => {
    const skill = skillFixture({
      skillId: "skill_saved",
      title: "Saved Skill",
      whenToUse: "Use from the Skill Library only",
    });

    renderWidget({
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();
    await clickButton("Skills");

    expect(buttonWithText("Attach to Workspace Agent")).toBeUndefined();
    expect(document.body.textContent).toContain(
      "Add Workspace Agent to attach saved Skills as visible context.",
    );
  });

  it("attaches only the selected saved Skill after unsaved edits are saved", async () => {
    const attachToCoordinator = vi.fn();
    let skill = skillFixture({
      skillId: "skill_saved",
      steps: "Saved step",
      title: "Saved Skill",
    });
    const updateSkill = vi.fn(async (request) => {
      skill = skillFixture({
        ...request,
        skillId: request.skillId,
      });
      return skill;
    });

    renderWidget({
      onAttachContextToCoordinator: attachToCoordinator,
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
      onUpdateSkill: updateSkill,
    });

    await flush();
    await clickButton("Skills");
    await changeTextarea(2, "Unsaved edited step");

    const attachButton = buttonWithText("Attach to Workspace Agent");
    expect(attachButton).toBeDefined();
    expect(attachButton?.disabled).toBe(true);
    expect(attachToCoordinator).not.toHaveBeenCalled();

    await clickButton("Save skill");
    await clickButton("Attach to Workspace Agent");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    const request = attachToCoordinator.mock.calls[0][0];
    expect(request.contextText).toContain("Steps:\nUnsaved edited step");
    expect(request.contextText).not.toContain("Saved step");
  });

  it("creates, edits, saves, and deletes an operator-authored skill", async () => {
    let skills: Skill[] = [];
    const createSkill = vi.fn(async (request) => {
      const skill = skillFixture({
        ...request,
        skillId: "skill_created",
      });
      skills = [skill];
      return skill;
    });
    const updateSkill = vi.fn(async (request) => {
      const skill = skillFixture({
        ...request,
        skillId: request.skillId,
      });
      skills = [skill];
      return skill;
    });
    const deleteSkill = vi.fn(async () => {
      skills = [];
      return true;
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWidget({
      onCreateSkill: createSkill,
      onDeleteSkill: deleteSkill,
      onGetSkill: vi.fn(
        async (skillId) =>
          skills.find((skill) => skill.skillId === skillId) ?? null,
      ),
      onListSkills: vi.fn(async () => skills),
      onUpdateSkill: updateSkill,
    });

    await flush();
    await clickButton("Skills");
    await changeInput('input[placeholder="Untitled skill"]', "Deploy review");
    await changeTextarea(0, "Before a production deploy");
    await changeTextarea(2, "Run validation\nReview changed files");
    await changeInput('input[placeholder="review, deploy"]', "deploy, review");
    await clickButton("Save skill");

    expect(createSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: "draft",
        steps: "Run validation\nReview changed files",
        tags: "deploy, review",
        title: "Deploy review",
        whenToUse: "Before a production deploy",
      }),
    );
    expect(document.body.textContent).toContain("Deploy review");

    await changeInput('input[placeholder="Untitled skill"]', "Reviewed deploy");
    await changeSelect("reviewed");
    await clickButton("Save skill");

    expect(updateSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: "reviewed",
        skillId: "skill_created",
        title: "Reviewed deploy",
      }),
    );

    await clickButton("Delete");

    expect(deleteSkill).toHaveBeenCalledWith({ skillId: "skill_created" });
    expect(document.body.textContent).toContain("No skills yet.");
  });

  it("renders Catalog tab and creates, saves, and deletes a document", async () => {
    let documents: KnowledgeDocument[] = [];
    const createKnowledgeDocument = vi.fn(async (request) => {
      const document = knowledgeDocumentFixture({
        ...request,
        knowledgeDocumentId: "doc_created",
      });
      documents = [document];
      return document;
    });
    const updateKnowledgeDocument = vi.fn(async (request) => {
      const document = knowledgeDocumentFixture({
        ...request,
        knowledgeDocumentId: request.knowledgeDocumentId,
      });
      documents = [document];
      return document;
    });
    const deleteKnowledgeDocument = vi.fn(async () => {
      documents = [];
      return true;
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWidget({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onDeleteKnowledgeDocument: deleteKnowledgeDocument,
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onUpdateKnowledgeDocument: updateKnowledgeDocument,
    });

    await flush();

    expect(document.body.textContent).toContain("No catalog items yet.");
    expect(document.body.textContent).toContain(
      "Only enabled active documents are searched for Workspace Agent Codex",
    );

    await changeInput('input[placeholder="Untitled document"]', "API docs");
    await changeSelectByLabel("Type", "documentation_knowledge");
    await changeSelectByLabel("Status", "active");
    await changeTextareaByLabel(
      "Quick summary",
      "Reference for API onboarding.",
    );
    await changeInput(
      'input[placeholder="README.md or pasted docs"]',
      "README.md",
    );
    await changeInput('input[placeholder="api, onboarding"]', "api, docs");
    await changeTextareaByLabel(
      "Full content",
      "Use this API reference for onboarding.",
    );
    await clickButton("Save document");

    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogItemType: "documentation_knowledge",
        content: "Use this API reference for onboarding.",
        enabled: true,
        lifecycleStatus: "active",
        quickSummary: "Reference for API onboarding.",
        scope: "workspace",
        sourceLabel: "README.md",
        tags: "api, docs",
        title: "API docs",
      }),
    );
    expect(document.body.textContent).toContain("API docs");

    await changeInput(
      'input[placeholder="Untitled document"]',
      "Updated API docs",
    );
    await changeCheckbox("Searchable by Workspace Agent", false);
    await clickButton("Save document");

    expect(updateKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        knowledgeDocumentId: "doc_created",
        scope: "workspace",
        title: "Updated API docs",
      }),
    );
    expect(document.body.textContent).toContain(
      "Enabled saved workspace and global documents may be searched before Run with Codex. Disabled documents are ignored.",
    );

    await clickButton("Delete");

    expect(deleteKnowledgeDocument).toHaveBeenCalledWith({
      knowledgeDocumentId: "doc_created",
    });
    expect(document.body.textContent).toContain("No catalog items yet.");
  });

  it("shows catalog filters, metadata cards, selected preview, and Skill actions", async () => {
    const documents = [
      knowledgeDocumentFixture({
        catalogItemType: "codebase_knowledge",
        knowledgeDocumentId: "doc_code",
        lifecycleStatus: "active",
        quickSummary: "Frontend widgets use registry-driven rendering.",
        scope: "workspace",
        sourceLabel: "docs/ARCHITECTURE.md",
        sourceRef: "docs/ARCHITECTURE.md",
        tags: "frontend, registry",
        title: "Widget registry boundary",
        updatedAt: "2026-05-25T12:00:00Z",
      }),
      knowledgeDocumentFixture({
        catalogItemType: "architecture_decision",
        knowledgeDocumentId: "doc_decision",
        lifecycleStatus: "stale",
        quickSummary: "Older decision needs review.",
        scope: "global",
        sourceLabel: "decisions/old.md",
        tags: "decision",
        title: "Old decision",
        updatedAt: "2026-05-24T12:00:00Z",
      }),
      knowledgeDocumentFixture({
        catalogItemType: "known_issue",
        knowledgeDocumentId: "doc_archived",
        lifecycleStatus: "archived",
        quickSummary: "Retained for review only.",
        scope: "workspace",
        sourceLabel: "docs/old-known-issue.md",
        tags: "issue",
        title: "Archived known issue",
        updatedAt: "2026-05-23T12:00:00Z",
      }),
    ];
    const skill = skillFixture({
      reviewStatus: "reviewed",
      skillId: "skill_review",
      steps: "Inspect changed files",
      tags: "review",
      title: "Review skill",
      updatedAt: "2026-05-26T12:00:00Z",
      validation: "Run focused tests",
      whenToUse: "Before accepting frontend changes",
    });
    const attachToCoordinator = vi.fn();

    renderWidget({
      onAttachContextToCoordinator: attachToCoordinator,
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onGetSkill: vi.fn(async () => skill),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();

    expect(visibleListRowsText()).toContain("Review skill");
    expect(visibleListRowsText()).toContain("Skill - Reviewed - review");
    expect(visibleListRowsText()).toContain("Widget registry boundary");
    expect(visibleListRowsText()).toContain("Codebase - Active");
    expect(visibleListRowsText()).toContain(
      "Frontend widgets use registry-driven rendering.",
    );
    expect(document.body.textContent).toContain("Selected preview");
    expect(document.body.textContent).toContain("Source");
    expect(document.body.textContent).toContain("Relations");

    await clickButton("Global");

    expect(visibleListRowsText()).toContain("Old decision");
    expect(visibleListRowsText()).not.toContain("Widget registry boundary");

    await clickButton("Active");

    expect(visibleListRowsText()).toContain("Widget registry boundary");
    expect(visibleListRowsText()).toContain("Review skill");
    expect(visibleListRowsText()).not.toContain("Old decision");
    expect(visibleListRowsText()).not.toContain("Archived known issue");

    await clickButton("Codebase");

    expect(visibleListRowsText()).toContain("Widget registry boundary");
    expect(visibleListRowsText()).not.toContain("Old decision");

    await clickButton("Stale");

    expect(visibleListRowsText()).toContain("Old decision");
    expect(visibleListRowsText()).not.toContain("Review skill");

    await clickButton("Archived");

    expect(visibleListRowsText()).toContain("Archived known issue");
    expect(visibleListRowsText()).not.toContain("Widget registry boundary");

    await clickCatalogView("Skills");
    await clickListRow("Review skill");

    expect(document.body.textContent).toContain("Full content");
    expect(document.body.textContent).toContain(
      "When to use:\nBefore accepting frontend changes",
    );
    expect(document.body.textContent).toContain("Workspace Skill record");

    await clickButton("Attach to Workspace Agent");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    expect(attachToCoordinator.mock.calls[0][0].contextText).toContain(
      "Title: Review skill",
    );

    await clickButton("Open Skills tab");

    expect(document.body.textContent).toContain(
      "Skills are not sent to Workspace Agent unless explicitly attached.",
    );
  });

  it("shows lightweight Knowledge relations from saved metadata and current attachments", async () => {
    const documents = [
      knowledgeDocumentFixture({
        catalogItemType: "codebase_knowledge",
        knowledgeDocumentId: "doc_file",
        quickSummary: "Source-backed frontend knowledge.",
        sourceKind: "file_import",
        sourceLabel: "docs/feature.md commit abc1234",
        sourceRef: "docs/feature.md",
        tags: "frontend, relations",
        title: "Feature docs",
        updatedAt: "2026-05-27T12:00:00Z",
      }),
      knowledgeDocumentFixture({
        catalogItemType: "documentation_knowledge",
        knowledgeDocumentId: "doc_queue",
        quickSummary: "Generated from Queue review.",
        sourceKind: "queue_draft",
        sourceLabel: "Queue task queue_knowledge_1",
        sourceRef: "queue:queue_knowledge_1;draft:draft_doc",
        tags: "queue, relations",
        title: "Queue draft docs",
        updatedAt: "2026-05-26T12:00:00Z",
      }),
    ];
    const skill = skillFixture({
      prerequisites:
        "Queue task queue_skill_1\nSource ref: docs/skill.md\nCommit def5678",
      reviewStatus: "reviewed",
      skillId: "skill_relations",
      tags: "frontend, queue",
      title: "Queue review skill",
      updatedAt: "2026-05-25T12:00:00Z",
      whenToUse: "When reviewing Queue-produced Knowledge.",
    });
    const attachToCoordinator = vi.fn();
    const attachKnowledgeContextToQueueTask = vi.fn(() => ({
      message: "Queue review skill attached to Implement frontend.",
      status: "attached" as const,
      taskTitle: "Implement frontend",
    }));

    renderWidget({
      onAttachContextToCoordinator: attachToCoordinator,
      onAttachKnowledgeContextToQueueTask: attachKnowledgeContextToQueueTask,
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onGetSkill: vi.fn(async () => skill),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();

    expect(document.body.textContent).toContain(
      "Source file/path: docs/feature.md",
    );
    expect(document.body.textContent).toContain("Related catalog items:");
    expect(document.body.textContent).toContain(
      "Queue review skill (tags: frontend)",
    );
    expect(document.body.textContent).toContain(
      "Related commits: abc1234",
    );

    await clickListRow("Queue draft docs");

    expect(document.body.textContent).toContain(
      "Source Queue task: queue_knowledge_1",
    );

    await clickCatalogView("Skills");
    await clickListRow("Queue review skill");

    expect(document.body.textContent).toContain(
      "Source file/path: docs/skill.md",
    );
    expect(document.body.textContent).toContain(
      "Source Queue task: queue_skill_1",
    );
    expect(document.body.textContent).toContain(
      "Related commits: def5678",
    );

    await clickButton("Attach to Workspace Agent");

    expect(attachToCoordinator).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(
      "Workspace Agent context: Attached in this session",
    );

    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledWith({
      kind: "skill",
      skill: expect.objectContaining({ skillId: "skill_relations" }),
    });
    expect(document.body.textContent).toContain(
      "Attached Queue task: Implement frontend",
    );
  });

  it("imports an explicit text or Markdown file through Knowledge Document creation", async () => {
    let documents: KnowledgeDocument[] = [];
    const createKnowledgeDocument = vi.fn(async (request) => {
      const document = knowledgeDocumentFixture({
        ...request,
        knowledgeDocumentId: "doc_imported",
      });
      documents = [document];
      return document;
    });
    const readImportFile = vi.fn(async () => ({
      content: "# Imported\n\nUse this imported reference.",
      fileName: "README.md",
      title: "README",
    }));

    renderWidget({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onDeleteKnowledgeDocument: vi.fn(async () => true),
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onReadKnowledgeDocumentImportFile: readImportFile,
      onUpdateKnowledgeDocument: vi.fn(async (request) =>
        knowledgeDocumentFixture(request),
      ),
    });

    await flush();
    await changeInput(
      'input[placeholder="Path to .txt, .md, or .markdown file"]',
      "C:\\docs\\README.md",
    );
    await clickButton("Import .txt/.md");

    expect(readImportFile).toHaveBeenCalledWith({
      path: "C:\\docs\\README.md",
    });
    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "# Imported\n\nUse this imported reference.",
        enabled: true,
        scope: "workspace",
        sourceLabel: "README.md",
        tags: "",
        title: "README",
      }),
    );
    expect(document.body.textContent).toContain("Imported document");
    expect(document.body.textContent).toContain("README");
  });

  it("creates a global document and imports as a global document", async () => {
    let documents: KnowledgeDocument[] = [];
    const createKnowledgeDocument = vi.fn(async (request) => {
      const document = knowledgeDocumentFixture({
        ...request,
        knowledgeDocumentId:
          request.scope === "global" ? "doc_global" : "doc_workspace",
      });
      documents = [document, ...documents];
      return document;
    });
    const readImportFile = vi.fn(async () => ({
      content: "# Global\n\nUse this global reference.",
      fileName: "GLOBAL.md",
      title: "GLOBAL",
    }));

    renderWidget({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onDeleteKnowledgeDocument: vi.fn(async () => true),
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onReadKnowledgeDocumentImportFile: readImportFile,
      onUpdateKnowledgeDocument: vi.fn(async (request) =>
        knowledgeDocumentFixture(request),
      ),
    });

    await flush();
    await changeSelectByLabel("Scope", "global");
    await changeInput('input[placeholder="Untitled document"]', "Global docs");
    await changeTextareaByLabel(
      "Full content",
      "Global troubleshooting reference.",
    );
    await clickButton("Save document");

    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "global",
        title: "Global docs",
      }),
    );
    expect(document.body.textContent).toContain("Global");

    await changeInput(
      'input[placeholder="Path to .txt, .md, or .markdown file"]',
      "C:\\docs\\GLOBAL.md",
    );
    await changeSelectByLabel("Import as", "global");
    await clickButton("Import .txt/.md");

    expect(createKnowledgeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: "# Global\n\nUse this global reference.",
        scope: "global",
        sourceLabel: "GLOBAL.md",
        title: "GLOBAL",
      }),
    );
  });

  it("reviews imported Queue draft Knowledge items before accepting or rejecting them", async () => {
    let documents: KnowledgeDocument[] = [];
    let skills: Skill[] = [];
    const createKnowledgeDocument = vi.fn(async (request) => {
      const document = knowledgeDocumentFixture({
        ...request,
        knowledgeDocumentId: `doc_${documents.length + 1}`,
      });
      documents = [document, ...documents];
      return document;
    });
    const createSkill = vi.fn(async (request) => {
      const skill = skillFixture({
        ...request,
        skillId: `skill_${skills.length + 1}`,
      });
      skills = [skill, ...skills];
      return skill;
    });
    const draftPayload = JSON.stringify({
      draftPackId: "pack_queue_1",
      packTitle: "Generated Queue knowledge",
      proposedItems: [
        {
          draftItemId: "draft_doc",
          fullContent: "Review Queue results from the Knowledge widget.",
          quickSummary: "Queue result drafts require operator review.",
          suggestedScope: "workspace-local",
          suggestedTags: ["queue", "knowledge"],
          suggestedType: "documentation_knowledge",
          title: "Queue draft review path",
        },
        {
          draftItemId: "draft_skill",
          fullContent: "Inspect the draft, edit if needed, then accept.",
          quickSummary: "Use when reviewing generated Knowledge drafts.",
          suggestedTags: "review, queue",
          suggestedType: "skill",
          title: "Review generated drafts",
        },
        {
          draftItemId: "draft_reject",
          fullContent: "This draft should not become active Knowledge.",
          quickSummary: "Reject this item.",
          suggestedType: "known_issue",
          title: "Rejected draft",
        },
      ],
      queueItemId: "queue_knowledge_1",
    });

    renderWidget({
      onCreateKnowledgeDocument: createKnowledgeDocument,
      onCreateSkill: createSkill,
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onGetSkill: vi.fn(
        async (skillId) =>
          skills.find((skill) => skill.skillId === skillId) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onListSkills: vi.fn(async () => skills),
    });

    await flush();
    await changeTextareaByLabel("Draft payload", draftPayload);
    await clickButton("Load drafts");

    expect(document.body.textContent).toContain("Generated Queue knowledge");
    expect(document.body.textContent).toContain("Queue draft review path");
    expect(document.body.textContent).toContain("Review generated drafts");
    expect(document.body.textContent).toContain("Rejected draft");

    await clickEnabledButton("Accept");

    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogItemType: "documentation_knowledge",
        content: "Review Queue results from the Knowledge widget.",
        enabled: true,
        lifecycleStatus: "active",
        quickSummary: "Queue result drafts require operator review.",
        scope: "workspace",
        sourceKind: "queue_draft",
        sourceLabel: "Queue task queue_knowledge_1",
        sourceRef: "queue:queue_knowledge_1;draft:draft_doc",
        tags: "queue, knowledge",
        title: "Queue draft review path",
      }),
    );

    await clickEnabledButton("Accept");

    expect(createSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        prerequisites:
          "Queue task queue_knowledge_1\nSource ref: queue:queue_knowledge_1;draft:draft_skill",
        reviewStatus: "reviewed",
        steps: "Inspect the draft, edit if needed, then accept.",
        tags: "review, queue",
        title: "Review generated drafts",
        whenToUse: "Use when reviewing generated Knowledge drafts.",
      }),
    );

    await clickEnabledButton("Reject / archive");

    expect(document.body.textContent).toContain("Accepted");
    expect(document.body.textContent).toContain("Archived");
    expect(createKnowledgeDocument).toHaveBeenCalledTimes(1);
    expect(createSkill).toHaveBeenCalledTimes(1);
  });

  it("marks a saved Knowledge Document stale, warns on attach, and restores active", async () => {
    let knowledgeDocument = knowledgeDocumentFixture({
      content: "Current active content.",
      knowledgeDocumentId: "doc_stale",
      quickSummary: "Current summary.",
      sourceKind: "file_import",
      sourceLabel: "README.md",
      sourceRef: "README.md",
      tags: "docs",
      title: "Source-backed docs",
    });
    const updateKnowledgeDocument = vi.fn(async (request) => {
      knowledgeDocument = knowledgeDocumentFixture({
        ...knowledgeDocument,
        ...request,
        updatedAt: "2026-05-24T01:00:00Z",
      });
      return knowledgeDocument;
    });
    const attachKnowledgeContextToQueueTask = vi.fn(() => ({
      message: "Source-backed docs attached to Refresh docs.",
      status: "attached" as const,
      taskTitle: "Refresh docs",
    }));

    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWidget({
      onAttachKnowledgeContextToQueueTask: attachKnowledgeContextToQueueTask,
      onGetKnowledgeDocument: vi.fn(async () => knowledgeDocument),
      onListKnowledgeDocuments: vi.fn(async () => [knowledgeDocument]),
      onUpdateKnowledgeDocument: updateKnowledgeDocument,
    });

    await flush();
    await clickEnabledButton("Mark stale");

    expect(updateKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Current active content.",
        knowledgeDocumentId: "doc_stale",
        lifecycleStatus: "stale",
        quickSummary: "Current summary.",
        sourceKind: "file_import",
        sourceRef: "README.md",
        title: "Source-backed docs",
      }),
    );
    expect(document.body.textContent).toContain("Document marked stale.");
    expect(document.body.textContent).toContain(
      "This document is stale. Attaching it to a Queue task will keep a visible warning",
    );

    await clickEnabledButton("Attach to Queue task");

    expect(window.confirm).toHaveBeenCalledWith(
      'Attach stale Knowledge Document "Source-backed docs" to the selected Queue task? The task will keep a visible stale-context warning.',
    );
    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledWith({
      document: expect.objectContaining({
        knowledgeDocumentId: "doc_stale",
        lifecycleStatus: "stale",
      }),
      kind: "knowledge_document",
    });
    expect(document.body.textContent).toContain(
      "Stale context warning will be shown on the Queue task.",
    );

    await clickEnabledButton("Restore active");

    expect(updateKnowledgeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: "Current active content.",
        knowledgeDocumentId: "doc_stale",
        lifecycleStatus: "active",
        title: "Source-backed docs",
      }),
    );
    expect(document.body.textContent).toContain("Document restored to active.");
  });

  it("creates a manual Queue refresh task for a source-backed Knowledge Document", async () => {
    const knowledgeDocument = knowledgeDocumentFixture({
      catalogItemType: "documentation_knowledge",
      knowledgeDocumentId: "doc_refresh",
      lifecycleStatus: "active",
      quickSummary: "Current docs summary.",
      sourceKind: "file_import",
      sourceLabel: "README.md",
      sourceRef: "README.md",
      tags: "docs, refresh",
      title: "Refreshable docs",
    });
    const createAgentQueueTask = vi.fn(async (request) => ({
      assignedExecutorWidgetId: null,
      approvalPolicy: null,
      codexExecutable: null,
      createdAt: "2026-05-24T01:00:00Z",
      description: request.description,
      executionPolicy: request.executionPolicy ?? "manual",
      executionWorkspace: null,
      priority: request.priority,
      prompt: request.prompt,
      queueItemId: "queue_refresh_1",
      sandbox: null,
      status: request.status,
      title: request.title,
      updatedAt: "2026-05-24T01:00:00Z",
      workspaceId: "workspace_1",
    }));

    renderWidget({
      onCreateAgentQueueTask: createAgentQueueTask,
      onGetKnowledgeDocument: vi.fn(async () => knowledgeDocument),
      onListKnowledgeDocuments: vi.fn(async () => [knowledgeDocument]),
    });

    await flush();
    await clickEnabledButton("Create refresh task");

    expect(createAgentQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        executionPolicy: "manual",
        priority: 2,
        status: "queued",
        title: "Refresh Knowledge: Refreshable docs",
      }),
    );
    const request = createAgentQueueTask.mock.calls[0][0];
    expect(request.description).toContain(
      "The current item must remain unchanged until the operator manually accepts an update.",
    );
    expect(request.prompt).toContain(
      "Use only the explicitly listed source ref.",
    );
    expect(request.prompt).toContain("Source ref: README.md");
    expect(request.prompt).toContain("Do not activate the update.");
    expect(document.body.textContent).toContain(
      "Refresh task queue_refresh_1 created. The current Knowledge item was not changed.",
    );
  });

  it("does not offer refresh task creation for unsourced Knowledge Documents", async () => {
    const knowledgeDocument = knowledgeDocumentFixture({
      knowledgeDocumentId: "doc_manual",
      sourceKind: "operator_authored",
      sourceRef: "",
      title: "Manual docs",
    });

    renderWidget({
      onCreateAgentQueueTask: vi.fn(),
      onGetKnowledgeDocument: vi.fn(async () => knowledgeDocument),
      onListKnowledgeDocuments: vi.fn(async () => [knowledgeDocument]),
    });

    await flush();

    const button = buttonWithText("Create refresh task");
    expect(button).toBeDefined();
    expect(button?.disabled).toBe(true);
  });

  it("keeps existing Skills tab available after adding Documents tab", async () => {
    renderWidget();

    await flush();
    await clickButton("Skills");

    expect(document.body.textContent).toContain("No skills yet.");
    expect(buttonWithText("New skill")).toBeDefined();
  });
});

function renderWidget(
  overrides: Partial<Parameters<typeof SkillLibraryWidget>[0]> = {},
) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <SkillLibraryWidget
        config={{}}
        definition={definition()}
        instance={instance()}
        onCreateSkill={vi.fn(async (request) => skillFixture(request))}
        onDeleteSkill={vi.fn(async () => true)}
        onGetSkill={vi.fn(async () => null)}
        onListSkills={vi.fn(async () => [])}
        onUpdateSkill={vi.fn(async (request) => skillFixture(request))}
        onCreateKnowledgeDocument={vi.fn(async (request) =>
          knowledgeDocumentFixture(request),
        )}
        onDeleteKnowledgeDocument={vi.fn(async () => true)}
        onGetKnowledgeDocument={vi.fn(async () => null)}
        onListKnowledgeDocuments={vi.fn(async () => [])}
        onUpdateKnowledgeDocument={vi.fn(async (request) =>
          knowledgeDocumentFixture(request),
        )}
        title="Skill Library"
        {...overrides}
      />,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickButton(text: string) {
  await act(async () => {
    const button = buttonWithText(text);
    if (!button) {
      throw new Error(`Button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickEnabledButton(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        !isHidden(candidate) &&
        !candidate.disabled &&
        candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Enabled button not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickCatalogView(text: string) {
  await act(async () => {
    const group = Array.from(document.querySelectorAll("[aria-label]")).find(
      (candidate) =>
        !isHidden(candidate) &&
        candidate.getAttribute("aria-label") === "Knowledge catalog views",
    );
    const button = Array.from(group?.querySelectorAll("button") ?? []).find(
      (candidate) => candidate.textContent === text,
    );
    if (!button) {
      throw new Error(`Catalog view not found: ${text}`);
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonWithText(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (candidate) => !isHidden(candidate) && candidate.textContent === text,
  );
}

async function changeInput(selector: string, value: string) {
  const input = Array.from(
    document.querySelectorAll<HTMLInputElement>(selector),
  ).find((candidate) => !isHidden(candidate));
  if (!input) {
    throw new Error(`Input not found: ${selector}`);
  }

  await act(async () => {
    setNativeValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeTextarea(index: number, value: string) {
  const textarea = Array.from(document.querySelectorAll("textarea")).filter(
    (candidate) => !isHidden(candidate),
  )[index];
  if (!textarea) {
    throw new Error(`Textarea not found: ${index}`);
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeTextareaByLabel(labelText: string, value: string) {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) =>
      !isHidden(candidate) && candidate.textContent?.includes(labelText),
  );
  const textarea = label?.querySelector("textarea");
  if (!textarea) {
    throw new Error(`Textarea not found: ${labelText}`);
  }

  await act(async () => {
    setNativeValue(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeSelect(value: string) {
  const select = Array.from(document.querySelectorAll("select")).find(
    (candidate) => !isHidden(candidate),
  );
  if (!select) {
    throw new Error("Review status select not found.");
  }

  await act(async () => {
    setNativeValue(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeSelectByLabel(labelText: string, value: string) {
  const label = Array.from(document.querySelectorAll("label")).find(
    (candidate) =>
      !isHidden(candidate) && candidate.textContent?.includes(labelText),
  );
  const select = label?.querySelector("select");
  if (!select) {
    throw new Error(`Select not found: ${labelText}`);
  }

  await act(async () => {
    setNativeValue(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function changeCheckbox(labelText: string, checked: boolean) {
  const labels = Array.from(document.querySelectorAll("label")).filter(
    (candidate) =>
      !isHidden(candidate) && candidate.textContent?.includes(labelText),
  );
  const checkbox = labels
    .flatMap((label) => Array.from(label.querySelectorAll("input")))
    .find((input) => input.type === "checkbox");
  if (!checkbox) {
    throw new Error(`Checkbox not found: ${labelText}`);
  }

  await act(async () => {
    if (checkbox.checked !== checked) {
      checkbox.click();
    }
  });
}

function setNativeValue(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    "value",
  );
  descriptor?.set?.call(field, value);
}

function setNativeChecked(field: HTMLInputElement, checked: boolean) {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    "checked",
  );
  descriptor?.set?.call(field, checked);
}

function isHidden(element: Element) {
  return Boolean(element.closest("[hidden]"));
}

function visibleListRowsText() {
  return Array.from(document.querySelectorAll(".skill-list-row"))
    .filter((candidate) => !isHidden(candidate))
    .map((candidate) => candidate.textContent ?? "")
    .join("\n");
}

async function clickListRow(text: string) {
  await act(async () => {
    const row = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".skill-list-row"),
    ).find(
      (candidate) =>
        !isHidden(candidate) && candidate.textContent?.includes(text),
    );
    if (!row) {
      throw new Error(`List row not found: ${text}`);
    }
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function skillFixture(
  overrides: Partial<Skill> & {
    reviewStatus?: Skill["reviewStatus"];
    title?: string;
  } = {},
): Skill {
  return {
    createdAt: "2026-05-24T00:00:00Z",
    prerequisites: "",
    reviewStatus: "draft",
    risks: "",
    skillId: "skill_1",
    steps: "",
    tags: "",
    title: "Skill",
    updatedAt: "2026-05-24T00:00:00Z",
    validation: "",
    whenToUse: "",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function knowledgeDocumentFixture(
  overrides: Partial<KnowledgeDocument> & {
    title?: string;
  } = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "",
    createdAt: "2026-05-24T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    lifecycleStatus: "active",
    quickSummary: "",
    scope: "workspace",
    sourceKind: "operator_authored",
    sourceLabel: "Workspace document",
    sourceRef: "",
    tags: "",
    title: "Document",
    updatedAt: "2026-05-24T00:00:00Z",
    workspaceId: "workspace_1",
    ...overrides,
  };
}

function definition(): WidgetDefinition {
  return {
    category: "knowledge",
    componentKey: "skill-library-widget",
    defaultConfig: {},
    defaultTitle: "Skill Library",
    description: "Skill Library",
    id: "skill-library",
    title: "Skill Library",
  };
}

function instance(): WidgetInstance {
  return {
    config: {},
    definitionId: "skill-library",
    id: "skill_widget",
    layout: {
      area: "main",
      height: 720,
      mode: "docked",
      order: 0,
      width: 760,
      x: 0,
      y: 0,
    },
    state: {},
    title: "Skill Library",
    visible: true,
  };
}
