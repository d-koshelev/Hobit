import type { DirectWorkStreamEvent } from "../workspace/types";

const AGENT_MESSAGE_PREVIEW_LIMIT = 500;
const COMMAND_PREVIEW_LIMIT = 260;

export type DirectWorkOverviewEventCategory =
  | "status"
  | "file"
  | "command"
  | "message"
  | "output"
  | "warning"
  | "error"
  | "debug";

export type DirectWorkOverviewEvent = {
  body: string;
  category: DirectWorkOverviewEventCategory;
  label: string;
};

export function codexJsonEventText(event: DirectWorkStreamEvent) {
  return formatDirectWorkOverviewEvent(event).body;
}

export function codexJsonEventLabel(event: DirectWorkStreamEvent) {
  return formatDirectWorkOverviewEvent(event).label;
}

export function formatDirectWorkOverviewEvent(
  event: DirectWorkStreamEvent,
): DirectWorkOverviewEvent {
  const payload = parseJsonRecord(event.line);
  const eventType = codexJsonEventType(event, payload);

  if (isErrorEvent(eventType, payload)) {
    return {
      body: shortEventDetail(extractErrorText(payload) ?? "Runtime reported an error."),
      category: "error",
      label: "Error reported",
    };
  }

  if (eventType === "thread.started") {
    return {
      body: "Started a Direct Work run.",
      category: "status",
      label: "Run started",
    };
  }

  if (eventType === "turn.started") {
    return {
      body: "Working on the operator prompt.",
      category: "status",
      label: "Processing request",
    };
  }

  if (eventType === "item.started") {
    return overviewItemStarted(payload);
  }

  if (
    eventType === "item.completed" &&
    codexItemType(payload) === "agent_message"
  ) {
    return {
      body:
        shortEventDetail(
          extractAgentMessageText(payload) ?? "Response received.",
          AGENT_MESSAGE_PREVIEW_LIMIT,
        ) || "Response received.",
      category: "message",
      label: "Response received",
    };
  }

  if (eventType === "item.completed") {
    return overviewItemCompleted(payload);
  }

  if (eventType === "turn.completed") {
    const usageSummary = compactUsageSummary(payload);
    return {
      body: usageSummary ? usageSummary : "Run completed.",
      category: "status",
      label: "Run completed",
    };
  }

  return {
    body: eventType ? `Received event: ${eventType}` : "Received runtime event.",
    category: "debug",
    label: "Runtime event",
  };
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

function overviewItemStarted(payload: JsonRecord | null): DirectWorkOverviewEvent {
  const item = overviewItem(payload);
  const command = commandPreview(item);

  if (command) {
    return {
      body: command,
      category: "command",
      label: isValidationCommand(command) ? "Ran validation" : "Ran command",
    };
  }

  const file = fileOverview(item, "started");
  if (file) {
    return file;
  }

  return {
    body: "Started a work step.",
    category: "status",
    label: "Step started",
  };
}

function overviewItemCompleted(payload: JsonRecord | null): DirectWorkOverviewEvent {
  const item = overviewItem(payload);
  const command = commandPreview(item);

  if (command) {
    return {
      body: command,
      category: "command",
      label: "Command completed",
    };
  }

  const file = fileOverview(item, "completed");
  if (file) {
    return file;
  }

  return {
    body: "Completed a work step.",
    category: "status",
    label: "Step completed",
  };
}

function fileOverview(
  item: JsonRecord | null,
  phase: "started" | "completed",
): DirectWorkOverviewEvent | null {
  const filePath = filePathFromItem(item);
  if (!filePath) {
    return null;
  }

  const operation = operationText(item);
  if (isReadOperation(operation)) {
    return {
      body: `Reading ${filePath}.`,
      category: "file",
      label: `Read ${filePath}`,
    };
  }

  if (isCreateOperation(operation)) {
    return {
      body: `Creating ${filePath}.`,
      category: "file",
      label: `Created ${filePath}`,
    };
  }

  if (isWriteOperation(operation)) {
    return {
      body:
        phase === "completed" ? `Updated ${filePath}.` : `Editing ${filePath}.`,
      category: "file",
      label: phase === "completed" ? `Updated ${filePath}` : `Edited ${filePath}`,
    };
  }

  return null;
}

function overviewItem(payload: JsonRecord | null) {
  return recordValue(payload?.item) ?? payload;
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

function commandPreview(item: JsonRecord | null) {
  if (!item) {
    return null;
  }

  const command = stringValue(item.command);
  const args = stringArrayValue(item.args);
  if (command && args.length > 0) {
    return shortEventDetail(`${command} ${args.join(" ")}`, COMMAND_PREVIEW_LIMIT);
  }

  return command ? shortEventDetail(command, COMMAND_PREVIEW_LIMIT) : null;
}

function filePathFromItem(item: JsonRecord | null) {
  if (!item) {
    return null;
  }

  return (
    stringValue(item.path) ??
    stringValue(item.file_path) ??
    stringValue(item.filename) ??
    singleFileValue(item.files)
  );
}

function singleFileValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (!Array.isArray(value) || value.length !== 1) {
    return null;
  }

  return typeof value[0] === "string" ? value[0].trim() || null : null;
}

function operationText(item: JsonRecord | null) {
  if (!item) {
    return "";
  }

  return [item.type, item.name, item.title]
    .map(stringValue)
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function isReadOperation(operation: string) {
  return /\b(read|open|inspect|view)\b/.test(operation);
}

function isCreateOperation(operation: string) {
  return /\b(create|created|add|added|new)\b/.test(operation);
}

function isWriteOperation(operation: string) {
  return /\b(write|edit|update|modify|patch|replace)\b/.test(operation);
}

function isValidationCommand(command: string) {
  return /\b(test|check|validate|lint|fmt|format|tsc|cargo|npm|pytest)\b/i.test(
    command,
  );
}

function isErrorEvent(eventType: string | null, payload: JsonRecord | null) {
  return Boolean(
    eventType?.toLowerCase().includes("error") ||
      payload?.error ||
      payload?.error_message,
  );
}

function extractErrorText(payload: JsonRecord | null) {
  const error = payload?.error;
  if (typeof error === "string") {
    return error;
  }

  const errorRecord = recordValue(error);
  return (
    stringValue(payload?.error_message) ??
    stringValue(errorRecord?.message) ??
    stringValue(errorRecord?.title)
  );
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

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
