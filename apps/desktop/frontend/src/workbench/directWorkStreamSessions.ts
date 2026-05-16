import {
  listenToDirectWorkStreamEvents,
  startCodexDirectWorkStream,
} from "../workspace/workspaceApi";
import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkRequest,
  StartCodexDirectWorkStreamResponse,
} from "../workspace/types";
import { directWorkResultFromStreamEvent } from "./directWorkStreamActivity";
import type { WidgetInstanceId } from "./types";
import type { CurrentSessionActivityEvents } from "./useCurrentSessionActivity";

export type CodexDirectWorkRunRequest = Omit<
  RunCodexDirectWorkRequest,
  "workspaceId" | "workbenchId" | "widgetInstanceId"
>;

export type CodexDirectWorkStreamSession =
  StartCodexDirectWorkStreamResponse & {
    stopListening: () => void;
  };

type DirectWorkStreamSessionOptions = {
  bumpWidgetLogRefreshToken: (widgetInstanceId: WidgetInstanceId) => void;
  currentSessionActivity?: CurrentSessionActivityEvents;
  onEvent: (event: DirectWorkStreamEvent) => void;
  widgetInstanceId: WidgetInstanceId;
  workbenchId: string;
  workspaceId: string;
};

export async function startDirectWorkStreamSession({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  onEvent,
  request,
  widgetInstanceId,
  workbenchId,
  workspaceId,
}: DirectWorkStreamSessionOptions & {
  request: CodexDirectWorkRunRequest;
}): Promise<CodexDirectWorkStreamSession | null> {
  let activeRunId: string | null = null;
  const queuedEvents: DirectWorkStreamEvent[] = [];
  let finalEventSeen = false;

  const unsubscribe = await listenToDirectWorkStreamEvents((event) => {
    if (
      !isMatchingStreamEvent(event, workspaceId, workbenchId, widgetInstanceId)
    ) {
      return;
    }

    if (!activeRunId) {
      queuedEvents.push(event);
      return;
    }

    if (event.runId !== activeRunId) {
      return;
    }

    onEvent(event);

    if (event.isFinal) {
      finalEventSeen = true;
      recordFinalStreamEvent({
        bumpWidgetLogRefreshToken,
        currentSessionActivity,
        event,
        unsubscribe,
        widgetInstanceId,
      });
    }
  });

  currentSessionActivity?.markDirectWorkRunStarted(widgetInstanceId);

  try {
    const response = await startCodexDirectWorkStream({
      workspaceId,
      workbenchId,
      widgetInstanceId,
      ...request,
    });

    if (!response) {
      unsubscribe();
      currentSessionActivity?.markDirectWorkRunFinished(
        widgetInstanceId,
        null,
      );
      return null;
    }

    activeRunId = response.runId;
    queuedEvents
      .filter((event) => event.runId === activeRunId)
      .forEach((event) => {
        onEvent(event);

        if (event.isFinal) {
          finalEventSeen = true;
          recordFinalStreamEvent({
            bumpWidgetLogRefreshToken,
            currentSessionActivity,
            event,
            unsubscribe,
            widgetInstanceId,
          });
        }
      });

    return {
      ...response,
      stopListening: () => {
        unsubscribe();
        if (!finalEventSeen) {
          bumpWidgetLogRefreshToken(widgetInstanceId);
        }
      },
    };
  } catch (error) {
    unsubscribe();
    currentSessionActivity?.markDirectWorkRunFailed(widgetInstanceId, error);
    throw error;
  }
}

export async function attachDirectWorkStreamSession({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  onEvent,
  runId,
  widgetInstanceId,
  workbenchId,
  workspaceId,
}: DirectWorkStreamSessionOptions & {
  runId: string;
}): Promise<CodexDirectWorkStreamSession> {
  let finalEventSeen = false;

  const unsubscribe = await listenToDirectWorkStreamEvents((event) => {
    if (
      !isMatchingStreamEvent(event, workspaceId, workbenchId, widgetInstanceId)
    ) {
      return;
    }

    if (event.runId !== runId) {
      return;
    }

    onEvent(event);

    if (event.isFinal) {
      finalEventSeen = true;
      recordFinalStreamEvent({
        bumpWidgetLogRefreshToken,
        currentSessionActivity,
        event,
        unsubscribe,
        widgetInstanceId,
      });
    }
  });

  return {
    runId,
    status: "attached",
    stopListening: () => {
      unsubscribe();
      if (!finalEventSeen) {
        bumpWidgetLogRefreshToken(widgetInstanceId);
      }
    },
  };
}

function isMatchingStreamEvent(
  event: DirectWorkStreamEvent,
  workspaceId: string,
  workbenchId: string,
  widgetInstanceId: WidgetInstanceId,
) {
  return (
    event.workspaceId === workspaceId &&
    event.workbenchId === workbenchId &&
    event.widgetInstanceId === widgetInstanceId
  );
}

function recordFinalStreamEvent({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  event,
  unsubscribe,
  widgetInstanceId,
}: {
  bumpWidgetLogRefreshToken: (widgetInstanceId: WidgetInstanceId) => void;
  currentSessionActivity?: CurrentSessionActivityEvents;
  event: DirectWorkStreamEvent;
  unsubscribe: () => void;
  widgetInstanceId: WidgetInstanceId;
}) {
  bumpWidgetLogRefreshToken(widgetInstanceId);
  currentSessionActivity?.markDirectWorkRunFinished(
    widgetInstanceId,
    directWorkResultFromStreamEvent(event),
  );
  unsubscribe();
}
