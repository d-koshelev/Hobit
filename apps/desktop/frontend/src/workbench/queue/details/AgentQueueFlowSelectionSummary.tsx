import { Badge } from "../../../design-system/Badge";
import {
  coordinatorStatusBadgeVariant,
  coordinatorStatusLabel,
  displayTaskTitle,
  normalizeQueueTag,
  normalizeValidationStatus,
  queueExecutorInfoBadgeVariant,
  queueExecutorInfoForTask,
  statusBadgeVariant,
  statusLabel,
  validationBadgeVariant,
  validationStatusLabel,
} from "../../agentQueueTaskUiModel";
import { latestReportLabel } from "./agentQueueTaskDetailsEvidence";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";

export function AgentQueueFlowSelectionSummary({
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

  return (
    <div className="agent-queue-flow-selection-summary">
      <div className="agent-queue-flow-selection-heading">
        <p className="agent-queue-expanded-kicker">Selected block</p>
        <h3>{displayTaskTitle(selectedTask)}</h3>
      </div>
      <div className="agent-queue-expanded-badges">
        <Badge variant="neutral">{queueTag.queueTagName}</Badge>
        <Badge variant={statusBadgeVariant(selectedTask.status)}>
          {statusLabel(selectedTask.status)}
        </Badge>
        <Badge variant={queueExecutorInfoBadgeVariant(executorInfo.tone)}>
          {executorInfo.label}
        </Badge>
        <Badge variant={validationBadgeVariant(validationStatus)}>
          {validationStatusLabel(validationStatus)}
        </Badge>
        <Badge variant={coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus)}>
          {coordinatorStatusLabel(selectedTask.coordinatorStatus)}
        </Badge>
      </div>
      <dl className="agent-queue-flow-selection-facts">
        <div>
          <dt>Worker</dt>
          <dd>{routingState?.assignedWorker?.name ?? executorInfo.label}</dd>
        </div>
        <div>
          <dt>Report</dt>
          <dd>{latestReportLabel(queue, selectedTask)}</dd>
        </div>
        <div>
          <dt>Dependencies</dt>
          <dd>{dependencyState?.status ?? "ready"}</dd>
        </div>
      </dl>
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Prompt preview</summary>
        <pre className="agent-queue-flow-selection-prompt">
          {selectedTask.prompt.trim() || "No prompt has been written for this task."}
        </pre>
      </details>
      <details className="agent-queue-details agent-queue-rail-details">
        <summary>Flow-mode boundary</summary>
        <p className="agent-queue-run-note">
          Flow Map blocks select Queue items. Execution, edits, reports, and
          finalization remain explicit.
        </p>
      </details>
    </div>
  );
}
