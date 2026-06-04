import type { WorkspaceSummary } from "./types";

export const LAST_OPEN_WORKSPACE_STORAGE_KEY =
  "hobit:last-open-workspace:v1";

export type LastOpenWorkspaceRecord = {
  workspaceId: string;
  workspaceTitle: string;
  workbenchId: string | null;
  savedAt: string;
};

export function readLastOpenWorkspaceRecord(): LastOpenWorkspaceRecord | null {
  const storage = localStorageOrNull();

  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(LAST_OPEN_WORKSPACE_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isLastOpenWorkspaceRecord(parsedValue)) {
      storage.removeItem(LAST_OPEN_WORKSPACE_STORAGE_KEY);
      return null;
    }

    return parsedValue;
  } catch {
    storage.removeItem(LAST_OPEN_WORKSPACE_STORAGE_KEY);
    return null;
  }
}

export function saveLastOpenWorkspaceRecord(workspace: WorkspaceSummary): void {
  const storage = localStorageOrNull();

  if (!storage) {
    return;
  }

  const record: LastOpenWorkspaceRecord = {
    workspaceId: workspace.id,
    workspaceTitle: workspace.title,
    workbenchId: workspace.workbenchId,
    savedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(LAST_OPEN_WORKSPACE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Local storage can fail in restricted environments; recovery is best effort.
  }
}

export function clearLastOpenWorkspaceRecord(): void {
  const storage = localStorageOrNull();

  if (!storage) {
    return;
  }

  storage.removeItem(LAST_OPEN_WORKSPACE_STORAGE_KEY);
}

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isLastOpenWorkspaceRecord(
  value: unknown,
): value is LastOpenWorkspaceRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.workspaceId === "string" &&
    value.workspaceId.trim().length > 0 &&
    typeof value.workspaceTitle === "string" &&
    (typeof value.workbenchId === "string" || value.workbenchId === null) &&
    typeof value.savedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
