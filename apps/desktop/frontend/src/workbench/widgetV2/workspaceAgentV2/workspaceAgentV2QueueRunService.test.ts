import { describe, expect, it, vi } from "vitest";

import type { AgentContextSnapshot } from "../../agentRuntime";
import type { AgentQueueTask } from "../../../workspace/types";
import type {
  QueueCreateItemRequest,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import {
  buildQueueRunRequestFromComposer,
  createQueueTaskFromAgentRequest,
  mapQueueTaskCreatedResult,
  WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE,
} from "./workspaceAgentV2QueueRunService";

describe("workspaceAgentV2QueueRunService", () => {
  it("maps a composer prompt to a typed Queue task create request", async () => {
    const createItem = createItemMock();
    const built = buildQueueRunRequestFromComposer({
      createdFromTranscriptId: "transcript-1",
      desiredStatus: "queued",
      priority: 4,
      prompt: "Implement the Queue Run bridge.\nKeep it typed.",
      tags: ["agent-v2", "queue-run"],
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: queueBridge({ createItem }),
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "workspace_agent",
        priority: 4,
        prompt: "Implement the Queue Run bridge.\nKeep it typed.",
        queueTag: { name: "agent-v2" },
        status: "queued",
        title: "Implement the Queue Run bridge.",
      }),
    );
    expect(firstCreateRequest(createItem).description).toContain(
      "Source: WorkspaceAgentV2",
    );
    expect(firstCreateRequest(createItem).description).toContain(
      "Created from transcript: transcript-1",
    );
  });

  it("rejects an empty prompt before Queue creation", async () => {
    const built = buildQueueRunRequestFromComposer({
      prompt: "   ",
    });

    expect(built).toMatchObject({
      code: "missing_prompt",
      ok: false,
      status: "unsupported",
    });
  });

  it("attaches supported visible Knowledge and Skill refs through durable APIs", async () => {
    const createItem = createItemMock();
    const attachKnowledgeToQueueTask = vi.fn(async () => agentQueueTask());
    const attachSkillToQueueTask = vi.fn(async () => agentQueueTask());
    const built = buildQueueRunRequestFromComposer({
      contextItems: [
        {
          id: "knowledge-doc-1",
          label: "Queue API audit",
          source: "Knowledge / Skills",
          type: "knowledge",
          version: "doc-v1",
        },
        {
          id: "skill-1",
          label: "Frontend implementation skill",
          source: "Knowledge / Skills",
          type: "skill",
          version: "v1",
        },
      ],
      prompt: "Create a Queue task with visible context.",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    expect(built.request.visibleContextRefs).toEqual([
      expect.objectContaining({
        id: "knowledge-doc-1",
        label: "Queue API audit",
        type: "knowledge",
      }),
      expect.objectContaining({
        id: "skill-1",
        label: "Frontend implementation skill",
        type: "skill",
        version: "v1",
      }),
    ]);

    const result = await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: queueBridge({
        attachKnowledgeToQueueTask,
        attachSkillToQueueTask,
        createItem,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      contextAttachmentReport: {
        attached: [
          expect.objectContaining({ id: "knowledge-doc-1", type: "knowledge" }),
          expect.objectContaining({ id: "skill-1", type: "skill" }),
        ],
        skipped: [],
      },
      visibleContextRefs: built.request.visibleContextRefs,
    });
    expect(attachKnowledgeToQueueTask).toHaveBeenCalledWith({
      knowledgeId: "knowledge-doc-1",
      queueItemId: "queue-item-1",
    });
    expect(attachSkillToQueueTask).toHaveBeenCalledWith({
      queueItemId: "queue-item-1",
      skillId: "skill-1",
    });
    expect(firstCreateRequest(createItem)).not.toHaveProperty("visibleContextRefs");
    expect(firstCreateRequest(createItem)).not.toHaveProperty(
      "visibleContextSnapshot",
    );
    expect(firstCreateRequest(createItem).description).toContain(
      "Visible context refs selected: 2",
    );
    expect(JSON.stringify(firstCreateRequest(createItem))).not.toContain(
      "full document body",
    );
  });

  it("uses only visible context strip items and not snapshot refs for Queue context", async () => {
    const createItem = createItemMock();
    const attachKnowledgeToQueueTask = vi.fn(async () => agentQueueTask());
    const visibleContextSnapshot: AgentContextSnapshot = {
      contextRefs: [
        {
          id: "hidden-snapshot-knowledge",
          kind: "knowledge",
          label: "Snapshot ref should not attach",
          scope: "workspace-local",
        },
      ],
      createdAtMs: 1_000,
      id: "snapshot-1",
      summary: "Visible snapshot is not the Queue Run source.",
      tokenEstimate: 24,
      visibleTextPreview: "full document body should not be copied",
    };
    const built = buildQueueRunRequestFromComposer({
      contextItems: [
        {
          id: "knowledge-doc-1",
          label: "Queue API audit",
          source: "Knowledge / Skills",
          type: "knowledge",
        },
      ],
      prompt: "Create a Queue task with strip context only.",
      visibleContextSnapshot,
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: queueBridge({ attachKnowledgeToQueueTask, createItem }),
    });

    expect(attachKnowledgeToQueueTask).toHaveBeenCalledTimes(1);
    expect(attachKnowledgeToQueueTask).toHaveBeenCalledWith({
      knowledgeId: "knowledge-doc-1",
      queueItemId: "queue-item-1",
    });
    expect(JSON.stringify(firstCreateRequest(createItem))).not.toContain(
      "hidden-snapshot-knowledge",
    );
    expect(JSON.stringify(firstCreateRequest(createItem))).not.toContain(
      "full document body",
    );
  });

  it("skips disabled or rejected visible context with warnings", async () => {
    const createItem = createItemMock();
    const attachKnowledgeToQueueTask = vi.fn(async () => agentQueueTask());
    const attachSkillToQueueTask = vi.fn(async () => agentQueueTask());
    const built = buildQueueRunRequestFromComposer({
      contextItems: [
        {
          id: "disabled-doc",
          label: "Disabled docs",
          source: "Knowledge / Skills",
          type: "knowledge",
          warnings: ["disabled"],
        },
        {
          id: "rejected-skill",
          label: "Rejected skill",
          source: "Knowledge / Skills",
          type: "skill",
          warnings: ["rejected"],
        },
      ],
      prompt: "Create a Queue task.",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const result = await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: queueBridge({
        attachKnowledgeToQueueTask,
        attachSkillToQueueTask,
        createItem,
      }),
    });

    expect(result.ok).toBe(true);
    if (result.status !== "created") {
      return;
    }
    expect(attachKnowledgeToQueueTask).not.toHaveBeenCalled();
    expect(attachSkillToQueueTask).not.toHaveBeenCalled();
    expect(result.contextAttachmentReport.attached).toHaveLength(0);
    expect(result.contextAttachmentReport.skipped).toHaveLength(2);
    expect(result.contextAttachmentReport.warnings.join("\n")).toContain(
      "Disabled context was skipped",
    );
    expect(result.contextAttachmentReport.warnings.join("\n")).toContain(
      "Rejected context was skipped",
    );
  });

  it("reports unsupported visible context without copying text into the prompt", async () => {
    const createItem = createItemMock();
    const built = buildQueueRunRequestFromComposer({
      contextItems: [
        {
          id: "manual-1",
          label: "Manual visible note",
          source: "Context strip",
          type: "manual",
          warningDetails: ["full document body must not be copied"],
        },
      ],
      prompt: "Create a Queue task.",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const result = await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: queueBridge({ createItem }),
    });

    expect(result.ok).toBe(true);
    if (result.status !== "created") {
      return;
    }
    expect(result.contextAttachmentReport.attached).toHaveLength(0);
    expect(result.contextAttachmentReport.skipped).toEqual([
      expect.objectContaining({ id: "manual-1", type: "manual" }),
    ]);
    expect(result.contextAttachmentReport.warnings.join("\n")).toContain(
      "cannot be durably attached",
    );
    expect(JSON.stringify(firstCreateRequest(createItem))).not.toContain(
      "full document body must not be copied",
    );
  });

  it("returns unsupported when the Queue create dependency is missing", async () => {
    const built = buildQueueRunRequestFromComposer({
      prompt: "Create a Queue task.",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const result = await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: null,
    });

    expect(result).toMatchObject({
      code: "queue_create_unavailable",
      ok: false,
      sourceModule: WORKSPACE_AGENT_V2_QUEUE_RUN_SOURCE,
      status: "unsupported",
    });
  });

  it("create path does not invoke run, start, or autorun actions", async () => {
    const createItem = createItemMock();
    const startAssignedAgentQueueTask = vi.fn();
    const runAutonomousQueue = vi.fn();
    const stopAutonomousQueueAfterCurrent = vi.fn();
    const built = buildQueueRunRequestFromComposer({
      prompt: "Create only; do not start.",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    await createQueueTaskFromAgentRequest(built.request, {
      queueBridge: queueBridge({
        createItem,
        runAutonomousQueue,
        stopAutonomousQueueAfterCurrent,
      }),
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(runAutonomousQueue).not.toHaveBeenCalled();
    expect(stopAutonomousQueueAfterCurrent).not.toHaveBeenCalled();
  });

  it("maps Queue create failures without hiding the typed Queue result", () => {
    const built = buildQueueRunRequestFromComposer({
      prompt: "Create a Queue task.",
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const queueCreateResult: QueueWidgetActionResult<QueueWidgetItemSnapshot> = {
      action: "queue.createItem",
      error: {
        code: "missing_title",
        message: "Queue item title is required.",
      },
      events: [],
      message: "Queue item title is required.",
      ok: false,
      safetyClass: "safe_create_update",
    };

    const result = mapQueueTaskCreatedResult({
      queueCreateResult,
      request: built.request,
    });

    expect(result).toMatchObject({
      action: "queue.createItem",
      errorCode: "missing_title",
      ok: false,
      queueCreateResult,
      status: "failed",
    });
  });
});

function queueBridge({
  attachKnowledgeToQueueTask,
  attachSkillToQueueTask,
  createItem,
  runAutonomousQueue,
  stopAutonomousQueueAfterCurrent,
}: {
  readonly attachKnowledgeToQueueTask?: WorkspaceAgentQueueBridge["attachKnowledgeToQueueTask"];
  readonly attachSkillToQueueTask?: WorkspaceAgentQueueBridge["attachSkillToQueueTask"];
  readonly createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  readonly runAutonomousQueue?: WorkspaceAgentQueueBridge["runAutonomousQueue"];
  readonly stopAutonomousQueueAfterCurrent?: WorkspaceAgentQueueBridge["stopAutonomousQueueAfterCurrent"];
}): WorkspaceAgentQueueBridge {
  return {
    attachKnowledgeToQueueTask,
    attachSkillToQueueTask,
    createItem,
    getSnapshot: vi.fn(),
    runAutonomousQueue,
    stopAutonomousQueueAfterCurrent,
    updateItem: vi.fn(),
  };
}

function createItemMock() {
  return vi.fn(
    async (
      _request: Omit<QueueCreateItemRequest, "workspaceId">,
    ): Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>> =>
      queueCreateResult(),
  );
}

function firstCreateRequest(
  createItem: ReturnType<typeof createItemMock>,
): Omit<QueueCreateItemRequest, "workspaceId"> {
  const request = createItem.mock.calls[0]?.[0];
  expect(request).toBeDefined();
  return request as Omit<QueueCreateItemRequest, "workspaceId">;
}

function queueCreateResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item: QueueWidgetItemSnapshot = {
    approvalPolicy: null,
    blockers: [],
    codexExecutable: null,
    dependencies: [],
    description: "",
    evidenceSummary: {
      runRefs: [],
      status: "none",
    },
    executionPolicy: "manual",
    executionStatus: "draft",
    executionWorkspace: null,
    id: "queue-item-1",
    priority: 0,
    prompt: "Create only; do not start.",
    queueId: "workspace:workspace-1:agent-queue",
    queueTag: {
      id: null,
      name: null,
    },
    reportSummary: {
      status: "none",
    },
    runLinks: [],
    sandbox: null,
    status: "draft",
    title: "Create only",
    workspaceId: "workspace-1",
    ...overrides,
  };

  return {
    action: "queue.createItem",
    events: [],
    item,
    message:
      "Queue item created. No task execution, Agent Executor run, Queue Autorun, Terminal command, Git action, validation, or coordinator finalization was started.",
    ok: true,
    safetyClass: "safe_create_update",
  };
}

function agentQueueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: null,
    assignedExecutorWidgetId: null,
    codexExecutable: null,
    createdAt: "2026-06-09T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    executionWorkspace: null,
    priority: 0,
    prompt: "Create only; do not start.",
    queueItemId: "queue-item-1",
    sandbox: null,
    status: "draft",
    title: "Create only",
    updatedAt: "2026-06-09T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
