import type { WorkbenchPreset } from "../workbench/types";

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

export type WorkspaceStartSelection = {
  preset: WorkbenchPreset;
  session: WorkspaceSessionSummary | null;
  workspace: WorkspaceSummary;
};
