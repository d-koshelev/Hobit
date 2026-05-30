import type { useAgentQueueController } from "./queue/useAgentQueueController";
import { AgentQueueEmptySelection } from "./AgentQueueEmptySelection";
import { AgentQueueTaskRunPanel } from "./AgentQueueTaskRunPanel";
import { AgentQueueTaskSection } from "./AgentQueueTaskSection";
import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import {
  displayTaskTitle,
  formatUpdatedTimestamp,
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
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "./types";
import type { AgentQueueWorkerExecutionReport } from "../workspace/types";

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

          <SubmittedMetadata queue={queue} />

          <PromptPreview prompt={selectedTask.prompt} />

          <WorkerExecutionReportPanel queue={queue} />

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
            inputId={assignmentInputId}
            isAssigning={isAssigning}
            isDirty={isDirty || editTask.isEditing}
            latestRun={queue.latestRun}
            onAssign={() => void assignSelectedTask()}
            onClear={() => void clearSelectedTaskAssignment()}
            onOpenAgentExecutorRun={onOpenAgentExecutorRun}
            onAttachContextToCoordinator={onAttachContextToCoordinator}
            onSelectionChange={(executorWidgetInstanceId) => {
              selectExecutorWidget(executorWidgetInstanceId);
            }}
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
          <dt>Report</dt>
          <dd>{latestReportLabel(selectedTask)}</dd>
        </div>
        <div>
          <dt>Live timer</dt>
          <dd>{liveTimerCopy(queue)}</dd>
        </div>
      </dl>
    </section>
  );
}

function WorkerExecutionReportPanel({
  queue,
}: {
  queue: AgentQueueController;
}) {
  const report = queue.workerReport.latestReport;

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

      {report ? (
        <WorkerReportSummary
          report={report}
          workerName={workerNameForReport(queue, report)}
        />
      ) : (
        <p className="agent-queue-run-note">
          No worker report is attached. Attach a model-only report to preview
          the coordinator review surface without starting execution.
        </p>
      )}

      <div className="agent-queue-run-actions">
        <Button
          disabled={!queue.workerReport.canAttach}
          onClick={() => queue.workerReport.onAttachDemoReport()}
          variant={report ? "secondary" : "primary"}
        >
          {report ? "Attach another report" : "Attach worker report"}
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
    <details className="agent-queue-expanded-section agent-queue-prompt-preview">
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
