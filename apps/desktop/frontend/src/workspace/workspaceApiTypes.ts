import type {
  CreateJdbcConnectorRequest,
  GetJdbcConnectorRequest,
  JdbcConnector,
  ListJdbcConnectorsRequest,
  UpdateJdbcConnectorRequest,
} from "./jdbcConnectorTypes";
import type {
  CheckJdbcSidecarHealthRequest,
  ExecuteJdbcReadOnlyQueryRequest,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
  ProbeJdbcDriverRequest,
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
  CreateKnowledgeDocumentRequest,
  CreateWorkspaceNoteRequest,
  CreateSkillRequest,
  CreateWorkspaceRequest,
  CreateTerminalPtySessionRequest,
  DeleteAgentQueueTaskRequest,
  DeleteKnowledgeDocumentRequest,
  DeleteWidgetInstanceFromWorkbenchRequest,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  DeleteSkillRequest,
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
  GetGitFileDiffRequest,
  GetGitLogRequest,
  GetGitRepositoryStatusRequest,
  GetKnowledgeDocumentRequest,
  GetWorkspaceNoteRequest,
  GetSkillRequest,
  GitCommitResponse,
  GitFileDiff,
  GitLog,
  GitRepositoryStatus,
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
  ListAgentExecutorRunsRequest,
  ListAgentQueueTaskRunLinksRequest,
  ListAgentQueueTasksRequest,
  ListKnowledgeDocumentsRequest,
  ListTerminalPtySessionsRequest,
  ListWorkspaceNotesRequest,
  ListSkillsRequest,
  ListWidgetLogsRequest,
  PersistAgentChatProposalRequest,
  PersistAgentChatProposalResponse,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  SearchKnowledgeDocumentsRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  StartCodexDirectWorkStreamRequest,
  StartCodexDirectWorkStreamResponse,
  ResizeTerminalPtySessionRequest,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateKnowledgeDocumentRequest,
  UpdateWidgetInstanceLayoutRequest,
  UpdateWidgetInstanceStateRequest,
  UpdateWorkspaceNoteRequest,
  UpdateSkillRequest,
  WidgetLogEntry,
  WriteTerminalPtySessionRequest,
  WorkspaceNote,
  Skill,
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
  selectWorkspaceDirectory: () => Promise<string | null>;
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
  createSkill: (request: CreateSkillRequest) => Promise<Skill>;
  listSkills: (request: ListSkillsRequest) => Promise<Skill[]>;
  getSkill: (request: GetSkillRequest) => Promise<Skill | null>;
  updateSkill: (request: UpdateSkillRequest) => Promise<Skill | null>;
  deleteSkill: (request: DeleteSkillRequest) => Promise<boolean>;
  createKnowledgeDocument: (
    request: CreateKnowledgeDocumentRequest,
  ) => Promise<KnowledgeDocument>;
  listKnowledgeDocuments: (
    request: ListKnowledgeDocumentsRequest,
  ) => Promise<KnowledgeDocument[]>;
  getKnowledgeDocument: (
    request: GetKnowledgeDocumentRequest,
  ) => Promise<KnowledgeDocument | null>;
  updateKnowledgeDocument: (
    request: UpdateKnowledgeDocumentRequest,
  ) => Promise<KnowledgeDocument | null>;
  deleteKnowledgeDocument: (
    request: DeleteKnowledgeDocumentRequest,
  ) => Promise<boolean>;
  searchKnowledgeDocuments: (
    request: SearchKnowledgeDocumentsRequest,
  ) => Promise<KnowledgeDocumentSearchResult[]>;
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
  checkJdbcSidecarHealth: (
    request: CheckJdbcSidecarHealthRequest,
  ) => Promise<JdbcSidecarDiagnostic>;
  probeJdbcDriver: (
    request: ProbeJdbcDriverRequest,
  ) => Promise<JdbcSidecarDiagnostic>;
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
  listAgentQueueTaskRunLinks: (
    request: ListAgentQueueTaskRunLinksRequest,
  ) => Promise<AgentQueueTaskRunLinkSummary[]>;
  startAgentQueueRunnerSession: (
    request: StartAgentQueueRunnerSessionRequest,
  ) => Promise<AgentQueueRunnerSnapshot>;
  stopAgentQueueRunnerSession: () => Promise<AgentQueueRunnerSnapshot>;
  getAgentQueueRunnerSnapshot: () => Promise<AgentQueueRunnerSnapshot>;
  getGitRepositoryStatus: (
    request: GetGitRepositoryStatusRequest,
  ) => Promise<GitRepositoryStatus | null>;
  getGitFileDiff: (
    request: GetGitFileDiffRequest,
  ) => Promise<GitFileDiff | null>;
  getGitLog: (request: GetGitLogRequest) => Promise<GitLog | null>;
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
