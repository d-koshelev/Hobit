import { invoke } from "@tauri-apps/api/core";
import type {
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  WorkspaceSummary,
} from "./types";

type TauriWorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workbench_id: string | null;
};

type TauriWorkspaceDeletionResponse = {
  deleted_workspace_id: string;
  deleted: boolean;
  remaining_workspaces: TauriWorkspaceSummary[];
};

export async function deleteWorkspace(
  request: DeleteWorkspaceRequest,
): Promise<DeleteWorkspaceResponse> {
  const response = await invoke<TauriWorkspaceDeletionResponse>(
    "delete_workspace",
    {
      request: {
        workspace_id: request.workspaceId,
      },
    },
  );

  return {
    deletedWorkspaceId: response.deleted_workspace_id,
    deleted: response.deleted,
    remainingWorkspaces: response.remaining_workspaces.map(
      normalizeWorkspaceSummary,
    ),
  };
}

function normalizeWorkspaceSummary(
  workspace: TauriWorkspaceSummary,
): WorkspaceSummary {
  return {
    id: workspace.id,
    title: workspace.title,
    description: workspace.description,
    status: workspace.status,
    workbenchId: workspace.workbench_id,
  };
}
