import { act } from "react";

import {
  getQueueTaskDependencyState,
  validateQueueTaskDependencies,
} from "../agentQueueTaskUiModel";

import {
  createQueueHarness,
  flushControllerLoad,
  flushHookEffects,
  queueRunnerSnapshot,
  queueTask,
  renderQueueController,
} from "./useAgentQueueControllerTestHelpers";

describe("useAgentQueueController dependency gates", () => {
  it("rejects self-dependency, cycles, and missing dependency ids", () => {
    const selfTask = queueTask({
      dependsOn: ["queue-1"],
      queueItemId: "queue-1",
    });

    expect(validateQueueTaskDependencies(selfTask, [selfTask])).toBe(
      "A task cannot depend on itself.",
    );

    const first = queueTask({
      dependsOn: ["queue-2"],
      queueItemId: "queue-1",
      title: "First",
    });
    const second = queueTask({
      dependsOn: ["queue-1"],
      queueItemId: "queue-2",
      title: "Second",
    });

    expect(validateQueueTaskDependencies(first, [first, second])).toBe(
      "Second creates a dependency cycle.",
    );

    const missing = queueTask({
      dependsOn: ["missing-task"],
      queueItemId: "queue-3",
    });

    expect(validateQueueTaskDependencies(missing, [missing])).toBe(
      "missing-task is missing.",
    );
  });

  it("blocks and then allows readiness when a dependency is coordinator accepted", async () => {
    const harness = createQueueHarness([
      queueTask({
        coordinatorStatus: "not_reported",
        queueItemId: "queue-1",
        status: "completed",
        title: "Prerequisite",
        workerExecutionReports: [
          {
            changedFiles: [],
            commandsRun: [],
            createdAt: "2026-05-20T10:02:00.000Z",
            errors: [],
            itemId: "queue-1",
            reportId: "report-1",
            reportStatus: "completed",
            summary: "Worker says complete.",
            validationCommandsSuggested: [],
            validationResult: "passed",
            warnings: [],
            workerId: "executor-1",
          },
        ],
      }),
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        dependsOn: ["queue-1"],
        prompt: "Run dependent",
        queueItemId: "queue-2",
        status: "ready",
        title: "Dependent",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();
    act(() => {
      hook.result.current.foundation.onStartWorkers();
    });
    await act(async () => {
      await hook.result.current.selectTask("queue-2");
    });

    expect(
      hook.result.current.run.readinessMessage?.includes(
        "Resolve dependencies before running.",
      ),
    ).toBe(true);
    expect(hook.result.current.run.canStart).toBe(false);

    harness.replaceTask(
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "queue-1",
        status: "completed",
        title: "Prerequisite",
      }),
    );
    await act(async () => {
      await hook.result.current.refreshTasks();
    });
    await act(async () => {
      await hook.result.current.selectTask("queue-2");
    });
    act(() => {
      hook.result.current.run.onRepoRootDraftChange("/repo");
    });

    expect(hook.result.current.run.readinessMessage).toBeNull();
    expect(hook.result.current.run.canStart).toBe(true);

    hook.unmount();
  });

  it("keeps dependencies blocked for needs changes, follow-up, rollback, blocked, and failed coordinator states", () => {
    for (const coordinatorStatus of [
      "needs_changes",
      "follow_up_required",
      "rollback_required",
      "blocked",
      "failed",
      "ready_for_finalization",
    ] as const) {
      const prerequisite = queueTask({
        coordinatorStatus,
        queueItemId: "queue-1",
        status: coordinatorStatus === "failed" ? "failed" : "completed",
        title: "Prerequisite",
      });
      const dependent = queueTask({
        dependsOn: ["queue-1"],
        queueItemId: "queue-2",
        status: "ready",
        title: "Dependent",
      });

      const dependencyState = getQueueTaskDependencyState(dependent, [
        prerequisite,
        dependent,
      ]);

      expect(dependencyState.status).toBe("blocked");
      expect(dependencyState.blockedBy[0]?.reason).toBe(
        coordinatorStatus === "failed" ? "not_completed" : "not_finalized",
      );
    }
  });

  it("dependency edits pause the queue tag and do not start Executor work", async () => {
    const harness = createQueueHarness([
      queueTask({
        coordinatorStatus: "finalized",
        queueItemId: "queue-1",
        status: "completed",
        title: "Prerequisite",
      }),
      queueTask({
        prompt: "Run dependent",
        queueItemId: "queue-2",
        status: "ready",
        title: "Dependent",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();
    await act(async () => {
      await hook.result.current.selectTask("queue-2");
    });

    act(() => {
      hook.result.current.editTask.onStart();
      hook.result.current.updateDraft({ dependsOn: ["queue-1"] });
    });
    await act(async () => {
      await hook.result.current.saveTask();
    });

    expect(hook.result.current.selectedTask?.dependsOn).toEqual(["queue-1"]);
    expect(hook.result.current.foundation.pausedQueueTagIds.has("default")).toBe(
      true,
    );
    expect(hook.result.current.selectedTask?.coordinatorStatus).toBe(
      "awaiting_coordinator_review",
    );
    expect(harness.updateRequests).toHaveLength(1);
    expect(harness.startRequests).toHaveLength(0);
    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks Autorun arming when queue dependencies are blocked", async () => {
    const harness = createQueueHarness([
      queueTask({
        queueItemId: "queue-1",
        status: "queued",
        title: "Prerequisite",
      }),
      queueTask({
        assignedExecutorWidgetId: "executor-1",
        dependsOn: ["queue-1"],
        executionPolicy: "auto",
        prompt: "Run dependent",
        queueItemId: "queue-2",
        status: "ready",
      }),
    ]);
    harness.options.onGetAgentQueueRunnerSnapshot = async () =>
      queueRunnerSnapshot();
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

    expect(hook.result.current.autorun.canArm).toBe(false);
    expect(
      hook.result.current.autorun.preconditionMessages.includes(
        "Resolve blocked or invalid queue dependencies before arming Queue Autorun.",
      ),
    ).toBe(true);

    await act(async () => {
      hook.result.current.autorun.onArm();
      await flushHookEffects();
    });

    expect(harness.autorunStartRequests).toHaveLength(0);

    hook.unmount();
  });

  it("blocks deleting a prerequisite while dependent tasks reference it", async () => {
    const harness = createQueueHarness([
      queueTask({
        queueItemId: "queue-1",
        status: "queued",
        title: "Prerequisite",
      }),
      queueTask({
        dependsOn: ["queue-1"],
        queueItemId: "queue-2",
        status: "queued",
        title: "Dependent",
      }),
    ]);
    const hook = renderQueueController(harness);

    await flushControllerLoad();

    expect(hook.result.current.deleteTask.canRequest).toBe(false);
    expect(hook.result.current.deleteTask.blockedReason).toBe(
      'Remove dependency from "Dependent" before deleting this task.',
    );

    act(() => {
      hook.result.current.deleteTask.onRequest();
    });

    expect(harness.deleteRequests).toHaveLength(0);

    hook.unmount();
  });

  it("computes invalid dependency state for missing dependency ids", () => {
    const task = queueTask({
      dependsOn: ["missing-task"],
      queueItemId: "queue-1",
    });

    const dependencyState = getQueueTaskDependencyState(task, [task]);

    expect(dependencyState.status).toBe("invalid");
    expect(dependencyState.blockedBy).toEqual([
      {
        queueItemId: "missing-task",
        reason: "missing",
        title: "missing-task",
      },
    ]);
  });
});
