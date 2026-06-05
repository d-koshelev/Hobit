import { Badge } from "../design-system/Badge";
import { Button } from "../design-system/Button";
import type { AgentQueueAutonomousController } from "./queue/useAgentQueueController";

type AgentQueueAutonomousSectionProps = {
  autonomous: AgentQueueAutonomousController;
};

export function AgentQueueAutonomousSection({
  autonomous,
}: AgentQueueAutonomousSectionProps) {
  const isRunning =
    autonomous.status === "running" || autonomous.status === "stopping";
  const messageTone =
    autonomous.status === "failed"
      ? "error"
      : autonomous.status === "needs_setup" || autonomous.status === "blocked"
        ? "warning"
        : "neutral";

  return (
    <section
      aria-label="Autonomous Queue"
      className="agent-queue-sidebar-section"
    >
      <div className="agent-queue-section-header">
        <p className="agent-queue-section-title">Autonomous Queue</p>
        <Badge
          variant={
            autonomous.status === "failed"
              ? "error"
              : autonomous.status === "blocked" ||
                  autonomous.status === "needs_setup"
                ? "warning"
              : isRunning
                ? "info"
                : autonomous.status === "completed"
                  ? "success"
                  : "neutral"
          }
        >
          {autonomousStatusLabel(autonomous.status)}
        </Badge>
      </div>
      <p className="agent-queue-run-note agent-queue-sidebar-subtle">
        Runs eligible queued tasks automatically.
      </p>
      <div className="agent-queue-global-actions">
        <Button
          disabled={!autonomous.canStart}
          onClick={() => autonomous.onStart()}
          variant="secondary"
        >
          Run autonomous queue
        </Button>
        <Button
          disabled={!isRunning}
          onClick={() => autonomous.onStopAfterCurrent()}
          variant="ghost"
        >
          Stop after current
        </Button>
      </div>
      <dl className="agent-queue-executor-facts agent-queue-rail-metrics">
        <div>
          <dt>Completed</dt>
          <dd>{autonomous.completedCount}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{autonomous.failedCount}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd>{autonomous.skippedBlockedCount}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{autonomous.remainingEligibleCount}</dd>
        </div>
      </dl>
      <details className="agent-queue-details agent-queue-rail-details">
        <summary>Run details</summary>
        <p className="agent-queue-run-note">
          Reports remain for coordinator review.
        </p>
        {isRunning ? (
          <p className="agent-queue-run-note">
            Stop now unavailable; will stop after current task.
          </p>
        ) : null}
        {autonomous.message ? (
          <p
            className={[
              "agent-queue-message",
              messageTone === "error" ? "agent-queue-message-error" : null,
              messageTone === "warning" ? "agent-queue-message-warning" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            role={
              autonomous.status === "failed" || autonomous.status === "blocked"
                ? "alert"
                : autonomous.status === "needs_setup"
                  ? "status"
                  : undefined
            }
          >
            {autonomous.message}
          </p>
        ) : null}
        {autonomous.preconditionMessages.length > 0 ? (
          <ul className="agent-queue-precondition-list">
            {autonomous.preconditionMessages.map((precondition) => (
              <li key={precondition}>{precondition}</li>
            ))}
          </ul>
        ) : null}
        {autonomous.activeTaskTitle ? (
          <p className="agent-queue-sidebar-row-meta">
            Active: {autonomous.activeTaskTitle}
          </p>
        ) : null}
        {autonomous.currentStage ? (
          <p className="agent-queue-sidebar-row-meta">
            Stage: {autonomous.currentStage}
          </p>
        ) : null}
        {autonomous.latestReportState ? (
          <p className="agent-queue-sidebar-row-meta">
            Report: {autonomous.latestReportState}
          </p>
        ) : null}
        {autonomous.timeline.length > 0 ? (
          <ol className="agent-queue-autonomous-timeline">
            {autonomous.timeline.map((event) => (
              <li key={event.id}>
                <p className="agent-queue-sidebar-row-title">{event.title}</p>
                {event.detail ? (
                  <p className="agent-queue-sidebar-row-meta">{event.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </details>
    </section>
  );
}

function autonomousStatusLabel(status: AgentQueueAutonomousController["status"]) {
  return status === "needs_setup" ? "needs setup" : status;
}
