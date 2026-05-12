import { Badge } from "../design-system/Badge";
import type { DirectWorkStreamEvent } from "../workspace/types";
import {
  directWorkGitReviewHint,
  directWorkGitWidgetAvailability,
} from "./CodexDirectWorkReviewHint";
import {
  codexJsonEventLabel,
  codexJsonEventText,
} from "./CodexDirectWorkLiveLogCodexEvents";
import {
  formatDirectWorkClockTime,
  formatDirectWorkDuration,
} from "./CodexDirectWorkTiming";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";
import type { DirectWorkGitReviewStatus } from "./types";

const OUTPUT_PREVIEW_LIMIT = 4000;
const LIVE_LOG_ENTRY_LIMIT = 200;
const RAW_EVENT_PREVIEW_LIMIT = 180;

export type CodexDirectWorkLiveRun = {
  completedAtMs: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  exitCode: number | null;
  failedStage: string | null;
  finalMessage: string | null;
  finalStatus: string | null;
  runId: string;
  startedAtMs: number | null;
  status: string;
  stderrPreview: string;
  stdoutPreview: string;
};

export type CodexDirectWorkLiveLogEntryKind =
  | DirectWorkStreamEvent["eventKind"]
  | "stream_starting"
  | "stream_start_failed"
  | "fallback_starting"
  | "fallback_completed"
  | "fallback_failed";

export type CodexDirectWorkLiveLogEntryTone =
  | "neutral"
  | "info"
  | "stdout"
  | "stderr"
  | "json"
  | "success"
  | "error";

export type CodexDirectWorkLiveLogEntry = {
  deltaMs: number | null;
  detail: string;
  elapsedMs: number;
  id: string;
  kind: CodexDirectWorkLiveLogEntryKind;
  label?: string;
  rawPreview?: string;
  receivedAtMs: number;
  runId: string;
  status: string | null;
  text: string;
  tone: CodexDirectWorkLiveLogEntryTone;
};

export function CodexDirectWorkLiveLog({
  entries,
  gitReviewStatus,
  hasGitWidget,
  liveRun,
}: {
  entries: CodexDirectWorkLiveLogEntry[];
  gitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
  liveRun: CodexDirectWorkLiveRun | null;
}) {
  const statusView = liveRun
    ? liveRunStatusView(liveRun.status)
    : localLogStatusView(entries);
  const reviewHint =
    liveRun && isFinalStatus(liveRun.status)
      ? directWorkGitReviewHint(
          liveRun.status,
          directWorkGitWidgetAvailability(hasGitWidget),
          gitReviewStatus,
        )
      : null;

  return (
    <section
      aria-label="Direct Work live status entries"
      aria-live="polite"
      className="codex-direct-work-live-log"
    >
      <div className="codex-direct-work-live-log-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">{statusView.title}</h3>
          <p className="codex-direct-work-text">
            Current Direct Work status entries.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      {liveRun ? (
        <StaticPreviewFieldList
          className="codex-direct-work-result-grid"
          fieldClassName="codex-direct-work-result-field"
          fields={liveRunStatusFields(liveRun)}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      ) : null}

      {liveRun && isFailureStatus(liveRun.status) ? (
        <div className="codex-direct-work-error-message">
          <span className="codex-direct-work-result-label">Failure reason</span>
          <span className="codex-direct-work-result-value">
            {liveRun.errorMessage ?? "No failure detail was reported."}
          </span>
          <p className="codex-direct-work-review-note">
            More lifecycle details may be available in Logs.
          </p>
        </div>
      ) : null}

      <div className="codex-direct-work-live-log-list" role="list">
        {entries.length === 0 ? (
          <p className="codex-direct-work-note">
            Waiting for live stream events.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              className={`codex-direct-work-live-log-entry codex-direct-work-live-log-entry-${entry.tone}`}
              key={entry.id}
              role="listitem"
            >
              <div className="codex-direct-work-live-log-entry-meta">
                <span className="codex-direct-work-live-log-kind">
                  {entry.label ?? liveLogEntryLabel(entry)}
                </span>
                <span className="codex-direct-work-live-log-time">
                  {formatEntryTiming(entry)}
                </span>
              </div>
              <p className="codex-direct-work-live-log-text">{entry.text}</p>
              {entry.detail ? (
                <p className="codex-direct-work-live-log-detail">
                  {entry.detail}
                </p>
              ) : null}
              {entry.rawPreview ? (
                <details className="codex-direct-work-live-log-raw">
                  <summary className="codex-direct-work-live-log-detail">
                    Raw event
                  </summary>
                  <p className="codex-direct-work-live-log-detail">
                    {entry.rawPreview}
                  </p>
                </details>
              ) : null}
            </div>
          ))
        )}
      </div>

      {liveRun?.finalMessage ? (
        <div className="codex-direct-work-final-message">
          <div className="codex-direct-work-output-header">
            <span className="codex-direct-work-result-label">
              Final response preview
            </span>
          </div>
          <pre className="codex-direct-work-output">
            <code>{previewLiveOutput(liveRun.finalMessage)}</code>
          </pre>
        </div>
      ) : null}

      {liveRun?.stdoutPreview ? (
        <details className="codex-direct-work-output-details">
          <summary className="codex-direct-work-output-summary">
            live stdout preview
          </summary>
          <pre className="codex-direct-work-output">
            <code>{previewLiveOutput(liveRun.stdoutPreview)}</code>
          </pre>
        </details>
      ) : null}

      {liveRun?.stderrPreview ? (
        <details className="codex-direct-work-output-details">
          <summary className="codex-direct-work-output-summary">
            live stderr preview
          </summary>
          <pre className="codex-direct-work-output">
            <code>{previewLiveOutput(liveRun.stderrPreview)}</code>
          </pre>
        </details>
      ) : null}

      {reviewHint ? (
        <p className="codex-direct-work-review-note">{reviewHint}</p>
      ) : null}
    </section>
  );
}

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
        ? event.text
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
  return status === "completed" || status === "failed" || status === "timed_out";
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

  if (event.isFinal) {
    return `Run ${event.status ?? event.eventKind}.`;
  }

  if (event.eventKind === "stdout_line") {
    return event.line || "Runtime output.";
  }

  if (event.eventKind === "stderr_line") {
    return event.line || (isInformationalStderrLine(event.line)
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

  if (event.eventKind === "started") {
    return "Run started";
  }

  return "Runtime event";
}

function liveLogRawPreview(event: DirectWorkStreamEvent) {
  return event.eventKind === "codex_json_event" && event.line
    ? shortEventDetail(event.line, RAW_EVENT_PREVIEW_LIMIT)
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

  return "neutral";
}

function liveLogEntryLabel(entry: CodexDirectWorkLiveLogEntry) {
  return LOCAL_LOG_LABELS[entry.kind] ?? entry.kind;
}

const LOCAL_LOG_LABELS: Partial<
  Record<CodexDirectWorkLiveLogEntryKind, string>
> = {
  fallback_completed: "Fallback completed",
  fallback_failed: "Fallback failed",
  fallback_starting: "Fallback",
  started: "Run started",
  stream_start_failed: "Streaming failed",
  stream_starting: "Starting",
};

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

function liveRunStatusView(status: string): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  title: string;
} {
  if (status === "completed") {
    return {
      badgeLabel: "Completed",
      badgeVariant: "success",
      title: "Live log completed",
    };
  }

  if (status === "failed") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "error",
      title: "Live log failed",
    };
  }

  if (status === "timed_out") {
    return {
      badgeLabel: "Timed out",
      badgeVariant: "warning",
      title: "Live log timed out",
    };
  }

  return {
    badgeLabel: "Running",
    badgeVariant: "info",
    title: "Live log running",
  };
}

function localLogStatusView(entries: CodexDirectWorkLiveLogEntry[]): {
  badgeLabel: string;
  badgeVariant: "neutral" | "info" | "success" | "warning" | "error";
  title: string;
} {
  const latestEntry = entries[entries.length - 1];

  if (!latestEntry) {
    return {
      badgeLabel: "Waiting",
      badgeVariant: "neutral",
      title: "Live log",
    };
  }

  if (latestEntry.kind === "fallback_completed") {
    return {
      badgeLabel: "Completed",
      badgeVariant: "success",
      title: "One-shot fallback completed",
    };
  }

  if (latestEntry.kind === "fallback_failed") {
    return {
      badgeLabel: "Failed",
      badgeVariant: "error",
      title: "One-shot fallback failed",
    };
  }

  if (latestEntry.kind === "stream_start_failed") {
    return {
      badgeLabel: "Unavailable",
      badgeVariant: "warning",
      title: "Streaming start failed",
    };
  }

  if (latestEntry.kind === "fallback_starting") {
    return {
      badgeLabel: "Running",
      badgeVariant: "info",
      title: "One-shot fallback running",
    };
  }

  return {
    badgeLabel: "Starting",
    badgeVariant: "info",
    title: "Starting streaming run",
  };
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
    return event.stderrPreview;
  }

  if (event.eventKind === "stderr_line" && event.line) {
    return appendOutputPreview(currentValue, event.line);
  }

  return currentValue;
}

function liveRunStatusFields(liveRun: CodexDirectWorkLiveRun) {
  return [
    { label: "Run id", value: liveRun.runId },
    { label: "Executor", value: "Codex CLI" },
    { label: "Status", value: liveRun.status },
    liveRun.startedAtMs !== null
      ? { label: "Started at", value: formatDirectWorkClockTime(liveRun.startedAtMs) }
      : null,
    liveRun.completedAtMs !== null
      ? { label: "Completed at", value: formatDirectWorkClockTime(liveRun.completedAtMs) }
      : null,
    liveRun.finalStatus
      ? { label: "Final status", value: liveRun.finalStatus }
      : null,
    liveRun.exitCode !== null
      ? { label: "Exit code", value: String(liveRun.exitCode) }
      : null,
    liveRun.failedStage
      ? { label: "Failed stage", value: liveRun.failedStage }
      : null,
    { label: "Total duration", value: liveRunDurationLabel(liveRun) },
  ].filter((field): field is { label: string; value: string } => Boolean(field));
}

function liveRunDurationLabel(liveRun: CodexDirectWorkLiveRun) {
  return liveRun.durationMs === null
    ? "Running"
    : formatDirectWorkDuration(liveRun.durationMs);
}

function isFailureStatus(status: string) {
  return status === "failed" || status === "timed_out";
}

function formatEntryTiming(entry: CodexDirectWorkLiveLogEntry) {
  const parts = [
    formatDirectWorkClockTime(entry.receivedAtMs),
    `+${formatDirectWorkDuration(entry.elapsedMs)}`,
  ];

  if (entry.deltaMs !== null) {
    parts.push(`Delta ${formatDirectWorkDuration(entry.deltaMs)}`);
  }

  return parts.join("  ");
}

function isFailureEvent(event: DirectWorkStreamEvent) {
  return event.eventKind === "failed" || event.eventKind === "timed_out";
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

function previewLiveOutput(value: string) {
  if (value.length <= OUTPUT_PREVIEW_LIMIT) {
    return value;
  }

  return `${value.slice(0, OUTPUT_PREVIEW_LIMIT)}\n[Preview truncated in UI.]`;
}

function shortEventDetail(value: string, limit = 220) {
  const compactValue = value.replace(/\s+/g, " ").trim();

  if (compactValue.length <= limit) {
    return compactValue;
  }

  return `${compactValue.slice(0, limit)}...`;
}

function isInformationalStderrLine(line: string | null) {
  return line?.trim() === "Reading additional input from stdin...";
}
