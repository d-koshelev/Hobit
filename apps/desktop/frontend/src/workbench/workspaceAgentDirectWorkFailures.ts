import type { DirectWorkStreamEvent } from "../workspace/types";
import { compactWorkspaceAgentActivityText } from "./workspaceAgentDirectWorkFormatting";

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

export function readableDirectWorkFailureActivity(reason: string) {
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

export function knownCodexEnvironmentError(event: DirectWorkStreamEvent) {
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
