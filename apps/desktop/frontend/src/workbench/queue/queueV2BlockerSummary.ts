import type { AgentQueueDependencyState } from "../agentQueueTaskUiModel";
import type { QueueNextAction } from "./queueV2NextActionModel";

export type QueueBlockedReasonCode =
  | "missing_execution_workspace"
  | "missing_codex_executable"
  | "queue_disabled"
  | "not_ready_lifecycle"
  | "dependency_open"
  | "dependency_failed_or_rejected"
  | "dependency_graph_invalid"
  | "capacity_unavailable"
  | "runtime_unavailable"
  | "run_settings_invalid"
  | "validation_failed"
  | "context_missing"
  | "context_invalid"
  | "worker_paused"
  | "tag_paused"
  | "safety_blocker"
  | "operator_review_required";

export type QueueBlockedReason = {
  code: QueueBlockedReasonCode;
  label: string;
  source?: string;
};

export type QueueBlockerCategory =
  | "capacity"
  | "context"
  | "dependency"
  | "lifecycle"
  | "queue"
  | "safety"
  | "settings"
  | "validation"
  | "worker"
  | "workspace";

export type QueueDependencyBlockerSource = {
  reason: string;
  taskId: string;
  title: string;
};

export type QueueBlockerSummary = {
  actionable: boolean;
  category: QueueBlockerCategory | null;
  dependencyBlockerSources: QueueDependencyBlockerSource[];
  kind: QueueBlockedReasonCode | null;
  nextAction: string;
  primaryReason: string | null;
  secondaryReasons: string[];
};

export function queueV2BlockedReason(
  code: QueueBlockedReasonCode,
  label = defaultBlockedReasonLabel(code),
): QueueBlockedReason {
  return { code, label };
}

export function prioritizeQueueV2BlockedReasons(
  reasons: readonly QueueBlockedReason[],
) {
  return [...reasons].sort(
    (a, b) => blockedReasonPriority(a.code) - blockedReasonPriority(b.code),
  );
}

export function queueV2BlockerSummaryForTask({
  blockedReasons,
  dependencyState,
  nextAction,
}: {
  blockedReasons: readonly QueueBlockedReason[];
  dependencyState: AgentQueueDependencyState;
  nextAction: QueueNextAction;
}): QueueBlockerSummary {
  const prioritizedReasons = prioritizeQueueV2BlockedReasons(blockedReasons);
  const primary = prioritizedReasons[0] ?? null;
  const dependencyBlockerSources = dependencyState.blockedBy.map((blocker) => ({
    reason: blocker.reason,
    taskId: blocker.queueItemId,
    title: blocker.title,
  }));

  return {
    actionable: primary ? blockerIsActionable(primary.code) : false,
    category: primary ? blockerCategory(primary.code) : null,
    dependencyBlockerSources,
    kind: primary?.code ?? null,
    nextAction: blockerNextAction(primary?.code ?? null, nextAction),
    primaryReason: primary
      ? blockerPrimaryReason(primary, dependencyBlockerSources)
      : null,
    secondaryReasons: prioritizedReasons
      .slice(1)
      .map((reason) => blockerPrimaryReason(reason, dependencyBlockerSources)),
  };
}

function blockedReasonPriority(code: QueueBlockedReasonCode) {
  switch (code) {
    case "missing_execution_workspace":
      return 10;
    case "missing_codex_executable":
      return 15;
    case "queue_disabled":
      return 20;
    case "dependency_open":
    case "dependency_failed_or_rejected":
    case "dependency_graph_invalid":
      return 30;
    case "validation_failed":
    case "operator_review_required":
      return 40;
    case "run_settings_invalid":
    case "context_missing":
    case "context_invalid":
      return 50;
    case "capacity_unavailable":
    case "runtime_unavailable":
    case "worker_paused":
    case "tag_paused":
      return 60;
    case "safety_blocker":
      return 70;
    case "not_ready_lifecycle":
      return 80;
  }
}

function blockerCategory(code: QueueBlockedReasonCode): QueueBlockerCategory {
  switch (code) {
    case "missing_execution_workspace":
      return "workspace";
    case "missing_codex_executable":
      return "settings";
    case "queue_disabled":
      return "queue";
    case "dependency_open":
    case "dependency_failed_or_rejected":
    case "dependency_graph_invalid":
      return "dependency";
    case "validation_failed":
    case "operator_review_required":
      return "validation";
    case "run_settings_invalid":
      return "settings";
    case "context_missing":
    case "context_invalid":
      return "context";
    case "capacity_unavailable":
    case "runtime_unavailable":
      return "capacity";
    case "worker_paused":
    case "tag_paused":
      return "worker";
    case "safety_blocker":
      return "safety";
    case "not_ready_lifecycle":
      return "lifecycle";
  }
}

function blockerIsActionable(code: QueueBlockedReasonCode) {
  return ![
    "dependency_open",
    "capacity_unavailable",
    "runtime_unavailable",
  ].includes(code);
}

function blockerNextAction(
  code: QueueBlockedReasonCode | null,
  nextAction: QueueNextAction,
) {
  switch (code) {
    case "missing_execution_workspace":
      return "Set task workspace";
    case "missing_codex_executable":
      return "Set Codex executable";
    case "queue_disabled":
      return "Enable Queue";
    case "dependency_open":
      return "Open dependency task";
    case "dependency_failed_or_rejected":
    case "dependency_graph_invalid":
      return "Review dependency state";
    case "validation_failed":
      return "Review validation";
    case "operator_review_required":
      return "Review current operation";
    case "run_settings_invalid":
      return "Complete run settings";
    case "context_missing":
    case "context_invalid":
      return "Review context";
    case "worker_paused":
    case "tag_paused":
      return "Resume worker or tag";
    case "capacity_unavailable":
    case "runtime_unavailable":
      return "Wait for capacity";
    case "safety_blocker":
      return "Resolve safety review";
    case "not_ready_lifecycle":
      return "Prepare task";
    case null:
      return nextActionFallbackLabel(nextAction);
  }
}

function blockerPrimaryReason(
  reason: QueueBlockedReason,
  dependencyBlockerSources: readonly QueueDependencyBlockerSource[],
) {
  if (
    reason.code === "dependency_open" &&
    dependencyBlockerSources.length > 0
  ) {
    return `Waiting for ${dependencyBlockerSources
      .map((source) => source.taskId)
      .join(", ")}`;
  }

  return reason.label;
}

function nextActionFallbackLabel(action: QueueNextAction) {
  switch (action) {
    case "run_now":
      return "Run task";
    case "queue_task":
      return "Queue task";
    case "edit_draft":
      return "Edit draft";
    case "validate_readiness":
      return "Check readiness";
    case "assign_worker":
      return "Assign worker";
    case "wait_for_capacity":
      return "Wait for capacity";
    case "resolve_dependency":
      return "Resolve dependency";
    case "resolve_blocker":
      return "Resolve blocker";
    case "review_report":
      return "Review report";
    case "accept_result":
      return "Accept result";
    case "request_changes":
      return "Request changes";
    case "create_follow_up":
      return "Create follow-up";
    case "reject_result":
      return "Reject result";
    case "retry_or_rerun":
      return "Retry or rerun";
    case "close_cancelled":
      return "Close cancelled";
    case "view_history":
      return "View history";
  }
}

function defaultBlockedReasonLabel(code: QueueBlockedReasonCode) {
  switch (code) {
    case "missing_execution_workspace":
      return "Missing execution workspace";
    case "missing_codex_executable":
      return "Missing Codex executable";
    case "queue_disabled":
      return "Queue disabled";
    case "not_ready_lifecycle":
      return "Task is not ready to run";
    case "dependency_open":
      return "Dependency is still open";
    case "dependency_failed_or_rejected":
      return "Dependency failed or was rejected";
    case "dependency_graph_invalid":
      return "Dependency graph is invalid";
    case "capacity_unavailable":
      return "No compatible worker capacity is available";
    case "run_settings_invalid":
      return "Run settings are incomplete";
    case "validation_failed":
      return "Validation failed";
    case "context_missing":
      return "Required context is missing";
    case "context_invalid":
      return "Attached context is blocked";
    case "worker_paused":
      return "Compatible worker is paused";
    case "tag_paused":
      return "Queue tag is paused";
    case "safety_blocker":
      return "Safety review blocks this task";
    case "operator_review_required":
      return "Operator review is required";
    case "runtime_unavailable":
      return "No visible worker runtime is available";
  }
}
