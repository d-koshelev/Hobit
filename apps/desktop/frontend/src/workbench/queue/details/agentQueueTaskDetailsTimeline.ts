import {
  queueClosureStateForTask,
  queueClosureStateLabel,
} from "../agentQueueClosureState";
import {
  coordinatorStatusBlocksNewWork,
  coordinatorStatusLabel,
  statusLabel,
} from "../../agentQueueTaskUiModel";
import {
  directWorkEvidenceForQueue,
  hasReviewEvidenceForTask,
  isSelectedTaskRunning,
} from "./agentQueueTaskDetailsEvidence";
import type {
  ActivityDisplayEntry,
  AgentQueueController,
  HumanTimelineEntry,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";

export function activityDisplayEvent(event: {
  id: string;
  severity: "info" | "success" | "warning" | "error";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  summary?: string;
  title: string;
}): ActivityDisplayEntry {
  return {
    badge: activityDisplayBadge(event.status),
    badgeVariant:
      event.status === "failed"
        ? "error"
        : event.status === "completed"
          ? "success"
          : event.severity === "warning"
            ? "warning"
            : event.status === "running"
              ? "info"
              : "neutral",
    key: event.id,
    message: event.summary ?? event.title,
    title: event.title === "Completed run" ? "Run completed" : event.title,
  };
}

export function activityDisplayBadge(
  status: ActivityDisplayEntry["badge"] | string,
) {
  if (status === "completed") {
    return "Done";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "running") {
    return "Running";
  }

  return "Event";
}

export function buildFallbackActivityEvents(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
): ActivityDisplayEntry[] {
  const latestRun = queue.latestRun.link;
  const entries: HumanTimelineEntry[] = [];

  if (latestRun || queue.run.startedRunId || selectedTask.status === "running") {
    entries.push({
      badge: "Started",
      badgeVariant: "info",
      key: "fallback-started",
      message: "Run was started from Queue.",
      title: "Started run",
    });
  }

  if (queue.runActivity.currentStage === "Report ready") {
    entries.push({
      badge: "Complete",
      badgeVariant: "success",
      key: "fallback-completed",
      message: "Final response received.",
      title: "Run completed",
    });
  } else if (isSelectedTaskRunning(queue, selectedTask)) {
    entries.push({
      badge: "Running",
      badgeVariant: "info",
      key: "fallback-running",
      message: "Waiting for final response.",
      title: queue.runActivity.currentStage,
    });
  } else if (
    selectedTask.status === "completed" ||
    selectedTask.status === "review_needed"
  ) {
    entries.push({
      badge: "Complete",
      badgeVariant: "success",
      key: "fallback-task-completed",
      message: "Execution complete. No active run event is selected.",
      title: "Run completed",
    });
  } else if (selectedTask.status === "failed") {
    entries.push({
      badge: "Failed",
      badgeVariant: "error",
      key: "fallback-task-failed",
      message: "Execution failed. No active run event is selected.",
      title: "Run failed",
    });
  } else if (selectedTask.status === "cancelled") {
    entries.push({
      badge: "Cancelled",
      badgeVariant: "warning",
      key: "fallback-task-cancelled",
      message: "Execution was cancelled. No active run event is selected.",
      title: "Run cancelled",
    });
  }

  return entries;
}

export function buildHumanTimeline(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
): HumanTimelineEntry[] {
  const report = queue.workerReport.latestReport;
  const latestRun = queue.latestRun.link;
  const runEvidence = directWorkEvidenceForQueue(queue);
  const entries: HumanTimelineEntry[] = [
    {
      badge: "Created",
      badgeVariant: "neutral",
      key: "created",
      message: "Task was created in this Workspace Queue.",
      time: selectedTask.createdAt,
      title: "Created task",
    },
  ];

  if (selectedTask.status !== "draft") {
    entries.push({
      badge: "Queued",
      badgeVariant: "info",
      key: "queued",
      message: `Task is ${statusLabel(selectedTask.status).toLowerCase()} for explicit operator-controlled work.`,
      time: selectedTask.updatedAt,
      title: "Promoted to queued",
    });
  }

  if (selectedTask.assignedExecutorWidgetId) {
    entries.push({
      badge: "Assigned",
      badgeVariant: "info",
      key: "assigned",
      message:
        selectedTask.status === "running"
          ? "Local executor is running this task."
          : "Local executor selected. Work has not started.",
      time: selectedTask.updatedAt,
      title: "Selected local executor",
    });
  }

  if (latestRun) {
    entries.push({
      badge: "Started",
      badgeVariant: "info",
      key: "run-started",
      message: "An explicit Queue run was started for this task.",
      time: latestRun.startedAt,
      title: "Run started",
    });

    if (latestRun.status === "running") {
      entries.push({
        badge: "Running",
        badgeVariant: "info",
        key: "run-running",
        message: "Running - waiting for final response.",
        time: null,
        title: "Running",
      });
    } else if (latestRun.completedAt) {
      entries.push({
        badge: runTimelineBadge(latestRun.status),
        badgeVariant: runTimelineBadgeVariant(latestRun.status),
        key: "run-finished",
        message: runTimelineMessage(
          latestRun.status,
          Boolean(runEvidence || report),
        ),
        time: latestRun.completedAt,
        title: runTimelineTitle(latestRun.status),
      });
    }
  }

  if (runEvidence) {
    entries.push({
      badge: runEvidence.status === "failed" ? "Error" : "Result",
      badgeVariant: runEvidence.status === "failed" ? "error" : "info",
      key: "direct-work-result",
      message: runEvidence.summary,
      time: latestRun?.completedAt ?? selectedTask.updatedAt,
      title:
        runEvidence.status === "failed"
          ? "Final error"
          : "Final response / result summary",
    });
  }

  if (runEvidence || report) {
    entries.push({
      badge: "Report",
      badgeVariant: runEvidence?.status === "failed" ? "error" : "info",
      key: "report-ready",
      message:
        runEvidence?.status === "failed"
          ? "Failure evidence is ready for coordinator review."
          : "Report ready. Awaiting coordinator review.",
      time: latestRun?.completedAt ?? report?.createdAt ?? selectedTask.updatedAt,
      title: "Report ready",
    });
  }

  if (report?.commandsRun.length) {
    entries.push({
      badge: "Command",
      badgeVariant: "neutral",
      key: "command",
      message:
        report.commandsRun.length === 1
          ? report.commandsRun[0]
          : `${report.commandsRun.length.toString()} commands were reported.`,
      time: report.createdAt,
      title: "Command executed",
    });
  }

  if (report) {
    entries.push({
      badge: "Report",
      badgeVariant: report.reportStatus === "failed" ? "error" : "info",
      key: "report",
      message: report.summary,
      time: report.createdAt,
      title: "Report attached",
    });
  }

  if (queue.diffReview.linkedReviewTasks.length > 0) {
    entries.push({
      badge: "Review",
      badgeVariant: "warning",
      key: "diff-review",
      message: `${queue.diffReview.linkedReviewTasks.length.toString()} diff review item${
        queue.diffReview.linkedReviewTasks.length === 1 ? "" : "s"
      } requested. No review runs automatically.`,
      time: selectedTask.updatedAt,
      title: "Diff review created",
    });
  }

  if (
    hasReviewEvidenceForTask(queue, selectedTask) &&
    selectedTask.coordinatorStatus !== "finalized"
  ) {
    const closureState = queueClosureStateForTask(selectedTask);
    entries.push({
      badge: "Review",
      badgeVariant: "warning",
      key: "coordinator-review-required",
      message: `${queueClosureStateLabel(
        closureState,
      )}. Review report evidence and make an explicit coordinator decision.`,
      time: selectedTask.updatedAt,
      title: "Coordinator review required",
    });
  } else if (
    selectedTask.coordinatorStatus &&
    selectedTask.coordinatorStatus !== "not_reported"
  ) {
    entries.push({
      badge: "Review",
      badgeVariant: coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)
        ? "warning"
        : "success",
      key: "coordinator",
      message: coordinatorStatusLabel(selectedTask.coordinatorStatus),
      time: selectedTask.updatedAt,
      title:
        selectedTask.coordinatorStatus === "finalized"
          ? "Coordinator finalized"
          : "Coordinator review updated",
    });
  }

  return entries;
}

function runTimelineBadge(status: string) {
  if (status === "completed") {
    return "Complete";
  }

  if (status === "running") {
    return "Running";
  }

  return "Failed";
}

function runTimelineTitle(status: string) {
  if (status === "completed" || status === "review_needed") {
    return "Run completed";
  }

  if (status === "cancelled") {
    return "Run cancelled";
  }

  return "Run failed";
}

function runTimelineMessage(status: string, hasEvidence: boolean) {
  if (status === "completed" || status === "review_needed") {
    return hasEvidence
      ? "Execution complete. Evidence is available for coordinator review."
      : "Execution complete. Result is not loaded in Queue yet.";
  }

  if (status === "cancelled") {
    return hasEvidence
      ? "Execution was cancelled. Evidence is available for coordinator review."
      : "Execution was cancelled. Result is not loaded in Queue yet.";
  }

  return hasEvidence
    ? "Execution failed. Review the visible error evidence."
    : "Execution failed. Failure result is not loaded in Queue yet.";
}

function runTimelineBadgeVariant(status: string): HumanTimelineEntry["badgeVariant"] {
  if (status === "completed") {
    return "success";
  }

  if (status === "running") {
    return "info";
  }

  return "error";
}
