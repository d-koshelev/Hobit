import { describe, expect, it } from "vitest";

import type { AgentQueueTask } from "../../../../workspace/types";
import {
  computeDependencyGate,
  computeHumanQueueTaskStatus,
  computeTaskBlockers,
  computeTaskEligibility,
  type QueueTaskGraphState,
} from "./queueV2EligibilityModel";

describe("queueV2EligibilityModel", () => {
  it("keeps B waiting while A is running", () => {
    const tasks = [
      task({ queueItemId: "task-001", status: "running" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);

    expect(graphState.dependencyGate.gate).toBe("waiting");
    expect(
      computeHumanQueueTaskStatus(tasks[1], activeQueue(), graphState).text,
    ).toBe("Waiting for Task 001");
    expect(
      computeTaskEligibility(tasks[1], activeQueue(), graphState, capacity())
        .canAutoStart,
    ).toBe(false);
  });

  it("keeps B waiting while A is in review", () => {
    const tasks = [
      task({ queueItemId: "task-001", status: "review_needed" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);

    expect(graphState.dependencyGate.gate).toBe("waiting");
    expect(
      computeHumanQueueTaskStatus(tasks[1], activeQueue(), graphState).text,
    ).toBe("Waiting for Task 001");
  });

  it("makes B ready and eligible when A is closed and Queue is Active", () => {
    const tasks = [
      task({ queueItemId: "task-001", status: "completed" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const graphState = graphFor(tasks[1], tasks);
    const eligibility = computeTaskEligibility(
      tasks[1],
      activeQueue(),
      graphState,
      capacity(),
    );

    expect(graphState.dependencyGate.gate).toBe("satisfied");
    expect(
      computeHumanQueueTaskStatus(tasks[1], activeQueue(), graphState).text,
    ).toBe("Ready");
    expect(eligibility.canAutoStart).toBe(true);
    expect(eligibility.reason).toBe("Eligible");
  });

  it("blocks B when A failed", () => {
    const tasks = [
      task({ queueItemId: "task-001", status: "failed" }),
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
    expect(
      computeHumanQueueTaskStatus(tasks[1], activeQueue(), graphState).text,
    ).toBe("Blocked: dependency failed");
  });

  it("blocks B when A is blocked", () => {
    const tasks = [
      task({ queueItemId: "task-001", coordinatorStatus: "blocked" }),
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
    expect(
      computeHumanQueueTaskStatus(tasks[1], activeQueue(), graphState).text,
    ).toBe("Blocked: dependency blocked");
  });

  it("prevents auto-start eligibility while Queue is Paused", () => {
    const readyTask = task({ queueItemId: "task-001" });
    const eligibility = computeTaskEligibility(
      readyTask,
      { state: "paused" },
      graphFor(readyTask, [readyTask]),
      capacity(),
    );

    expect(eligibility.canAutoStart).toBe(false);
    expect(eligibility.reason).toBe("Queue Paused");
  });

  it("permits eligible ready tasks while Queue is Active", () => {
    const readyTask = task({ queueItemId: "task-001" });
    const eligibility = computeTaskEligibility(
      readyTask,
      activeQueue(),
      graphFor(readyTask, [readyTask]),
      capacity(),
    );

    expect(eligibility.canAutoStart).toBe(true);
    expect(eligibility.humanStatus).toBe("ready");
  });

  it("creates blockers for missing prompt and config", () => {
    const blockedTask = task({
      queueItemId: "task-001",
      codexExecutable: "",
      executionWorkspace: "",
      prompt: "",
    });
    const blockers = computeTaskBlockers(blockedTask, graphFor(blockedTask, [blockedTask]));

    expect(blockers.map((blocker) => blocker.kind)).toEqual([
      "missing_prompt",
      "missing_config",
    ]);
  });

  it("returns product-facing human status text", () => {
    const waitingTasks = [
      task({ queueItemId: "task-001", status: "running" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];
    const failedTasks = [
      task({ queueItemId: "task-001", status: "failed" }),
      task({ queueItemId: "task-002", dependsOn: ["task-001"] }),
    ];

    expect(
      computeHumanQueueTaskStatus(
        waitingTasks[1],
        activeQueue(),
        graphFor(waitingTasks[1], waitingTasks),
      ).text,
    ).toBe("Waiting for Task 001");
    expect(
      computeHumanQueueTaskStatus(
        failedTasks[1],
        activeQueue(),
        graphFor(failedTasks[1], failedTasks),
      ).text,
    ).toBe("Blocked: dependency failed");
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
    createdAt: "2026-01-01T00:00:00.000Z",
    dependsOn: [],
    description: "Queue task",
    executionWorkspace: "C:/repo",
    priority: 1,
    prompt: "Do the task",
    queueItemId: "task-001",
    status: "ready",
    title: "Task",
    updatedAt: "2026-01-01T00:00:00.000Z",
    workspaceId: "workspace-001",
    ...overrides,
  };
}
