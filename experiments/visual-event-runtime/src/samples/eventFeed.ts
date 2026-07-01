import type { VisualEvent } from "../contracts";

export const sampleEventFeed: VisualEvent[] = [
  {
    eventId: "evt-agent-run-started",
    ts: 0,
    type: "agent.run.started",
    entity: {
      id: "run_001",
      kind: "agent_run",
      label: "Run 001",
    },
    transition: {
      from: "queued",
      to: "running",
    },
    severity: "info",
    payload: {
      routeProgress: 0.1,
    },
  },
  {
    eventId: "evt-queue-item-started",
    ts: 1000,
    type: "queue.item.started",
    entity: {
      id: "queue_item_001",
      kind: "queue_item",
      label: "Queue Item 001",
    },
    transition: {
      from: "queued",
      to: "active",
    },
    severity: "info",
    payload: {
      activeItems: 1,
    },
  },
  {
    eventId: "evt-codebase-scan-started",
    ts: 2200,
    type: "codebase.scan.started",
    entity: {
      id: "codebase_target",
      kind: "codebase",
      label: "Codebase Target",
    },
    transition: {
      from: "idle",
      to: "scanning",
    },
    severity: "info",
    payload: {
      targetObjectId: "codebase_target",
      scanMode: "surface",
    },
  },
  {
    eventId: "evt-database-down",
    ts: 3800,
    type: "monitoring.target.status_changed",
    entity: {
      id: "database_123",
      kind: "database",
      label: "database_123",
    },
    transition: {
      from: "healthy",
      to: "down",
    },
    severity: "critical",
    payload: {
      targetObjectId: "database_123",
      reason: "sample outage",
    },
  },
  {
    eventId: "evt-database-recovering",
    ts: 7200,
    type: "monitoring.target.status_changed",
    entity: {
      id: "database_123",
      kind: "database",
      label: "database_123",
    },
    transition: {
      from: "down",
      to: "recovering",
    },
    severity: "warning",
    payload: {
      targetObjectId: "database_123",
      repairProgress: 0.35,
    },
  },
  {
    eventId: "evt-codebase-scan-completed",
    ts: 7500,
    type: "codebase.scan.completed",
    entity: {
      id: "codebase_target",
      kind: "codebase",
      label: "Codebase Target",
    },
    transition: {
      from: "scanning",
      to: "idle",
    },
    severity: "info",
    payload: {
      launcherObjectId: "request_fighter",
      targetObjectId: "codebase_target",
    },
  },
  {
    eventId: "evt-database-healthy",
    ts: 9800,
    type: "monitoring.target.status_changed",
    entity: {
      id: "database_123",
      kind: "database",
      label: "database_123",
    },
    transition: {
      from: "recovering",
      to: "healthy",
    },
    severity: "info",
    payload: {
      targetObjectId: "database_123",
      repairProgress: 1,
    },
  },
  {
    eventId: "evt-queue-item-completed",
    ts: 11600,
    type: "queue.item.completed",
    entity: {
      id: "queue_item_001",
      kind: "queue_item",
      label: "Queue Item 001",
    },
    transition: {
      from: "active",
      to: "complete",
    },
    severity: "info",
    payload: {
      activeItems: 0,
      routeProgress: 1,
    },
  },
];
