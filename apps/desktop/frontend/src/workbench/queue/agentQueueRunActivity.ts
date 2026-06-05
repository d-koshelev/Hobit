import {
  agentActivityEventFromDirectWorkStreamEvent,
  mergeAgentActivityEvents,
  type AgentActivityEvent,
} from "../agentActivityModel";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
  cappedRawDetailsText,
} from "../../renderMemoryGuards";
import type {
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  DirectWorkStreamEvent,
} from "../../workspace/types";

export type AgentQueueRunStage =
  | "Starting"
  | "Preparing"
  | "Reading context"
  | "Running commands"
  | "Validating"
  | "Preparing report"
  | "Report ready"
  | "Failed";

export type AgentQueueRunActivitySnapshot = {
  currentMessage: string;
  currentStage: AgentQueueRunStage;
  lastCommand: string | null;
  lastCommandStatus: string | null;
  rawEvents: DirectWorkStreamEvent[];
  recentEvents: AgentActivityEvent[];
  statusLine: string;
};

export type AgentQueueRunActivityState = {
  events: AgentActivityEvent[];
  rawEvents: DirectWorkStreamEvent[];
};

const RECENT_ACTIVITY_LIMIT = 5;
const RAW_EVENT_LIMIT = 25;

export function emptyAgentQueueRunActivityState(): AgentQueueRunActivityState {
  return {
    events: [],
    rawEvents: [],
  };
}

export function appendAgentQueueRunActivityEvent(
  current: AgentQueueRunActivityState,
  event: DirectWorkStreamEvent,
): AgentQueueRunActivityState {
  const readable = agentActivityEventFromDirectWorkStreamEvent({
    event,
    sourceKind: "agent-executor",
    sourceLabel: "Queue local executor",
  });

  return {
    events: readable
      ? mergeAgentActivityEvents(current.events, [readable], 50)
      : current.events,
    rawEvents: [...current.rawEvents, cappedRawRunActivityEvent(event)].slice(
      -RAW_EVENT_LIMIT,
    ),
  };
}

function cappedRawRunActivityEvent(
  event: DirectWorkStreamEvent,
): DirectWorkStreamEvent {
  return {
    ...event,
    errorMessage: event.errorMessage
      ? cappedPreviewText(
          event.errorMessage,
          RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
        )
      : event.errorMessage,
    line: event.line
      ? cappedRawDetailsText(event.line, RENDER_MEMORY_CAPS.rawJsonPreviewChars)
      : event.line,
    stderrPreview: event.stderrPreview
      ? cappedPreviewText(
          event.stderrPreview,
          RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
        )
      : event.stderrPreview,
    text: event.text
      ? cappedPreviewText(
          event.text,
          RENDER_MEMORY_CAPS.transcriptPayloadChars,
        )
      : event.text,
  };
}

export function buildAgentQueueRunActivitySnapshot({
  activity,
  latestRun,
  selectedTask,
}: {
  activity: AgentQueueRunActivityState;
  latestRun: AgentQueueTaskRunLinkSummary | null;
  selectedTask: AgentQueueTask;
}): AgentQueueRunActivitySnapshot {
  const recentEvents = activity.events.slice(-RECENT_ACTIVITY_LIMIT);
  const latestEvent = activity.events[activity.events.length - 1] ?? null;
  const lastCommandEvent = [...activity.events]
    .reverse()
    .find((event) => event.command);
  const currentStage = inferRunStage({
    latestEvent,
    latestRun,
    selectedTask,
  });
  const currentMessage =
    readableCurrentMessage(latestEvent) ??
    fallbackCurrentMessage(currentStage, latestRun);

  return {
    currentMessage,
    currentStage,
    lastCommand: lastCommandEvent?.command ?? null,
    lastCommandStatus: lastCommandEvent
      ? activityStatusLabel(lastCommandEvent.status)
      : null,
    rawEvents: activity.rawEvents,
    recentEvents,
    statusLine:
      currentStage === "Report ready"
        ? "Completed - final response received."
        : currentStage === "Failed"
          ? "Failed - review run details."
          : "Running - waiting for final response.",
  };
}

function inferRunStage({
  latestEvent,
  latestRun,
  selectedTask,
}: {
  latestEvent: AgentActivityEvent | null;
  latestRun: AgentQueueTaskRunLinkSummary | null;
  selectedTask: AgentQueueTask;
}): AgentQueueRunStage {
  if (
    isFailedStatus(selectedTask.status) ||
    isFailedStatus(latestRun?.status) ||
    latestEvent?.status === "failed"
  ) {
    return "Failed";
  }

  if (
    latestRun &&
    latestRun.status !== "running" &&
    latestRun.status !== "unknown"
  ) {
    return "Report ready";
  }

  if (selectedTask.validationStatus === "validating") {
    return "Validating";
  }

  if (latestEvent?.command) {
    return "Running commands";
  }

  const title = latestEvent?.title.toLowerCase() ?? "";
  const summary = latestEvent?.summary?.toLowerCase() ?? "";

  if (title.includes("command")) {
    return "Running commands";
  }

  if (title.includes("read") || summary.includes("reading")) {
    return "Reading context";
  }

  if (
    title.includes("response") ||
    summary.includes("response") ||
    title.includes("turn completed")
  ) {
    return "Preparing report";
  }

  if (title.includes("thread") || title.includes("turn")) {
    return "Preparing";
  }

  return latestEvent ? "Preparing" : "Starting";
}

function readableCurrentMessage(event: AgentActivityEvent | null) {
  if (!event) {
    return null;
  }

  if (event.command && event.status === "running") {
    return `Running command: ${event.command}`;
  }

  if (event.command && event.status === "completed") {
    return `Finished command: ${event.command}`;
  }

  return event.summary ?? event.title;
}

function fallbackCurrentMessage(
  stage: AgentQueueRunStage,
  latestRun: AgentQueueTaskRunLinkSummary | null,
) {
  if (stage === "Report ready") {
    return "Run completed.";
  }

  if (stage === "Failed") {
    return "Run failed.";
  }

  return latestRun ? "Waiting for final response." : "Starting run.";
}

function activityStatusLabel(status: AgentActivityEvent["status"]) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "running") {
    return "Running";
  }

  return "Pending";
}

function isFailedStatus(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "failed_to_start"
  );
}
