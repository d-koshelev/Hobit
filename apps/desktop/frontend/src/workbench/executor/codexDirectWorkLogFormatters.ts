import type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveLogEntryKind,
} from "./codexDirectWorkLogTypes";

const OUTPUT_PREVIEW_LIMIT = 4000;

export function previewLiveOutput(value: string) {
  if (value.length <= OUTPUT_PREVIEW_LIMIT) {
    return value;
  }

  return `${value.slice(0, OUTPUT_PREVIEW_LIMIT)}\n[Preview truncated in UI.]`;
}

export function shortEventDetail(value: string, limit = 220) {
  const compactValue = value.replace(/\s+/g, " ").trim();

  if (compactValue.length <= limit) {
    return compactValue;
  }

  return `${compactValue.slice(0, limit)}...`;
}

export function isInformationalStderrLine(line: string | null) {
  return line?.trim() === "Reading additional input from stdin...";
}

export function liveLogEntryLabel(entry: CodexDirectWorkLiveLogEntry) {
  return LOCAL_LOG_LABELS[entry.kind] ?? entry.kind;
}

const LOCAL_LOG_LABELS: Partial<
  Record<CodexDirectWorkLiveLogEntryKind, string>
> = {
  fallback_completed: "Fallback completed",
  fallback_failed: "Fallback failed",
  fallback_starting: "Fallback",
  queue_handoff_attached: "Queue handoff",
  started: "Run started",
  stop_acknowledged: "Stop requested",
  stop_failed: "Stop failed",
  stop_not_active: "Stop unavailable",
  stop_requested: "Stop requested",
  kill_acknowledged: "Kill requested",
  kill_failed: "Kill failed",
  kill_not_active: "Kill unavailable",
  kill_requested: "Kill requested",
  stream_start_failed: "Streaming failed",
  stream_starting: "Starting",
};
