import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceApi } from "./workspaceApi";
import type {
  CreateWorkspaceRequest,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

export const tauriWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspaceSummary,
  openWorkspace,
  getWorkspaceWorkbenchState,
};

type TauriWorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workbench_id: string | null;
};

type TauriWorkspaceSessionSummary = {
  id: string;
  workspace_id: string;
  status: string;
  active_widget_id: string | null;
};

type TauriWorkspaceWorkbenchState = {
  workspace: TauriWorkspaceSummary;
  workbench: TauriWorkbenchSummary | null;
  widget_instances: TauriWorkspaceWidgetInstanceSummary[];
  shared_state_objects: TauriWorkspaceSharedStateObjectSummary[];
  recent_events: TauriWorkspaceEventSummary[];
};

type TauriWorkbenchSummary = {
  id: string;
  workspace_id: string;
  preset_origin_id: string | null;
};

type TauriWorkspaceWidgetInstanceSummary = {
  id: string;
  definition_id: string;
  title: string;
  category: string;
  layout_mode: string;
  dock_x: number | null;
  dock_y: number | null;
  dock_width: number | null;
  dock_height: number | null;
  popout_x: number | null;
  popout_y: number | null;
  popout_width: number | null;
  popout_height: number | null;
  always_on_top: boolean;
  is_visible: boolean;
  config: string | null;
  state: string | null;
};

type TauriWorkspaceSharedStateObjectSummary = {
  id: string;
  key: string;
  value: string;
  value_kind: string;
};

type TauriWorkspaceEventSummary = {
  id: string;
  kind: string;
  summary: string;
  created_at: string;
};

async function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  const workspace = await invoke<TauriWorkspaceSummary>("create_workspace", {
    request: {
      title: request.title,
      description: request.description ?? null,
    },
  });

  return normalizeWorkspaceSummary(workspace);
}

async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const workspaces = await invoke<TauriWorkspaceSummary[]>("list_workspaces");

  return workspaces.map(normalizeWorkspaceSummary);
}

async function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  const workspace = await invoke<TauriWorkspaceSummary | null>(
    "get_workspace_summary",
    {
      workspaceId,
    },
  );

  return workspace ? normalizeWorkspaceSummary(workspace) : null;
}

async function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
  const session = await invoke<TauriWorkspaceSessionSummary | null>(
    "open_workspace",
    {
      workspaceId,
    },
  );

  return session ? normalizeWorkspaceSessionSummary(session) : null;
}

async function getWorkspaceWorkbenchState(
  workspaceId: string,
): Promise<WorkspaceWorkbenchState | null> {
  const state = await invoke<TauriWorkspaceWorkbenchState | null>(
    "get_workspace_workbench_state",
    {
      workspaceId,
    },
  );

  return state ? normalizeWorkspaceWorkbenchState(state) : null;
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

function normalizeWorkspaceSessionSummary(
  session: TauriWorkspaceSessionSummary,
): WorkspaceSessionSummary {
  return {
    id: session.id,
    workspaceId: session.workspace_id,
    status: session.status,
    activeWidgetId: session.active_widget_id,
  };
}

function normalizeWorkspaceWorkbenchState(
  state: TauriWorkspaceWorkbenchState,
): WorkspaceWorkbenchState {
  return {
    workspace: normalizeWorkspaceSummary(state.workspace),
    workbench: state.workbench
      ? {
          id: state.workbench.id,
          workspaceId: state.workbench.workspace_id,
          presetOriginId: state.workbench.preset_origin_id,
        }
      : null,
    widgetInstances: state.widget_instances.map((widgetInstance) => ({
      id: widgetInstance.id,
      definitionId: widgetInstance.definition_id,
      title: widgetInstance.title,
      category: widgetInstance.category,
      layoutMode: widgetInstance.layout_mode,
      dockX: widgetInstance.dock_x ?? null,
      dockY: widgetInstance.dock_y ?? null,
      dockWidth: widgetInstance.dock_width ?? null,
      dockHeight: widgetInstance.dock_height ?? null,
      popoutX: widgetInstance.popout_x ?? null,
      popoutY: widgetInstance.popout_y ?? null,
      popoutWidth: widgetInstance.popout_width ?? null,
      popoutHeight: widgetInstance.popout_height ?? null,
      alwaysOnTop: widgetInstance.always_on_top ?? false,
      isVisible: widgetInstance.is_visible,
      config: widgetInstance.config ?? null,
      state: widgetInstance.state ?? null,
    })),
    sharedStateObjects: state.shared_state_objects.map((stateObject) => ({
      id: stateObject.id,
      key: stateObject.key,
      value: stateObject.value,
      valueKind: stateObject.value_kind,
    })),
    recentEvents: state.recent_events.map((event) => ({
      id: event.id,
      kind: event.kind,
      summary: event.summary,
      createdAt: event.created_at,
    })),
  };
}
