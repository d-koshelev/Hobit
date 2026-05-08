import type { WorkspaceApi } from "./workspaceApi";
import type {
  CreateWorkspaceRequest,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

const fallbackWorkspaces: WorkspaceSummary[] = [];
let fallbackId = 1;

export const memoryWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspaceSummary,
  openWorkspace,
  getWorkspaceWorkbenchState,
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
    workbenchId: `fallback_wb_${fallbackId++}`,
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
    workspaceId: workspace.id,
    status: "open",
    activeWidgetId: null,
  };
}

async function getWorkspaceWorkbenchState(
  workspaceId: string,
): Promise<WorkspaceWorkbenchState | null> {
  const workspace = fallbackWorkspaces.find(
    (candidate) => candidate.id === workspaceId,
  );

  if (!workspace) {
    return null;
  }

  return {
    workspace,
    workbench: {
      id: workspace.workbenchId ?? `fallback_wb_${workspace.id}`,
      workspaceId: workspace.id,
      presetOriginId: null,
    },
    widgetInstances: [],
    sharedStateObjects: [],
    recentEvents: [],
  };
}
