import { act } from "react";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AssignAgentQueueTaskToExecutorRequest,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  DeleteAgentQueueTaskRequest,
  StartAgentQueueRunnerSessionRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import type { DirectWorkRunHandoffInput } from "../types";
import {
  flushHookEffects,
  renderHook,
} from "../test-utils/renderHook";
import { useAgentQueueController } from "./useAgentQueueController";

type AgentQueueControllerOptions = Parameters<
  typeof useAgentQueueController
>[0];

describe("useAgentQueueController executionPolicy draft", () => {
  it("defaults old queue tasks into the Queue + Workers foundation model", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Legacy task" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.selectedTask?.queueTagName).toBe("Default");
    expect(hook.result.current.selectedTask?.validationStatus).toBe(
      "not_started",
    );
    expect(hook.result.current.selectedTask?.itemType).toBe("implementation");
    expect(hook.result.current.foundation.queueTags[0]?.queueTagId).toBe(
      "default",
    );
    expect(hook.result.current.foundation.queueTags[0]?.queueTagName).toBe(
      "Default",
    );
    expect(hook.result.current.foundation.queueTags[0]?.status).toBe("running");
    expect(hook.result.current.foundation.queueTags[0]?.taskCount).toBe(1);
    expect(hook.result.current.foundation.workers[0]?.name).toBe(
      "Agent Executor 1",
    );
    expect(hook.result.current.foundation.workers[0]?.scope).toEqual({
      kind: "all",
    });
    expect(hook.result.current.foundation.workers[0]?.status).toBe("idle");
    expect(hook.result.current.foundation.workers[0]?.workerId).toBe(
      "executor-1",
    );

    hook.unmount();
  });

  it("updates local worker scope without starting queue execution", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Task" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "default",
        queueTagName: "Default",
      });
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.foundation.onStopWorkers();
      hook.result.current.foundation.onStopAndKillRunning();
    });

    expect(hook.result.current.foundation.workers[0].scope).toEqual({
      kind: "queue_tag",
      queueTagId: "default",
      queueTagName: "Default",
    });
    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("pauses a queue tag for coordinator review when a task is edited", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.updateDraft({ prompt: "Updated prompt" });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(hook.result.current.selectedTask?.validationStatus).toBe(
      "needs_review",
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "awaiting_coordinator_review",
    );
    expect(hook.result.current.validationMessage).toBe(
      "Editing paused this queue tag until coordinator review/resume",
    );
    expect(hook.result.current.run.readinessMessage).toBe(
      "Resume this queue tag before running the selected task.",
    );

    hook.unmount();
  });

  it("reloads the selected task when manual Refresh is requested", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);

    await act(async () => {
      await hook.result.current.refreshTasks();
    });
    await flushControllerLoad();

    expect(harness.listRequests).toBe(2);
    expect(harness.getRequests).toEqual(["queue-1", "queue-1"]);

    hook.unmount();
  });

  it("loads an existing task executionPolicy into the editor draft", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "after_previous_success",
        queueItemId: "queue-1",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.draft.executionPolicy).toBe(
      "after_previous_success",
    );
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("defaults omitted executionPolicy values to manual", async () => {
    const taskWithoutPolicy = queueTask({ queueItemId: "queue-1" });
    delete taskWithoutPolicy.executionPolicy;
    const harness = createQueueHarness([taskWithoutPolicy]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.draft.executionPolicy).toBe("manual");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("creates new task drafts with manual executionPolicy", async () => {
    const harness = createQueueHarness([]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();
    await act(async () => {
      await hook.result.current.createTask();
    });
    await flushControllerLoad();

    expect(harness.createRequests).toHaveLength(1);
    expect(harness.createRequests[0].executionPolicy).toBe("manual");
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual([]);
    expect(hook.result.current.selectedTask?.queueItemId).toBe("queue-1");
    expect(hook.result.current.draft.executionPolicy).toBe("manual");

    hook.unmount();
  });

  it("marks executionPolicy changes dirty and saves the policy", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "manual",
        queueItemId: "queue-1",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.updateDraft({ executionPolicy: "auto" });
    });

    expect(hook.result.current.isDirty).toBe(true);

    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.updateRequests[0].executionPolicy).toBe("auto");
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);
    expect(hook.result.current.draft.executionPolicy).toBe("auto");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });

  it("updates the selected task and task list from a save response without reloading", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "manual",
        prompt: "Initial prompt",
        queueItemId: "queue-1",
        status: "queued",
        title: "Initial title",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.updateDraft({
        priority: 5,
        prompt: "Updated prompt",
        title: "Updated title",
      });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });
    await flushControllerLoad();

    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);
    expect(hook.result.current.selectedTask?.title).toBe("Updated title");
    expect(hook.result.current.tasks[0].priority).toBe(5);
    expect(hook.result.current.tasks[0].prompt).toBe("Updated prompt");
    expect(hook.result.current.tasks[0].queueItemId).toBe("queue-1");
    expect(hook.result.current.tasks[0].title).toBe("Updated title");
    expect(hook.result.current.draft.title).toBe("Updated title");
    expect(hook.result.current.isDirty).toBe(false);

    hook.unmount();
  });
});

describe("useAgentQueueController assignment refresh behavior", () => {
  it("updates assignment and selected task from mutation responses without reloading", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    await act(async () => {
      await hook.result.current.assignSelectedTask();
    });
    await flushControllerLoad();

    expect(harness.assignRequests).toEqual([
      {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "queue-1",
      },
    ]);
    expect(harness.listRequests).toBe(1);
    expect(harness.getRequests).toEqual(["queue-1"]);
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBe(
      "executor-1",
    );
    expect(hook.result.current.tasks[0].assignedExecutorWidgetId).toBe(
      "executor-1",
    );
    expect(hook.result.current.assignmentMessage).toBe("Assignment saved.");

    await act(async () => {
      await hook.result.current.clearSelectedTaskAssignment();
    });
    await flushControllerLoad();

    expect(harness.clearRequests).toEqual([{ queueItemId: "queue-1" }]);
    expect(harness.listRequests).toBe(1);
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBeNull();
    expect(hook.result.current.tasks[0].assignedExecutorWidgetId).toBeNull();
    expect(hook.result.current.assignmentMessage).toBe("Assignment cleared.");

    hook.unmount();
  });
});

describe("useAgentQueueController sequential runner", () => {
  let originalSetTimeout: typeof window.setTimeout;

  beforeEach(() => {
    originalSetTimeout = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler();
      }

      return 0;
    }) as typeof window.setTimeout;
  });

  afterEach(() => {
    window.setTimeout = originalSetTimeout;
  });

  it("assigns an unassigned auto task before starting it", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toEqual([
      {
        executorWidgetInstanceId: "executor-1",
        queueItemId: "queue-1",
      },
    ]);
    expect(harness.startRequests).toHaveLength(1);
    expect(harness.startRequests[0].queueItemId).toBe("queue-1");
    expect(harness.handoffs).toHaveLength(1);
    expect(hook.result.current.runner.status).toBe("waiting_for_executor");

    hook.unmount();
  });

  it("does not start the same queue task twice while a runner start is in flight", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await flushHookEffects();

    act(() => {
      hook.result.current.runner.onStart();
      hook.result.current.runner.onStart();
    });
    await flushHookEffects();

    expect(harness.startRequests).toHaveLength(1);

    hook.unmount();
  });

  it("does not start the next task after Stop runner is pressed", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run first",
        queueItemId: "queue-1",
        status: "ready",
      }),
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run second",
        queueItemId: "queue-2",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(harness.startRequests).toHaveLength(1);

    act(() => {
      hook.result.current.runner.onStop();
      harness.replaceTask(
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Run first",
          queueItemId: "queue-1",
          status: "completed",
        }),
      );
      harness.options.queueTaskAutoRefreshRequest = {
        completedAt: "2026-05-20T10:02:00.000Z",
        executorWidgetInstanceId: "executor-1",
        finalStatus: "completed",
        id: 1,
        queueItemId: "queue-1",
        repoRoot: "/repo",
        runId: "run-1",
        startedAt: "2026-05-20T10:01:00.000Z",
        taskTitle: "Queue task",
        workbenchId: "workbench-1",
        workspaceId: "workspace-1",
      };
    });
    hook.rerender(undefined);
    await flushControllerLoad();

    expect(harness.startRequests).toHaveLength(1);
    expect(hook.result.current.runner.status).toBe("stopped");

    hook.unmount();
  });
});

describe("useAgentQueueController run metadata refresh behavior", () => {
  it("refreshes latest run and run history metadata without reloading tasks", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    harness.options.onListAgentQueueTaskRunLinks = async (queueItemId) => {
      harness.runLinkRequests.push(queueItemId);
      return [queueRunLink({ queueTaskId: queueItemId })];
    };
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(harness.runLinkRequests).toEqual(["queue-1"]);
    expect(hook.result.current.latestRun.link?.queueTaskId).toBe("queue-1");
    expect(hook.result.current.runHistory.totalCount).toBe(1);

    await act(async () => {
      hook.result.current.latestRun.onRefresh();
      await flushHookEffects();
    });
    await act(async () => {
      hook.result.current.runHistory.onRefresh();
      await flushHookEffects();
    });

    expect(harness.runLinkRequests).toEqual(["queue-1", "queue-1", "queue-1"]);
    expect(harness.listRequests).toBe(1);
    expect(hook.result.current.latestRun.link?.directWorkRunId).toBe("run-1");
    expect(hook.result.current.runHistory.links).toHaveLength(1);

    hook.unmount();
  });
});

describe("useAgentQueueController Autorun refresh behavior", () => {
  it("keeps Autorun arm task reload behavior unchanged", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const autorunSnapshots: AgentQueueRunnerSnapshot[] = [
      queueRunnerSnapshot(),
      queueRunnerSnapshot({
        activeQueueItemId: "queue-1",
        isActive: true,
        sessionId: "session-1",
        status: "running",
        waitingRunId: "run-autorun",
      }),
    ];
    harness.options.onGetAgentQueueRunnerSnapshot = async () => {
      harness.autorunSnapshotRequests += 1;
      return autorunSnapshots[0];
    };
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return autorunSnapshots[1];
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.autorun.onArm();
      await flushControllerLoad();
    });

    expect(harness.autorunSnapshotRequests).toBe(1);
    expect(harness.autorunStartRequests).toHaveLength(1);
    expect(harness.listRequests).toBe(2);
    expect(hook.result.current.autorun.snapshot?.activeQueueItemId).toBe(
      "queue-1",
    );

    hook.unmount();
  });
});

describe("useAgentQueueController delete task", () => {
  it("requires confirmation before deleting a task", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });

    expect(hook.result.current.deleteTask.isConfirming).toBe(true);
    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("cancels delete confirmation without deleting", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.deleteTask.onRequest();
      hook.result.current.deleteTask.onCancel();
    });

    expect(hook.result.current.deleteTask.isConfirming).toBe(false);
    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("deletes a confirmed task and selects the next task", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued", title: "First" }),
      queueTask({ queueItemId: "queue-2", status: "queued", title: "Second" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });
    await act(async () => {
      hook.result.current.deleteTask.onConfirm();
      await flushControllerLoad();
    });

    expect(harness.deleteRequests).toEqual([{ queueItemId: "queue-1" }]);
    expect(harness.listRequests).toBe(2);
    expect(hook.result.current.tasks.map((task) => task.queueItemId)).toEqual([
      "queue-2",
    ]);
    expect(hook.result.current.selectedTask?.queueItemId).toBe("queue-2");
    expect(hook.result.current.deleteTask.message).toBe("Queue task deleted.");

    hook.unmount();
  });

  it("blocks delete for running tasks", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "running" }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    expect(hook.result.current.deleteTask.canRequest).toBe(false);
    expect(hook.result.current.deleteTask.blockedReason).toBe(
      "Running tasks cannot be deleted.",
    );

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });

    expect(harness.deleteRequests).toHaveLength(0);
    expect(hook.result.current.deleteTask.error).toBe(
      "Running tasks cannot be deleted.",
    );

    hook.unmount();
  });

  it("blocks delete while the selected task is waiting for the executor", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderHook(
      () => useAgentQueueController(harness.options),
      undefined,
    );

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    await act(async () => {
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(hook.result.current.runner.status).toBe("waiting_for_executor");
    expect(hook.result.current.deleteTask.canRequest).toBe(false);
    expect(hook.result.current.deleteTask.blockedReason).toBe(
      "Running tasks cannot be deleted.",
    );

    hook.unmount();
  });
});

function createQueueHarness(initialTasks: AgentQueueTask[]) {
  const tasks = new Map<string, AgentQueueTask>(
    initialTasks.map((task) => [task.queueItemId, task]),
  );
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const assignRequests: Array<
    Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">
  > = [];
  const clearRequests: Array<
    Omit<ClearAgentQueueTaskAssignmentRequest, "workspaceId">
  > = [];
  const startRequests: Array<
    Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">
  > = [];
  const autorunStartRequests: Array<
    Omit<StartAgentQueueRunnerSessionRequest, "workspaceId">
  > = [];
  const deleteRequests: Array<Omit<DeleteAgentQueueTaskRequest, "workspaceId">> =
    [];
  const getRequests: string[] = [];
  const handoffs: DirectWorkRunHandoffInput[] = [];
  const runLinkRequests: string[] = [];
  let listRequests = 0;
  let autorunSnapshotRequests = 0;
  const options: AgentQueueControllerOptions = {
    agentExecutorSlots: [
      {
        label: "Agent Executor 1",
        widgetInstanceId: "executor-1",
      },
    ],
    onAssignAgentQueueTaskToExecutor: async (
      request: Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">,
    ) => {
      assignRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        throw new Error("Queue task not found.");
      }

      const updatedTask = {
        ...task,
        assignedExecutorWidgetId: request.executorWidgetInstanceId,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    onCreateAgentQueueTask: async (
      request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      createRequests.push(request);
      const createdTask = queueTask({
        description: request.description,
        executionPolicy: request.executionPolicy ?? "manual",
        priority: request.priority,
        prompt: request.prompt,
        queueItemId: `queue-${tasks.size + 1}`,
        status: request.status,
        title: request.title,
      });
      tasks.set(createdTask.queueItemId, createdTask);

      return createdTask;
    },
    onDeleteAgentQueueTask: async (
      request: Omit<DeleteAgentQueueTaskRequest, "workspaceId">,
    ) => {
      deleteRequests.push(request);
      return tasks.delete(request.queueItemId);
    },
    onClearAgentQueueTaskAssignment: async (request) => {
      clearRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        throw new Error("Queue task not found.");
      }

      const updatedTask = {
        ...task,
        assignedExecutorWidgetId: null,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    onDirectWorkRunHandoffStarted: (handoff) => {
      handoffs.push(handoff);
    },
    onGetAgentQueueTask: async (queueItemId: string) => {
      getRequests.push(queueItemId);
      return tasks.get(queueItemId) ?? null;
    },
    onListAgentQueueTasks: async () => {
      listRequests += 1;
      return Array.from(tasks.values());
    },
    onStartAssignedAgentQueueTask: async (
      request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
    ): Promise<StartAssignedAgentQueueTaskResponse> => {
      startRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task?.assignedExecutorWidgetId) {
        throw new Error("Queue task must be assigned before start.");
      }

      tasks.set(task.queueItemId, {
        ...task,
        status: "running",
        updatedAt: "2026-05-20T10:01:00.000Z",
      });

      return {
        executorWidgetInstanceId: task.assignedExecutorWidgetId,
        queueItemId: task.queueItemId,
        runId: `run-${startRequests.length.toString()}`,
        status: "running",
        workbenchId: "workbench-1",
        workspaceId: task.workspaceId,
      };
    },
    onUpdateAgentQueueTask: async (
      request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
    ) => {
      updateRequests.push(request);
      const task = tasks.get(request.queueItemId);

      if (!task) {
        return null;
      }

      const updatedTask: AgentQueueTask = {
        ...task,
        description: request.description,
        executionPolicy:
          request.executionPolicy ?? task.executionPolicy ?? "manual",
        priority: request.priority,
        prompt: request.prompt,
        status: request.status,
        title: request.title,
        updatedAt: "2026-05-20T10:01:00.000Z",
      };
      tasks.set(updatedTask.queueItemId, updatedTask);

      return updatedTask;
    },
    queueTaskAutoRefreshRequest: null,
  };

  return {
    assignRequests,
    autorunStartRequests,
    get autorunSnapshotRequests() {
      return autorunSnapshotRequests;
    },
    set autorunSnapshotRequests(value: number) {
      autorunSnapshotRequests = value;
    },
    clearRequests,
    createRequests,
    deleteRequests,
    get getRequests() {
      return getRequests;
    },
    handoffs,
    get listRequests() {
      return listRequests;
    },
    options,
    replaceTask(task: AgentQueueTask) {
      tasks.set(task.queueItemId, task);
    },
    startRequests,
    runLinkRequests,
    updateRequests,
  };
}

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    description: "",
    executionPolicy: "manual",
    priority: 0,
    prompt: "",
    queueItemId: "queue-1",
    status: "draft",
    title: "Queue task",
    updatedAt: "2026-05-20T10:00:00.000Z",
    workspaceId: "workspace-1",
    ...overrides,
  };
}

function queueRunLink(
  overrides: Partial<AgentQueueTaskRunLinkSummary> = {},
): AgentQueueTaskRunLinkSummary {
  const link: AgentQueueTaskRunLinkSummary = {
    completedAt: null,
    createdAt: "2026-05-20T10:01:00.000Z",
    directWorkRunId: "run-1",
    executorWidgetId: "executor-1",
    linkId: "link-1",
    queueTaskId: "queue-1",
    reviewStatus: "unknown",
    source: "manual",
    startedAt: "2026-05-20T10:01:00.000Z",
    status: "running",
    updatedAt: "2026-05-20T10:01:00.000Z",
    validationStatus: null,
    workspaceId: "workspace-1",
  };

  return {
    ...link,
    ...overrides,
  } as AgentQueueTaskRunLinkSummary;
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

async function flushControllerLoad() {
  await flushHookEffects();
  await flushHookEffects();
}
