import {
  formatDirectWorkClockTime,
  formatDirectWorkDuration,
} from "./CodexDirectWorkTiming";
import type {
  CodexDirectWorkLiveLogEntry,
  CodexDirectWorkLiveRun,
} from "./CodexDirectWorkLiveLog";

export function liveRunStatusView(status: string): {
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

  if (status === "cancelled") {
    return {
      badgeLabel: "Cancelled",
      badgeVariant: "warning",
      title: "Live log cancelled",
    };
  }

  return {
    badgeLabel: "Running",
    badgeVariant: "info",
    title: "Live log running",
  };
}

export function localLogStatusView(entries: CodexDirectWorkLiveLogEntry[]): {
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

  if (latestEntry.kind === "stop_requested") {
    return {
      badgeLabel: "Stopping",
      badgeVariant: "warning",
      title: "Stop requested",
    };
  }

  if (latestEntry.kind === "stop_failed") {
    return {
      badgeLabel: "Stop failed",
      badgeVariant: "error",
      title: "Stop request failed",
    };
  }

  return {
    badgeLabel: "Starting",
    badgeVariant: "info",
    title: "Starting streaming run",
  };
}

export function liveRunStatusFields(liveRun: CodexDirectWorkLiveRun) {
  return [
    { label: "Run id", value: liveRun.runId },
    { label: "Executor", value: "Codex CLI" },
    { label: "Status", value: liveRun.status },
    liveRun.startedAtMs !== null
      ? {
          label: "Started at",
          value: formatDirectWorkClockTime(liveRun.startedAtMs),
        }
      : null,
    liveRun.completedAtMs !== null
      ? {
          label: "Completed at",
          value: formatDirectWorkClockTime(liveRun.completedAtMs),
        }
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
  ].filter((field): field is { label: string; value: string } =>
    Boolean(field),
  );
}

export function formatEntryTiming(entry: CodexDirectWorkLiveLogEntry) {
  const parts = [
    formatDirectWorkClockTime(entry.receivedAtMs),
    `+${formatDirectWorkDuration(entry.elapsedMs)}`,
  ];

  if (entry.deltaMs !== null) {
    parts.push(`Delta ${formatDirectWorkDuration(entry.deltaMs)}`);
  }

  return parts.join("  ");
}

function liveRunDurationLabel(liveRun: CodexDirectWorkLiveRun) {
  return liveRun.durationMs === null
    ? "Running"
    : formatDirectWorkDuration(liveRun.durationMs);
}
