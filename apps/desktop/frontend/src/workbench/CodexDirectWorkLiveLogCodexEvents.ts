import type { DirectWorkStreamEvent } from "../workspace/types";

const AGENT_MESSAGE_PREVIEW_LIMIT = 500;

export function codexJsonEventText(event: DirectWorkStreamEvent) {
  const payload = parseJsonRecord(event.line);
  const eventType = codexJsonEventType(event, payload);

  if (
    eventType === "item.completed" &&
    codexItemType(payload) === "agent_message"
  ) {
    return (
      shortEventDetail(
        extractAgentMessageText(payload) ?? "Agent message completed.",
        AGENT_MESSAGE_PREVIEW_LIMIT,
      ) || "Agent message completed."
    );
  }

  if (eventType === "thread.started") {
    return "Thread started.";
  }

  if (eventType === "turn.started") {
    return "Turn started.";
  }

  if (eventType === "turn.completed") {
    const usageSummary = compactUsageSummary(payload);
    return usageSummary ? `Turn completed. ${usageSummary}.` : "Turn completed.";
  }

  return eventType ? `Codex event: ${eventType}` : "Codex event";
}

export function codexJsonEventLabel(event: DirectWorkStreamEvent) {
  const payload = parseJsonRecord(event.line);
  const eventType = codexJsonEventType(event, payload);

  if (eventType === "thread.started") {
    return "Thread started";
  }

  if (eventType === "turn.started") {
    return "Turn started";
  }

  if (
    eventType === "item.completed" &&
    codexItemType(payload) === "agent_message"
  ) {
    return "Agent message";
  }

  if (eventType === "turn.completed") {
    return "Turn completed";
  }

  return eventType ? `Codex event: ${eventType}` : "Codex event";
}

function codexJsonEventType(
  event: DirectWorkStreamEvent,
  payload: JsonRecord | null,
) {
  return event.parsedCodexEventType ?? stringValue(payload?.type);
}

function codexItemType(payload: JsonRecord | null) {
  return stringValue(recordValue(payload?.item)?.type);
}

function extractAgentMessageText(payload: JsonRecord | null) {
  const item = recordValue(payload?.item);

  return firstMessageText(item?.text, item?.message, item?.content, item?.parts);
}

function messageTextFromValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => messageTextFromValue(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join("\n") : null;
  }

  const record = recordValue(value);
  return record ? firstMessageText(record.text, record.content) : null;
}

function firstMessageText(...values: unknown[]) {
  for (const value of values) {
    const text = messageTextFromValue(value);
    if (text) {
      return text;
    }
  }

  return null;
}

function compactUsageSummary(payload: JsonRecord | null) {
  const usage = recordValue(payload?.usage);
  if (!usage) {
    return null;
  }

  const parts = [
    usagePart(usage, "input_tokens", "input"),
    usagePart(usage, "output_tokens", "output"),
    usagePart(usage, "total_tokens", "total"),
  ].filter((part): part is string => Boolean(part));

  const summary = parts.length > 0 ? `Usage: ${parts.join(", ")}` : "";
  return summary && summary.length <= 100 ? summary : null;
}

function usagePart(usage: JsonRecord, key: string, label: string) {
  const value = numberValue(usage[key]);
  return value === null ? null : `${formatCount(value)} ${label}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortEventDetail(value: string, limit = 220) {
  const compactValue = value.replace(/\s+/g, " ").trim();

  if (compactValue.length <= limit) {
    return compactValue;
  }

  return `${compactValue.slice(0, limit)}...`;
}

type JsonRecord = Record<string, unknown>;

function parseJsonRecord(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return recordValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function recordValue(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
