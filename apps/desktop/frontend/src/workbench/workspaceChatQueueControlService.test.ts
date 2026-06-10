import { describe, expect, it, vi } from "vitest";

import type { AgentQueueTask } from "../workspace/types";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import type {
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
} from "./queue/agentQueueWidgetApiTypes";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import {
  createWorkspaceChatQueueControlService,
  emptyWorkspaceChatQueueTaskDraft,
} from "./workspaceChatQueueControlService";

describe("workspace chat Queue control service", () => {
  it("maps create_task to the existing Workspace Agent Queue bridge create action", async () => {
    const createItem = vi.fn(async () =>
      itemResult({
        id: "queue-created",
        title: "Typed task",
      }),
    );
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const result = await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        approvalPolicy: "never",
        codexExecutable: "codex.cmd",
        executionPolicy: "manual",
        executionWorkspace: "C:/repo",
        priority: "3",
        prompt: "Do the typed Queue task.",
        queueTag: "Control",
        sandbox: "danger_full_access",
        status: "queued",
        title: "Typed task",
      },
      kind: "create_task",
    });

    expect(createItem).toHaveBeenCalledWith({
      approvalPolicy: "never",
      codexExecutable: "codex.cmd",
      description: "",
      executionPolicy: "manual",
      executionWorkspace: "C:/repo",
      priority: 3,
      prompt: "Do the typed Queue task.",
      queueTag: { name: "Control" },
      sandbox: "danger_full_access",
      status: "queued",
      title: "Typed task",
    });
    expect(result).toMatchObject({
      action: "create_task",
      queueItemId: "queue-created",
      status: "success",
    });
  });

  it("returns unavailable for unsupported validation actions", async () => {
    const createItem = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const result = await service.execute({
      kind: "request_validation",
      queueItemId: "queue-1",
    });

    expect(result).toMatchObject({
      action: "request_validation",
      queueItemId: "queue-1",
      status: "unavailable",
    });
    expect(result.reason).toContain("not exposed");
    expect(createItem).not.toHaveBeenCalled();
  });

  it("does not fire actions on service construction", () => {
    const createItem = vi.fn();
    const openTask = vi.fn();
    const runTask = vi.fn();

    createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
      onOpenQueueItem: openTask,
      queue: queueController({
        onStartAssignedTask: runTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    expect(createItem).not.toHaveBeenCalled();
    expect(openTask).not.toHaveBeenCalled();
    expect(runTask).not.toHaveBeenCalled();
  });

  it("create_task does not call Queue run/start actions", async () => {
    const createItem = vi.fn(async () =>
      itemResult({
        id: "queue-created",
        title: "Typed task",
      }),
    );
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
      queue: queueController({
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-created" }),
      }),
    });

    await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        prompt: "Create only.",
        status: "queued",
        title: "Typed task",
      },
      kind: "create_task",
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });

  it("maps create errors to visible failed result objects", async () => {
    const createItem = vi.fn(async () => {
      throw new Error("Queue create failed");
    });
    const service = createWorkspaceChatQueueControlService({
      bridge: queueBridge({ createItem }),
    });

    const result = await service.execute({
      draft: {
        ...emptyWorkspaceChatQueueTaskDraft(),
        prompt: "Create should fail.",
        title: "Failed task",
      },
      kind: "create_task",
    });

    expect(result).toEqual({
      action: "create_task",
      message: "Queue create failed",
      reason: "Queue create failed",
      status: "failed",
    });
  });

  it("runs selected tasks only through the existing Queue run callback", async () => {
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    const result = await service.execute({
      kind: "run_task",
      queueItemId: "queue-1",
    });

    expect(onStartAssignedTask).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      action: "run_task",
      queueItemId: "queue-1",
      status: "success",
    });
  });

  it("does not run a non-selected Queue task", async () => {
    const onStartAssignedTask = vi.fn();
    const service = createWorkspaceChatQueueControlService({
      queue: queueController({
        onStartAssignedTask,
        selectedTask: queueTask({ queueItemId: "queue-1" }),
      }),
    });

    const result = await service.execute({
      kind: "run_task",
      queueItemId: "queue-2",
    });

    expect(result).toMatchObject({
      action: "run_task",
      queueItemId: "queue-2",
      status: "unavailable",
    });
    expect(onStartAssignedTask).not.toHaveBeenCalled();
  });
});

function queueBridge(
  overrides: Partial<WorkspaceAgentQueueBridge> = {},
): WorkspaceAgentQueueBridge {
  return {
    createItem: vi.fn(async () => itemResult()),
    getSnapshot: vi.fn(),
    updateItem: vi.fn(),
    ...overrides,
  } as WorkspaceAgentQueueBridge;
}

function queueController({
  canStart = true,
  onStartAssignedTask = vi.fn(),
  selectedTask,
}: {
  canStart?: boolean;
  onStartAssignedTask?: () => void;
  selectedTask: AgentQueueTask | null;
}): AgentQueueController {
  return {
    coordinatorFinalization: {
      canAct: false,
      message: null,
    },
    diffReview: {
      canCreate: false,
      message: null,
    },
    run: {
      canStart,
      onStartAssignedTask,
      preconditionMessages: [],
      readinessMessage: canStart ? null : "Run is unavailable.",
    },
    selectedTask,
  } as unknown as AgentQueueController;
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "Prompt",
    queueItemId: "queue-1",
    status: "queued",
    title: "Queue task",
    updatedAt: "2026-01-01T00:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  } as AgentQueueTask;
}

function itemResult(
  overrides: Partial<QueueWidgetItemSnapshot> = {},
): QueueWidgetActionResult<QueueWidgetItemSnapshot> {
  const item: QueueWidgetItemSnapshot = {
    blockers: [],
    dependencies: [],
    description: "",
    evidenceSummary: {
      runRefs: [],
      status: "none",
    },
    executionPolicy: "manual",
    executionStatus: "queued",
    id: "queue-created",
    priority: 0,
    prompt: "Prompt",
    queueId: "queue",
    queueTag: {
      id: null,
      name: null,
    },
    reportSummary: {
      status: "none",
    },
    runLinks: [],
    status: "queued",
    title: "Queue task",
    workspaceId: "workspace-1",
    ...overrides,
  };

  return {
    action: "queue.createItem",
    events: [],
    item,
    message: "Created",
    ok: true,
    safetyClass: "safe_create_update",
  };
}
