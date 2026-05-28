import type { DirectWorkStreamEvent } from "../workspace/types";

export const CODEX_THREAD_NOT_AVAILABLE_MESSAGE =
  "Codex thread not available. Next Codex run starts a new thread.";

export type CodexThreadScope = {
  threadId: string;
  widgetInstanceId: string;
  workingDirectory: string;
  workspaceId: string;
};

export type ActiveDirectWorkRunScope = Omit<CodexThreadScope, "threadId">;

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
