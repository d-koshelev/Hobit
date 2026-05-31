import type { useAgentQueueController } from "./queue/useAgentQueueController";
import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  displayTaskTitle,
  formatUpdatedTimestamp,
  coordinatorStatusBlocksNewWork,
  coordinatorStatusBadgeVariant,
  coordinatorStatusLabel,
  itemTypeLabel,
  normalizeItemType,
  normalizeQueueTag,
  normalizeValidationStatus,
  queueExecutorInfoBadgeVariant,
  queueExecutorInfoForTask,
  queueTaskPriorityLabel,
  statusBadgeVariant,
  statusLabel,
  validationBadgeVariant,
  validationStatusLabel,
} from "./agentQueueTaskUiModel";
import { executionPlanStatusLabel } from "./queue/agentQueueExecutionPlanModel";
import { diffReviewSourceLabel } from "./queue/agentQueueDiffReviewModel";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "./types";
import type {
  AgentQueueReportActionCard,
  AgentQueueWorkerExecutionReport,
} from "../workspace/types";

type AgentQueueController = ReturnType<typeof useAgentQueueController>;

type AgentQueueTaskDetailsPanelProps = {
  agentExecutorSlots: AgentExecutorSlot[];
  assignmentInputId: string;
  descriptionInputId: string;
  executionPolicyInputId: string;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  priorityInputId: string;
  promptInputId: string;
  queue: AgentQueueController;
  selectedTaskHint: string;
  statusInputId: string;
  titleInputId: string;
};

export function AgentQueueTaskDetailsPanel({
  agentExecutorSlots,
  assignmentInputId,
  descriptionInputId,
  executionPolicyInputId,
  onOpenAgentExecutorRun,
  onAttachContextToCoordinator,
  onShowQueueReportInWorkspaceChat,
  priorityInputId,
  promptInputId,
  queue,
  selectedTaskHint,
  statusInputId,
  titleInputId,
}: AgentQueueTaskDetailsPanelProps) {
  const {
    assignmentApiAvailable,
    assignmentError,
    assignmentMessage,
    assignSelectedTask,
    clearSelectedTaskAssignment,
    deleteTask,
    draft,
    editTask,
    editorError,
    isAssigning,
    isDirty,
    isLoading,
    isSaving,
    loadError,
    run,
    saveTask,
    selectedExecutorWidgetId,
    selectedTask,
    selectExecutorWidget,
    tasks,
    updateDraft,
    updatePriority,
    validationMessage,
  } = queue;

  return (
    <section
      aria-label="Selected Agent Queue task"
      className="agent-queue-task-editor-pane"
    >
      {isLoading ? (
        <div className="agent-queue-empty-state">
          <p className="empty-state-title">Loading queue.</p>
          <p className="empty-state-text">
            Workspace queue tasks are loading.
          </p>
        </div>
      ) : loadError ? (
        <div className="agent-queue-empty-state" role="alert">
          <p className="empty-state-title">Queue unavailable.</p>
          <p className="empty-state-text">
            {loadError} Use Refresh to try again.
          </p>
        </div>
      ) : selectedTask ? (
        <div className="agent-queue-task-editor">
          <ExpandedTaskHeader
            queue={queue}
            selectedTask={selectedTask}
          />

          <NextActionPanel queue={queue} selectedTask={selectedTask} />

          <PromptPreview prompt={selectedTask.prompt} />

          <AgentQueueTaskRunPanel
            apiAvailable={assignmentApiAvailable}
            assignmentError={assignmentError}
            assignmentMessage={assignmentMessage}
            autorun={queue.autorun}
            currentSelection={selectedExecutorWidgetId}
            dependencyState={queue.dependencyStates.get(selectedTask.queueItemId)}
            executorSlots={agentExecutorSlots}
            executionPlan={queue.executionPlan}
            globalExecutionState={queue.foundation.globalExecutionState}
            hasExecutorSlots={agentExecutorSlots.length > 0}
            inputId={assignmentInputId}
            isAssigning={isAssigning}
            isDirty={isDirty || editTask.isEditing}
            latestRun={queue.latestRun}
            onAssign={() => void assignSelectedTask()}
            onClear={() => void clearSelectedTaskAssignment()}
            onPromoteDraftToQueued={() => queue.draftPromotion.onPromote()}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onSelectionChange={(executorWidgetInstanceId) => {
              selectExecutorWidget(executorWidgetInstanceId);
            }}
            onStartWorkers={() => queue.foundation.onStartWorkers()}
            canPromoteDraftToQueued={queue.draftPromotion.canPromote}
            run={run}
            runHistory={queue.runHistory}
            runner={queue.runner}
            routingState={queue.assignedWorkerRoutingStates.get(
              selectedTask.queueItemId,
            )}
            selectedTask={selectedTask}
            queueTags={queue.foundation.queueTags}
            workers={queue.foundation.workers}
          />

          <DiffReviewLinkagePanel
            onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
            queue={queue}
          />

          <WorkerExecutionReportPanel
            onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
            queue={queue}
          />

          <CoordinatorFinalizationPanel queue={queue} />

          <details
            className="agent-queue-details agent-queue-secondary-details"
            open={editTask.isEditing}
          >
            <summary>Task edit and metadata</summary>
            <SubmittedMetadata queue={queue} />
            <AgentQueueTaskSection
              deleteTask={deleteTask}
              descriptionInputId={descriptionInputId}
              draft={draft}
              editTask={editTask}
              executionPolicyInputId={executionPolicyInputId}
              isDirty={isDirty}
              isSaving={isSaving}
              onDraftChange={updateDraft}
              onPriorityChange={updatePriority}
              onSave={() => void saveTask()}
              ordering={queue.ordering}
              priorityInputId={priorityInputId}
              promptInputId={promptInputId}
              selectedTask={selectedTask}
              selectedTaskHint={selectedTaskHint}
              statusInputId={statusInputId}
              tasks={tasks}
              titleInputId={titleInputId}
            />
          </details>

          {validationMessage ? (
            <p
              className="agent-queue-message agent-queue-message-warning"
              role="alert"
            >
              {validationMessage}
            </p>
          ) : null}
          {editorError ? (
            <p
              className="agent-queue-message agent-queue-message-error"
              role="alert"
            >
              {editorError}
            </p>
          ) : null}
          <details className="agent-queue-details agent-queue-safety-details">
            <summary>Queue boundaries</summary>
            <p className="agent-queue-boundary-note">
              Queue tasks are workspace-local records. Queue does not show live
              logs, run hidden background scheduling, launch Terminal commands,
              or mutate Git.
            </p>
          </details>
        </div>
      ) : (
        <AgentQueueEmptySelection hasTasks={tasks.length > 0} />
      )}
    </section>
  );
}

function NextActionPanel({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>;
}) {
  const action = nextActionForSelectedTask(queue, selectedTask);

  return (
    <section
      aria-label="Next action"
      className={[
        "agent-queue-expanded-section",
        "agent-queue-next-action",
        `agent-queue-next-action-${action.tone}`,
      ].join(" ")}
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Next action</p>
          <p className="agent-queue-next-action-title">{action.title}</p>
        </div>
        <Badge variant={action.badgeVariant}>{action.badge}</Badge>
      </div>
      <p className="agent-queue-next-action-copy">{action.copy}</p>
      {action.secondaryCopy ? (
        <p className="agent-queue-next-action-secondary">
          {action.secondaryCopy}
        </p>
      ) : null}
      {action.actions.length > 0 ? (
        <div className="agent-queue-run-actions">
          {action.actions.map((item) => (
            <Button
              disabled={item.disabled}
              key={item.label}
              onClick={item.onClick}
              variant={item.variant}
            >
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function nextActionForSelectedTask(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
) {
  const hasReport = (selectedTask.workerExecutionReports?.length ?? 0) > 0;
  const planLabel = executionPlanStatusLabel(selectedTask.executionPlanPreview);
  const readinessMessage = queue.run.readinessMessage;
  const preconditionMessage = queue.run.preconditionMessages[0] ?? null;
  const routingState = queue.assignedWorkerRoutingStates.get(
    selectedTask.queueItemId,
  );
  const routingBlocker =
    routingState && !routingState.canTake
      ? routingState.blockedReasons[0]?.label ?? null
      : null;
  const actions: Array<{
    disabled?: boolean;
    label: string;
    onClick: () => void;
    variant: "primary" | "secondary" | "ghost";
  }> = [];

  if (queue.run.canStart) {
    actions.push({
      label: queue.run.isStarting ? "Starting" : "Run assigned task",
      onClick: () => queue.run.onStartAssignedTask(),
      variant: "primary",
    });

    return {
      actions,
      badge: "Ready",
      badgeVariant: "success" as const,
      copy:
        "This item has a runnable status, an assigned worker, a prompt, and execution settings. Start it explicitly when ready.",
      secondaryCopy: "Agent Executor owns live logs, stop controls, and results.",
      title: "Ready to run",
      tone: "ready",
    };
  }

  if (coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)) {
    return {
      actions,
      badge: coordinatorStatusLabel(selectedTask.coordinatorStatus),
      badgeVariant: coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus),
      copy:
        "Worker evidence or coordinator decisions are waiting for explicit review. Do not start more work until the coordinator state is resolved.",
      secondaryCopy: hasReport
        ? "Review the worker report below, then use coordinator finalization when it is relevant."
        : "No worker report is attached yet.",
      title: "Awaiting coordinator review",
      tone: "review",
    };
  }

  if (selectedTask.status === "draft") {
    actions.push({
      label: queue.editTask.isEditing ? "Editing status" : "Edit status",
      onClick: () => queue.editTask.onStart(),
      variant: "secondary",
    });

    if (queue.executionPlan.canGenerate) {
      actions.push({
        label: "Generate plan preview",
        onClick: () => queue.executionPlan.onGenerate(),
        variant: "ghost",
      });
    }

    return {
      actions,
      badge: "Not runnable",
      badgeVariant: "warning" as const,
      copy:
        "This item is Draft, so workers cannot take it yet. Set Execution status to Queued or Ready in Task edit and save when the prompt is ready.",
      secondaryCopy: `Top blocker: Item is not in a runnable execution state. ${planLabel}.`,
      title: "Needs plan / ready state",
      tone: "blocked",
    };
  }

  if (readinessMessage?.startsWith("Assign an Agent Executor")) {
    return {
      actions,
      badge: "Unassigned",
      badgeVariant: "warning" as const,
      copy:
        "Choose a Worker / Executor in the Execution section and click Assign. Assignment records routing only; it does not start work.",
      secondaryCopy: readinessMessage,
      title: "Needs assignment",
      tone: "blocked",
    };
  }

  if (readinessMessage?.includes("status") || routingBlocker) {
    return {
      actions,
      badge: "Blocked",
      badgeVariant: "warning" as const,
      copy:
        readinessMessage ??
        routingBlocker ??
        "This item is blocked before execution.",
      secondaryCopy:
        routingBlocker && routingBlocker !== readinessMessage
          ? `Top blocker: ${routingBlocker}.`
          : "Top blocker: Item is not in a runnable execution state.",
      title: "Not runnable yet",
      tone: "blocked",
    };
  }

  if (!hasReport && isReviewLikeStatus(selectedTask.status)) {
    return {
      actions,
      badge: "No report",
      badgeVariant: "neutral" as const,
      copy:
        "No worker report yet. Run or attach a worker report to review evidence.",
      secondaryCopy: "Coordinator finalization stays secondary until evidence exists.",
      title: "No worker report yet",
      tone: "waiting",
    };
  }

  if (!readinessMessage && preconditionMessage) {
    return {
      actions,
      badge: "Ready",
      badgeVariant: "info" as const,
      copy:
        "This item is runnable and assigned. Enter the execution workspace and keep Codex settings visible before starting.",
      secondaryCopy: preconditionMessage,
      title: "Ready to run after setup",
      tone: "ready",
    };
  }

  return {
    actions,
    badge: readinessMessage ? "Blocked" : "Waiting",
    badgeVariant: readinessMessage ? ("warning" as const) : ("neutral" as const),
    copy:
      readinessMessage ??
      "Review assignment, worker state, and execution settings before starting.",
    secondaryCopy: routingBlocker ? `Top blocker: ${routingBlocker}.` : null,
    title: readinessMessage ? "Blocked before execution" : "Waiting for action",
    tone: readinessMessage ? "blocked" : "waiting",
  };
}

function isReviewLikeStatus(status: string) {
  return status === "review_needed" || status === "completed";
}

function CoordinatorFinalizationPanel({
  queue,
}: {
  queue: AgentQueueController;
}) {
  const finalization = queue.coordinatorFinalization;
  const selectedTask = queue.selectedTask;
  const hasReport =
    (selectedTask?.workerExecutionReports?.length ?? 0) > 0 ||
    Boolean(queue.reportActionCard.diffReviewReportCard);
  const isRelevant =
    hasReport || coordinatorStatusBlocksNewWork(finalization.status);

  if (!isRelevant) {
    return (
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Coordinator finalization</summary>
        <p className="agent-queue-run-note">
          Coordinator finalization becomes relevant after a worker report,
          diff review, or explicit coordinator-review state exists.
        </p>
      </details>
    );
  }

  return (
    <section
      aria-label="Coordinator finalization"
      className="agent-queue-expanded-section agent-queue-finalization"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-execution-group-title">
            Coordinator finalization
          </p>
          <p className="agent-queue-run-note">
            Reports and Diff Review evidence are not final. The coordinator owns
            acceptance, changes, follow-up, block, failure, and rollback markers.
          </p>
        </div>
        <Badge variant={coordinatorStatusBadgeVariant(finalization.status)}>
          {coordinatorStatusLabel(finalization.status)}
        </Badge>
      </div>
      <div className="agent-queue-finalization-actions">
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkReadyForFinalization()}
          variant="secondary"
        >
          Mark ready for finalization
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onFinalize()}
          variant="primary"
        >
          Finalize / Accept item
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkNeedsChanges()}
          variant="secondary"
        >
          Mark needs changes
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkFollowUpRequired()}
          variant="secondary"
        >
          Mark follow-up required
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onCreateFollowUp()}
          variant="secondary"
        >
          Create follow-up item
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkBlocked()}
          variant="secondary"
        >
          Mark blocked
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkFailedRejected()}
          variant="secondary"
        >
          Mark failed/rejected
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkRollbackRequired()}
          variant="secondary"
        >
          Mark rollback required
        </Button>
      </div>
      {finalization.message ? (
        <p className="agent-queue-message">{finalization.message}</p>
      ) : null}
    </section>
  );
}

function ExpandedTaskHeader({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>;
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
    <section
      aria-label="Expanded Queue item header"
      className="agent-queue-expanded-header"
    >
      <div className="agent-queue-expanded-heading">
        <div>
          <p className="agent-queue-expanded-kicker">Selected work item</p>
          <h3>{displayTaskTitle(selectedTask)}</h3>
        </div>
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
      </div>

      <div className="agent-queue-expanded-badges">
        <Badge variant="neutral">{queueTag.queueTagName}</Badge>
        <Badge variant="neutral">{itemTypeLabel(normalizeItemType(selectedTask.itemType))}</Badge>
        <Badge variant="neutral">
          Priority {queueTaskPriorityLabel(selectedTask.priority)}
        </Badge>
        {queue.ordering.orderLabel ? (
          <Badge variant="neutral">Order {queue.ordering.orderLabel}</Badge>
        ) : null}
        <Badge variant={statusBadgeVariant(selectedTask.status)}>
          {statusLabel(selectedTask.status)}
        </Badge>
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
        <Badge variant={queueExecutorInfoBadgeVariant(executorInfo.tone)}>
          {executorInfo.label}
        </Badge>
      </div>

      <dl className="agent-queue-expanded-facts">
        <div>
          <dt>Plan</dt>
          <dd>{executionPlanStatusLabel(selectedTask.executionPlanPreview)}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>{statusLabel(selectedTask.status)}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{validationStatusLabel(validationStatus)}</dd>
        </div>
        <div>
          <dt>Coordinator</dt>
          <dd>{coordinatorStatusLabel(selectedTask.coordinatorStatus)}</dd>
        </div>
        <div>
          <dt>Report</dt>
          <dd>{latestReportLabel(selectedTask)}</dd>
        </div>
        <div>
          <dt>Diff review</dt>
          <dd>{diffReviewHeaderLabel(queue, selectedTask)}</dd>
        </div>
        <div>
          <dt>Live timer</dt>
          <dd>{liveTimerCopy(queue)}</dd>
        </div>
      </dl>
    </section>
  );
}

function DiffReviewLinkagePanel({
  onShowQueueReportInWorkspaceChat,
  queue,
}: {
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
}) {
  const selectedTask = queue.selectedTask;

  if (!selectedTask) {
    return null;
  }

  if (normalizeItemType(selectedTask.itemType) === "diff_review") {
    const metadata = selectedTask.diffReview;
    const sourceLabel = diffReviewSourceLabel(selectedTask, queue.tasks);
    const reportCard = queue.reportActionCard.diffReviewReportCard;

    return (
      <section
        aria-label="Diff review source"
        className="agent-queue-expanded-section agent-queue-diff-review-linkage"
      >
        <div className="agent-queue-expanded-section-header">
          <div>
            <p className="agent-queue-execution-group-title">
              Diff review source
            </p>
            <p className="agent-queue-run-note">
              Independent review item. It does not finalize or mutate the source item.
            </p>
          </div>
          <Badge variant="info">Diff review</Badge>
        </div>
        <dl className="agent-queue-expanded-facts">
          <div>
            <dt>Source item</dt>
            <dd>{sourceLabel ?? metadata?.sourceItemId ?? "Not linked"}</dd>
          </div>
          <div>
            <dt>Source report</dt>
            <dd>{metadata?.sourceReportId ?? "Not linked"}</dd>
          </div>
          <div>
            <dt>Commit</dt>
            <dd className="agent-queue-mono">
              {metadata?.sourceCommitHash ?? "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Review mode</dt>
            <dd>{reviewModeLabel(metadata?.reviewMode)}</dd>
          </div>
        </dl>
        {metadata?.reviewTargetSummary ? (
          <p className="agent-queue-run-note">{metadata.reviewTargetSummary}</p>
        ) : null}
        {metadata?.sourceItemId ? (
          <div className="agent-queue-run-actions">
            <Button
              onClick={() => void queue.selectTask(metadata.sourceItemId)}
              variant="ghost"
            >
              Open source item
            </Button>
            <Button
              disabled={!reportCard || !onShowQueueReportInWorkspaceChat}
              onClick={() => {
                if (!reportCard || !onShowQueueReportInWorkspaceChat) {
                  return;
                }

                onShowQueueReportInWorkspaceChat(reportCard);
                queue.reportActionCard.onShown(reportCard.cardId);
              }}
              variant="secondary"
            >
              Show in Workspace Chat
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  const linkedReviews = queue.diffReview.linkedReviewTasks;

  if (linkedReviews.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Requested diff reviews"
      className="agent-queue-expanded-section agent-queue-diff-review-linkage"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-execution-group-title">
            Diff review requested
          </p>
          <p className="agent-queue-run-note">
            Source item remains pending coordinator review until diff-review evidence is evaluated.
          </p>
        </div>
        <Badge variant="warning">
          {linkedReviews.length.toString()} requested
        </Badge>
      </div>
      <div className="agent-queue-linked-review-list">
        {linkedReviews.map((reviewTask) => (
          <Button
            key={reviewTask.queueItemId}
            onClick={() => void queue.selectTask(reviewTask.queueItemId)}
            variant="ghost"
          >
            {displayTaskTitle(reviewTask)}
          </Button>
        ))}
      </div>
    </section>
  );
}

function WorkerExecutionReportPanel({
  onShowQueueReportInWorkspaceChat,
  queue,
}: {
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
}) {
  const report = queue.workerReport.latestReport;
  const reportCard = queue.reportActionCard.workerReportCard;
  const shownCardId = queue.reportActionCard.latestShownCardId;

  if (!report) {
    return (
      <section
        aria-label="Worker execution report"
        className="agent-queue-expanded-section agent-queue-worker-report agent-queue-worker-report-empty"
      >
        <div className="agent-queue-expanded-section-header">
          <div>
            <p className="agent-queue-execution-group-title">
              Worker execution report
            </p>
            <p className="agent-queue-run-note">
              No worker report yet. Run or attach a worker report to review evidence.
            </p>
          </div>
          <Badge variant="neutral">No report</Badge>
        </div>
        <div className="agent-queue-run-actions">
          <Button
            disabled={!queue.workerReport.canAttach}
            onClick={() => queue.workerReport.onAttachDemoReport()}
            variant="secondary"
          >
            Attach worker report
          </Button>
        </div>
        {queue.workerReport.message ? (
          <p className="agent-queue-message">{queue.workerReport.message}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Worker execution report"
      className="agent-queue-expanded-section agent-queue-worker-report"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-execution-group-title">
            Worker execution report
          </p>
          <p className="agent-queue-run-note">
            Structured evidence for Workspace Chat / coordinator review. Not final.
          </p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge variant={report ? "info" : "neutral"}>
            {report ? "Reported" : "No report"}
          </Badge>
          {report ? <Badge variant="warning">Awaiting review</Badge> : null}
        </div>
      </div>

      <WorkerReportSummary
        report={report}
        workerName={workerNameForReport(queue, report)}
      />
      <div className="agent-queue-report-card-linkage">
        <Badge variant={shownCardId ? "info" : "neutral"}>
          {shownCardId ? "Shown in Workspace Chat" : "Not shown in Chat"}
        </Badge>
        {shownCardId ? (
          <span className="agent-queue-mono">{shownCardId}</span>
        ) : null}
      </div>

      <div className="agent-queue-run-actions">
        <Button
          disabled={!reportCard || !onShowQueueReportInWorkspaceChat}
          onClick={() => {
            if (!reportCard || !onShowQueueReportInWorkspaceChat) {
              return;
            }

            onShowQueueReportInWorkspaceChat(reportCard);
            queue.reportActionCard.onShown(reportCard.cardId);
          }}
          variant="secondary"
        >
          Show in Workspace Chat
        </Button>
        <Button
          disabled={!queue.diffReview.canCreate}
          onClick={() => queue.diffReview.onCreate()}
          title="Create an independent queued Diff Review item without starting execution."
          variant={report ? "primary" : "secondary"}
        >
          Create diff review item
        </Button>
        <Button
          disabled={!queue.workerReport.canAttach}
          onClick={() => queue.workerReport.onAttachDemoReport()}
          variant="secondary"
        >
          Attach another report
        </Button>
      </div>

      {queue.workerReport.message ? (
        <p className="agent-queue-message">{queue.workerReport.message}</p>
      ) : null}
    </section>
  );
}

function WorkerReportSummary({
  report,
  workerName,
}: {
  report: AgentQueueWorkerExecutionReport;
  workerName: string;
}) {
  return (
    <>
      <dl className="agent-queue-worker-report-facts">
        <div>
          <dt>Status</dt>
          <dd>{workerReportStatusLabel(report.reportStatus)}</dd>
        </div>
        <div>
          <dt>Worker</dt>
          <dd>{workerName}</dd>
        </div>
        <div>
          <dt>Reported</dt>
          <dd>{formatTimestamp(report.createdAt)}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{workerReportValidationLabel(report.validationResult)}</dd>
        </div>
        {report.commitHash ? (
          <div>
            <dt>Commit</dt>
            <dd className="agent-queue-mono">{report.commitHash}</dd>
          </div>
        ) : null}
        {report.finalGitStatus ? (
          <div>
            <dt>Git status</dt>
            <dd>{report.finalGitStatus}</dd>
          </div>
        ) : null}
      </dl>

      <p className="agent-queue-worker-report-summary">{report.summary}</p>
      <ReportList
        emptyText="No changed files reported."
        title="Changed files"
        values={report.changedFiles}
      />
      <ReportList
        emptyText="No commands reported."
        title="Commands run"
        values={report.commandsRun}
      />
      <ReportList
        emptyText="No validation commands suggested."
        title="Suggested validation"
        values={report.validationCommandsSuggested}
      />
      {report.warnings.length > 0 ? (
        <ReportList title="Warnings" values={report.warnings} />
      ) : null}
      {report.errors.length > 0 ? (
        <ReportList title="Errors" values={report.errors} />
      ) : null}
      {report.followUpRecommendation ? (
        <p className="agent-queue-run-warning">
          Follow-up/sub-block recommendation: {report.followUpRecommendation}
        </p>
      ) : null}
      {report.rollbackRecommendation ? (
        <p className="agent-queue-run-warning">
          Rollback recommendation: {report.rollbackRecommendation}
        </p>
      ) : null}
      {report.rawReportPreview ? (
        <details className="agent-queue-details agent-queue-worker-report-raw">
          <summary>Raw report preview</summary>
          <pre>{report.rawReportPreview}</pre>
        </details>
      ) : null}
      <p className="agent-queue-run-note">
        Worker reports do not finalize Queue item status. Coordinator review,
        validation, diff review, and downstream impact review remain separate.
      </p>
    </>
  );
}

function ReportList({
  emptyText,
  title,
  values,
}: {
  emptyText?: string;
  title: string;
  values: string[];
}) {
  return (
    <div className="agent-queue-report-list">
      <p className="field-label">{title}</p>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="agent-queue-run-note">{emptyText ?? "None reported."}</p>
      )}
    </div>
  );
}

function SubmittedMetadata({
  queue,
}: {
  queue: AgentQueueController;
}) {
  const selectedTask = queue.selectedTask;

  if (!selectedTask) {
    return null;
  }

  return (
    <section
      aria-label="Submitted metadata"
      className="agent-queue-expanded-section"
    >
      <div className="agent-queue-expanded-section-header">
        <p className="agent-queue-execution-group-title">Submitted metadata</p>
        <Badge variant="neutral">record</Badge>
      </div>
      <dl className="agent-queue-expanded-facts">
        <div>
          <dt>Submitted by</dt>
          <dd>Not recorded</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>Queue task record</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(selectedTask.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatTimestamp(selectedTask.updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

function PromptPreview({ prompt }: { prompt: string }) {
  return (
    <details className="agent-queue-expanded-section agent-queue-prompt-preview" open>
      <summary>Prompt</summary>
      <pre>{prompt.trim() || "No prompt has been written for this task."}</pre>
      <p className="agent-queue-run-note">
        Expected plan metadata is kept separate from the prompt text.
      </p>
    </details>
  );
}

function formatTimestamp(value: string) {
  return formatUpdatedTimestamp(value) ?? value;
}

function latestReportLabel(
  task: NonNullable<AgentQueueController["selectedTask"]>,
) {
  return task.workerExecutionReports && task.workerExecutionReports.length > 0
    ? "Reported / awaiting coordinator review"
    : "No worker report";
}

function diffReviewHeaderLabel(
  queue: AgentQueueController,
  task: NonNullable<AgentQueueController["selectedTask"]>,
) {
  if (normalizeItemType(task.itemType) === "diff_review") {
    return task.diffReview?.sourceItemId
      ? `Linked to ${task.diffReview.sourceItemId}`
      : "Independent review";
  }

  return queue.diffReview.linkedReviewTasks.length > 0
    ? "Diff review requested"
    : "Not requested";
}

function reviewModeLabel(
  reviewMode: NonNullable<
    NonNullable<AgentQueueController["selectedTask"]>["diffReview"]
  >["reviewMode"] | undefined,
) {
  switch (reviewMode) {
    case "contract_scope":
      return "Contract/scope review";
    case "general_review":
      return "General review";
    case "diff_vs_report":
    default:
      return "Diff vs report";
  }
}

function workerNameForReport(
  queue: AgentQueueController,
  report: AgentQueueWorkerExecutionReport,
) {
  return (
    queue.foundation.workers.find((worker) => worker.workerId === report.workerId)
      ?.name ?? report.workerId
  );
}

function workerReportStatusLabel(
  status: AgentQueueWorkerExecutionReport["reportStatus"],
) {
  switch (status) {
    case "needs_follow_up":
      return "needs follow-up";
    default:
      return status;
  }
}

function workerReportValidationLabel(
  validationResult: AgentQueueWorkerExecutionReport["validationResult"],
) {
  switch (validationResult) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "partial":
      return "partial";
    case "not_run":
    default:
      return "not run";
  }
}

function liveTimerCopy(queue: AgentQueueController) {
  const link = queue.latestRun.link;

  if (link?.status === "running" && link.startedAt) {
    return `Started ${formatTimestamp(link.startedAt)}. Live timer appears when runtime execution is wired.`;
  }

  return "Live timer appears when runtime execution is wired.";
}
