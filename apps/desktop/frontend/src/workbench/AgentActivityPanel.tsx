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
  const runGroups = groupActivityEventsByRun(events);
  const latestGroupId = runGroups[runGroups.length - 1]?.id;
  const latestGroupEventCount = runGroups[runGroups.length - 1]?.events.length ?? 0;
  const latestGroupTimestamp = runGroups[runGroups.length - 1]?.timestamp ?? 0;
  const renderedGroups = capArrayToLast(
    runGroups,
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

    scrollTimelineToTop(timeline);
  }, [
    runGroups.length,
    isFollowingLatest,
    latestGroupId,
    latestGroupEventCount,
    latestGroupTimestamp,
  ]);

  function handleTimelineScroll(event: UIEvent<HTMLOListElement>) {
    const timeline = event.currentTarget;
    setIsFollowingLatest(timeline.scrollTop <= FOLLOW_LATEST_THRESHOLD_PX);
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
      {renderedGroups.hiddenCount > 0 ? (
        <li className="agent-activity-event agent-activity-event-neutral">
          <p className="agent-activity-event-summary">
            Showing last {renderedGroups.items.length.toString()} runs.
            Preview capped; {renderedGroups.hiddenCount.toString()} older
            run(s) hidden from the renderer.
          </p>
        </li>
      ) : null}
      {renderedGroups.items.map((runGroup) => {
        const isExpanded = expandedEventIds.has(runGroup.id);
        const tone = runTone(runGroup);

        return (
          <li
            className={`agent-activity-event agent-activity-event-${tone} agent-activity-event-status-${runGroup.status} agent-activity-event-severity-${runGroup.severity}`}
            key={runGroup.id}
          >
            <button
              aria-expanded={isExpanded}
              className="agent-activity-event-row"
              onClick={() => toggleEvent(runGroup.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`status-dot status-dot-${tone}`}
              />
              <span className="agent-activity-event-copy">
                <span className="agent-activity-event-title">
                  {runGroup.title}
                </span>
                {runGroup.summary ? (
                  <span className="agent-activity-event-summary">
                    {runGroup.summary}
                  </span>
                ) : null}
              </span>
              <Badge
                className="agent-activity-event-status"
                variant={badgeVariant(tone)}
              >
                {statusLabel(runGroup.status)}
              </Badge>
              <span className="agent-activity-event-time">
                {runGroup.timestampLabel}
              </span>
            </button>
            {isExpanded ? <ExpandedRunDetails runGroup={runGroup} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

type AgentActivityRunGroup = {
  events: AgentActivityEvent[];
  id: string;
  runKind?: AgentActivityEvent["runKind"];
  runId: string;
  severity: AgentActivityEvent["severity"];
  sourceKind: AgentActivityEvent["sourceKind"];
  sourceLabel: string;
  sourceWidgetInstanceId: string;
  status: AgentActivityEvent["status"];
  summary: string;
  timestamp: number;
  timestampLabel: string;
  title: string;
  workspaceId: string;
};

function ExpandedRunDetails({
  runGroup,
}: {
  runGroup: AgentActivityRunGroup;
}) {
  return (
    <div className="agent-activity-event-details">
      <ol className="agent-activity-run-event-list">
        {runGroup.events.map((event) => (
          <li className="agent-activity-run-event" key={event.id}>
            <span className="agent-activity-run-event-title">
              {compactTitle(event)}
            </span>
            <span className="agent-activity-run-event-summary">
              {event.summary ?? statusLabel(event.status)}
            </span>
            <span className="agent-activity-run-event-time">
              {event.timestampLabel}
            </span>
            {event.command ? (
              <DetailBlock label="Command" value={event.command} />
            ) : null}
            {event.details ? (
              <DetailBlock label="Details" value={event.details} />
            ) : null}
            {event.outputPreview ? (
              <DetailBlock label="Command output" value={event.outputPreview} />
            ) : null}
            {event.rawPreview ? (
              <DetailBlock label="Raw preview" value={event.rawPreview} />
            ) : null}
          </li>
        ))}
      </ol>
      <dl className="agent-activity-event-metadata">
        <div>
          <dt>Source</dt>
          <dd>{runGroup.sourceLabel}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>{runGroup.runId}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(runGroup.status)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>{severityLabel(runGroup.severity)}</dd>
        </div>
      </dl>
    </div>
  );
}

function groupActivityEventsByRun(
  events: AgentActivityEvent[],
): AgentActivityRunGroup[] {
  const groups = new Map<string, AgentActivityEvent[]>();

  for (const event of events) {
    const key = [
      event.workspaceId,
      event.sourceWidgetInstanceId,
      event.runId,
    ].join(":");
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return Array.from(groups.entries())
    .map(([id, groupEvents]) => activityRunGroup(id, groupEvents))
    .sort((first, second) =>
      first.timestamp === second.timestamp
        ? first.id.localeCompare(second.id)
        : second.timestamp - first.timestamp,
    );
}

function activityRunGroup(
  id: string,
  events: AgentActivityEvent[],
): AgentActivityRunGroup {
  const sortedEvents = [...events].sort((first, second) =>
    first.timestamp === second.timestamp
      ? first.id.localeCompare(second.id)
      : first.timestamp - second.timestamp,
  );
  const runKind = groupRunKind(sortedEvents);

  if (runKind === "workspace-agent-self-test") {
    return selfTestActivityRunGroup(id, sortedEvents);
  }

  if (runKind === "workspace-agent-broker-continuation") {
    return brokerContinuationActivityRunGroup(id, sortedEvents);
  }

  const latestEvent = sortedEvents[sortedEvents.length - 1]!;
  const finalRunEvent = [...sortedEvents].reverse().find(isRunFinalEvent);
  const status = finalRunEvent?.status ?? groupStatus(sortedEvents);
  const severity = finalRunEvent?.severity ?? groupSeverity(sortedEvents, status);
  const stepCount = sortedEvents.filter(isStepEvent).length;
  const latestTitle = compactTitle(latestEvent);

  return {
    events: sortedEvents,
    id,
    runKind,
    runId: latestEvent.runId,
    severity,
    sourceKind: latestEvent.sourceKind,
    sourceLabel: latestEvent.sourceLabel,
    sourceWidgetInstanceId: latestEvent.sourceWidgetInstanceId,
    status,
    summary: `${stepCount.toString()} ${
      stepCount === 1 ? "step" : "steps"
    } - latest: ${latestTitle}`,
    timestamp: latestEvent.timestamp,
    timestampLabel: latestEvent.timestampLabel,
    title: "Agent run",
    workspaceId: latestEvent.workspaceId,
  };
}

function brokerContinuationActivityRunGroup(
  id: string,
  sortedEvents: AgentActivityEvent[],
): AgentActivityRunGroup {
  const latestEvent = sortedEvents[sortedEvents.length - 1]!;
  const finalEvent = [...sortedEvents].reverse().find(isTerminalLifecycleEvent);
  const displayEvent = finalEvent ?? latestEvent;
  const status = finalEvent?.status ?? groupStatus(sortedEvents);
  const severity = finalEvent?.severity ?? groupSeverity(sortedEvents, status);

  return {
    events: sortedEvents,
    id,
    runKind: "workspace-agent-broker-continuation",
    runId: displayEvent.runId,
    severity,
    sourceKind: displayEvent.sourceKind,
    sourceLabel: displayEvent.sourceLabel,
    sourceWidgetInstanceId: displayEvent.sourceWidgetInstanceId,
    status,
    summary: displayEvent.summary ?? statusLabel(status),
    timestamp: displayEvent.timestamp,
    timestampLabel: displayEvent.timestampLabel,
    title: "Workspace Agent action chain",
    workspaceId: displayEvent.workspaceId,
  };
}

function selfTestActivityRunGroup(
  id: string,
  sortedEvents: AgentActivityEvent[],
): AgentActivityRunGroup {
  const latestEvent = sortedEvents[sortedEvents.length - 1]!;
  const finalEvent = [...sortedEvents].reverse().find(isTerminalLifecycleEvent);
  const displayEvent = finalEvent ?? latestEvent;
  const status = finalEvent?.status ?? groupStatus(sortedEvents);
  const severity = finalEvent?.severity ?? groupSeverity(sortedEvents, status);

  return {
    events: sortedEvents,
    id,
    runKind: "workspace-agent-self-test",
    runId: displayEvent.runId,
    severity,
    sourceKind: displayEvent.sourceKind,
    sourceLabel: displayEvent.sourceLabel,
    sourceWidgetInstanceId: displayEvent.sourceWidgetInstanceId,
    status,
    summary: displayEvent.summary ?? statusLabel(status),
    timestamp: displayEvent.timestamp,
    timestampLabel: displayEvent.timestampLabel,
    title: displayEvent.title,
    workspaceId: displayEvent.workspaceId,
  };
}

function groupRunKind(
  events: AgentActivityEvent[],
): AgentActivityEvent["runKind"] {
  return events.find((event) => event.runKind)?.runKind;
}

function isRunFinalEvent(event: AgentActivityEvent) {
  if (isTerminalLifecycleEvent(event)) {
    return true;
  }

  return (
    event.title === "Completed run" ||
    event.title === "Failed run" ||
    event.title === "Cancelled run"
  );
}

function groupStatus(events: AgentActivityEvent[]): AgentActivityEvent["status"] {
  if (events.some((event) => event.status === "failed")) {
    return "failed";
  }

  if (events.some((event) => event.status === "cancelled")) {
    return "cancelled";
  }

  if (events.some((event) => event.status === "running")) {
    return "running";
  }

  return "completed";
}

function groupSeverity(
  events: AgentActivityEvent[],
  status: AgentActivityEvent["status"],
): AgentActivityEvent["severity"] {
  if (status === "failed") {
    return "error";
  }

  if (status === "cancelled") {
    return "warning";
  }

  if (status === "completed") {
    return "success";
  }

  return events[events.length - 1]?.severity ?? "info";
}

function isStepEvent(event: AgentActivityEvent) {
  if (event.lifecycleStage === "started" || isTerminalLifecycleEvent(event)) {
    return false;
  }

  return ![
    "Started run",
    "Completed run",
    "Failed run",
    "Cancelled run",
  ].includes(event.title);
}

function isTerminalLifecycleEvent(event: AgentActivityEvent) {
  return (
    event.lifecycleStage === "completed" ||
    event.lifecycleStage === "failed" ||
    event.lifecycleStage === "cancelled"
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

  if (status === "cancelled") {
    return "Cancelled";
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

function runTone(runGroup: AgentActivityRunGroup) {
  if (runGroup.status === "running") {
    return "info";
  }

  if (runGroup.status === "completed") {
    return "success";
  }

  if (runGroup.status === "failed") {
    return "error";
  }

  if (runGroup.status === "cancelled" || runGroup.severity === "warning") {
    return "warning";
  }

  return "neutral";
}

function badgeVariant(tone: ReturnType<typeof runTone>) {
  return tone === "neutral" ? "neutral" : tone;
}

function scrollTimelineToTop(timeline: HTMLOListElement) {
  if (typeof timeline.scrollTo === "function") {
    timeline.scrollTo({
      behavior: "auto",
      top: 0,
    });
    return;
  }

  timeline.scrollTop = 0;
}
