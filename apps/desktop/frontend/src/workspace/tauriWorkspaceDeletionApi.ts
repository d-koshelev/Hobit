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
  root_path?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  widget_count: number;
  workspace_agent_count: number;
  note_count: number;
  skill_count: number;
  knowledge_document_count: number;
  queue_task_count: number;
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
  const rootPath = normalizeWorkspaceRoot(workspace.root_path);

  return {
    id: workspace.id,
    title: workspace.title,
    description: workspace.description,
    ...(rootPath ? { rootPath } : {}),
    status: workspace.status,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
    lastOpenedAt: workspace.last_opened_at,
    widgetCount: workspace.widget_count,
    workspaceAgentCount: workspace.workspace_agent_count,
    noteCount: workspace.note_count,
    skillCount: workspace.skill_count,
    knowledgeDocumentCount: workspace.knowledge_document_count,
    queueTaskCount: workspace.queue_task_count,
    workbenchId: workspace.workbench_id,
  };
}

function normalizeWorkspaceRoot(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "~" || trimmed === ".") {
    return null;
  }

  return trimmed;
}
