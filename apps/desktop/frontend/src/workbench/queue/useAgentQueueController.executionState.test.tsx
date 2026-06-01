import type { AgentQueueRunnerSnapshot } from "../../workspace/types";

import { act } from "react";

import {
  agentQueueWorker,
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueRunLink,
  queueRunnerSnapshot,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController execution state", () => {
  it("uses explicit global execution state to gate Autorun and Sequential Runner without blocking selected-task runs", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.onGetAgentQueueRunnerSnapshot = async () => queueRunnerSnapshot();
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return queueRunnerSnapshot({ status: "running" });
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });

    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);
    expect(hook.result.current.autorun.canArm).toBe(false);
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "Click START before arming Queue Autorun.",
      ),
    ).toBe(true);
    expect(hook.result.current.runner.canStart).toBe(false);
    expect(
      hook.result.current.runner.preconditionMessages.includes(
        "Click START before starting the Sequential Queue Runner.",
      ),
    ).toBe(true);

    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });

    expect(hook.result.current.foundation.globalStatus).toBe("started");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.autorun.canArm).toBe(true);
    expect(hook.result.current.runner.canStart).toBe(true);

    act(() => {
      hook.result.current.foundation.onStopWorkers();
    });

    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);
    expect(hook.result.current.autorun.canArm).toBe(false);

    act(() => {
      hook.result.current.foundation.onStopAndKillRunning();
    });

    expect(hook.result.current.foundation.globalStatus).toBe(
      "stop_kill_requested",
    );
    expect(
      hook.result.current.run.readinessMessage?.includes(
        "STOP + KILL RUNNING",
      ),
    ).toBe(true);
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "STOP + KILL RUNNING is requested. Review running work or click START before arming Queue Autorun.",
      ),
    ).toBe(true);

    await act(async () => {
      hook.result.current.autorun.onArm();
      hook.result.current.runner.onStart();
      await flushHookEffects();
    });

    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("assigns the visible local executor before a selected unassigned task run", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "manual",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });

    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);
    expect(hook.result.current.run.usesDefaultExecutorOnStart).toBe(true);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
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

    hook.unmount();
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
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
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
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
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
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
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

  it("refreshes latest run and run history metadata without reloading tasks", async () => {
    const harness = createQueueHarness([
      queueTask({ queueItemId: "queue-1", status: "queued" }),
    ]);
    harness.options.onListAgentQueueTaskRunLinks = async (queueItemId) => {
      harness.runLinkRequests.push(queueItemId);
      return [queueRunLink({ queueTaskId: queueItemId })];
    };
    const hook = renderQueueController(harness);

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
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
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

  it("keeps Queue Autorun blocked when the selected worker has no eligible assigned auto task", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        executionPolicy: "auto",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.replaceWorker(agentQueueWorker({ enabled: false }));
    harness.options.onGetAgentQueueRunnerSnapshot = async () => queueRunnerSnapshot();
    harness.options.onStartAgentQueueRunnerSession = async (request) => {
      harness.autorunStartRequests.push(request);
      return queueRunnerSnapshot({ status: "running" });
    };
    harness.options.onStopAgentQueueRunnerSession = async () =>
      queueRunnerSnapshot({ status: "stopped" });
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "No assigned auto task is currently eligible for the selected worker.",
      ),
    ).toBe(true);
    expect(hook.result.current.autorun.canArm).toBe(false);

    await act(async () => {
      hook.result.current.autorun.onArm();
      await flushHookEffects();
    });

    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });
});
