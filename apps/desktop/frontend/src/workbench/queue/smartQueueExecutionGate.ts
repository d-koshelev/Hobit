import type { AgentQueueGlobalExecutionState } from "../../workspace/types";
import type { SmartQueueState } from "../../workspace/types/smartQueue";
import {
  computeTaskEligibility,
  type SmartQueueDependency,
  type SmartQueueEligibility,
  type SmartQueueTaskInput,
} from "./smartQueueEligibility";

export type QueueExecutionMode = "active" | "paused";

export type QueueExecutionModeState = {
  readonly mode: QueueExecutionMode;
  readonly queueState: SmartQueueState;
  readonly reason: string | null;
};

export type SmartQueueExecutionGate = {
  readonly canStartTaskNow: boolean;
  readonly dependencyReason: string | null;
  readonly eligibility: SmartQueueEligibility;
  readonly notEligibleReason: string | null;
  readonly queueStateReason: string | null;
  readonly queueExecutionMode: QueueExecutionMode;
};

export type SmartQueueExecutionGateInput = {
  readonly capacityAvailable: boolean;
  readonly dependencies?: readonly SmartQueueDependency[];
  readonly queueState: SmartQueueState;
  readonly task: SmartQueueTaskInput;
  readonly tasks: readonly SmartQueueTaskInput[];
};

export function canStartTaskNow({
  capacityAvailable,
  dependencies = [],
  queueState,
  task,
  tasks,
}: SmartQueueExecutionGateInput): SmartQueueExecutionGate {
  const eligibility = computeTaskEligibility(task, tasks, dependencies, {
    capacityAvailable,
    queueState,
  });
  const queueStateReason = queueStartUnavailableReason(queueState);
  const dependencyReason = dependencyUnavailableReason(eligibility);
  const canStart = eligibility.autoEligibleToStart;

  return {
    canStartTaskNow: canStart,
    dependencyReason,
    eligibility,
    notEligibleReason: canStart
      ? null
      : queueStateReason ?? dependencyReason ?? eligibility.reason,
    queueExecutionMode: queueState === "active" ? "active" : "paused",
    queueStateReason,
  };
}

export function queueExecutionModeFromGlobalState(
  globalExecutionState: AgentQueueGlobalExecutionState,
): QueueExecutionModeState {
  switch (globalExecutionState) {
    case "started":
      return {
        mode: "active",
        queueState: "active",
        reason: null,
      };
    case "stop_kill_requested":
      return {
        mode: "paused",
        queueState: "stopped",
        reason: "Stop + kill running requested",
      };
    case "stopped":
    default:
      return {
        mode: "paused",
        queueState: "paused",
        reason: "Queue is disabled",
      };
  }
}

export function queueStartUnavailableReason(queueState: SmartQueueState) {
  switch (queueState) {
    case "active":
      return null;
    case "paused":
      return "Queue is paused";
    case "draining":
      return "Queue is draining";
    case "stopped":
      return "Queue is disabled";
  }
}

function dependencyUnavailableReason(eligibility: SmartQueueEligibility) {
  switch (eligibility.dependencyGate.gate) {
    case "waiting":
      return "Waiting dependency";
    case "failed":
      return "Blocked: dependency failed";
    case "blocked":
      return "Blocked: dependency blocked";
    case "none":
    case "satisfied":
      return null;
  }
}
