import type { QueueTaskLifecycle } from "./queueV2LifecycleModel";

export type QueueNextAction =
  | "edit_draft"
  | "queue_task"
  | "validate_readiness"
  | "run_now"
  | "assign_worker"
  | "wait_for_capacity"
  | "resolve_dependency"
  | "resolve_blocker"
  | "review_report"
  | "accept_result"
  | "request_changes"
  | "create_follow_up"
  | "reject_result"
  | "retry_or_rerun"
  | "close_cancelled"
  | "view_history";

export type QueueV2NextActionInput = {
  blockedReasonCodes: readonly string[];
  canQueueDraft?: boolean;
  eligibleNow: boolean;
  hasAssignedWorker: boolean;
  hasReviewableOutput: boolean;
  lifecycle: QueueTaskLifecycle;
  reviewActionHint?: "request_changes" | "create_follow_up" | null;
};

export const QUEUE_V2_NEXT_ACTION_LABELS: Record<QueueNextAction, string> = {
  accept_result: "Accept result",
  assign_worker: "Assign worker",
  close_cancelled: "Close cancelled",
  create_follow_up: "Create follow-up",
  edit_draft: "Edit draft",
  queue_task: "Queue task",
  reject_result: "Reject result",
  request_changes: "Request changes",
  resolve_blocker: "Resolve blocker",
  resolve_dependency: "Resolve dependency",
  retry_or_rerun: "Retry or rerun",
  review_report: "Review report",
  run_now: "Run now",
  validate_readiness: "Check readiness",
  view_history: "View history",
  wait_for_capacity: "Wait for capacity",
};

export function queueV2NextActionLabel(action: QueueNextAction) {
  return QUEUE_V2_NEXT_ACTION_LABELS[action];
}

export function queueV2NextActionForTask({
  blockedReasonCodes,
  canQueueDraft = false,
  eligibleNow,
  hasAssignedWorker,
  hasReviewableOutput,
  lifecycle,
  reviewActionHint = null,
}: QueueV2NextActionInput): QueueNextAction {
  if (blockedReasonCodes.includes("dependency_open")) {
    return "resolve_dependency";
  }

  if (lifecycle === "draft") {
    return canQueueDraft ? "queue_task" : "edit_draft";
  }

  if (eligibleNow) {
    return "run_now";
  }

  if (lifecycle === "queued" || lifecycle === "ready") {
    if (
      blockedReasonCodes.includes("capacity_unavailable") ||
      blockedReasonCodes.includes("runtime_unavailable") ||
      blockedReasonCodes.includes("worker_paused") ||
      blockedReasonCodes.includes("tag_paused")
    ) {
      return hasAssignedWorker ? "wait_for_capacity" : "assign_worker";
    }

    return blockedReasonCodes.length > 0
      ? "resolve_blocker"
      : "validate_readiness";
  }

  if (lifecycle === "running") {
    return "view_history";
  }

  if (lifecycle === "report_ready" || lifecycle === "review_required") {
    return reviewActionHint ?? "review_report";
  }

  if (lifecycle === "failed") {
    return hasReviewableOutput ? "review_report" : "retry_or_rerun";
  }

  if (lifecycle === "cancelled") {
    return hasReviewableOutput ? "review_report" : "close_cancelled";
  }

  if (lifecycle === "finalized") {
    return "view_history";
  }

  if (blockedReasonCodes.includes("dependency_open")) {
    return "resolve_dependency";
  }

  return "resolve_blocker";
}
