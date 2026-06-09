import { describe, expect, it, vi } from "vitest";

import type { AgentContextSnapshot } from "../../agentRuntime";
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

  it("preserves visible context refs and snapshots without passing arbitrary context JSON to createItem", async () => {
    const createItem = createItemMock();
    const visibleContextSnapshot: AgentContextSnapshot = {
      contextRefs: [
        {
          id: "knowledge-doc-1",
          kind: "knowledge",
          label: "Queue API audit",
          scope: "workspace-local",
        },
      ],
      createdAtMs: 1_000,
      id: "snapshot-1",
      summary: "Visible Queue audit context.",
      tokenEstimate: 24,
      visibleTextPreview: "Visible only.",
    };
    const built = buildQueueRunRequestFromComposer({
      contextItems: [
        {
          id: "skill-1",
          label: "Frontend implementation skill",
          source: "Knowledge / Skills",
          type: "skill",
          version: "v1",
        },
      ],
      prompt: "Create a Queue task with visible context.",
      visibleContextSnapshot,
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    expect(built.request.visibleContextSnapshot).toBe(visibleContextSnapshot);
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
      queueBridge: queueBridge({ createItem }),
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      visibleContextRefs: built.request.visibleContextRefs,
    });
    expect(firstCreateRequest(createItem)).not.toHaveProperty("visibleContextRefs");
    expect(firstCreateRequest(createItem)).not.toHaveProperty(
      "visibleContextSnapshot",
    );
    expect(firstCreateRequest(createItem).description).toContain(
      "knowledge:knowledge-doc-1",
    );
    expect(firstCreateRequest(createItem).description).toContain("skill:skill-1");
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
  createItem,
  runAutonomousQueue,
  stopAutonomousQueueAfterCurrent,
}: {
  readonly createItem: (
    request: Omit<QueueCreateItemRequest, "workspaceId">,
  ) => Promise<QueueWidgetActionResult<QueueWidgetItemSnapshot>>;
  readonly runAutonomousQueue?: WorkspaceAgentQueueBridge["runAutonomousQueue"];
  readonly stopAutonomousQueueAfterCurrent?: WorkspaceAgentQueueBridge["stopAutonomousQueueAfterCurrent"];
}): WorkspaceAgentQueueBridge {
  return {
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
