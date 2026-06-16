import type { DirectWorkStreamEvent } from "../workspace/types";
import {
  RENDER_MEMORY_CAPS,
  cappedPreviewText,
} from "../renderMemoryGuards";

export type AgentActivitySourceKind = "workspace-agent" | "agent-executor";

export type AgentActivityStatus =
  | "pending"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type AgentActivitySeverity =
  | "info"
  | "success"
  | "warning"
  | "error";

export type AgentActivityRunKind =
  | "direct-work"
  | "workspace-agent-self-test";

export type AgentActivityLifecycleStage =
  | "started"
  | "step"
  | "completed"
  | "cancelled"
  | "failed";

export type AgentActivityEvent = {
  command?: string;
  details?: string;
  id: string;
  lifecycleStage?: AgentActivityLifecycleStage;
  outputPreview?: string;
  rawPreview?: string;
  runKind?: AgentActivityRunKind;
  runId: string;
  severity: AgentActivitySeverity;
  sourceKind: AgentActivitySourceKind;
  sourceLabel: string;
  sourceWidgetInstanceId: string;
  status: AgentActivityStatus;
  summary?: string;
  timestamp: number;
  timestampLabel: string;
  title: string;
  workspaceId: string;
};

export type AgentActivityEventInput = {
  event: DirectWorkStreamEvent;
  receivedAtMs?: number;
  sourceKind: AgentActivitySourceKind;
  sourceLabel: string;
};

const RAW_PREVIEW_LIMIT = 360;
const TEXT_PREVIEW_LIMIT = 180;
const COMMAND_PREVIEW_LIMIT = 140;
const OUTPUT_PREVIEW_LIMIT = 1000;

export function agentActivityEventFromDirectWorkStreamEvent({
  event,
  receivedAtMs = Date.now(),
  sourceKind,
  sourceLabel,
}: AgentActivityEventInput): AgentActivityEvent | null {
  const readable = readableDirectWorkActivity(event);

  if (!readable) {
    return null;
  }

  return {
    ...readable,
    id: agentActivityEventId(event, readable.title),
    lifecycleStage: directWorkLifecycleStage(event, readable.status),
    rawPreview: rawPreviewForEvent(event),
    runKind: "direct-work",
    runId: event.runId,
    sourceKind,
    sourceLabel,
    sourceWidgetInstanceId: event.widgetInstanceId,
    timestamp: receivedAtMs,
    timestampLabel: elapsedTimestampLabel(event.elapsedMs),
    workspaceId: event.workspaceId,
  };
}

export function mergeAgentActivityEvents(
  currentEvents: AgentActivityEvent[],
  nextEvents: AgentActivityEvent[],
  limit: number = RENDER_MEMORY_CAPS.activityRetainedEvents,
) {
  if (nextEvents.length === 0) {
    return currentEvents;
  }

  const byId = new Map(currentEvents.map((event) => [event.id, event]));

  for (const event of nextEvents) {
    byId.set(event.id, event);
  }

  return Array.from(byId.values())
    .sort((first, second) =>
      first.timestamp === second.timestamp
        ? first.id.localeCompare(second.id)
        : first.timestamp - second.timestamp,
    )
    .slice(-limit);
}

function directWorkLifecycleStage(
  event: DirectWorkStreamEvent,
  readableStatus: AgentActivityStatus,
): AgentActivityLifecycleStage {
  if (event.eventKind === "started") {
    return "started";
  }

  if (event.isFinal) {
    if (readableStatus === "cancelled") {
      return "cancelled";
    }

    if (readableStatus === "failed") {
      return "failed";
    }

    return "completed";
  }

  return "step";
}

function readableDirectWorkActivity(
  event: DirectWorkStreamEvent,
): Pick<
  AgentActivityEvent,
  | "command"
  | "details"
  | "outputPreview"
  | "severity"
  | "status"
  | "summary"
  | "title"
> | null {
  if (event.eventKind === "started") {
    return activity("running", "info", "Started run", "Direct Work accepted.");
  }

  if (event.isFinal) {
    const finalStatus = event.finalStatus ?? event.status ?? event.eventKind;
    if (finalStatus === "completed") {
      return activity(
        "completed",
        "success",
        "Completed run",
        "Agent run completed.",
      );
    }

    if (finalStatus === "cancelled") {
      return activity(
        "cancelled",
        "warning",
        "Cancelled run",
        compactText(
          event.errorMessage ??
            event.stderrPreview ??
            event.text ??
            "Run was cancelled.",
        ),
        failureDetails(event),
      );
    }

    return activity(
      "failed",
      "error",
      "Failed run",
      compactText(
        event.errorMessage ??
          event.stderrPreview ??
          event.text ??
          `Run ended with ${finalStatus}.`,
      ),
      failureDetails(event),
    );
  }

  if (event.eventKind !== "codex_json_event") {
    return null;
  }

  const payload = parseJsonRecord(event.line);
  const eventType = event.parsedCodexEventType ?? stringValue(payload?.type);

  if (eventType === "thread.started") {
    return activity(
      "running",
      "info",
      "Started thread",
      "Codex thread started.",
      event.codexThreadId ? `Thread id: ${event.codexThreadId}` : undefined,
    );
  }

  if (eventType === "turn.started") {
    return activity(
      "running",
      "info",
      "Started turn",
      "Agent started working on the prompt.",
    );
  }

  if (eventType === "agent_message") {
    return activity(
      "running",
      "info",
      "Prepared response",
      "Agent response is being prepared.",
    );
  }

  if (eventType === "turn.completed") {
    return activity(
      "completed",
      "success",
      "Completed turn",
      "Agent turn completed.",
    );
  }

  if (eventType === "item.started") {
    return readableItemStarted(payload);
  }

  if (eventType === "item.completed") {
    return readableItemCompleted(payload);
  }

  return null;
}

function readableItemStarted(payload: JsonRecord | null) {
  const item = itemRecord(payload);
  const command = commandTextFromItem(item);

  if (itemType(item) === "command_execution" || command) {
    return activity(
      "running",
      "info",
      "Ran command",
      command ? `Running ${command}` : "Running command.",
      undefined,
      commandActivityExtras(command, item),
    );
  }

  if (itemLooksLikeRead(item)) {
    return activity("running", "info", "Read files", "Reading files.");
  }

  return null;
}

function readableItemCompleted(payload: JsonRecord | null) {
  const item = itemRecord(payload);
  const type = itemType(item);

  if (type === "agent_message") {
    return activity(
      "completed",
      "success",
      "Prepared response",
      "Agent response is ready.",
    );
  }

  const command = commandTextFromItem(item);
  if (type === "command_execution" || command) {
    if (commandExecutionFailed(item)) {
      return activity(
        "failed",
        "error",
        "Command failed",
        command ? `${command} failed.` : "Command failed.",
        commandFailureDetails(item),
        commandActivityExtras(command, item),
      );
    }

    return activity(
      "completed",
      "success",
      "Command finished",
      command ? `${command} finished.` : "Command finished.",
      undefined,
      commandActivityExtras(command, item),
    );
  }

  if (itemLooksLikeRead(item)) {
    return activity("completed", "success", "Read files", "File read completed.");
  }

  return null;
}

function activity(
  status: AgentActivityStatus,
  severity: AgentActivitySeverity,
  title: string,
  summary?: string,
  details?: string,
  extras: Pick<AgentActivityEvent, "command" | "outputPreview"> = {},
) {
  return {
    ...extras,
    details,
    severity,
    status,
    summary,
    title,
  };
}

function agentActivityEventId(event: DirectWorkStreamEvent, title: string) {
  const eventIdentity = [
    event.runId,
    event.elapsedMs,
    event.eventKind,
    event.parsedCodexEventType,
    compactText(event.line ?? event.text ?? event.errorMessage ?? title, 60),
  ]
    .filter((part): part is string | number => part !== null && part !== "")
    .join(":");

  return `${event.workspaceId}:${event.widgetInstanceId}:${eventIdentity}`;
}

function elapsedTimestampLabel(elapsedMs: number) {
  if (elapsedMs <= 0) {
    return "0s";
  }

  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }

  const seconds = elapsedMs / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

function failureDetails(event: DirectWorkStreamEvent) {
  return [
    event.finalStatus ? `Final status: ${event.finalStatus}` : null,
    event.failedStage ? `Stage: ${event.failedStage}` : null,
    event.exitCode !== null ? `Exit code: ${event.exitCode}` : null,
    event.stderrPreview ? `stderr preview: ${compactText(event.stderrPreview)}` : null,
  ]
    .filter((detail): detail is string => Boolean(detail))
    .join("\n");
}

function commandFailureDetails(item: JsonRecord | null) {
  if (!item) {
    return undefined;
  }

  const exitCode = numberValue(item.exit_code) ?? numberValue(item.exitCode);
  const status = stringValue(item.status);
  const error =
    stringValue(item.error_message) ??
    stringValue(item.error) ??
    stringValue(recordValue(item.error)?.message);
  const details = [
    exitCode !== null ? `Exit code: ${exitCode}` : null,
    status ? `Status: ${status}` : null,
    error ? `Error: ${compactText(error)}` : null,
  ].filter((detail): detail is string => Boolean(detail));

  return details.length > 0 ? details.join("\n") : undefined;
}

function rawPreviewForEvent(event: DirectWorkStreamEvent) {
  if (event.eventKind !== "codex_json_event" || !event.line) {
    return undefined;
  }

  return cappedPreviewText(event.line, RAW_PREVIEW_LIMIT, "Raw details capped");
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
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function itemRecord(payload: JsonRecord | null) {
  return recordValue(payload?.item) ?? payload;
}

function itemType(item: JsonRecord | null) {
  return stringValue(item?.type);
}

function commandTextFromItem(item: JsonRecord | null) {
  if (!item) {
    return null;
  }

  const commandParts = stringArrayValue(item.command);
  if (commandParts.length > 0) {
    return compactText(commandParts.join(" "), COMMAND_PREVIEW_LIMIT);
  }

  const command = stringValue(item.command) ?? stringValue(item.cmd);
  const args = stringArrayValue(item.args);

  if (command && args.length > 0) {
    return compactText(`${command} ${args.join(" ")}`, COMMAND_PREVIEW_LIMIT);
  }

  return command
    ? compactText(command, COMMAND_PREVIEW_LIMIT)
    : compactText(
        stringValue(item.command_line) ?? stringValue(item.title) ?? "",
        COMMAND_PREVIEW_LIMIT,
      ) || null;
}

function commandExecutionFailed(item: JsonRecord | null) {
  if (!item) {
    return false;
  }

  const exitCode = numberValue(item.exit_code) ?? numberValue(item.exitCode);
  if (exitCode !== null) {
    return exitCode !== 0;
  }

  const status = stringValue(item.status)?.toLowerCase() ?? "";
  return (
    status.includes("failed") ||
    status.includes("error") ||
    Boolean(item.error || item.error_message)
  );
}

function commandActivityExtras(command: string | null, item: JsonRecord | null) {
  const outputPreview = commandOutputPreview(item);
  const extras: Pick<AgentActivityEvent, "command" | "outputPreview"> = {};

  if (command) {
    extras.command = command;
  }

  if (outputPreview) {
    extras.outputPreview = outputPreview;
  }

  return extras;
}

function commandOutputPreview(item: JsonRecord | null) {
  if (!item) {
    return undefined;
  }

  const output =
    stringValue(item.output) ??
    stringValue(item.stdout) ??
    stringValue(item.stderr) ??
    stringValue(item.text);

  return output ? compactText(output, OUTPUT_PREVIEW_LIMIT) : undefined;
}

function itemLooksLikeRead(item: JsonRecord | null) {
  if (!item) {
    return false;
  }

  const text = [
    item.type,
    item.name,
    item.title,
    item.operation,
    item.action,
  ]
    .map(stringValue)
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return /\b(read|open|inspect|view)\b/.test(text);
}

function compactText(value: string, limit = TEXT_PREVIEW_LIMIT) {
  const compacted = value.replace(/\s+/g, " ").trim();

  if (compacted.length <= limit) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, limit - 3))}...`;
}
