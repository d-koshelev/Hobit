import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../workspace/types";
import {
  computeDependencyGate,
  computeFailurePropagation,
  computeHumanQueueStatus,
  computeTaskBlockers,
  computeTaskEligibility,
  type QueueTaskGraphState,
} from "./queueDependencyEligibilityModel";

describe("queue dependency eligibility model", () => {
  it("keeps B in Waiting dependency while A is running", () => {
    const tasks = [
      task({ queueItemId: "task-001", status: "running" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);

    expect(graphState.dependencyGate.gate).toBe("waiting");
    expect(computeHumanQueueStatus(tasks[1], activeQueue(), graphState)).toEqual({
      status: "waiting_dependency",
      text: "Waiting for Task 001",
    });
    expect(
      computeTaskEligibility(tasks[1], activeQueue(), graphState, capacity()),
    ).toMatchObject({
      canAutoStart: false,
      dependencyGate: "waiting",
      humanStatus: "waiting_dependency",
    });
  });

  it("keeps B in Waiting dependency while A needs review", () => {
    const tasks = [
      task({ queueItemId: "task-001", status: "review_needed" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];

    expect(computeHumanQueueStatus(tasks[1], activeQueue(), graphFor(tasks[1], tasks))).toEqual({
      status: "waiting_dependency",
      text: "Waiting for Task 001",
    });
  });

  it("makes B ready and eligible when A is closed successfully", () => {
    const tasks = [
      task({
        closureState: "no_change_accepted",
        coordinatorStatus: "finalized",
        queueItemId: "task-001",
        status: "completed",
      }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);

    expect(computeTaskEligibility(tasks[1], activeQueue(), graphState, capacity())).toMatchObject({
      canAutoStart: true,
      dependencyGate: "satisfied",
      humanStatus: "ready",
      reason: "Eligible",
    });
  });

  it("blocks B with dependency_failed when A failed", () => {
    const tasks = [
      task({ coordinatorStatus: "failed", queueItemId: "task-001", status: "failed" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);

    expect(graphState.dependencyGate.gate).toBe("failed");
    expect(computeTaskBlockers(tasks[1], graphState)).toContainEqual({
      kind: "dependency_failed",
      message: "Dependency task-001 failed.",
      taskId: "task-002",
      upstreamTaskId: "task-001",
    });
    expect(computeHumanQueueStatus(tasks[1], activeQueue(), graphState)).toEqual({
      status: "blocked",
      text: "Blocked: dependency failed",
    });
  });

  it("blocks B with dependency_blocked when A is blocked", () => {
    const tasks = [
      task({ coordinatorStatus: "blocked", queueItemId: "task-001" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);

    expect(graphState.dependencyGate.gate).toBe("blocked");
    expect(computeTaskBlockers(tasks[1], graphState)).toContainEqual({
      kind: "dependency_blocked",
      message: "Dependency task-001 is blocked.",
      taskId: "task-002",
      upstreamTaskId: "task-001",
    });
    expect(computeHumanQueueStatus(tasks[1], activeQueue(), graphState)).toEqual({
      status: "blocked",
      text: "Blocked: dependency blocked",
    });
  });

  it("does not make any task start-eligible while Queue is paused", () => {
    const readyTask = task({ queueItemId: "task-001" });

    expect(
      computeTaskEligibility(
        readyTask,
        { state: "paused" },
        graphFor(readyTask, [readyTask]),
        capacity(),
      ),
    ).toMatchObject({
      canAutoStart: false,
      humanStatus: "ready",
      reason: "Queue Paused",
    });
  });

  it("makes an active ready task eligible when dependencies and capacity allow it", () => {
    const readyTask = task({ queueItemId: "task-001" });

    expect(
      computeTaskEligibility(
        readyTask,
        activeQueue(),
        graphFor(readyTask, [readyTask]),
        capacity(),
      ),
    ).toMatchObject({
      canAutoStart: true,
      dependencyGate: "none",
      humanStatus: "ready",
      reason: "Eligible",
    });
  });

  it("recomputes and resolves dependency_failed when upstream closes successfully", () => {
    const failed = [
      task({ coordinatorStatus: "failed", queueItemId: "task-001", status: "failed" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const resolved = [
      task({
        closureState: "commit_created",
        coordinatorStatus: "finalized",
        queueItemId: "task-001",
        status: "completed",
      }),
      failed[1],
    ];

    expect(computeFailurePropagation(failed[1], failed)).toMatchObject({
      downstreamTaskId: "task-002",
      gate: "failed",
      blockers: [{ kind: "dependency_failed" }],
    });
    expect(computeFailurePropagation(resolved[1], resolved)).toMatchObject({
      downstreamTaskId: "task-002",
      gate: "satisfied",
      blockers: [],
      summary: "No dependency failure propagation.",
    });
  });

  it("propagates transitive failed dependency as dependency_blocked", () => {
    const tasks = [
      task({ coordinatorStatus: "failed", queueItemId: "task-001", status: "failed" }),
      task({ dependsOn: ["task-001"], queueItemId: "task-002" }),
      task({ dependsOn: ["task-002"], queueItemId: "task-003" }),
    ];

    expect(computeHumanQueueStatus(tasks[1], activeQueue(), graphFor(tasks[1], tasks))).toEqual({
      status: "blocked",
      text: "Blocked: dependency failed",
    });
    expect(computeHumanQueueStatus(tasks[2], activeQueue(), graphFor(tasks[2], tasks))).toEqual({
      status: "blocked",
      text: "Blocked: dependency blocked",
    });
    expect(computeTaskBlockers(tasks[2], graphFor(tasks[2], tasks))).toContainEqual({
      kind: "dependency_blocked",
      message: "Dependency task-002 is blocked.",
      taskId: "task-003",
      upstreamTaskId: "task-002",
    });
  });

  it("keeps a recovered task waiting when another dependency is unfinished", () => {
    const tasks = [
      task({
        closureState: "commit_created",
        coordinatorStatus: "finalized",
        queueItemId: "task-001",
        status: "completed",
      }),
      task({ queueItemId: "task-002", status: "running" }),
      task({ dependsOn: ["task-001", "task-002"], queueItemId: "task-003" }),
    ];

    expect(computeHumanQueueStatus(tasks[2], activeQueue(), graphFor(tasks[2], tasks))).toEqual({
      status: "waiting_dependency",
      text: "Waiting for Task 002",
    });
  });

  it("keeps a recovered task blocked by its own non-dependency blocker", () => {
    const tasks = [
      task({
        closureState: "commit_created",
        coordinatorStatus: "finalized",
        queueItemId: "task-001",
        status: "completed",
      }),
      task({
        dependsOn: ["task-001"],
        queueItemId: "task-002",
        validationStatus: "needs_review",
      }),
    ];

    expect(computeHumanQueueStatus(tasks[1], activeQueue(), graphFor(tasks[1], tasks))).toEqual({
      status: "needs_decision",
      text: "Needs decision",
    });
    expect(computeTaskEligibility(tasks[1], activeQueue(), graphFor(tasks[1], tasks), capacity())).toMatchObject({
      canAutoStart: false,
      dependencyGate: "satisfied",
      humanStatus: "needs_decision",
    });
  });

  it("summarizes multiple waiting and blocked dependencies for operators", () => {
    const waitingTasks = [
      task({ queueItemId: "task-001", status: "running" }),
      task({ queueItemId: "task-002", status: "review_needed" }),
      task({ queueItemId: "task-003", dependsOn: ["task-001", "task-002"] }),
    ];
    const blockedTasks = [
      task({ coordinatorStatus: "blocked", queueItemId: "task-001" }),
      task({ coordinatorStatus: "blocked", queueItemId: "task-002" }),
      task({ queueItemId: "task-003", dependsOn: ["task-001", "task-002"] }),
    ];

    expect(
      computeHumanQueueStatus(
        waitingTasks[2],
        activeQueue(),
        graphFor(waitingTasks[2], waitingTasks),
      ).text,
    ).toBe("Waiting for Task 001, Task 002");
    expect(
      computeHumanQueueStatus(
        blockedTasks[2],
        activeQueue(),
        graphFor(blockedTasks[2], blockedTasks),
      ).text,
    ).toBe("Blocked: dependency blocked (Task 001, Task 002)");
  });
});

function graphFor(
  targetTask: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
): QueueTaskGraphState {
  return {
    dependencyGate: computeDependencyGate(targetTask, tasks),
  };
}

function activeQueue() {
  return { state: "active" as const };
}

function capacity() {
  return { availableSlots: 1 };
}

function task(overrides: Partial<AgentQueueTask> = {}): AgentQueueTask {
  return {
    assignedExecutorWidgetId: null,
    codexExecutable: "codex",
    createdAt: "2026-06-14T00:00:00.000Z",
    dependsOn: [],
    description: "Queue task",
    executionWorkspace: "C:/repo",
    priority: 1,
    prompt: "Do the task",
    queueItemId: "task-001",
    status: "ready",
    title: "Task",
    updatedAt: "2026-06-14T00:00:00.000Z",
    workspaceId: "workspace-001",
    ...overrides,
  };
}
