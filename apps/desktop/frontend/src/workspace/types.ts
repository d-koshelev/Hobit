export type CreateWorkspaceRequest = {
  title: string;
  description?: string | null;
};

export type AddWidgetInstanceToWorkbenchRequest = {
  workspaceId: string;
  workbenchId: string;
  definitionId: string;
  title: string;
  category: string;
};

export type UpdateWidgetInstanceStateRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  state: string;
};

export type WidgetInstanceLayoutUpdate = {
  layoutMode: string;
  dockX: number | null;
  dockY: number | null;
  dockWidth: number | null;
  dockHeight: number | null;
  popoutX: number | null;
  popoutY: number | null;
  popoutWidth: number | null;
  popoutHeight: number | null;
  alwaysOnTop: boolean;
  isVisible: boolean;
};

export type UpdateWidgetInstanceLayoutRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  layout: WidgetInstanceLayoutUpdate;
};

export type DeleteWidgetInstanceFromWorkbenchRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
};

export type ListWidgetLogsRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  limit: number;
};

export type GetAgentMonitoringSnapshotRequest = {
  workspaceId: string;
  workbenchId: string;
};

export type CreateAgentQueueItemFromProposalRequest = {
  workspaceId: string;
  workbenchId: string;
  sourceRunId: string;
  sourceResultId: string;
};

export type GetAgentQueueSnapshotRequest = {
  workspaceId: string;
  workbenchId: string;
};

export type GetGitRepositoryStatusRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repositoryRoot: string;
};

export type RunTerminalCommandRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  program: string;
  args: string[];
  workingDirectory: string;
  timeoutMs?: number | null;
  stdoutCapBytes?: number | null;
  stderrCapBytes?: number | null;
};

export type DirectWorkSandbox = "read_only" | "workspace_write";

export type DirectWorkApprovalPolicy = "never" | "on_request" | "untrusted";

export type RunCodexDirectWorkRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  codexExecutable: string;
  repoRoot: string;
  operatorPrompt: string;
  sandbox: DirectWorkSandbox;
  approvalPolicy: DirectWorkApprovalPolicy;
  timeoutMs?: number | null;
  stdoutCapBytes?: number | null;
  stderrCapBytes?: number | null;
};

export type DirectWorkValidationProfile = "fast" | "changed" | "full";

export type RunDirectWorkValidationRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  repoRoot: string;
  validationProfile: DirectWorkValidationProfile;
  timeoutMs?: number | null;
  stdoutCapBytes?: number | null;
  stderrCapBytes?: number | null;
};

export type CancelCodexDirectWorkRunRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  runId: string;
};

export type CancelCodexDirectWorkRunResponse = {
  runId: string;
  status: string;
  message: string;
  cancellationRequested: boolean;
};

export type StartCodexDirectWorkStreamRequest = RunCodexDirectWorkRequest;

export type DirectWorkStreamEventKind =
  | "started"
  | "stdout_line"
  | "stderr_line"
  | "codex_json_event"
  | "final_message"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type DirectWorkStreamEvent = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  runId: string;
  eventKind: DirectWorkStreamEventKind;
  line: string | null;
  text: string | null;
  parsedCodexEventType: string | null;
  status: string | null;
  elapsedMs: number;
  isFinal: boolean;
  errorMessage: string | null;
  stderrPreview: string | null;
  exitCode: number | null;
  finalStatus: string | null;
  failedStage: string | null;
};

export type StartCodexDirectWorkStreamResponse = {
  runId: string;
  status: string;
};

export type PersistAgentChatProposalRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  operatorPrompt: string;
  approvedContextSnapshotJson: string;
  proposal: AgentChatProposalPersistPayload;
};

export type GenerateAgentChatAiProposalRequest = {
  workspaceId: string;
  workbenchId: string;
  widgetInstanceId: string;
  operatorPrompt: string;
  approvedContextSnapshotJson: string;
};

export type AgentChatProposalPersistPayload = {
  actionProposals: AgentChatProposalActionPersistPayload[];
  contextNeeded: string[];
  id: string;
  proposedPlan: string[];
  requestSummary: string;
  runtimeNotes: string[];
  safetyNotes: string[];
};

export type AgentChatProposalActionPersistPayload = {
  description: string;
  title: string;
};

export type RunTerminalCommandResponse = {
  runId: string;
  status: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
  errorMessage: string | null;
};

export type RunCodexDirectWorkResponse = {
  runId: string;
  resultId: string;
  resultType: string;
  executorKind: string;
  mode: string;
  repoRoot: string;
  sandbox: DirectWorkSandbox;
  approvalPolicy: DirectWorkApprovalPolicy;
  commandSummary: string[];
  status: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  finalMessage: string | null;
  durationMs: number;
  errorMessage: string | null;
  noAutoCommit: boolean;
  noAutoPush: boolean;
  gitMutationsPerformedByHobit: boolean;
};

export type RunDirectWorkValidationResponse = {
  runId: string;
  resultId: string;
  resultType: string;
  profile: DirectWorkValidationProfile;
  status: string;
  runStatus: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  durationMs: number;
  errorMessage: string | null;
  commandSummary: string[];
  repoRoot: string;
  noGitMutations: boolean;
  noCommitPush: boolean;
  gitMutationsPerformedByHobit: boolean;
};

export type PersistAgentChatProposalResponse = {
  runId: string;
  status: string;
  resultId: string;
  resultType: string;
  summary: string;
};

export type GenerateAgentChatAiProposalResponse = {
  run: PersistAgentChatProposalResponse;
  proposal: AgentChatProposalPersistPayload;
  runtimeStatus: string;
  providerStatus: string;
  providerUsed: boolean;
  providerResponseReceived: boolean;
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  contextWasApproved: boolean;
  normalizationWarnings: string[];
};

export type AgentMonitoringSnapshot = {
  workspaceId: string;
  workbenchId: string;
  proposalResults: AgentMonitoringProposalResult[];
};

export type AgentMonitoringProposalResult = {
  runId: string;
  resultId: string;
  status: string;
  resultType: string;
  resultSummary: string | null;
  resultContent: string | null;
  runStartedAt: string;
  runFinishedAt: string | null;
  resultCreatedAt: string;
  sourceWidgetId: string;
  sourceWidgetTitle: string;
  runtimeStatus: string;
  providerStatus: string;
  providerUsed: boolean;
  providerResponseReceived: boolean;
  noLlmCalled: boolean;
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  contextWasApproved: boolean;
  operatorPrompt: string;
  proposalSummary: string;
  proposedPlan: string[];
  contextNeeded: string[];
  approvedContextSummary: string;
  approvedContextStatus: string;
  approvedContextSourceLabels: string[];
  proposedActions: AgentMonitoringProposalAction[];
  safetyNotes: string[];
  rawPayload: string;
};

export type AgentMonitoringProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

export type AgentQueueSnapshot = {
  workspaceId: string;
  workbenchId: string;
  items: AgentQueueItem[];
};

export type AgentQueueItem = {
  id: string;
  workspaceId: string;
  workbenchId: string;
  sourceRunId: string;
  sourceResultId: string;
  sourceWidgetInstanceId: string;
  sourceWidgetTitle: string;
  title: string;
  status: string;
  decisionStatus: string;
  promptSummary: string;
  proposalSummary: string;
  approvedContextSummary: string;
  proposedPlan: string[];
  proposedActions: AgentQueueProposalAction[];
  proposalOnlyMock: boolean;
  noLlmCalled: boolean;
  noToolsExecuted: boolean;
  noMutationsPerformed: boolean;
  createdAt: string;
  updatedAt: string;
  payloadJson: string;
};

export type AgentQueueProposalAction = {
  title: string;
  description: string;
  status: string;
  executed: boolean;
};

export type WidgetLogEntry = {
  id: string;
  widgetInstanceId: string;
  runId: string | null;
  level: string;
  message: string;
  payload: string | null;
  createdAt: string;
};

export type WorkspaceSummary = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workbenchId: string | null;
};

export type WorkspaceSessionSummary = {
  id: string;
  workspaceId: string;
  status: string;
  activeWidgetId: string | null;
};

export type WorkspaceWorkbenchState = {
  workspace: WorkspaceSummary;
  workbench: WorkbenchSummary | null;
  widgetInstances: WorkspaceWidgetInstanceSummary[];
  sharedStateObjects: WorkspaceSharedStateObjectSummary[];
  recentEvents: WorkspaceEventSummary[];
};

export type WorkbenchSummary = {
  id: string;
  workspaceId: string;
  presetOriginId: string | null;
};

export type WorkspaceWidgetInstanceSummary = {
  id: string;
  definitionId: string;
  title: string;
  category: string;
  layoutMode: string;
  dockX: number | null;
  dockY: number | null;
  dockWidth: number | null;
  dockHeight: number | null;
  popoutX: number | null;
  popoutY: number | null;
  popoutWidth: number | null;
  popoutHeight: number | null;
  alwaysOnTop: boolean;
  isVisible: boolean;
  config: string | null;
  state: string | null;
};

export type WorkspaceSharedStateObjectSummary = {
  id: string;
  key: string;
  value: string;
  valueKind: string;
};

export type WorkspaceEventSummary = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
};

export type GitRepositoryStatus = {
  branch: GitBranchStatus | null;
  workingTree: GitWorkingTreeStatus;
  changedFiles: GitFileChange[];
  lastCommit: GitLastCommit | null;
  warnings: string[];
};

export type GitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  isDetached: boolean;
};

export type GitWorkingTreeStatus = {
  isClean: boolean;
  isDirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type GitFileChange = {
  area: string;
  kind: string;
  path: string;
  originalPath: string | null;
};

export type GitLastCommit = {
  hash: string;
  title: string;
  author: string | null;
  committedAt: string | null;
};
