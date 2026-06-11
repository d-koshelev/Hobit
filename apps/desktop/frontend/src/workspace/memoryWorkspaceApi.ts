import {
  assignAgentQueueTaskToExecutor,
  attachKnowledgeToQueueTask,
  attachSkillToQueueTask,
  cancelCodexDirectWorkRun,
  closeTerminalPtySession,
  clearAgentQueueTaskAssignment,
  createTerminalPtySession,
  createAgentQueueItemFromProposal,
  createAgentQueueTask,
  createAgentQueueWorker as unsupportedCreateAgentQueueWorker,
  createGitCommit,
  createWorkspaceGitCommit,
  pushWorkspaceGit,
  createJdbcConnector,
  checkJdbcSidecarHealth,
  createJdbcConnectionProfile,
  deleteJdbcConnectionProfile,
  createSkill as unsupportedCreateSkill,
  createKnowledgeDocument as unsupportedCreateKnowledgeDocument,
  deleteAgentQueueTask,
  detachKnowledgeFromQueueTask,
  detachSkillFromQueueTask,
  deleteAgentQueueWorker as unsupportedDeleteAgentQueueWorker,
  deleteSkill as unsupportedDeleteSkill,
  deleteKnowledgeDocument as unsupportedDeleteKnowledgeDocument,
  createWorkspaceNote as unsupportedCreateWorkspaceNote,
  deleteWidgetInstanceFromWorkbench,
  deleteWorkspace,
  executeJdbcReadOnlyQuery,
  forceKillCodexDirectWorkRun,
  generateAgentChatAiProposal,
  generateCoordinatorProviderResponse,
  getAgentExecutorDiffSummary,
  getAgentExecutorRunDetail,
  getAgentMonitoringSnapshot,
  getAgentQueueSnapshot,
  getAgentQueueTaskLatestRunLink,
  getAgentQueueRunnerSnapshot,
  getAgentQueueTask,
  getGitFileDiff,
  getGitLog,
  getGitRepositoryStatus,
  getWorkspaceGitDiffSummary,
  getWorkspaceGitFileDiff,
  getWorkspaceGitLog,
  getWorkspaceGitStatus,
  getJdbcConnector,
  getJdbcConnectionProfile,
  getSkill as unsupportedGetSkill,
  getKnowledgeDocument as unsupportedGetKnowledgeDocument,
  getTerminalPtySession,
  getWorkspaceNote as unsupportedGetWorkspaceNote,
  killTerminalPtySession,
  listAgentQueueTaskRunLinks,
  listAgentExecutorRuns,
  listAgentQueueTasks,
  listAgentQueueWorkers as unsupportedListAgentQueueWorkers,
  listJdbcConnectors,
  listJdbcConnectionProfiles,
  listSkills as unsupportedListSkills,
  listKnowledgeDocuments as unsupportedListKnowledgeDocuments,
  listTerminalPtySessions,
  listWorkspaceNotes as unsupportedListWorkspaceNotes,
  listenToDirectWorkStreamEvents,
  persistAgentChatProposal,
  resizeTerminalPtySession,
  runCodexDirectWork,
  runDirectWorkValidation,
  runQueueValidationSuite,
  runTerminalCommand,
  startAssignedAgentQueueTask,
  startAgentQueueRunnerSession,
  startCodexDirectWorkStream,
  stopAgentQueueRunnerSession,
  stopTerminalPtySession,
  updateAgentQueueTask,
  updateAgentQueueWorker as unsupportedUpdateAgentQueueWorker,
  updateJdbcConnector,
  updateJdbcConnectionProfile,
  updateSkill as unsupportedUpdateSkill,
  updateKnowledgeDocument as unsupportedUpdateKnowledgeDocument,
  updateWorkspaceNote as unsupportedUpdateWorkspaceNote,
  validateJdbcReadOnlySql,
  probeJdbcDriver,
  writeTerminalPtySession,
  listKnowledgeDraftReviews as unsupportedListKnowledgeDraftReviews,
  recordKnowledgeDraftReview as unsupportedRecordKnowledgeDraftReview,
  searchKnowledgeDocuments as unsupportedSearchKnowledgeDocuments,
} from "./memoryUnsupportedWorkspaceApi";
import {
  createKnowledgeDocument as createMemoryKnowledgeDocument,
  deleteKnowledgeDocument as deleteMemoryKnowledgeDocument,
  getKnowledgeDocument as getMemoryKnowledgeDocument,
  listKnowledgeDocuments as listMemoryKnowledgeDocuments,
  searchKnowledgeDocuments as searchMemoryKnowledgeDocuments,
  updateKnowledgeDocument as updateMemoryKnowledgeDocument,
} from "./memoryWorkspaceKnowledgeDocumentsApi";
import {
  createMemoryAgentQueueWorker,
  deleteMemoryAgentQueueWorker,
  listMemoryAgentQueueWorkers,
  updateMemoryAgentQueueWorker,
} from "./memoryAgentQueueWorkersApi";
import {
  listKnowledgeDraftReviews as listMemoryKnowledgeDraftReviews,
  recordKnowledgeDraftReview as recordMemoryKnowledgeDraftReview,
} from "./memoryKnowledgeDraftReviewApi";
import {
  createWorkspaceNote as createMemoryWorkspaceNote,
  getWorkspaceNote as getMemoryWorkspaceNote,
  listWorkspaceNotes as listMemoryWorkspaceNotes,
  updateWorkspaceNote as updateMemoryWorkspaceNote,
} from "./memoryWorkspaceNotesApi";
import {
  createSkill as createMemorySkill,
  deleteSkill as deleteMemorySkill,
  getSkill as getMemorySkill,
  listSkills as listMemorySkills,
  updateSkill as updateMemorySkill,
} from "./memoryWorkspaceSkillsApi";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  CreateWorkspaceRequest,
  ListWidgetLogsRequest,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  WidgetLogEntry,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

const fallbackWorkspaces: WorkspaceSummary[] = [];
const fallbackWorkbenchStates = new Map<string, WorkspaceWorkbenchState>();
const AGENT_QUEUE_WIDGET_DEFINITION_ID = "agent-queue";
const AGENT_QUEUE_ALREADY_EXISTS_MESSAGE =
  "Agent Queue already exists in this workspace.";
const PLACEHOLDER_WIDGET_DOCK_HEIGHT = 240;
const PLACEHOLDER_WIDGET_DOCK_GAP = 16;
const RECENT_EVENT_LIMIT = 100;
const WORKSPACE_AGENT_WIDGET_DEFINITION_ID = "interactive-agent";
const memoryNotesApi = import.meta.env.DEV
  ? {
      createWorkspaceNote: createMemoryWorkspaceNote,
      listWorkspaceNotes: listMemoryWorkspaceNotes,
      getWorkspaceNote: getMemoryWorkspaceNote,
      updateWorkspaceNote: updateMemoryWorkspaceNote,
    }
  : {
      createWorkspaceNote: unsupportedCreateWorkspaceNote,
      listWorkspaceNotes: unsupportedListWorkspaceNotes,
      getWorkspaceNote: unsupportedGetWorkspaceNote,
      updateWorkspaceNote: unsupportedUpdateWorkspaceNote,
    };
const memorySkillsApi = import.meta.env.DEV
  ? {
      createSkill: createMemorySkill,
      listSkills: listMemorySkills,
      getSkill: getMemorySkill,
      updateSkill: updateMemorySkill,
      deleteSkill: deleteMemorySkill,
    }
  : {
      createSkill: unsupportedCreateSkill,
      listSkills: unsupportedListSkills,
      getSkill: unsupportedGetSkill,
      updateSkill: unsupportedUpdateSkill,
      deleteSkill: unsupportedDeleteSkill,
    };
const memoryKnowledgeDocumentsApi = import.meta.env.DEV
  ? {
      createKnowledgeDocument: createMemoryKnowledgeDocument,
      listKnowledgeDocuments: listMemoryKnowledgeDocuments,
      getKnowledgeDocument: getMemoryKnowledgeDocument,
      updateKnowledgeDocument: updateMemoryKnowledgeDocument,
      deleteKnowledgeDocument: deleteMemoryKnowledgeDocument,
      searchKnowledgeDocuments: searchMemoryKnowledgeDocuments,
      recordKnowledgeDraftReview: recordMemoryKnowledgeDraftReview,
      listKnowledgeDraftReviews: listMemoryKnowledgeDraftReviews,
    }
  : {
      createKnowledgeDocument: unsupportedCreateKnowledgeDocument,
      listKnowledgeDocuments: unsupportedListKnowledgeDocuments,
      getKnowledgeDocument: unsupportedGetKnowledgeDocument,
      updateKnowledgeDocument: unsupportedUpdateKnowledgeDocument,
      deleteKnowledgeDocument: unsupportedDeleteKnowledgeDocument,
      searchKnowledgeDocuments: unsupportedSearchKnowledgeDocuments,
      recordKnowledgeDraftReview: unsupportedRecordKnowledgeDraftReview,
      listKnowledgeDraftReviews: unsupportedListKnowledgeDraftReviews,
    };
const memoryAgentQueueWorkersApi = import.meta.env.DEV
  ? {
      createAgentQueueWorker: createMemoryAgentQueueWorker,
      listAgentQueueWorkers: listMemoryAgentQueueWorkers,
      updateAgentQueueWorker: updateMemoryAgentQueueWorker,
      deleteAgentQueueWorker: deleteMemoryAgentQueueWorker,
    }
  : {
      createAgentQueueWorker: unsupportedCreateAgentQueueWorker,
      listAgentQueueWorkers: unsupportedListAgentQueueWorkers,
      updateAgentQueueWorker: unsupportedUpdateAgentQueueWorker,
      deleteAgentQueueWorker: unsupportedDeleteAgentQueueWorker,
};
let fallbackId = 1;

export const memoryWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  updateWorkspace,
  listWorkspaces,
  deleteWorkspace,
  getWorkspaceSummary,
  openWorkspace,
  selectWorkspaceDirectory,
  getWorkspaceWorkbenchState,
  createWorkspaceNote: memoryNotesApi.createWorkspaceNote,
  listWorkspaceNotes: memoryNotesApi.listWorkspaceNotes,
  getWorkspaceNote: memoryNotesApi.getWorkspaceNote,
  updateWorkspaceNote: memoryNotesApi.updateWorkspaceNote,
  createSkill: memorySkillsApi.createSkill,
  listSkills: memorySkillsApi.listSkills,
  getSkill: memorySkillsApi.getSkill,
  updateSkill: memorySkillsApi.updateSkill,
  deleteSkill: memorySkillsApi.deleteSkill,
  createKnowledgeDocument: memoryKnowledgeDocumentsApi.createKnowledgeDocument,
  listKnowledgeDocuments: memoryKnowledgeDocumentsApi.listKnowledgeDocuments,
  getKnowledgeDocument: memoryKnowledgeDocumentsApi.getKnowledgeDocument,
  updateKnowledgeDocument: memoryKnowledgeDocumentsApi.updateKnowledgeDocument,
  deleteKnowledgeDocument: memoryKnowledgeDocumentsApi.deleteKnowledgeDocument,
  searchKnowledgeDocuments: memoryKnowledgeDocumentsApi.searchKnowledgeDocuments,
  recordKnowledgeDraftReview: memoryKnowledgeDocumentsApi.recordKnowledgeDraftReview,
  listKnowledgeDraftReviews: memoryKnowledgeDocumentsApi.listKnowledgeDraftReviews,
  createJdbcConnector,
  listJdbcConnectors,
  getJdbcConnector,
  updateJdbcConnector,
  validateJdbcReadOnlySql,
  executeJdbcReadOnlyQuery,
  checkJdbcSidecarHealth,
  probeJdbcDriver,
  createJdbcConnectionProfile,
  listJdbcConnectionProfiles,
  getJdbcConnectionProfile,
  updateJdbcConnectionProfile,
  deleteJdbcConnectionProfile,
  addWidgetInstanceToWorkbench,
  updateWidgetInstanceState,
  updateWidgetInstanceLayout,
  deleteWidgetInstanceFromWorkbench,
  listWidgetLogs,
  listAgentExecutorRuns,
  getAgentExecutorRunDetail,
  getAgentExecutorDiffSummary,
  getAgentMonitoringSnapshot,
  createAgentQueueItemFromProposal,
  getAgentQueueSnapshot,
  createAgentQueueTask,
  listAgentQueueTasks,
  getAgentQueueTask,
  updateAgentQueueTask,
  deleteAgentQueueTask,
  attachKnowledgeToQueueTask,
  detachKnowledgeFromQueueTask,
  attachSkillToQueueTask,
  detachSkillFromQueueTask,
  listAgentQueueWorkers: memoryAgentQueueWorkersApi.listAgentQueueWorkers,
  createAgentQueueWorker: memoryAgentQueueWorkersApi.createAgentQueueWorker,
  updateAgentQueueWorker: memoryAgentQueueWorkersApi.updateAgentQueueWorker,
  deleteAgentQueueWorker: memoryAgentQueueWorkersApi.deleteAgentQueueWorker,
  assignAgentQueueTaskToExecutor,
  clearAgentQueueTaskAssignment,
  startAssignedAgentQueueTask,
  getAgentQueueTaskLatestRunLink,
  listAgentQueueTaskRunLinks,
  startAgentQueueRunnerSession,
  stopAgentQueueRunnerSession,
  getAgentQueueRunnerSnapshot,
  getGitRepositoryStatus,
  getGitFileDiff,
  getGitLog,
  createGitCommit,
  getWorkspaceGitStatus,
  getWorkspaceGitDiffSummary,
  getWorkspaceGitFileDiff,
  getWorkspaceGitLog,
  createWorkspaceGitCommit,
  pushWorkspaceGit,
  persistAgentChatProposal,
  generateAgentChatAiProposal,
  generateCoordinatorProviderResponse,
  runTerminalCommand,
  createTerminalPtySession,
  writeTerminalPtySession,
  resizeTerminalPtySession,
  stopTerminalPtySession,
  killTerminalPtySession,
  closeTerminalPtySession,
  getTerminalPtySession,
  listTerminalPtySessions,
  runCodexDirectWork,
  runDirectWorkValidation,
  runQueueValidationSuite,
  cancelCodexDirectWorkRun,
  forceKillCodexDirectWorkRun,
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
  const now = new Date().toISOString();
  const workspace: WorkspaceSummary = {
    id,
    title,
    description: request.description ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    widgetCount: 0,
    workspaceAgentCount: 0,
    noteCount: 0,
    skillCount: 0,
    knowledgeDocumentCount: 0,
    queueTaskCount: 0,
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

async function updateWorkspace(
  request: Parameters<WorkspaceApi["updateWorkspace"]>[0],
): ReturnType<WorkspaceApi["updateWorkspace"]> {
  const workspace = fallbackWorkspaces.find(
    (candidate) => candidate.id === request.workspaceId,
  );
  if (!workspace) {
    return null;
  }
  workspace.title = requiredValue(request.title, "workspace title");
  workspace.updatedAt = new Date().toISOString();
  const state = fallbackWorkbenchStates.get(workspace.id);

  if (state) {
    state.workspace = workspace;
    appendRecentEvent(state, "workspace_renamed", "Workspace renamed");
  }
  return cloneWorkspaceSummary(workspace);
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
    const openedAt = new Date().toISOString();
    workspace.lastOpenedAt = openedAt;
    workspace.updatedAt = openedAt;
    syncWorkspaceStats(workspace, state);
    appendRecentEvent(state, "workspace_opened", "Workspace opened");
  }

  return {
    id: `fallback_wss_${fallbackId++}`,
    workspaceId: workspace.id,
    status: "open",
    activeWidgetId: null,
  };
}

async function selectWorkspaceDirectory(): Promise<string | null> {
  return null;
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

  if (
    definitionId === AGENT_QUEUE_WIDGET_DEFINITION_ID &&
    state.widgetInstances.some(
      (widget) => widget.definitionId === AGENT_QUEUE_WIDGET_DEFINITION_ID,
    )
  ) {
    throw new Error(AGENT_QUEUE_ALREADY_EXISTS_MESSAGE);
  }

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
  syncWorkspaceStats(state.workspace, state);
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
      createdAt: new Date().toISOString(),
      id: `fallback_evt_${fallbackId++}`,
      kind,
      summary,
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

function syncWorkspaceStats(
  workspace: WorkspaceSummary,
  state: WorkspaceWorkbenchState,
) {
  workspace.widgetCount = state.widgetInstances.length;
  workspace.workspaceAgentCount = state.widgetInstances.filter(
    (widget) => widget.definitionId === WORKSPACE_AGENT_WIDGET_DEFINITION_ID,
  ).length;
}
