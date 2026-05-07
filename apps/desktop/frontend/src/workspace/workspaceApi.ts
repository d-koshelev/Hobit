import { invoke, isTauri } from "@tauri-apps/api/core";

export type CreateWorkspaceRequest = {
  title: string;
  description?: string | null;
};

export type WorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workbench_id: string | null;
};

export type WorkspaceSessionSummary = {
  id: string;
  workspace_id: string;
  status: string;
  active_widget_id: string | null;
};

const fallbackWorkspaces: WorkspaceSummary[] = [];
let fallbackId = 1;

export async function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  const normalizedRequest = normalizeCreateWorkspaceRequest(request);

  if (shouldUseTauri()) {
    return invoke<WorkspaceSummary>("create_workspace", {
      request: normalizedRequest,
    });
  }

  return createFallbackWorkspace(normalizedRequest);
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  if (shouldUseTauri()) {
    return invoke<WorkspaceSummary[]>("list_workspaces");
  }

  return [...fallbackWorkspaces];
}

export async function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  if (shouldUseTauri()) {
    return invoke<WorkspaceSummary | null>("get_workspace_summary", {
      workspaceId,
    });
  }

  return (
    fallbackWorkspaces.find((workspace) => workspace.id === workspaceId) ??
    null
  );
}

export async function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
  if (shouldUseTauri()) {
    return invoke<WorkspaceSessionSummary | null>("open_workspace", {
      workspaceId,
    });
  }

  const workspace = fallbackWorkspaces.find(
    (candidate) => candidate.id === workspaceId,
  );

  if (!workspace) {
    return null;
  }

  return {
    id: `fallback_wss_${fallbackId++}`,
    workspace_id: workspace.id,
    status: "open",
    active_widget_id: null,
  };
}

function shouldUseTauri() {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function normalizeCreateWorkspaceRequest(
  request: CreateWorkspaceRequest,
): Required<CreateWorkspaceRequest> {
  return {
    title: request.title,
    description: request.description ?? null,
  };
}

function createFallbackWorkspace(
  request: Required<CreateWorkspaceRequest>,
): WorkspaceSummary {
  const title = request.title.trim();

  if (!title) {
    throw new Error("workspace title must not be empty");
  }

  const id = `fallback_ws_${fallbackId++}`;
  const workspace: WorkspaceSummary = {
    id,
    title,
    description: request.description,
    status: "active",
    workbench_id: `fallback_wb_${fallbackId++}`,
  };

  fallbackWorkspaces.unshift(workspace);
  return workspace;
}
