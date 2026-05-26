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
    });

    await flush();

    expect(document.body.textContent).toContain("No skills yet.");
    expect(document.body.textContent).toContain("Workspace-local.");
    expect(document.body.textContent).toContain(
      "Skills attach explicitly.",
    );
    expect(document.body.textContent).toContain(
      "Skills are not sent to Workspace Agent unless explicitly attached.",
    );
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
    expect(request.contextText).toContain("Prerequisites:\nReviewed working tree");
    expect(request.contextText).toContain("Steps:\nRun typecheck\nRun focused tests");
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
      onGetSkill: vi.fn(async (skillId) =>
        skills.find((skill) => skill.skillId === skillId) ?? null,
      ),
      onListSkills: vi.fn(async () => skills),
      onUpdateSkill: updateSkill,
    });

    await flush();
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

  it("renders Documents tab and creates, saves, and deletes a document", async () => {
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
      onGetKnowledgeDocument: vi.fn(async (knowledgeDocumentId) =>
        documents.find(
          (document) =>
            document.knowledgeDocumentId === knowledgeDocumentId,
        ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onUpdateKnowledgeDocument: updateKnowledgeDocument,
    });

    await flush();
    await clickButton("Documents");

    expect(document.body.textContent).toContain("No documents yet.");
    expect(document.body.textContent).toContain(
      "Workspace Agent can search enabled workspace documents.",
    );

    await changeInput('input[placeholder="Untitled document"]', "API docs");
    await changeInput('input[placeholder="README.md or pasted docs"]', "README.md");
    await changeInput('input[placeholder="api, onboarding"]', "api, docs");
    await changeTextarea(0, "Use this API reference for onboarding.");
    await clickButton("Save document");

    expect(createKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Use this API reference for onboarding.",
        enabled: true,
        sourceLabel: "README.md",
        tags: "api, docs",
        title: "API docs",
      }),
    );
    expect(document.body.textContent).toContain("API docs");

    await changeInput('input[placeholder="Untitled document"]', "Updated API docs");
    await changeCheckbox("Searchable by Workspace Agent", false);
    await clickButton("Save document");

    expect(updateKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        knowledgeDocumentId: "doc_created",
        title: "Updated API docs",
      }),
    );
    expect(document.body.textContent).toContain(
      "Enabled saved documents may be searched before Run with Codex. Disabled documents are ignored.",
    );

    await clickButton("Delete");

    expect(deleteKnowledgeDocument).toHaveBeenCalledWith({
      knowledgeDocumentId: "doc_created",
    });
    expect(document.body.textContent).toContain("No documents yet.");
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
      onGetKnowledgeDocument: vi.fn(async (knowledgeDocumentId) =>
        documents.find(
          (document) =>
            document.knowledgeDocumentId === knowledgeDocumentId,
        ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
      onReadKnowledgeDocumentImportFile: readImportFile,
      onUpdateKnowledgeDocument: vi.fn(async (request) =>
        knowledgeDocumentFixture(request),
      ),
    });

    await flush();
    await clickButton("Documents");
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
        sourceLabel: "README.md",
        tags: "",
        title: "README",
      }),
    );
    expect(document.body.textContent).toContain("Imported document");
    expect(document.body.textContent).toContain("README");
  });

  it("keeps existing Skills tab available after adding Documents tab", async () => {
    renderWidget();

    await flush();
    await clickButton("Documents");
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
    setNativeChecked(checkbox, checked);
    checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
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
    content: "",
    createdAt: "2026-05-24T00:00:00Z",
    enabled: true,
    knowledgeDocumentId: "doc_1",
    sourceLabel: "Workspace document",
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
