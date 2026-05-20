import { act } from "react";

import type {
  AgentQueueTask,
  CreateAgentQueueTaskRequest,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import {
  flushHookEffects,
  renderHook,
} from "../test-utils/renderHook";
import { useAgentQueueController } from "./useAgentQueueController";

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

function createQueueHarness(initialTasks: AgentQueueTask[]) {
  const tasks = new Map<string, AgentQueueTask>(
    initialTasks.map((task) => [task.queueItemId, task]),
  );
  const createRequests: Array<Omit<CreateAgentQueueTaskRequest, "workspaceId">> =
    [];
  const updateRequests: Array<Omit<UpdateAgentQueueTaskRequest, "workspaceId">> =
    [];

  return {
    createRequests,
    options: {
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
      onGetAgentQueueTask: async (queueItemId: string) =>
        tasks.get(queueItemId) ?? null,
      onListAgentQueueTasks: async () => Array.from(tasks.values()),
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
    },
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
