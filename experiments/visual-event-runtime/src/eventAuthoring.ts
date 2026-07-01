import type { VisualEvent } from "./contracts";

export const eventTemplateTypes = [
  "agent.run.started",
  "queue.item.started",
  "codebase.scan.started",
  "codebase.scan.completed",
  "monitoring.target.status_changed",
  "queue.item.completed",
] as const;

export type EventTemplateType = (typeof eventTemplateTypes)[number];

export function sortEventsByTimestamp(events: VisualEvent[]) {
  return [...events].sort(
    (left, right) => left.ts - right.ts || left.eventId.localeCompare(right.eventId),
  );
}

export function getScenarioStartMs(events: VisualEvent[]) {
  const timestamps = events
    .map((event) => event.ts)
    .filter((timestamp) => Number.isFinite(timestamp));

  return timestamps.length > 0 ? Math.min(...timestamps) : 0;
}

export function getEventOffsetMs(event: VisualEvent, scenarioStartMs: number) {
  return Number.isFinite(event.offsetMs)
    ? Number(event.offsetMs)
    : event.ts - scenarioStartMs;
}

export function eventWithTimestamp(
  event: VisualEvent,
  ts: number,
  scenarioStartMs: number,
): VisualEvent {
  return {
    ...event,
    offsetMs: ts - scenarioStartMs,
    ts,
  };
}

export function eventWithOffsetMs(
  event: VisualEvent,
  offsetMs: number,
  scenarioStartMs: number,
): VisualEvent {
  return {
    ...event,
    offsetMs,
    ts: scenarioStartMs + offsetMs,
  };
}

export function normalizeEventTimeline(events: VisualEvent[]) {
  const scenarioStartMs = getScenarioStartMs(events);

  return sortEventsByTimestamp(
    events.map((event) =>
      Number.isFinite(event.offsetMs)
        ? eventWithOffsetMs(event, Number(event.offsetMs), scenarioStartMs)
        : event,
    ),
  );
}

export function makeEventId(base: string, events: VisualEvent[]) {
  const safeBase = base.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let index = events.length + 1;
  let eventId = `${safeBase}-${index}`;

  while (events.some((event) => event.eventId === eventId)) {
    index += 1;
    eventId = `${safeBase}-${index}`;
  }

  return eventId;
}

function getNextOffsetMs(events: VisualEvent[]) {
  if (events.length === 0) {
    return 0;
  }

  const scenarioStartMs = getScenarioStartMs(events);
  const offsets = events.map((event) => getEventOffsetMs(event, scenarioStartMs));

  return Math.max(...offsets) + 1000;
}

export function createEventFromTemplate(
  templateType: EventTemplateType,
  events: VisualEvent[],
): VisualEvent {
  const scenarioStartMs = getScenarioStartMs(events);
  const offsetMs = getNextOffsetMs(events);
  const baseEvent = {
    eventId: makeEventId(templateType, events),
    offsetMs,
    ts: scenarioStartMs + offsetMs,
    type: templateType,
  };

  switch (templateType) {
    case "agent.run.started":
      return {
        ...baseEvent,
        entity: {
          id: "run_001",
          kind: "agent_run",
          label: "Run 001",
          name: "Run 001",
        },
        payload: {
          routeProgress: 0,
        },
        severity: "info",
        transition: {
          from: "queued",
          to: "running",
        },
      };
    case "queue.item.started":
      return {
        ...baseEvent,
        entity: {
          id: "queue_item_001",
          kind: "queue_item",
          label: "Queue Item 001",
          name: "Queue Item 001",
        },
        payload: {
          activeItems: 1,
        },
        severity: "info",
        transition: {
          from: "queued",
          to: "active",
        },
      };
    case "codebase.scan.started":
      return {
        ...baseEvent,
        entity: {
          id: "codebase_target",
          kind: "codebase",
          label: "Codebase Target",
          name: "Codebase Target",
        },
        payload: {
          scanMode: "surface",
          targetObjectId: "codebase_target",
        },
        severity: "info",
        transition: {
          from: "idle",
          to: "scanning",
        },
      };
    case "codebase.scan.completed":
      return {
        ...baseEvent,
        entity: {
          id: "codebase_target",
          kind: "codebase",
          label: "Codebase Target",
          name: "Codebase Target",
        },
        payload: {
          launcherObjectId: "request_fighter",
          targetObjectId: "codebase_target",
        },
        severity: "info",
        transition: {
          from: "scanning",
          to: "idle",
        },
      };
    case "monitoring.target.status_changed":
      return {
        ...baseEvent,
        entity: {
          id: "database_123",
          kind: "database",
          label: "database_123",
          name: "database_123",
        },
        payload: {
          targetObjectId: "database_123",
        },
        severity: "warning",
        transition: {
          from: "healthy",
          to: "down",
        },
      };
    case "queue.item.completed":
      return {
        ...baseEvent,
        entity: {
          id: "queue_item_001",
          kind: "queue_item",
          label: "Queue Item 001",
          name: "Queue Item 001",
        },
        payload: {
          activeItems: 0,
          routeProgress: 1,
        },
        severity: "info",
        transition: {
          from: "active",
          to: "complete",
        },
      };
  }
}

export function duplicateEvent(event: VisualEvent, events: VisualEvent[]) {
  const scenarioStartMs = getScenarioStartMs(events);
  const offsetMs = getEventOffsetMs(event, scenarioStartMs) + 250;

  return {
    ...event,
    eventId: makeEventId(event.eventId, events),
    offsetMs,
    ts: scenarioStartMs + offsetMs,
  };
}
