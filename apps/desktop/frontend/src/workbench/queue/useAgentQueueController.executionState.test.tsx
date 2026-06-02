import type {
  AgentExecutorRunDetail,
  AgentQueueRunnerSnapshot,
  DirectWorkStreamEvent,
} from "../../workspace/types";

import { act } from "react";
import { vi } from "vitest";

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
  it("uses explicit global execution state for Autorun and Sequential Runner without blocking a selected manual run", async () => {
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
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.foundation.globalStatus).toBe("stopped");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);
    expect(
      hook.result.current.run.preconditionMessages.includes("Start queue."),
    ).toBe(false);
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
    expect(hook.result.current.run.canStart).toBe(true);
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
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
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

  it("starts a selected task through the Queue-owned local executor without assignment", async () => {
    const harness = createQueueHarness([
      queueTask({
        executionPolicy: "manual",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.agentExecutorSlots = [
      {
        label: "Local executor ready",
        ownerKind: "agent_queue",
        widgetInstanceId: "queue-widget-1",
      },
    ];
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.selectedExecutorWidgetId).toBe("queue-widget-1");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(1);
    expect(harness.startRequests[0].queueItemId).toBe("queue-1");
    expect(harness.startRequests[0].queueOwnerWidgetInstanceId).toBe(
      "queue-widget-1",
    );
    expect(harness.handoffs[0].executorWidgetInstanceId).toBe("queue-widget-1");

    hook.unmount();
  });

  it("selects a deterministic executor when multiple visible idle executors are available", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Run this",
        queueItemId: "queue-1",
        queueTagId: "review",
        queueTagName: "Review",
        status: "ready",
      }),
    ]);
    harness.options.agentExecutorSlots = [
      { label: "Local executor scoped", widgetInstanceId: "executor-scoped" },
      { label: "Local executor all", widgetInstanceId: "executor-all" },
    ];
    harness.replaceWorker(
      agentQueueWorker({
        displayOrder: 0,
        name: "Scoped",
        queueTagId: "review",
        queueTagName: "Review",
        scopeKind: "queue_tag",
        workerId: "executor-scoped",
      }),
    );
    harness.replaceWorker(
      agentQueueWorker({
        displayOrder: 1,
        name: "All",
        scopeKind: "all",
        workerId: "executor-all",
      }),
    );
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.selectedExecutorWidgetId).toBe("executor-all");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toEqual([
      {
        executorWidgetInstanceId: "executor-all",
        queueItemId: "queue-1",
      },
    ]);
    expect(harness.startRequests).toHaveLength(1);

    hook.unmount();
  });

  it("preserves an existing valid executor assignment", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-2",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.agentExecutorSlots = [
      { label: "Local executor 1", widgetInstanceId: "executor-1" },
      { label: "Local executor 2", widgetInstanceId: "executor-2" },
    ];
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.selectedExecutorWidgetId).toBe("executor-2");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.usesDefaultExecutorOnStart).toBe(false);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(1);

    hook.unmount();
  });

  it("falls back from an unavailable assignment to another visible compatible executor", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-missing",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.agentExecutorSlots = [
      { label: "Local executor 2", widgetInstanceId: "executor-2" },
    ];
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.foundation.onStartWorkers();
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.selectedExecutorWidgetId).toBe("executor-2");
    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.usesDefaultExecutorOnStart).toBe(true);
    expect(
      hook.result.current.run.executorSelectionMessage?.includes(
        "previous assignment is unavailable",
      ),
    ).toBe(true);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toEqual([
      {
        executorWidgetInstanceId: "executor-2",
        queueItemId: "queue-1",
      },
    ]);
    expect(harness.startRequests).toHaveLength(1);

    hook.unmount();
  });

  it("shows a clear blocker when no local executor is available", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.agentExecutorSlots = [];
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.selectedExecutorWidgetId).toBe("");
    expect(hook.result.current.run.readinessMessage).toBe(
      "Local executor unavailable.",
    );
    expect(hook.result.current.run.canStart).toBe(false);

    await act(async () => {
      hook.result.current.run.onStartAssignedTask();
      await flushHookEffects();
    });

    expect(harness.assignRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);

    hook.unmount();
  });

  it("allows advanced executor override without starting work", async () => {
    const harness = createQueueHarness([
      queueTask({
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "ready",
      }),
    ]);
    harness.options.agentExecutorSlots = [
      { label: "Local executor 1", widgetInstanceId: "executor-1" },
      { label: "Local executor 2", widgetInstanceId: "executor-2" },
    ];
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    act(() => {
      hook.result.current.selectExecutorWidget("executor-2");
      hook.result.current.run.onRepoRootDraftChange("/repo");
      hook.result.current.run.onSandboxChange("danger_full_access");
    });

    expect(hook.result.current.selectedExecutorWidgetId).toBe("executor-2");
    expect(hook.result.current.run.executorSelectionMessage).toBe(
      "Local executor override selected: Local executor 2.",
    );
    expect(harness.assignRequests).toHaveLength(0);
    expect(harness.startRequests).toHaveLength(0);

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

  it("refreshes selected active runs from Direct Work stream events and loads evidence", async () => {
    const harness = createQueueHarness([
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "running",
      }),
    ]);
    const detailRequests: Array<{ runId: string; widgetId: string }> = [];
    let linkStatus: "running" | "completed" = "running";
    harness.options.onListAgentQueueTaskRunLinks = async (queueItemId) => {
      harness.runLinkRequests.push(queueItemId);
      return [
        queueRunLink({
          completedAt:
            linkStatus === "completed"
              ? "2026-05-20T10:02:00.000Z"
              : null,
          queueTaskId: queueItemId,
          status: linkStatus,
        }),
      ];
    };
    harness.options.onGetAgentExecutorRunDetail = async (widgetId, runId) => {
      detailRequests.push({ runId, widgetId });
      return runDetail({ runId });
    };
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.selectedTask?.status).toBe("running");
    expect(hook.result.current.latestRun.link?.status).toBe("running");
    expect(harness.directWorkStreamListeners).toHaveLength(1);

    await act(async () => {
      harness.directWorkStreamListeners[0]?.(
        streamEvent({
          eventKind: "stdout_line",
          isFinal: false,
          line: "working",
          runId: "run-1",
        }),
      );
      await flushHookEffects();
    });

    expect(harness.runLinkRequests).toEqual(["queue-1", "queue-1"]);
    expect(detailRequests).toHaveLength(0);

    linkStatus = "completed";
    harness.replaceTask(
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        prompt: "Run this",
        queueItemId: "queue-1",
        status: "completed",
      }),
    );

    await act(async () => {
      harness.directWorkStreamListeners[0]?.(
        streamEvent({
          eventKind: "completed",
          finalStatus: "completed",
          isFinal: true,
          runId: "run-1",
          status: "completed",
        }),
      );
      await flushHookEffects();
    });
    await flushControllerLoad();

    expect(hook.result.current.selectedTask?.status).toBe("completed");
    expect(hook.result.current.latestRun.link?.status).toBe("completed");
    expect(detailRequests).toEqual([
      { runId: "run-1", widgetId: "executor-1" },
    ]);
    expect(hook.result.current.runEvidence.detail?.finalMessage).toBe(
      "Final Direct Work response.",
    );

    const requestsAfterTerminal = harness.runLinkRequests.length;

    await act(async () => {
      harness.directWorkStreamListeners[0]?.(
        streamEvent({
          eventKind: "completed",
          finalStatus: "completed",
          isFinal: true,
          runId: "run-1",
          status: "completed",
        }),
      );
      await flushHookEffects();
    });

    expect(harness.runLinkRequests).toHaveLength(requestsAfterTerminal);

    hook.unmount();
  });

  it("uses slow fallback polling only while the selected run is active", async () => {
    vi.useFakeTimers();

    try {
      const harness = createQueueHarness([
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          prompt: "Run this",
          queueItemId: "queue-1",
          status: "running",
        }),
      ]);
      const detailRequests: Array<{ runId: string; widgetId: string }> = [];
      let linkStatus: "running" | "completed" = "running";
      harness.options.onListAgentQueueTaskRunLinks = async (queueItemId) => {
        harness.runLinkRequests.push(queueItemId);
        return [
          queueRunLink({
            completedAt:
              linkStatus === "completed"
                ? "2026-05-20T10:02:00.000Z"
                : null,
            queueTaskId: queueItemId,
            status: linkStatus,
          }),
        ];
      };
      harness.options.onGetAgentExecutorRunDetail = async (widgetId, runId) => {
        detailRequests.push({ runId, widgetId });
        return runDetail({ runId });
      };
      const hook = renderQueueController(harness);

      await flushControllerLoad();

      expect(hook.result.current.selectedTask?.status).toBe("running");
      expect(hook.result.current.latestRun.link?.status).toBe("running");

      expect(harness.directWorkStreamListeners).toHaveLength(1);

      await act(async () => {
        vi.advanceTimersByTime(59_000);
      });
      await flushControllerLoad();

      expect(harness.runLinkRequests).toEqual(["queue-1"]);

      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      await flushControllerLoad();

      expect(harness.runLinkRequests).toEqual(["queue-1", "queue-1"]);
      expect(detailRequests).toHaveLength(0);

      linkStatus = "completed";
      harness.replaceTask(
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          prompt: "Run this",
          queueItemId: "queue-1",
          status: "completed",
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      await flushControllerLoad();

      expect(hook.result.current.selectedTask?.status).toBe("completed");
      expect(hook.result.current.latestRun.link?.status).toBe("completed");
      expect(detailRequests).toEqual([
        { runId: "run-1", widgetId: "executor-1" },
      ]);
      expect(hook.result.current.runEvidence.detail?.finalMessage).toBe(
        "Final Direct Work response.",
      );

      const requestsAfterTerminal = harness.runLinkRequests.length;

      await act(async () => {
        vi.advanceTimersByTime(180_000);
      });
      await flushControllerLoad();

      expect(harness.runLinkRequests).toHaveLength(requestsAfterTerminal);

      hook.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops selected-run polling when the selected task changes", async () => {
    vi.useFakeTimers();

    try {
      const harness = createQueueHarness([
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          prompt: "Run this",
          queueItemId: "queue-1",
          status: "running",
        }),
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          prompt: "Run later",
          queueItemId: "queue-2",
          status: "ready",
        }),
      ]);
      harness.options.onListAgentQueueTaskRunLinks = async (queueItemId) => {
        harness.runLinkRequests.push(queueItemId);
        return queueItemId === "queue-1"
          ? [queueRunLink({ queueTaskId: queueItemId, status: "running" })]
          : [];
      };
      const hook = renderQueueController(harness);

      await flushControllerLoad();

      expect(hook.result.current.selectedTask?.queueItemId).toBe("queue-1");

      await act(async () => {
        hook.result.current.selectTask("queue-2");
        await flushControllerLoad();
      });

      expect(hook.result.current.selectedTask?.queueItemId).toBe("queue-2");
      const queueOneRequestsAfterSelection = harness.runLinkRequests.filter(
        (queueItemId) => queueItemId === "queue-1",
      ).length;

      await act(async () => {
        vi.advanceTimersByTime(180_000);
      });
      await flushControllerLoad();

      expect(
        harness.runLinkRequests.filter((queueItemId) => queueItemId === "queue-1"),
      ).toHaveLength(queueOneRequestsAfterSelection);

      hook.unmount();
    } finally {
      vi.useRealTimers();
    }
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
        "Select one local executor before arming Queue Autorun.",
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

function runDetail(
  overrides: Partial<AgentExecutorRunDetail["summary"]> = {},
): AgentExecutorRunDetail {
  const summary = {
    commandKind: "codex_direct_work",
    durationMs: 1000,
    finishedAt: "2026-05-20T10:02:00.000Z",
    hasResult: true,
    logCount: 4,
    mode: "Codex Direct Work",
    repoRoot: "/repo",
    resultType: "codex_direct_work_result",
    runId: "run-1",
    startedAt: "2026-05-20T10:01:00.000Z",
    status: "completed",
    title: "Codex Direct Work completed",
    validationProfile: null,
    validationStatus: null,
    ...overrides,
  };

  return {
    changedFilesSummary: null,
    errorMessage: null,
    finalMessage: "Final Direct Work response.",
    logs: [],
    resultContent: null,
    resultId: "result-1",
    resultPayload: "{\"status\":\"completed\"}",
    resultStatus: "completed",
    resultSummary: "Codex Direct Work completed",
    stderrPreview: null,
    stdoutPreview: "stdout preview",
    summary,
    validationProfile: null,
    validationStatus: null,
  };
}

function streamEvent(
  overrides: Partial<DirectWorkStreamEvent> = {},
): DirectWorkStreamEvent {
  return {
    codexThreadId: null,
    elapsedMs: 1000,
    errorMessage: null,
    eventKind: "stdout_line",
    exitCode: null,
    failedStage: null,
    finalStatus: null,
    isFinal: false,
    line: null,
    parsedCodexEventType: null,
    runId: "run-1",
    status: null,
    stderrPreview: null,
    text: null,
    widgetInstanceId: "executor-1",
    workbenchId: "workbench-1",
    workspaceId: "workspace-1",
    ...overrides,
  };
}
