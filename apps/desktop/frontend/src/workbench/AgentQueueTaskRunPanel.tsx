import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueTask } from "../workspace/types";
import {
  assignmentLabel,
  coordinatorStatusLabel,
  itemTypeLabel,
  isAssignmentLockedQueueTaskStatus,
  isFinalQueueTaskStatus,
  normalizeItemType,
  normalizeQueueTag,
  normalizeValidationStatus,
  queueTaskPriorityLabel,
  queueDependencyBadgeVariant,
  queueDependencyBlockedSummary,
  queueDependencyStatusLabel,
  statusBadgeVariant,
  statusLabel,
  validationBadgeVariant,
  validationStatusLabel,
  workerLabel,
  type AgentWorkerSummary,
  type AgentQueueDependencyState,
  type QueueGlobalStatus,
  type QueueTagSummary,
} from "./agentQueueTaskUiModel";
import { AgentQueueAutorunPanel } from "./AgentQueueAutorunPanel";
import { AgentQueueExecutionPlanPanel } from "./AgentQueueExecutionPlanPanel";
import { AgentQueueRunHistoryPanel } from "./AgentQueueRunHistoryPanel";
import { AgentQueueRunReadinessPanel } from "./AgentQueueRunReadinessPanel";
import { AgentQueueSequentialRunnerPanel } from "./AgentQueueSequentialRunnerPanel";
import type {
  AgentQueueAutorunController,
  AgentQueueExecutionPlanController,
  AgentQueueLatestRunLinkController,
  AgentQueueRunController,
  AgentQueueRunHistoryController,
  AgentQueueRunnerController,
} from "./queue/useAgentQueueController";
import {
  firstRoutingBlockedReasonLabel,
  type AgentQueueAssignedWorkerRoutingState,
} from "./queue/agentQueueRoutingModel";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "./types";

type AgentQueueTaskRunPanelProps = {
  apiAvailable: boolean;
  assignmentError: string | null;
  assignmentMessage: string | null;
  autorun: AgentQueueAutorunController;
  currentSelection: string;
  dependencyState?: AgentQueueDependencyState;
  executorSlots: AgentExecutorSlot[];
  executionPlan: AgentQueueExecutionPlanController;
  hasExecutorSlots: boolean;
  globalExecutionState: QueueGlobalStatus;
  inputId: string;
  isAssigning: boolean;
  isDirty: boolean;
  latestRun: AgentQueueLatestRunLinkController;
  onAssign: () => void;
  onClear: () => void;
  onPromoteDraftToQueued: () => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onSelectionChange: (executorWidgetInstanceId: string) => void;
  onStartWorkers: () => void;
  canPromoteDraftToQueued: boolean;
  run: AgentQueueRunController;
  runHistory: AgentQueueRunHistoryController;
  runner: AgentQueueRunnerController;
  routingState?: AgentQueueAssignedWorkerRoutingState;
  selectedTask: AgentQueueTask;
  queueTags: QueueTagSummary[];
  workers: AgentWorkerSummary[];
};

export function AgentQueueTaskRunPanel({
  apiAvailable,
  assignmentError,
  assignmentMessage,
  autorun,
  currentSelection,
  dependencyState,
  executorSlots,
  executionPlan,
  hasExecutorSlots,
  globalExecutionState,
  inputId,
  isAssigning,
  isDirty,
  latestRun,
  onAssign,
  onClear,
  onPromoteDraftToQueued,
  onOpenAgentExecutorRun,
  onAttachContextToCoordinator,
  onSelectionChange,
  onStartWorkers,
  canPromoteDraftToQueued,
  run,
  runHistory,
  runner,
  routingState,
  selectedTask,
  queueTags,
  workers,
}: AgentQueueTaskRunPanelProps) {
  const hasAssignedExecutor = Boolean(selectedTask.assignedExecutorWidgetId);
  const queueTag = normalizeQueueTag(selectedTask);
  const queueTagSummary = queueTags.find(
    (tag) => tag.queueTagId === queueTag.queueTagId,
  );
  const queueTagPaused = queueTagSummary?.status === "paused";
  const validationStatus = normalizeValidationStatus(selectedTask.validationStatus);
  const itemType = normalizeItemType(selectedTask.itemType);
  const isFinalStatus = isFinalQueueTaskStatus(selectedTask.status);
  const isAssignmentLockedStatus = isAssignmentLockedQueueTaskStatus(
    selectedTask.status,
  );
  const routingBlockedLabel =
    routingState && !routingState.canTake
      ? firstRoutingBlockedReasonLabel(routingState.blockedReasons)
      : null;
  const assignmentDisabledReason = assignmentControlMessage({
    apiAvailable,
    hasExecutorSlots,
    isDirty,
    isFinalStatus,
    isRunningStatus: selectedTask.status === "running",
  });
  const assignDisabled = Boolean(
    assignmentDisabledReason ||
      isAssigning ||
      !hasExecutorSlots ||
      !currentSelection,
  );
  const clearDisabled = Boolean(
    assignmentDisabledReason || isAssigning || !hasAssignedExecutor,
  );
  const selectedWorker = workers.find(
    (worker) => worker.workerId === currentSelection,
  );
  const workerScopeMismatch =
    selectedWorker?.scope.kind === "queue_tag" &&
    selectedWorker.scope.queueTagId !== queueTag.queueTagId;
  const workerDisabled = Boolean(selectedWorker && !selectedWorker.enabled);
  const scopedAssignmentDisabled = Boolean(assignDisabled || workerScopeMismatch);
  const workerAssignmentDisabled = Boolean(
    scopedAssignmentDisabled || workerDisabled,
  );

  return (
    <section
      aria-label="Queue task execution"
      className="agent-queue-execution-section"
    >
      <div className="agent-queue-execution-header">
        <div>
          <p
            className="agent-queue-execution-title"
            title="Select an Agent Executor, configure Direct Work, then run the task."
          >
            Execution
          </p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge
            variant={selectedTask.assignedExecutorWidgetId ? "info" : "neutral"}
          >
            {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
          </Badge>
          <Badge variant={statusBadgeVariant(selectedTask.status)}>
            {statusLabel(selectedTask.status)}
          </Badge>
          {queueTagPaused ? <Badge variant="warning">Tag paused</Badge> : null}
          {dependencyState && dependencyState.dependsOn.length > 0 ? (
            <Badge variant={queueDependencyBadgeVariant(dependencyState.status)}>
              {queueDependencyStatusLabel(dependencyState.status)}
            </Badge>
          ) : null}
          <Badge
            className={
              validationStatus === "validating"
                ? "agent-queue-validation-animating"
                : undefined
            }
            variant={validationBadgeVariant(validationStatus)}
          >
            {validationStatusLabel(validationStatus)}
          </Badge>
        </div>
      </div>

      <dl className="agent-queue-item-foundation-facts">
        <div>
          <dt>Queue tag</dt>
          <dd>
            {queueTag.queueTagName}
            {queueTagPaused ? " (paused)" : ""}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{queueTaskPriorityLabel(selectedTask.priority)}</dd>
        </div>
        <div>
          <dt>Tag gate</dt>
          <dd>
            {queueTagPaused
              ? tagPauseDetail(queueTagSummary?.pauseReason)
              : "Active"}
          </dd>
        </div>
        <div>
          <dt>Item type</dt>
          <dd>{itemTypeLabel(itemType)}</dd>
        </div>
        <div>
          <dt>Assigned worker</dt>
          <dd>
            {workerLabel(
              selectedTask.assignedWorkerId ??
                selectedTask.assignedExecutorWidgetId,
            )}
          </dd>
        </div>
        <div>
          <dt>Worker route</dt>
          <dd>
            {routingState?.assignedWorker
              ? routingState.canTake
                ? "Eligible"
                : routingBlockedLabel ?? "Blocked"
              : selectedTask.assignedExecutorWidgetId
                ? routingBlockedLabel ?? "Assigned worker unavailable"
                : "Unassigned"}
          </dd>
        </div>
        <div>
          <dt>Coordinator</dt>
          <dd>{coordinatorStatusLabel(selectedTask.coordinatorStatus)}</dd>
        </div>
        <div>
          <dt>Dependency gate</dt>
          <dd>
            {dependencyState && dependencyState.dependsOn.length > 0
              ? queueDependencyBlockedSummary(dependencyState)
              : "No dependencies"}
          </dd>
        </div>
      </dl>

      <AgentQueueExecutionPlanPanel executionPlan={executionPlan} />

      <AgentQueueRunHistoryPanel
        executorSlots={executorSlots}
        latestRun={latestRun}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onOpenAgentExecutorRun={onOpenAgentExecutorRun}
        runHistory={runHistory}
        selectedTask={selectedTask}
      />

      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Assignment chooses the Agent Executor slot. It does not start work."
            >
              Executor
            </p>
          </div>
          <Badge variant={hasAssignedExecutor ? "info" : "neutral"}>
            {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
          </Badge>
        </div>

        {!hasExecutorSlots ? (
          <div className="agent-queue-attention-message" role="alert">
            <p className="agent-queue-attention-title">
              No Agent Executor available
            </p>
            <p className="agent-queue-attention-copy">
              Add an Agent Executor widget to run Queue tasks.
            </p>
          </div>
        ) : null}

        {assignmentDisabledReason ? (
          <p className="agent-queue-assignment-note">
            {assignmentDisabledReason}
          </p>
        ) : null}

        {workerScopeMismatch && selectedWorker?.scope.kind === "queue_tag" ? (
          <p className="agent-queue-run-warning" role="alert">
            Selected worker is scoped to {selectedWorker.scope.queueTagName}.
            Assign a worker scoped to {queueTag.queueTagName} or All queues.
          </p>
        ) : null}
        {workerDisabled ? (
          <p className="agent-queue-run-warning" role="alert">
            Selected worker is disabled. Enable it before assigning new work.
          </p>
        ) : null}

        {hasExecutorSlots ? (
          <div className="agent-queue-assignment-controls">
            <div className="agent-queue-assignment-field">
              <label className="field-label" htmlFor={inputId}>
                Worker / Executor
              </label>
              <select
                className="input agent-queue-assignment-select"
                disabled={
                  !apiAvailable ||
                  isDirty ||
                  isAssignmentLockedStatus ||
                  isAssigning
                }
                id={inputId}
                onChange={(event) =>
                  onSelectionChange(event.currentTarget.value)
                }
                value={currentSelection}
              >
                {executorSlots.map((slot) => (
                  <option
                    key={slot.widgetInstanceId}
                    value={slot.widgetInstanceId}
                  >
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="agent-queue-assignment-buttons">
              <Button
                disabled={workerAssignmentDisabled}
                onClick={() => onAssign()}
                variant="secondary"
              >
                {isAssigning ? "Assigning" : "Assign"}
              </Button>
              {hasAssignedExecutor ? (
                <Button
                  disabled={clearDisabled}
                  onClick={() => onClear()}
                  variant="ghost"
                >
                  Clear
                </Button>
              ) : null}
              <Button
                disabled={!selectedTask.assignedExecutorWidgetId}
                onClick={() =>
                  openAssignedExecutor(selectedTask.assignedExecutorWidgetId)
                }
                title="Scroll to the assigned Agent Executor for live logs and result."
                variant="ghost"
              >
                Open Executor
              </Button>
            </div>
          </div>
        ) : hasAssignedExecutor ? (
          <div className="agent-queue-assignment-buttons">
            <Button
              disabled={clearDisabled}
              onClick={() => onClear()}
              variant="ghost"
            >
              Clear assignment
            </Button>
          </div>
        ) : null}

        {assignmentMessage ? (
          <p className="agent-queue-message agent-queue-message-success">
            {assignmentMessage}
          </p>
        ) : null}
        {assignmentError ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {assignmentError}
          </p>
        ) : null}
      </div>

      <AgentQueueRunReadinessPanel
        canAssignSelectedWorker={!workerAssignmentDisabled}
        canPromoteDraftToQueued={canPromoteDraftToQueued}
        currentSelection={currentSelection}
        executorSlots={executorSlots}
        globalExecutionState={globalExecutionState}
        hasExecutorSlots={hasExecutorSlots}
        isAssigning={isAssigning}
        onAssignSelectedWorker={onAssign}
        onPromoteDraftToQueued={onPromoteDraftToQueued}
        onStartWorkers={onStartWorkers}
        routingState={routingState}
        run={run}
        selectedTask={selectedTask}
        selectedWorker={selectedWorker}
      />

      <AgentQueueSequentialRunnerPanel runner={runner} />

      <AgentQueueAutorunPanel autorun={autorun} />
    </section>
  );
}

function openAssignedExecutor(assignedExecutorWidgetId: string | null) {
  if (!assignedExecutorWidgetId || typeof document === "undefined") {
    return;
  }

  const target = Array.from(
    document.querySelectorAll<HTMLElement>("[data-widget-instance-id]"),
  ).find(
    (element) => element.dataset.widgetInstanceId === assignedExecutorWidgetId,
  );

  target?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
  });
}

function tagPauseDetail(reason: string | null | undefined) {
  switch (reason) {
    case "edit_review":
      return "Paused for task edit review";
    case "manual":
      return "Paused manually";
    default:
      return "Paused";
  }
}

function assignmentControlMessage({
  hasExecutorSlots,
  apiAvailable,
  isDirty,
  isFinalStatus,
  isRunningStatus,
}: {
  apiAvailable: boolean;
  hasExecutorSlots: boolean;
  isDirty: boolean;
  isFinalStatus: boolean;
  isRunningStatus: boolean;
}) {
  if (!apiAvailable) {
    return "Assignment persistence is not available in this runtime.";
  }

  if (isDirty) {
    return "Save task edits before changing assignment.";
  }

  if (isFinalStatus) {
    return "Assignment is locked for final-status tasks.";
  }

  if (isRunningStatus) {
    return "Assignment locked: task is running.";
  }

  if (!hasExecutorSlots) {
    return null;
  }

  return null;
}
