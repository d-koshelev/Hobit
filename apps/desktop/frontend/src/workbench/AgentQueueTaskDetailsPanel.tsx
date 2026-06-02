import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  displayTaskTitle,
  coordinatorStatusBlocksNewWork,
  coordinatorStatusBadgeVariant,
  coordinatorStatusLabel,
  normalizeQueueTag,
  normalizeValidationStatus,
  queueExecutorInfoBadgeVariant,
  queueExecutorInfoForTask,
  statusBadgeVariant,
  statusLabel,
  validationBadgeVariant,
  validationStatusLabel,
} from "./agentQueueTaskUiModel";
import { executionPlanStatusLabel } from "./queue/agentQueueExecutionPlanModel";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "./types";
import type { AgentQueueReportActionCard } from "../workspace/types";
import { AgentQueueTaskActivityTimelineSection } from "./queue/details/AgentQueueTaskActivityTimelineSection";
import { AgentQueueTaskCoordinatorDecisionSection } from "./queue/details/AgentQueueTaskCoordinatorDecisionSection";
import {
  AgentQueueTaskDeveloperDetailsSection,
  SubmittedMetadata,
} from "./queue/details/AgentQueueTaskDeveloperDetailsSection";
import { AgentQueueTaskOverviewSection } from "./queue/details/AgentQueueTaskOverviewSection";
import { AgentQueueTaskPromptSection } from "./queue/details/AgentQueueTaskPromptSection";
import { AgentQueueTaskResultEvidenceSection } from "./queue/details/AgentQueueTaskResultEvidenceSection";
import {
  compactNextActionBlocker,
  isReportReadyStatus,
  isRunSettingPrecondition,
} from "./queue/details/agentQueueTaskDetailsFormatters";
import {
  directWorkEvidenceForQueue,
  hasFinishedRunLink,
  hasReviewEvidenceForTask,
  isFailedRunEvidence,
  isSelectedTaskRunning,
  latestReportLabel,
} from "./queue/details/agentQueueTaskDetailsEvidence";
import type { AgentQueueController } from "./queue/details/agentQueueTaskDetailsTypes";
import { autonomousNextActionForSelectedTask } from "./queue/details/agentQueueTaskDetailsViewModel";

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
          <AgentQueueTaskOverviewSection queue={queue} selectedTask={selectedTask} />

          <AgentQueueTaskPromptSection prompt={selectedTask.prompt} />

          {isSelectedTaskRunning(queue, selectedTask) ? (
            <>
              <AgentQueueTaskActivityTimelineSection queue={queue} selectedTask={selectedTask} />

              <AgentQueueTaskResultEvidenceSection
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                queue={queue}
                selectedTask={selectedTask}
              />

              <AgentQueueTaskDeveloperDetailsSection
                agentExecutorSlots={agentExecutorSlots}
                onAttachContextToCoordinator={onAttachContextToCoordinator}
                onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                queue={queue}
                selectedTask={selectedTask}
                showSubmittedMetadata={true}
              />
            </>
          ) : hasReviewEvidenceForTask(queue, selectedTask) ? (
            <>
              <AgentQueueTaskActivityTimelineSection queue={queue} selectedTask={selectedTask} />

              <AgentQueueTaskResultEvidenceSection
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                queue={queue}
                selectedTask={selectedTask}
              />

              <AgentQueueTaskCoordinatorDecisionSection queue={queue} />

              <AgentQueueTaskDeveloperDetailsSection
                agentExecutorSlots={agentExecutorSlots}
                onAttachContextToCoordinator={onAttachContextToCoordinator}
                onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                queue={queue}
                selectedTask={selectedTask}
                showDiffReviewLinkage={true}
                showSubmittedMetadata={true}
                showWorkerExecutionReport={true}
                taskEditMetadata={
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
                }
              />
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

              <AgentQueueTaskActivityTimelineSection queue={queue} selectedTask={selectedTask} />

              <AgentQueueTaskResultEvidenceSection
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                queue={queue}
                selectedTask={selectedTask}
              />

              <AgentQueueTaskDeveloperDetailsSection
                agentExecutorSlots={agentExecutorSlots}
                onAttachContextToCoordinator={onAttachContextToCoordinator}
                onOpenAgentExecutorRun={onOpenAgentExecutorRun}
                onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
                queue={queue}
                selectedTask={selectedTask}
                showDiffReviewLinkage={true}
                showWorkerExecutionReport={true}
              />

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
              Queue tasks are workspace-local records. Queue shows safe
              event-driven activity for selected runs, while raw execution
              detail remains Executor-owned. Queue does not run hidden
              background scheduling, launch Terminal commands, or mutate Git.
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
      copy: "Running - waiting for final response.",
      secondaryCopy: null,
      title: "Agent activity",
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

function scrollToSelectedTaskReport() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-human-log-report")
    ?.scrollIntoView({ block: "nearest" });
}

function scrollToDeveloperDetails() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-developer-details")
    ?.scrollIntoView({ block: "nearest" });
}
