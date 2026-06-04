import type { AgentQueueTask } from "../../workspace/types";
import {
  normalizeTaskStatus,
  normalizeValidationStatus,
} from "../agentQueueTaskUiModel";

export function isRunReadinessBlocker(message: string) {
  return /Local executor is already running another task|Local executor unavailable/i.test(
    message,
  );
}

export function taskHasReportReadyState(task: AgentQueueTask) {
  const coordinatorStatus = task.coordinatorStatus ?? "not_reported";

  return (
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "ready_for_finalization" ||
    coordinatorStatus === "finalized" ||
    (task.workerExecutionReports?.length ?? 0) > 0 ||
    normalizeValidationStatus(task.validationStatus) === "needs_review"
  );
}

export function taskReleasesAutonomousRunner(task: AgentQueueTask) {
  const status = normalizeTaskStatus(task.status);
  const coordinatorStatus = task.coordinatorStatus ?? "not_reported";

  return (
    status === "completed" ||
    status === "review_needed" ||
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "ready_for_finalization" ||
    coordinatorStatus === "finalized" ||
    coordinatorStatus === "needs_changes" ||
    coordinatorStatus === "follow_up_required" ||
    coordinatorStatus === "blocked" ||
    coordinatorStatus === "rollback_required"
  );
}

export function autonomousQueueStateSignature(tasks: AgentQueueTask[]) {
  return tasks
    .map((task) =>
      [
        task.queueItemId,
        task.status,
        task.coordinatorStatus ?? "not_reported",
        task.validationStatus ?? "not_started",
        (task.workerExecutionReports?.length ?? 0).toString(),
        (task.dependsOn ?? []).join(","),
      ].join(":"),
    )
    .join("|");
}
