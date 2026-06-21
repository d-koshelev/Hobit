import type { CSSProperties, ReactNode } from "react";
import type {
  CreateJdbcConnectorRequest,
  JdbcConnector,
  UpdateJdbcConnectorRequest,
} from "../workspace/jdbcConnectorTypes";
import type {
  CheckJdbcSidecarHealthRequest,
  CreateJdbcConnectionProfileRequest,
  DeleteJdbcConnectionProfileRequest,
  ExecuteJdbcReadOnlyQueryRequest,
  JdbcConnectionProfile,
  JdbcReadOnlyQueryResult,
  JdbcReadOnlySqlValidation,
  JdbcSidecarDiagnostic,
  ProbeJdbcDriverRequest,
  UpdateJdbcConnectionProfileRequest,
  ValidateJdbcReadOnlySqlRequest,
} from "../workspace/jdbcQueryTypes";
import type {
  AgentExecutorDiffSummary,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentQueueRunnerSnapshot,
  AgentQueueReportActionCard,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerConfig,
  AttachKnowledgeToQueueTaskRequest,
  AttachSkillToQueueTaskRequest,
  AssignAgentQueueTaskToExecutorRequest,
  CancelCodexDirectWorkRunResponse,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  CreateAgentQueueWorkerRequest,
  CreateGitCommitRequest,
  CreateKnowledgeDocumentRequest,
  CreateSkillRequest,
  CreateWorkspaceNoteRequest,
  DeleteSkillRequest,
  DeleteKnowledgeDocumentRequest,
  DirectWorkStreamEvent,
  DeleteAgentQueueTaskRequest,
  DeleteAgentQueueWorkerRequest,
  DetachKnowledgeFromQueueTaskRequest,
  DetachSkillFromQueueTaskRequest,
  ForceKillCodexDirectWorkRunResponse,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
  GitCommitResponse,
  GitFileDiff,
  GitLog,
  GitRepositoryStatus,
  KnowledgeDocument,
  KnowledgeDraftReviewDecision,
  KnowledgeDocumentImportFile,
  KnowledgeDocumentSearchResult,
  ListKnowledgeDraftReviewsRequest,
  CreateTerminalPtySessionRequest,
  ListTerminalPtySessionsRequest,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  ResizeTerminalPtySessionRequest,
  ReadKnowledgeDocumentImportFileRequest,
  ReadPromptPackSourceRequest,
  SearchKnowledgeDocumentsRequest,
  RecordKnowledgeDraftReviewRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartAgentQueueRunnerSessionRequest,
  StartCodexDirectWorkStreamResponse,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateAgentQueueWorkerRequest,
  UpdateSkillRequest,
  UpdateKnowledgeDocumentRequest,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
  Skill,
  WriteTerminalPtySessionRequest,
} from "../workspace/types";
import type { AgentActivityEvent } from "./agentActivityModel";
import type { AgentProvider } from "./agentRuntime";
import type {
  PromptPackImportPreviewModel,
  PromptPackFileEntry,
  PromptPackMaterializationResult,
} from "./promptPack";
import type {
  AgentExecutorSlot,
  AgentQueueItemOpenRequest,
  AgentExecutorRunOpenRequest,
  AgentExecutorRunOpenRequestInput,
  CoordinatorAttachedContextInput,
  CoordinatorAttachedContextRequest,
  WorkspaceAgentQueueReportActionCardRequest,
  WorkspaceAgentQueueTaskStatusCardRequest,
  DirectWorkGitReviewRequest,
  DirectWorkGitReviewRequestInput,
  DirectWorkGitReviewStatus,
  DirectWorkQueueTaskAutoRefreshRequest,
  DirectWorkRunHandoff,
  DirectWorkRunHandoffInput,
  WidgetDefinition,
  WidgetInstance,
  WidgetInstanceId,
  WidgetLayout,
  WidgetLogEntry,
  WidgetState,
} from "./types";
import type { WorkspaceAgentQueueBridge } from "./workspaceAgentQueueBridge";
import type { WorkspaceAgentHobitActionInvoker } from "./workspaceAgentBrokerActionRuntime";
import type { AgentQueueController } from "./queue/useAgentQueueController";
import type {
  QueueValidationRunResult,
} from "./queue/queueValidationEvidenceService";
import type { ValidationRunner } from "./validation";
import type { QueueLinkedDirectWorkEvidenceIngestionCallback } from "./queueLinkedDirectWorkEvidenceWiring";

export type WidgetRenderProps = {
  agentActivityEvents?: AgentActivityEvent[];
  agentQueueController?: AgentQueueController;
  workspaceAgentProvider?: AgentProvider;
  agentExecutorSlots?: AgentExecutorSlot[];
  config: Record<string, unknown>;
  definition: WidgetDefinition;
  currentWorkspaceRoot?: string | null;
  directWorkGitReviewRequest?: DirectWorkGitReviewRequest | null;
  directWorkGitReviewStatus?: DirectWorkGitReviewStatus | null;
  directWorkRunHandoff?: DirectWorkRunHandoff | null;
  agentExecutorRunOpenRequest?: AgentExecutorRunOpenRequest | null;
  agentQueueItemOpenRequest?: AgentQueueItemOpenRequest | null;
  coordinatorAttachedContextRequest?: CoordinatorAttachedContextRequest | null;
  queueReportActionCardRequest?: WorkspaceAgentQueueReportActionCardRequest | null;
  queueTaskStatusCardRequest?: WorkspaceAgentQueueTaskStatusCardRequest | null;
  frameActions?: ReactNode;
  frameMoveEnabled?: boolean;
  frameStyle?: CSSProperties;
  hasGitWidget?: boolean;
  instance: WidgetInstance;
  logRefreshToken?: number;
  onAssignAgentQueueTaskToExecutor?: (
    request: Omit<AssignAgentQueueTaskToExecutorRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onAttachToCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<
    | (StartCodexDirectWorkStreamResponse & {
        stopListening: () => void;
      })
    | null
  >;
  onCancelCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<CancelCodexDirectWorkRunResponse | null>;
  onForceKillCodexDirectWorkRun?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<ForceKillCodexDirectWorkRunResponse | null>;
  onClearAgentQueueTaskAssignment?: (
    request: Omit<ClearAgentQueueTaskAssignmentRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onCreateAgentQueueTask?: (
    request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onDeleteAgentQueueTask?: (
    request: Omit<DeleteAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<boolean>;
  onAttachKnowledgeToQueueTask?: (
    request: Omit<AttachKnowledgeToQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onDetachKnowledgeFromQueueTask?: (
    request: Omit<DetachKnowledgeFromQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onAttachSkillToQueueTask?: (
    request: Omit<AttachSkillToQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onDetachSkillFromQueueTask?: (
    request: Omit<DetachSkillFromQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  onListAgentQueueWorkers?: () => Promise<AgentQueueWorkerConfig[]>;
  onCreateAgentQueueWorker?: (
    request: Omit<CreateAgentQueueWorkerRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkerConfig>;
  onUpdateAgentQueueWorker?: (
    request: Omit<UpdateAgentQueueWorkerRequest, "workspaceId">,
  ) => Promise<AgentQueueWorkerConfig | null>;
  onDeleteAgentQueueWorker?: (
    request: Omit<DeleteAgentQueueWorkerRequest, "workspaceId">,
  ) => Promise<boolean>;
  onCreateGitCommit?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      CreateGitCommitRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<GitCommitResponse | null>;
  onCreateJdbcConnector?: (
    request: Omit<CreateJdbcConnectorRequest, "workspaceId">,
  ) => Promise<JdbcConnector>;
  onCreateJdbcConnectionProfile?: (
    request: Omit<CreateJdbcConnectionProfileRequest, "workspaceId">,
  ) => Promise<JdbcConnectionProfile>;
  onDeleteJdbcConnectionProfile?: (
    request: Omit<DeleteJdbcConnectionProfileRequest, "workspaceId">,
  ) => Promise<boolean>;
  onCheckJdbcSidecarHealth?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      CheckJdbcSidecarHealthRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<JdbcSidecarDiagnostic>;
  onExecuteJdbcReadOnlyQuery?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      ExecuteJdbcReadOnlyQueryRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<JdbcReadOnlyQueryResult>;
  onCreateWorkspaceNote?: (
    request: Omit<CreateWorkspaceNoteRequest, "workspaceId">,
  ) => Promise<WorkspaceNote>;
  onCreateSkill?: (
    request: Omit<CreateSkillRequest, "workspaceId">,
  ) => Promise<Skill>;
  onDeleteSkill?: (
    request: Omit<DeleteSkillRequest, "workspaceId">,
  ) => Promise<boolean>;
  onCreateKnowledgeDocument?: (
    request: Omit<CreateKnowledgeDocumentRequest, "workspaceId">,
  ) => Promise<KnowledgeDocument>;
  onDeleteKnowledgeDocument?: (
    request: Omit<DeleteKnowledgeDocumentRequest, "workspaceId">,
  ) => Promise<boolean>;
  onGenerateCoordinatorProviderResponse?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      GenerateCoordinatorProviderResponseRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<GenerateCoordinatorProviderResponse | null>;
  onDirectWorkGitReviewRequested?: (
    request: DirectWorkGitReviewRequestInput,
  ) => void;
  onDirectWorkGitReviewStatusChange?: (
    status: DirectWorkGitReviewStatus,
  ) => void;
  onDirectWorkRunHandoffFinalState?: (
    handoff: DirectWorkRunHandoff,
    finalStatus: string,
  ) => void;
  onIngestQueueLinkedDirectWorkEvidence?: QueueLinkedDirectWorkEvidenceIngestionCallback;
  onDirectWorkRunHandoffStarted?: (
    handoff: DirectWorkRunHandoffInput,
  ) => void;
  onGetAgentExecutorDiffSummary?: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<AgentExecutorDiffSummary | null>;
  onGetAgentExecutorRunDetail?: (
    widgetInstanceId: WidgetInstanceId,
    runId: string,
  ) => Promise<AgentExecutorRunDetail | null>;
  onListenToDirectWorkStreamEvents?: (
    onEvent: (event: DirectWorkStreamEvent) => void,
  ) => Promise<() => void>;
  onGetAgentQueueTask?: (
    queueItemId: string,
  ) => Promise<AgentQueueTask | null>;
  onGetAgentQueueTaskLatestRunLink?: (
    queueItemId: string,
  ) => Promise<AgentQueueTaskRunLinkSummary | null>;
  onListAgentQueueTaskRunLinks?: (
    queueItemId: string,
  ) => Promise<AgentQueueTaskRunLinkSummary[]>;
  onGetGitRepositoryStatus?: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitRepositoryStatus | null>;
  onGetGitFileDiff?: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
    path: string,
  ) => Promise<GitFileDiff | null>;
  onGetGitLog?: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitLog | null>;
  onGetJdbcConnector?: (connectorId: string) => Promise<JdbcConnector | null>;
  onGetWorkspaceNote?: (noteId: string) => Promise<WorkspaceNote | null>;
  onGetSkill?: (skillId: string) => Promise<Skill | null>;
  onGetKnowledgeDocument?: (
    knowledgeDocumentId: string,
  ) => Promise<KnowledgeDocument | null>;
  onListAgentExecutorRuns?: (
    widgetInstanceId: WidgetInstanceId,
    limit?: number,
  ) => Promise<AgentExecutorRunHistory | null>;
  onListAgentQueueTasks?: () => Promise<AgentQueueTask[]>;
  onListJdbcConnectors?: () => Promise<JdbcConnector[]>;
  onListJdbcConnectionProfiles?: () => Promise<JdbcConnectionProfile[]>;
  onProbeJdbcDriver?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      ProbeJdbcDriverRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<JdbcSidecarDiagnostic>;
  onListWorkspaceNotes?: () => Promise<WorkspaceNote[]>;
  onListSkills?: () => Promise<Skill[]>;
  onListKnowledgeDocuments?: () => Promise<KnowledgeDocument[]>;
  onReadKnowledgeDocumentImportFile?: (
    request: ReadKnowledgeDocumentImportFileRequest,
  ) => Promise<KnowledgeDocumentImportFile>;
  onLoadLogs?: (widgetInstanceId: WidgetInstanceId) => Promise<WidgetLogEntry[]>;
  onOpenAgentExecutorRun?: (
    request: AgentExecutorRunOpenRequestInput,
  ) => void;
  onRunCodexDirectWork?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      RunCodexDirectWorkRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<RunCodexDirectWorkResponse | null>;
  onRunDirectWorkValidation?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      RunDirectWorkValidationRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<RunDirectWorkValidationResponse | null>;
  onRunTerminalCommand?: (
    widgetInstanceId: WidgetInstanceId,
    command: Omit<
      RunTerminalCommandRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<RunTerminalCommandResponse | null>;
  onCreateTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      CreateTerminalPtySessionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onWriteTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      WriteTerminalPtySessionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onResizeTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      ResizeTerminalPtySessionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onStopTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      TerminalPtySessionActionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onKillTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      TerminalPtySessionActionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onCloseTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      TerminalPtySessionActionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onGetTerminalPtySession?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      TerminalPtySessionActionRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<TerminalPtySession | null>;
  onListTerminalPtySessions?: (
    request?: Omit<ListTerminalPtySessionsRequest, "workspaceId" | "workbenchId">,
  ) => Promise<TerminalPtySession[]>;
  onAttachContextToCoordinator?: (
    request: CoordinatorAttachedContextInput,
  ) => void;
  onAttachKnowledgeContextToQueueTask?: AgentQueueController["knowledgeContext"]["onAttachSelected"];
  onShowQueueReportInWorkspaceChat?: (
    card: AgentQueueReportActionCard,
  ) => void;
  onShowQueueTaskInWorkspaceChat?: (task: AgentQueueTask) => void;
  onOpenAgentQueueItem?: (queueItemId: string) => void;
  onInvokeHobitAgentActionRequest?: WorkspaceAgentHobitActionInvoker;
  onPublishAgentActivityEvents?: (events: AgentActivityEvent[]) => void;
  onSelectWorkspaceDirectory?: () => Promise<string | null>;
  onReadPromptPackSource?: (
    request: ReadPromptPackSourceRequest,
  ) => Promise<PromptPackFileEntry[]>;
  createQueueItemsFromPromptPackPreview?: (
    preview: PromptPackImportPreviewModel,
    options?: { currentWorkspaceRoot?: string | null },
  ) => Promise<PromptPackMaterializationResult>;
  workspaceAgentQueueBridge?: WorkspaceAgentQueueBridge;
  queueValidationRunner?: ValidationRunner | null;
  onRequestQueueValidation?: (
    task: AgentQueueTask,
    runner: ValidationRunner,
  ) => Promise<QueueValidationRunResult>;
  onStartAssignedAgentQueueTask?: (
    request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  onStartAgentQueueRunnerSession?: (
    request: Omit<StartAgentQueueRunnerSessionRequest, "workspaceId">,
  ) => Promise<AgentQueueRunnerSnapshot>;
  onStopAgentQueueRunnerSession?: () => Promise<AgentQueueRunnerSnapshot>;
  onGetAgentQueueRunnerSnapshot?: () => Promise<AgentQueueRunnerSnapshot>;
  onStartCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      RunCodexDirectWorkRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
    onEvent: (event: DirectWorkStreamEvent) => void,
    signal?: AbortSignal,
  ) => Promise<
    | (StartCodexDirectWorkStreamResponse & {
        stopListening: () => void;
      })
    | null
  >;
  onStartFrameMove?: (pointerX: number, pointerY: number) => void;
  onUpdateAgentQueueTask?: (
    request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask | null>;
  onUpdateJdbcConnector?: (
    request: Omit<UpdateJdbcConnectorRequest, "workspaceId">,
  ) => Promise<JdbcConnector | null>;
  onUpdateJdbcConnectionProfile?: (
    request: Omit<UpdateJdbcConnectionProfileRequest, "workspaceId">,
  ) => Promise<JdbcConnectionProfile | null>;
  onValidateJdbcReadOnlySql?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      ValidateJdbcReadOnlySqlRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<JdbcReadOnlySqlValidation>;
  onUpdateLayout?: (
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) => Promise<void>;
  onUpdateState?: (
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) => Promise<void>;
  onUpdateWorkspaceNote?: (
    request: Omit<UpdateWorkspaceNoteRequest, "workspaceId">,
  ) => Promise<WorkspaceNote | null>;
  onUpdateSkill?: (
    request: Omit<UpdateSkillRequest, "workspaceId">,
  ) => Promise<Skill | null>;
  onUpdateKnowledgeDocument?: (
    request: Omit<UpdateKnowledgeDocumentRequest, "workspaceId">,
  ) => Promise<KnowledgeDocument | null>;
  onSearchKnowledgeDocuments?: (
    request: Omit<SearchKnowledgeDocumentsRequest, "workspaceId">,
  ) => Promise<KnowledgeDocumentSearchResult[]>;
  onRecordKnowledgeDraftReview?: (
    request: Omit<RecordKnowledgeDraftReviewRequest, "workspaceId">,
  ) => Promise<KnowledgeDraftReviewDecision>;
  onListKnowledgeDraftReviews?: (
    request: Omit<ListKnowledgeDraftReviewsRequest, "workspaceId">,
  ) => Promise<KnowledgeDraftReviewDecision[]>;
  queueTaskAutoRefreshRequest?: DirectWorkQueueTaskAutoRefreshRequest | null;
  title: string;
  workspaceId?: string;
};
