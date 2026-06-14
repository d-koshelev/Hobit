import { describe, expect, it } from "vitest";

import {
  canStartTaskNow,
  queueExecutionModeFromGlobalState,
} from "./smartQueueExecutionGate";
import type {
  SmartQueueBlocker,
  SmartQueueDependency,
  SmartQueueTaskInput,
} from "./smartQueueEligibility";

describe("smartQueueExecutionGate", () => {
  it("prevents Ready tasks from starting while Queue is paused", () => {
    const gate = canStartTaskNow({
      capacityAvailable: true,
      queueState: "paused",
      task: task("ready"),
      tasks: [task("ready")],
    });

    expect(gate).toMatchObject({
      canStartTaskNow: false,
      notEligibleReason: "Queue is paused",
      queueExecutionMode: "paused",
      queueStateReason: "Queue is paused",
    });
  });

  it("allows eligible Ready tasks to be considered startable while Queue is active", () => {
    const gate = canStartTaskNow({
      capacityAvailable: true,
      queueState: "active",
      task: task("ready"),
      tasks: [task("ready")],
    });

    expect(gate).toMatchObject({
      canStartTaskNow: true,
      notEligibleReason: null,
      queueExecutionMode: "active",
      queueStateReason: null,
    });
  });

  it("keeps waiting dependency tasks out of the startable set even when Queue is active", () => {
    const upstream = task("upstream", "running");
    const downstream = task("downstream");
    const gate = canStartTaskNow({
      capacityAvailable: true,
      dependencies: [dependency("upstream", "downstream")],
      queueState: "active",
      task: downstream,
      tasks: [upstream, downstream],
    });

    expect(gate).toMatchObject({
      canStartTaskNow: false,
      dependencyReason: "Waiting dependency",
      notEligibleReason: "Waiting dependency",
    });
  });

  it("blocks failed dependency, decision, failed, closed, and cancelled tasks", () => {
    const failedUpstream = task("upstream", "failed");
    const downstream = task("downstream");

    expect(
      canStartTaskNow({
        capacityAvailable: true,
        dependencies: [dependency("upstream", "downstream")],
        queueState: "active",
        task: downstream,
        tasks: [failedUpstream, downstream],
      }),
    ).toMatchObject({
      canStartTaskNow: false,
      dependencyReason: "Blocked: dependency failed",
    });

    expect(
      canStartTaskNow({
        capacityAvailable: true,
        queueState: "active",
        task: task("decision", "ready", [
          { kind: "requires_human_input", reason: "operator input required" },
        ]),
        tasks: [
          task("decision", "ready", [
            { kind: "requires_human_input", reason: "operator input required" },
          ]),
        ],
      }),
    ).toMatchObject({
      canStartTaskNow: false,
      notEligibleReason: "Needs decision: operator input required",
    });

    for (const lifecycle of ["failed", "closed", "cancelled"] as const) {
      const currentTask = task(lifecycle, lifecycle);

      expect(
        canStartTaskNow({
          capacityAvailable: true,
          queueState: "active",
          task: currentTask,
          tasks: [currentTask],
        }),
      ).toMatchObject({
        canStartTaskNow: false,
      });
    }
  });

  it("maps current Queue global state into the Smart Queue execution mode", () => {
    expect(queueExecutionModeFromGlobalState("started")).toEqual({
      mode: "active",
      queueState: "active",
      reason: null,
    });
    expect(queueExecutionModeFromGlobalState("stopped")).toEqual({
      mode: "paused",
      queueState: "paused",
      reason: "Queue is disabled",
    });
    expect(queueExecutionModeFromGlobalState("stop_kill_requested")).toEqual({
      mode: "paused",
      queueState: "stopped",
      reason: "Stop + kill running requested",
    });
  });
});

function task(
  taskId: string,
  lifecycle: SmartQueueTaskInput["lifecycle"] = "ready",
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
