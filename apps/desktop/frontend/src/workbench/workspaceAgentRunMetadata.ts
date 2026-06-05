import type { DirectWorkStreamEvent } from "../workspace/types";
import type { CoordinatorDirectWorkStatus } from "./workspaceAgentDirectWorkEvents";
import { shortCodexThreadId } from "./workspaceAgentDirectWorkThreads";

export type WorkspaceAgentRunTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type WorkspaceAgentRunMetadata = {
  durationMs: number | null;
  status: Exclude<CoordinatorDirectWorkStatus, "idle" | "running">;
  stepCount: number;
  threadId: string | null;
  tokenUsage: WorkspaceAgentRunTokenUsage | null;
};

export function tokenUsageFromDirectWorkStreamEvent(
  event: DirectWorkStreamEvent,
): WorkspaceAgentRunTokenUsage | null {
  if (event.eventKind !== "codex_json_event" || !event.line?.trim()) {
    return null;
  }

  const payload = parseJsonRecord(event.line);
  const usage = recordValue(payload?.usage);
  if (!usage) {
    return null;
  }

  const tokenUsage: WorkspaceAgentRunTokenUsage = {};
  const inputTokens =
    numberValue(usage.input_tokens) ?? numberValue(usage.inputTokens);
  const outputTokens =
    numberValue(usage.output_tokens) ?? numberValue(usage.outputTokens);
  const totalTokens =
    numberValue(usage.total_tokens) ?? numberValue(usage.totalTokens);

  if (inputTokens !== null) {
    tokenUsage.inputTokens = inputTokens;
  }
  if (outputTokens !== null) {
    tokenUsage.outputTokens = outputTokens;
  }
  if (totalTokens !== null) {
    tokenUsage.totalTokens = totalTokens;
  }

  return Object.keys(tokenUsage).length > 0 ? tokenUsage : null;
}

export function runMetadataStatusLabel(
  status: WorkspaceAgentRunMetadata["status"],
) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return "Failed";
}

export function runMetadataDurationLabel(durationMs: number | null) {
  if (durationMs === null || durationMs < 0) {
    return null;
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

export function runMetadataThreadLabel(threadId: string | null) {
  return threadId ? shortCodexThreadId(threadId) : null;
}

export function runMetadataTokenLabel(
  tokenUsage: WorkspaceAgentRunTokenUsage | null,
) {
  if (!tokenUsage) {
    return null;
  }

  const parts = [
    usagePart(tokenUsage.inputTokens, "in"),
    usagePart(tokenUsage.outputTokens, "out"),
    usagePart(tokenUsage.totalTokens, "total"),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : null;
}

function usagePart(value: number | undefined, label: string) {
  return value === undefined ? null : `${formatCount(value)} ${label}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function parseJsonRecord(value: string) {
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
