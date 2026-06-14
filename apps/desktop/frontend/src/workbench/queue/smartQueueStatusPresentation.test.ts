import { describe, expect, it } from "vitest";

import {
  computeTaskEligibility,
  type SmartQueueDependency,
  type SmartQueueTaskInput,
} from "./smartQueueEligibility";
import { decideSmartQueueCoordinatorAction } from "./smartQueueCoordinatorDecision";
import { presentSmartQueueStatus } from "./smartQueueStatusPresentation";

describe("smartQueueStatusPresentation", () => {
  it("presents waiting dependencies as planned waiting with dependency detail", () => {
    const tasks = [
      task("task-001", "running", "Setup workspace"),
      task("task-002", "ready", "Implement feature"),
    ];
    const eligibility = computeTaskEligibility(
      tasks[1],
      tasks,
      [dependency("task-001", "task-002")],
      activeQueue(),
    );

    expect(
      presentSmartQueueStatus({
        dependencyLabels: [{ label: "Setup workspace", taskId: "task-001" }],
        eligibility,
      }),
    ).toEqual({
      detail: "Waiting for: Setup workspace",
      label: "Waiting dependency",
      status: "waiting_dependency",
      text: "Waiting dependency",
    });
  });

  it("presents dependency failure and blocked gates as blocked dependency states", () => {
    const failedTasks = [
      task("task-001", "failed", "Setup workspace"),
      task("task-002", "ready", "Implement feature"),
    ];
    const blockedTasks = [
      task("task-003", "blocked", "Prepare release"),
      task("task-004", "ready", "Ship release"),
    ];

    expect(
      presentSmartQueueStatus({
        dependencyLabels: [{ label: "Setup workspace", taskId: "task-001" }],
        eligibility: computeTaskEligibility(
          failedTasks[1],
          failedTasks,
          [dependency("task-001", "task-002")],
          activeQueue(),
        ),
      }),
    ).toMatchObject({
      detail: "Blocked by: Setup workspace",
      label: "Blocked: dependency failed",
      status: "blocked",
    });
    expect(
      presentSmartQueueStatus({
        dependencyLabels: [{ label: "Prepare release", taskId: "task-003" }],
        eligibility: computeTaskEligibility(
          blockedTasks[1],
          blockedTasks,
          [dependency("task-003", "task-004")],
          activeQueue(),
        ),
      }),
    ).toMatchObject({
      detail: "Blocked by: Prepare release",
      label: "Blocked: dependency blocked",
      status: "blocked",
    });
  });

  it("presents validation coordinator decisions without collapsing them into blocked", () => {
    const decision = decideSmartQueueCoordinatorAction({
      maxRetries: 0,
      report: {
        evidenceSummary: "Validation command failed.",
        failureKind: "validation_failure",
        shortReason: "validation failed",
        stage: "validation",
        taskId: "task-001",
      },
      retryCount: 0,
    });

    expect(presentSmartQueueStatus({ coordinatorDecision: decision })).toEqual({
      detail: null,
      label: "Needs decision: validation failed",
      status: "needs_decision",
      text: "Needs decision: validation failed",
    });
  });

  it("keeps core status labels product-facing", () => {
    expect(statusFor(task("ready", "ready"))).toMatchObject({ label: "Ready" });
    expect(statusFor(task("running", "running"))).toMatchObject({
      label: "Running",
    });
    expect(statusFor(task("review", "review"))).toMatchObject({ label: "Review" });
    expect(statusFor(task("failed", "failed"))).toMatchObject({ label: "Failed" });
    expect(statusFor(task("closed", "closed"))).toMatchObject({ label: "Closed" });
  });
});

function statusFor(currentTask: SmartQueueTaskInput) {
  return presentSmartQueueStatus({
    eligibility: computeTaskEligibility(
      currentTask,
      [currentTask],
      [],
      activeQueue(),
    ),
  });
}

function task(
  taskId: string,
  lifecycle: SmartQueueTaskInput["lifecycle"] = "ready",
  title = taskId,
): SmartQueueTaskInput {
  return {
    lifecycle,
    taskId,
    title,
  };
}

function dependency(
  upstreamTaskId: string,
  downstreamTaskId: string,
): SmartQueueDependency {
  return {
    downstreamTaskId,
    kind: "blocks_start",
    upstreamTaskId,
  };
}

function activeQueue() {
  return { capacityAvailable: true, queueState: "active" as const };
}
