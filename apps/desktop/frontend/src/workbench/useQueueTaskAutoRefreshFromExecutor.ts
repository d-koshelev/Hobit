import { useEffect, useRef } from "react";

import type { DirectWorkQueueTaskAutoRefreshRequest } from "./types";

const QUEUE_AUTO_REFRESH_FAILED =
  "Queue auto-refresh failed. Use Refresh to update task status.";
const QUEUE_AUTO_REFRESH_DELAY_MS = 500;

type UseQueueTaskAutoRefreshFromExecutorOptions = {
  autoRefreshRequest?: DirectWorkQueueTaskAutoRefreshRequest | null;
  isDirty: boolean;
  loadTasks: (
    preferredTaskId?: string | null,
    options?: { preserveCurrentOnError?: boolean },
  ) => Promise<string | null>;
  onRefreshComplete?: (request: DirectWorkQueueTaskAutoRefreshRequest) => void;
  setValidationMessage: (message: string | null) => void;
};

export function useQueueTaskAutoRefreshFromExecutor({
  autoRefreshRequest,
  isDirty,
  loadTasks,
  onRefreshComplete,
  setValidationMessage,
}: UseQueueTaskAutoRefreshFromExecutorOptions) {
  const handledRequestIdRef = useRef<number | null>(null);
  const onRefreshCompleteRef = useRef(onRefreshComplete);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => () => clearRefreshTimer(), []);

  useEffect(() => {
    onRefreshCompleteRef.current = onRefreshComplete;
  }, [onRefreshComplete]);

  useEffect(() => {
    if (
      !autoRefreshRequest ||
      handledRequestIdRef.current === autoRefreshRequest.id
    ) {
      return;
    }

    clearRefreshTimer();
    handledRequestIdRef.current = autoRefreshRequest.id;

    if (isDirty) {
      setValidationMessage(
        `${QUEUE_AUTO_REFRESH_FAILED} Save current task before refreshing.`,
      );
      return;
    }

    if (typeof window === "undefined") {
      void refreshQueueTask(autoRefreshRequest);
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshQueueTask(autoRefreshRequest);
    }, QUEUE_AUTO_REFRESH_DELAY_MS);
  }, [autoRefreshRequest, isDirty, loadTasks, setValidationMessage]);

  async function refreshQueueTask(
    request: DirectWorkQueueTaskAutoRefreshRequest,
  ) {
    try {
      const errorMessage = await loadTasks(request.queueItemId, {
        preserveCurrentOnError: true,
      });

      if (errorMessage) {
        setValidationMessage(`${QUEUE_AUTO_REFRESH_FAILED} ${errorMessage}`);
        return;
      }

      onRefreshCompleteRef.current?.(request);
    } catch (error) {
      setValidationMessage(
        `${QUEUE_AUTO_REFRESH_FAILED} ${errorToMessage(error)}`,
      );
    }
  }

  function clearRefreshTimer() {
    if (refreshTimerRef.current === null) {
      return;
    }

    window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }
}

function errorToMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to refresh queue task.";
}
