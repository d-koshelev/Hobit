import { useState, type ReactNode } from "react";
import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import type {
  AgentQueueReportActionCard,
  AgentQueueWorkerExecutionReport,
} from "../../../workspace/types";
import {
  parseKnowledgeDraftPackFromText,
  type KnowledgeDraftReviewPack,
} from "../../knowledgeDraftPacks";
import {
  directWorkEvidenceForQueue,
  finalResponseEvidence,
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
  FinalResponseEvidence,
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
  const shouldShowContextEvidence = Boolean(
    selectedTask.context?.attachedKnowledgeSnapshots.length &&
      (report || runEvidence || hasFinishedRunLink(queue)),
  );

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
          {state.copy ? (
            <p className="agent-queue-run-note">
              {state.copy}
            </p>
          ) : null}
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
      {shouldShowContextEvidence ? (
        <QueueContextEvidenceSummary selectedTask={selectedTask} />
      ) : null}
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
      ? "None"
      : `${report.changedFiles.length.toString()} reported; see Developer details.`;
  const finalResponse = finalResponseEvidence(workerReportFinalResponse(report));
  const failed = report.reportStatus === "failed";
  const draftPack = parseKnowledgeDraftPackFromText(
    workerReportFinalResponse(report),
  );

  return (
    <div className="agent-queue-human-report-summary">
      <FinalResponseBlock
        label={failed && !report.rawReportPreview?.trim() ? "Failure summary" : "Final response"}
        response={finalResponse}
      />
      {draftPack ? <KnowledgeDraftPackNotice pack={draftPack} /> : null}

      <dl className="agent-queue-result-evidence-facts agent-queue-result-evidence-facts-primary">
        <div>
          <dt>Files changed by this run</dt>
          <dd>{changedFiles}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{failed ? "Failed" : "Passed"}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{workerReportValidationLabel(report.validationResult)}</dd>
        </div>
      </dl>

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
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Report metadata</summary>
        <dl className="agent-queue-result-evidence-facts">
          <div>
            <dt>Worker</dt>
            <dd>{workerNameForReport(queue, report)}</dd>
          </div>
          <div>
            <dt>Git status</dt>
            <dd>{summarizeGitStatusText(report.finalGitStatus) ?? "Not reported"}</dd>
          </div>
          {report.commandsRun.length > 0 ? (
            <div>
              <dt>Commands</dt>
              <dd>
                {`${report.commandsRun.length.toString()} command${
                  report.commandsRun.length === 1 ? "" : "s"
                } reported.`}
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="agent-queue-worker-report-summary">
          {previewText(report.summary, 220)}
        </p>
      </details>
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
  );
}

function QueueContextEvidenceSummary({
  selectedTask,
}: {
  selectedTask: SelectedAgentQueueTask;
}) {
  const snapshots = selectedTask.context?.attachedKnowledgeSnapshots ?? [];
  const warnings = selectedTask.context?.contextWarnings ?? [];
  const tokenEstimate =
    selectedTask.context?.contextTokenBudget.estimatedTokens ?? 0;

  if (snapshots.length === 0) {
    return null;
  }

  return (
    <details className="agent-queue-details agent-queue-secondary-details">
      <summary>Context used</summary>
      <dl className="agent-queue-result-evidence-facts">
        <div>
          <dt>Queue task</dt>
          <dd>{selectedTask.queueItemId}</dd>
        </div>
        <div>
          <dt>Snapshots</dt>
          <dd>{snapshots.length.toString()} used</dd>
        </div>
        <div>
          <dt>Token estimate</dt>
          <dd>{tokenEstimate.toString()}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{warnings.length > 0 ? warnings.map((warning) => warning.id).join(", ") : "None"}</dd>
        </div>
      </dl>
      <pre className="agent-queue-flow-selection-prompt">
        {snapshots
          .map(
            (snapshot) =>
              `${snapshot.id}\n${snapshot.kind}: ${snapshot.sourceRefId}@${snapshot.version || "unknown"}\nScope: ${snapshot.scope}\nSource: ${snapshot.source}\nMaterialized: ${snapshot.materializedAt}`,
          )
          .join("\n\n")}
      </pre>
    </details>
  );
}

export function DirectWorkEvidenceSummary({
  evidence,
  queue,
}: {
  evidence: DirectWorkEvidence;
  queue: AgentQueueController;
}) {
  const failed = evidence.status === "failed";
  const finalResponse = finalResponseEvidence(evidence.finalText);
  const draftPack = parseKnowledgeDraftPackFromText(
    [evidence.finalText, evidence.developerDetails].filter(Boolean).join("\n\n"),
  );

  return (
    <div className="agent-queue-human-report-summary">
      <FinalResponseBlock
        label={failed ? "Failure summary" : "Final response"}
        response={finalResponse}
      />
      {draftPack ? <KnowledgeDraftPackNotice pack={draftPack} /> : null}
      {failed ? (
        <dl className="agent-queue-result-evidence-facts agent-queue-result-evidence-facts-primary">
          <div>
            <dt>Status</dt>
            <dd>Failed</dd>
          </div>
          <div>
            <dt>Error</dt>
            <dd>{evidence.error ?? "Not reported"}</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>{evidence.outputExcerpt}</dd>
          </div>
        </dl>
      ) : (
        <dl className="agent-queue-result-evidence-facts agent-queue-result-evidence-facts-primary">
          <div>
            <dt>Files changed by this run</dt>
            <dd>{formatChangedFilesSummary(evidence.changedFilesSummary)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Passed</dd>
          </div>
          <div>
            <dt>Git status</dt>
            <dd>{evidence.gitStatusSummary ?? "Not reported"}</dd>
          </div>
        </dl>
      )}
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
        <LazyDetails
          className="agent-queue-details agent-queue-secondary-details"
          summary="Raw Direct Work details"
        >
          <pre>{evidence.developerDetails}</pre>
          <p className="agent-queue-run-note">Raw details capped.</p>
        </LazyDetails>
      ) : null}
    </div>
  );
}

function FinalResponseBlock({
  label,
  response,
}: {
  label: "Failure summary" | "Final response";
  response: FinalResponseEvidence | null;
}) {
  if (!response) {
    return (
      <div className="agent-queue-final-response-block">
        <p className="agent-queue-final-response-label">{label}</p>
        <p className="agent-queue-run-note">No final response captured.</p>
      </div>
    );
  }

  return (
    <div className="agent-queue-final-response-block">
      <p className="agent-queue-final-response-label">{label}</p>
      <pre className="agent-queue-final-response-text">
        {response.preview}
      </pre>
      {response.isLong ? (
        <LazyDetails
          className="agent-queue-details agent-queue-secondary-details"
          summary="Full response"
        >
          <pre className="agent-queue-flow-selection-prompt">
            {response.text}
          </pre>
          <p className="agent-queue-run-note">Preview capped.</p>
        </LazyDetails>
      ) : null}
    </div>
  );
}

function LazyDetails({
  children,
  className,
  summary,
}: {
  children: ReactNode;
  className: string;
  summary: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={className}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {isOpen ? children : null}
    </details>
  );
}

function KnowledgeDraftPackNotice({ pack }: { pack: KnowledgeDraftReviewPack }) {
  return (
    <div className="agent-queue-knowledge-draft-notice">
      <div>
        <p className="agent-queue-final-response-label">
          Knowledge draft pack
        </p>
        <p className="agent-queue-run-note">
          {pack.packTitle} contains {pack.proposedItems.length.toString()} draft
          item{pack.proposedItems.length === 1 ? "" : "s"}. Review and accept
          items from Knowledge / Skills.
        </p>
      </div>
      <Button
        onClick={() => void copyDraftPackPayload(pack)}
        title="Copies the draft pack JSON for explicit import in Knowledge / Skills."
        variant="secondary"
      >
        Copy draft payload
      </Button>
    </div>
  );
}

async function copyDraftPackPayload(pack: KnowledgeDraftReviewPack) {
  if (!navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(pack.rawJson);
}

function workerReportFinalResponse(report: AgentQueueWorkerExecutionReport) {
  return firstReportText([
    report.rawReportPreview,
    report.reportStatus === "failed" ? report.errors[0] : null,
    report.summary,
  ]);
}

function firstReportText(values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function formatChangedFilesSummary(value: string | null) {
  if (!value || value === "none") {
    return "None";
  }

  return value;
}

function scrollToDeveloperDetails() {
  if (typeof document === "undefined") {
    return;
  }

  document
    .getElementById("agent-queue-developer-details")
    ?.scrollIntoView({ block: "nearest" });
}
