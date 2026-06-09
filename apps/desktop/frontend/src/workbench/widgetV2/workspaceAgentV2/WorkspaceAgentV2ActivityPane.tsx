import { useMemo } from "react";

import type {
  AgentRunEvent,
  AgentRunEventKind,
  AgentRunLifecycle,
} from "../../agentRuntime";
import {
  agentRunLifecycleLabel,
  groupAgentRunEventsByRun,
  type AgentRunEventGroup,
} from "../../agentRuntime";

type WorkspaceAgentV2ActivityPaneProps = {
  readonly currentRunId?: string;
  readonly events?: readonly AgentRunEvent[];
  readonly onRequestHide?: () => void;
};

type WorkspaceAgentV2RunActivityGroupProps = {
  readonly group: AgentRunEventGroup;
  readonly prominent?: boolean;
};

export function WorkspaceAgentV2ActivityPane({
  currentRunId,
  events = [],
  onRequestHide,
}: WorkspaceAgentV2ActivityPaneProps) {
  const groups = useMemo(
    () => orderRunGroups(groupAgentRunEventsByRun(events), currentRunId),
    [currentRunId, events],
  );

  const currentGroup = groups[0];
  const historyGroups = groups.slice(1);

  return (
    <section
      aria-label="Workspace Agent v2 grouped activity"
      className="workspace-agent-v2-activity"
    >
      <div className="workspace-agent-v2-activity-header">
        <div>
          <h3>Activity</h3>
          <p>
            Grouped run scaffold only. Events are supplied by the caller and are
            not persisted.
          </p>
        </div>
        {onRequestHide ? (
          <button
            aria-label="Hide Workspace Agent v2 activity"
            className="button button-secondary button-sm"
            onClick={onRequestHide}
            type="button"
          >
            Hide activity
          </button>
        ) : null}
      </div>

      {groups.length > 0 ? (
        <div className="workspace-agent-v2-activity-groups">
          {currentGroup ? (
            <WorkspaceAgentV2RunActivityGroup
              group={currentGroup}
              prominent
            />
          ) : null}
          {historyGroups.length > 0 ? (
            <section
              aria-label="Workspace Agent v2 run history"
              className="workspace-agent-v2-activity-history"
            >
              <h4>History</h4>
              {historyGroups.map((group) => (
                <WorkspaceAgentV2RunActivityGroup
                  group={group}
                  key={group.runId}
                />
              ))}
            </section>
          ) : null}
        </div>
      ) : (
        <div className="workspace-agent-v2-activity-empty">
          <h4>No run activity</h4>
          <p>No provider execution, streaming, Queue dispatch, or backend runtime is wired.</p>
        </div>
      )}

      <button
        className="button button-secondary button-sm workspace-agent-v2-developer-details"
        disabled
        type="button"
      >
        Developer Details
      </button>
    </section>
  );
}

export function WorkspaceAgentV2RunActivityGroup({
  group,
  prominent = false,
}: WorkspaceAgentV2RunActivityGroupProps) {
  const statusLabel = activityStatusLabel(group.latestLifecycle);
  const latestEvent = group.events[group.events.length - 1];

  return (
    <article
      className="workspace-agent-v2-run-activity-group"
      data-prominent={prominent ? "true" : "false"}
    >
      <div className="workspace-agent-v2-run-activity-summary">
        <div>
          <h4>{prominent ? "Current run" : "Run"}</h4>
          <p>{group.runId}</p>
        </div>
        <span
          className="workspace-agent-v2-run-status"
          data-status={statusTone(group.latestLifecycle)}
        >
          {statusLabel}
        </span>
      </div>
      <div className="workspace-agent-v2-run-activity-meta">
        <span>{eventCountLabel(group.events.length)}</span>
        {latestEvent ? <span>Latest: {latestEvent.title}</span> : null}
      </div>
      <ol
        aria-label={`Activity events for ${group.runId}`}
        className="workspace-agent-v2-run-events"
      >
        {group.events.map((event) => (
          <li key={event.id}>
            <span>{eventKindLabel(event.kind)}</span>
            <strong>{event.title}</strong>
          </li>
        ))}
      </ol>
    </article>
  );
}

function orderRunGroups(
  groups: AgentRunEventGroup[],
  currentRunId: string | undefined,
) {
  const sorted = [...groups].sort((first, second) => {
    const firstTime = latestGroupTime(first);
    const secondTime = latestGroupTime(second);
    return firstTime === secondTime
      ? first.runId.localeCompare(second.runId)
      : secondTime - firstTime;
  });

  const currentIndex = sorted.findIndex((group) =>
    currentRunId ? group.runId === currentRunId : isActiveLifecycle(group.latestLifecycle),
  );

  if (currentIndex <= 0) {
    return sorted;
  }

  const current = sorted.splice(currentIndex, 1)[0];
  return current ? [current, ...sorted] : sorted;
}

function latestGroupTime(group: AgentRunEventGroup) {
  return group.events[group.events.length - 1]?.timestampMs ?? 0;
}

function isActiveLifecycle(lifecycle: AgentRunLifecycle) {
  return lifecycle === "queued" || lifecycle === "starting" || lifecycle === "running";
}

function activityStatusLabel(lifecycle: AgentRunLifecycle) {
  if (lifecycle === "failed") {
    return "Failed";
  }

  if (lifecycle === "cancelled") {
    return "Cancelled";
  }

  if (lifecycle === "completed") {
    return "Completed";
  }

  if (isActiveLifecycle(lifecycle)) {
    return "Running";
  }

  return agentRunLifecycleLabel(lifecycle);
}

function statusTone(lifecycle: AgentRunLifecycle) {
  if (lifecycle === "completed") {
    return "completed";
  }

  if (lifecycle === "failed") {
    return "failed";
  }

  if (lifecycle === "cancelled") {
    return "cancelled";
  }

  return isActiveLifecycle(lifecycle) ? "running" : "neutral";
}

function eventKindLabel(kind: AgentRunEventKind) {
  return EVENT_KIND_LABELS[kind];
}

function eventCountLabel(count: number) {
  return count === 1 ? "1 event" : `${count} events`;
}

const EVENT_KIND_LABELS: Record<AgentRunEventKind, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  context_materialized: "Context materialized",
  failed: "Failed",
  file_change_detected: "File change detected",
  provider_started: "Provider started",
  queue_task_created: "Queue task created",
  response_received: "Response received",
  tool_call: "Tool call",
  validation_suggested: "Validation suggested",
};
