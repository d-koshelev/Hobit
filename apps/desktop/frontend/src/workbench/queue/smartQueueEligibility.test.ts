import { describe, expect, it } from "vitest";

import {
  computeDependencyFailurePropagation,
  computeDependencyGate,
  computeHumanQueueStatus,
  computeTaskBlockers,
  computeTaskEligibility,
  type SmartQueueBlocker,
  type SmartQueueDependency,
  type SmartQueueTaskInput,
  type SmartQueueTaskLifecycle,
} from "./smartQueueEligibility";

describe("smartQueueEligibility", () => {
  it("makes a task with no dependencies eligible when Queue is active", () => {
    const currentTask = task("task-ready");

    expect(
      computeTaskEligibility(currentTask, [currentTask], [], activeQueue()),
    ).toMatchObject({
      autoEligibleToStart: true,
      dependencyGate: { gate: "none" },
      humanStatus: { label: "Ready", status: "ready", text: "Ready" },
      reason: "Eligible",
    });
  });

  it("keeps a task with no dependencies ready but not auto-eligible when Queue is paused", () => {
    const currentTask = task("task-ready");

    expect(
      computeTaskEligibility(currentTask, [currentTask], [], pausedQueue()),
    ).toMatchObject({
      autoEligibleToStart: false,
      dependencyGate: { gate: "none" },
      humanStatus: { label: "Ready", status: "ready", text: "Ready" },
      reason: "Queue Paused",
    });
  });

  it("keeps a task waiting while its dependency is running", () => {
    const tasks = dependentTasks("running");
    const gate = computeDependencyGate(tasks.downstream, tasks.all, tasks.dependencies);

    expect(gate).toMatchObject({
      gate: "waiting",
      waitingTaskIds: ["task-upstream"],
    });
    expect(computeHumanQueueStatus(tasks.downstream, gate)).toEqual({
      label: "Waiting dependency",
      reason: "Waiting for: task-upstream",
      status: "waiting_dependency",
      text: "Waiting for: task-upstream",
    });
    expect(
      computeTaskEligibility(
        tasks.downstream,
        tasks.all,
        tasks.dependencies,
        activeQueue(),
      ),
    ).toMatchObject({
      autoEligibleToStart: false,
      dependencyGate: { gate: "waiting" },
      humanStatus: { status: "waiting_dependency" },
      reason: "Waiting for: task-upstream",
    });
  });

  it("keeps a task waiting while its dependency is in review", () => {
    const tasks = dependentTasks("review");

    expect(
      computeTaskEligibility(
        tasks.downstream,
        tasks.all,
        tasks.dependencies,
        activeQueue(),
      ),
    ).toMatchObject({
      autoEligibleToStart: false,
      dependencyGate: { gate: "waiting" },
      humanStatus: {
        label: "Waiting dependency",
        reason: "Waiting for: task-upstream",
        status: "waiting_dependency",
      },
    });
  });

  it("keeps a task waiting while its dependency is draft or queued", () => {
    for (const lifecycle of ["draft", "queued"] satisfies SmartQueueTaskLifecycle[]) {
      const tasks = dependentTasks(lifecycle);

      expect(
        computeTaskEligibility(
          tasks.downstream,
          tasks.all,
          tasks.dependencies,
          activeQueue(),
        ),
      ).toMatchObject({
        autoEligibleToStart: false,
        dependencyGate: { gate: "waiting" },
        humanStatus: { status: "waiting_dependency" },
      });
    }
  });

  it("makes a dependent task ready and eligible when its dependency is closed", () => {
    const tasks = dependentTasks("closed");

    expect(
      computeTaskEligibility(
        tasks.downstream,
        tasks.all,
        tasks.dependencies,
        activeQueue(),
      ),
    ).toMatchObject({
      autoEligibleToStart: true,
      dependencyGate: {
        gate: "satisfied",
        satisfiedTaskIds: ["task-upstream"],
      },
      humanStatus: { label: "Ready", status: "ready", text: "Ready" },
      reason: "Eligible",
    });
  });

  it("blocks a dependent task when its dependency failed", () => {
    const tasks = dependentTasks("failed");
    const gate = computeDependencyGate(tasks.downstream, tasks.all, tasks.dependencies);

    expect(gate).toMatchObject({
      failedTaskIds: ["task-upstream"],
      gate: "failed",
      rootFailedTaskIds: ["task-upstream"],
    });
    expect(computeTaskBlockers(tasks.downstream, gate)).toContainEqual({
      kind: "dependency_failed",
      reason: "dependency failed",
      rootCauseTaskIds: ["task-upstream"],
      taskId: "task-downstream",
      upstreamTaskId: "task-upstream",
    });
    expect(computeHumanQueueStatus(tasks.downstream, gate)).toEqual({
      label: "Blocked: dependency failed",
      status: "blocked",
      text: "Blocked: dependency failed",
    });
  });

  it("blocks a dependent task when its dependency is blocked", () => {
    const tasks = dependentTasks("blocked");
    const gate = computeDependencyGate(tasks.downstream, tasks.all, tasks.dependencies);

    expect(gate).toMatchObject({
      blockedTaskIds: ["task-upstream"],
      gate: "blocked",
      rootBlockedTaskIds: ["task-upstream"],
    });
    expect(computeHumanQueueStatus(tasks.downstream, gate)).toEqual({
      label: "Blocked: dependency blocked",
      status: "blocked",
      text: "Blocked: dependency blocked",
    });
    expect(
      computeTaskEligibility(
        tasks.downstream,
        tasks.all,
        tasks.dependencies,
        activeQueue(),
      ),
    ).toMatchObject({
      autoEligibleToStart: false,
      dependencyGate: { gate: "blocked" },
      humanStatus: { status: "blocked" },
    });
  });

  it("propagates transitive dependency failure to downstream waiting tasks", () => {
    const upstream = task("task-a", "failed");
    const middle = task("task-b");
    const downstream = task("task-c");
    const dependencies = [
      dependency("task-a", "task-b"),
      dependency("task-b", "task-c"),
    ];
    const tasks = [upstream, middle, downstream];

    expect(
      computeTaskEligibility(downstream, tasks, dependencies, activeQueue()),
    ).toMatchObject({
      autoEligibleToStart: false,
      dependencyGate: {
        failedTaskIds: ["task-b"],
        gate: "failed",
        rootFailedTaskIds: ["task-a"],
      },
      humanStatus: {
        label: "Blocked: dependency failed",
        status: "blocked",
      },
    });
    expect(computeDependencyFailurePropagation(tasks, dependencies)).toMatchObject({
      affectedTaskIds: ["task-b", "task-c"],
      blockersByTaskId: {
        "task-b": [{ kind: "dependency_failed", upstreamTaskId: "task-a" }],
        "task-c": [
          {
            kind: "dependency_failed",
            rootCauseTaskIds: ["task-a"],
            upstreamTaskId: "task-b",
          },
        ],
      },
    });
  });

  it("recomputes dependency failure away when an upstream retry later closes", () => {
    const failed = dependentTasks("failed");
    const resolved = dependentTasks("closed");

    expect(
      computeTaskEligibility(
        failed.downstream,
        failed.all,
        failed.dependencies,
        activeQueue(),
      ),
    ).toMatchObject({
      autoEligibleToStart: false,
      dependencyGate: { gate: "failed" },
      humanStatus: { label: "Blocked: dependency failed", status: "blocked" },
    });
    expect(
      computeTaskEligibility(
        resolved.downstream,
        resolved.all,
        resolved.dependencies,
        activeQueue(),
      ),
    ).toMatchObject({
      autoEligibleToStart: true,
      dependencyGate: { gate: "satisfied" },
      humanStatus: { label: "Ready", status: "ready" },
      reason: "Eligible",
    });
  });

  it("prevents eligibility when missing_config is present", () => {
    const currentTask = task("task-config", "ready", [
      blocker("missing_config", "missing config"),
    ]);

    expect(
      computeTaskEligibility(currentTask, [currentTask], [], activeQueue()),
    ).toMatchObject({
      autoEligibleToStart: false,
      blockers: [{ kind: "missing_config", reason: "missing config" }],
      humanStatus: {
        label: "Blocked: missing config",
        status: "blocked",
        text: "Blocked: missing config",
      },
      reason: "Blocked: missing config",
    });
  });

  it("surfaces validation_requires_decision as a decision state", () => {
    const currentTask = task("task-validation", "ready", [
      blocker("validation_requires_decision", "validation failed"),
    ]);

    expect(
      computeTaskEligibility(currentTask, [currentTask], [], activeQueue()),
    ).toMatchObject({
      autoEligibleToStart: false,
      blockers: [
        { kind: "validation_requires_decision", reason: "validation failed" },
      ],
      humanStatus: {
        label: "Needs decision: validation failed",
        status: "needs_decision",
        text: "Needs decision: validation failed",
      },
      reason: "Needs decision: validation failed",
    });
  });

  it("never starts closed, failed, or cancelled tasks", () => {
    for (const lifecycle of [
      "closed",
      "failed",
      "cancelled",
    ] satisfies SmartQueueTaskLifecycle[]) {
      const currentTask = task(`task-${lifecycle}`, lifecycle);

      expect(
        computeTaskEligibility(currentTask, [currentTask], [], activeQueue()),
      ).toMatchObject({
        autoEligibleToStart: false,
        humanStatus: { status: lifecycle === "closed" ? "closed" : lifecycle },
      });
    }
  });

  it("keeps human-readable status strings stable and product-facing", () => {
    const waitingTasks = dependentTasks("running");
    const failedTasks = dependentTasks("failed");
    const blockedTask = task("task-blocked", "ready", [
      blocker("dirty_worktree", "dirty worktree"),
    ]);
    const decisionTask = task("task-decision", "ready", [
      blocker("requires_human_input", "operator input required"),
    ]);

    expect(
      computeHumanQueueStatus(
        waitingTasks.downstream,
        computeDependencyGate(
          waitingTasks.downstream,
          waitingTasks.all,
          waitingTasks.dependencies,
        ),
      ),
    ).toMatchObject({
      label: "Waiting dependency",
      reason: "Waiting for: task-upstream",
      text: "Waiting for: task-upstream",
    });
    expect(
      computeHumanQueueStatus(
        failedTasks.downstream,
        computeDependencyGate(
          failedTasks.downstream,
          failedTasks.all,
          failedTasks.dependencies,
        ),
      ).text,
    ).toBe("Blocked: dependency failed");
    expect(
      computeHumanQueueStatus(
        blockedTask,
        computeDependencyGate(blockedTask, [blockedTask], []),
      ).text,
    ).toBe("Blocked: dirty worktree");
    expect(
      computeHumanQueueStatus(
        decisionTask,
        computeDependencyGate(decisionTask, [decisionTask], []),
      ).text,
    ).toBe("Needs decision: operator input required");
  });
});

function dependentTasks(upstreamLifecycle: SmartQueueTaskLifecycle) {
  const upstream = task("task-upstream", upstreamLifecycle);
  const downstream = task("task-downstream");
  const dependencies = [dependency(upstream.taskId, downstream.taskId)];

  return {
    all: [upstream, downstream],
    dependencies,
    downstream,
    upstream,
  };
}

function task(
  taskId: string,
  lifecycle: SmartQueueTaskLifecycle = "ready",
  blockers: readonly SmartQueueBlocker[] = [],
): SmartQueueTaskInput {
  return {
    blockers,
    lifecycle,
    taskId,
    title: taskId,
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

function blocker(
  kind: SmartQueueBlocker["kind"],
  reason: string,
): SmartQueueBlocker {
  return { kind, reason };
}

function activeQueue() {
  return { capacityAvailable: true, queueState: "active" as const };
}

function pausedQueue() {
  return { capacityAvailable: true, queueState: "paused" as const };
}
