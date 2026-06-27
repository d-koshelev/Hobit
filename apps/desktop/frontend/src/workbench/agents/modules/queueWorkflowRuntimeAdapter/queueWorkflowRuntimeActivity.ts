import type {
  AgentQueueWorkflowRunnerReportRecordResult,
} from "../../../../workspace/types";
import type {
  QueueWorkflowRunnerRuntimePhase,
  QueueWorkflowRunnerRuntimeStatus,
} from "./queueWorkflowRuntimeAdapterTypes";
import type {
  QueueWorkflowRunnerResult,
} from "../queueWorkflowRunner";

export function runtimeStatusFromRunner(
  status: QueueWorkflowRunnerResult["status"],
): QueueWorkflowRunnerRuntimeStatus {
  if (
    status === "completed" ||
    status === "review_acknowledged" ||
    status === "review_completed" ||
    status === "finalization_already_done" ||
    status === "finalization_already_failed" ||
    status === "finalization_completed"
  ) {
    return "completed";
  }

  if (
    status === "paused" ||
    status === "awaiting_worker_completion" ||
    status === "awaiting_review" ||
    status === "evidence_recorded" ||
    status === "evidence_already_recorded" ||
    status === "worker_running" ||
    status === "finalization_needs_confirmation"
  ) {
    return "paused";
  }

  if (status === "invalid_request" || status === "finalization_invalid_input") {
    return "invalid_request";
  }

  if (status === "unavailable") return "unavailable";

  if (
    status === "failed_unexpected" ||
    status === "finalization_failed_unexpected"
  ) {
    return "failed_unexpected";
  }

  if (
    status === "review_not_supported_for_workflow" ||
    status === "finalization_not_supported_for_workflow"
  ) {
    return "unsupported";
  }

  return "blocked";
}

export function phasesExecuted(
  runnerResult: QueueWorkflowRunnerResult,
  selectedPhase: QueueWorkflowRunnerRuntimePhase,
): readonly string[] {
  const phases = [
    selectedPhase,
    ...runnerResult.steps.map((step) => step.phase),
  ].filter((phase): phase is NonNullable<typeof phase> => phase !== undefined);
  return [...new Set(phases)];
}

export function blockersFromRecordResult(
  result: AgentQueueWorkflowRunnerReportRecordResult,
): string[] {
  return [
    result.blocker?.blockerMessage,
    result.conflict?.conflictMessage,
  ].filter((message): message is string => Boolean(message));
}

export function persistedRunStatusFromRunner(
  runtimeStatus: QueueWorkflowRunnerRuntimeStatus,
) {
  if (runtimeStatus === "failed_unexpected") return "failed";
  if (
    runtimeStatus === "blocked" ||
    runtimeStatus === "invalid_request" ||
    runtimeStatus === "unavailable" ||
    runtimeStatus === "unsupported"
  ) {
    return "blocked";
  }
  return "paused";
}

export function currentStepForRunnerResult(
  phase: QueueWorkflowRunnerRuntimePhase,
  runtimeStatus: QueueWorkflowRunnerRuntimeStatus,
) {
  if (phase === "create_setup_start" && runtimeStatus === "paused") {
    return "awaiting_worker_completion";
  }
  if (phase === "worker_evidence" && runtimeStatus === "paused") {
    return "awaiting_review";
  }
  if (runtimeStatus === "failed_unexpected") return `${phase}_failed_unexpected`;
  if (runtimeStatus === "blocked") return `${phase}_blocked`;
  if (phase === "review" && runtimeStatus === "completed") return "review_ack";
  if (phase === "read" && runtimeStatus === "completed") return "read_complete";
  return `${phase}_${runtimeStatus}`;
}

export function pauseReasonForRunnerResult(
  phase: QueueWorkflowRunnerRuntimePhase,
  runnerResult: QueueWorkflowRunnerResult,
) {
  if (
    phase === "create_setup_start" &&
    (runnerResult.status === "awaiting_worker_completion" ||
      runnerResult.status === "worker_running")
  ) {
    return "awaiting_worker_completion";
  }
  if (phase === "worker_evidence" && runnerResult.status === "awaiting_review") {
    return "awaiting_review";
  }

  return "awaiting_next_typed_workflow_request";
}
