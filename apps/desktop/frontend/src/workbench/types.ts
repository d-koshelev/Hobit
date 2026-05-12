import type { CSSProperties, ReactNode } from "react";
import type {
  AgentMonitoringSnapshot,
  AgentQueueItem,
  AgentQueueSnapshot,
  DirectWorkStreamEvent,
  GenerateAgentChatAiProposalRequest,
  GenerateAgentChatAiProposalResponse,
  GitRepositoryStatus,
  PersistAgentChatProposalRequest,
  PersistAgentChatProposalResponse,
  RunCodexDirectWorkRequest,
  RunCodexDirectWorkResponse,
  RunDirectWorkValidationRequest,
  RunDirectWorkValidationResponse,
  StartCodexDirectWorkStreamResponse,
  RunTerminalCommandRequest,
  RunTerminalCommandResponse,
} from "../workspace/types";

export type WidgetCategory =
  | "core"
  | "tool"
  | "codebase"
  | "database"
  | "design"
  | "knowledge"
  | "workflow"
  | "notes";

export type WidgetDefinitionId = string;
export type WidgetInstanceId = string;
export type WidgetTemplateId = string;
export type WidgetRunId = string;
export type WorkbenchPresetId = string;

export type WidgetLayoutMode = "docked" | "popped-out" | "minimized";
export type WidgetPresentationMode = "docked" | "popped-out";
export type WorkbenchLayoutMode = "locked" | "editing";

export type WidgetGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export type WidgetLayout = WidgetGeometry & {
  area: string;
  mode: WidgetLayoutMode;
  order: number;
  popout?: WidgetGeometry & {
    alwaysOnTop: boolean;
    screen?: string;
  };
};

export type WidgetDefinition = {
  id: WidgetDefinitionId;
  title: string;
  category: WidgetCategory;
  description: string;
  defaultTitle: string;
  defaultConfig: Record<string, unknown>;
  componentKey: string;
};

export type WidgetState = Record<string, unknown>;

export type WidgetInstance = {
  id: WidgetInstanceId;
  definitionId: WidgetDefinitionId;
  title: string;
  config: Record<string, unknown>;
  state: WidgetState;
  layout: WidgetLayout;
  visible: boolean;
};

export type WorkbenchPreset = {
  id: WorkbenchPresetId;
  title: string;
  description: string;
  widgets: WidgetInstance[];
};

export type WorkbenchWorkspaceView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

export type WorkbenchPresetView = {
  id: WorkbenchPresetId | null;
  title: string;
  description: string | null;
};

export type WorkbenchSurfaceView = {
  id: string | null;
  preset: WorkbenchPresetView;
};

export type WorkbenchSharedStateView = {
  id: string;
  key: string;
  value: string;
  valueKind: string;
};

export type WorkbenchEventView = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
};

export type WorkbenchViewState = {
  workspace: WorkbenchWorkspaceView;
  workbench: WorkbenchSurfaceView;
  widgets: WidgetInstance[];
  sharedStateObjects: WorkbenchSharedStateView[];
  recentEvents: WorkbenchEventView[];
};

export type WidgetInput = {
  data: Record<string, unknown>;
  context: Record<string, unknown>;
};

export type WidgetCommand = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  source: "operator" | "agent" | "system";
  requiresApproval: boolean;
};

export type WidgetRunStatus =
  | "idle"
  | "input-ready"
  | "waiting-for-approval"
  | "running"
  | "result-ready"
  | "completed"
  | "failed"
  | "cancelled";

export type WidgetRun = {
  id: WidgetRunId;
  widgetInstanceId: WidgetInstanceId;
  command: WidgetCommand;
  status: WidgetRunStatus;
  startedAt?: string;
  finishedAt?: string;
};

export type WidgetLogEntry = {
  id: string;
  widgetInstanceId: WidgetInstanceId;
  runId: WidgetRunId | null;
  level: string;
  message: string;
  payload: string | null;
  createdAt: string;
};

export type WidgetResult = {
  id: string;
  runId: WidgetRunId;
  resultType: string;
  summary: string | null;
  content: string | null;
  payload: Record<string, unknown> | null;
};

export type DirectWorkGitReviewRequest = {
  id: number;
  repositoryRoot: string;
  sourceWidgetInstanceId: WidgetInstanceId;
};

export type DirectWorkGitReviewRequestInput = {
  repositoryRoot: string;
  sourceWidgetInstanceId: WidgetInstanceId;
};

export type DirectWorkGitReviewStatus = {
  errorMessage?: string;
  repositoryRoot?: string;
  repositoryStatus?: GitRepositoryStatus | null;
  requestId: number;
  sourceWidgetInstanceId: WidgetInstanceId;
  state: "pending" | "completed" | "failed";
};

export type WidgetRenderProps = {
  config: Record<string, unknown>;
  definition: WidgetDefinition;
  frameActions?: ReactNode;
  frameMoveEnabled?: boolean;
  frameStyle?: CSSProperties;
  directWorkGitReviewRequest?: DirectWorkGitReviewRequest | null;
  directWorkGitReviewStatus?: DirectWorkGitReviewStatus | null;
  hasGitWidget?: boolean;
  instance: WidgetInstance;
  logRefreshToken?: number;
  onStartFrameMove?: (pointerX: number, pointerY: number) => void;
  onUpdateLayout?: (
    widgetInstanceId: WidgetInstanceId,
    layout: WidgetLayout,
  ) => Promise<void>;
  onUpdateState?: (
    widgetInstanceId: WidgetInstanceId,
    state: WidgetState,
  ) => Promise<void>;
  onLoadLogs?: (widgetInstanceId: WidgetInstanceId) => Promise<WidgetLogEntry[]>;
  onGetAgentMonitoringSnapshot?: () => Promise<AgentMonitoringSnapshot | null>;
  onCreateAgentQueueItemFromProposal?: (
    sourceRunId: string,
    sourceResultId: string,
  ) => Promise<AgentQueueItem | null>;
  onGetAgentQueueSnapshot?: () => Promise<AgentQueueSnapshot | null>;
  onPersistAgentChatProposal?: (
    widgetInstanceId: WidgetInstanceId,
    proposal: Omit<
      PersistAgentChatProposalRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<PersistAgentChatProposalResponse | null>;
  onGenerateAgentChatAiProposal?: (
    widgetInstanceId: WidgetInstanceId,
    proposal: Omit<
      GenerateAgentChatAiProposalRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<GenerateAgentChatAiProposalResponse | null>;
  onGetGitRepositoryStatus?: (
    widgetInstanceId: WidgetInstanceId,
    repositoryRoot: string,
  ) => Promise<GitRepositoryStatus | null>;
  onDirectWorkGitReviewRequested?: (
    request: DirectWorkGitReviewRequestInput,
  ) => void;
  onDirectWorkGitReviewStatusChange?: (
    status: DirectWorkGitReviewStatus,
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
  onRunTerminalCommand?: (
    widgetInstanceId: WidgetInstanceId,
    command: Omit<
      RunTerminalCommandRequest,
      "workspaceId" | "workbenchId" | "widgetInstanceId"
    >,
  ) => Promise<RunTerminalCommandResponse | null>;
  title: string;
};
