import type { AgentQueueTask } from "../../workspace/types";
import {
  getNextQueueRunnerTaskDecision,
  queueRunnerFinalStatus,
} from "./queueRunner";

describe("queue runner task selection", () => {
  it("starts an auto task when runnable and assigned to the selected executor", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Do the work",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
    expect(decision.kind === "start" && decision.requiresAssignment).toBe(false);
  });

  it("stops on a manual task instead of silently skipping it", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "manual",
          prompt: "Do the work",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("stop");
    expect(decision.kind === "stop" && decision.reason).toBe("manual");
  });

  it("starts after_previous_success only after a completed task in the current pass", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: "completed",
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "after_previous_success",
          prompt: "Continue the work",
          status: "queued",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
  });

  it("stops after_previous_success without a previous completed task", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "after_previous_success",
          prompt: "Continue the work",
          status: "queued",
        }),
      ],
    });

    expect(decision.kind).toBe("stop");
    expect(decision.kind === "stop" && decision.reason).toBe(
      "previous_success_required",
    );
  });

  for (const previousTaskStatus of ["failed", "cancelled", "timed_out"] as const) {
    it(`stops after_previous_success after previous ${previousTaskStatus}`, () => {
      const decision = getNextQueueRunnerTaskDecision({
        previousTaskStatus,
        selectedExecutorWidgetId: "executor-1",
        tasks: [
          queueTask({
            assignedExecutorWidgetId: "executor-1",
            executionPolicy: "after_previous_success",
            prompt: "Continue the work",
            status: "queued",
          }),
        ],
      });

      expect(decision.kind).toBe("stop");
      expect(decision.kind === "stop" && decision.reason).toBe(
        "previous_task_not_successful",
      );
    });
  }

  it("skips non-runnable tasks and starts the next runnable task", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          executionPolicy: "auto",
          prompt: "Done already",
          queueItemId: "queue-1",
          status: "completed",
        }),
        queueTask({
          executionPolicy: "auto",
          prompt: "",
          queueItemId: "queue-2",
          status: "ready",
        }),
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Run this",
          queueItemId: "queue-3",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
    expect(decision.kind === "start" && decision.task.queueItemId).toBe(
      "queue-3",
    );
    expect(decision.skippedTaskCount).toBe(2);
  });

  it("marks an unassigned runnable task for assignment before start", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: null,
          executionPolicy: "auto",
          prompt: "Run this",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
    expect(decision.kind === "start" && decision.requiresAssignment).toBe(true);
  });

  it("stops when a runnable task is assigned to another executor", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-2",
          executionPolicy: "auto",
          prompt: "Run this",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("stop");
    expect(decision.kind === "stop" && decision.reason).toBe(
      "assigned_to_different_executor",
    );
  });

  it("uses priority before manual order when selecting eligible tasks", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          orderIndex: 0,
          priority: 0,
          prompt: "Run normal",
          queueItemId: "queue-normal",
          status: "ready",
        }),
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          orderIndex: 1,
          priority: 5,
          prompt: "Run urgent",
          queueItemId: "queue-urgent",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
    expect(decision.kind === "start" && decision.task.queueItemId).toBe(
      "queue-urgent",
    );
  });

  it("uses manual order among eligible tasks with the same priority", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          orderIndex: 2,
          priority: 2,
          prompt: "Run later",
          queueItemId: "queue-later",
          status: "ready",
        }),
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          orderIndex: 0,
          priority: 2,
          prompt: "Run first",
          queueItemId: "queue-first",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
    expect(decision.kind === "start" && decision.task.queueItemId).toBe(
      "queue-first",
    );
  });

  it("stops before starting a task from a paused queue tag", () => {
    const decision = getNextQueueRunnerTaskDecision({
      pausedQueueTagIds: new Set(["review"]),
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Run this",
          queueTagId: "review",
          queueTagName: "Review",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("stop");
    expect(decision.kind === "stop" && decision.reason).toBe("paused_queue_tag");
  });

  it("stops before starting a dependency-blocked task", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: null,
      selectedExecutorWidgetId: "executor-1",
      tasks: [
        queueTask({
          coordinatorStatus: "not_reported",
          executionPolicy: "auto",
          queueItemId: "queue-1",
          status: "completed",
        }),
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          dependsOn: ["queue-1"],
          executionPolicy: "auto",
          prompt: "Run this",
          queueItemId: "queue-2",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("stop");
    expect(decision.kind === "stop" && decision.reason).toBe(
      "dependency_blocked",
    );
  });

  it("does not select a task that already started in the current pass", () => {
    const decision = getNextQueueRunnerTaskDecision({
      previousTaskStatus: "completed",
      selectedExecutorWidgetId: "executor-1",
      startedQueueItemIds: new Set(["queue-1"]),
      tasks: [
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Run this once",
          queueItemId: "queue-1",
          status: "ready",
        }),
        queueTask({
          assignedExecutorWidgetId: "executor-1",
          executionPolicy: "auto",
          prompt: "Run next",
          queueItemId: "queue-2",
          status: "ready",
        }),
      ],
    });

    expect(decision.kind).toBe("start");
    expect(decision.kind === "start" && decision.task.queueItemId).toBe(
      "queue-2",
    );
  });

  it("normalizes final states for after_previous_success decisions", () => {
    expect(queueRunnerFinalStatus("completed")).toBe("completed");
    expect(queueRunnerFinalStatus("cancelled")).toBe("cancelled");
    expect(queueRunnerFinalStatus("timed_out")).toBe("timed_out");
    expect(queueRunnerFinalStatus("failed")).toBe("failed");
    expect(queueRunnerFinalStatus("unknown")).toBe("failed");
  });
});

function queueTask(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    createdAt: "2026-05-20T10:00:00.000Z",
    dependsOn: [],
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
