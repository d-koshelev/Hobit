import type {
  AgentQueueClosureState,
  AgentQueueCoordinatorStatus,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import type { BadgeVariant } from "../agentQueueFormatting";

type ClosureTask = Pick<
  AgentQueueTask,
  "closureState" | "coordinatorStatus" | "status" | "workerExecutionReports"
>;

export function queueClosureStateForTask(
  task: ClosureTask | null | undefined,
): AgentQueueClosureState | null {
  if (!task) {
    return null;
  }

  if (task.closureState) {
    return task.closureState;
  }

  const latestReport = latestReportForTask(task);
  const coordinatorStatus = task.coordinatorStatus ?? "not_reported";

  if (coordinatorStatus === "finalized") {
    return acceptedClosureState(latestReport);
  }

  if (
    coordinatorStatus === "needs_changes" ||
    coordinatorStatus === "follow_up_required" ||
    coordinatorStatus === "blocked" ||
    coordinatorStatus === "failed" ||
    coordinatorStatus === "rollback_required"
  ) {
    return "closure_blocked";
  }

  if (
    coordinatorStatusRequiresClosure(coordinatorStatus) ||
    task.status === "review_needed" ||
    Boolean(latestReport)
  ) {
    return "closure_required";
  }

  return null;
}

export function closureStateForAcceptingReport(
  task: ClosureTask,
): AgentQueueClosureState {
  return acceptedClosureState(latestReportForTask(task));
}

export function queueClosureStateLabel(
  closureState: AgentQueueClosureState | null | undefined,
) {
  switch (closureState) {
    case "closure_required":
      return "Closure required";
    case "commit_required":
      return "Commit required";
    case "commit_created":
      return "Commit created";
    case "no_change_accepted":
      return "No-change accepted";
    case "follow_up_created":
      return "Follow-up created";
    case "closure_blocked":
      return "Closure blocked";
    default:
      return "No closure state";
  }
}

export function queueClosureStateBadgeVariant(
  closureState: AgentQueueClosureState | null | undefined,
): BadgeVariant {
  switch (closureState) {
    case "commit_created":
    case "no_change_accepted":
    case "follow_up_created":
      return "success";
    case "closure_required":
    case "commit_required":
    case "closure_blocked":
      return "warning";
    default:
      return "neutral";
  }
}

function acceptedClosureState(
  report: AgentQueueWorkerExecutionReport | null,
): AgentQueueClosureState {
  if (report?.commitHash) {
    return "commit_created";
  }

  if ((report?.changedFiles.length ?? 0) > 0) {
    return "commit_required";
  }

  return "no_change_accepted";
}

function coordinatorStatusRequiresClosure(status: AgentQueueCoordinatorStatus) {
  return (
    status === "worker_reported" ||
    status === "awaiting_validation" ||
    status === "awaiting_coordinator_review" ||
    status === "ready_for_finalization"
  );
}

function latestReportForTask(task: ClosureTask) {
  return task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ] ?? null;
}
