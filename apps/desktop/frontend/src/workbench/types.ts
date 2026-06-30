import type { GitRepositoryStatus } from "../workspace/types";
import type {
  AgentQueueReportActionCard,
  QueueWorkspaceRecoveryProjection,
  AgentQueueTask,
} from "../workspace/types";

export type WidgetCategory =
  | "observability"
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

export type WidgetLayoutDefaults = {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
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
  layoutDefaults?: WidgetLayoutDefaults;
  componentKey: string;
  singleton?: boolean;
  singletonScope?: "workspace";
  singletonKey?: string;
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
  rootPath?: string | null;
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
  queueRecovery?: QueueWorkspaceRecoveryProjection;
  widgets: WidgetInstance[];
  sharedStateObjects: WorkbenchSharedStateView[];
  recentEvents: WorkbenchEventView[];
};

export type AgentExecutorSlot = {
  label: string;
  ownerKind?: "agent_executor" | "agent_queue";
  widgetInstanceId: WidgetInstanceId;
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

export type QueueLinkedDirectWorkSource =
  | "queue_handoff"
  | "queue_manual_start"
  | "queue_sequential_start"
  | "queue_autonomous_start"
  | "queue_autorun_start"
  | "recovered_handoff";

export type QueueLinkedDirectWorkMetadata = {
  attemptId: string | null;
  completedAt?: string | null;
  durable: false;
  executorWidgetId: WidgetInstanceId;
  frontendOnly: true;
  idempotencyKey: string;
  ingestionId: string;
  kind: "queue_linked_direct_work_metadata";
  linkedAt: string;
  queueItemId: string;
  runId: string;
  source: QueueLinkedDirectWorkSource;
  version: 1;
  workbenchId?: string | null;
  workspaceId?: string | null;
};

export type QueueLinkedDirectWorkCompletionIdentity = {
  attemptId: string | null;
  completedAt: string | null;
  detailRunId: string | null;
  durable: false;
  executorWidgetId: WidgetInstanceId;
  finalStatus: string | null;
  frontendOnly: true;
  idempotencyKey: string;
  ingestionId: string;
  kind: "queue_linked_direct_work_completion_identity";
  linkedAt: string;
  metadata: QueueLinkedDirectWorkMetadata;
  queueItemId: string;
  runId: string;
  source: QueueLinkedDirectWorkSource;
  streamRunId: string | null;
  version: 1;
  workbenchId?: string | null;
  workspaceId?: string | null;
};

export type DirectWorkRunHandoff = {
  attemptId?: string | null;
  executorWidgetInstanceId: WidgetInstanceId;
  id: number;
  queueLinkedMetadata?: QueueLinkedDirectWorkMetadata;
  queueLinkedSource?: QueueLinkedDirectWorkSource;
  queueItemId: string;
  repoRoot: string;
  runId: string;
  startedAt: string;
  taskTitle: string;
  workbenchId: string;
  workspaceId: string;
};

export type DirectWorkRunHandoffInput = Omit<
  DirectWorkRunHandoff,
  "id" | "startedAt"
> & {
  startedAt?: string;
};

export type AgentExecutorRunOpenRequest = {
  executorWidgetInstanceId: WidgetInstanceId;
  id: number;
  runId: string;
};

export type AgentExecutorRunOpenRequestInput = Omit<
  AgentExecutorRunOpenRequest,
  "id"
>;

export type CoordinatorAttachedContextInput = {
  contextText: string;
  sourceLabel: string;
};

export type CoordinatorAttachedContextRequest =
  CoordinatorAttachedContextInput & {
    id: number;
    targetCoordinatorWidgetInstanceId: WidgetInstanceId;
  };

export type WorkspaceAgentQueueReportActionCardRequest = {
  card: AgentQueueReportActionCard;
  id: number;
  targetCoordinatorWidgetInstanceId: WidgetInstanceId;
};

export type WorkspaceAgentQueueTaskStatusCardRequest = {
  id: number;
  targetCoordinatorWidgetInstanceId: WidgetInstanceId;
  task: AgentQueueTask;
};

export type AgentQueueItemOpenRequest = {
  id: number;
  queueItemId: string;
  targetQueueWidgetInstanceId: WidgetInstanceId;
};

export type DirectWorkQueueTaskAutoRefreshRequest = Omit<
  DirectWorkRunHandoff,
  "id"
> & {
  completedAt: string;
  finalStatus: string;
  id: number;
};

export type { WidgetRenderProps } from "./widgetRenderProps";
