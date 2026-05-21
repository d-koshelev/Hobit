import { act } from "react";

import type {
  AgentQueueTask,
  AssignAgentQueueTaskToExecutorRequest,
  CreateAgentQueueTaskRequest,
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
    expect(hook.result.current.draft.executionPolicy).toBe("auto");
    expect(hook.result.current.isDirty).toBe(false);

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
  const startRequests: Array<
    Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">
  > = [];
  const handoffs: DirectWorkRunHandoffInput[] = [];
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
    onClearAgentQueueTaskAssignment: async (request) => {
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
    onGetAgentQueueTask: async (queueItemId: string) =>
      tasks.get(queueItemId) ?? null,
    onListAgentQueueTasks: async () => Array.from(tasks.values()),
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
    createRequests,
    handoffs,
    options,
    replaceTask(task: AgentQueueTask) {
      tasks.set(task.queueItemId, task);
    },
    startRequests,
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

async function flushControllerLoad() {
  await flushHookEffects();
  await flushHookEffects();
}
