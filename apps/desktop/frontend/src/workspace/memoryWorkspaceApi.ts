import type { WorkspaceApi } from "./workspaceApi";
import type {
  CreateWorkspaceRequest,
  WorkspaceSessionSummary,
  WorkspaceSummary,
} from "./types";

const fallbackWorkspaces: WorkspaceSummary[] = [];
let fallbackId = 1;

export const memoryWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspaceSummary,
  openWorkspace,
};

async function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  const title = request.title.trim();

  if (!title) {
    throw new Error("workspace title must not be empty");
  }

  const id = `fallback_ws_${fallbackId++}`;
  const workspace: WorkspaceSummary = {
    id,
    title,
    description: request.description ?? null,
    status: "active",
    workbench_id: `fallback_wb_${fallbackId++}`,
  };

  fallbackWorkspaces.unshift(workspace);
  return workspace;
}

async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return [...fallbackWorkspaces];
}

async function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  return (
    fallbackWorkspaces.find((workspace) => workspace.id === workspaceId) ??
    null
  );
}

async function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
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
