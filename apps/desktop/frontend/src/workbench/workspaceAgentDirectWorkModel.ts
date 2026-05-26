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
