import { Badge } from "../../../design-system/Badge";
import {
  coordinatorStatusBadgeVariant,
  coordinatorStatusLabel,
  displayTaskTitle,
  normalizeQueueTag,
  normalizeValidationStatus,
  queueExecutorInfoForTask,
  queueTaskPriorityLabel,
  statusBadgeVariant,
  validationStatusLabel,
} from "../../agentQueueTaskUiModel";
import {
  hasReviewEvidenceForTask,
  isSelectedTaskRunning,
  latestReportLabel,
} from "./agentQueueTaskDetailsEvidence";
import {
  diffReviewHeaderLabel,
  selectedTaskStatusRailLabel,
} from "./agentQueueTaskDetailsFormatters";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";
import {
  overviewNextStep,
  overviewStateSentence,
} from "./agentQueueTaskDetailsViewModel";

export function AgentQueueTaskOverviewSection({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
}) {
  const queueTag = normalizeQueueTag(selectedTask);
  const validationStatus = normalizeValidationStatus(
    selectedTask.validationStatus,
  );
  const dependencyState = queue.dependencyStates.get(selectedTask.queueItemId);
  const routingState = queue.assignedWorkerRoutingStates.get(
    selectedTask.queueItemId,
  );
  const executorInfo = queueExecutorInfoForTask({
    dependencyState,
    routingState,
    task: selectedTask,
  });
  const isRunning = isSelectedTaskRunning(queue, selectedTask);

  return (
    <section
      aria-label="Selected task overview"
      className="agent-queue-expanded-header agent-queue-overview"
    >
      <div className="agent-queue-expanded-heading">
        <div>
          <p className="agent-queue-expanded-kicker">Overview</p>
          <h3>{displayTaskTitle(selectedTask)}</h3>
          <p className="agent-queue-overview-state">
            {isRunning
              ? "Agent is working on this task."
              : overviewStateSentence(queue, selectedTask, executorInfo.label)}
          </p>
        </div>
        {isRunning ? null : (
          <div
            className={[
              "agent-queue-executor-info-box",
              "agent-queue-executor-info-large",
              `agent-queue-executor-info-${executorInfo.tone}`,
            ].join(" ")}
            title={executorInfo.detail}
          >
            <span>Executor</span>
            <strong>{executorInfo.label}</strong>
          </div>
        )}
      </div>

      <div className="agent-queue-expanded-badges">
        <Badge variant={statusBadgeVariant(selectedTask.status)}>
          {isRunning ? "Running" : selectedTaskStatusRailLabel(selectedTask)}
        </Badge>
        {isRunning ? (
          <Badge variant="info">{queue.runActivity.currentStage}</Badge>
        ) : (
          <>
            <Badge variant="neutral">{queueTag.queueTagName}</Badge>
            <Badge variant="neutral">
              Priority {queueTaskPriorityLabel(selectedTask.priority)}
            </Badge>
            {queue.ordering.orderLabel ? (
              <Badge variant="neutral">Order {queue.ordering.orderLabel}</Badge>
            ) : null}
          </>
        )}
        {!isRunning &&
        selectedTask.coordinatorStatus &&
        selectedTask.coordinatorStatus !== "not_reported" &&
        hasReviewEvidenceForTask(queue, selectedTask) ? (
          <Badge variant={coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus)}>
            {coordinatorStatusLabel(selectedTask.coordinatorStatus)}
          </Badge>
        ) : !isRunning && hasReviewEvidenceForTask(queue, selectedTask) ? (
          <Badge variant="warning">
            Awaiting coordinator review
          </Badge>
        ) : null}
      </div>

      {isRunning ? (
        <p className="agent-queue-overview-next">
          Current stage: {queue.runActivity.currentStage}.
        </p>
      ) : (
        <>
          <p className="agent-queue-overview-next">
            {overviewNextStep(queue, selectedTask)}
          </p>
          <div className="agent-queue-overview-secondary">
            <span>{executorInfo.label}</span>
            {latestReportLabel(queue, selectedTask) !== "No worker report" ? (
              <span>{latestReportLabel(queue, selectedTask)}</span>
            ) : null}
            {validationStatus !== "not_started" ? (
              <span>{validationStatusLabel(validationStatus)}</span>
            ) : null}
            {diffReviewHeaderLabel(queue, selectedTask) !== "Not requested" ? (
              <span>{diffReviewHeaderLabel(queue, selectedTask)}</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
