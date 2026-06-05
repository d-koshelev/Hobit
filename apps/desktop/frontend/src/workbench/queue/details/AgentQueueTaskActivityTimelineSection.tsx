import { useState, type ReactNode } from "react";
import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
import {
  RENDER_MEMORY_CAPS,
  cappedRawDetailsText,
} from "../../../renderMemoryGuards";
import type { AgentQueueReportActionCard } from "../../../workspace/types";
import {
  directWorkEvidenceForQueue,
  hasFinishedRunLink,
  isFailedRunEvidence,
  isSelectedTaskRunning,
} from "./agentQueueTaskDetailsEvidence";
import {
  formatTimestamp,
  isReportReadyStatus,
} from "./agentQueueTaskDetailsFormatters";
import {
  activityDisplayEvent,
  buildFallbackActivityEvents,
  buildHumanTimeline,
} from "./agentQueueTaskDetailsTimeline";
import type {
  AgentQueueController,
  SelectedAgentQueueTask,
} from "./agentQueueTaskDetailsTypes";
import { DirectWorkEvidenceSummary } from "./AgentQueueTaskResultEvidenceSection";

export function AgentQueueTaskActivityTimelineSection({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
}) {
  const activity = queue.runActivity;
  const isRunning = isSelectedTaskRunning(queue, selectedTask);
  const recentEvents =
    activity.recentEvents.length > 0
      ? activity.recentEvents.map(activityDisplayEvent)
      : buildFallbackActivityEvents(queue, selectedTask);
  const currentEvent = recentEvents[recentEvents.length - 1];
  const activityState = activityStatusForRun(queue, selectedTask);
  const statusLine = activityStatusLineForRun(queue, selectedTask);

  return (
    <section
      aria-label="Agent activity"
      className="agent-queue-expanded-section agent-queue-agent-activity"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Agent activity</p>
          <p className="agent-queue-execution-group-title">
            {statusLine}
          </p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge variant={activityState.badgeVariant}>
            {activityState.label}
          </Badge>
        </div>
      </div>

      {currentEvent ? (
        <div className="agent-queue-current-event">
          <Badge variant={currentEvent.badgeVariant}>{currentEvent.badge}</Badge>
          <div>
            <p className="agent-queue-human-timeline-title">
              {currentEvent.title}
            </p>
            <p className="agent-queue-human-timeline-copy">
              {currentEvent.message}
            </p>
          </div>
        </div>
      ) : (
        <p className="agent-queue-run-note">
          No run events yet. Start an assigned task to see activity.
        </p>
      )}

      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Activity details</summary>
        <dl className="agent-queue-agent-activity-current">
          <div>
            <dt>Current stage</dt>
            <dd>{activity.currentStage}</dd>
          </div>
          <div>
            <dt>Current event</dt>
            <dd>{activity.currentMessage}</dd>
          </div>
          {activity.lastCommand ? (
            <div>
              <dt>Last command</dt>
              <dd className="agent-queue-mono">{activity.lastCommand}</dd>
            </div>
          ) : null}
          {activity.lastCommandStatus ? (
            <div>
              <dt>Command status</dt>
              <dd>{activity.lastCommandStatus}</dd>
            </div>
          ) : null}
        </dl>
      </details>

      {recentEvents.length > 1 ? (
        <details className="agent-queue-details agent-queue-secondary-details">
          <summary>{recentEvents.length.toString()} recent events</summary>
          <div className="agent-queue-human-timeline agent-queue-live-events">
            {recentEvents.map((entry) => (
              <div className="agent-queue-human-timeline-item" key={entry.key}>
                <Badge variant={entry.badgeVariant}>{entry.badge}</Badge>
                <div>
                  <p className="agent-queue-human-timeline-title">
                    {entry.title}
                  </p>
                  <p className="agent-queue-human-timeline-copy">
                    {entry.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="agent-queue-run-actions">
        <Button
          disabled={!queue.latestRun.apiAvailable || queue.latestRun.isLoading}
          onClick={() => queue.latestRun.onRefresh()}
          variant="secondary"
        >
          Refresh status
        </Button>
      </div>

      {queue.latestRun.error ? (
        <p
          className="agent-queue-message agent-queue-message-error"
          role="alert"
        >
          {queue.latestRun.error}
        </p>
      ) : null}
    </section>
  );
}

function activityStatusForRun(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  const runStatus = queue.latestRun.link?.status ?? selectedTask.status;

  switch (runStatus) {
    case "running":
      return { badgeVariant: "info" as const, label: "Running" };
    case "completed":
      return { badgeVariant: "success" as const, label: "Completed" };
    case "failed":
      return { badgeVariant: "error" as const, label: "Failed" };
    case "timed_out":
      return { badgeVariant: "error" as const, label: "Timed out" };
    case "cancelled":
      return { badgeVariant: "warning" as const, label: "Cancelled" };
    default:
      if (isSelectedTaskRunning(queue, selectedTask)) {
        return { badgeVariant: "info" as const, label: "Running" };
      }

      return {
        badgeVariant: queue.runActivity.currentStage === "Failed" ? "error" as const : "neutral" as const,
        label: queue.runActivity.currentStage,
      };
  }
}

function activityStatusLineForRun(
  queue: AgentQueueController,
  selectedTask: SelectedAgentQueueTask,
) {
  const runStatus = queue.latestRun.link?.status ?? selectedTask.status;

  if (isSelectedTaskRunning(queue, selectedTask)) {
    return queue.runActivity.statusLine;
  }

  switch (runStatus) {
    case "completed":
    case "review_needed":
      if (!queue.latestRun.link && !queue.run.startedRunId) {
        return "Execution complete - no active run is selected.";
      }

      return queue.runActivity.statusLine.startsWith("Running")
        ? "Completed - final response received."
        : queue.runActivity.statusLine;
    case "failed":
    case "timed_out":
      if (!queue.latestRun.link && !queue.run.startedRunId) {
        return "Failed - no active run is selected.";
      }

      return queue.runActivity.statusLine.startsWith("Running")
        ? "Failed - review run details."
        : queue.runActivity.statusLine;
    case "cancelled":
      if (!queue.latestRun.link && !queue.run.startedRunId) {
        return "Cancelled - no active run is selected.";
      }

      return queue.runActivity.statusLine.startsWith("Running")
        ? "Cancelled - run stopped before completion."
        : queue.runActivity.statusLine;
    default:
      return queue.latestRun.link || queue.run.startedRunId
        ? queue.runActivity.statusLine
        : "No active run selected.";
  }
}

export function RawRunActivityDetails({ queue }: { queue: AgentQueueController }) {
  const rawEvents = queue.runActivity.rawEvents;

  if (rawEvents.length === 0) {
    return (
      <section
        aria-label="Raw Direct Work events"
        className="agent-queue-expanded-section agent-queue-raw-events"
      >
        <div className="agent-queue-expanded-section-header">
          <p className="agent-queue-execution-group-title">Raw Direct Work events</p>
          <Badge variant="neutral">None</Badge>
        </div>
        <p className="agent-queue-run-note">
          Raw stream events appear here after the selected run emits them.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Raw Direct Work events"
      className="agent-queue-expanded-section agent-queue-raw-events"
    >
      <div className="agent-queue-expanded-section-header">
        <p className="agent-queue-execution-group-title">Raw Direct Work events</p>
        <Badge variant="neutral">{rawEvents.length.toString()} recent</Badge>
      </div>
      <LazyDetails
        className="agent-queue-details agent-queue-secondary-details"
        summary="Raw event payloads"
      >
        <pre>
          {cappedRawDetailsText(
            JSON.stringify(rawEvents, null, 2),
            RENDER_MEMORY_CAPS.rawJsonPreviewChars,
          )}
        </pre>
        <p className="agent-queue-run-note">
          Raw details capped. Showing last {rawEvents.length.toString()} events.
        </p>
      </LazyDetails>
    </section>
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

export function ActivityTimelinePanel({
  queue,
  selectedTask,
}: {
  queue: AgentQueueController;
  selectedTask: SelectedAgentQueueTask;
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

export function HumanReadableActivityPanel({
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
                ? "Running"
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
                ? "Failure result is not loaded."
                : "Run result is not loaded."}
          </p>
          <p className="agent-queue-run-note">
            {queue.runEvidence.isLoading
              ? "Direct Work finished. Hobit is loading the linked result evidence before coordinator review."
              : "Use the result section to refresh the result, attach a report, or inspect Developer details."}
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
            ? "Result will appear here when the run completes."
            : "No worker report has been attached yet."}
        </p>
      )}
    </section>
  );
}
