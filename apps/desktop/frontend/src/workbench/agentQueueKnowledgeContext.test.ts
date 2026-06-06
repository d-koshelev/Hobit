import { describe, expect, it } from "vitest";

import type { AgentQueueTask, KnowledgeDocument, Skill } from "../workspace/types";
import {
  attachContextToQueueTask,
  buildQueueContextAttachment,
  detachContextFromQueueTask,
  materializeQueueExecutionPrompt,
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
    expect(JSON.stringify(updatedTask.context?.attachedKnowledgeRefs)).not.toContain(
      "raw body must not be copied",
    );
    expect(updatedTask.context?.attachedKnowledgeSnapshots).toHaveLength(1);
    expect(updatedTask.context?.attachedKnowledgeSnapshots[0]?.content).toContain(
      "Use the API contract before editing.",
    );
    expect(updatedTask.context?.attachedKnowledgeSnapshots[0]?.content).toContain(
      "raw body must not be copied",
    );
    expect(updatedTask.context?.materializedAt).toBe("2026-06-04T10:00:00.000Z");
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
    const taskWithStaleContext = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "Stale context remains visible but warning-bearing.",
          lifecycleStatus: "stale",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const materialized = materializeQueueExecutionPrompt(taskWithStaleContext);

    expect(attachment.warnings).toEqual([
      expect.objectContaining({ code: "stale", severity: "warning" }),
    ]);
    expect(taskWithStaleContext.context?.contextWarnings).toEqual([
      expect.objectContaining({
        code: "stale",
        id: "knowledge_document:doc-1:stale",
        severity: "warning",
      }),
    ]);
    expect(materialized.materializedPrompt).toContain(
      "Stale context remains visible but warning-bearing.",
    );
    expect(materialized.evidenceSection).toContain(
      "Context warning ids: knowledge_document:doc-1:stale",
    );
  });

  it("keeps missing Knowledge quick summaries visible as warning-bearing context", () => {
    const taskWithContext = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "Context body is still bounded and visible.",
          quickSummary: "",
          title: "Unsummarized docs",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const materialized = materializeQueueExecutionPrompt(taskWithContext);

    expect(taskWithContext.context?.attachedKnowledgeRefs[0]).toMatchObject({
      quickSummary: "Summary missing.",
      title: "Unsummarized docs",
    });
    expect(taskWithContext.context?.contextWarnings).toEqual([
      expect.objectContaining({
        code: "summary_missing",
        id: "knowledge_document:doc-1:summary_missing",
        severity: "warning",
      }),
    ]);
    expect(materialized.materializedPrompt).toContain("Summary: Summary missing.");
    expect(materialized.evidenceSection).toContain(
      "Context warning ids: knowledge_document:doc-1:summary_missing",
    );
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

  it("detaches refs and snapshots without changing the stored prompt", () => {
    const taskWithContext = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "Durable bounded snapshot.",
          quickSummary: "Durable summary.",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const ref = taskWithContext.context?.attachedKnowledgeRefs[0];

    const updatedTask = detachContextFromQueueTask(taskWithContext, ref!);

    expect(updatedTask.prompt).toBe("Do the task.");
    expect(updatedTask.context?.attachedKnowledgeRefs).toHaveLength(0);
    expect(updatedTask.context?.attachedKnowledgeSnapshots).toHaveLength(0);
    expect(updatedTask.context?.contextWarnings).toHaveLength(0);
  });

  it("materializes visible Queue context before the task prompt with context-used refs", () => {
    const taskWithDocument = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "Read the active contract before changing the Queue run path.",
          quickSummary: "Use the active contract.",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const taskWithSkill = attachContextToQueueTask(
      taskWithDocument,
      {
        kind: "skill",
        skill: skill({
          steps: "Keep the patch scoped.\nRun targeted validation.",
          validation: "Typecheck and targeted tests.",
        }),
      },
      "2026-06-04T10:01:00.000Z",
    );

    const materialized = materializeQueueExecutionPrompt(taskWithSkill);

    expect(materialized.contextSection).toContain("Visible Skill Instructions");
    expect(materialized.contextSection).toContain(
      "Visible Knowledge Document Excerpts",
    );
    expect(materialized.contextSection).toContain(
      "Only this visible, bounded Queue-owned task context is included.",
    );
    expect(materialized.contextSection).toContain(
      "This context is saved on the Queue task until removed.",
    );
    expect(materialized.materializedPrompt.indexOf("Knowledge / Skills context")).toBeLessThan(
      materialized.materializedPrompt.indexOf("Do the task."),
    );
    expect(materialized.materializedPrompt).toContain(
      "Context used",
    );
    expect(materialized.materializedPrompt).toContain(
      "Context storage: durable Queue task context.",
    );
    expect(materialized.materializedPrompt).toContain(
      "Included in this run prompt: yes.",
    );
    expect(materialized.materializedPrompt).toContain("Knowledge refs used: doc-1@");
    expect(materialized.materializedPrompt).toContain("Skill refs used: skill-1@");
    expect(materialized.snapshotsUsed).toHaveLength(2);
    expect(materialized.tokenEstimate).toBeGreaterThan(0);
  });

  it("caps materialized Knowledge excerpts deterministically", () => {
    const updatedTask = attachContextToQueueTask(
      queueTask(),
      {
        document: knowledgeDocument({
          content: "A".repeat(3000),
          quickSummary: "Long document",
        }),
        kind: "knowledge_document",
      },
      "2026-06-04T10:00:00.000Z",
    );
    const snapshot = updatedTask.context?.attachedKnowledgeSnapshots[0];

    expect(snapshot?.capped).toBe(true);
    expect(snapshot?.content).toContain("[truncated]");
    expect(snapshot?.content.length).toBeLessThan(2600);
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
