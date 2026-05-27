import type {
  DirectWorkStreamEvent,
  DirectWorkStreamEventKind,
  KnowledgeDocumentSearchResult,
} from "../workspace/types";

export const DIRECT_WORK_EMPTY_DIRECTORY_MESSAGE =
  "Working directory is required before Direct Work can start.";

export const DIRECT_WORK_EMPTY_PROMPT_MESSAGE =
  "Direct Work uses the current composer message as the prompt. Type the task, then choose Run with Codex.";

export const DIRECT_WORK_UNAVAILABLE_MESSAGE =
  "Workspace Agent Codex is only available in the Tauri desktop shell.";

export const DIRECT_WORK_FALLBACK_FAILURE_MESSAGE =
  "Codex Direct Work failed. Check Codex CLI availability, login, working directory, or logs.";

export const DIRECT_WORK_DIRECTORY_ACCESS_DENIED_MESSAGE =
  "Working directory access denied. Choose another folder.";

export const DIRECT_WORK_DIRECTORY_ACCESS_DENIED_WARNING =
  "Codex could not access this working directory. Choose a project folder or scratch workspace.";

export const CODEX_THREAD_NOT_AVAILABLE_MESSAGE =
  "Codex thread not available. Next Codex run starts a new thread.";

const DEFAULT_COORDINATOR_CODEX_EXECUTABLE = "codex";
const WINDOWS_COORDINATOR_CODEX_EXECUTABLE = "codex.cmd";

export type CoordinatorDirectWorkStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type CoordinatorDirectWorkLogEntry = {
  id: string;
  kind: DirectWorkStreamEventKind | "local";
  text: string;
};

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

export type WorkspaceKnowledgeLookupStatus =
  | "idle"
  | "checked"
  | "matched"
  | "failed"
  | "unavailable";

export type WorkspaceKnowledgeLookup = {
  error: string | null;
  query: string;
  results: KnowledgeDocumentSearchResult[];
  status: WorkspaceKnowledgeLookupStatus;
};

export const EMPTY_WORKSPACE_KNOWLEDGE_LOOKUP: WorkspaceKnowledgeLookup = {
  error: null,
  query: "",
  results: [],
  status: "idle",
};

export type CodexThreadScope = {
  threadId: string;
  widgetInstanceId: string;
  workingDirectory: string;
  workspaceId: string;
};

export type ActiveDirectWorkRunScope = Omit<CodexThreadScope, "threadId">;

export function coordinatorDirectWorkStatusFromEvent(
  event: DirectWorkStreamEvent,
): CoordinatorDirectWorkStatus {
  const status = event.finalStatus ?? event.status ?? event.eventKind;

  if (status === "completed") {
    return "completed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return "failed";
}

export function directWorkFailureReason(
  event: DirectWorkStreamEvent,
  accessDeniedSeen: boolean,
): string {
  if (directWorkFailureIsAccessDenied(event, accessDeniedSeen)) {
    return DIRECT_WORK_DIRECTORY_ACCESS_DENIED_MESSAGE;
  }

  return (
    event.errorMessage ??
    event.stderrPreview ??
    event.text ??
    DIRECT_WORK_FALLBACK_FAILURE_MESSAGE
  );
}

export function directWorkFailureIsAccessDenied(
  event: DirectWorkStreamEvent,
  accessDeniedSeen: boolean,
): boolean {
  return accessDeniedSeen || directWorkEventHasAccessDenied(event);
}

export function directWorkFailureTranscriptBody(reason: string): string {
  return reason === DIRECT_WORK_FALLBACK_FAILURE_MESSAGE
    ? reason
    : `Direct Work failed: ${reason}`;
}

export function directWorkDirectoryResolutionText(directory: string): string {
  const trimmedDirectory = directory.trim();

  if (!trimmedDirectory) {
    return "Required before start.";
  }

  if (trimmedDirectory === "~" || /^~[\\/]/.test(trimmedDirectory)) {
    return "~ resolves to your user home.";
  }

  return "Using selected working directory.";
}

export function directWorkScratchWorkspaceSuggestion(
  directory: string,
): string | null {
  const trimmedDirectory = directory.trim();

  if (!trimmedDirectory) {
    return null;
  }

  if (trimmedDirectory === "~" || /^~[\\/]/.test(trimmedDirectory)) {
    return "/Documents/hobit-workspace-agent-scratch";
  }

  const windowsHomeMatch = trimmedDirectory.match(
    /^([A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/]+)/,
  );
  if (windowsHomeMatch) {
    return "/Documents/hobit-workspace-agent-scratch";
  }

  return null;
}

export function defaultCoordinatorCodexExecutable(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_COORDINATOR_CODEX_EXECUTABLE;
  }

  const platformText = `${navigator.userAgent} ${navigator.platform}`;
  return /(Windows|Win32|Win64|WOW64)/i.test(platformText)
    ? WINDOWS_COORDINATOR_CODEX_EXECUTABLE
    : DEFAULT_COORDINATOR_CODEX_EXECUTABLE;
}

export function compactDirectWorkText(text: string): string {
  const compacted = text.replace(/\s+/g, " ").trim();

  return compacted.length > 180 ? `${compacted.slice(0, 177)}...` : compacted;
}

export function compactWorkspaceAgentActivityText(
  text: string,
  limit = 84,
): string {
  const compacted = text.replace(/\s+/g, " ").trim();

  return compacted.length > limit ? `${compacted.slice(0, limit - 3)}...` : compacted;
}

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

function readableDirectWorkFailureActivity(reason: string) {
  if (reason === DIRECT_WORK_DIRECTORY_ACCESS_DENIED_MESSAGE) {
    return "Working directory access denied";
  }

  if (knownCodexEnvironmentErrorText(reason)) {
    return "Codex environment error";
  }

  if (reason === DIRECT_WORK_FALLBACK_FAILURE_MESSAGE) {
    return DIRECT_WORK_FALLBACK_FAILURE_MESSAGE;
  }

  return compactWorkspaceAgentActivityText(reason);
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

function knownCodexEnvironmentError(event: DirectWorkStreamEvent) {
  return [
    event.errorMessage,
    event.stderrPreview,
    event.text,
    event.line,
  ].some((value) => knownCodexEnvironmentErrorText(value));
}

function knownCodexEnvironmentErrorText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const text = value.toLowerCase();
  return (
    text.includes("shell snapshot") ||
    text.includes("shell environment") ||
    text.includes("failed to capture environment")
  );
}

export function workspaceKnowledgeSummaryText(
  lookup: WorkspaceKnowledgeLookup,
) {
  if (lookup.status === "matched") {
    return `Used knowledge: ${lookup.results.length} snippets`;
  }

  if (lookup.status === "checked") {
    return "Workspace knowledge checked: no matches";
  }

  if (lookup.status === "failed") {
    return "Workspace knowledge check failed";
  }

  if (lookup.status === "unavailable") {
    return "Workspace knowledge not available";
  }

  return "Workspace knowledge";
}

export function workspaceKnowledgeLogText(lookup: WorkspaceKnowledgeLookup) {
  if (lookup.status === "matched") {
    return `Used knowledge: ${lookup.results.length} snippets.`;
  }

  if (lookup.status === "checked") {
    return "Workspace knowledge checked: no matches.";
  }

  if (lookup.status === "failed") {
    return "Workspace knowledge check failed; continuing without it.";
  }

  if (lookup.status === "unavailable") {
    return "Workspace knowledge not available.";
  }

  return "";
}

export function codexPromptWithWorkspaceKnowledge(
  operatorPrompt: string,
  results: KnowledgeDocumentSearchResult[],
) {
  const knowledgeBlock = results
    .slice(0, 5)
    .map((result) =>
      [
        `[Doc: ${result.documentTitle}, chunk ${result.chunkIndex + 1}]`,
        `Scope: ${knowledgeScopeLabel(result.scope)}`,
        result.snippet,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "Workspace knowledge found for this request:",
    knowledgeBlock,
    "Use this only if relevant. If it does not help, ignore it.",
    "",
    "User request:",
    operatorPrompt,
  ].join("\n");
}

export function knowledgeScopeLabel(scope: KnowledgeDocumentSearchResult["scope"]) {
  return scope === "global" ? "Global" : "Workspace";
}

export function shortCodexThreadId(threadId: string): string {
  const trimmed = threadId.trim();

  return trimmed.length > 12 ? `${trimmed.slice(0, 8)}...` : trimmed;
}

export function codexThreadIdForScope(
  thread: CodexThreadScope | null,
  workspaceId: string,
  widgetInstanceId: string,
  workingDirectory: string,
): string | null {
  if (!thread) {
    return null;
  }

  if (
    thread.workspaceId !== workspaceId ||
    thread.widgetInstanceId !== widgetInstanceId ||
    thread.workingDirectory !== workingDirectory
  ) {
    return null;
  }

  return thread.threadId;
}

export function directWorkEventBelongsToCurrentAgent(
  event: DirectWorkStreamEvent,
  workspaceId: string | undefined,
  widgetInstanceId: string,
) {
  if (workspaceId?.trim() && event.workspaceId !== workspaceId.trim()) {
    return false;
  }

  return event.widgetInstanceId === widgetInstanceId;
}

export function directWorkEventText(event: DirectWorkStreamEvent): string {
  if (event.eventKind === "started") {
    return `Run ${event.runId} started.`;
  }

  if (event.codexThreadId) {
    return `Codex thread active: ${shortCodexThreadId(event.codexThreadId)}.`;
  }

  if (event.eventKind === "final_message") {
    return "Final response received.";
  }

  if (event.isFinal) {
    return `Run ended with ${event.finalStatus ?? event.status ?? event.eventKind}.`;
  }

  return (
    event.text ??
    event.line ??
    event.parsedCodexEventType ??
    event.eventKind.replace(/_/g, " ")
  );
}

export function codexAgentMessageFromEvent(
  event: DirectWorkStreamEvent,
): string | null {
  if (event.eventKind !== "codex_json_event") {
    return null;
  }

  if (
    event.text?.trim() &&
    (event.parsedCodexEventType === "agent_message" ||
      event.parsedCodexEventType === "item.completed")
  ) {
    return event.text.trim();
  }

  if (!event.line?.trim()) {
    return null;
  }

  try {
    const value = JSON.parse(event.line) as unknown;
    return codexAgentMessageFromJson(value);
  } catch {
    return null;
  }
}

function codexAgentMessageFromJson(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === "agent_message") {
    return stringFromUnknown(value.text) ?? stringFromUnknown(value.message);
  }

  if (value.type !== "item.completed" || !isRecord(value.item)) {
    return null;
  }

  if (value.item.type !== "agent_message") {
    return null;
  }

  return (
    stringFromUnknown(value.item.text) ??
    stringFromUnknown(value.item.message) ??
    stringFromUnknown(value.item.content) ??
    textFromCodexContentArray(value.item.content)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textFromCodexContentArray(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .map((entry) =>
      isRecord(entry)
        ? stringFromUnknown(entry.text) ?? stringFromUnknown(entry.content)
        : stringFromUnknown(entry),
    )
    .filter((entry): entry is string => Boolean(entry))
    .join("\n")
    .trim();

  return text || null;
}

export function directWorkEventHasAccessDenied(
  event: DirectWorkStreamEvent,
): boolean {
  return [
    event.errorMessage,
    event.stderrPreview,
    event.text,
    event.line,
  ].some((value) => directWorkTextHasAccessDenied(value));
}

function directWorkTextHasAccessDenied(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const text = value.toLocaleLowerCase();
  return (
    text.includes("unauthorizedaccessexception") ||
    (text.includes("access to the path") && text.includes("is denied")) ||
    text.includes("access is denied")
  );
}
