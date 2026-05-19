import type { CSSProperties, ReactNode } from "react";
import type {
  CreateJdbcConnectorRequest,
  JdbcConnector,
  UpdateJdbcConnectorRequest,
} from "../workspace/jdbcConnectorTypes";
import type {
  AgentExecutorDiffSummary,
  AgentExecutorRunDetail,
  AgentExecutorRunHistory,
  AgentQueueTask,
  AssignAgentQueueTaskToExecutorRequest,
  CancelCodexDirectWorkRunResponse,
  ClearAgentQueueTaskAssignmentRequest,
  CreateAgentQueueTaskRequest,
  CreateGitCommitRequest,
  CreateWorkspaceNoteRequest,
  DirectWorkStreamEvent,
  ForceKillCodexDirectWorkRunResponse,
  GenerateCoordinatorProviderResponse,
  GenerateCoordinatorProviderResponseRequest,
  GitCommitResponse,
  GitRepositoryStatus,
  CreateTerminalPtySessionRequest,
  ListTerminalPtySessionsRequest,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  ResizeTerminalPtySessionRequest,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartCodexDirectWorkStreamResponse,
  TerminalPtySession,
  TerminalPtySessionActionRequest,
  UpdateAgentQueueTaskRequest,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
  WriteTerminalPtySessionRequest,
} from "../workspace/types";
import type {
  AgentExecutorSlot,
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

export type WidgetRenderProps = {
  agentExecutorSlots?: AgentExecutorSlot[];
  config: Record<string, unknown>;
  definition: WidgetDefinition;
  directWorkGitReviewRequest?: DirectWorkGitReviewRequest | null;
  directWorkGitReviewStatus?: DirectWorkGitReviewStatus | null;
  directWorkRunHandoff?: DirectWorkRunHandoff | null;
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
  onCreateWorkspaceNote?: (
    request: Omit<CreateWorkspaceNoteRequest, "workspaceId">,
  ) => Promise<WorkspaceNote>;
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
  onGetAgentQueueTask?: (
    queueItemId: string,
  ) => Promise<AgentQueueTask | null>;
  onGetGitRepositoryStatus?: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitRepositoryStatus | null>;
  onGetJdbcConnector?: (connectorId: string) => Promise<JdbcConnector | null>;
  onGetWorkspaceNote?: (noteId: string) => Promise<WorkspaceNote | null>;
  onListAgentExecutorRuns?: (
    widgetInstanceId: WidgetInstanceId,
    limit?: number,
  ) => Promise<AgentExecutorRunHistory | null>;
  onListAgentQueueTasks?: () => Promise<AgentQueueTask[]>;
  onListJdbcConnectors?: () => Promise<JdbcConnector[]>;
  onListWorkspaceNotes?: () => Promise<WorkspaceNote[]>;
  onLoadLogs?: (widgetInstanceId: WidgetInstanceId) => Promise<WidgetLogEntry[]>;
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
  onStartAssignedAgentQueueTask?: (
    request: Omit<StartAssignedAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<StartAssignedAgentQueueTaskResponse>;
  onStartCodexDirectWorkStream?: (
    widgetInstanceId: WidgetInstanceId,
    request: Omit<
      RunCodexDirectWorkRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
    onEvent: (event: DirectWorkStreamEvent) => void,
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
  queueTaskAutoRefreshRequest?: DirectWorkQueueTaskAutoRefreshRequest | null;
  title: string;
};
