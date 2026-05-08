import { memoryWorkspaceApi } from "./memoryWorkspaceApi";
import { tauriWorkspaceApi } from "./tauriWorkspaceApi";
import { isTauriRuntime } from "./tauriEnvironment";
import type {
  CreateWorkspaceRequest,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

export type WorkspaceApi = {
  createWorkspace: (
    request: CreateWorkspaceRequest,
  ) => Promise<WorkspaceSummary>;
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  getWorkspaceSummary: (
    workspaceId: string,
  ) => Promise<WorkspaceSummary | null>;
  openWorkspace: (
    workspaceId: string,
  ) => Promise<WorkspaceSessionSummary | null>;
  getWorkspaceWorkbenchState: (
    workspaceId: string,
  ) => Promise<WorkspaceWorkbenchState | null>;
};

export function getWorkspaceApi(): WorkspaceApi {
  return isTauriRuntime() ? tauriWorkspaceApi : memoryWorkspaceApi;
}

export function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return getWorkspaceApi().createWorkspace(
    normalizeCreateWorkspaceRequest(request),
  );
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return getWorkspaceApi().listWorkspaces();
}

export function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  return getWorkspaceApi().getWorkspaceSummary(workspaceId);
}

export function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
  return getWorkspaceApi().openWorkspace(workspaceId);
}

export function getWorkspaceWorkbenchState(
  workspaceId: string,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().getWorkspaceWorkbenchState(workspaceId);
}

function normalizeCreateWorkspaceRequest(
  request: CreateWorkspaceRequest,
): CreateWorkspaceRequest {
  return {
    title: request.title,
    description: request.description ?? null,
  };
}
