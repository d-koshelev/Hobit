import { Badge } from "../design-system/Badge";
import { EmptyState } from "../design-system/EmptyState";
import type { AgentActivityEvent } from "./agentActivityModel";

export function AgentActivityPanel({
  compact = false,
  emptyText = "No agent activity yet.",
  events,
}: {
  compact?: boolean;
  emptyText?: string;
  events: AgentActivityEvent[];
}) {
  if (events.length === 0) {
    return <EmptyState text={emptyText} title="No agent activity yet." />;
  }

  const panelClassName = compact
    ? "agent-activity-panel agent-activity-panel-compact"
    : "agent-activity-panel";

  return (
    <ol aria-label="Agent activity timeline" className={panelClassName}>
      {events.map((event) => (
        <li
          className={`agent-activity-event agent-activity-event-${event.severity}`}
          key={event.id}
        >
          <span
            aria-hidden="true"
            className={`status-dot status-dot-${statusDotTone(event.severity)}`}
          />
          <div className="agent-activity-event-body">
            <div className="agent-activity-event-header">
              <div className="agent-activity-event-title-row">
                <span className="agent-activity-event-title">{event.title}</span>
                <Badge variant={badgeVariant(event.severity)}>
                  {statusLabel(event.status)}
                </Badge>
              </div>
              <span className="agent-activity-event-time">
                {event.timestampLabel}
              </span>
            </div>
            <p className="agent-activity-event-summary">
              {event.summary ?? event.sourceLabel}
            </p>
            <p className="agent-activity-event-source">
              {event.sourceLabel} - Run {event.runId}
            </p>
            {event.details || event.rawPreview ? (
              <details className="agent-activity-event-details">
                <summary>Details</summary>
                {event.details ? (
                  <pre className="agent-activity-event-detail-text">
                    {event.details}
                  </pre>
                ) : null}
                {event.rawPreview ? (
                  <div className="agent-activity-event-raw">
                    <span className="agent-activity-event-detail-label">
                      Raw preview
                    </span>
                    <pre className="agent-activity-event-detail-text">
                      {event.rawPreview}
                    </pre>
                  </div>
                ) : null}
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function statusLabel(status: AgentActivityEvent["status"]) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "completed") {
    return "Completed";
  }

  return "Failed";
}

function badgeVariant(severity: AgentActivityEvent["severity"]) {
  if (severity === "success") {
    return "success";
  }

  if (severity === "warning") {
    return "warning";
  }

  if (severity === "error") {
    return "error";
  }

  return "info";
}

function statusDotTone(severity: AgentActivityEvent["severity"]) {
  return severity === "warning" ? "warning" : badgeVariant(severity);
}
