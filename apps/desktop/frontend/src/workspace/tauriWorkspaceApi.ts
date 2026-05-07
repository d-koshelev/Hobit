import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceApi } from "./workspaceApi";
import type {
  CreateWorkspaceRequest,
  WorkspaceSessionSummary,
  WorkspaceSummary,
} from "./types";

export const tauriWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspaceSummary,
  openWorkspace,
};

function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return invoke<WorkspaceSummary>("create_workspace", {
    request: {
      title: request.title,
      description: request.description ?? null,
    },
  });
}

function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return invoke<WorkspaceSummary[]>("list_workspaces");
}

function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  return invoke<WorkspaceSummary | null>("get_workspace_summary", {
    workspaceId,
  });
}

function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
  return invoke<WorkspaceSessionSummary | null>("open_workspace", {
    workspaceId,
  });
}
