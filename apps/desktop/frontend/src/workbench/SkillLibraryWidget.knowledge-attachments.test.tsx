import { describe, expect, it, vi } from "vitest";

import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  clickButton,
  clickCatalogView,
  clickListRow,
  flush,
  knowledgeDocumentFixture,
  renderWidget,
  skillFixture,
} from "./SkillLibraryWidget.test-helpers";

describe("SkillLibraryWidget Knowledge / Queue attachments", () => {
  it("attaches the selected saved Skill to the selected Queue task from the catalog", async () => {
    const skill = skillFixture({
      reviewStatus: "reviewed",
      skillId: "skill_queue",
      steps: "Use the Queue context panel.",
      title: "Queue planning skill",
      whenToUse: "Before running a queued frontend task",
    });
    const attachKnowledgeContextToQueueTask = vi.fn(() => ({
      message: "Queue planning skill attached to Frontend test task.",
      status: "attached" as const,
      taskTitle: "Frontend test task",
    }));

    renderWidget({
      onAttachKnowledgeContextToQueueTask: attachKnowledgeContextToQueueTask,
      onGetSkill: vi.fn(async () => skill),
      onListSkills: vi.fn(async () => [skill]),
    });

    await flush();
    await clickCatalogView("Skills");
    await clickListRow("Queue planning skill");
    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledTimes(1);
    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledWith({
      kind: "skill",
      skill: expect.objectContaining({
        reviewStatus: "reviewed",
        skillId: "skill_queue",
        title: "Queue planning skill",
      }),
    });
    expect(document.body.textContent).toContain(
      "Queue planning skill attached to Frontend test task.",
    );
  });

  it("attaches selected Knowledge to Queue and shows blocked disabled-document feedback", async () => {
    const documents = [
      knowledgeDocumentFixture({
        content: "Use the active document body for bounded Queue context.",
        enabled: true,
        knowledgeDocumentId: "doc_active_queue",
        quickSummary: "Active Queue context.",
        sourceLabel: "docs/active.md",
        title: "Active Queue docs",
      }),
      knowledgeDocumentFixture({
        content: "Disabled body must not be accepted for Queue context.",
        enabled: false,
        knowledgeDocumentId: "doc_disabled_queue",
        quickSummary: "Disabled Queue context.",
        sourceLabel: "docs/disabled.md",
        title: "Disabled Queue docs",
      }),
    ];
    const attachKnowledgeContextToQueueTask = vi.fn(
      (
        request:
          | { document: KnowledgeDocument; kind: "knowledge_document" }
          | { kind: "skill"; skill: Skill },
      ) => {
        if (
          request.kind === "knowledge_document" &&
          !request.document.enabled
        ) {
          return {
            message:
              "Disabled Queue docs is disabled and cannot be used as Queue context.",
            status: "blocked" as const,
          };
        }

        return {
          message: "Active Queue docs attached to Frontend test task.",
          status: "attached" as const,
          taskTitle: "Frontend test task",
        };
      },
    );

    renderWidget({
      onAttachKnowledgeContextToQueueTask: attachKnowledgeContextToQueueTask,
      onGetKnowledgeDocument: vi.fn(
        async (knowledgeDocumentId) =>
          documents.find(
            (document) => document.knowledgeDocumentId === knowledgeDocumentId,
          ) ?? null,
      ),
      onListKnowledgeDocuments: vi.fn(async () => documents),
    });

    await flush();

    expect(document.body.textContent).toContain("Active Queue docs");
    expect(document.body.textContent).toContain(
      "Use the active document body for bounded Queue context.",
    );

    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenCalledWith({
      document: expect.objectContaining({
        enabled: true,
        knowledgeDocumentId: "doc_active_queue",
      }),
      kind: "knowledge_document",
    });
    expect(document.body.textContent).toContain(
      "Active Queue docs attached to Frontend test task.",
    );
    expect(document.body.textContent).toContain(
      "Attached Queue task: Frontend test task",
    );

    await clickListRow("Disabled Queue docs");
    await clickButton("Attach to Queue task");

    expect(attachKnowledgeContextToQueueTask).toHaveBeenLastCalledWith({
      document: expect.objectContaining({
        enabled: false,
        knowledgeDocumentId: "doc_disabled_queue",
      }),
      kind: "knowledge_document",
    });
    expect(document.body.textContent).toContain(
      "Disabled Queue docs is disabled and cannot be used as Queue context.",
    );
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Disabled Queue docs is disabled and cannot be used as Queue context.",
    );
  });
});
