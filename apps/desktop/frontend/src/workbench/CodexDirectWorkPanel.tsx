import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkResponse,
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
import { CodexDirectWorkResultSummary } from "./CodexDirectWorkResultSummary";
import type {
  CodexDirectWorkRequestDraft,
  CodexDirectWorkStreamSession,
} from "./CodexDirectWorkTypes";
import type { WidgetInstanceId } from "./types";

type CodexDirectWorkPanelProps = {
  hasGitWidget?: boolean;
  onRunCodexDirectWork?: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRequestDraft,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  onStartCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    request: CodexDirectWorkRequestDraft,
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<CodexDirectWorkStreamSession | null>;
  widgetInstanceId: WidgetInstanceId;
};

export function CodexDirectWorkPanel({
  hasGitWidget,
  onRunCodexDirectWork,
  onStartCodexDirectWorkStream,
  widgetInstanceId,
}: CodexDirectWorkPanelProps) {
  const panelTitleId = useId();
  const [isRunning, setIsRunning] = useState(false);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [runInfoNotice, setRunInfoNotice] = useState<{
    message: string;
    title: string;
  } | null>(null);
  const [runResult, setRunResult] =
    useState<RunCodexDirectWorkResponse | null>(null);
  const [liveRun, setLiveRun] = useState<CodexDirectWorkLiveRun | null>(null);
  const [liveLogEntries, setLiveLogEntries] = useState<
    CodexDirectWorkLiveLogEntry[]
  >([]);
  const localLogEntrySequenceRef = useRef(0);
  const runStartedAtRef = useRef<number | null>(null);
  const stopStreamListeningRef = useRef<(() => void) | null>(null);
  const canRunBackend = Boolean(
    onStartCodexDirectWorkStream || onRunCodexDirectWork,
  );

  useEffect(() => () => stopActiveStreamListening(), []);

  async function runDirectWork(request: CodexDirectWorkRequestDraft) {
    if (isRunning || (!onStartCodexDirectWorkStream && !onRunCodexDirectWork)) {
      return;
    }

    clearRunState();
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
    setLiveLogEntries((currentEntries) =>
      currentEntries.some(
        (entry) => entry.runId === session.runId && entry.kind === "started",
      )
        ? currentEntries
        : cappedLiveLogEntries([
            ...currentEntries,
            syntheticStartedLogEntry(session.runId),
          ]),
    );
    setLiveRun((currentRun) => {
      if (currentRun?.runId === session.runId && isFinalStatus(currentRun.status)) {
        return currentRun;
      }

      return {
        durationMs: currentRun?.runId === session.runId ? currentRun.durationMs : null,
        finalMessage:
          currentRun?.runId === session.runId ? currentRun.finalMessage : null,
        runId: session.runId,
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
    setIsRunning(false);
    return response;
  }

  function handleValidationError(message: string) {
    clearRunState();
    setRunErrorMessage(message);
  }

  function recordStreamEvent(event: DirectWorkStreamEvent) {
    setLiveLogEntries((currentEntries) =>
      cappedLiveLogEntries([...currentEntries, liveLogEntryFromEvent(event)]),
    );
    setLiveRun((currentRun) => liveRunFromEvent(currentRun, event));

    if (event.isFinal) {
      setIsRunning(false);
      stopActiveStreamListening();
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
    const elapsedMs = startedAt === null ? 0 : Date.now() - startedAt;
    const id = `local-${++localLogEntrySequenceRef.current}-${kind}`;

    setLiveLogEntries((currentEntries) =>
      cappedLiveLogEntries([
        ...currentEntries,
        {
          detail,
          elapsedMs,
          id,
          kind,
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
    setRunResult(null);
    setLiveRun(null);
    setLiveLogEntries([]);
    runStartedAtRef.current = null;
    stopActiveStreamListening();
  }

  function stopActiveStreamListening() {
    stopStreamListeningRef.current?.();
    stopStreamListeningRef.current = null;
  }

  return (
    <section aria-labelledby={panelTitleId} className="codex-direct-work-panel">
      <div className="codex-direct-work-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title" id={panelTitleId}>
            Codex Direct Work
          </h3>
          <p className="codex-direct-work-text">
            Run Codex on a focused task. Codex may edit files when
            workspace-write is selected. No commit or push will be created
            automatically.
          </p>
        </div>
        <Badge variant="info">One-shot</Badge>
      </div>

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

      {liveRun || liveLogEntries.length > 0 ? (
        <CodexDirectWorkLiveLog
          entries={liveLogEntries}
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
          hasGitWidget={hasGitWidget}
          result={runResult}
        />
      ) : null}
    </section>
  );
}

function isOneShotFallbackRunning(entries: CodexDirectWorkLiveLogEntry[]) {
  return entries[entries.length - 1]?.kind === "fallback_starting";
}
