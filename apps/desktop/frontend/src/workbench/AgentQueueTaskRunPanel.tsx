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
  queueDependencyBlockedSummary,
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
  includeAdvancedDetails?: boolean;
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
  includeAdvancedDetails = true,
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
  const selectedExecutorSlot = executorSlots.find(
    (slot) => slot.widgetInstanceId === currentSelection,
  );
  const selectedExecutorIsQueueOwned =
    selectedExecutorSlot?.ownerKind === "agent_queue";
  const workerScopeMismatch =
    selectedWorker?.scope.kind === "queue_tag" &&
    selectedWorker.scope.queueTagId !== queueTag.queueTagId;
  const workerDisabled = Boolean(selectedWorker && !selectedWorker.enabled);
  const scopedAssignmentDisabled = Boolean(assignDisabled || workerScopeMismatch);
  const workerAssignmentDisabled = Boolean(
    scopedAssignmentDisabled || workerDisabled || selectedExecutorIsQueueOwned,
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
            title="Configure the selected Queue task, then run it explicitly."
          >
            Actions and settings
          </p>
          <p className="agent-queue-run-note">Runs are explicit.</p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge
            variant={selectedTask.assignedExecutorWidgetId ? "info" : "neutral"}
          >
            {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
          </Badge>
        </div>
      </div>

      <div className="agent-queue-execution-group agent-queue-execution-group-nested agent-queue-assignment-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Queue chooses the local executor slot for explicit runs."
            >
              Local executor
            </p>
          </div>
          <Badge variant={hasAssignedExecutor ? "info" : "neutral"}>
            {assignmentLabel(selectedTask.assignedExecutorWidgetId)}
          </Badge>
        </div>
        {run.executorSelectionMessage ? (
          <p className="agent-queue-assignment-note">
            {run.executorSelectionMessage}
          </p>
        ) : null}

        {assignmentDisabledReason ? (
          <p className="agent-queue-assignment-note">
            {assignmentDisabledReason}
          </p>
        ) : null}
        {selectedExecutorIsQueueOwned ? (
          <p className="agent-queue-assignment-note">
            Local executor ready. Queue owns this slot for explicit runs.
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
          <details className="agent-queue-details agent-queue-secondary-details">
            <summary>Advanced executor override</summary>
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
                  disabled={
                    !selectedTask.assignedExecutorWidgetId ||
                    selectedExecutorIsQueueOwned
                  }
                  onClick={() =>
                    openAssignedExecutor(selectedTask.assignedExecutorWidgetId)
                  }
                  title="Scroll to the assigned local executor compatibility surface."
                  variant="ghost"
                >
                  Open compatibility surface
                </Button>
              </div>
            </div>
          </details>
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
        showRunButton={includeAdvancedDetails}
      />

      {includeAdvancedDetails ? (
        <AgentQueueTaskRunAdvancedDetails
          autorun={autorun}
          dependencyState={dependencyState}
          executorSlots={executorSlots}
          executionPlan={executionPlan}
          latestRun={latestRun}
          onAttachContextToCoordinator={onAttachContextToCoordinator}
          onOpenAgentExecutorRun={onOpenAgentExecutorRun}
          queueTag={queueTag}
          queueTagSummary={queueTagSummary}
          routingBlockedLabel={routingBlockedLabel}
          routingState={routingState}
          run={run}
          runHistory={runHistory}
          runner={runner}
          selectedTask={selectedTask}
        />
      ) : null}
    </section>
  );
}

export function AgentQueueTaskRunAdvancedDetails({
  autorun,
  dependencyState,
  executorSlots,
  executionPlan,
  latestRun,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  queueTag,
  queueTagSummary,
  routingBlockedLabel,
  routingState,
  run,
  runHistory,
  runner,
  selectedTask,
}: {
  autorun: AgentQueueAutorunController;
  dependencyState?: AgentQueueDependencyState;
  executorSlots: AgentExecutorSlot[];
  executionPlan: AgentQueueExecutionPlanController;
  latestRun: AgentQueueLatestRunLinkController;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  queueTag: ReturnType<typeof normalizeQueueTag>;
  queueTagSummary?: QueueTagSummary;
  routingBlockedLabel: string | null;
  routingState?: AgentQueueAssignedWorkerRoutingState;
  run: AgentQueueRunController;
  runHistory: AgentQueueRunHistoryController;
  runner: AgentQueueRunnerController;
  selectedTask: AgentQueueTask;
}) {
  const queueTagPaused = queueTagSummary?.status === "paused";
  const validationStatus = normalizeValidationStatus(selectedTask.validationStatus);
  const itemType = normalizeItemType(selectedTask.itemType);

  return (
    <details className="agent-queue-details agent-queue-secondary-details agent-queue-developer-details">
      <summary>Developer details</summary>
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
          <dt>Validation</dt>
          <dd>{validationStatusLabel(validationStatus)}</dd>
        </div>
        <div>
          <dt>Dependency gate</dt>
          <dd>
            {dependencyState && dependencyState.dependsOn.length > 0
              ? queueDependencyBlockedSummary(dependencyState)
              : "No dependencies"}
          </dd>
        </div>
        <div>
          <dt>Execution workspace</dt>
          <dd>{run.repoRootDraft.trim() || "Not set"}</dd>
        </div>
        <div>
          <dt>Codex executable</dt>
          <dd>{run.codexExecutableDraft.trim() || "Not set"}</dd>
        </div>
        <div>
          <dt>Sandbox</dt>
          <dd>{run.sandbox}</dd>
        </div>
        <div>
          <dt>Approval policy</dt>
          <dd>{run.approvalPolicy}</dd>
        </div>
        <div>
          <dt>Readiness</dt>
          <dd>
            {run.readinessMessage ??
              (run.preconditionMessages.join("; ") ||
                "Ready after explicit Run task")}
          </dd>
        </div>
      </dl>

      {run.sandbox === "danger_full_access" ? (
        <p className="agent-queue-run-warning">
          danger_full_access is unsafe and intended only for trusted local
          development. It disables Codex sandbox restrictions. Hobit will still
          not auto-commit, push, reset, clean, stash, roll back changes,
          finalize coordinator review, run validation automatically, or launch
          Git automation.
        </p>
      ) : null}

      <AgentQueueExecutionPlanPanel executionPlan={executionPlan} />

      <AgentQueueRunHistoryPanel
        executorSlots={executorSlots}
        latestRun={latestRun}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onOpenAgentExecutorRun={onOpenAgentExecutorRun}
        runHistory={runHistory}
        selectedTask={selectedTask}
      />

      <AgentQueueSequentialRunnerPanel runner={runner} />

      <AgentQueueAutorunPanel autorun={autorun} />
    </details>
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
