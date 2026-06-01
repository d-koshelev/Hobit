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
            dependencyState={queue.dependencyStates.get(selectedTask.queueItemId)}
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
          <dd>{latestReportLabel(selectedTask)}</dd>
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

  if (isReportReadyStatus(selectedTask.status) || hasReport) {
    actions.push({
      label: "View report",
      onClick: () => scrollToSelectedTaskReport(),
      variant: "primary",
    });

    if (queue.coordinatorFinalization.status === "ready_for_finalization") {
      actions.push({
        disabled: !queue.coordinatorFinalization.canAct,
        label: "Finalize / Accept",
        onClick: () => queue.coordinatorFinalization.onFinalize(),
        variant: "secondary",
      });
    } else {
      actions.push({
        disabled: !queue.coordinatorFinalization.canAct,
        label: "Mark ready for finalization",
        onClick: () => queue.coordinatorFinalization.onMarkReadyForFinalization(),
        variant: "secondary",
      });
    }

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Request changes",
      onClick: () => queue.coordinatorFinalization.onMarkNeedsChanges(),
      variant: "secondary",
    });

    return {
      actions,
      badge: hasReport ? "Report ready" : statusLabel(selectedTask.status),
      badgeVariant: hasReport ? ("info" as const) : statusBadgeVariant(selectedTask.status),
      copy: hasReport
        ? "Report ready / awaiting coordinator review."
        : "Run finished. Review the report area and make an explicit coordinator decision.",
      secondaryCopy: hasReport
        ? "Use View report, then coordinator actions when relevant."
        : "No worker report is attached yet.",
      title: "Awaiting coordinator review",
      tone: "review",
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
      title: "Ready to run",
      tone: "ready",
    };
  }

  if (coordinatorStatusBlocksNewWork(selectedTask.coordinatorStatus)) {
    actions.push({
      label: "View report",
      onClick: () => scrollToSelectedTaskReport(),
      variant: "primary",
    });

    if (queue.coordinatorFinalization.status === "ready_for_finalization") {
      actions.push({
        disabled: !queue.coordinatorFinalization.canAct,
        label: "Finalize / Accept",
        onClick: () => queue.coordinatorFinalization.onFinalize(),
        variant: "secondary",
      });
    } else {
      actions.push({
        disabled: !queue.coordinatorFinalization.canAct,
        label: "Mark ready for finalization",
        onClick: () => queue.coordinatorFinalization.onMarkReadyForFinalization(),
        variant: "secondary",
      });
    }

    actions.push({
      disabled: !queue.coordinatorFinalization.canAct,
      label: "Request changes",
      onClick: () => queue.coordinatorFinalization.onMarkNeedsChanges(),
      variant: "secondary",
    });

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
    return {
      actions,
      badge: "Ready",
      badgeVariant: "info" as const,
      copy: compactNextActionBlocker(preconditionMessage),
      secondaryCopy: null,
      title: "Set run settings",
      tone: "ready",
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

  if (/START|Start queue|stopped/i.test(message)) {
    return "Start queue.";
  }

  return message;
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
        <Badge variant={report ? "info" : selectedTask.status === "running" ? "warning" : "neutral"}>
          {report
            ? "Report attached"
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

    entries.push({
      badge: runTimelineBadge(latestRun.status),
      badgeVariant: runTimelineBadgeVariant(latestRun.status),
      key: "run-finished",
      message:
        latestRun.status === "running"
          ? "Waiting for worker report."
          : `Latest linked run is ${latestRun.status}.`,
      time: latestRun.completedAt,
      title:
        latestRun.status === "running" ? "Run still running" : "Run completed / failed",
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
    return "Done";
  }

  if (status === "running") {
    return "Running";
  }

  return "Failed";
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
          Request changes
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
            {overviewStateSentence(selectedTask, executorInfo.label)}
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
          {statusLabel(selectedTask.status)}
        </Badge>
        {selectedTask.coordinatorStatus &&
        selectedTask.coordinatorStatus !== "not_reported" ? (
          <Badge variant={coordinatorStatusBadgeVariant(selectedTask.coordinatorStatus)}>
            {coordinatorStatusLabel(selectedTask.coordinatorStatus)}
          </Badge>
        ) : null}
      </div>

      <p className="agent-queue-overview-next">
        {overviewNextStep(queue, selectedTask)}
      </p>
      <div className="agent-queue-overview-secondary">
        <span>{executorInfo.label}</span>
        {latestReportLabel(selectedTask) !== "No worker report" ? (
          <span>{latestReportLabel(selectedTask)}</span>
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
      <pre>{prompt || "No prompt has been written for this task."}</pre>
      <p className="agent-queue-run-note">
        Expected plan metadata is kept separate from the prompt text.
      </p>
    </details>
  );
}

function overviewStateSentence(
  selectedTask: NonNullable<AgentQueueController["selectedTask"]>,
  executorLabel: string,
) {
  switch (selectedTask.status) {
    case "draft":
      return "Draft task. It will not run until the operator promotes it.";
    case "running":
      return `Running. ${executorLabel} is executing this task.`;
    case "completed":
      return "Execution completed. Review the report before accepting the work.";
    case "failed":
      return "Execution failed. Review the report and request changes if needed.";
    case "cancelled":
      return "Execution was cancelled by operator action.";
    case "review_needed":
      return "Output is ready for human review.";
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

  if (isReportReadyStatus(selectedTask.status) || latestReportLabel(selectedTask) !== "No worker report") {
    return "Next: view the report and make an explicit coordinator decision.";
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
    return "Next: review the report and make an explicit coordinator decision.";
  }

  if (queue.run.readinessMessage) {
    return `Next: ${compactNextActionBlocker(queue.run.readinessMessage)}`;
  }

  return "Next: check the prompt, settings, and latest activity before acting.";
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
