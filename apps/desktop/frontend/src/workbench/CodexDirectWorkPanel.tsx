import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "../design-system/Badge";
import type {
  DirectWorkStreamEvent,
  RunCodexDirectWorkResponse,
} from "../workspace/types";
import { CodexDirectWorkForm } from "./CodexDirectWorkForm";
import {
  CodexDirectWorkLiveLog,
  cappedLiveLogEntries,
  isFinalStatus,
  liveLogEntryFromEvent,
  liveRunFromEvent,
  syntheticStartedLogEntry,
  type CodexDirectWorkLiveLogEntry,
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
  onRunCodexDirectWork,
  onStartCodexDirectWorkStream,
  widgetInstanceId,
}: CodexDirectWorkPanelProps) {
  const panelTitleId = useId();
  const [isRunning, setIsRunning] = useState(false);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [runResult, setRunResult] =
    useState<RunCodexDirectWorkResponse | null>(null);
  const [liveRun, setLiveRun] = useState<CodexDirectWorkLiveRun | null>(null);
  const [liveLogEntries, setLiveLogEntries] = useState<
    CodexDirectWorkLiveLogEntry[]
  >([]);
  const stopStreamListeningRef = useRef<(() => void) | null>(null);
  const canRunBackend = Boolean(onStartCodexDirectWorkStream || onRunCodexDirectWork);

  useEffect(() => () => stopActiveStreamListening(), []);

  async function runDirectWork(request: CodexDirectWorkRequestDraft) {
    if (isRunning || (!onStartCodexDirectWorkStream && !onRunCodexDirectWork)) {
      return;
    }

    clearRunState();
    setIsRunning(true);

    try {
      if (onStartCodexDirectWorkStream) {
        await runStreamingDirectWork(request);
        return;
      }

      await runOneShotDirectWork(request);
    } catch (error) {
      setRunErrorMessage(errorToMessage(error));
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

  async function runOneShotDirectWork(request: CodexDirectWorkRequestDraft) {
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

  function clearRunState() {
    setRunErrorMessage(null);
    setRunResult(null);
    setLiveRun(null);
    setLiveLogEntries([]);
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
            onStartCodexDirectWorkStream
              ? "The desktop backend started Codex streaming. Live events appear below."
              : "The desktop backend is running the existing Codex Direct Work command."
          }
          title="Running Codex Direct Work"
          variant="info"
        />
      ) : null}

      {liveRun || liveLogEntries.length > 0 ? (
        <CodexDirectWorkLiveLog entries={liveLogEntries} liveRun={liveRun} />
      ) : null}

      {runErrorMessage ? (
        <CodexDirectWorkNotice
          message={runErrorMessage}
          title="Direct Work request failed"
          variant="error"
        />
      ) : null}

      {runResult ? <CodexDirectWorkResultSummary result={runResult} /> : null}
    </section>
  );
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to run Codex Direct Work.";
}
