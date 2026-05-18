import { useEffect, useRef, useState } from "react";

import type {
  CancelCodexDirectWorkRunResponse,
  DirectWorkStreamEvent,
  DirectWorkValidationProfile,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationResponse,
} from "../workspace/types";
import { CodexDirectWorkForm } from "./CodexDirectWorkForm";
import {
  codexDirectWorkErrorToMessage,
  streamingFallbackFailureMessage,
  streamingFallbackSuccessMessage,
  streamingNoFallbackMessage,
} from "./CodexDirectWorkErrors";
import {
  CodexDirectWorkLiveLog,
  cappedLiveLogEntries,
  isFinalStatus,
  liveLogEntryFromEvent,
  liveRunFromEvent,
  syntheticStartedLogEntry,
  type CodexDirectWorkLiveLogEntry,
  type CodexDirectWorkLiveLogEntryKind,
  type CodexDirectWorkLiveRun,
} from "./CodexDirectWorkLiveLog";
import { CodexDirectWorkNotice } from "./CodexDirectWorkNotice";
import { cancellationFeedbackFromResponse } from "./CodexDirectWorkCancellationFeedback";
import type { GetAgentExecutorDiffSummaryHandler } from "./CodexDirectWorkDiffSummary";
import { CodexDirectWorkPostRunReview } from "./CodexDirectWorkPostRunReview";
import { CodexDirectWorkQueueSource } from "./CodexDirectWorkQueueSource";
import { CodexDirectWorkResultSummary } from "./CodexDirectWorkResultSummary";
import { CodexDirectWorkStopPanel } from "./CodexDirectWorkStopPanel";
import type { CodexDirectWorkRequestDraft, CodexDirectWorkStreamSession } from "./CodexDirectWorkTypes";
import { isOneShotFallbackRunning } from "./CodexDirectWorkStatusText";
import { CodexDirectWorkPanelOverview } from "./CodexDirectWorkPanelOverview";
import type { DirectWorkGitReviewRequestInput, DirectWorkGitReviewStatus, DirectWorkRunHandoff, WidgetInstanceId } from "./types";
import {
  AgentExecutorRunHistoryPanel,
  type GetAgentExecutorRunDetailHandler,
  type ListAgentExecutorRunsHandler,
} from "./AgentExecutorRunHistoryPanel";
import { useAgentExecutorRunHistoryRefresh } from "./useAgentExecutorRunHistoryRefresh";
import { useCodexDirectWorkQueueHandoff } from "./useCodexDirectWorkQueueHandoff";

type CodexDirectWorkPanelProps = {
  gitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
  onDirectWorkGitReviewRequested?: (
    request: DirectWorkGitReviewRequestInput,
  ) => void;
  onDirectWorkRunHandoffFinalState?: (
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) => void;
  onGetAgentExecutorDiffSummary?: GetAgentExecutorDiffSummaryHandler;
  onGetAgentExecutorRunDetail?: GetAgentExecutorRunDetailHandler;
  onListAgentExecutorRuns?: ListAgentExecutorRunsHandler;
  onRunCodexDirectWork?: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRequestDraft,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  onRunDirectWorkValidation?: (
    widgetInstanceId: WidgetInstanceId,
    request: {
      repoRoot: string;
      validationProfile: DirectWorkValidationProfile;
    },
  ) => Promise<RunDirectWorkValidationResponse | null>;
  onCancelCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  onAttachToCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  onStartCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRequestDraft,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  directWorkRunHandoff?: DirectWorkRunHandoff | null;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkPanel({
  directWorkRunHandoff,
  gitReviewStatus,
  hasGitWidget,
  onDirectWorkGitReviewRequested,
  onDirectWorkRunHandoffFinalState,
  onAttachToCodexDirectWorkStream,
  onCancelCodexDirectWorkRun,
  onGetAgentExecutorDiffSummary,
  onGetAgentExecutorRunDetail,
  onListAgentExecutorRuns,
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
  const [stopNotice, setStopNotice] = useState<{
    message: string;
    title: string;
    variant: "info" | "error";
  } | null>(null);
  const [runResult, setRunResult] =
    useState<RunCodexDirectWorkResponse | null>(null);
  const [runResultTiming, setRunResultTiming] = useState<{
    completedAtMs: number;
    startedAtMs: number;
  } | null>(null);
  const [liveRun, setLiveRun] = useState<CodexDirectWorkLiveRun | null>(null);
  const [queueRunSource, setQueueRunSource] = useState<DirectWorkRunHandoff | null>(null);
  const [activeStreamingRunId, setActiveStreamingRunId] =
    useState<string | null>(null);
  const [isStopRequesting, setIsStopRequesting] = useState(false);
  const [validationRepositoryRoot, setValidationRepositoryRoot] =
    useState<string | null>(null);
  const [liveLogEntries, setLiveLogEntries] = useState<
    CodexDirectWorkLiveLogEntry[]
  >([]);
  const localLogEntrySequenceRef = useRef(0);
  const activeRequestRef = useRef<CodexDirectWorkRequestDraft | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const stopStreamListeningRef = useRef<(() => void) | null>(null);
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
  const {
    historyRefreshToken,
    refreshRunHistory,
    runDirectWorkValidationAndRefresh,
  } = useAgentExecutorRunHistoryRefresh(onRunDirectWorkValidation);

  useEffect(() => () => stopActiveStreamListening(), []);

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
    onQueueRunFinalState: onDirectWorkRunHandoffFinalState,
    recordStreamEvent,
    refreshRunHistory,
    requestGitReviewForRepositoryRoot,
    runStartedAtRef,
    setActiveStreamingRunId,
    setIsRunning,
    setIsStopRequesting,
    setLiveRun,
    setQueueRunSource,
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

    const session = await onStartCodexDirectWorkStream(
      widgetInstanceId,
      request,
      recordStreamEvent,
    );

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
      if (currentRun?.runId === session.runId && isFinalStatus(currentRun.status)) {
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

    setLiveLogEntries((currentEntries) =>
      cappedLiveLogEntries([
        ...currentEntries,
        liveLogEntryFromEvent(event, receivedAtMs),
      ]),
    );
    setLiveRun((currentRun) => liveRunFromEvent(currentRun, event, receivedAtMs));

    if (event.isFinal) {
      setIsRunning(false);
      setIsStopRequesting(false);
      setActiveStreamingRunId((currentRunId) =>
        currentRunId === event.runId ? null : currentRunId,
      );
      stopActiveStreamListening();
      if ((event.status ?? event.eventKind) === "cancelled") {
        setStopNotice({
          message:
            "The active Codex process reported cancelled. This does not reset files or undo changes already written.",
          title: "Run cancelled",
          variant: "info",
        });
      }
      const repositoryRoot = activeRequestRef.current?.repoRoot ?? null;
      setValidationRepositoryRoot(repositoryRoot);
      requestGitReviewForRepositoryRoot(repositoryRoot);
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

  async function stopStreamingRun() {
    const runId = activeStreamingRunId;

    if (!runId || !onCancelCodexDirectWorkRun || isStopRequesting) {
      return;
    }

    setIsStopRequesting(true);
    setStopNotice({
      message:
        "Stop run attempts to stop the active Codex process. It does not reset files or undo changes already written.",
      title: "Stop requested",
      variant: "info",
    });
    appendLocalLiveLogEntry(
      "stop_requested",
      "Stop requested.",
      "info",
      "Waiting for the Direct Work stream to report a final cancelled state.",
      "stopping",
      runId,
    );

    try {
      const response = await onCancelCodexDirectWorkRun(
        widgetInstanceId,
        runId,
      );

      if (!response) {
        throw new Error("Cancellation command returned no response.");
      }

      recordCancellationResponse(response);
    } catch (error) {
      const message = codexDirectWorkErrorToMessage(error);
      appendLocalLiveLogEntry(
        "stop_failed",
        "Stop request failed.",
        "error",
        message,
        "failed",
        runId,
      );
      setStopNotice({
        message,
        title: "Stop request failed",
        variant: "error",
      });
    } finally {
      setIsStopRequesting(false);
    }
  }

  function recordCancellationResponse(
    response: CancelCodexDirectWorkRunResponse,
  ) {
    const feedback = cancellationFeedbackFromResponse(response);
    appendLocalLiveLogEntry(
      feedback.entry.kind,
      feedback.entry.text,
      feedback.entry.tone,
      feedback.entry.detail,
      feedback.entry.status,
      feedback.entry.runId,
    );
    setStopNotice(feedback.notice);
  }

  function clearRunState() {
    setRunErrorMessage(null);
    setRunInfoNotice(null);
    setStopNotice(null);
    setRunResult(null);
    setRunResultTiming(null);
    setLiveRun(null);
    setQueueRunSource(null);
    setActiveStreamingRunId(null);
    setIsStopRequesting(false);
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

  function stopActiveStreamListening() {
    stopStreamListeningRef.current?.();
    stopStreamListeningRef.current = null;
  }

  return (
    <section
      aria-label="Agent Executor Direct Work"
      className="codex-direct-work-panel"
    >
      <CodexDirectWorkPanelOverview
        canRunBackend={canRunBackend}
        isRunning={isRunning}
        liveRun={liveRun}
        runErrorMessage={runErrorMessage}
        runResult={runResult}
        widgetInstanceId={widgetInstanceId}
      />

      {queueRunSource ? <CodexDirectWorkQueueSource handoff={queueRunSource} /> : null}

      <CodexDirectWorkForm
        canRunBackend={canRunBackend}
        isRunning={isRunning}
        onSubmit={(request) => {
          void runDirectWork(request);
        }}
        onValidationError={handleValidationError}
      />

      {isRunning ? (
        <CodexDirectWorkNotice
          message={
            isOneShotFallbackRunning(liveLogEntries)
              ? "Live streaming was unavailable; the desktop backend is running the one-shot fallback."
              : onStartCodexDirectWorkStream
                ? "Starting or running Codex streaming. Live events appear below."
              : "The desktop backend is running the existing Codex Direct Work command."
          }
          title="Running Codex Direct Work"
          variant="info"
        />
      ) : null}

      {canStopActiveStreamingRun ? (
        <CodexDirectWorkStopPanel
          isStopRequesting={isStopRequesting}
          onStopStreamingRun={() => void stopStreamingRun()}
        />
      ) : null}

      {stopNotice ? (
        <CodexDirectWorkNotice
          message={stopNotice.message}
          title={stopNotice.title}
          variant={stopNotice.variant}
        />
      ) : null}

      {liveRun || liveLogEntries.length > 0 ? (
        <CodexDirectWorkLiveLog
          entries={liveLogEntries}
          gitReviewStatus={gitReviewStatus}
          hasGitWidget={hasGitWidget}
          liveRun={liveRun}
        />
      ) : null}

      {runErrorMessage ? (
        <CodexDirectWorkNotice
          message={runErrorMessage}
          title="Direct Work request failed"
          variant="error"
        />
      ) : null}

      {runInfoNotice ? (
        <CodexDirectWorkNotice
          message={runInfoNotice.message}
          title={runInfoNotice.title}
          variant="info"
        />
      ) : null}

      {runResult ? (
        <CodexDirectWorkResultSummary
          gitReviewStatus={gitReviewStatus}
          hasGitWidget={hasGitWidget}
          result={runResult}
          timing={runResultTiming}
        />
      ) : null}

      {validationRepositoryRoot ? (
        <CodexDirectWorkPostRunReview
          onGetAgentExecutorDiffSummary={onGetAgentExecutorDiffSummary}
          onRunDirectWorkValidation={runDirectWorkValidationAndRefresh}
          repositoryRoot={validationRepositoryRoot}
          widgetInstanceId={widgetInstanceId}
        />
      ) : null}

      <AgentExecutorRunHistoryPanel
        onGetAgentExecutorRunDetail={onGetAgentExecutorRunDetail}
        onListAgentExecutorRuns={onListAgentExecutorRuns}
        refreshToken={historyRefreshToken}
        widgetInstanceId={widgetInstanceId}
      />
    </section>
  );
}
