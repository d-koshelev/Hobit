import { act } from "react";

import {
  agentQueueWorker,
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController worker actions", () => {
  it("updates local worker scope without starting queue execution", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", title: "Task" }),
    ]);
    const hook = renderQueueController(harness);

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
    expect(hook.result.current.foundation.globalStatus).toBe(
      "stop_kill_requested",
    );
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("creates, renames, scopes, disables, and deletes worker config without starting execution", async () => {
    const harness = createQueueHarness([]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onCreateQueueTag("Review");
      hook.result.current.foundation.onCreateWorker();
    });
    await flushHookEffects();

    const createdWorker =
      hook.result.current.foundation.workers[
        hook.result.current.foundation.workers.length - 1
      ];
    expect(createdWorker?.name).toBe("Agent Worker 2");

    act(() => {
      hook.result.current.foundation.onRenameWorker(
        createdWorker?.workerId ?? "",
        "Review Worker",
      );
      hook.result.current.foundation.onWorkerScopeChange(
        createdWorker?.workerId ?? "",
        {
          kind: "queue_tag",
          queueTagId: "review",
          queueTagName: "Review",
        },
      );
      hook.result.current.foundation.onWorkerEnabledChange(
        createdWorker?.workerId ?? "",
        false,
      );
    });
    await flushHookEffects();

    const updatedWorker = hook.result.current.foundation.workers.find(
      (worker) => worker.workerId === createdWorker?.workerId,
    );
    expect(updatedWorker?.enabled).toBe(false);
    expect(updatedWorker?.name).toBe("Review Worker");
    expect(updatedWorker?.scope).toEqual({
      kind: "queue_tag",
      queueTagId: "review",
      queueTagName: "Review",
    });

    act(() => {
      hook.result.current.foundation.onDeleteWorker(createdWorker?.workerId ?? "");
    });
    await flushHookEffects();

    expect(
      hook.result.current.foundation.workers.some(
        (worker) => worker.workerId === createdWorker?.workerId,
      ),
    ).toBe(false);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("keeps max executors local, at least one, and blocks silent worker deletion", async () => {
    const harness = createQueueHarness([]);
    harness.replaceWorker(agentQueueWorker({ workerId: "executor-1" }));
    harness.replaceWorker(
      agentQueueWorker({
        displayOrder: 1,
        name: "Agent Executor 2",
        workerId: "executor-2",
      }),
    );
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(3);

    act(() => {
      hook.result.current.foundation.onMaxExecutorsChange("0");
    });

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(3);
    expect(
      hook.result.current.foundation.maxExecutorMessage?.includes(
        "cannot be lower than 2 configured workers",
      ),
    ).toBe(true);

    act(() => {
      hook.result.current.foundation.onMaxExecutorsChange("2");
    });

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(2);
    expect(
      hook.result.current.foundation.maxExecutorMessage?.includes(
        "No workers were started or stopped",
      ),
    ).toBe(true);
    expect(harness.deleteWorkerRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("bounds Add worker by max executors without starting Executor or Codex", async () => {
    const harness = createQueueHarness([]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onMaxExecutorsChange("0");
    });
    await flushHookEffects();

    expect(hook.result.current.foundation.embeddedExecutor.maxExecutors).toBe(1);

    act(() => {
      hook.result.current.foundation.onCreateWorker();
    });

    expect(hook.result.current.foundation.workers).toHaveLength(1);
    expect(
      hook.result.current.foundation.maxExecutorMessage?.includes(
        "Max executors reached",
      ),
    ).toBe(true);
    expect(harness.createWorkerRequests).toHaveLength(1);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks removing a worker assigned to a queue task", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        assignedWorkerId: "executor-1",
        queueItemId: "queue-1",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onDeleteWorker("executor-1");
    });

    expect(hook.result.current.foundation.tagManagementError).toBe(
      "Clear this worker's task assignment before removing it.",
    );
    expect(harness.deleteWorkerRequests).toHaveLength(0);

    hook.unmount();
  });

  it("updates assignment and selected task from mutation responses without reloading", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    const hook = renderQueueController(harness);

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

  it("prevents assigning a worker scoped to a different queue tag", async () => {
    const harness = createQueueHarness([
      queueTask({
        queueItemId: "queue-1",
        queueTagId: "default",
        queueTagName: "Default",
        status: "queued",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onWorkerScopeChange("executor-1", {
        kind: "queue_tag",
        queueTagId: "review",
        queueTagName: "Review",
      });
    });
    await act(async () => {
      await hook.result.current.assignSelectedTask();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(hook.result.current.assignmentError).toBeNull();
    expect(hook.result.current.run.readinessMessage).toBe(
      "No local executor is available. Add or enable a local executor.",
    );
    expect(hook.result.current.selectedTask?.assignedExecutorWidgetId).toBeNull();

    hook.unmount();
  });

  it("prevents assigning a disabled worker and keeps manual run blocked by routing", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.replaceWorker(
      agentQueueWorker({
        enabled: false,
        workerId: "executor-1",
      }),
    );
    const hook = renderQueueController(harness);

    await flushControllerLoad();
    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });

    expect(hook.result.current.run.readinessMessage).toBe(
      "No local executor is available. Add or enable a local executor.",
    );
    expect(hook.result.current.run.canStart).toBe(false);

    await act(async () => {
      await hook.result.current.clearSelectedTaskAssignment();
    });
    await act(async () => {
      await hook.result.current.assignSelectedTask();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(hook.result.current.assignmentError).toBeNull();
    expect(hook.result.current.run.readinessMessage).toBe(
      "No local executor is available. Add or enable a local executor.",
    );
    expect(harness.startRequests).toHaveLength(0);

    hook.unmount();
  });
});
