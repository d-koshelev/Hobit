import type { WorkspaceStartSelection } from "../workspace/selection";
import type { WidgetInstance, WorkbenchPresetId } from "./types";

export type WorkbenchWorkspaceView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

export type WorkbenchPresetView = {
  id: WorkbenchPresetId | null;
  title: string;
  description: string | null;
};

export type WorkbenchSurfaceView = {
  id: string | null;
  preset: WorkbenchPresetView;
};

export type WorkbenchSharedStateView = {
  id: string;
  key: string;
  value: string;
  valueKind: string;
};

export type WorkbenchEventView = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
};

export type WorkbenchViewState = {
  workspace: WorkbenchWorkspaceView;
  workbench: WorkbenchSurfaceView;
  widgets: WidgetInstance[];
  sharedStateObjects: WorkbenchSharedStateView[];
  recentEvents: WorkbenchEventView[];
};

export function createWorkbenchViewStateFromSelection(
  selection: WorkspaceStartSelection,
): WorkbenchViewState {
  return {
    workspace: {
      id: selection.workspace.id,
      title: selection.workspace.title,
      description: selection.workspace.description,
      status: selection.workspace.status,
    },
    workbench: {
      id: selection.workspace.workbench_id,
      preset: {
        id: selection.preset.id,
        title: selection.preset.title,
        description: selection.preset.description,
      },
    },
    widgets: [...selection.preset.widgets],
    sharedStateObjects: [],
    recentEvents: [],
  };
}
