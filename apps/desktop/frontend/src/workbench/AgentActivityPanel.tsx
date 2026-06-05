import { type UIEvent, useEffect, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import { EmptyState } from "../design-system/EmptyState";
import {
  RENDER_MEMORY_CAPS,
  capArrayToLast,
  cappedPreviewText,
} from "../renderMemoryGuards";
import type { AgentActivityEvent } from "./agentActivityModel";

const FOLLOW_LATEST_THRESHOLD_PX = 32;

export function AgentActivityPanel({
  compact = false,
  emptyText = "No agent activity yet.",
  events,
}: {
  compact?: boolean;
  emptyText?: string;
  events: AgentActivityEvent[];
}) {
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isFollowingLatest, setIsFollowingLatest] = useState(true);
  const timelineRef = useRef<HTMLOListElement | null>(null);
  const latestEventId = events[events.length - 1]?.id;
  const renderedEvents = capArrayToLast(
    events,
    RENDER_MEMORY_CAPS.activityRenderedEvents,
  );

  const panelClassName = compact
    ? "agent-activity-panel agent-activity-panel-compact"
    : "agent-activity-panel";

  useEffect(() => {
    if (!isFollowingLatest) {
      return;
    }

    const timeline = timelineRef.current;

    if (!timeline) {
      return;
    }

    scrollTimelineToBottom(timeline);
  }, [events.length, isFollowingLatest, latestEventId]);

  function handleTimelineScroll(event: UIEvent<HTMLOListElement>) {
    const timeline = event.currentTarget;
    const distanceFromBottom =
      timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
    setIsFollowingLatest(distanceFromBottom <= FOLLOW_LATEST_THRESHOLD_PX);
  }

  if (events.length === 0) {
    return <EmptyState text={emptyText} title="No agent activity yet." />;
  }

  function toggleEvent(eventId: string) {
    setExpandedEventIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(eventId)) {
        nextIds.delete(eventId);
      } else {
        nextIds.add(eventId);
      }
      return nextIds;
    });
  }

  return (
    <ol
      aria-label="Agent activity timeline"
      className={panelClassName}
      data-agent-activity-timeline
      onScroll={handleTimelineScroll}
      ref={timelineRef}
    >
      {renderedEvents.hiddenCount > 0 ? (
        <li className="agent-activity-event agent-activity-event-neutral">
          <p className="agent-activity-event-summary">
            Showing last {renderedEvents.items.length.toString()} events.
            Preview capped; {renderedEvents.hiddenCount.toString()} older
            event(s) hidden from the renderer.
          </p>
        </li>
      ) : null}
      {renderedEvents.items.map((event) => {
        const isExpanded = expandedEventIds.has(event.id);
        const tone = eventTone(event);
        const title = compactTitle(event);

        return (
          <li
            className={`agent-activity-event agent-activity-event-${tone} agent-activity-event-status-${event.status} agent-activity-event-severity-${event.severity}`}
            key={event.id}
          >
            <button
              aria-expanded={isExpanded}
              className="agent-activity-event-row"
              onClick={() => toggleEvent(event.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`status-dot status-dot-${tone}`}
              />
              <span className="agent-activity-event-copy">
                <span className="agent-activity-event-title">{title}</span>
                {event.summary ? (
                  <span className="agent-activity-event-summary">
                    {event.summary}
                  </span>
                ) : null}
              </span>
              <Badge
                className="agent-activity-event-status"
                variant={badgeVariant(tone)}
              >
                {statusLabel(event.status)}
              </Badge>
              <span className="agent-activity-event-time">
                {event.timestampLabel}
              </span>
            </button>
            {isExpanded ? <ExpandedEventDetails event={event} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ExpandedEventDetails({ event }: { event: AgentActivityEvent }) {
  return (
    <div className="agent-activity-event-details">
      {event.command ? (
        <DetailBlock label="Command" value={event.command} />
      ) : null}
      {event.summary ? <DetailBlock label="Summary" value={event.summary} /> : null}
      {event.details ? <DetailBlock label="Details" value={event.details} /> : null}
      {event.outputPreview ? (
        <DetailBlock label="Command output" value={event.outputPreview} />
      ) : null}
      {event.rawPreview ? (
        <DetailBlock label="Raw preview" value={event.rawPreview} />
      ) : null}
      <dl className="agent-activity-event-metadata">
        <div>
          <dt>Source</dt>
          <dd>{event.sourceLabel}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{event.runId}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(event.status)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>{severityLabel(event.severity)}</dd>
        </div>
      </dl>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  const cappedValue = cappedPreviewText(
    value,
    RENDER_MEMORY_CAPS.rawJsonPreviewChars,
    label.toLowerCase().includes("raw") ? "Raw details capped" : "Preview capped",
  );

  return (
    <div className="agent-activity-event-detail-block">
      <span className="agent-activity-event-detail-label">{label}</span>
      <pre className="agent-activity-event-detail-text">{cappedValue}</pre>
    </div>
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

function severityLabel(severity: AgentActivityEvent["severity"]) {
  if (severity === "success") {
    return "Success";
  }

  if (severity === "warning") {
    return "Warning";
  }

  if (severity === "error") {
    return "Error";
  }

  return "Info";
}

function compactTitle(event: AgentActivityEvent) {
  if (event.title === "Ran command" && event.status === "running") {
    return "Running command";
  }

  if (event.title === "Command finished") {
    return "Finished command";
  }

  return event.title;
}

function eventTone(event: AgentActivityEvent) {
  if (event.status === "running") {
    return "info";
  }

  if (event.status === "completed") {
    return "success";
  }

  if (event.status === "failed") {
    return "error";
  }

  if (event.severity === "warning") {
    return "warning";
  }

  return "neutral";
}

function badgeVariant(tone: ReturnType<typeof eventTone>) {
  return tone === "neutral" ? "neutral" : tone;
}

function scrollTimelineToBottom(timeline: HTMLOListElement) {
  if (typeof timeline.scrollTo === "function") {
    timeline.scrollTo({
      behavior: "auto",
      top: timeline.scrollHeight,
    });
    return;
  }

  timeline.scrollTop = timeline.scrollHeight;
}
