import type {
  CreateJdbcConnectorRequest,
  GetJdbcConnectorRequest,
  JdbcConnector,
  ListJdbcConnectorsRequest,
  UpdateJdbcConnectorRequest,
} from "./jdbcConnectorTypes";
import type {
  ExecuteJdbcReadOnlyQueryRequest,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  ValidateJdbcReadOnlySqlRequest,
} from "./jdbcQueryTypes";
import type {
  AddWidgetInstanceToWorkbenchRequest,
  AgentExecutorDiffSummary,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentMonitoringSnapshot,
  AgentQueueItem,
  AgentQueueRunnerSnapshot,
  AgentQueueSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AssignAgentQueueTaskToExecutorRequest,
  CancelCodexDirectWorkRunRequest,
  CancelCodexDirectWorkRunResponse,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueItemFromProposalRequest,
  CreateAgentQueueTaskRequest,
  CreateGitCommitRequest,
  CreateWorkspaceNoteRequest,
  CreateWorkspaceRequest,
  CreateTerminalPtySessionRequest,
  DeleteAgentQueueTaskRequest,
  DeleteWidgetInstanceFromWorkbenchRequest,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  DirectWorkStreamEvent,
  ForceKillCodexDirectWorkRunRequest,
  ForceKillCodexDirectWorkRunResponse,
  GenerateAgentChatAiProposalRequest,
  GenerateAgentChatAiProposalResponse,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
  GetAgentExecutorDiffSummaryRequest,
  GetAgentExecutorRunDetailRequest,
  GetAgentMonitoringSnapshotRequest,
  GetAgentQueueSnapshotRequest,
  GetAgentQueueTaskLatestRunLinkRequest,
  GetAgentQueueTaskRequest,
  GetGitRepositoryStatusRequest,
  GetWorkspaceNoteRequest,
  GitCommitResponse,
  GitRepositoryStatus,
  ListAgentExecutorRunsRequest,
  ListAgentQueueTasksRequest,
  ListTerminalPtySessionsRequest,
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
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  StartCodexDirectWorkStreamRequest,
  StartCodexDirectWorkStreamResponse,
  ResizeTerminalPtySessionRequest,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  UpdateWorkspaceNoteRequest,
  WidgetLogEntry,
  WriteTerminalPtySessionRequest,
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
  createJdbcConnector: (
    request: CreateJdbcConnectorRequest,
  ) => Promise<JdbcConnector>;
  listJdbcConnectors: (
    request: ListJdbcConnectorsRequest,
  ) => Promise<JdbcConnector[]>;
  getJdbcConnector: (
    request: GetJdbcConnectorRequest,
  ) => Promise<JdbcConnector | null>;
  updateJdbcConnector: (
    request: UpdateJdbcConnectorRequest,
  ) => Promise<JdbcConnector | null>;
  validateJdbcReadOnlySql: (
    request: ValidateJdbcReadOnlySqlRequest,
  ) => Promise<JdbcReadOnlySqlValidation>;
  executeJdbcReadOnlyQuery: (
    request: ExecuteJdbcReadOnlyQueryRequest,
  ) => Promise<JdbcReadOnlyQueryResult>;
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
  deleteAgentQueueTask: (
    request: DeleteAgentQueueTaskRequest,
  ) => Promise<boolean>;
  assignAgentQueueTaskToExecutor: (
    request: AssignAgentQueueTaskToExecutorRequest,
  ) => Promise<AgentQueueTask>;
  clearAgentQueueTaskAssignment: (
    request: ClearAgentQueueTaskAssignmentRequest,
  ) => Promise<AgentQueueTask>;
  startAssignedAgentQueueTask: (
    request: StartAssignedAgentQueueTaskRequest,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  getAgentQueueTaskLatestRunLink: (
    request: GetAgentQueueTaskLatestRunLinkRequest,
  ) => Promise<AgentQueueTaskRunLinkSummary | null>;
  startAgentQueueRunnerSession: (
    request: StartAgentQueueRunnerSessionRequest,
  ) => Promise<AgentQueueRunnerSnapshot>;
  stopAgentQueueRunnerSession: () => Promise<AgentQueueRunnerSnapshot>;
  getAgentQueueRunnerSnapshot: () => Promise<AgentQueueRunnerSnapshot>;
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
  generateCoordinatorProviderResponse: (
    request: GenerateCoordinatorProviderResponseRequest,
  ) => Promise<GenerateCoordinatorProviderResponse | null>;
  runTerminalCommand: (
    request: RunTerminalCommandRequest,
  ) => Promise<RunTerminalCommandResponse | null>;
  createTerminalPtySession: (
    request: CreateTerminalPtySessionRequest,
  ) => Promise<TerminalPtySession | null>;
  writeTerminalPtySession: (
    request: WriteTerminalPtySessionRequest,
  ) => Promise<TerminalPtySession | null>;
  resizeTerminalPtySession: (
    request: ResizeTerminalPtySessionRequest,
  ) => Promise<TerminalPtySession | null>;
  stopTerminalPtySession: (
    request: TerminalPtySessionActionRequest,
  ) => Promise<TerminalPtySession | null>;
  killTerminalPtySession: (
    request: TerminalPtySessionActionRequest,
  ) => Promise<TerminalPtySession | null>;
  closeTerminalPtySession: (
    request: TerminalPtySessionActionRequest,
  ) => Promise<TerminalPtySession | null>;
  getTerminalPtySession: (
    request: TerminalPtySessionActionRequest,
  ) => Promise<TerminalPtySession | null>;
  listTerminalPtySessions: (
    request: ListTerminalPtySessionsRequest,
  ) => Promise<TerminalPtySession[]>;
  runCodexDirectWork: (
    request: RunCodexDirectWorkRequest,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  runDirectWorkValidation: (
    request: RunDirectWorkValidationRequest,
  ) => Promise<RunDirectWorkValidationResponse | null>;
  cancelCodexDirectWorkRun: (
    request: CancelCodexDirectWorkRunRequest,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  forceKillCodexDirectWorkRun: (
    request: ForceKillCodexDirectWorkRunRequest,
  ) => Promise<ForceKillCodexDirectWorkRunResponse | null>;
  startCodexDirectWorkStream: (
    request: StartCodexDirectWorkStreamRequest,
  ) => Promise<StartCodexDirectWorkStreamResponse | null>;
  listenToDirectWorkStreamEvents: (
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<() => void>;
};
