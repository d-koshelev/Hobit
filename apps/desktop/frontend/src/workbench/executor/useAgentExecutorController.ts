import { useEffect, useRef, useState } from "react";

import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkResponse,
} from "../../workspace/types";
import {
  codexDirectWorkErrorToMessage,
  streamingFallbackFailureMessage,
  streamingFallbackSuccessMessage,
  streamingNoFallbackMessage,
} from "../CodexDirectWorkErrors";
import {
  cappedLiveLogEntries,
  isFinalStatus,
  liveLogEntryFromEvent,
  liveRunFromEvent,
  syntheticStartedLogEntry,
  type CodexDirectWorkLiveLogEntry,
  type CodexDirectWorkLiveLogEntryKind,
  type CodexDirectWorkLiveRun,
} from "../CodexDirectWorkLiveLog";
import type { CodexDirectWorkPanelProps } from "../CodexDirectWorkPanelTypes";
import type { CodexDirectWorkRequestDraft } from "../CodexDirectWorkTypes";
import { agentActivityEventFromDirectWorkStreamEvent } from "../agentActivityModel";
import type { DirectWorkRunHandoff } from "../types";
import { useAgentExecutorRunHistoryRefresh } from "../useAgentExecutorRunHistoryRefresh";
import { useCodexDirectWorkQueueHandoff } from "../useCodexDirectWorkQueueHandoff";
import { useCodexDirectWorkRunControls } from "../useCodexDirectWorkRunControls";

export function useAgentExecutorController({
  directWorkRunHandoff,
  onDirectWorkGitReviewRequested,
  onDirectWorkRunHandoffFinalState,
  onAttachToCodexDirectWorkStream,
  onCancelCodexDirectWorkRun,
  onForceKillCodexDirectWorkRun,
  onGetAgentExecutorRunDetail,
  onIngestQueueLinkedDirectWorkEvidence,
  onPublishAgentActivityEvents,
  onRunCodexDirectWork,
  onRunDirectWorkValidation,
  onStartCodexDirectWorkStream,
  widgetInstanceId,
}: CodexDirectWorkPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [runInfoNotice, setRunInfoNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [runResult, setRunResult] =
    useState<RunCodexDirectWorkResponse | null>(null);
  const [runResultTiming, setRunResultTiming] = useState<{
    completedAtMs: number;
    startedAtMs: number;
  } | null>(null);
  const [liveRun, setLiveRun] = useState<CodexDirectWorkLiveRun | null>(null);
  const [queueRunSource, setQueueRunSource] =
    useState<DirectWorkRunHandoff | null>(null);
  const [activeStreamingRunId, setActiveStreamingRunId] =
    useState<string | null>(null);
  const [validationRepositoryRoot, setValidationRepositoryRoot] =
    useState<string | null>(null);
  const [liveLogEntries, setLiveLogEntries] = useState<
    CodexDirectWorkLiveLogEntry[]
  >([]);
  const localLogEntrySequenceRef = useRef(0);
  const activeRequestRef = useRef<CodexDirectWorkRequestDraft | null>(null);
  const queueRunSourceRef = useRef<DirectWorkRunHandoff | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const stopStreamListeningRef = useRef<(() => void) | null>(null);
  const streamStartAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);
  const canRunBackend = Boolean(
    onStartCodexDirectWorkStream || onRunCodexDirectWork,
  );
  const canStopActiveStreamingRun = Boolean(
    onCancelCodexDirectWorkRun &&
      activeStreamingRunId &&
      isRunning &&
      liveRun !== null &&
      liveRun.runId === activeStreamingRunId &&
      !isFinalStatus(liveRun.status),
  );
  const canKillActiveStreamingRun = Boolean(
    onForceKillCodexDirectWorkRun &&
      activeStreamingRunId &&
      isRunning &&
      liveRun !== null &&
      liveRun.runId === activeStreamingRunId &&
      !isFinalStatus(liveRun.status),
  );
  const {
    historyRefreshToken,
    refreshRunHistory,
    runDirectWorkValidationAndRefresh,
  } = useAgentExecutorRunHistoryRefresh(onRunDirectWorkValidation);
  const {
    cancelKillConfirmation,
    forceKillStreamingRun,
    isKillConfirming,
    isKillRequesting,
    isStopRequesting,
    recordFinalStreamControlState,
    requestKillConfirmation,
    resetRunControlState,
    setIsStopRequesting,
    stopNotice,
    stopStreamingRun,
  } = useCodexDirectWorkRunControls({
    activeStreamingRunId,
    appendLocalLiveLogEntry,
    canKillActiveStreamingRun,
    onCancelCodexDirectWorkRun,
    onForceKillCodexDirectWorkRun,
    widgetInstanceId,
  });

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopActiveStreamListening();
    };
  }, []);

  useCodexDirectWorkQueueHandoff({
    activeRequestRef,
    activeStreamingRunId,
    appendLocalLiveLogEntry,
    clearRunState,
    directWorkRunHandoff,
    isRunning,
    liveRun,
    onAttachToCodexDirectWorkStream,
    onGetAgentExecutorRunDetail,
    onIngestQueueLinkedDirectWorkEvidence,
    onQueueRunFinalState: onDirectWorkRunHandoffFinalState,
    recordStreamEvent,
    refreshRunHistory,
    runStartedAtRef,
    setActiveStreamingRunId,
    setIsRunning,
    setIsStopRequesting,
    setLiveRun,
    setQueueRunSource: setQueueRunSourceState,
    setRunErrorMessage,
    setRunInfoNotice,
    setValidationRepositoryRoot,
    stopActiveStreamListening,
    stopStreamListeningRef,
    widgetInstanceId,
  });

  async function runDirectWork(request: CodexDirectWorkRequestDraft) {
    if (isRunning || (!onStartCodexDirectWorkStream && !onRunCodexDirectWork)) {
      return;
    }

    clearRunState();
    activeRequestRef.current = request;
    runStartedAtRef.current = Date.now();
    setIsRunning(true);

    try {
      if (onStartCodexDirectWorkStream) {
        await runStreamingDirectWorkWithFallback(request);
        return;
      }

      await runOneShotDirectWork(request);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setRunErrorMessage(codexDirectWorkErrorToMessage(error));
      activeRequestRef.current = null;
      setIsRunning(false);
    }
  }

  async function runStreamingDirectWorkWithFallback(
    request: CodexDirectWorkRequestDraft,
  ) {
    appendLocalLiveLogEntry(
      "stream_starting",
      "Starting streaming run...",
      "neutral",
      "",
      "starting",
    );

    let streamingErrorMessage =
      "Streaming start failed without error details.";

    try {
      await runStreamingDirectWork(request);
      return;
    } catch (error) {
      streamingErrorMessage = codexDirectWorkErrorToMessage(error);
      appendLocalLiveLogEntry(
        "stream_start_failed",
        "Streaming start failed...",
        "error",
        streamingErrorMessage,
        "failed",
      );
    }

    if (!onRunCodexDirectWork) {
      setRunErrorMessage(streamingNoFallbackMessage(streamingErrorMessage));
      setIsRunning(false);
      return;
    }

    appendLocalLiveLogEntry(
      "fallback_starting",
      "Falling back to one-shot run...",
      "neutral",
      "Streaming failed before a run id was returned.",
      "running",
    );

    try {
      const response = await runOneShotDirectWork(request);
      appendLocalLiveLogEntry(
        "fallback_completed",
        "One-shot fallback completed.",
        "success",
        `Run id: ${response.runId}`,
        "completed",
        response.runId,
      );
      setRunInfoNotice({
        message: streamingFallbackSuccessMessage(streamingErrorMessage),
        title: "Live streaming unavailable; ran one-shot fallback.",
      });
    } catch (fallbackError) {
      const fallbackErrorMessage =
        codexDirectWorkErrorToMessage(fallbackError);
      appendLocalLiveLogEntry(
        "fallback_failed",
        "One-shot fallback failed.",
        "error",
        fallbackErrorMessage,
        "failed",
      );
      setRunErrorMessage(
        streamingFallbackFailureMessage(
          streamingErrorMessage,
          fallbackErrorMessage,
        ),
      );
      setIsRunning(false);
    }
  }

  async function runStreamingDirectWork(request: CodexDirectWorkRequestDraft) {
    if (!onStartCodexDirectWorkStream) {
      throw new Error("Codex Direct Work streaming is unavailable.");
    }

    streamStartAbortControllerRef.current?.abort();
    const startAbortController = new AbortController();
    streamStartAbortControllerRef.current = startAbortController;

    const session = await onStartCodexDirectWorkStream(
      widgetInstanceId,
      request,
      recordStreamEvent,
      startAbortController.signal,
    ).finally(() => {
      if (streamStartAbortControllerRef.current === startAbortController) {
        streamStartAbortControllerRef.current = null;
      }
    });

    if (!isMountedRef.current || startAbortController.signal.aborted) {
      session?.stopListening();
      return;
    }

    if (!session) {
      throw new Error(
        "Codex Direct Work streaming was not accepted for this widget instance.",
      );
    }

    stopStreamListeningRef.current = session.stopListening;
    setActiveStreamingRunId(session.runId);
    setLiveLogEntries((currentEntries) =>
      currentEntries.some(
        (entry) => entry.runId === session.runId && entry.kind === "started",
      )
        ? currentEntries
        : cappedLiveLogEntries([
            ...currentEntries,
            syntheticStartedLogEntry(session.runId, Date.now()),
          ]),
    );
    setLiveRun((currentRun) => {
      if (
        currentRun?.runId === session.runId &&
        isFinalStatus(currentRun.status)
      ) {
        return currentRun;
      }

      return {
        durationMs:
          currentRun?.runId === session.runId ? currentRun.durationMs : null,
        completedAtMs:
          currentRun?.runId === session.runId
            ? currentRun.completedAtMs
            : null,
        errorMessage:
          currentRun?.runId === session.runId ? currentRun.errorMessage : null,
        exitCode:
          currentRun?.runId === session.runId ? currentRun.exitCode : null,
        failedStage:
          currentRun?.runId === session.runId ? currentRun.failedStage : null,
        finalMessage:
          currentRun?.runId === session.runId ? currentRun.finalMessage : null,
        finalStatus:
          currentRun?.runId === session.runId ? currentRun.finalStatus : null,
        runId: session.runId,
        startedAtMs:
          currentRun?.runId === session.runId &&
          currentRun.startedAtMs !== null
            ? currentRun.startedAtMs
            : Date.now(),
        status: session.status === "started" ? "running" : session.status,
        stderrPreview:
          currentRun?.runId === session.runId ? currentRun.stderrPreview : "",
        stdoutPreview:
          currentRun?.runId === session.runId ? currentRun.stdoutPreview : "",
      };
    });
  }

  async function runOneShotDirectWork(
    request: CodexDirectWorkRequestDraft,
  ): Promise<RunCodexDirectWorkResponse> {
    if (!onRunCodexDirectWork) {
      throw new Error("Codex Direct Work is unavailable in this runtime.");
    }

    const response = await onRunCodexDirectWork(widgetInstanceId, request);

    if (!response) {
      throw new Error(
        "Codex Direct Work was not accepted for this widget instance.",
      );
    }

    setRunResult(response);
    const completedAtMs = Date.now();
    setRunResultTiming({
      completedAtMs,
      startedAtMs:
        runStartedAtRef.current ?? completedAtMs - response.durationMs,
    });
    setValidationRepositoryRoot(response.repoRoot || request.repoRoot);
    setIsRunning(false);
    setActiveStreamingRunId(null);
    requestGitReviewForRepositoryRoot(response.repoRoot || request.repoRoot);
    activeRequestRef.current = null;
    refreshRunHistory();
    return response;
  }

  function handleValidationError(message: string) {
    clearRunState();
    setRunErrorMessage(message);
  }

  function recordStreamEvent(event: DirectWorkStreamEvent) {
    const receivedAtMs = Date.now();
    const activityEvent = agentActivityEventFromDirectWorkStreamEvent({
      event,
      receivedAtMs,
      sourceKind: "agent-executor",
      sourceLabel: "Agent Executor",
    });

    if (activityEvent) {
      onPublishAgentActivityEvents?.([activityEvent]);
    }

    setLiveLogEntries((currentEntries) =>
      cappedLiveLogEntries([
        ...currentEntries,
        liveLogEntryFromEvent(event, receivedAtMs),
      ]),
    );
    setLiveRun((currentRun) =>
      liveRunFromEvent(currentRun, event, receivedAtMs),
    );

    if (event.isFinal) {
      setIsRunning(false);
      recordFinalStreamControlState(event);
      setActiveStreamingRunId((currentRunId) =>
        currentRunId === event.runId ? null : currentRunId,
      );
      stopActiveStreamListening();
      const repositoryRoot = activeRequestRef.current?.repoRoot ?? null;
      setValidationRepositoryRoot(repositoryRoot);
      if (queueRunSourceRef.current?.runId !== event.runId) {
        requestGitReviewForRepositoryRoot(repositoryRoot);
      }
      activeRequestRef.current = null;
      refreshRunHistory();
    }
  }

  function appendLocalLiveLogEntry(
    kind: CodexDirectWorkLiveLogEntryKind,
    text: string,
    tone: CodexDirectWorkLiveLogEntry["tone"],
    detail = "",
    status: string | null = null,
    runId = "pending",
  ) {
    const startedAt = runStartedAtRef.current;
    const receivedAtMs = Date.now();
    const elapsedMs = startedAt === null ? 0 : receivedAtMs - startedAt;
    const id = `local-${++localLogEntrySequenceRef.current}-${kind}`;

    setLiveLogEntries((currentEntries) =>
      cappedLiveLogEntries([
        ...currentEntries,
        {
          deltaMs: null,
          detail,
          elapsedMs,
          id,
          kind,
          receivedAtMs,
          runId,
          status,
          text,
          tone,
        },
      ]),
    );
  }

  function clearRunState() {
    setRunErrorMessage(null);
    setRunInfoNotice(null);
    resetRunControlState();
    setRunResult(null);
    setRunResultTiming(null);
    setLiveRun(null);
    setQueueRunSourceState(null);
    setActiveStreamingRunId(null);
    setValidationRepositoryRoot(null);
    setLiveLogEntries([]);
    activeRequestRef.current = null;
    runStartedAtRef.current = null;
    stopActiveStreamListening();
  }

  function requestGitReviewForRepositoryRoot(repositoryRoot?: string | null) {
    const trimmedRepositoryRoot = repositoryRoot?.trim();

    if (!trimmedRepositoryRoot) {
      return;
    }

    onDirectWorkGitReviewRequested?.({
      repositoryRoot: trimmedRepositoryRoot,
      sourceWidgetInstanceId: widgetInstanceId,
    });
  }

  function setQueueRunSourceState(
    value:
      | DirectWorkRunHandoff
      | null
      | ((current: DirectWorkRunHandoff | null) => DirectWorkRunHandoff | null),
  ) {
    if (typeof value !== "function") {
      queueRunSourceRef.current = value;
      setQueueRunSource(value);
      return;
    }

    setQueueRunSource((current) => {
      const next = value(current);
      queueRunSourceRef.current = next;
      return next;
    });
  }

  function stopActiveStreamListening() {
    streamStartAbortControllerRef.current?.abort();
    streamStartAbortControllerRef.current = null;
    stopStreamListeningRef.current?.();
    stopStreamListeningRef.current = null;
  }

  return {
    canKillActiveStreamingRun,
    canRunBackend,
    canStopActiveStreamingRun,
    cancelKillConfirmation,
    forceKillStreamingRun,
    handleValidationError,
    historyRefreshToken,
    isKillConfirming,
    isKillRequesting,
    isRunning,
    isStopRequesting,
    liveLogEntries,
    liveRun,
    queueRunSource,
    requestKillConfirmation,
    runDirectWork,
    runDirectWorkValidationAndRefresh,
    runErrorMessage,
    runInfoNotice,
    runResult,
    runResultTiming,
    stopNotice,
    stopStreamingRun,
    validationRepositoryRoot,
  };
}
