const DEFAULT_COORDINATOR_CODEX_EXECUTABLE = "codex";
const WINDOWS_COORDINATOR_CODEX_EXECUTABLE = "codex.cmd";

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
