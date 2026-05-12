import { Badge } from "../design-system/Badge";
import type { DirectWorkStreamEvent } from "../workspace/types";
import { StaticPreviewFieldList } from "./StaticPreviewPrimitives";

const OUTPUT_PREVIEW_LIMIT = 4000;
const LIVE_LOG_ENTRY_LIMIT = 200;

export type CodexDirectWorkLiveRun = {
  durationMs: number | null;
  finalMessage: string | null;
  runId: string;
  status: string;
  stderrPreview: string;
  stdoutPreview: string;
};

export type CodexDirectWorkLiveLogEntry = {
  detail: string;
  elapsedMs: number;
  id: string;
  kind: DirectWorkStreamEvent["eventKind"];
  runId: string;
  status: string | null;
  text: string;
  tone: "neutral" | "stdout" | "stderr" | "json" | "success" | "error";
};

export function CodexDirectWorkLiveLog({
  entries,
  liveRun,
}: {
  entries: CodexDirectWorkLiveLogEntry[];
  liveRun: CodexDirectWorkLiveRun | null;
}) {
  const statusView = liveRun
    ? liveRunStatusView(liveRun.status)
    : {
        badgeLabel: "Waiting",
        badgeVariant: "neutral" as const,
        title: "Live log",
      };

  return (
    <section
      aria-label="Direct Work live Codex events"
      aria-live="polite"
      className="codex-direct-work-live-log"
    >
      <div className="codex-direct-work-live-log-header">
        <div className="codex-direct-work-copy">
          <h3 className="codex-direct-work-title">{statusView.title}</h3>
          <p className="codex-direct-work-text">
            Live Codex events from this current run.
          </p>
        </div>
        <Badge variant={statusView.badgeVariant}>{statusView.badgeLabel}</Badge>
      </div>

      {liveRun ? (
        <StaticPreviewFieldList
          className="codex-direct-work-result-grid"
          fieldClassName="codex-direct-work-result-field"
          fields={[
            { label: "Run id", value: liveRun.runId },
            { label: "Status", value: liveRun.status },
            {
              label: "Duration",
              value:
                liveRun.durationMs === null
                  ? "Running"
                  : `${liveRun.durationMs} ms`,
            },
          ]}
          labelClassName="codex-direct-work-result-label"
          valueClassName="codex-direct-work-result-value"
        />
      ) : null}

      <div className="codex-direct-work-live-log-list" role="list">
        {entries.length === 0 ? (
          <p className="codex-direct-work-note">
            Waiting for Codex stream events.
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
                  {entry.kind}
                </span>
                <span className="codex-direct-work-live-log-time">
                  {entry.elapsedMs} ms
                </span>
              </div>
              <p className="codex-direct-work-live-log-text">{entry.text}</p>
              {entry.detail ? (
                <p className="codex-direct-work-live-log-detail">
                  {entry.detail}
                </p>
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
    </section>
  );
}

export function liveRunFromEvent(
  currentRun: CodexDirectWorkLiveRun | null,
  event: DirectWorkStreamEvent,
): CodexDirectWorkLiveRun {
  const base =
    currentRun?.runId === event.runId
      ? currentRun
      : {
          durationMs: null,
          finalMessage: null,
          runId: event.runId,
          status: "running",
          stderrPreview: "",
          stdoutPreview: "",
        };

  return {
    ...base,
    durationMs: event.isFinal ? event.elapsedMs : base.durationMs,
    finalMessage:
      event.eventKind === "final_message" && event.text
        ? event.text
        : base.finalMessage,
    status: liveStatusFromEvent(base.status, event),
    stderrPreview:
      event.eventKind === "stderr_line" && event.line
        ? appendOutputPreview(base.stderrPreview, event.line)
        : base.stderrPreview,
    stdoutPreview:
      event.eventKind === "stdout_line" && event.line
        ? appendOutputPreview(base.stdoutPreview, event.line)
        : base.stdoutPreview,
  };
}

export function liveLogEntryFromEvent(
  event: DirectWorkStreamEvent,
): CodexDirectWorkLiveLogEntry {
  return {
    detail: shortEventDetail(event.text ?? event.line ?? ""),
    elapsedMs: event.elapsedMs,
    id: `${event.runId}-${event.elapsedMs}-${event.eventKind}-${event.line ?? event.text ?? ""}`,
    kind: event.eventKind,
    runId: event.runId,
    status: event.status,
    text: liveLogEventText(event),
    tone: liveLogTone(event),
  };
}

export function syntheticStartedLogEntry(
  runId: string,
): CodexDirectWorkLiveLogEntry {
  return {
    detail: "",
    elapsedMs: 0,
    id: `${runId}-synthetic-started`,
    kind: "started",
    runId,
    status: null,
    text: "Codex stream started.",
    tone: "neutral",
  };
}

export function cappedLiveLogEntries(entries: CodexDirectWorkLiveLogEntry[]) {
  return entries.slice(-LIVE_LOG_ENTRY_LIMIT);
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
    return event.parsedCodexEventType
      ? `Codex event: ${event.parsedCodexEventType}`
      : "Codex JSON event";
  }

  if (event.eventKind === "final_message") {
    return "Final message received.";
  }

  if (event.isFinal) {
    return `Run ${event.status ?? event.eventKind}.`;
  }

  if (event.eventKind === "stdout_line") {
    return "stdout";
  }

  if (event.eventKind === "stderr_line") {
    return "stderr";
  }

  return "Codex stream started.";
}

function liveLogTone(
  event: DirectWorkStreamEvent,
): CodexDirectWorkLiveLogEntry["tone"] {
  if (event.eventKind === "stdout_line") {
    return "stdout";
  }

  if (event.eventKind === "stderr_line") {
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

function appendOutputPreview(currentValue: string, line: string) {
  const nextValue = currentValue ? `${currentValue}\n${line}` : line;

  return nextValue.length <= OUTPUT_PREVIEW_LIMIT
    ? nextValue
    : nextValue.slice(nextValue.length - OUTPUT_PREVIEW_LIMIT);
}

function previewLiveOutput(value: string) {
  if (value.length <= OUTPUT_PREVIEW_LIMIT) {
    return value;
  }

  return `${value.slice(
    0,
    OUTPUT_PREVIEW_LIMIT,
  )}\n[Preview truncated in UI.]`;
}

function shortEventDetail(value: string) {
  const compactValue = value.replace(/\s+/g, " ").trim();

  if (compactValue.length <= 220) {
    return compactValue;
  }

  return `${compactValue.slice(0, 220)}...`;
}
