import { Badge } from "../../../design-system/Badge";
import { Button } from "../../../design-system/Button";
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

  return (
    <section
      aria-label="Agent activity"
      className="agent-queue-expanded-section agent-queue-agent-activity"
    >
      <div className="agent-queue-expanded-section-header">
        <div>
          <p className="agent-queue-expanded-kicker">Agent activity</p>
          <p className="agent-queue-execution-group-title">
            {activity.statusLine}
          </p>
          <p className="agent-queue-run-note">
            Live events from the selected Direct Work run. Manual refresh is a fallback.
          </p>
        </div>
        <div className="agent-queue-execution-badges">
          <Badge
            variant={
              activity.currentStage === "Failed"
                ? "error"
                : isRunning
                  ? "info"
                  : "success"
            }
          >
            {activity.currentStage}
          </Badge>
        </div>
      </div>

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
      <details className="agent-queue-details agent-queue-secondary-details">
        <summary>Raw event payloads</summary>
        <pre>{JSON.stringify(rawEvents, null, 2)}</pre>
      </details>
    </section>
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
            ? "Result will appear here when the run completes."
            : "No worker report has been attached yet."}
        </p>
      )}
    </section>
  );
}
