import type { CodexDirectWorkLiveLogEntry } from "./CodexDirectWorkLiveLog";

export function isOneShotFallbackRunning(
  entries: CodexDirectWorkLiveLogEntry[],
) {
  return entries[entries.length - 1]?.kind === "fallback_starting";
}

export function cancellationStatusMessage(status: string) {
  if (status === "already_finished") {
    return "This Direct Work run has already finished.";
  }

  if (status === "not_active") {
    return "This Direct Work run is no longer active.";
  }

  if (status === "not_found") {
    return "No matching active Direct Work run was found.";
  }

  return `Cancellation command returned status: ${status}.`;
}
