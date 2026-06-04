import { describe, expect, it } from "vitest";

import type { AgentQueueTask, KnowledgeDocument, Skill } from "../workspace/types";
import {
  attachContextToQueueTask,
  buildQueueContextAttachment,
} from "./agentQueueKnowledgeContext";

describe("agentQueueKnowledgeContext", () => {
  it("attaches safe Knowledge Document refs without copying raw content", () => {
    const document = knowledgeDocument({
      content: "raw body must not be copied",
      quickSummary: "Use the API contract before editing.",
    });
    const updatedTask = attachContextToQueueTask(
      queueTask(),
      { document, kind: "knowledge_document" },
      "2026-06-04T10:00:00.000Z",
    );

    expect(updatedTask.context?.attachedKnowledgeRefs).toHaveLength(1);
    expect(updatedTask.context?.attachedKnowledgeRefs[0]).toMatchObject({
      id: "doc-1",
      quickSummary: "Use the API contract before editing.",
      source: "Architecture doc",
      status: "active",
      version: "2026-06-04T09:00:00.000Z",
    });
    expect(JSON.stringify(updatedTask.context)).not.toContain(
      "raw body must not be copied",
    );
    expect(updatedTask.context?.materializedAt).toBeNull();
  });

  it("blocks disabled and rejected Knowledge Documents", () => {
    const disabledAttachment = buildQueueContextAttachment({
      document: knowledgeDocument({ enabled: false }),
      kind: "knowledge_document",
    });
    const rejectedAttachment = buildQueueContextAttachment({
      document: knowledgeDocument({ lifecycleStatus: "rejected" }),
      kind: "knowledge_document",
    });

    expect(disabledAttachment.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "disabled", severity: "blocked" }),
      ]),
    );
    expect(rejectedAttachment.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "rejected", severity: "blocked" }),
      ]),
    );
  });

  it("keeps stale Knowledge as visible warning-bearing context", () => {
    const attachment = buildQueueContextAttachment({
      document: knowledgeDocument({ lifecycleStatus: "stale" }),
      kind: "knowledge_document",
    });

    expect(attachment.warnings).toEqual([
      expect.objectContaining({ code: "stale", severity: "warning" }),
    ]);
  });

  it("blocks deprecated Skills and allows reviewed Skills", () => {
    expect(
      buildQueueContextAttachment({
        kind: "skill",
        skill: skill({ reviewStatus: "deprecated" }),
      }).warnings,
    ).toEqual([
      expect.objectContaining({ code: "deprecated", severity: "blocked" }),
    ]);
    expect(
      buildQueueContextAttachment({
        kind: "skill",
        skill: skill({ reviewStatus: "reviewed" }),
      }).warnings,
    ).toEqual([]);
  });

  it("replaces an existing ref for the same source", () => {
    const taskWithContext = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({ quickSummary: "Old summary" }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const updatedTask = attachContextToQueueTask(
      taskWithContext,
      {
        document: knowledgeDocument({ quickSummary: "New summary" }),
        kind: "knowledge_document",
      },
      "2026-06-04T11:00:00.000Z",
    );

    expect(updatedTask.context?.attachedKnowledgeRefs).toHaveLength(1);
    expect(updatedTask.context?.attachedKnowledgeRefs[0]?.quickSummary).toBe(
      "New summary",
    );
  });
});

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: null,
    assignedExecutorWidgetId: null,
    codexExecutable: null,
    createdAt: "2026-06-04T08:00:00.000Z",
    description: "Queue task description",
    executionPolicy: "manual",
    executionWorkspace: null,
    priority: 1,
    prompt: "Do the task.",
    queueItemId: "task-1",
    sandbox: null,
    status: "draft",
    title: "Selected task",
    updatedAt: "2026-06-04T08:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function knowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    catalogItemType: "documentation_knowledge",
    content: "",
    createdAt: "2026-06-04T08:00:00.000Z",
    enabled: true,
    knowledgeDocumentId: "doc-1",
    lifecycleStatus: "active",
    quickSummary: "Document summary",
    scope: "workspace",
    sourceKind: "operator_authored",
    sourceLabel: "Architecture doc",
    sourceRef: "docs/ARCHITECTURE.md",
    tags: "docs",
    title: "Architecture",
    updatedAt: "2026-06-04T09:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    createdAt: "2026-06-04T08:00:00.000Z",
    prerequisites: "Read the contract.",
    reviewStatus: "reviewed",
    risks: "None",
    skillId: "skill-1",
    steps: "Apply the focused change.",
    tags: "frontend",
    title: "Focused implementation",
    updatedAt: "2026-06-04T09:00:00.000Z",
    validation: "Run targeted tests.",
    whenToUse: "Use for small implementation blocks.",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
