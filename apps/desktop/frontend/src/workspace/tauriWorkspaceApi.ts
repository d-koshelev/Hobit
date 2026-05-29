import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { generateAgentChatAiProposal } from "./tauriAgentChatAiApi";
import { persistAgentChatProposal } from "./tauriAgentChatProposalPersistenceApi";
import { getAgentMonitoringSnapshot } from "./tauriAgentMonitoringApi";
import {
  assignAgentQueueTaskToExecutor,
  clearAgentQueueTaskAssignment,
  createAgentQueueItemFromProposal,
  createAgentQueueTask,
  deleteAgentQueueTask,
  getAgentQueueSnapshot,
  getAgentQueueTaskLatestRunLink,
  getAgentQueueRunnerSnapshot,
  getAgentQueueTask,
  listAgentQueueTaskRunLinks,
  listAgentQueueTasks,
  startAssignedAgentQueueTask,
  startAgentQueueRunnerSession,
  stopAgentQueueRunnerSession,
  updateAgentQueueTask,
} from "./tauriAgentQueueApi";
import { getAgentExecutorDiffSummary } from "./tauriAgentExecutorDiffApi";
import {
  getAgentExecutorRunDetail,
  listAgentExecutorRuns,
} from "./tauriAgentExecutorHistoryApi";
import {
  cancelCodexDirectWorkRun,
  forceKillCodexDirectWorkRun,
  listenToDirectWorkStreamEvents,
  runCodexDirectWork,
  runDirectWorkValidation,
  startCodexDirectWorkStream,
} from "./tauriCodexDirectWorkApi";
import { generateCoordinatorProviderResponse } from "./tauriCoordinatorProviderApi";
import { createGitCommit } from "./tauriGitCommitApi";
import { getGitFileDiff, getGitLog } from "./tauriGitReviewApi";
import { getGitRepositoryStatus } from "./tauriGitStatusApi";
import {
  createJdbcConnector,
  getJdbcConnector,
  listJdbcConnectors,
  updateJdbcConnector,
} from "./tauriJdbcConnectorApi";
import {
  checkJdbcSidecarHealth,
  createJdbcConnectionProfile,
  deleteJdbcConnectionProfile,
  executeJdbcReadOnlyQuery,
  getJdbcConnectionProfile,
  listJdbcConnectionProfiles,
  probeJdbcDriver,
  updateJdbcConnectionProfile,
  validateJdbcReadOnlySql,
} from "./tauriJdbcQueryApi";
import { runTerminalCommand } from "./tauriTerminalCommandApi";
import {
  closeTerminalPtySession,
  createTerminalPtySession,
  getTerminalPtySession,
  killTerminalPtySession,
  listTerminalPtySessions,
  resizeTerminalPtySession,
  stopTerminalPtySession,
  writeTerminalPtySession,
} from "./tauriTerminalPtyApi";
import { deleteWorkspace } from "./tauriWorkspaceDeletionApi";
import {
  createWorkspaceNote,
  getWorkspaceNote,
  listWorkspaceNotes,
  updateWorkspaceNote,
} from "./tauriWorkspaceNotesApi";
import {
  createSkill,
  deleteSkill,
  getSkill,
  listSkills,
  updateSkill,
} from "./tauriWorkspaceSkillsApi";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  listKnowledgeDocuments,
  searchKnowledgeDocuments,
  updateKnowledgeDocument,
} from "./tauriWorkspaceKnowledgeDocumentsApi";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  CreateWorkspaceRequest,
  DeleteWidgetInstanceFromWorkbenchRequest,
  ListWidgetLogsRequest,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  WidgetLogEntry,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";
import type { WorkspaceApi } from "./workspaceApiTypes";

export const tauriWorkspaceApi: WorkspaceApi = {
  createWorkspace,
  listWorkspaces,
  deleteWorkspace,
  getWorkspaceSummary,
  openWorkspace,
  selectWorkspaceDirectory,
  getWorkspaceWorkbenchState,
  createWorkspaceNote,
  listWorkspaceNotes,
  getWorkspaceNote,
  updateWorkspaceNote,
  createSkill,
  listSkills,
  getSkill,
  updateSkill,
  deleteSkill,
  createKnowledgeDocument,
  listKnowledgeDocuments,
  getKnowledgeDocument,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
  searchKnowledgeDocuments,
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
  cancelCodexDirectWorkRun,
  forceKillCodexDirectWorkRun,
  startCodexDirectWorkStream,
  listenToDirectWorkStreamEvents,
};

type TauriWorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
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

type TauriWidgetLogEntry = {
  id: string;
  widget_instance_id: string;
  run_id: string | null;
  level: string;
  message: string;
  payload: string | null;
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

async function selectWorkspaceDirectory(): Promise<string | null> {
  try {
    const selectedDirectory = (await open({
      directory: true,
      multiple: false,
    })) as string | string[] | null;

    if (Array.isArray(selectedDirectory)) {
      return selectedDirectory[0] ?? null;
    }

    return selectedDirectory;
  } catch (error) {
    throw new Error(`Directory picker failed: ${errorToReadableMessage(error)}`);
  }
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

async function addWidgetInstanceToWorkbench(
  request: AddWidgetInstanceToWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = await invoke<TauriWorkspaceWorkbenchState | null>(
    "add_widget_instance_to_workbench",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        definition_id: request.definitionId,
        title: request.title,
        category: request.category,
      },
    },
  );

  return state ? normalizeWorkspaceWorkbenchState(state) : null;
}

async function updateWidgetInstanceState(
  request: UpdateWidgetInstanceStateRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = await invoke<TauriWorkspaceWorkbenchState | null>(
    "update_widget_instance_state",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        state: request.state,
      },
    },
  );

  return state ? normalizeWorkspaceWorkbenchState(state) : null;
}

async function updateWidgetInstanceLayout(
  request: UpdateWidgetInstanceLayoutRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = await invoke<TauriWorkspaceWorkbenchState | null>(
    "update_widget_instance_layout",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        layout: {
          layout_mode: request.layout.layoutMode,
          dock_x: request.layout.dockX,
          dock_y: request.layout.dockY,
          dock_width: request.layout.dockWidth,
          dock_height: request.layout.dockHeight,
          popout_x: request.layout.popoutX,
          popout_y: request.layout.popoutY,
          popout_width: request.layout.popoutWidth,
          popout_height: request.layout.popoutHeight,
          always_on_top: request.layout.alwaysOnTop,
          is_visible: request.layout.isVisible,
        },
      },
    },
  );

  return state ? normalizeWorkspaceWorkbenchState(state) : null;
}

async function deleteWidgetInstanceFromWorkbench(
  request: DeleteWidgetInstanceFromWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  const state = await invoke<TauriWorkspaceWorkbenchState | null>(
    "delete_widget_instance_from_workbench",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
      },
    },
  );

  return state ? normalizeWorkspaceWorkbenchState(state) : null;
}

async function listWidgetLogs(
  request: ListWidgetLogsRequest,
): Promise<WidgetLogEntry[]> {
  const logs = await invoke<TauriWidgetLogEntry[] | null>("list_widget_logs", {
    request: {
      workspace_id: request.workspaceId,
      workbench_id: request.workbenchId,
      widget_instance_id: request.widgetInstanceId,
      limit: request.limit,
    },
  });

  return logs ? logs.map(normalizeWidgetLogEntry) : [];
}

function normalizeWorkspaceSummary(
  workspace: TauriWorkspaceSummary,
): WorkspaceSummary {
  return {
    id: workspace.id,
    title: workspace.title,
    description: workspace.description,
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

function normalizeWidgetLogEntry(log: TauriWidgetLogEntry): WidgetLogEntry {
  return {
    id: log.id,
    widgetInstanceId: log.widget_instance_id,
    runId: log.run_id,
    level: log.level,
    message: log.message,
    payload: log.payload,
    createdAt: log.created_at,
  };
}

function errorToReadableMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "dialog plugin is unavailable or misconfigured";
}
