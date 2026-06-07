import type {
  AgentQueueClosureState,
  AgentQueueTask,
} from "../../workspace/types";
import { normalizeCoordinatorStatus, normalizeTaskStatus } from "../agentQueueTaskUiModel";

export type QueueTaskLifecycle =
  | "draft"
  | "queued"
  | "ready"
  | "running"
  | "report_ready"
  | "review_required"
  | "finalized"
  | "blocked"
  | "failed"
  | "cancelled";

export type QueueTaskClosureState =
  | "commit_created"
  | "no_change_accepted"
  | "follow_up_created"
  | "closure_blocked"
  | "rejected"
  | "request_changes";

export function queueV2LifecycleForTask(task: AgentQueueTask): QueueTaskLifecycle {
  const status = normalizeTaskStatus(task.status);
  const closureState = queueV2ClosureStateForTask(task);
  const coordinatorStatus = normalizeCoordinatorStatus(task.coordinatorStatus);
  const hasReviewableOutput = taskHasReviewableOutput(task);

  if (closureState && closureState !== "closure_blocked") {
    return "finalized";
  }

  if (coordinatorStatus === "failed" || status === "failed") {
    return "failed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  if (status === "completed") {
    return coordinatorStatus === "awaiting_validation" ||
      coordinatorStatus === "awaiting_coordinator_review" ||
      coordinatorStatus === "ready_for_finalization" ||
      coordinatorStatus === "worker_reported" ||
      coordinatorStatus === "needs_changes" ||
      coordinatorStatus === "follow_up_required" ||
      coordinatorStatus === "blocked" ||
      coordinatorStatus === "rollback_required" ||
      task.validationStatus === "needs_review" ||
      task.closureState === "closure_required" ||
      task.closureState === "commit_required" ||
      task.closureState === "closure_blocked"
      ? "review_required"
      : "report_ready";
  }

  if (status === "review_needed") {
    return "review_required";
  }

  if (
    coordinatorStatus === "needs_changes" ||
    coordinatorStatus === "follow_up_required" ||
    coordinatorStatus === "rollback_required"
  ) {
    return hasReviewableOutput ? "review_required" : "blocked";
  }

  if (coordinatorStatus === "blocked" || closureState === "closure_blocked") {
    return hasReviewableOutput ? "review_required" : "blocked";
  }

  if (
    hasReviewableOutput &&
    (coordinatorStatus === "awaiting_validation" ||
      coordinatorStatus === "awaiting_coordinator_review" ||
      coordinatorStatus === "ready_for_finalization" ||
      coordinatorStatus === "worker_reported")
  ) {
    return "review_required";
  }

  if (hasReviewableOutput) {
    return task.validationStatus === "needs_review" ||
      task.closureState === "closure_required" ||
      task.closureState === "commit_required"
      ? "review_required"
      : "report_ready";
  }

  return status;
}

export function queueV2ClosureStateForTask(
  task: AgentQueueTask,
): QueueTaskClosureState | null {
  const explicitClosure = mapCurrentClosureState(task.closureState);

  if (explicitClosure) {
    return explicitClosure;
  }

  return null;
}

function mapCurrentClosureState(
  closureState: AgentQueueClosureState | null | undefined,
): QueueTaskClosureState | null {
  switch (closureState) {
    case "commit_created":
    case "no_change_accepted":
    case "follow_up_created":
    case "closure_blocked":
      return closureState;
    case "closure_required":
    case "commit_required":
    default:
      return null;
  }
}

function taskHasReviewableOutput(task: AgentQueueTask) {
  return (
    (task.workerExecutionReports?.length ?? 0) > 0 ||
    task.status === "completed" ||
    task.status === "review_needed"
  );
}
