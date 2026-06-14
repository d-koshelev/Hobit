import type {
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../../../workspace/types";
import type { QueueInspectorSnapshot } from "../../../queue/queueV2ViewModel";

export function latestTaskReport(task: AgentQueueTask | null) {
  return task?.workerExecutionReports?.[task.workerExecutionReports.length - 1] ?? null;
}

export function highLevelTaskEvents(
  task: AgentQueueTask | null,
  latestReport: AgentQueueWorkerExecutionReport | null,
) {
  if (!task) {
    return [];
  }

  return [
    `Created ${task.createdAt}`,
    `Current status is ${task.status}`,
    latestReport
      ? `Latest worker report is ${latestReport.reportStatus}: ${latestReport.summary}`
      : "No worker report recorded",
    `Validation is ${validationSummary(task, latestReport)}`,
  ];
}

export function validationSummary(
  task: AgentQueueTask,
  latestReport: AgentQueueWorkerExecutionReport | null,
) {
  return latestReport?.validationResult ?? task.validationStatus ?? "not_started";
}

export function summarizeText(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "No prompt text provided.";
  }

  return normalized.length > 420 ? `${normalized.slice(0, 420)}...` : normalized;
}

export function laneLabel(lane: QueueInspectorSnapshot["boardLane"]) {
  switch (lane) {
    case "intake_draft":
      return "Intake";
    case "ready":
      return "Ready";
    case "running":
      return "Running";
    case "review":
      return "Review";
    case "blocked":
      return "Blocked";
    case "closed":
      return "Closed";
  }
}

export function lifecycleLabel(lifecycle: QueueInspectorSnapshot["lifecycle"]) {
  return lifecycle.replace(/_/g, " ");
}
