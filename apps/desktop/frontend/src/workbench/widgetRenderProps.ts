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
  GitCommitResponse,
  GitRepositoryStatus,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
  StartAssignedAgentQueueTaskRequest,
  StartAssignedAgentQueueTaskResponse,
  StartCodexDirectWorkStreamResponse,
  UpdateAgentQueueTaskRequest,
  UpdateWorkspaceNoteRequest,
  WorkspaceNote,
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
