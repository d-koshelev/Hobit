import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceApi } from "./workspaceApi";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  AgentMonitoringSnapshot,
  CreateWorkspaceRequest,
  GetAgentMonitoringSnapshotRequest,
  GetGitRepositoryStatusRequest,
  GitRepositoryStatus,
  ListWidgetLogsRequest,
  PersistAgentChatProposalRequest,
  PersistAgentChatProposalResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  WidgetLogEntry,
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
  addWidgetInstanceToWorkbench,
  updateWidgetInstanceState,
  updateWidgetInstanceLayout,
  listWidgetLogs,
  getAgentMonitoringSnapshot,
  getGitRepositoryStatus,
  persistAgentChatProposal,
  runTerminalCommand,
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

type TauriWidgetLogEntry = {
  id: string;
  widget_instance_id: string;
  run_id: string | null;
  level: string;
  message: string;
  payload: string | null;
  created_at: string;
};

type TauriAgentMonitoringSnapshot = {
  workspace_id: string;
  workbench_id: string;
  proposal_results: TauriAgentMonitoringProposalResult[];
};

type TauriAgentMonitoringProposalResult = {
  run_id: string;
  result_id: string;
  status: string;
  result_type: string;
  result_summary: string | null;
  result_content: string | null;
  run_started_at: string;
  run_finished_at: string | null;
  result_created_at: string;
  source_widget_id: string;
  source_widget_title: string;
  runtime_status: string;
  no_llm_called: boolean;
  no_tools_executed: boolean;
  no_mutations_performed: boolean;
  operator_prompt: string;
  proposal_summary: string;
  proposed_plan: string[];
  context_needed: string[];
  approved_context_summary: string;
  approved_context_status: string;
  approved_context_source_labels: string[];
  proposed_actions: TauriAgentMonitoringProposalAction[];
  safety_notes: string[];
  raw_payload: string;
};

type TauriAgentMonitoringProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

type TauriGitRepositoryStatus = {
  branch: TauriGitBranchStatus | null;
  working_tree: TauriGitWorkingTreeStatus;
  changed_files: TauriGitFileChange[];
  last_commit: TauriGitLastCommit | null;
  warnings: string[];
};

type TauriGitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  is_detached: boolean;
};

type TauriGitWorkingTreeStatus = {
  is_clean: boolean;
  is_dirty: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
};

type TauriGitFileChange = {
  area: string;
  kind: string;
  path: string;
  original_path: string | null;
};

type TauriGitLastCommit = {
  hash: string;
  title: string;
  author: string | null;
  committed_at: string | null;
};

type TauriRunTerminalCommandResponse = {
  run_id: string;
  status: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  duration_ms: number;
  error_message: string | null;
};

type TauriPersistAgentChatProposalResponse = {
  run_id: string;
  status: string;
  result_id: string;
  result_type: string;
  summary: string;
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

async function getAgentMonitoringSnapshot(
  request: GetAgentMonitoringSnapshotRequest,
): Promise<AgentMonitoringSnapshot | null> {
  const snapshot = await invoke<TauriAgentMonitoringSnapshot | null>(
    "get_agent_monitoring_snapshot",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
      },
    },
  );

  return snapshot ? normalizeAgentMonitoringSnapshot(snapshot) : null;
}

async function getGitRepositoryStatus(
  request: GetGitRepositoryStatusRequest,
): Promise<GitRepositoryStatus | null> {
  const status = await invoke<TauriGitRepositoryStatus | null>(
    "get_git_repository_status",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        repository_root: request.repositoryRoot,
      },
    },
  );

  return status ? normalizeGitRepositoryStatus(status) : null;
}

async function runTerminalCommand(
  request: RunTerminalCommandRequest,
): Promise<RunTerminalCommandResponse | null> {
  const response = await invoke<TauriRunTerminalCommandResponse | null>(
    "run_terminal_command",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        program: request.program,
        args: request.args,
        working_directory: request.workingDirectory,
        timeout_ms: request.timeoutMs ?? null,
        stdout_cap_bytes: request.stdoutCapBytes ?? null,
        stderr_cap_bytes: request.stderrCapBytes ?? null,
      },
    },
  );

  return response ? normalizeRunTerminalCommandResponse(response) : null;
}

async function persistAgentChatProposal(
  request: PersistAgentChatProposalRequest,
): Promise<PersistAgentChatProposalResponse | null> {
  const response = await invoke<TauriPersistAgentChatProposalResponse | null>(
    "persist_agent_chat_proposal",
    {
      request: {
        workspace_id: request.workspaceId,
        workbench_id: request.workbenchId,
        widget_instance_id: request.widgetInstanceId,
        operator_prompt: request.operatorPrompt,
        approved_context_snapshot_json: request.approvedContextSnapshotJson,
        proposal: {
          id: request.proposal.id,
          request_summary: request.proposal.requestSummary,
          proposed_plan: request.proposal.proposedPlan,
          context_needed: request.proposal.contextNeeded,
          action_proposals: request.proposal.actionProposals.map((action) => ({
            title: action.title,
            description: action.description,
          })),
          safety_notes: request.proposal.safetyNotes,
          runtime_notes: request.proposal.runtimeNotes,
        },
      },
    },
  );

  return response ? normalizePersistAgentChatProposalResponse(response) : null;
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

function normalizeAgentMonitoringSnapshot(
  snapshot: TauriAgentMonitoringSnapshot,
): AgentMonitoringSnapshot {
  return {
    workspaceId: snapshot.workspace_id,
    workbenchId: snapshot.workbench_id,
    proposalResults: snapshot.proposal_results.map(
      normalizeAgentMonitoringProposalResult,
    ),
  };
}

function normalizeAgentMonitoringProposalResult(
  result: TauriAgentMonitoringProposalResult,
) {
  return {
    runId: result.run_id,
    resultId: result.result_id,
    status: result.status,
    resultType: result.result_type,
    resultSummary: result.result_summary,
    resultContent: result.result_content,
    runStartedAt: result.run_started_at,
    runFinishedAt: result.run_finished_at,
    resultCreatedAt: result.result_created_at,
    sourceWidgetId: result.source_widget_id,
    sourceWidgetTitle: result.source_widget_title,
    runtimeStatus: result.runtime_status,
    noLlmCalled: result.no_llm_called,
    noToolsExecuted: result.no_tools_executed,
    noMutationsPerformed: result.no_mutations_performed,
    operatorPrompt: result.operator_prompt,
    proposalSummary: result.proposal_summary,
    proposedPlan: result.proposed_plan,
    contextNeeded: result.context_needed,
    approvedContextSummary: result.approved_context_summary,
    approvedContextStatus: result.approved_context_status,
    approvedContextSourceLabels: result.approved_context_source_labels,
    proposedActions: result.proposed_actions.map((action) => ({
      title: action.title,
      description: action.description,
      status: action.status,
      executed: action.executed,
    })),
    safetyNotes: result.safety_notes,
    rawPayload: result.raw_payload,
  };
}

function normalizeGitRepositoryStatus(
  status: TauriGitRepositoryStatus,
): GitRepositoryStatus {
  return {
    branch: status.branch
      ? {
          name: status.branch.name,
          upstream: status.branch.upstream,
          ahead: status.branch.ahead,
          behind: status.branch.behind,
          isDetached: status.branch.is_detached,
        }
      : null,
    workingTree: {
      isClean: status.working_tree.is_clean,
      isDirty: status.working_tree.is_dirty,
      stagedCount: status.working_tree.staged_count,
      unstagedCount: status.working_tree.unstaged_count,
      untrackedCount: status.working_tree.untracked_count,
    },
    changedFiles: status.changed_files.map((change) => ({
      area: change.area,
      kind: change.kind,
      path: change.path,
      originalPath: change.original_path,
    })),
    lastCommit: status.last_commit
      ? {
          hash: status.last_commit.hash,
          title: status.last_commit.title,
          author: status.last_commit.author,
          committedAt: status.last_commit.committed_at,
        }
      : null,
    warnings: status.warnings,
  };
}

function normalizeRunTerminalCommandResponse(
  response: TauriRunTerminalCommandResponse,
): RunTerminalCommandResponse {
  return {
    runId: response.run_id,
    status: response.status,
    exitCode: response.exit_code,
    stdout: response.stdout,
    stderr: response.stderr,
    stdoutTruncated: response.stdout_truncated,
    stderrTruncated: response.stderr_truncated,
    durationMs: response.duration_ms,
    errorMessage: response.error_message,
  };
}

function normalizePersistAgentChatProposalResponse(
  response: TauriPersistAgentChatProposalResponse,
): PersistAgentChatProposalResponse {
  return {
    runId: response.run_id,
    status: response.status,
    resultId: response.result_id,
    resultType: response.result_type,
    summary: response.summary,
  };
}
