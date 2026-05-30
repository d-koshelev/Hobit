import { useId } from "react";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import { Input } from "../design-system/Input";
import type {
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../workspace/types";
import {
  assignmentLabel,
  displayTaskTitle,
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
  shortWidgetInstanceId,
  statusBadgeVariant,
  statusLabel,
  validationBadgeVariant,
  validationStatusLabel,
  workerLabel,
  type AgentWorkerSummary,
  type AgentQueueDependencyState,
  type QueueTagSummary,
} from "./agentQueueTaskUiModel";
import { AgentQueueAutorunPanel } from "./AgentQueueAutorunPanel";
import type {
  AgentQueueAutorunController,
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
  hasExecutorSlots: boolean;
  inputId: string;
  isAssigning: boolean;
  isDirty: boolean;
  latestRun: AgentQueueLatestRunLinkController;
  onAssign: () => void;
  onClear: () => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onSelectionChange: (executorWidgetInstanceId: string) => void;
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
  hasExecutorSlots,
  inputId,
  isAssigning,
  isDirty,
  latestRun,
  onAssign,
  onClear,
  onOpenAgentExecutorRun,
  onAttachContextToCoordinator,
  onSelectionChange,
  run,
  runHistory,
  runner,
  routingState,
  selectedTask,
  queueTags,
  workers,
}: AgentQueueTaskRunPanelProps) {
  const repoRootInputId = useId();
  const codexExecutableInputId = useId();
  const sandboxInputId = useId();
  const approvalPolicyInputId = useId();
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

      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Shows recent safe run-link metadata for this Queue task."
            >
              Run history
            </p>
          </div>
          <div className="agent-queue-execution-badges">
            <Badge variant={runHistory.totalCount > 0 ? "info" : "neutral"}>
              {runHistory.totalCount > 0
                ? totalRunsLabel(runHistory.totalCount)
                : "none"}
            </Badge>
          </div>
        </div>

        {!runHistory.apiAvailable ? (
          <p className="agent-queue-run-note">
            Run history metadata is only available in the Tauri desktop shell.
          </p>
        ) : runHistory.isLoading ? (
          <p className="agent-queue-run-note">Loading run history.</p>
        ) : runHistory.error ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {runHistory.error}
          </p>
        ) : runHistory.links.length > 0 ? (
          <RunHistorySummary
            executorSlots={executorSlots}
            links={runHistory.links}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onRefresh={runHistory.onRefresh}
            selectedTask={selectedTask}
            totalCount={runHistory.totalCount}
          />
        ) : (
          <div className="agent-queue-run-empty-state">
            <p className="agent-queue-run-note">No runs yet.</p>
            <Button onClick={() => runHistory.onRefresh()} variant="ghost">
              Refresh
            </Button>
          </div>
        )}
      </div>

      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Shows safe metadata for the newest Executor run linked to this Queue task."
            >
              Latest run
            </p>
          </div>
          <div className="agent-queue-execution-badges">
            <Badge
              variant={
                latestRun.link
                  ? runStatusBadgeVariant(latestRun.link.status)
                  : "neutral"
              }
            >
              {latestRun.link ? runStatusLabel(latestRun.link.status) : "none"}
            </Badge>
          </div>
        </div>

        {!latestRun.apiAvailable ? (
          <p className="agent-queue-run-note">
            Latest run metadata is only available in the Tauri desktop shell.
          </p>
        ) : latestRun.isLoading ? (
          <p className="agent-queue-run-note">Loading latest run.</p>
        ) : latestRun.error ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {latestRun.error}
          </p>
        ) : latestRun.link ? (
          <LatestRunSummary
            executorSlots={executorSlots}
            link={latestRun.link}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onRefresh={latestRun.onRefresh}
            selectedTask={selectedTask}
          />
        ) : (
          <div className="agent-queue-run-empty-state">
            <p className="agent-queue-run-note">No runs yet.</p>
            <Button onClick={() => latestRun.onRefresh()} variant="ghost">
              Refresh
            </Button>
          </div>
        )}
      </div>

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

      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Starts only the selected task in the assigned Agent Executor."
            >
              Run selected task
            </p>
          </div>
        </div>

        {run.readinessMessage ? (
          <p className="agent-queue-run-note">{run.readinessMessage}</p>
        ) : null}

        <div className="agent-queue-run-controls">
          <div className="agent-queue-run-field agent-queue-run-field-wide">
            <label
              className="field-label"
              htmlFor={repoRootInputId}
              title="Use an existing repository or local project folder."
            >
              Execution workspace
            </label>
            <Input
              autoComplete="off"
              id={repoRootInputId}
              onChange={(event) => {
                run.onRepoRootDraftChange(event.currentTarget.value);
              }}
              placeholder="C:\\path\\to\\repo-or-project"
              spellCheck={false}
              type="text"
              value={run.repoRootDraft}
            />
          </div>

          <div className="agent-queue-run-field agent-queue-run-field-wide">
            <label className="field-label" htmlFor={codexExecutableInputId}>
              Codex executable
            </label>
            <Input
              autoComplete="off"
              id={codexExecutableInputId}
              onChange={(event) => {
                run.onCodexExecutableDraftChange(event.currentTarget.value);
              }}
              spellCheck={false}
              type="text"
              value={run.codexExecutableDraft}
            />
          </div>

          <div className="agent-queue-run-field">
            <label className="field-label" htmlFor={sandboxInputId}>
              Sandbox
            </label>
            <select
              className="input agent-queue-run-select"
              id={sandboxInputId}
              onChange={(event) =>
                run.onSandboxChange(
                  event.currentTarget.value as DirectWorkSandbox,
                )
              }
              value={run.sandbox}
            >
              <option value="read_only">read_only</option>
              <option value="workspace_write">workspace_write</option>
            </select>
          </div>

          <div className="agent-queue-run-field">
            <label className="field-label" htmlFor={approvalPolicyInputId}>
              Approval policy
            </label>
            <select
              className="input agent-queue-run-select"
              id={approvalPolicyInputId}
              onChange={(event) =>
                run.onApprovalPolicyChange(
                  event.currentTarget.value as DirectWorkApprovalPolicy,
                )
              }
              value={run.approvalPolicy}
            >
              <option value="never">never</option>
              <option value="on_request">on_request</option>
              <option value="untrusted">untrusted</option>
            </select>
          </div>
        </div>

        {!run.readinessMessage && run.preconditionMessages.length > 0 ? (
          <div className="agent-queue-run-warning-list">
            {run.preconditionMessages.map((message) => (
              <p className="agent-queue-run-warning" key={message}>
                {message}
              </p>
            ))}
          </div>
        ) : null}

        <div className="agent-queue-run-actions">
          <Button
            disabled={!run.canStart}
            onClick={() => run.onStartAssignedTask()}
            variant="primary"
          >
            {run.isStarting ? "Starting" : "Run this task"}
          </Button>
        </div>

        {run.startMessage ? (
          <>
            <p className="agent-queue-message agent-queue-message-success">
              {run.startMessage}
              {run.startedRunId ? ` Run id: ${run.startedRunId}.` : ""}
            </p>
            <p className="agent-queue-run-note">
              Result appears in the assigned Agent Executor.
            </p>
          </>
        ) : null}
        {run.startError ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {run.startError}
          </p>
        ) : null}
      </div>

      <div className="agent-queue-execution-group">
        <div className="agent-queue-execution-group-header">
          <div>
            <p
              className="agent-queue-execution-group-title"
              title="Runs eligible tasks from the visible Queue while Hobit is open."
            >
              Sequential runner
            </p>
          </div>
          <Badge variant={runnerStatusBadgeVariant(runner.status)}>
            {runnerStatusLabel(runner.status)}
          </Badge>
        </div>

        <div className="agent-queue-run-actions">
          <Button
            disabled={!runner.canStart}
            onClick={() => runner.onStart()}
            variant="secondary"
          >
            {isRunnerActive(runner.status) ? "Runner active" : "Start runner"}
          </Button>
          <Button
            disabled={!isRunnerActive(runner.status)}
            onClick={() => runner.onStop()}
            variant="ghost"
          >
            Stop runner
          </Button>
        </div>

        {runner.preconditionMessages.length > 0 ? (
          <div className="agent-queue-run-warning-list">
            {runner.preconditionMessages.map((message) => (
              <p className="agent-queue-run-warning" key={message}>
                {message}
              </p>
            ))}
          </div>
        ) : null}

        {runner.message ? (
          <p className="agent-queue-run-note">{runner.message}</p>
        ) : null}
        {runner.error ? (
          <p
            className="agent-queue-message agent-queue-message-error"
            role="alert"
          >
            {runner.error}
          </p>
        ) : null}
      </div>

      <AgentQueueAutorunPanel autorun={autorun} />
    </section>
  );
}

function RunHistorySummary({
  executorSlots,
  links,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onRefresh,
  selectedTask,
  totalCount,
}: {
  executorSlots: AgentExecutorSlot[];
  links: NonNullable<AgentQueueLatestRunLinkController["link"]>[];
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onRefresh: () => void;
  selectedTask: AgentQueueTask;
  totalCount: number;
}) {
  const visibleLinks = links.slice(0, 3);
  const isLimited = totalCount > visibleLinks.length;

  return (
    <>
      <div className="agent-queue-run-history-list">
        {visibleLinks.map((link) => {
          const executorSlot = executorSlots.find(
            (slot) => slot.widgetInstanceId === link.executorWidgetId,
          );
          const runRef = shortWidgetInstanceId(link.directWorkRunId);

          return (
            <div className="agent-queue-run-history-item" key={link.linkId}>
              <div className="agent-queue-run-history-main">
                <Badge variant={runStatusBadgeVariant(link.status)}>
                  {runStatusLabel(link.status)}
                </Badge>
                <span>{runSourceLabel(link.source)}</span>
                <span>Run {runRef}</span>
              </div>
              <div className="agent-queue-run-history-meta">
                <span>Started {formatRunTimestamp(link.startedAt)}</span>
                <span>
                  {link.completedAt
                    ? `Completed ${formatRunTimestamp(link.completedAt)}`
                    : "Running"}
                </span>
                <Button
                  disabled={!executorSlot}
                  onClick={() =>
                    onOpenAgentExecutorRun?.({
                      executorWidgetInstanceId: link.executorWidgetId,
                      runId: link.directWorkRunId,
                    })
                  }
                  title={
                    executorSlot
                      ? "Open the Agent Executor that owns this run."
                      : "Owning Agent Executor is not visible on this Workbench."
                  }
                  variant="ghost"
                >
                  Open Executor
                </Button>
                <Button
                  disabled={!onAttachContextToCoordinator}
                  onClick={() =>
                    onAttachContextToCoordinator?.({
                      contextText: queueRunAttachedContextText({
                        executorLabel:
                          executorSlot?.label ??
                          `Agent Executor ${shortWidgetInstanceId(link.executorWidgetId)}`,
                        link,
                        selectedTask,
                      }),
                      sourceLabel: "Queue run history row",
                    })
                  }
                  title={
                    onAttachContextToCoordinator
                      ? "Attach this safe run metadata to Workspace Agent."
                      : "Workspace Agent is not visible on this Workbench."
                  }
                  variant="ghost"
                >
                  Attach to Workspace Agent
                </Button>
                {!executorSlot ? <span>Executor not visible</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="agent-queue-run-actions">
        {isLimited ? (
          <p className="agent-queue-run-note">
            Showing latest {visibleLinks.length} of {totalCount} total runs.
          </p>
        ) : null}
        <Button onClick={() => onRefresh()} variant="ghost">
          Refresh
        </Button>
      </div>
    </>
  );
}

function LatestRunSummary({
  executorSlots,
  link,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onRefresh,
  selectedTask,
}: {
  executorSlots: AgentExecutorSlot[];
  link: NonNullable<AgentQueueLatestRunLinkController["link"]>;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onRefresh: () => void;
  selectedTask: AgentQueueTask;
}) {
  const executorSlot = executorSlots.find(
    (slot) => slot.widgetInstanceId === link.executorWidgetId,
  );
  const executorLabel =
    executorSlot?.label ?? `Agent Executor ${shortWidgetInstanceId(link.executorWidgetId)}`;

  return (
    <>
      <dl className="agent-queue-latest-run-facts">
        <div>
          <dt>Source</dt>
          <dd>{runSourceLabel(link.source)}</dd>
        </div>
        <div>
          <dt>Executor</dt>
          <dd>{executorLabel}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{shortWidgetInstanceId(link.directWorkRunId)}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatRunTimestamp(link.startedAt)}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{link.completedAt ? formatRunTimestamp(link.completedAt) : "Running"}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{link.reviewStatus ? runReviewStatusLabel(link.reviewStatus) : "None"}</dd>
        </div>
      </dl>
      <div className="agent-queue-run-actions">
        <Button
          disabled={!executorSlot}
          onClick={() =>
            onOpenAgentExecutorRun?.({
              executorWidgetInstanceId: link.executorWidgetId,
              runId: link.directWorkRunId,
            })
          }
          title={
            executorSlot
              ? "Open the Agent Executor that owns this run."
              : "Owning Agent Executor is not visible on this Workbench."
          }
          variant="ghost"
        >
          Open Executor
        </Button>
        <Button
          disabled={!onAttachContextToCoordinator}
          onClick={() =>
            onAttachContextToCoordinator?.({
              contextText: queueRunAttachedContextText({
                executorLabel,
                link,
                selectedTask,
              }),
              sourceLabel: "Queue latest run",
            })
          }
          title={
            onAttachContextToCoordinator
              ? "Attach this safe run metadata to Workspace Agent."
              : "Workspace Agent is not visible on this Workbench."
          }
          variant="ghost"
        >
          Attach to Workspace Agent
        </Button>
        <Button onClick={() => onRefresh()} variant="ghost">
          Refresh
        </Button>
      </div>
      {!executorSlot ? (
        <p className="agent-queue-run-note">
          Owning Agent Executor is not visible on this Workbench.
        </p>
      ) : null}
    </>
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

function queueRunAttachedContextText({
  executorLabel,
  link,
  selectedTask,
}: {
  executorLabel: string;
  link: AgentQueueTaskRunLinkSummary;
  selectedTask: AgentQueueTask;
}) {
  return [
    "Queue run metadata",
    `Queue task: ${displayTaskTitle(selectedTask)} (${selectedTask.queueItemId})`,
    `Executor: ${executorLabel} (${link.executorWidgetId})`,
    `Run: ${link.directWorkRunId}`,
    `Run link: ${link.linkId}`,
    `Source: ${runSourceLabel(link.source)}`,
    `Status: ${runStatusLabel(link.status)}`,
    `Started: ${formatRunTimestamp(link.startedAt)}`,
    `Completed: ${
      link.completedAt ? formatRunTimestamp(link.completedAt) : "Running"
    }`,
    link.reviewStatus ? `Review: ${runReviewStatusLabel(link.reviewStatus)}` : null,
    link.validationStatus ? `Validation: ${link.validationStatus}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function runSourceLabel(source: string) {
  switch (source) {
    case "autorun":
      return "autorun";
    case "sequential_runner":
      return "sequential runner";
    case "manual":
      return "manual";
    default:
      return "unknown";
  }
}

function runStatusLabel(status: string) {
  switch (status) {
    case "review_needed":
      return "review needed";
    case "timed_out":
      return "timed out";
    default:
      return status;
  }
}

function runReviewStatusLabel(status: string) {
  return status === "review_needed" ? "review needed" : "unknown";
}

function coordinatorStatusLabel(status: AgentQueueTask["coordinatorStatus"]) {
  switch (status) {
    case "worker_reported":
      return "worker reported";
    case "awaiting_validation":
      return "awaiting validation";
    case "awaiting_coordinator_review":
      return "awaiting coordinator review";
    case "finalized":
      return "finalized";
    case "not_reported":
    default:
      return "not reported";
  }
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

function totalRunsLabel(totalCount: number) {
  return totalCount === 1 ? "1 total run" : `${totalCount} total runs`;
}

function runStatusBadgeVariant(status: string) {
  if (status === "completed") {
    return "success";
  }

  if (status === "failed" || status === "timed_out" || status === "cancelled") {
    return "error";
  }

  if (status === "running") {
    return "info";
  }

  return "neutral";
}

function formatRunTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
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

function isRunnerActive(status: AgentQueueRunnerController["status"]) {
  return (
    status === "assigning" ||
    status === "running" ||
    status === "starting" ||
    status === "waiting_for_executor"
  );
}

function runnerStatusLabel(status: AgentQueueRunnerController["status"]) {
  switch (status) {
    case "waiting_for_executor":
      return "waiting for executor";
    default:
      return status;
  }
}

function runnerStatusBadgeVariant(status: AgentQueueRunnerController["status"]) {
  if (status === "completed") {
    return "success";
  }

  if (status === "error") {
    return "error";
  }

  if (isRunnerActive(status)) {
    return "info";
  }

  return "neutral";
}
