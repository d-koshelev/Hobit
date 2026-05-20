import type { AgentExecutorRunSummary } from "../../workspace/types";
import { formatDirectWorkDuration } from "../CodexDirectWorkTiming";

export type AgentExecutorHistoryBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error";

export function runModeLabel(run: AgentExecutorRunSummary) {
  if (run.validationProfile) {
    return `Validation ${run.validationProfile}`;
  }

  return run.mode ?? run.commandKind ?? run.resultType ?? "Direct Work";
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function statusBadgeVariant(
  status: string,
): AgentExecutorHistoryBadgeVariant {
  if (
    status === "completed" ||
    status === "succeeded" ||
    status === "passed"
  ) {
    return "success";
  }

  if (status === "running" || status === "started") {
    return "info";
  }

  if (status === "cancelled" || status === "timed_out") {
    return "warning";
  }

  if (status === "failed" || status === "failed_to_start") {
    return "error";
  }

  return "neutral";
}

export function formatRunDuration(run: AgentExecutorRunSummary) {
  if (run.durationMs !== null) {
    return formatDirectWorkDuration(run.durationMs);
  }

  const startedAt = timestampToMs(run.startedAt);
  const finishedAt = timestampToMs(run.finishedAt);

  if (startedAt !== null && finishedAt !== null && finishedAt >= startedAt) {
    return formatDirectWorkDuration(finishedAt - startedAt);
  }

  return "Unknown";
}

export function historyRunMetaLine(run: AgentExecutorRunSummary) {
  const duration = formatRunDuration(run);
  const parts = [
    `Started ${formatTimestamp(run.startedAt)}`,
    run.finishedAt ? `Completed ${formatTimestamp(run.finishedAt)}` : null,
    duration === "Unknown" ? null : `Duration ${duration}`,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" - ");
}

export function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not completed";
  }

  const timestamp = timestampToMs(value);

  if (timestamp === null) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function timestampToMs(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);

  if (Number.isFinite(numericValue)) {
    return numericValue > 10_000_000_000 ? numericValue : numericValue * 1000;
  }

  const parsedValue = Date.parse(trimmedValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

export function valueOrNone(value: string | null) {
  return value && value.trim() ? value : "None";
}

export function previewOutput(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n[Preview truncated in UI.]`;
}

export function formatRawPayload(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function errorToMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallbackMessage;
}
