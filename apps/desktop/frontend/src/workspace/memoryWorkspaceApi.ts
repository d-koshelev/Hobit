import type { WorkspaceApi } from "./workspaceApi";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  CreateWorkspaceRequest,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

const fallbackWorkspaces: WorkspaceSummary[] = [];
const fallbackWorkbenchStates = new Map<string, WorkspaceWorkbenchState>();
const PLACEHOLDER_WIDGET_DOCK_HEIGHT = 240;
const PLACEHOLDER_WIDGET_DOCK_GAP = 16;
let fallbackId = 1;

export const memoryWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspaceSummary,
  openWorkspace,
  getWorkspaceWorkbenchState,
  addWidgetInstanceToWorkbench,
};

async function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  const title = request.title.trim();

  if (!title) {
    throw new Error("workspace title must not be empty");
  }

  const id = `fallback_ws_${fallbackId++}`;
  const workbenchId = `fallback_wb_${fallbackId++}`;
  const workspace: WorkspaceSummary = {
    id,
    title,
    description: request.description ?? null,
    status: "active",
    workbenchId,
  };

  fallbackWorkspaces.unshift(workspace);
  fallbackWorkbenchStates.set(id, {
    workspace,
    workbench: {
      id: workbenchId,
      workspaceId: id,
      presetOriginId: null,
    },
    widgetInstances: [],
    sharedStateObjects: [],
    recentEvents: [],
  });

  return cloneWorkspaceSummary(workspace);
}

async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return fallbackWorkspaces.map(cloneWorkspaceSummary);
}

async function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  const workspace =
    fallbackWorkspaces.find((workspace) => workspace.id === workspaceId) ??
    null;

  return workspace ? cloneWorkspaceSummary(workspace) : null;
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
  const state = fallbackWorkbenchStates.get(workspaceId);

  if (!state) {
    return null;
  }

  return cloneWorkspaceWorkbenchState(state);
}

async function addWidgetInstanceToWorkbench(
  request: AddWidgetInstanceToWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = fallbackWorkbenchStates.get(request.workspaceId);

  if (!state || state.workbench?.id !== request.workbenchId) {
    return null;
  }

  const definitionId = requiredValue(
    request.definitionId,
    "widget definition id",
  );
  const title = requiredValue(request.title, "widget title");
  const category = requiredValue(request.category, "widget category");
  const existingWidgetCount = state.widgetInstances.length;

  state.widgetInstances = [
    ...state.widgetInstances,
    {
      id: `fallback_wid_${fallbackId++}`,
      definitionId,
      title,
      category,
      layoutMode: "docked",
      dockX: 0,
      dockY:
        existingWidgetCount *
        (PLACEHOLDER_WIDGET_DOCK_HEIGHT + PLACEHOLDER_WIDGET_DOCK_GAP),
      dockWidth: 360,
      dockHeight: PLACEHOLDER_WIDGET_DOCK_HEIGHT,
      popoutX: null,
      popoutY: null,
      popoutWidth: null,
      popoutHeight: null,
      alwaysOnTop: false,
      isVisible: true,
      config: "{}",
      state: "{}",
    },
  ];
  state.recentEvents = [
    ...state.recentEvents,
    {
      id: `fallback_evt_${fallbackId++}`,
      kind: "widget_instance_added",
      summary: "Widget instance added",
      createdAt: new Date().toISOString(),
    },
  ];

  return cloneWorkspaceWorkbenchState(state);
}

function requiredValue(value: string, label: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${label} must not be empty`);
  }

  return trimmedValue;
}

function cloneWorkspaceSummary(workspace: WorkspaceSummary): WorkspaceSummary {
  return { ...workspace };
}

function cloneWorkspaceWorkbenchState(
  state: WorkspaceWorkbenchState,
): WorkspaceWorkbenchState {
  return {
    workspace: cloneWorkspaceSummary(state.workspace),
    workbench: state.workbench ? { ...state.workbench } : null,
    widgetInstances: state.widgetInstances.map((widget) => ({ ...widget })),
    sharedStateObjects: state.sharedStateObjects.map((stateObject) => ({
      ...stateObject,
    })),
    recentEvents: state.recentEvents.map((event) => ({ ...event })),
  };
}
