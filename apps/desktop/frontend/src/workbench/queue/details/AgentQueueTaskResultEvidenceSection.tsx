import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import type {
  AgentQueueReportActionCard,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import {
  directWorkEvidenceForQueue,
  hasFinishedRunLink,
  isFailedRunEvidence,
  isSelectedTaskRunning,
  resultEvidenceState,
  summarizeGitStatusText,
} from "./agentQueueTaskDetailsEvidence";
import {
  isReportReadyStatus,
  previewText,
  workerNameForReport,
  workerReportValidationLabel,
} from "./agentQueueTaskDetailsFormatters";
import type {
  AgentQueueController,
  DirectWorkEvidence,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";

export function AgentQueueTaskResultEvidenceSection({
  onShowQueueReportInWorkspaceChat,
  queue,
  selectedTask,
}: {
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
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
          {isSelectedTaskRunning(queue, selectedTask)
            ? "Result will appear here when the run completes."
            : "No run evidence attached. Run the task or attach a report before coordinator review."}
        </p>
      )}
    </section>
  );
}

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

export function DirectWorkEvidenceSummary({
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

function scrollToDeveloperDetails() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-developer-details")
    ?.scrollIntoView({ block: "nearest" });
}
