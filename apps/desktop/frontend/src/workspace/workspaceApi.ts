import { memoryWorkspaceApi } from "./memoryWorkspaceApi";
import { tauriWorkspaceApi } from "./tauriWorkspaceApi";
import { isTauriRuntime } from "./tauriEnvironment";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  AgentExecutorDiffSummary,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentMonitoringSnapshot,
  AgentQueueItem,
  AgentQueueSnapshot,
  AgentQueueTask,
  AssignAgentQueueTaskToExecutorRequest,
  CancelCodexDirectWorkRunRequest,
  CancelCodexDirectWorkRunResponse,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  CreateWorkspaceRequest,
  CreateGitCommitRequest,
  CreateAgentQueueItemFromProposalRequest,
  CreateWorkspaceNoteRequest,
  DeleteWidgetInstanceFromWorkbenchRequest,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  DirectWorkStreamEvent,
  GenerateAgentChatAiProposalRequest,
  GenerateAgentChatAiProposalResponse,
  GetAgentExecutorRunDetailRequest,
  GetAgentExecutorDiffSummaryRequest,
  GetAgentMonitoringSnapshotRequest,
  GetAgentQueueSnapshotRequest,
  GetAgentQueueTaskRequest,
  GetGitRepositoryStatusRequest,
  GetWorkspaceNoteRequest,
  GitCommitResponse,
  GitRepositoryStatus,
  ListAgentExecutorRunsRequest,
  ListAgentQueueTasksRequest,
  ListWorkspaceNotesRequest,
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
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  UpdateAgentQueueTaskRequest,
  UpdateWorkspaceNoteRequest,
  WidgetLogEntry,
  WorkspaceNote,
  WorkspaceSessionSummary,
  WorkspaceSummary,
  WorkspaceWorkbenchState,
} from "./types";

export type WorkspaceApi = {
  createWorkspace: (
    request: CreateWorkspaceRequest,
  ) => Promise<WorkspaceSummary>;
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  deleteWorkspace: (
    request: DeleteWorkspaceRequest,
  ) => Promise<DeleteWorkspaceResponse>;
  getWorkspaceSummary: (
    workspaceId: string,
  ) => Promise<WorkspaceSummary | null>;
  openWorkspace: (
    workspaceId: string,
  ) => Promise<WorkspaceSessionSummary | null>;
  getWorkspaceWorkbenchState: (
    workspaceId: string,
  ) => Promise<WorkspaceWorkbenchState | null>;
  createWorkspaceNote: (
    request: CreateWorkspaceNoteRequest,
  ) => Promise<WorkspaceNote>;
  listWorkspaceNotes: (
    request: ListWorkspaceNotesRequest,
  ) => Promise<WorkspaceNote[]>;
  getWorkspaceNote: (
    request: GetWorkspaceNoteRequest,
  ) => Promise<WorkspaceNote | null>;
  updateWorkspaceNote: (
    request: UpdateWorkspaceNoteRequest,
  ) => Promise<WorkspaceNote | null>;
  addWidgetInstanceToWorkbench: (
    request: AddWidgetInstanceToWorkbenchRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  updateWidgetInstanceState: (
    request: UpdateWidgetInstanceStateRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  updateWidgetInstanceLayout: (
    request: UpdateWidgetInstanceLayoutRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  deleteWidgetInstanceFromWorkbench: (
    request: DeleteWidgetInstanceFromWorkbenchRequest,
  ) => Promise<WorkspaceWorkbenchState | null>;
  listWidgetLogs: (
    request: ListWidgetLogsRequest,
  ) => Promise<WidgetLogEntry[]>;
  listAgentExecutorRuns: (
    request: ListAgentExecutorRunsRequest,
  ) => Promise<AgentExecutorRunHistory | null>;
  getAgentExecutorRunDetail: (
    request: GetAgentExecutorRunDetailRequest,
  ) => Promise<AgentExecutorRunDetail | null>;
  getAgentExecutorDiffSummary: (
    request: GetAgentExecutorDiffSummaryRequest,
  ) => Promise<AgentExecutorDiffSummary | null>;
  getAgentMonitoringSnapshot: (
    request: GetAgentMonitoringSnapshotRequest,
  ) => Promise<AgentMonitoringSnapshot | null>;
  createAgentQueueItemFromProposal: (
    request: CreateAgentQueueItemFromProposalRequest,
  ) => Promise<AgentQueueItem | null>;
  getAgentQueueSnapshot: (
    request: GetAgentQueueSnapshotRequest,
  ) => Promise<AgentQueueSnapshot | null>;
  createAgentQueueTask: (
    request: CreateAgentQueueTaskRequest,
  ) => Promise<AgentQueueTask>;
  listAgentQueueTasks: (
    request: ListAgentQueueTasksRequest,
  ) => Promise<AgentQueueTask[]>;
  getAgentQueueTask: (
    request: GetAgentQueueTaskRequest,
  ) => Promise<AgentQueueTask | null>;
  updateAgentQueueTask: (
    request: UpdateAgentQueueTaskRequest,
  ) => Promise<AgentQueueTask | null>;
  assignAgentQueueTaskToExecutor: (
    request: AssignAgentQueueTaskToExecutorRequest,
  ) => Promise<AgentQueueTask>;
  clearAgentQueueTaskAssignment: (
    request: ClearAgentQueueTaskAssignmentRequest,
  ) => Promise<AgentQueueTask>;
  startAssignedAgentQueueTask: (
    request: StartAssignedAgentQueueTaskRequest,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  getGitRepositoryStatus: (
    request: GetGitRepositoryStatusRequest,
  ) => Promise<GitRepositoryStatus | null>;
  createGitCommit: (
    request: CreateGitCommitRequest,
  ) => Promise<GitCommitResponse | null>;
  persistAgentChatProposal: (
    request: PersistAgentChatProposalRequest,
  ) => Promise<PersistAgentChatProposalResponse | null>;
  generateAgentChatAiProposal: (
    request: GenerateAgentChatAiProposalRequest,
  ) => Promise<GenerateAgentChatAiProposalResponse | null>;
  runTerminalCommand: (
    request: RunTerminalCommandRequest,
  ) => Promise<RunTerminalCommandResponse | null>;
  runCodexDirectWork: (
    request: RunCodexDirectWorkRequest,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  runDirectWorkValidation: (
    request: RunDirectWorkValidationRequest,
  ) => Promise<RunDirectWorkValidationResponse | null>;
  cancelCodexDirectWorkRun: (
    request: CancelCodexDirectWorkRunRequest,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  startCodexDirectWorkStream: (
    request: StartCodexDirectWorkStreamRequest,
  ) => Promise<StartCodexDirectWorkStreamResponse | null>;
  listenToDirectWorkStreamEvents: (
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<() => void>;
};

export function getWorkspaceApi(): WorkspaceApi {
  return isTauriRuntime() ? tauriWorkspaceApi : memoryWorkspaceApi;
}

export function createWorkspace(
  request: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return getWorkspaceApi().createWorkspace(
    normalizeCreateWorkspaceRequest(request),
  );
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return getWorkspaceApi().listWorkspaces();
}

export function deleteWorkspace(
  request: DeleteWorkspaceRequest,
): Promise<DeleteWorkspaceResponse> {
  return getWorkspaceApi().deleteWorkspace(request);
}

export function getWorkspaceSummary(
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  return getWorkspaceApi().getWorkspaceSummary(workspaceId);
}

export function openWorkspace(
  workspaceId: string,
): Promise<WorkspaceSessionSummary | null> {
  return getWorkspaceApi().openWorkspace(workspaceId);
}

export function getWorkspaceWorkbenchState(
  workspaceId: string,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().getWorkspaceWorkbenchState(workspaceId);
}

export function createWorkspaceNote(
  request: CreateWorkspaceNoteRequest,
): Promise<WorkspaceNote> {
  return getWorkspaceApi().createWorkspaceNote(request);
}

export function listWorkspaceNotes(
  request: ListWorkspaceNotesRequest,
): Promise<WorkspaceNote[]> {
  return getWorkspaceApi().listWorkspaceNotes(request);
}

export function getWorkspaceNote(
  request: GetWorkspaceNoteRequest,
): Promise<WorkspaceNote | null> {
  return getWorkspaceApi().getWorkspaceNote(request);
}

export function updateWorkspaceNote(
  request: UpdateWorkspaceNoteRequest,
): Promise<WorkspaceNote | null> {
  return getWorkspaceApi().updateWorkspaceNote(request);
}

export function addWidgetInstanceToWorkbench(
  request: AddWidgetInstanceToWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().addWidgetInstanceToWorkbench(request);
}

export function updateWidgetInstanceState(
  request: UpdateWidgetInstanceStateRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().updateWidgetInstanceState(request);
}

export function updateWidgetInstanceLayout(
  request: UpdateWidgetInstanceLayoutRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().updateWidgetInstanceLayout(request);
}

export function deleteWidgetInstanceFromWorkbench(
  request: DeleteWidgetInstanceFromWorkbenchRequest,
): Promise<WorkspaceWorkbenchState | null> {
  return getWorkspaceApi().deleteWidgetInstanceFromWorkbench(request);
}

export function listWidgetLogs(
  request: ListWidgetLogsRequest,
): Promise<WidgetLogEntry[]> {
  return getWorkspaceApi().listWidgetLogs(request);
}

export function listAgentExecutorRuns(
  request: ListAgentExecutorRunsRequest,
): Promise<AgentExecutorRunHistory | null> {
  return getWorkspaceApi().listAgentExecutorRuns(request);
}

export function getAgentExecutorRunDetail(
  request: GetAgentExecutorRunDetailRequest,
): Promise<AgentExecutorRunDetail | null> {
  return getWorkspaceApi().getAgentExecutorRunDetail(request);
}

export function getAgentExecutorDiffSummary(
  request: GetAgentExecutorDiffSummaryRequest,
): Promise<AgentExecutorDiffSummary | null> {
  return getWorkspaceApi().getAgentExecutorDiffSummary(request);
}

export function getAgentMonitoringSnapshot(
  request: GetAgentMonitoringSnapshotRequest,
): Promise<AgentMonitoringSnapshot | null> {
  return getWorkspaceApi().getAgentMonitoringSnapshot(request);
}

export function createAgentQueueItemFromProposal(
  request: CreateAgentQueueItemFromProposalRequest,
): Promise<AgentQueueItem | null> {
  return getWorkspaceApi().createAgentQueueItemFromProposal(request);
}

export function getAgentQueueSnapshot(
  request: GetAgentQueueSnapshotRequest,
): Promise<AgentQueueSnapshot | null> {
  return getWorkspaceApi().getAgentQueueSnapshot(request);
}

export function createAgentQueueTask(
  request: CreateAgentQueueTaskRequest,
): Promise<AgentQueueTask> {
  return getWorkspaceApi().createAgentQueueTask(request);
}

export function listAgentQueueTasks(
  request: ListAgentQueueTasksRequest,
): Promise<AgentQueueTask[]> {
  return getWorkspaceApi().listAgentQueueTasks(request);
}

export function getAgentQueueTask(
  request: GetAgentQueueTaskRequest,
): Promise<AgentQueueTask | null> {
  return getWorkspaceApi().getAgentQueueTask(request);
}

export function updateAgentQueueTask(
  request: UpdateAgentQueueTaskRequest,
): Promise<AgentQueueTask | null> {
  return getWorkspaceApi().updateAgentQueueTask(request);
}

export function assignAgentQueueTaskToExecutor(
  request: AssignAgentQueueTaskToExecutorRequest,
): Promise<AgentQueueTask> {
  return getWorkspaceApi().assignAgentQueueTaskToExecutor(request);
}

export function clearAgentQueueTaskAssignment(
  request: ClearAgentQueueTaskAssignmentRequest,
): Promise<AgentQueueTask> {
  return getWorkspaceApi().clearAgentQueueTaskAssignment(request);
}

export function startAssignedAgentQueueTask(
  request: StartAssignedAgentQueueTaskRequest,
): Promise<StartAssignedAgentQueueTaskResponse> {
  return getWorkspaceApi().startAssignedAgentQueueTask(request);
}

export function getGitRepositoryStatus(
  request: GetGitRepositoryStatusRequest,
): Promise<GitRepositoryStatus | null> {
  return getWorkspaceApi().getGitRepositoryStatus(request);
}

export function createGitCommit(
  request: CreateGitCommitRequest,
): Promise<GitCommitResponse | null> {
  return getWorkspaceApi().createGitCommit(request);
}

export function persistAgentChatProposal(
  request: PersistAgentChatProposalRequest,
): Promise<PersistAgentChatProposalResponse | null> {
  return getWorkspaceApi().persistAgentChatProposal(request);
}

export function generateAgentChatAiProposal(
  request: GenerateAgentChatAiProposalRequest,
): Promise<GenerateAgentChatAiProposalResponse | null> {
  return getWorkspaceApi().generateAgentChatAiProposal(request);
}

export function runTerminalCommand(
  request: RunTerminalCommandRequest,
): Promise<RunTerminalCommandResponse | null> {
  return getWorkspaceApi().runTerminalCommand(request);
}

export function runCodexDirectWork(
  request: RunCodexDirectWorkRequest,
): Promise<RunCodexDirectWorkResponse | null> {
  return getWorkspaceApi().runCodexDirectWork(request);
}

export function runDirectWorkValidation(
  request: RunDirectWorkValidationRequest,
): Promise<RunDirectWorkValidationResponse | null> {
  return getWorkspaceApi().runDirectWorkValidation(request);
}

export function cancelCodexDirectWorkRun(
  request: CancelCodexDirectWorkRunRequest,
): Promise<CancelCodexDirectWorkRunResponse | null> {
  return getWorkspaceApi().cancelCodexDirectWorkRun(request);
}

export function startCodexDirectWorkStream(
  request: StartCodexDirectWorkStreamRequest,
): Promise<StartCodexDirectWorkStreamResponse | null> {
  return getWorkspaceApi().startCodexDirectWorkStream(request);
}

export function listenToDirectWorkStreamEvents(
  onEvent: (event: DirectWorkStreamEvent) => void,
): Promise<() => void> {
  return getWorkspaceApi().listenToDirectWorkStreamEvents(onEvent);
}

function normalizeCreateWorkspaceRequest(
  request: CreateWorkspaceRequest,
): CreateWorkspaceRequest {
  return {
    title: request.title,
    description: request.description ?? null,
  };
}
