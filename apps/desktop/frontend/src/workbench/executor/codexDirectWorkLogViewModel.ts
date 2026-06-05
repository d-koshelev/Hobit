import type { DirectWorkStreamEvent } from "../../workspace/types";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
  cappedRawDetailsText,
  cappedTailPreviewText,
} from "../../renderMemoryGuards";
import {
  codexJsonEventLabel,
  codexJsonEventText,
} from "../CodexDirectWorkLiveLogCodexEvents";
import {
  isInformationalStderrLine,
  shortEventDetail,
} from "./codexDirectWorkLogFormatters";
import type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveRun,
} from "./codexDirectWorkLogTypes";

const LIVE_LOG_ENTRY_LIMIT = RENDER_MEMORY_CAPS.directWorkLogRenderedEvents;
const OUTPUT_PREVIEW_LIMIT = RENDER_MEMORY_CAPS.stdoutStderrPreviewChars;
const RAW_EVENT_PREVIEW_LIMIT = 180;
const LIVE_LOG_ROW_TEXT_LIMIT = 1200;

export function liveRunFromEvent(
  currentRun: CodexDirectWorkLiveRun | null,
  event: DirectWorkStreamEvent,
  receivedAtMs = Date.now(),
): CodexDirectWorkLiveRun {
  const startedAtMs = Math.max(0, receivedAtMs - event.elapsedMs);
  const base =
    currentRun?.runId === event.runId
      ? currentRun
      : {
          completedAtMs: null,
          durationMs: null,
          errorMessage: null,
          exitCode: null,
          failedStage: null,
          finalMessage: null,
          finalStatus: null,
          runId: event.runId,
          startedAtMs,
          status: "running",
          stderrPreview: "",
          stdoutPreview: "",
        };

  return {
    ...base,
    completedAtMs: event.isFinal ? receivedAtMs : base.completedAtMs,
    durationMs: event.isFinal ? event.elapsedMs : base.durationMs,
    errorMessage: event.errorMessage ?? base.errorMessage,
    exitCode: event.exitCode ?? base.exitCode,
    failedStage: event.failedStage ?? base.failedStage,
    finalMessage:
      event.eventKind === "final_message" && event.text
        ? cappedPreviewText(
            event.text,
            RENDER_MEMORY_CAPS.transcriptMessageChars,
          )
        : base.finalMessage,
    finalStatus: event.finalStatus ?? base.finalStatus,
    startedAtMs: base.startedAtMs ?? startedAtMs,
    status: liveStatusFromEvent(base.status, event),
    stderrPreview: liveStderrPreviewFromEvent(base.stderrPreview, event),
    stdoutPreview:
      event.eventKind === "stdout_line" && event.line
        ? appendOutputPreview(base.stdoutPreview, event.line)
        : base.stdoutPreview,
  };
}

export function liveLogEntryFromEvent(
  event: DirectWorkStreamEvent,
  receivedAtMs = Date.now(),
): CodexDirectWorkLiveLogEntry {
  return {
    deltaMs: null,
    detail: liveLogEventDetail(event),
    elapsedMs: event.elapsedMs,
    id: `${event.runId}-${event.elapsedMs}-${event.eventKind}-${liveLogEventIdSuffix(event)}`,
    kind: event.eventKind,
    label: liveLogEventLabel(event),
    rawPreview: liveLogRawPreview(event),
    receivedAtMs,
    runId: event.runId,
    status: event.status,
    text: liveLogEventText(event),
    tone: liveLogTone(event),
  };
}

export function syntheticStartedLogEntry(
  runId: string,
  receivedAtMs = Date.now(),
): CodexDirectWorkLiveLogEntry {
  return {
    deltaMs: null,
    detail: "",
    elapsedMs: 0,
    id: `${runId}-synthetic-started`,
    kind: "started",
    receivedAtMs,
    runId,
    status: null,
    text: "Started a Direct Work run.",
    tone: "neutral",
  };
}

export function cappedLiveLogEntries(entries: CodexDirectWorkLiveLogEntry[]) {
  return withVisibleEntryDeltas(
    deduplicateStartedEntries(entries).slice(-LIVE_LOG_ENTRY_LIMIT),
  );
}

export function isFinalStatus(status: string) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled"
  );
}

export function isFailureStatus(status: string) {
  return status === "failed" || status === "timed_out";
}

function liveStatusFromEvent(
  currentStatus: string,
  event: DirectWorkStreamEvent,
) {
  if (event.isFinal) {
    return event.status ?? event.eventKind;
  }

  if (event.eventKind === "started") {
    return "running";
  }

  return currentStatus === "started" ? "running" : currentStatus;
}

function liveLogEventText(event: DirectWorkStreamEvent) {
  if (event.eventKind === "codex_json_event") {
    return codexJsonEventText(event);
  }

  if (event.eventKind === "final_message") {
    return "Final response received.";
  }

  if (event.isFinal && isFailureEvent(event)) {
    return shortEventDetail(
      event.errorMessage ?? `Run ${event.status ?? event.eventKind}.`,
    );
  }

  if (event.eventKind === "cancelled") {
    return shortEventDetail(
      event.errorMessage ?? "Run cancelled by operator request.",
    );
  }

  if (event.isFinal) {
    return `Run ${event.status ?? event.eventKind}.`;
  }

  if (event.eventKind === "stdout_line") {
    return event.line
      ? cappedTailPreviewText(
          event.line,
          LIVE_LOG_ROW_TEXT_LIMIT,
          "Preview capped",
        )
      : "Runtime output.";
  }

  if (event.eventKind === "stderr_line") {
    return event.line
      ? cappedTailPreviewText(
          event.line,
          LIVE_LOG_ROW_TEXT_LIMIT,
          "Preview capped",
        )
      : (isInformationalStderrLine(event.line)
      ? "Runtime note."
      : "Error output.");
  }

  return "Started a Direct Work run.";
}

function liveLogEventDetail(event: DirectWorkStreamEvent) {
  if (event.eventKind === "codex_json_event") {
    return "";
  }

  if (event.eventKind === "final_message") {
    return shortEventDetail(event.text ?? "");
  }

  if (event.isFinal && isFailureEvent(event)) {
    return failureEventDetail(event);
  }

  if (event.eventKind === "cancelled") {
    return cancellationEventDetail(event);
  }

  if (event.eventKind === "stdout_line" || event.eventKind === "stderr_line") {
    return "";
  }

  return shortEventDetail(event.text ?? event.line ?? "");
}

function liveLogEventLabel(event: DirectWorkStreamEvent) {
  if (event.eventKind === "codex_json_event") {
    return codexJsonEventLabel(event);
  }

  if (event.eventKind === "stdout_line") {
    return "Runtime output";
  }

  if (event.eventKind === "stderr_line") {
    return isInformationalStderrLine(event.line) ? "Runtime note" : "Error output";
  }

  if (event.eventKind === "final_message") {
    return "Final response received";
  }

  if (event.eventKind === "completed") {
    return "Run completed";
  }

  if (event.eventKind === "failed") {
    return "Run failed";
  }

  if (event.eventKind === "timed_out") {
    return "Run timed out";
  }

  if (event.eventKind === "cancelled") {
    return "Run cancelled";
  }

  if (event.eventKind === "started") {
    return "Run started";
  }

  return "Runtime event";
}

function liveLogRawPreview(event: DirectWorkStreamEvent) {
  return event.eventKind === "codex_json_event" && event.line
    ? cappedRawDetailsText(
        shortEventDetail(event.line, RAW_EVENT_PREVIEW_LIMIT),
        RENDER_MEMORY_CAPS.rawJsonPreviewChars,
      )
    : undefined;
}

function liveLogEventIdSuffix(event: DirectWorkStreamEvent) {
  return shortEventDetail(
    event.parsedCodexEventType ??
      event.errorMessage ??
      event.text ??
      event.line ??
      "",
    60,
  );
}

function liveLogTone(
  event: DirectWorkStreamEvent,
): CodexDirectWorkLiveLogEntry["tone"] {
  if (event.eventKind === "stdout_line") {
    return "stdout";
  }

  if (event.eventKind === "stderr_line") {
    if (isInformationalStderrLine(event.line)) {
      return "info";
    }

    return "stderr";
  }

  if (event.eventKind === "codex_json_event") {
    return "json";
  }

  if (event.eventKind === "completed") {
    return "success";
  }

  if (event.eventKind === "failed" || event.eventKind === "timed_out") {
    return "error";
  }

  if (event.eventKind === "cancelled") {
    return "info";
  }

  return "neutral";
}

function deduplicateStartedEntries(entries: CodexDirectWorkLiveLogEntry[]) {
  const startedRunIds = new Set<string>();

  return entries.filter((entry) => {
    if (entry.kind !== "started") {
      return true;
    }

    if (startedRunIds.has(entry.runId)) {
      return false;
    }

    startedRunIds.add(entry.runId);
    return true;
  });
}

function withVisibleEntryDeltas(entries: CodexDirectWorkLiveLogEntry[]) {
  return entries.map((entry, index) => {
    const previousEntry = index > 0 ? entries[index - 1] : null;

    return {
      ...entry,
      deltaMs: previousEntry
        ? Math.max(0, entry.elapsedMs - previousEntry.elapsedMs)
        : null,
    };
  });
}

function appendOutputPreview(currentValue: string, line: string) {
  const nextValue = currentValue ? `${currentValue}\n${line}` : line;

  return nextValue.length <= OUTPUT_PREVIEW_LIMIT
    ? nextValue
    : nextValue.slice(nextValue.length - OUTPUT_PREVIEW_LIMIT);
}

function liveStderrPreviewFromEvent(
  currentValue: string,
  event: DirectWorkStreamEvent,
) {
  if (event.stderrPreview) {
    return cappedTailPreviewText(
      event.stderrPreview,
      RENDER_MEMORY_CAPS.stdoutStderrPreviewChars,
    );
  }

  if (event.eventKind === "stderr_line" && event.line) {
    return appendOutputPreview(currentValue, event.line);
  }

  return currentValue;
}

function isFailureEvent(event: DirectWorkStreamEvent) {
  return event.eventKind === "failed" || event.eventKind === "timed_out";
}

function cancellationEventDetail(event: DirectWorkStreamEvent) {
  const details = [
    event.finalStatus ? `final status: ${event.finalStatus}` : null,
    event.exitCode !== null ? `exit code: ${event.exitCode}` : null,
    event.stderrPreview
      ? `stderr: ${shortEventDetail(event.stderrPreview, 300)}`
      : null,
  ].filter((detail): detail is string => Boolean(detail));

  return details.join("; ");
}

function failureEventDetail(event: DirectWorkStreamEvent) {
  const details = [
    event.finalStatus ? `final status: ${event.finalStatus}` : null,
    event.failedStage ? `stage: ${event.failedStage}` : null,
    event.exitCode !== null ? `exit code: ${event.exitCode}` : null,
    event.stderrPreview
      ? `stderr: ${shortEventDetail(event.stderrPreview, 300)}`
      : null,
  ].filter((detail): detail is string => Boolean(detail));

  return details.join("; ");
}
