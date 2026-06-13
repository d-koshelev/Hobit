import type { WorkbenchViewState } from "./types";

export function currentWorkspaceRootFromViewState(
  viewState: WorkbenchViewState,
) {
  const workspaceRoot = normalizedWorkspaceRoot(viewState.workspace.rootPath);

  if (workspaceRoot) {
    return workspaceRoot;
  }

  for (const stateObject of viewState.sharedStateObjects) {
    if (!isWorkspaceRootSharedStateKey(stateObject.key)) {
      continue;
    }

    const stateRoot = normalizedWorkspaceRoot(stateObject.value);

    if (stateRoot) {
      return stateRoot;
    }
  }

  return null;
}

function isWorkspaceRootSharedStateKey(key: string) {
  const normalized = key.trim().toLowerCase().replace(/[-_\s.]+/g, "");

  return normalized === "workspaceroot" || normalized === "currentworkspaceroot";
}

function normalizedWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}
