import { describe, expect, it } from "vitest";

import type {
  SmartQueueBlocker,
  SmartQueueDependency,
  SmartQueueTaskInput,
  SmartQueueTaskLifecycle,
} from "./smartQueueEligibility";
import {
  computeSmartQueueDependencyPropagation,
} from "./smartQueueDependencyPropagation";

describe("smartQueueDependencyPropagation", () => {
  it.each([
    ["running", "waiting_dependency", "waiting"],
    ["review", "waiting_dependency", "waiting"],
    ["queued", "waiting_dependency", "waiting"],
    ["ready", "waiting_dependency", "waiting"],
  ] as const)(
    "keeps downstream waiting while upstream is %s",
    (lifecycle, state, gate) => {
      const graph = dependentGraph(lifecycle);

      expect(
        computeSmartQueueDependencyPropagation(
          graph.downstream,
          graph.tasks,
          graph.dependencies,
        ),
      ).toMatchObject({
        blockers: [],
        gate: {
          gate,
          waitingTaskIds: ["task-a"],
        },
        state,
      });
    },
  );

  it("satisfies downstream dependencies when upstream is closed", () => {
    const graph = dependentGraph("closed");

    expect(
      computeSmartQueueDependencyPropagation(
        graph.downstream,
        graph.tasks,
        graph.dependencies,
      ),
    ).toMatchObject({
      blockers: [],
      gate: {
        gate: "satisfied",
        satisfiedTaskIds: ["task-a"],
      },
      state: "satisfied",
    });
  });

  it("blocks downstream with dependency_failed when upstream failed", () => {
    const graph = dependentGraph("failed");

    expect(
      computeSmartQueueDependencyPropagation(
        graph.downstream,
        graph.tasks,
        graph.dependencies,
      ),
    ).toMatchObject({
      blockers: [
        {
          kind: "dependency_failed",
          rootCauseTaskIds: ["task-a"],
          taskId: "task-b",
          upstreamTaskId: "task-a",
        },
      ],
      gate: {
        failedTaskIds: ["task-a"],
        gate: "failed",
      },
      state: "dependency_failed",
    });
  });

  it("blocks downstream with dependency_blocked when upstream is blocked", () => {
    const graph = dependentGraph("blocked");

    expect(
      computeSmartQueueDependencyPropagation(
        graph.downstream,
        graph.tasks,
        graph.dependencies,
      ),
    ).toMatchObject({
      blockers: [
        {
          kind: "dependency_blocked",
          taskId: "task-b",
          upstreamTaskId: "task-a",
        },
      ],
      gate: {
        blockedTaskIds: ["task-a"],
        gate: "blocked",
      },
      state: "dependency_blocked",
    });
  });

  it("converts transitive dependency failure into dependency_blocked for grandchildren", () => {
    const tasks = [task("task-a", "failed"), task("task-b"), task("task-c")];
    const dependencies = [
      dependency("task-a", "task-b"),
      dependency("task-b", "task-c"),
    ];

    expect(
      computeSmartQueueDependencyPropagation(tasks[1], tasks, dependencies),
    ).toMatchObject({
      blockers: [{ kind: "dependency_failed", upstreamTaskId: "task-a" }],
      gate: { gate: "failed" },
      state: "dependency_failed",
    });
    expect(
      computeSmartQueueDependencyPropagation(tasks[2], tasks, dependencies),
    ).toMatchObject({
      blockers: [{ kind: "dependency_blocked", upstreamTaskId: "task-b" }],
      gate: { blockedTaskIds: ["task-b"], gate: "blocked" },
      state: "dependency_blocked",
    });
  });

  it("recomputes dependency blockers away after upstream recovery", () => {
    const failed = dependentGraph("failed");
    const recovered = dependentGraph("closed");

    expect(
      computeSmartQueueDependencyPropagation(
        failed.downstream,
        failed.tasks,
        failed.dependencies,
      ),
    ).toMatchObject({
      blockers: [{ kind: "dependency_failed" }],
      state: "dependency_failed",
    });
    expect(
      computeSmartQueueDependencyPropagation(
        recovered.downstream,
        recovered.tasks,
        recovered.dependencies,
      ),
    ).toMatchObject({
      blockers: [],
      gate: { gate: "satisfied" },
      state: "satisfied",
    });
  });

  it("keeps recovered tasks waiting when another dependency is unfinished", () => {
    const tasks = [
      task("task-a", "closed"),
      task("task-b", "running"),
      task("task-c"),
    ];
    const dependencies = [
      dependency("task-a", "task-c"),
      dependency("task-b", "task-c"),
    ];

    expect(
      computeSmartQueueDependencyPropagation(tasks[2], tasks, dependencies),
    ).toMatchObject({
      blockers: [],
      gate: {
        gate: "waiting",
        satisfiedTaskIds: ["task-a"],
        waitingTaskIds: ["task-b"],
      },
      state: "waiting_dependency",
    });
  });

  it("leaves non-dependency blockers to the task status layer after recovery", () => {
    const blockedTask = task("task-b", "ready", [
      { kind: "requires_human_input", reason: "operator input required" },
    ]);
    const tasks = [task("task-a", "closed"), blockedTask];
    const dependencies = [dependency("task-a", "task-b")];

    expect(
      computeSmartQueueDependencyPropagation(blockedTask, tasks, dependencies),
    ).toMatchObject({
      blockers: [],
      gate: { gate: "satisfied" },
      state: "satisfied",
    });
  });
});

function dependentGraph(upstreamLifecycle: SmartQueueTaskLifecycle) {
  const upstream = task("task-a", upstreamLifecycle);
  const downstream = task("task-b");

  return {
    dependencies: [dependency("task-a", "task-b")],
    downstream,
    tasks: [upstream, downstream],
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
