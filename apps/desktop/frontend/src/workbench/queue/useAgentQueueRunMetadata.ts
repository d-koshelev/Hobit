import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AgentExecutorRunDetail,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  DirectWorkStreamEvent,
} from "../../workspace/types";
import { errorToMessage } from "../agentQueueTaskUiModel";
import {
  ingestQueueLinkedDirectWorkCompletionEvidence,
  type QueueLinkedDirectWorkEvidenceIngestionCallback,
} from "../queueLinkedDirectWorkEvidenceWiring";
import type {
  DirectWorkRunHandoff,
  QueueLinkedDirectWorkSource,
  WidgetRenderProps,
} from "../types";
import { refreshAgentQueueRunLinks } from "./agentQueueLoadHelpers";
import {
  appendAgentQueueRunActivityEvent,
  buildAgentQueueRunActivitySnapshot,
  emptyAgentQueueRunActivityState,
} from "./agentQueueRunActivity";

type UseAgentQueueRunMetadataInput = Pick<
  WidgetRenderProps,
  | "onGetAgentExecutorRunDetail"
  | "onGetAgentQueueTaskLatestRunLink"
  | "onIngestQueueLinkedDirectWorkEvidence"
  | "onListenToDirectWorkStreamEvents"
  | "onListAgentQueueTaskRunLinks"
> & {
  loadTasks: (
    preferredTaskId?: string | null,
    options?: { preserveCurrentOnError?: boolean },
  ) => Promise<string | null>;
  queueWidgetInstanceId?: string | null;
  selectedTask: AgentQueueTask | null;
};

export function useAgentQueueRunMetadata({
  loadTasks,
  onGetAgentExecutorRunDetail,
  onGetAgentQueueTaskLatestRunLink,
  onIngestQueueLinkedDirectWorkEvidence,
  onListenToDirectWorkStreamEvents,
  onListAgentQueueTaskRunLinks,
  queueWidgetInstanceId,
  selectedTask,
}: UseAgentQueueRunMetadataInput) {
  const [latestRunLink, setLatestRunLink] =
    useState<AgentQueueTaskRunLinkSummary | null>(null);
  const [runHistoryLinks, setRunHistoryLinks] = useState<
    AgentQueueTaskRunLinkSummary[]
  >([]);
  const [latestRunLinkError, setLatestRunLinkError] = useState<string | null>(
    null,
  );
  const [isLatestRunLinkLoading, setIsLatestRunLinkLoading] = useState(false);
  const [runEvidenceDetail, setRunEvidenceDetail] =
    useState<AgentExecutorRunDetail | null>(null);
  const [runEvidenceError, setRunEvidenceError] = useState<string | null>(null);
  const [isRunEvidenceLoading, setIsRunEvidenceLoading] = useState(false);
  const selectedRunEventRefreshInFlightRef = useRef(false);
  const runEvidenceRequestKeyRef = useRef<string | null>(null);
  const handledQueueOwnedEvidenceIngestionKeysRef = useRef(new Set<string>());
  const [runActivityState, setRunActivityState] = useState(
    emptyAgentQueueRunActivityState,
  );

  useEffect(() => {
    setRunActivityState(emptyAgentQueueRunActivityState());
  }, [latestRunLink?.directWorkRunId, selectedTask?.queueItemId]);

  const refreshLatestRunLink = useCallback(
    async (
      queueItemId: string | null | undefined,
      options?: { silent?: boolean },
    ) => {
      await refreshAgentQueueRunLinks({
        onGetAgentQueueTaskLatestRunLink,
        onListAgentQueueTaskRunLinks,
        options,
        queueItemId,
        setIsLatestRunLinkLoading,
        setLatestRunLink,
        setLatestRunLinkError,
        setRunHistoryLinks,
      });
    },
    [onGetAgentQueueTaskLatestRunLink, onListAgentQueueTaskRunLinks],
  );

  useEffect(() => {
    void refreshLatestRunLink(selectedTask?.queueItemId ?? null);
  }, [refreshLatestRunLink, selectedTask?.queueItemId]);

  useEffect(() => {
    const selectedTaskId = selectedTask?.queueItemId ?? null;
    const selectedRunId = latestRunLink?.directWorkRunId ?? null;
    const selectedExecutorWidgetId = latestRunLink?.executorWidgetId ?? null;
    const hasActiveSelectedRun =
      Boolean(selectedTaskId && selectedRunId && selectedExecutorWidgetId) &&
      (selectedTask?.status === "running" || latestRunLink?.status === "running");

    if (
      !onListenToDirectWorkStreamEvents ||
      !selectedTaskId ||
      !selectedRunId ||
      !selectedExecutorWidgetId ||
      !hasActiveSelectedRun
    ) {
      return undefined;
    }

    const activeSelectedRunId = selectedRunId;
    const activeSelectedExecutorWidgetId = selectedExecutorWidgetId;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function refreshSelectedRunFromEvent(event: DirectWorkStreamEvent) {
      if (
        cancelled ||
        !isSelectedQueueRunStreamEvent(event, {
          runId: activeSelectedRunId,
          widgetInstanceId: activeSelectedExecutorWidgetId,
        }) ||
        (!event.isFinal && selectedRunEventRefreshInFlightRef.current)
      ) {
        return;
      }

      setRunActivityState((current) =>
        appendAgentQueueRunActivityEvent(current, event),
      );

      if (!event.isFinal) {
        return;
      }

      selectedRunEventRefreshInFlightRef.current = true;

      try {
        await loadTasks(selectedTaskId, { preserveCurrentOnError: true });
        await refreshLatestRunLink(selectedTaskId, { silent: true });
      } finally {
        selectedRunEventRefreshInFlightRef.current = false;
      }
    }

    void onListenToDirectWorkStreamEvents((event) => {
      void refreshSelectedRunFromEvent(event);
    }).then(
      (stopListening) => {
        if (cancelled) {
          stopListening();
          return;
        }
        unsubscribe = stopListening;
      },
      () => undefined,
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    latestRunLink?.directWorkRunId,
    latestRunLink?.executorWidgetId,
    latestRunLink?.status,
    loadTasks,
    onListenToDirectWorkStreamEvents,
    refreshLatestRunLink,
    selectedTask?.queueItemId,
    selectedTask?.status,
  ]);

  const refreshRunEvidence = useCallback(
    async (
      link: AgentQueueTaskRunLinkSummary | null | undefined,
      options?: { silent?: boolean },
    ) => {
      if (!link || link.status === "running") {
        runEvidenceRequestKeyRef.current = null;
        setRunEvidenceDetail(null);
        setRunEvidenceError(null);
        setIsRunEvidenceLoading(false);
        return;
      }

      const requestKey = `${link.executorWidgetId}:${link.directWorkRunId}`;
      runEvidenceRequestKeyRef.current = requestKey;

      if (!onGetAgentExecutorRunDetail) {
        setRunEvidenceDetail(null);
        setRunEvidenceError(
          "Direct Work result detail is only available when Executor run detail APIs are available.",
        );
        setIsRunEvidenceLoading(false);
        return;
      }

      if (!options?.silent) {
        setIsRunEvidenceLoading(true);
        setRunEvidenceError(null);
      }

      try {
        const detail = await onGetAgentExecutorRunDetail(
          link.executorWidgetId,
          link.directWorkRunId,
        );
        if (runEvidenceRequestKeyRef.current !== requestKey) {
          return;
        }
        setRunEvidenceDetail(detail);
        setRunEvidenceError(detail ? null : "Direct Work result was not found.");
        await ingestQueueOwnedRunEvidenceIfReady({
          detail,
          handledIngestionKeys:
            handledQueueOwnedEvidenceIngestionKeysRef.current,
          link,
          onIngestQueueLinkedDirectWorkEvidence,
          queueWidgetInstanceId,
          selectedTask,
        });
      } catch (error) {
        if (runEvidenceRequestKeyRef.current !== requestKey) {
          return;
        }
        setRunEvidenceDetail(null);
        setRunEvidenceError(
          errorToMessage(error, "Unable to load Direct Work result evidence."),
        );
      } finally {
        if (!options?.silent) {
          setIsRunEvidenceLoading(false);
        }
      }
    },
    [
      onGetAgentExecutorRunDetail,
      onIngestQueueLinkedDirectWorkEvidence,
      queueWidgetInstanceId,
      selectedTask,
    ],
  );

  useEffect(() => {
    void refreshRunEvidence(latestRunLink);
  }, [
    latestRunLink?.directWorkRunId,
    latestRunLink?.executorWidgetId,
    latestRunLink?.status,
    refreshRunEvidence,
  ]);

  const runActivitySnapshot = useMemo(
    () =>
      selectedTask
        ? buildAgentQueueRunActivitySnapshot({
            activity: runActivityState,
            latestRun: latestRunLink,
            selectedTask,
          })
        : {
            currentMessage: "No Queue task selected.",
            currentStage: "Starting" as const,
            lastCommand: null,
            lastCommandStatus: null,
            rawEvents: [],
            recentEvents: [],
            statusLine: "No active run selected.",
          },
    [latestRunLink, runActivityState, selectedTask],
  );

  return {
    isLatestRunLinkLoading,
    isRunEvidenceLoading,
    latestRunLink,
    latestRunLinkError,
    refreshLatestRunLink,
    refreshRunEvidence,
    runActivitySnapshot,
    runActivityState,
    runEvidenceDetail,
    runEvidenceError,
    runHistoryLinks,
  };
}

function isSelectedQueueRunStreamEvent(
  event: DirectWorkStreamEvent,
  selectedRun: {
    runId: string;
    widgetInstanceId: string;
  },
) {
  return (
    event.runId === selectedRun.runId &&
    event.widgetInstanceId === selectedRun.widgetInstanceId
  );
}

async function ingestQueueOwnedRunEvidenceIfReady({
  detail,
  handledIngestionKeys,
  link,
  onIngestQueueLinkedDirectWorkEvidence,
  queueWidgetInstanceId,
  selectedTask,
}: {
  detail: AgentExecutorRunDetail | null;
  handledIngestionKeys: Set<string>;
  link: AgentQueueTaskRunLinkSummary;
  onIngestQueueLinkedDirectWorkEvidence:
    | QueueLinkedDirectWorkEvidenceIngestionCallback
    | undefined;
  queueWidgetInstanceId: string | null | undefined;
  selectedTask: AgentQueueTask | null;
}) {
  const queueOwnerWidgetId = cleanText(queueWidgetInstanceId);

  if (
    !detail ||
    !queueOwnerWidgetId ||
    !selectedTask ||
    link.executorWidgetId !== queueOwnerWidgetId ||
    link.queueTaskId !== selectedTask.queueItemId ||
    detail.summary.runId !== link.directWorkRunId ||
    !isFinalRunDetailStatus(detail.summary.status)
  ) {
    return;
  }

  const source = queueLinkedSourceForRunLink(link.source);
  const handoff: DirectWorkRunHandoff = {
    executorWidgetInstanceId: link.executorWidgetId,
    id: 0,
    queueItemId: link.queueTaskId,
    queueLinkedSource: source,
    repoRoot:
      cleanText(detail.summary.repoRoot) ??
      cleanText(selectedTask.executionWorkspace) ??
      "",
    runId: link.directWorkRunId,
    startedAt: cleanText(link.startedAt) ?? detail.summary.startedAt,
    taskTitle: cleanText(selectedTask.title) ?? "Queue task",
    workbenchId: "",
    workspaceId: cleanText(link.workspaceId) ?? selectedTask.workspaceId,
  };

  await ingestQueueLinkedDirectWorkCompletionEvidence({
    finalStatus: detail.summary.status,
    handledIngestionKeys,
    handoff,
    ingestEvidence: onIngestQueueLinkedDirectWorkEvidence,
    runDetail: detail,
    source,
  });
}

function queueLinkedSourceForRunLink(
  source: AgentQueueTaskRunLinkSummary["source"],
): QueueLinkedDirectWorkSource {
  switch (source) {
    case "autorun":
      return "queue_autorun_start";
    case "sequential_runner":
      return "queue_sequential_start";
    case "manual":
      return "queue_manual_start";
    default:
      return "queue_handoff";
  }
}

function isFinalRunDetailStatus(status: string) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "canceled"
  );
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || null;
}
