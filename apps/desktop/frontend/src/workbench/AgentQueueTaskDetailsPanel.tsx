import type { useAgentQueueController } from "./queue/useAgentQueueController";
import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import {
  AgentQueueTaskRunAdvancedDetails,
  AgentQueueTaskRunPanel,
} from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  displayTaskTitle,
  formatUpdatedTimestamp,
  coordinatorStatusBlocksNewWork,
  coordinatorStatusBadgeVariant,
  coordinatorStatusLabel,
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
  AgentExecutorRunDetail,
  AgentQueueReportActionCard,
  AgentQueueWorkerExecutionReport,
  AgentQueueTaskRunLinkSummary,
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
  presentation?: "full" | "flow-summary";
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
  presentation = "full",
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

  if (presentation === "flow-summary") {
    return (
      <section
        aria-label="Selected Agent Queue task summary"
        className="agent-queue-task-editor-pane agent-queue-task-editor-pane-flow"
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
          <FlowSelectionSummary queue={queue} selectedTask={selectedTask} />
        ) : (
          <AgentQueueEmptySelection hasTasks={tasks.length > 0} />
        )}
      </section>
    );
  }

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
          <SelectedTaskOverview queue={queue} selectedTask={selectedTask} />

          <PromptPreview prompt={selectedTask.prompt} />

          <ResultEvidencePanel
            onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
            queue={queue}
            selectedTask={selectedTask}
          />

          {hasReviewEvidenceForTask(queue, selectedTask) ? (
            <>
              <CoordinatorFinalizationPanel queue={queue} />

              <ActivityTimelinePanel queue={queue} selectedTask={selectedTask} />

              <details
                className="agent-queue-details agent-queue-secondary-details agent-queue-internal-details"
                id="agent-queue-developer-details"
              >
                <summary>Developer details / raw output</summary>
                <DiffReviewLinkagePanel
                  onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                  queue={queue}
                />
                <WorkerExecutionReportPanel
                  onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                  queue={queue}
                />
                <AgentQueueTaskRunAdvancedDetails
                  autorun={queue.autorun}
                  dependencyState={queue.dependencyStates.get(selectedTask.queueItemId)}
                  executorSlots={agentExecutorSlots}
                  executionPlan={queue.executionPlan}
                  latestRun={queue.latestRun}
                  onAttachContextToCoordinator={onAttachContextToCoordinator}
                  onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                  queueTag={normalizeQueueTag(selectedTask)}
                  queueTagSummary={queue.foundation.queueTags.find(
                    (tag) =>
                      tag.queueTagId === normalizeQueueTag(selectedTask).queueTagId,
                  )}
                  routingBlockedLabel={
                    queue.assignedWorkerRoutingStates.get(selectedTask.queueItemId)
                      ?.canTake === false
                      ? queue.assignedWorkerRoutingStates.get(selectedTask.queueItemId)
                          ?.blockedReasons[0]?.label ?? null
                      : null
                  }
                  routingState={queue.assignedWorkerRoutingStates.get(
                    selectedTask.queueItemId,
                  )}
                  run={run}
                  runHistory={queue.runHistory}
                  runner={queue.runner}
                  selectedTask={selectedTask}
                />
                <SubmittedMetadata queue={queue} />
                <details
                  className="agent-queue-details agent-queue-secondary-details"
                  open={editTask.isEditing}
                >
                  <summary>Task edit metadata</summary>
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
              </details>
            </>
          ) : (
            <>
              <section
                aria-label="Selected task actions and settings"
                className="agent-queue-actions-settings"
              >
                <NextActionPanel queue={queue} selectedTask={selectedTask} />

                <AgentQueueTaskRunPanel
                  apiAvailable={assignmentApiAvailable}
                  assignmentError={assignmentError}
                  assignmentMessage={assignmentMessage}
                  autorun={queue.autorun}
                  currentSelection={selectedExecutorWidgetId}
                  dependencyState={queue.dependencyStates.get(
                    selectedTask.queueItemId,
                  )}
                  executorSlots={agentExecutorSlots}
                  executionPlan={queue.executionPlan}
                  hasExecutorSlots={agentExecutorSlots.length > 0}
                  includeAdvancedDetails={false}
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
              </section>

              <HumanReadableActivityPanel
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                queue={queue}
                selectedTask={selectedTask}
              />

              <CoordinatorFinalizationPanel queue={queue} />

              <details className="agent-queue-details agent-queue-secondary-details agent-queue-internal-details">
                <summary>Internal details</summary>
                <DiffReviewLinkagePanel
                  onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                  queue={queue}
                />
                <WorkerExecutionReportPanel
                  onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                  queue={queue}
                />
                <AgentQueueTaskRunAdvancedDetails
                  autorun={queue.autorun}
                  dependencyState={queue.dependencyStates.get(selectedTask.queueItemId)}
                  executorSlots={agentExecutorSlots}
                  executionPlan={queue.executionPlan}
                  latestRun={queue.latestRun}
                  onAttachContextToCoordinator={onAttachContextToCoordinator}
                  onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                  queueTag={normalizeQueueTag(selectedTask)}
                  queueTagSummary={queue.foundation.queueTags.find(
                    (tag) =>
                      tag.queueTagId === normalizeQueueTag(selectedTask).queueTagId,
                  )}
                  routingBlockedLabel={
                    queue.assignedWorkerRoutingStates.get(selectedTask.queueItemId)
                      ?.canTake === false
                      ? queue.assignedWorkerRoutingStates.get(selectedTask.queueItemId)
                          ?.blockedReasons[0]?.label ?? null
                      : null
                  }
                  routingState={queue.assignedWorkerRoutingStates.get(
                    selectedTask.queueItemId,
                  )}
                  run={run}
                  runHistory={queue.runHistory}
                  runner={queue.runner}
                  selectedTask={selectedTask}
                />
              </details>

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
            </>
          )}

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

function FlowSelectionSummary({
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

function nextActionForSelectedTask(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
) {
  const hasReport = (selectedTask.workerExecutionReports?.length ?? 0) > 0;
  const runEvidence = directWorkEvidenceForQueue(queue);
  const hasRunEvidence = Boolean(runEvidence);
  const hasReviewEvidence = hasReport || hasRunEvidence;
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

  if (selectedTask.status === "running" || queue.latestRun.link?.status === "running") {
    return {
      actions,
      badge: "Running",
      badgeVariant: "info" as const,
      copy: "Waiting for worker report.",
      secondaryCopy: runningRunSummary(queue),
      title: "Waiting for worker report",
      tone: "waiting",
    };
  }

  if (hasReviewEvidence) {
    actions.push({
      label: "View report",
      onClick: () => scrollToSelectedTaskReport(),
      variant: "primary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Mark ready for finalization",
      onClick: () => queue.coordinatorFinalization.onMarkReadyForFinalization(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Finalize / Accept",
      onClick: () => queue.coordinatorFinalization.onFinalize(),
      variant: "secondary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Request changes",
      onClick: () => queue.coordinatorFinalization.onMarkNeedsChanges(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Follow-up required",
      onClick: () => queue.coordinatorFinalization.onMarkFollowUpRequired(),
      variant: "secondary",
    });

    const failed = isFailedRunEvidence(queue, selectedTask);

    return {
      actions,
      badge: failed ? "Run failed" : "Report ready",
      badgeVariant: failed ? ("error" as const) : ("info" as const),
      copy: failed
        ? "Run failed. Review the visible error evidence and make an explicit coordinator decision."
        : "Execution complete. Review report evidence and make an explicit coordinator decision.",
      secondaryCopy: "Coordinator finalization remains explicit; no item is accepted automatically.",
      title: "Review report and make coordinator decision",
      tone: "review",
    };
  }

  const autonomousAction = autonomousNextActionForSelectedTask(queue, selectedTask);

  if (autonomousAction) {
    return autonomousAction;
  }

  if (
    hasFinishedRunLink(queue) ||
    isReportReadyStatus(selectedTask.status) ||
    coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)
  ) {
    if (queue.runEvidence.apiAvailable) {
      actions.push({
        disabled: queue.runEvidence.isLoading,
        label: queue.runEvidence.isLoading ? "Loading evidence" : "Refresh result",
        onClick: () => queue.runEvidence.onRefresh(),
        variant: "primary",
      });
    }

    actions.push({
      disabled: !queue.workerReport.canAttach,
      label: "Attach report",
      onClick: () => queue.workerReport.onAttachDemoReport(),
      variant: "secondary",
    });

    actions.push({
      label: "Developer details",
      onClick: () => scrollToDeveloperDetails(),
      variant: "ghost",
    });

    const failed = isFailedRunEvidence(queue, selectedTask);

    return {
      actions,
      badge: failed ? "Failure evidence missing" : "Evidence missing",
      badgeVariant: "warning" as const,
      copy: failed
        ? "The run failed, but no worker report or Direct Work result evidence is attached. Review is not ready."
        : "Execution is complete, but no worker report or Direct Work result evidence is attached. Review is not ready.",
      secondaryCopy: "Rerun the task, attach a report, or inspect Developer details before making a coordinator decision.",
      title: failed ? "Failure evidence missing" : "Evidence missing",
      tone: "blocked",
    };
  }

  if (queue.run.canStart) {
    const executorCopy = queue.run.executorSelectionMessage?.startsWith(
      "Local executor selected automatically",
    )
      ? `${queue.run.executorSelectionMessage} `
      : "";

    actions.push({
      label: queue.run.isStarting ? "Starting" : "Run task",
      onClick: () => queue.run.onStartAssignedTask(),
      variant: "primary",
    });

    return {
      actions,
      badge: "Ready",
      badgeVariant: "success" as const,
      copy: `${executorCopy}Start this task explicitly when ready.`,
      secondaryCopy: "Worker report appears below after execution.",
      title: "Run task",
      tone: "ready",
    };
  }

  if (coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)) {
    actions.push({
      label: "View report",
      onClick: () => scrollToSelectedTaskReport(),
      variant: "primary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Mark ready for finalization",
      onClick: () => queue.coordinatorFinalization.onMarkReadyForFinalization(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Finalize / Accept",
      onClick: () => queue.coordinatorFinalization.onFinalize(),
      variant: "secondary",
    });

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Request changes",
      onClick: () => queue.coordinatorFinalization.onMarkNeedsChanges(),
      variant: "secondary",
    });
    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Follow-up required",
      onClick: () => queue.coordinatorFinalization.onMarkFollowUpRequired(),
      variant: "secondary",
    });

    return {
      actions,
      badge: coordinatorStatusLabel(selectedTask.coordinatorStatus),
      badgeVariant: coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus),
      copy:
        "Worker evidence or coordinator decisions are waiting for explicit review. Do not start more work until the coordinator state is resolved.",
      secondaryCopy: hasReviewEvidence
        ? "Review the report evidence below, then use coordinator finalization when it is relevant."
        : "No run evidence is attached yet.",
      title: "Awaiting coordinator review",
      tone: "review",
    };
  }

  if (selectedTask.status === "draft") {
    if (queue.draftPromotion.canPromote) {
      actions.push({
        label: "Promote to queued",
        onClick: () => queue.draftPromotion.onPromote(),
        variant: "primary",
      });
    }

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
      copy: "Draft task.",
      secondaryCopy: planLabel,
      title: "Promote to queued",
      tone: "blocked",
    };
  }

  if (readinessMessage === "Local executor unavailable.") {
    actions.push({
      disabled:
        queue.isAssigning ||
        !queue.selectedExecutorWidgetId ||
        !queue.assignmentApiAvailable,
      label: queue.isAssigning ? "Assigning" : "Assign executor",
      onClick: () => void queue.assignSelectedTask(),
      variant: "primary",
    });

    return {
      actions,
      badge: "Unassigned",
      badgeVariant: "warning" as const,
      copy: "Local executor unavailable.",
      secondaryCopy: null,
      title: "Select local executor",
      tone: "blocked",
    };
  }

  if (readinessMessage?.includes("status") || routingBlocker) {
    return {
      actions,
      badge: "Blocked",
      badgeVariant: "warning" as const,
      copy: compactNextActionBlocker(readinessMessage ?? routingBlocker),
      secondaryCopy: null,
      title: "Not runnable yet",
      tone: "blocked",
    };
  }

  if (!readinessMessage && preconditionMessage) {
    const missingRunSetting = isRunSettingPrecondition(preconditionMessage);

    return {
      actions,
      badge: missingRunSetting ? "Not configured" : "Waiting",
      badgeVariant: "warning" as const,
      copy: compactNextActionBlocker(preconditionMessage),
      secondaryCopy: null,
      title: missingRunSetting ? "Set run settings" : "Waiting for run",
      tone: "blocked",
    };
  }

  return {
    actions,
    badge: readinessMessage ? "Blocked" : "Waiting",
    badgeVariant: readinessMessage ? ("warning" as const) : ("neutral" as const),
    copy:
      compactNextActionBlocker(readinessMessage ?? routingBlocker) ??
      "Review settings, then run explicitly.",
    secondaryCopy: null,
    title: readinessMessage ? "Blocked before execution" : "Waiting for action",
    tone: readinessMessage ? "blocked" : "waiting",
  };
}

function compactNextActionBlocker(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (/No local executor|Local executor unavailable|assigned worker unavailable|worker is disabled/i.test(message)) {
    return "Local executor unavailable.";
  }

  if (/workspace|repo root/i.test(message)) {
    return "Set workspace.";
  }

  if (/danger_full_access|sandbox/i.test(message)) {
    return "Select danger_full_access.";
  }

  if (/Draft/i.test(message)) {
    return "Promote to queued.";
  }

  if (/Enable queue|disabled/i.test(message)) {
    return "Enable queue.";
  }

  return message;
}

function isRunSettingPrecondition(message: string) {
  return /workspace|repo root|Codex executable/i.test(message);
}

function isReportReadyStatus(status: string) {
  return (
    status === "completed" ||
    status === "review_needed" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function runningRunSummary(queue: AgentQueueController) {
  const link = queue.latestRun.link;
  const executorId =
    link?.executorWidgetId ?? queue.selectedTask?.assignedExecutorWidgetId ?? null;
  const runId = link?.directWorkRunId ?? queue.run.startedRunId;
  const parts = [
    executorId ? `Local executor: ${executorId}.` : null,
    runId ? `Run id: ${runId}.` : null,
    link?.startedAt ? `Started: ${formatTimestamp(link.startedAt)}.` : null,
  ];

  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

function scrollToSelectedTaskReport() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-human-log-report")
    ?.scrollIntoView({ block: "nearest" });
}

function ResultEvidencePanel({
  onShowQueueReportInWorkspaceChat,
  queue,
  selectedTask,
}: {
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>;
}) {
  const report = queue.workerReport.latestReport;
  const reportCard = queue.reportActionCard.workerReportCard;
  const runEvidence = directWorkEvidenceForQueue(queue);
  const failed = isFailedRunEvidence(queue, selectedTask);
  const state = resultEvidenceState(queue, selectedTask, report, runEvidence);

  return (
    <section
      aria-label="Result / Evidence"
      className="agent-queue-expanded-section agent-queue-human-log-report agent-queue-result-evidence"
      id="agent-queue-human-log-report"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Result / Evidence</p>
          <p className="agent-queue-execution-group-title">
            {state.title}
          </p>
          <p className="agent-queue-run-note">
            {state.copy}
          </p>
        </div>
        <Badge variant={state.badgeVariant}>{state.badge}</Badge>
      </div>

      {report ? (
        <WorkerReportEvidenceSummary
          onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
          queue={queue}
          report={report}
          reportCard={reportCard}
        />
      ) : runEvidence ? (
        <DirectWorkEvidenceSummary evidence={runEvidence} queue={queue} />
      ) : hasFinishedRunLink(queue) || isReportReadyStatus(selectedTask.status) ? (
        <div className="agent-queue-human-report-summary">
          <p className="agent-queue-worker-report-summary">
            {queue.runEvidence.isLoading
              ? "Loading run result..."
              : failed
                ? "Failure evidence missing."
                : "No run evidence attached."}
          </p>
          <p className="agent-queue-run-note">
            {queue.runEvidence.isLoading
              ? "Direct Work finished. Hobit is loading the linked result evidence before coordinator review."
              : "Review is not ready. Rerun the task, attach a report, or inspect Developer details before making a coordinator decision."}
          </p>
          {!queue.runEvidence.isLoading && queue.runEvidence.error ? (
            <p
              className="agent-queue-message agent-queue-message-error"
              role="alert"
            >
              {queue.runEvidence.error}
            </p>
          ) : null}
          <div className="agent-queue-run-actions">
            <Button
              disabled={!queue.runEvidence.apiAvailable || queue.runEvidence.isLoading}
              onClick={() => queue.runEvidence.onRefresh()}
              variant="secondary"
            >
              Refresh result
            </Button>
            <Button
              disabled={!queue.workerReport.canAttach}
              onClick={() => queue.workerReport.onAttachDemoReport()}
              variant="secondary"
            >
              Attach report
            </Button>
            <Button onClick={() => scrollToDeveloperDetails()} variant="ghost">
              Developer details
            </Button>
          </div>
        </div>
      ) : (
        <p className="agent-queue-run-note">
          {selectedTask.status === "running"
            ? "Report pending. The local executor has not reported a final result yet."
            : "No run evidence attached. Run the task or attach a report before coordinator review."}
        </p>
      )}
    </section>
  );
}

function resultEvidenceState(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
  report: AgentQueueWorkerExecutionReport | null,
  runEvidence: DirectWorkEvidence | null,
) {
  const failed = isFailedRunEvidence(queue, selectedTask);
  const hasEvidence = Boolean(report || runEvidence);

  if (selectedTask.status === "running" || queue.latestRun.link?.status === "running") {
    return {
      badge: "Report pending",
      badgeVariant: "warning" as const,
      copy: "The local executor is still running. Coordinator review waits for evidence.",
      title: "Report pending",
    };
  }

  if (hasEvidence) {
    return {
      badge: failed ? "Run failed" : "Report ready",
      badgeVariant: failed ? ("error" as const) : ("success" as const),
      copy: "Evidence summary for coordinator review. Raw output is collapsed below.",
      title: failed ? "Run failed" : "Report ready",
    };
  }

  if (hasFinishedRunLink(queue) || isReportReadyStatus(selectedTask.status)) {
    return {
      badge: failed ? "Failure evidence missing" : "Evidence missing",
      badgeVariant: "warning" as const,
      copy: "Execution finished without loaded worker report or Direct Work result evidence.",
      title: failed ? "Failure evidence missing" : "Evidence missing",
    };
  }

  return {
    badge: "No run evidence",
    badgeVariant: "neutral" as const,
    copy: "Run the task or attach a report before coordinator review.",
    title: "No run evidence attached",
  };
}

function ActivityTimelinePanel({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>;
}) {
  const entries = buildHumanTimeline(queue, selectedTask);

  return (
    <section
      aria-label="Activity timeline"
      className="agent-queue-expanded-section agent-queue-activity-timeline"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Activity timeline</p>
          <p className="agent-queue-execution-group-title">Review milestones</p>
        </div>
        <Badge variant="neutral">{entries.length.toString()} events</Badge>
      </div>

      <div className="agent-queue-human-timeline">
        {entries.map((entry) => (
          <div className="agent-queue-human-timeline-item" key={entry.key}>
            <Badge variant={entry.badgeVariant}>{entry.badge}</Badge>
            <div>
              <p className="agent-queue-human-timeline-title">
                {entry.title}
              </p>
              <p className="agent-queue-human-timeline-copy">
                {entry.message}
              </p>
              {entry.time ? (
                <p
                  className="agent-queue-human-timeline-time"
                  title={entry.time}
                >
                  {formatTimestamp(entry.time)}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HumanReadableActivityPanel({
  onShowQueueReportInWorkspaceChat,
  queue,
  selectedTask,
}: {
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>;
}) {
  const report = queue.workerReport.latestReport;
  const reportCard = queue.reportActionCard.workerReportCard;
  const runEvidence = directWorkEvidenceForQueue(queue);
  const hasRunResult = Boolean(runEvidence);
  const failed = isFailedRunEvidence(queue, selectedTask);
  const entries = buildHumanTimeline(queue, selectedTask);

  return (
    <section
      aria-label="Human-readable logs and report"
      className="agent-queue-expanded-section agent-queue-human-log-report"
      id="agent-queue-human-log-report"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-execution-group-title">Logs and report</p>
          <p className="agent-queue-run-note">
            Readable task activity. Technical run metadata stays in Internal details.
          </p>
        </div>
        <Badge
          variant={
            report || hasRunResult
              ? failed
                ? "error"
                : "info"
              : selectedTask.status === "running"
                ? "warning"
                : "neutral"
          }
        >
          {report
            ? "Report attached"
            : hasRunResult
              ? failed
                ? "Run failed"
                : "Report ready"
              : selectedTask.status === "running"
                ? "Report pending"
                : "No report"}
        </Badge>
      </div>

      <div className="agent-queue-human-timeline">
        {entries.map((entry) => (
          <div className="agent-queue-human-timeline-item" key={entry.key}>
            <Badge variant={entry.badgeVariant}>{entry.badge}</Badge>
            <div>
              <p className="agent-queue-human-timeline-title">
                {entry.title}
              </p>
              <p className="agent-queue-human-timeline-copy">
                {entry.message}
              </p>
              {entry.time ? (
                <p className="agent-queue-human-timeline-time">
                  {formatTimestamp(entry.time)}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {report ? (
        <div className="agent-queue-human-report-summary">
          <p className="agent-queue-worker-report-summary">{report.summary}</p>
          {report.commandsRun.length > 0 ? (
            <p className="agent-queue-run-note">
              Commands reported: {report.commandsRun.join("; ")}
            </p>
          ) : null}
          {report.changedFiles.length > 0 ? (
            <p className="agent-queue-run-note">
              Changed files: {report.changedFiles.join(", ")}
            </p>
          ) : null}
          {report.errors.length > 0 ? (
            <p className="agent-queue-run-warning">
              Needs attention: {report.errors[0]}
            </p>
          ) : null}
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
              View report in Workspace Chat
            </Button>
          </div>
        </div>
      ) : runEvidence ? (
        <DirectWorkEvidenceSummary evidence={runEvidence} queue={queue} />
      ) : hasFinishedRunLink(queue) || isReportReadyStatus(selectedTask.status) ? (
        <div className="agent-queue-human-report-summary">
          <p className="agent-queue-worker-report-summary">
            {queue.runEvidence.isLoading
              ? "Loading run result..."
              : failed
                ? "Failure evidence missing."
                : "No run evidence attached."}
          </p>
          <p className="agent-queue-run-note">
            {queue.runEvidence.isLoading
              ? "Direct Work finished. Hobit is loading the linked result evidence before coordinator review."
              : "Review is not ready. Rerun the task, attach a report, or inspect Internal details before making a coordinator decision."}
          </p>
          {!queue.runEvidence.isLoading && queue.runEvidence.error ? (
            <p
              className="agent-queue-message agent-queue-message-error"
              role="alert"
            >
              {queue.runEvidence.error}
            </p>
          ) : null}
          <div className="agent-queue-run-actions">
            <Button
              disabled={!queue.runEvidence.apiAvailable || queue.runEvidence.isLoading}
              onClick={() => queue.runEvidence.onRefresh()}
              variant="secondary"
            >
              Refresh result
            </Button>
          </div>
        </div>
      ) : (
        <p className="agent-queue-run-note">
          {selectedTask.status === "running"
            ? "Report pending. The local executor has not reported a final result yet."
            : "No worker report has been attached yet."}
        </p>
      )}
    </section>
  );
}

type HumanTimelineEntry = {
  badge: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  key: string;
  message: string;
  time?: string | null;
  title: string;
};

function buildHumanTimeline(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
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
        message: "Waiting for worker report.",
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
      message: runEvidence?.status === "failed"
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
      badgeVariant:
        report.reportStatus === "failed" ? "error" : "info",
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
    entries.push({
      badge: "Review",
      badgeVariant: "warning",
      key: "coordinator-review-required",
      message: "Review report evidence and make an explicit coordinator decision.",
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
      : "Execution complete. Evidence is missing; review is not ready.";
  }

  if (status === "cancelled") {
    return hasEvidence
      ? "Execution was cancelled. Evidence is available for coordinator review."
      : "Execution was cancelled. Failure evidence is missing.";
  }

  return hasEvidence
    ? "Execution failed. Review the visible error evidence."
    : "Execution failed. Failure evidence is missing.";
}

function runTimelineBadgeVariant(
  status: string,
): HumanTimelineEntry["badgeVariant"] {
  if (status === "completed") {
    return "success";
  }

  if (status === "running") {
    return "info";
  }

  return "error";
}

type DirectWorkEvidence = {
  agentsSummary: string | null;
  changedFilesSummary: string | null;
  commandSummary: string | null;
  developerDetails: string | null;
  error: string | null;
  finalText: string;
  gitStatusSummary: string | null;
  status: "completed" | "failed";
  summary: string;
  visibleSummary: string;
  workingDirectory: string | null;
};

function WorkerReportEvidenceSummary({
  onShowQueueReportInWorkspaceChat,
  queue,
  report,
  reportCard,
}: {
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
  report: AgentQueueWorkerExecutionReport;
  reportCard: AgentQueueReportActionCard | null;
}) {
  const changedFiles =
    report.changedFiles.length === 0
      ? "none"
      : `${report.changedFiles.length.toString()} reported; see Developer details.`;
  const commandSummary =
    report.commandsRun.length === 0
      ? "No commands reported."
      : `${report.commandsRun.length.toString()} command${
          report.commandsRun.length === 1 ? "" : "s"
        } reported.`;

  return (
    <div className="agent-queue-human-report-summary">
      <dl className="agent-queue-result-evidence-facts">
        <div>
          <dt>Status</dt>
          <dd>{report.reportStatus === "failed" ? "Failed" : "Passed"}</dd>
        </div>
        <div>
          <dt>Worker</dt>
          <dd>{workerNameForReport(queue, report)}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{workerReportValidationLabel(report.validationResult)}</dd>
        </div>
        <div>
          <dt>Git status</dt>
          <dd>{summarizeGitStatusText(report.finalGitStatus) ?? "Not reported"}</dd>
        </div>
        <div>
          <dt>Files changed by this run</dt>
          <dd>{changedFiles}</dd>
        </div>
        <div>
          <dt>Commands</dt>
          <dd>{commandSummary}</dd>
        </div>
      </dl>

      <p className="agent-queue-worker-report-summary">
        {previewText(report.summary, 220)}
      </p>
      {report.errors.length > 0 ? (
        <p className="agent-queue-run-warning">
          Final error: {previewText(report.errors[0], 220)}
        </p>
      ) : null}
      {report.warnings.length > 0 ? (
        <p className="agent-queue-run-warning">
          Warning: {previewText(report.warnings[0], 220)}
        </p>
      ) : null}
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
          View report in Workspace Chat
        </Button>
      </div>
      <p className="agent-queue-run-note">
        Coordinator acceptance remains explicit; this report did not finalize
        the item.
      </p>
    </div>
  );
}

function DirectWorkEvidenceSummary({
  evidence,
  queue,
}: {
  evidence: DirectWorkEvidence;
  queue: AgentQueueController;
}) {
  return (
    <div className="agent-queue-human-report-summary">
      <dl className="agent-queue-result-evidence-facts">
        <div>
          <dt>Status</dt>
          <dd>{evidence.status === "failed" ? "Failed" : "Passed"}</dd>
        </div>
        <div>
          <dt>Working directory</dt>
          <dd>{evidence.workingDirectory ?? "Not reported"}</dd>
        </div>
        <div>
          <dt>AGENTS.md</dt>
          <dd>{evidence.agentsSummary ?? "Not reported"}</dd>
        </div>
        <div>
          <dt>Git status</dt>
          <dd>{evidence.gitStatusSummary ?? "Not reported"}</dd>
        </div>
        <div>
          <dt>Files changed by this run</dt>
          <dd>{evidence.changedFilesSummary ?? "none"}</dd>
        </div>
      </dl>
      <p className="agent-queue-worker-report-summary">
        {evidence.visibleSummary}
      </p>
      {evidence.error ? (
        <p className="agent-queue-run-warning">Final error: {evidence.error}</p>
      ) : null}
      {evidence.commandSummary ? (
        <p className="agent-queue-run-note">
          Command summary: {evidence.commandSummary}
        </p>
      ) : null}
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Full output</summary>
        <pre className="agent-queue-flow-selection-prompt">
          {evidence.finalText}
        </pre>
      </details>
      <p className="agent-queue-run-note">
        Execution completion is evidence for coordinator review. It is not
        coordinator acceptance or finalization.
      </p>
      <div className="agent-queue-run-actions">
        <Button
          disabled={!queue.runEvidence.apiAvailable || queue.runEvidence.isLoading}
          onClick={() => queue.runEvidence.onRefresh()}
          variant="secondary"
        >
          Refresh result
        </Button>
      </div>
      {evidence.developerDetails ? (
        <details className="agent-queue-details agent-queue-secondary-details">
          <summary>Raw Direct Work details</summary>
          <pre>{evidence.developerDetails}</pre>
        </details>
      ) : null}
    </div>
  );
}

function directWorkEvidenceForQueue(
  queue: AgentQueueController,
): DirectWorkEvidence | null {
  const detail = queue.runEvidence.detail;

  if (!detail) {
    return null;
  }

  const failed = isFailedStatus(
    detail.summary.status || detail.resultStatus || queue.latestRun.link?.status,
  );
  const error = firstNonEmpty([
    detail.errorMessage,
    failed ? detail.stderrPreview : null,
    failed ? detail.resultSummary : null,
  ]);
  const finalText = firstNonEmpty([
    detail.finalMessage,
    detail.resultContent,
    failed ? error : null,
    detail.resultSummary,
    detail.stdoutPreview,
    "Direct Work finished without a captured final response.",
  ]);
  const summary = firstNonEmpty([
    failed ? error : null,
    detail.finalMessage,
    detail.resultSummary,
    detail.resultContent,
    failed ? "Direct Work failed." : "Direct Work completed.",
  ]);
  const resultPayload = directWorkResultPayloadObject(detail);
  const commandSummary = commandSummaryLabel(resultPayload?.command_summary);
  const changedFilesSummary = firstNonEmpty([
    detail.changedFilesSummary,
    changedFilesSummaryLabel(resultPayload?.changed_files_summary),
    changedFilesSummaryLabel(resultPayload?.changed_files),
    changedFilesSummaryLabel(resultPayload?.git_changed_files_summary),
  ]);
  const allText = [detail.finalMessage, detail.resultSummary, detail.resultContent]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const workingDirectory = firstNonEmpty([
    stringPayloadValue(resultPayload, [
      "working_directory",
      "workingDirectory",
      "repo_root",
      "repoRoot",
      "cwd",
    ]),
    detail.summary.repoRoot,
  ]) || null;
  const agentsSummary = firstNonEmpty([
    stringPayloadValue(resultPayload, ["agents_md", "agentsMd", "agents_summary"]),
    extractAgentsSummary(allText),
  ]) || null;
  const gitStatusSummary = firstNonEmpty([
    stringPayloadValue(resultPayload, [
      "git_status_summary",
      "gitStatusSummary",
      "final_git_status",
      "finalGitStatus",
    ]),
    summarizeGitStatusText(
      stringPayloadValue(resultPayload, ["git_status", "gitStatus"]),
    ),
    extractGitStatusSummary(allText),
  ]) || null;
  const developerDetails = directWorkDeveloperDetails(detail);
  const visibleSummary = previewText(summary, 260);

  return {
    agentsSummary,
    changedFilesSummary: summarizeChangedFilesText(changedFilesSummary),
    commandSummary,
    developerDetails,
    error,
    finalText,
    gitStatusSummary,
    status: failed ? "failed" : "completed",
    summary,
    visibleSummary,
    workingDirectory,
  };
}

function directWorkDeveloperDetails(detail: AgentExecutorRunDetail) {
  const sections = [
    detail.resultPayload ? `Result payload:\n${detail.resultPayload}` : null,
    detail.stdoutPreview ? `Stdout preview:\n${detail.stdoutPreview}` : null,
    detail.stderrPreview ? `Stderr preview:\n${detail.stderrPreview}` : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join("\n\n") : null;
}

function directWorkResultPayloadObject(
  detail: AgentExecutorRunDetail,
): Record<string, unknown> | null {
  if (!detail.resultPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(detail.resultPayload);

    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function commandSummaryLabel(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : null))
      .filter((entry): entry is string => Boolean(entry))
      .join(" ") || null;
  }

  return null;
}

function changedFilesSummaryLabel(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry.trim();
        }

        if (entry && typeof entry === "object") {
          const path = (entry as { path?: unknown }).path;
          return typeof path === "string" ? path.trim() : null;
        }

        return null;
      })
      .filter((entry): entry is string => Boolean(entry))
      .join(", ") || null;
  }

  return null;
}

function stringPayloadValue(
  payload: Record<string, unknown> | null,
  keys: string[],
) {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function previewText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function extractAgentsSummary(text: string) {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => /AGENTS\.md/i.test(entry));

  if (!line) {
    return null;
  }

  const match = line.match(/AGENTS\.md\s*:?\s*(.+)$/i);

  return previewText(match?.[1] ?? line, 120);
}

function extractGitStatusSummary(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const gitLine = lines.find((entry) => /git status/i.test(entry));

  if (gitLine) {
    return summarizeGitStatusText(gitLine);
  }

  const branchLine = lines.find((entry) => /^On branch\b/i.test(entry));
  const shortStatusCount = lines.filter((entry) =>
    /^(M|A|D|R|C|\?\?|!!|AM|MM|UU|DD|DU|UD|UA|AU)\s/.test(entry),
  ).length;

  if (branchLine && shortStatusCount > 0) {
    return `${branchLine}; ${shortStatusCount.toString()} changed path${
      shortStatusCount === 1 ? "" : "s"
    }.`;
  }

  return branchLine ? `${branchLine}; clean or no changes reported.` : null;
}

function summarizeGitStatusText(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const text = value.trim();
  const lines = text.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  const branchLine = lines.find((entry) => /^On branch\b/i.test(entry));
  const shortStatusCount = lines.filter((entry) =>
    /^(M|A|D|R|C|\?\?|!!|AM|MM|UU|DD|DU|UD|UA|AU)\s/.test(entry),
  ).length;
  const clean = /nothing to commit|working tree clean|clean/i.test(text);

  if (branchLine) {
    if (shortStatusCount > 0) {
      return `${branchLine}; ${shortStatusCount.toString()} changed path${
        shortStatusCount === 1 ? "" : "s"
      }.`;
    }

    return clean ? `${branchLine}; clean.` : previewText(branchLine, 160);
  }

  if (shortStatusCount > 0) {
    return `${shortStatusCount.toString()} changed path${
      shortStatusCount === 1 ? "" : "s"
    } reported.`;
  }

  return previewText(text, 180);
}

function summarizeChangedFilesText(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();

  if (/^(none|no changed files|no files changed)$/i.test(normalized)) {
    return "none";
  }

  const files = normalized
    .split(/[,;\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (files.length === 0) {
    return null;
  }

  return `${files.length.toString()} reported; see Developer details.`;
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function hasFinishedRunLink(queue: AgentQueueController) {
  const status = queue.latestRun.link?.status;

  return Boolean(status && status !== "running" && status !== "unknown");
}

function hasReviewEvidenceForTask(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
) {
  return (
    (selectedTask.workerExecutionReports?.length ?? 0) > 0 ||
    Boolean(directWorkEvidenceForQueue(queue))
  );
}

function isFailedRunEvidence(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
) {
  return (
    isFailedStatus(selectedTask.status) ||
    isFailedStatus(queue.latestRun.link?.status) ||
    directWorkEvidenceForQueue(queue)?.status === "failed"
  );
}

function isFailedStatus(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "failed_to_start"
  );
}

function CoordinatorFinalizationPanel({
  queue,
}: {
  queue: AgentQueueController;
}) {
  const finalization = queue.coordinatorFinalization;
  const selectedTask = queue.selectedTask;
  const hasReport = selectedTask
    ? hasReviewEvidenceForTask(queue, selectedTask) ||
      Boolean(queue.reportActionCard.diffReviewReportCard)
    : false;
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

  if (!hasReport) {
    return (
      <section
        aria-label="Coordinator decision"
        className="agent-queue-expanded-section agent-queue-finalization"
      >
        <div className="agent-queue-expanded-section-header">
          <div>
            <p className="agent-queue-execution-group-title">
              Coordinator decision
            </p>
            <p className="agent-queue-run-note">
              Evidence is missing. Final acceptance is disabled until a worker
              report or Direct Work result is attached.
            </p>
          </div>
          <Badge variant="warning">Evidence missing</Badge>
        </div>
        <div className="agent-queue-finalization-actions">
          <Button disabled={true} onClick={() => finalization.onFinalize()} variant="secondary">
            Accept result
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onMarkNeedsChanges()}
            variant="secondary"
          >
            Request changes
          </Button>
          <Button
            disabled={!finalization.canAct}
            onClick={() => finalization.onCreateFollowUp()}
            variant="secondary"
          >
            Create follow-up
          </Button>
          <Button onClick={() => scrollToDeveloperDetails()} variant="ghost">
            Developer details
          </Button>
        </div>
        {finalization.message ? (
          <p className="agent-queue-message">{finalization.message}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Coordinator decision"
      className="agent-queue-expanded-section agent-queue-finalization"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-execution-group-title">
            Coordinator decision
          </p>
          <p className="agent-queue-run-note">
            Choose one explicit next state. Reports are not accepted
            automatically.
          </p>
        </div>
        <Badge variant={coordinatorStatusBadgeVariant(finalization.status)}>
          {coordinatorStatusLabel(finalization.status)}
        </Badge>
      </div>
      <div className="agent-queue-finalization-actions">
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onFinalize()}
          variant="primary"
        >
          Accept result
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onMarkNeedsChanges()}
          variant="secondary"
        >
          Request changes
        </Button>
        <Button
          disabled={!finalization.canAct}
          onClick={() => finalization.onCreateFollowUp()}
          variant="secondary"
        >
          Create follow-up
        </Button>
      </div>
      <details className="agent-queue-details agent-queue-secondary-details agent-queue-decision-more">
        <summary>More</summary>
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
          <Button onClick={() => scrollToDeveloperDetails()} variant="ghost">
            Raw details
          </Button>
        </div>
      </details>
      {finalization.message ? (
        <p className="agent-queue-message">{finalization.message}</p>
      ) : null}
    </section>
  );
}

function scrollToDeveloperDetails() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-developer-details")
    ?.scrollIntoView({ block: "nearest" });
}

function SelectedTaskOverview({
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
      aria-label="Selected task overview"
      className="agent-queue-expanded-header agent-queue-overview"
    >
      <div className="agent-queue-expanded-heading">
        <div>
          <p className="agent-queue-expanded-kicker">Overview</p>
          <h3>{displayTaskTitle(selectedTask)}</h3>
          <p className="agent-queue-overview-state">
            {overviewStateSentence(queue, selectedTask, executorInfo.label)}
          </p>
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
        <Badge variant="neutral">
          Priority {queueTaskPriorityLabel(selectedTask.priority)}
        </Badge>
        {queue.ordering.orderLabel ? (
          <Badge variant="neutral">Order {queue.ordering.orderLabel}</Badge>
        ) : null}
        <Badge variant={statusBadgeVariant(selectedTask.status)}>
          {selectedTaskStatusRailLabel(selectedTask)}
        </Badge>
        {selectedTask.coordinatorStatus &&
        selectedTask.coordinatorStatus !== "not_reported" &&
        hasReviewEvidenceForTask(queue, selectedTask) ? (
          <Badge variant={coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus)}>
            {coordinatorStatusLabel(selectedTask.coordinatorStatus)}
          </Badge>
        ) : hasReviewEvidenceForTask(queue, selectedTask) ? (
          <Badge variant="warning">
            Awaiting coordinator review
          </Badge>
        ) : null}
      </div>

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
  const runEvidence = directWorkEvidenceForQueue(queue);
  const hasRunResult = Boolean(runEvidence) || hasFinishedRunLink(queue);

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
              {hasRunResult
                ? "No structured worker report is attached. Direct Work output is shown as run evidence."
                : "No worker report yet. Run or attach a worker report to review evidence."}
            </p>
          </div>
          <Badge variant={hasRunResult ? "info" : "neutral"}>
            {hasRunResult ? "Run result available" : "No report"}
          </Badge>
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
  const promptText = prompt || "No prompt has been written for this task.";
  const summary = promptSummary(promptText);

  return (
    <section
      aria-label="Prompt summary"
      className="agent-queue-expanded-section agent-queue-prompt-preview"
    >
      <div>
        <p className="agent-queue-expanded-kicker">Prompt summary</p>
        <p className="agent-queue-prompt-preview-text">
          {summary}
        </p>
      </div>
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Full prompt</summary>
        <pre>{promptText}</pre>
      </details>
    </section>
  );
}

function promptSummary(prompt: string) {
  const lines = meaningfulPromptLines(prompt);

  if (lines.length === 0) {
    return "No prompt has been written for this task.";
  }

  const title = firstPromptTitle(lines);
  const mode = labeledPromptValue(lines, "mode");
  const objective = firstSentence(labeledPromptValue(lines, "objective"));
  const parts = [
    title ? previewText(title, 90) : null,
    mode ? `Mode: ${previewText(mode, 70)}` : null,
    objective ? `Objective: ${previewText(objective, 140)}` : null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  return previewText(lines.slice(0, 2).join(" "), 180);
}

function meaningfulPromptLines(prompt: string) {
  return prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[-*]\s+/.test(line));
}

function firstPromptTitle(lines: string[]) {
  const titleLine = lines.find((line) => /^title\s*:/i.test(line));

  if (titleLine) {
    return titleLine.replace(/^title\s*:\s*/i, "").trim();
  }

  const firstLine = lines.find((line) => !/^(mode|objective)\s*:/i.test(line));

  return firstLine?.replace(/^#+\s*/, "").trim() || null;
}

function labeledPromptValue(lines: string[], label: "mode" | "objective") {
  const labelPattern = new RegExp(`^${label}\\s*:\\s*(.*)$`, "i");
  const labelOnlyPattern = new RegExp(`^${label}\\s*:?\\s*$`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const inlineMatch = line.match(labelPattern);

    if (inlineMatch?.[1]?.trim()) {
      return inlineMatch[1].trim();
    }

    if (labelOnlyPattern.test(line)) {
      const next = lines
        .slice(index + 1)
        .find((entry) => !/^[A-Z][A-Za-z /-]*\s*:?\s*$/.test(entry));

      return next ?? null;
    }
  }

  return null;
}

function firstSentence(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.+?[.!?])(?:\s|$)/);

  return (match?.[1] ?? value).trim();
}

function overviewStateSentence(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
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
        ? "Execution complete. Evidence is ready for coordinator review."
        : "Execution complete. Evidence missing. Review not ready.";
    case "failed":
      return hasEvidence
        ? "Execution failed. Review the evidence and request changes if needed."
        : "Execution failed. Failure evidence missing. Review not ready.";
    case "cancelled":
      return hasEvidence
        ? "Execution was cancelled. Review the attached evidence."
        : "Execution was cancelled. Evidence missing. Review not ready.";
    case "review_needed":
      return hasEvidence
        ? "Evidence is ready for human review."
        : "Review requested, but evidence is missing.";
    case "queued":
    case "ready":
      return `${statusLabel(selectedTask.status)} task. It runs only after an explicit operator action.`;
    default:
      return `${statusLabel(selectedTask.status)} task.`;
  }
}

function overviewNextStep(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
) {
  if (selectedTask.status === "running" || queue.latestRun.link?.status === "running") {
    return "Next: Waiting for worker report.";
  }

  if (hasReviewEvidenceForTask(queue, selectedTask)) {
    return "Next: review report and make coordinator decision.";
  }

  if (isReportReadyStatus(selectedTask.status) || hasFinishedRunLink(queue)) {
    return "Next: rerun task, attach report, or inspect developer details.";
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
    return "Next: attach evidence before making a coordinator decision.";
  }

  if (queue.run.readinessMessage) {
    return `Next: ${compactNextActionBlocker(queue.run.readinessMessage)}`;
  }

  return "Next: check the prompt, settings, and latest activity before acting.";
}

function autonomousNextActionForSelectedTask(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
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
      copy:
        "Autonomous runner started this task. Waiting for worker report.",
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
    secondaryCopy:
      "Manual controls return when the autonomous runner is idle.",
    title: "Queued for autonomous execution",
    tone: "waiting",
  };
}

function selectedTaskIsAutonomousEligible(
  queue: AgentQueueController,
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
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

function formatTimestamp(value: string) {
  return formatUpdatedTimestamp(value) ?? value;
}

function latestReportLabel(
  queue: AgentQueueController,
  task: NonNullable<AgentQueueController["selectedTask"]>,
) {
  if (task.workerExecutionReports && task.workerExecutionReports.length > 0) {
    return "Reported / awaiting coordinator review";
  }

  if (directWorkEvidenceForQueue(queue)) {
    return isFailedRunEvidence(queue, task)
      ? "Run failed / awaiting coordinator review"
      : "Run result available";
  }

  if (hasFinishedRunLink(queue) || isReportReadyStatus(task.status)) {
    return isFailedRunEvidence(queue, task)
      ? "Failure evidence missing"
      : "Evidence missing";
  }

  return "No worker report";
}

function selectedTaskStatusRailLabel(
  task: NonNullable<AgentQueueController["selectedTask"]>,
) {
  switch (task.status) {
    case "completed":
      return "Execution complete";
    case "failed":
      return "Run failed";
    case "cancelled":
      return "Run cancelled";
    case "review_needed":
      return "Report ready";
    default:
      return statusLabel(task.status);
  }
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
