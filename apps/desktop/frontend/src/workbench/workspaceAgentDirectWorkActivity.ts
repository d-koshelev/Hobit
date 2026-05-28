import type { DirectWorkStreamEvent } from "../workspace/types";
import { coordinatorDirectWorkStatusFromEvent } from "./workspaceAgentDirectWorkEvents";
import {
  compactWorkspaceAgentActivityText,
} from "./workspaceAgentDirectWorkFormatting";
import {
  DIRECT_WORK_FALLBACK_FAILURE_MESSAGE,
  directWorkEventHasAccessDenied,
  knownCodexEnvironmentError,
  readableDirectWorkFailureActivity,
} from "./workspaceAgentDirectWorkFailures";

export type WorkspaceAgentActivitySummaryStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export type WorkspaceAgentActivitySummarySeverity =
  | "info"
  | "success"
  | "warning"
  | "error";

export type WorkspaceAgentActivitySummary = {
  stepCount: number;
  latestTitle: string;
  status: WorkspaceAgentActivitySummaryStatus;
  severity: WorkspaceAgentActivitySummarySeverity;
  shortText: string;
};

export const EMPTY_WORKSPACE_AGENT_ACTIVITY_SUMMARY: WorkspaceAgentActivitySummary =
  {
    latestTitle: "",
    severity: "info",
    shortText: "",
    status: "idle",
    stepCount: 0,
  };

export function workspaceAgentActivitySummaryForLocalStart(
  shortText = "Starting Codex thread",
): WorkspaceAgentActivitySummary {
  return {
    latestTitle: shortText,
    severity: "info",
    shortText,
    status: "running",
    stepCount: 0,
  };
}

export function workspaceAgentActivitySummaryForLocalFailure(
  current: WorkspaceAgentActivitySummary,
  reason: string,
): WorkspaceAgentActivitySummary {
  const shortText = readableDirectWorkFailureActivity(reason);

  return {
    latestTitle: shortText,
    severity: "error",
    shortText,
    status: "failed",
    stepCount: current.stepCount,
  };
}

export function workspaceAgentActivitySummaryFromEvent(
  current: WorkspaceAgentActivitySummary,
  event: DirectWorkStreamEvent,
  options: {
    accessDeniedSeen?: boolean;
    failureReason?: string | null;
  } = {},
): WorkspaceAgentActivitySummary {
  const activity = workspaceAgentActivityFromEvent(event, options);

  if (!activity) {
    return current;
  }

  const stepCount = activity.countStep
    ? current.stepCount + 1
    : current.stepCount;

  return {
    latestTitle: activity.shortText,
    severity: activity.severity,
    shortText: activity.shortText,
    status: activity.status,
    stepCount,
  };
}

function workspaceAgentActivityFromEvent(
  event: DirectWorkStreamEvent,
  options: {
    accessDeniedSeen?: boolean;
    failureReason?: string | null;
  },
):
  | (Omit<WorkspaceAgentActivitySummary, "latestTitle" | "stepCount"> & {
      countStep: boolean;
    })
  | null {
  const finalStatus = event.isFinal
    ? coordinatorDirectWorkStatusFromEvent(event)
    : null;

  if (
    directWorkEventHasAccessDenied(event) ||
    (finalStatus === "failed" && Boolean(options.accessDeniedSeen))
  ) {
    return activity("failed", "error", "Working directory access denied");
  }

  if (event.isFinal) {
    if (finalStatus === "completed") {
      return activity("completed", "success", "Completed", false);
    }

    return activity(
      "failed",
      "error",
      readableDirectWorkFailureActivity(
        options.failureReason ??
          event.errorMessage ??
          event.stderrPreview ??
          event.text ??
          DIRECT_WORK_FALLBACK_FAILURE_MESSAGE,
      ),
      false,
    );
  }

  if (event.eventKind === "started") {
    return activity("running", "info", "Starting Codex");
  }

  if (knownCodexEnvironmentError(event)) {
    return activity("failed", "error", "Codex environment error");
  }

  if (event.eventKind !== "codex_json_event") {
    return null;
  }

  const payload = parseJsonRecord(event.line);
  const eventType = event.parsedCodexEventType ?? stringValue(payload?.type);

  if (eventType === "thread.started") {
    return activity("running", "info", "Starting Codex thread");
  }

  if (eventType === "turn.started") {
    return activity("running", "info", "Starting agent turn");
  }

  if (eventType === "turn.completed") {
    return activity("running", "success", "Completed");
  }

  if (eventType === "agent_message") {
    return activity("running", "info", "Preparing response");
  }

  if (eventType === "item.started") {
    return itemStartedActivity(payload);
  }

  if (eventType === "item.completed") {
    return itemCompletedActivity(payload);
  }

  return null;
}

function itemStartedActivity(payload: JsonRecord | null) {
  const item = itemRecord(payload);

  if (itemType(item) === "command_execution") {
    return activity(
      "running",
      "info",
      `Running command: ${commandTextFromItem(item) ?? "command"}`,
    );
  }

  if (itemLooksLikeRead(item)) {
    return activity("running", "info", "Reading files");
  }

  return null;
}

function itemCompletedActivity(payload: JsonRecord | null) {
  const item = itemRecord(payload);
  const type = itemType(item);

  if (type === "agent_message") {
    return activity("running", "info", "Preparing response");
  }

  if (type === "command_execution") {
    const command = commandTextFromItem(item) ?? "command";

    if (commandExecutionFailed(item)) {
      return activity("failed", "warning", `Command failed: ${command}`);
    }

    return activity("running", "success", `Finished command: ${command}`);
  }

  if (itemLooksLikeRead(item)) {
    return activity("running", "info", "Reading files");
  }

  return null;
}

function activity(
  status: WorkspaceAgentActivitySummaryStatus,
  severity: WorkspaceAgentActivitySummarySeverity,
  shortText: string,
  countStep = true,
) {
  return {
    countStep,
    severity,
    shortText: compactWorkspaceAgentActivityText(shortText),
    status,
  };
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
    return compactWorkspaceAgentActivityText(commandParts.join(" "));
  }

  const command = stringValue(item.command) ?? stringValue(item.cmd);
  const args = stringArrayValue(item.args);
  if (command && args.length > 0) {
    return compactWorkspaceAgentActivityText(`${command} ${args.join(" ")}`);
  }

  return command
    ? compactWorkspaceAgentActivityText(command)
    : compactWorkspaceAgentActivityText(
        stringValue(item.command_line) ?? stringValue(item.title) ?? "",
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
