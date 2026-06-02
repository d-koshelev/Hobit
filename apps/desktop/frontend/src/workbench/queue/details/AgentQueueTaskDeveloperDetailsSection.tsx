import type { ReactNode } from "react";
import {
  AgentQueueTaskRunAdvancedDetails,
} from "../../AgentQueueTaskRunPanel";
import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import {
  displayTaskTitle,
  normalizeItemType,
  normalizeQueueTag,
} from "../../agentQueueTaskUiModel";
import { diffReviewSourceLabel } from "../agentQueueDiffReviewModel";
import type {
  AgentExecutorRunOpenRequestInput,
  AgentExecutorSlot,
  CoordinatorAttachedContextInput,
} from "../../types";
import type {
  AgentQueueReportActionCard,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import {
  directWorkEvidenceForQueue,
  hasFinishedRunLink,
} from "./agentQueueTaskDetailsEvidence";
import {
  formatTimestamp,
  reviewModeLabel,
  workerNameForReport,
  workerReportStatusLabel,
  workerReportValidationLabel,
} from "./agentQueueTaskDetailsFormatters";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";
import { RawRunActivityDetails } from "./AgentQueueTaskActivityTimelineSection";

export function AgentQueueTaskDeveloperDetailsSection({
  agentExecutorSlots,
  onAttachContextToCoordinator,
  onOpenAgentExecutorRun,
  onShowQueueReportInWorkspaceChat,
  queue,
  selectedTask,
  showDiffReviewLinkage = false,
  showSubmittedMetadata = false,
  showWorkerExecutionReport = false,
  taskEditMetadata,
}: {
  agentExecutorSlots: AgentExecutorSlot[];
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
  showDiffReviewLinkage?: boolean;
  showSubmittedMetadata?: boolean;
  showWorkerExecutionReport?: boolean;
  taskEditMetadata?: ReactNode;
}) {
  const queueTag = normalizeQueueTag(selectedTask);

  return (
    <details
      className="agent-queue-details agent-queue-secondary-details agent-queue-internal-details"
      id="agent-queue-developer-details"
    >
      <summary>Developer details</summary>
      {showDiffReviewLinkage ? (
        <DiffReviewLinkagePanel
          onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
          queue={queue}
        />
      ) : null}
      {showWorkerExecutionReport ? (
        <WorkerExecutionReportPanel
          onShowQueueReportInWorkspaceChat={onShowQueueReportInWorkspaceChat}
          queue={queue}
        />
      ) : null}
      <AgentQueueTaskRunAdvancedDetails
        autorun={queue.autorun}
        dependencyState={queue.dependencyStates.get(selectedTask.queueItemId)}
        executorSlots={agentExecutorSlots}
        executionPlan={queue.executionPlan}
        latestRun={queue.latestRun}
        onAttachContextToCoordinator={onAttachContextToCoordinator}
        onOpenAgentExecutorRun={onOpenAgentExecutorRun}
        queueTag={queueTag}
        queueTagSummary={queue.foundation.queueTags.find(
          (tag) => tag.queueTagId === queueTag.queueTagId,
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
        run={queue.run}
        runHistory={queue.runHistory}
        runner={queue.runner}
        selectedTask={selectedTask}
        wrapInDetails={false}
      />
      <RawRunActivityDetails queue={queue} />
      {showSubmittedMetadata ? <SubmittedMetadata queue={queue} /> : null}
      {taskEditMetadata}
    </details>
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

export function SubmittedMetadata({
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
