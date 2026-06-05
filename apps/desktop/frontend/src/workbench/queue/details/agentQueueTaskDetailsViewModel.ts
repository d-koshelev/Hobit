import {
  coordinatorStatusBlocksNewWork,
  normalizeValidationStatus,
  statusLabel,
} from "../../agentQueueTaskUiModel";
import { compactNextActionBlocker, isReportReadyStatus } from "./agentQueueTaskDetailsFormatters";
import {
  hasFinishedRunLink,
  hasReviewEvidenceForTask,
} from "./agentQueueTaskDetailsEvidence";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";

export function overviewStateSentence(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
  executorLabel: string,
) {
  const hasEvidence = hasReviewEvidenceForTask(queue, selectedTask);

  switch (selectedTask.status) {
    case "draft":
      return "Draft task. It will not run until the operator promotes it.";
    case "running":
      return `Running. ${executorLabel} is executing this task.`;
    case "completed":
      return hasEvidence
        ? "Execution complete. Result ready."
        : "Execution complete. Result pending.";
    case "failed":
      return hasEvidence
        ? "Execution failed. Result ready."
        : "Execution failed. Result pending.";
    case "cancelled":
      return hasEvidence
        ? "Execution was cancelled. Result ready."
        : "Execution was cancelled. Result pending.";
    case "review_needed":
      return hasEvidence
        ? "Result ready for review."
        : "Review requested. Result pending.";
    case "queued":
    case "ready":
      return `${statusLabel(selectedTask.status)} task. It runs only after an explicit operator action.`;
    default:
      return `${statusLabel(selectedTask.status)} task.`;
  }
}

export function overviewNextStep(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  if (selectedTask.status === "running" || queue.latestRun.link?.status === "running") {
    return "Running - waiting for final response.";
  }

  if (hasReviewEvidenceForTask(queue, selectedTask)) {
    return "Next: review report and make coordinator decision.";
  }

  if (isReportReadyStatus(selectedTask.status) || hasFinishedRunLink(queue)) {
    return "Next: use the result section to refresh the result, attach a report, or inspect Developer details.";
  }

  if (queue.run.canStart) {
    return queue.run.executorSelectionMessage?.startsWith(
      "Local executor selected automatically",
    )
      ? "Next: click Run task when ready."
      : "Next: review settings, then click Run task.";
  }

  if (selectedTask.status === "draft") {
    return "Next: promote to queued.";
  }

  if (
    !selectedTask.assignedExecutorWidgetId &&
    queue.run.executorSelectionMessage
  ) {
    return "Next: local executor selected automatically.";
  }

  if (!selectedTask.assignedExecutorWidgetId) {
    return "Next: local executor unavailable.";
  }

  if (coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)) {
    return "Next: use the result section before making a coordinator decision.";
  }

  if (queue.run.readinessMessage) {
    return `Next: ${compactNextActionBlocker(queue.run.readinessMessage)}`;
  }

  return "Next: check the prompt, settings, and latest activity before acting.";
}

export function autonomousNextActionForSelectedTask(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  const isAutonomousActive =
    queue.autonomous.status === "running" || queue.autonomous.status === "stopping";

  if (!isAutonomousActive) {
    return null;
  }

  if (queue.autonomous.activeQueueItemId === selectedTask.queueItemId) {
    return {
      actions: [],
      badge: "Executing",
      badgeVariant: "info" as const,
      copy: "Autonomous runner started this task. Waiting for final response.",
      secondaryCopy: queue.autonomous.currentStage
        ? `Stage: ${queue.autonomous.currentStage}.`
        : "No per-task Run task click is needed.",
      title: "Running in autonomous queue",
      tone: "waiting",
    };
  }

  if (!selectedTaskIsAutonomousEligible(queue, selectedTask)) {
    return null;
  }

  return {
    actions: [],
    badge: "Autonomous",
    badgeVariant: "info" as const,
    copy: "Autonomous runner will start this task.",
    secondaryCopy: "Manual controls return when the autonomous runner is idle.",
    title: "Queued for autonomous execution",
    tone: "waiting",
  };
}

function selectedTaskIsAutonomousEligible(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  const dependencyState = queue.dependencyStates.get(selectedTask.queueItemId);
  const status = selectedTask.status;

  return (
    (status === "queued" || status === "ready" || status === "review_needed") &&
    selectedTask.prompt.trim().length > 0 &&
    (dependencyState?.status ?? "ready") === "ready" &&
    !coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus) &&
    normalizeValidationStatus(selectedTask.validationStatus) !== "failed" &&
    Boolean(selectedTask.executionWorkspace?.trim()) &&
    Boolean(selectedTask.codexExecutable?.trim()) &&
    Boolean(selectedTask.sandbox) &&
    Boolean(selectedTask.approvalPolicy)
  );
}
