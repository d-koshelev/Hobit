import {
  queueGlobalExecutionStateLabel,
  type QueueGlobalStatus,
} from "../../../agentQueueTaskUiModel";

export type QueueV2StateBadge = {
  label: string;
  title: string;
  variant: "neutral" | "info" | "success" | "warning" | "error";
};

type QueueV2StateBadgeInput = {
  readonly apiAvailable: boolean;
  readonly availableSlots: number;
  readonly blockedCount: number;
  readonly globalExecutionState: QueueGlobalStatus;
  readonly hasQueueControls: boolean;
  readonly runningCount: number;
  readonly totalSlots: number;
};

export function queueV2StateBadge({
  apiAvailable,
  availableSlots,
  blockedCount,
  globalExecutionState,
  hasQueueControls,
  runningCount,
  totalSlots,
}: QueueV2StateBadgeInput): QueueV2StateBadge {
  if (!apiAvailable || !hasQueueControls) {
    return {
      label: "Controls unavailable",
      title: "Queue controls are not available in this surface.",
      variant: "warning",
    };
  }

  if (globalExecutionState === "stopped") {
    return {
      label: queueGlobalExecutionStateLabel(globalExecutionState),
      title: "Queue starts are disabled until the operator enables Queue.",
      variant: "neutral",
    };
  }

  if (globalExecutionState === "stop_kill_requested") {
    return {
      label: "Blocked",
      title: "Queue starts are blocked while Stop + Kill is requested.",
      variant: "error",
    };
  }

  if (runningCount > 0) {
    return {
      label: "Running",
      title: "One or more Queue tasks are currently running.",
      variant: "info",
    };
  }

  if (totalSlots > 0 && availableSlots <= 0) {
    return {
      label: "Capacity full",
      title: "All configured Queue workers are busy or unavailable.",
      variant: "warning",
    };
  }

  if (blockedCount > 0 && availableSlots <= 0) {
    return {
      label: "Blocked",
      title: "Queue has blocked work and no available capacity.",
      variant: "warning",
    };
  }

  return {
    label: queueGlobalExecutionStateLabel(globalExecutionState),
    title: "Queue starts are enabled for eligible tasks.",
    variant: "success",
  };
}

export function queueV2EnableState({
  apiAvailable,
  globalExecutionState,
  hasCodexExecutable = true,
  hasQueueControls,
}: {
  readonly apiAvailable: boolean;
  readonly globalExecutionState: QueueGlobalStatus;
  readonly hasCodexExecutable?: boolean;
  readonly hasQueueControls: boolean;
}) {
  if (globalExecutionState === "started") {
    return { disabled: true, reason: "Queue is already enabled." };
  }

  if (!apiAvailable || !hasQueueControls) {
    return {
      disabled: true,
      reason: "Queue controls unavailable",
    };
  }

  if (!hasCodexExecutable) {
    return {
      disabled: true,
      reason: "Set Codex executable first",
    };
  }

  return { disabled: false, reason: undefined };
}
