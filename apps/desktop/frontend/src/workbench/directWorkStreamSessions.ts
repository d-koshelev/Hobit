import {
  listenToDirectWorkStreamEvents,
  startCodexDirectWorkStream,
} from "../workspace/workspaceApi";
import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkRequest,
  StartCodexDirectWorkStreamResponse,
} from "../workspace/types";
import { RENDER_MEMORY_CAPS, capArrayToLast } from "../renderMemoryGuards";
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
  signal?: AbortSignal;
  widgetInstanceId: WidgetInstanceId;
  workbenchId: string;
  workspaceId: string;
};

export async function startDirectWorkStreamSession({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  onEvent,
  request,
  signal,
  widgetInstanceId,
  workbenchId,
  workspaceId,
}: DirectWorkStreamSessionOptions & {
  request: CodexDirectWorkRunRequest;
}): Promise<CodexDirectWorkStreamSession | null> {
  if (signal?.aborted) {
    return null;
  }

  let activeRunId: string | null = null;
  const queuedEvents: DirectWorkStreamEvent[] = [];
  let finalEventSeen = false;
  let stopListening: () => void = () => undefined;
  let removeAbortListener: () => void = () => undefined;
  const stopStream = () => {
    removeAbortListener();
    stopListening();
  };

  const unsubscribe = await listenToDirectWorkStreamEvents((event) => {
    if (
      !isMatchingStreamEvent(event, workspaceId, workbenchId, widgetInstanceId)
    ) {
      return;
    }

    if (!activeRunId) {
      queuedEvents.push(event);
      const cappedQueuedEvents = capArrayToLast(
        queuedEvents,
        RENDER_MEMORY_CAPS.eventRows,
      ).items;
      if (cappedQueuedEvents.length !== queuedEvents.length) {
        queuedEvents.splice(0, queuedEvents.length, ...cappedQueuedEvents);
      }
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
        unsubscribe: stopStream,
        widgetInstanceId,
      });
    }
  });
  stopListening = createIdempotentStop(unsubscribe);

  if (signal?.aborted) {
    stopListening();
    return null;
  }

  removeAbortListener = addAbortListener(signal, stopListening);

  currentSessionActivity?.markDirectWorkRunStarted(widgetInstanceId);

  try {
    const response = await startCodexDirectWorkStream({
      workspaceId,
      workbenchId,
      widgetInstanceId,
      ...request,
    });

    if (!response) {
      stopListening();
      removeAbortListener();
      currentSessionActivity?.markDirectWorkRunFinished(
        widgetInstanceId,
        null,
      );
      return null;
    }

    if (signal?.aborted) {
      stopListening();
      removeAbortListener();
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
            unsubscribe: stopStream,
            widgetInstanceId,
          });
        }
      });
    queuedEvents.length = 0;

    return {
      ...response,
      stopListening: createIdempotentStop(() => {
        stopStream();
        if (!finalEventSeen) {
          bumpWidgetLogRefreshToken(widgetInstanceId);
        }
      }),
    };
  } catch (error) {
    removeAbortListener();
    stopListening();
    currentSessionActivity?.markDirectWorkRunFailed(widgetInstanceId, error);
    throw error;
  }
}

export async function attachDirectWorkStreamSession({
  bumpWidgetLogRefreshToken,
  currentSessionActivity,
  onEvent,
  runId,
  signal,
  widgetInstanceId,
  workbenchId,
  workspaceId,
}: DirectWorkStreamSessionOptions & {
  runId: string;
}): Promise<CodexDirectWorkStreamSession> {
  if (signal?.aborted) {
    throw new Error("Direct Work stream attachment was cancelled.");
  }

  let finalEventSeen = false;
  let stopListening: () => void = () => undefined;
  let removeAbortListener: () => void = () => undefined;
  const stopStream = () => {
    removeAbortListener();
    stopListening();
  };

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
        unsubscribe: stopStream,
        widgetInstanceId,
      });
    }
  });
  stopListening = createIdempotentStop(unsubscribe);

  if (signal?.aborted) {
    stopListening();
    throw new Error("Direct Work stream attachment was cancelled.");
  }

  removeAbortListener = addAbortListener(signal, stopListening);

  return {
    runId,
    status: "attached",
    stopListening: createIdempotentStop(() => {
      stopStream();
      if (!finalEventSeen) {
        bumpWidgetLogRefreshToken(widgetInstanceId);
      }
    }),
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

function createIdempotentStop(unsubscribe: () => void) {
  let stopped = false;

  return () => {
    if (stopped) {
      return;
    }

    stopped = true;
    unsubscribe();
  };
}

function addAbortListener(
  signal: AbortSignal | undefined,
  stopListening: () => void,
) {
  if (!signal) {
    return () => undefined;
  }

  const abort = () => stopListening();
  signal.addEventListener("abort", abort, { once: true });

  return () => signal.removeEventListener("abort", abort);
}
