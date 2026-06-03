import { describe, expect, it, vi } from "vitest";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import { createWorkspaceAgentQueueBridge } from "../workspaceAgentQueueBridge";
import {
  createAgentQueueWidgetApi,
  queueIdForWorkspace,
} from "./agentQueueWidgetApi";

describe("agentQueueWidgetApi", () => {
  it("returns a singleton Queue snapshot with items and counts", async () => {
    const harness = createQueueApiHarness([
      queueTask({
        queueItemId: "task-draft",
        status: "draft",
      }),
      queueTask({
        coordinatorStatus: "awaiting_coordinator_review",
        queueItemId: "task-review",
        status: "review_needed",
        validationStatus: "needs_review",
      }),
      queueTask({
        queueItemId: "task-running",
        status: "running",
      }),
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "task-finalized",
        status: "completed",
      }),
    ]);

    const result = await harness.api.getSnapshot({
      selectedItemId: "task-review",
      workspaceId: "workspace-1",
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.queueId).toBe(
      queueIdForWorkspace("workspace-1"),
    );
    expect(result.snapshot?.widgetType).toBe("agent-queue");
    expect(result.snapshot?.coordinatorId).toBe("primary");
    expect(result.snapshot?.items).toHaveLength(4);
    expect(result.snapshot?.selectedItem?.id).toBe("task-review");
    expect(result.snapshot?.countsByStatus.total).toBe(4);
    expect(result.snapshot?.countsByStatus.draft).toBe(1);
    expect(result.snapshot?.countsByStatus.running).toBe(1);
    expect(result.snapshot?.countsByStatus.reportReady).toBe(1);
    expect(result.snapshot?.countsByStatus.finalized).toBe(1);
    expect(result.snapshot?.runningCount).toBe(1);
    expect(result.snapshot?.reportReadyCount).toBe(1);
    expect(result.snapshot?.finalizedCount).toBe(1);
    expect(result.snapshot?.localExecutorState.executorCount).toBe(1);
    expect(result.snapshot?.autonomousRunnerState.status).toBe("idle");
    expect(result.snapshot?.capsAndRedactions.join(" ")).toContain(
      "raw Executor logs",
    );
  });

  it("creates a Queue item with title, prompt, status, and task-scoped run settings without running it", async () => {
    const harness = createQueueApiHarness([]);

    const result = await harness.api.createItem({
      actor: "workspace_agent",
      approvalPolicy: "on_request",
      codexExecutable: "codex.cmd",
      executionPolicy: "auto",
      executionWorkspace: "C:/repo",
      priority: 4,
      prompt: "Implement the adapter slice.",
      sandbox: "workspace_write",
      status: "queued",
      title: "Implement Queue API",
      workspaceId: "workspace-1",
    });

    expect(result.ok).toBe(true);
    expect(result.item?.title).toBe("Implement Queue API");
    expect(result.item?.prompt).toBe("Implement the adapter slice.");
    expect(result.item?.status).toBe("queued");
    expect(result.item?.executionWorkspace).toBe("C:/repo");
    expect(result.item?.codexExecutable).toBe("codex.cmd");
    expect(result.item?.sandbox).toBe("workspace_write");
    expect(result.item?.approvalPolicy).toBe("on_request");
    expect(harness.createRequests).toEqual([
      expect.objectContaining({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionWorkspace: "C:/repo",
        prompt: "Implement the adapter slice.",
        sandbox: "workspace_write",
        status: "queued",
        title: "Implement Queue API",
      }),
    ]);
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.runCodexDirectWork).not.toHaveBeenCalled();
  });

  it("updates only provided fields and preserves task-scoped run settings", async () => {
    const harness = createQueueApiHarness([
      queueTask({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        priority: 3,
        prompt: "Original prompt",
        sandbox: "workspace_write",
        status: "queued",
        title: "Original title",
      }),
    ]);

    const result = await harness.api.updateItem({
      actor: "workspace_agent",
      itemId: "task-1",
      patch: {
        priority: 5,
        title: "Updated title",
      },
      workspaceId: "workspace-1",
    });

    expect(result.ok).toBe(true);
    expect(result.item?.title).toBe("Updated title");
    expect(result.item?.priority).toBe(5);
    expect(result.item?.prompt).toBe("Original prompt");
    expect(result.item?.status).toBe("queued");
    expect(result.item?.executionPolicy).toBe("auto");
    expect(result.item?.executionWorkspace).toBe("C:/repo");
    expect(result.item?.codexExecutable).toBe("codex.cmd");
    expect(result.item?.sandbox).toBe("workspace_write");
    expect(result.item?.approvalPolicy).toBe("on_request");
    expect(harness.updateRequests).toEqual([
      expect.objectContaining({
        approvalPolicy: "on_request",
        codexExecutable: "codex.cmd",
        executionPolicy: "auto",
        executionWorkspace: "C:/repo",
        priority: 5,
        prompt: "Original prompt",
        sandbox: "workspace_write",
        status: "queued",
        title: "Updated title",
      }),
    ]);
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.runCodexDirectWork).not.toHaveBeenCalled();
  });

  it("lets Workspace Agent bridge call getSnapshot, createItem, and updateItem", async () => {
    const harness = createQueueApiHarness([
      queueTask({
        prompt: "Existing prompt",
        status: "draft",
      }),
    ]);
    const refreshAfterMutation = vi.fn(async () => undefined);
    const bridge = createWorkspaceAgentQueueBridge({
      queueApi: harness.api,
      queueState: {
        getRunSettingsDefaults: () => ({
          approvalPolicy: "never",
          codexExecutable: "codex.cmd",
          executionWorkspace: "C:/repo",
          sandbox: "read_only",
        }),
        refreshAfterMutation,
      },
      workspaceId: "workspace-1",
    });

    const snapshot = await bridge.getSnapshot();
    const defaults = bridge.getRunSettingsDefaults?.();
    const created = await bridge.createItem({
      prompt: "Create through bridge",
      status: "queued",
      title: "Bridge task",
    });
    const snapshotAfterCreate = await bridge.getSnapshot();
    const updated = await bridge.updateItem({
      itemId: created.item?.id ?? "missing",
      patch: {
        description: "Updated through bridge",
      },
    });

    expect(snapshot.ok).toBe(true);
    expect(defaults?.executionWorkspace).toBe("C:/repo");
    expect(created.ok).toBe(true);
    expect(
      snapshotAfterCreate.snapshot?.items.some(
        (item) => item.id === created.item?.id,
      ),
    ).toBe(true);
    expect(updated.ok).toBe(true);
    expect(created.events[0]?.actor).toBe("workspace_agent");
    expect(updated.item?.description).toBe("Updated through bridge");
    expect(refreshAfterMutation).toHaveBeenCalledWith(created.item?.id);
    expect(refreshAfterMutation).toHaveBeenCalledWith(updated.item?.id);
    expect(harness.createRequests).toHaveLength(1);
    expect(harness.updateRequests).toHaveLength(1);
  });

  it("rejects unsupported order mutation instead of using a storage or execution workaround", async () => {
    const harness = createQueueApiHarness([queueTask()]);

    const result = await harness.api.updateItem({
      itemId: "task-1",
      patch: {
        order: 2,
      },
      workspaceId: "workspace-1",
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("unsupported_field");
    expect(harness.updateRequests).toHaveLength(0);
    expect(harness.startAssignedAgentQueueTask).not.toHaveBeenCalled();
    expect(harness.runCodexDirectWork).not.toHaveBeenCalled();
  });
});

function createQueueApiHarness(initialTasks: AgentQueueTask[]) {
  const tasks = new Map(initialTasks.map((task) => [task.queueItemId, task]));
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const startAssignedAgentQueueTask = vi.fn();
  const runCodexDirectWork = vi.fn();
  const api = createAgentQueueWidgetApi({
    agentExecutorSlots: [
      {
        label: "Local executor 1",
        widgetInstanceId: "executor-1",
      },
    ],
    createAgentQueueTask: async (request) => {
      createRequests.push(request);
      const task = queueTask({
        approvalPolicy: request.approvalPolicy ?? null,
        codexExecutable: request.codexExecutable ?? null,
        dependsOn: request.dependsOn,
        description: request.description,
        executionPolicy: request.executionPolicy ?? "manual",
        executionWorkspace: request.executionWorkspace ?? null,
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueItemId: `task-${tasks.size + 1}`,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
        validationStatus: request.validationStatus,
      });
      tasks.set(task.queueItemId, task);
      return task;
    },
    getAgentQueueRunnerSnapshot: async () => queueRunnerSnapshot(),
    getAgentQueueTask: async (queueItemId) => tasks.get(queueItemId) ?? null,
    listAgentQueueTaskRunLinks: async (queueItemId) =>
      queueItemId === "task-review" ? [queueRunLink({ queueTaskId: queueItemId })] : [],
    listAgentQueueTasks: async () => Array.from(tasks.values()),
    listAgentQueueWorkers: async () => [],
    now: () => "2026-06-02T12:00:00.000Z",
    updateAgentQueueTask: async (request) => {
      updateRequests.push(request);
      const task = tasks.get(request.queueItemId);
      if (!task) {
        return null;
      }

      const updated = {
        ...task,
        approvalPolicy: request.approvalPolicy ?? null,
        codexExecutable: request.codexExecutable ?? null,
        dependsOn: request.dependsOn ?? task.dependsOn,
        description: request.description,
        executionPolicy: request.executionPolicy ?? "manual",
        executionWorkspace: request.executionWorkspace ?? null,
        itemType: request.itemType,
        priority: request.priority,
        prompt: request.prompt,
        queueTagId: request.queueTagId,
        queueTagName: request.queueTagName,
        sandbox: request.sandbox ?? null,
        status: request.status,
        title: request.title,
        updatedAt: "2026-06-02T12:00:00.000Z",
        validationStatus: request.validationStatus,
      } satisfies AgentQueueTask;
      tasks.set(updated.queueItemId, updated);
      return updated;
    },
    workspaceId: "workspace-1",
  });

  return {
    api,
    createRequests,
    runCodexDirectWork,
    startAssignedAgentQueueTask,
    updateRequests,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    approvalPolicy: "never",
    assignedExecutorWidgetId: null,
    codexExecutable: "codex.cmd",
    createdAt: "2026-06-02T11:00:00.000Z",
    dependsOn: [],
    description: "",
    executionPolicy: "manual",
    executionWorkspace: "C:/repo",
    priority: 0,
    prompt: "",
    queueItemId: "task-1",
    sandbox: "read_only",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-06-02T11:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueRunLink(
  overrides: Partial<AgentQueueTaskRunLinkSummary> = {},
): AgentQueueTaskRunLinkSummary {
  return {
    completedAt: "2026-06-02T11:30:00.000Z",
    createdAt: "2026-06-02T11:20:00.000Z",
    directWorkRunId: "run-1",
    executorWidgetId: "executor-1",
    linkId: "link-1",
    queueTaskId: "task-1",
    reviewStatus: "review_needed",
    source: "manual",
    startedAt: "2026-06-02T11:20:00.000Z",
    status: "completed",
    updatedAt: "2026-06-02T11:30:00.000Z",
    validationStatus: "passed",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueRunnerSnapshot(
  overrides: Partial<AgentQueueRunnerSnapshot> = {},
): AgentQueueRunnerSnapshot {
  return {
    activeQueueItemId: null,
    finalRunStatus: null,
    isActive: false,
    isSessionOnly: true,
    lastReconciledAt: null,
    policy: {
      allowHiddenExecution: false,
      durableResume: false,
      oneTaskAtATime: true,
      requireOperatorStart: true,
      stopOnCancel: true,
      stopOnFailure: true,
      stopOnReviewNeeded: true,
    },
    sessionId: null,
    status: "idle",
    stopReason: null,
    waitingRunId: null,
    ...overrides,
  };
}
