import type { WorkspaceApi } from "./workspaceApi";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  AgentMonitoringSnapshot,
  AgentQueueItem,
  AgentQueueSnapshot,
  CancelCodexDirectWorkRunRequest,
  CancelCodexDirectWorkRunResponse,
  CreateWorkspaceRequest,
  CreateAgentQueueItemFromProposalRequest,
  DirectWorkStreamEvent,
  GenerateAgentChatAiProposalRequest,
  GenerateAgentChatAiProposalResponse,
  GetAgentMonitoringSnapshotRequest,
  GetAgentQueueSnapshotRequest,
  GetGitRepositoryStatusRequest,
  GitRepositoryStatus,
  ListWidgetLogsRequest,
  PersistAgentChatProposalRequest,
  PersistAgentChatProposalResponse,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  StartCodexDirectWorkStreamRequest,
  StartCodexDirectWorkStreamResponse,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  WidgetLogEntry,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

const fallbackWorkspaces: WorkspaceSummary[] = [];
const fallbackWorkbenchStates = new Map<string, WorkspaceWorkbenchState>();
const PLACEHOLDER_WIDGET_DOCK_HEIGHT = 240;
const PLACEHOLDER_WIDGET_DOCK_GAP = 16;
const RECENT_EVENT_LIMIT = 100;
let fallbackId = 1;

export const memoryWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  getWorkspaceSummary,
  openWorkspace,
  getWorkspaceWorkbenchState,
  addWidgetInstanceToWorkbench,
  updateWidgetInstanceState,
  updateWidgetInstanceLayout,
  listWidgetLogs,
  getAgentMonitoringSnapshot,
  createAgentQueueItemFromProposal,
  getAgentQueueSnapshot,
  getGitRepositoryStatus,
  persistAgentChatProposal,
  generateAgentChatAiProposal,
  runTerminalCommand,
  runCodexDirectWork,
  runDirectWorkValidation,
  cancelCodexDirectWorkRun,
  startCodexDirectWorkStream,
  listenToDirectWorkStreamEvents,
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
  const workbenchState: WorkspaceWorkbenchState = {
    workspace,
    workbench: {
      id: workbenchId,
      workspaceId: id,
      presetOriginId: null,
    },
    widgetInstances: [],
    sharedStateObjects: [],
    recentEvents: [],
  };

  appendRecentEvent(workbenchState, "workspace_created", "Workspace created");
  fallbackWorkbenchStates.set(id, workbenchState);

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

  const state = fallbackWorkbenchStates.get(workspace.id);

  if (state) {
    appendRecentEvent(state, "workspace_opened", "Workspace opened");
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
  appendRecentEvent(state, "widget_instance_added", "Widget instance added");

  return cloneWorkspaceWorkbenchState(state);
}

async function updateWidgetInstanceState(
  request: UpdateWidgetInstanceStateRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = fallbackWorkbenchStates.get(request.workspaceId);

  if (!state || state.workbench?.id !== request.workbenchId) {
    return null;
  }

  JSON.parse(request.state);

  const widgetIndex = state.widgetInstances.findIndex(
    (widget) => widget.id === request.widgetInstanceId,
  );

  if (widgetIndex === -1) {
    return null;
  }

  state.widgetInstances = state.widgetInstances.map((widget, index) =>
    index === widgetIndex ? { ...widget, state: request.state } : widget,
  );
  appendRecentEvent(state, "widget_state_updated", "Widget state updated");

  return cloneWorkspaceWorkbenchState(state);
}

async function updateWidgetInstanceLayout(
  request: UpdateWidgetInstanceLayoutRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = fallbackWorkbenchStates.get(request.workspaceId);

  if (!state || state.workbench?.id !== request.workbenchId) {
    return null;
  }

  validateWidgetLayout(request.layout);

  const widgetIndex = state.widgetInstances.findIndex(
    (widget) => widget.id === request.widgetInstanceId,
  );

  if (widgetIndex === -1) {
    return null;
  }

  state.widgetInstances = state.widgetInstances.map((widget, index) =>
    index === widgetIndex
      ? {
          ...widget,
          layoutMode: request.layout.layoutMode,
          dockX: request.layout.dockX,
          dockY: request.layout.dockY,
          dockWidth: request.layout.dockWidth,
          dockHeight: request.layout.dockHeight,
          popoutX: request.layout.popoutX,
          popoutY: request.layout.popoutY,
          popoutWidth: request.layout.popoutWidth,
          popoutHeight: request.layout.popoutHeight,
          alwaysOnTop: request.layout.alwaysOnTop,
          isVisible: request.layout.isVisible,
        }
      : widget,
  );
  appendRecentEvent(state, "widget_layout_updated", "Widget layout updated");

  return cloneWorkspaceWorkbenchState(state);
}

async function listWidgetLogs(
  _request: ListWidgetLogsRequest,
): Promise<WidgetLogEntry[]> {
  return [];
}

async function getAgentMonitoringSnapshot(
  _request: GetAgentMonitoringSnapshotRequest,
): Promise<AgentMonitoringSnapshot | null> {
  throw new Error(
    "Agent Monitoring proposal result reads are only available in the Tauri desktop shell. Browser fallback has no persisted proposal run artifacts to display.",
  );
}

async function createAgentQueueItemFromProposal(
  _request: CreateAgentQueueItemFromProposalRequest,
): Promise<AgentQueueItem | null> {
  throw new Error(
    "Agent Queue review item persistence is only available in the Tauri desktop shell. Browser fallback cannot create persisted queue items from proposal artifacts.",
  );
}

async function getAgentQueueSnapshot(
  _request: GetAgentQueueSnapshotRequest,
): Promise<AgentQueueSnapshot | null> {
  throw new Error(
    "Agent Queue persisted review items are only available in the Tauri desktop shell. Browser fallback has no persisted queue inbox to display.",
  );
}

async function getGitRepositoryStatus(
  _request: GetGitRepositoryStatusRequest,
): Promise<GitRepositoryStatus | null> {
  throw new Error(
    "Git status is only available in the Tauri desktop shell. Browser fallback cannot read Git repositories.",
  );
}

async function runTerminalCommand(
  _request: RunTerminalCommandRequest,
): Promise<RunTerminalCommandResponse | null> {
  throw new Error(
    "Terminal command execution is only available in the Tauri desktop shell. Browser fallback cannot run local processes.",
  );
}

async function runCodexDirectWork(
  _request: RunCodexDirectWorkRequest,
): Promise<RunCodexDirectWorkResponse | null> {
  throw new Error(
    "Codex Direct Work is only available in the Tauri desktop shell. Browser fallback cannot run local executor processes or persist Direct Work artifacts.",
  );
}

async function runDirectWorkValidation(
  _request: RunDirectWorkValidationRequest,
): Promise<RunDirectWorkValidationResponse | null> {
  throw new Error(
    "Direct Work validation capture is only available in the Tauri desktop shell. Browser fallback cannot run Toolbelt validation or persist Direct Work validation artifacts.",
  );
}

async function cancelCodexDirectWorkRun(
  _request: CancelCodexDirectWorkRunRequest,
): Promise<CancelCodexDirectWorkRunResponse | null> {
  throw new Error(
    "Codex Direct Work cancellation is only available in the Tauri desktop shell. Browser fallback cannot stop local executor processes.",
  );
}

async function startCodexDirectWorkStream(
  _request: StartCodexDirectWorkStreamRequest,
): Promise<StartCodexDirectWorkStreamResponse | null> {
  throw new Error(
    "Codex Direct Work streaming is only available in the Tauri desktop shell. Browser fallback cannot run local executor processes or stream Direct Work events.",
  );
}

async function listenToDirectWorkStreamEvents(
  _onEvent: (event: DirectWorkStreamEvent) => void,
): Promise<() => void> {
  throw new Error(
    "Codex Direct Work streaming is only available in the Tauri desktop shell. Browser fallback cannot subscribe to Direct Work events.",
  );
}

async function persistAgentChatProposal(
  _request: PersistAgentChatProposalRequest,
): Promise<PersistAgentChatProposalResponse | null> {
  throw new Error(
    "Agent Chat proposal persistence is only available in the Tauri desktop shell. Browser fallback keeps the proposal preview local and does not persist run artifacts.",
  );
}

async function generateAgentChatAiProposal(
  _request: GenerateAgentChatAiProposalRequest,
): Promise<GenerateAgentChatAiProposalResponse | null> {
  throw new Error(
    "Agent Chat AI provider calls are only available through the Tauri desktop backend. Browser fallback does not call AI providers directly.",
  );
}

function requiredValue(value: string, label: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${label} must not be empty`);
  }

  return trimmedValue;
}

function validateWidgetLayout(
  layout: UpdateWidgetInstanceLayoutRequest["layout"],
) {
  if (
    layout.layoutMode !== "docked" &&
    layout.layoutMode !== "popped_out" &&
    layout.layoutMode !== "minimized"
  ) {
    throw new Error(`unsupported widget layout mode: ${layout.layoutMode}`);
  }

  validateDimension(layout.dockWidth, "dock width");
  validateDimension(layout.dockHeight, "dock height");
  validateDimension(layout.popoutWidth, "popout width");
  validateDimension(layout.popoutHeight, "popout height");

  if (layout.dockWidth === null || layout.dockHeight === null) {
    throw new Error("dock dimensions are required");
  }

  if (
    layout.layoutMode === "popped_out" &&
    (layout.popoutWidth === null || layout.popoutHeight === null)
  ) {
    throw new Error("popout dimensions are required for popped_out layout");
  }

  if (layout.alwaysOnTop && layout.layoutMode !== "popped_out") {
    throw new Error("always_on_top is only valid for popped_out layout");
  }
}

function validateDimension(value: number | null, label: string) {
  if (value === null) {
    return;
  }

  if (value <= 0) {
    throw new Error(`${label} must be positive`);
  }

  if (value > 16_384) {
    throw new Error(`${label} must be no greater than 16384`);
  }
}

function appendRecentEvent(
  state: WorkspaceWorkbenchState,
  kind: string,
  summary: string,
) {
  state.recentEvents = [
    ...state.recentEvents,
    {
      id: `fallback_evt_${fallbackId++}`,
      kind,
      summary,
      createdAt: new Date().toISOString(),
    },
  ].slice(-RECENT_EVENT_LIMIT);
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
