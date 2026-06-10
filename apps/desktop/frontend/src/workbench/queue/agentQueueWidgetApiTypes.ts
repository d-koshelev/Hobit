import type {
  AgentQueueCoordinatorStatus,
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskExecutionPolicy,
  AgentQueueTaskItemType,
  AgentQueueTaskRunLinkSummary,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
  AgentQueueWorkerExecutionReport,
  AgentQueueWorkerConfig,
  CreateAgentQueueTaskRequest,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
  UpdateAgentQueueTaskRequest,
} from "../../workspace/types";
import type { AgentExecutorSlot } from "../types";

export type QueueWidgetSafetyClass = "safe_read" | "safe_create_update";

export type QueueWidgetActionName =
  | "queue.getSnapshot"
  | "queue.createItem"
  | "queue.updateItem";

export type QueueWidgetActor = "operator" | "workspace_agent" | "test_harness";

export type QueueWidgetType = "agent-queue";

export type QueueWidgetBlockerCode =
  | "missing_prompt"
  | "missing_execution_workspace"
  | "missing_executor"
  | "dependency_blocked"
  | "manual_policy"
  | "unsupported_runtime"
  | "validation_failed"
  | "operator_decision_required";

export type QueueWidgetBlocker = {
  code: QueueWidgetBlockerCode;
  itemId?: string;
  message: string;
};

export type QueueWidgetEvent = {
  actionSummary?: string;
  actor?: QueueWidgetActor;
  coordinatorId: "primary";
  itemId?: string;
  summary: string;
  timestamp: string;
  type: "queueSnapshotRead" | "itemCreated" | "itemUpdated" | "actionFailed";
};

export type QueueWidgetQueueTagSummary = {
  blockedCount: number;
  finalizedCount: number;
  itemCount: number;
  queueTagId: string;
  queueTagName: string;
  reportReadyCount: number;
  runningCount: number;
  waitingCount: number;
};

export type QueueWidgetItemCounts = Record<string, number> & {
  awaitingCoordinatorReview: number;
  blocked: number;
  cancelled: number;
  completed: number;
  draft: number;
  failed: number;
  finalized: number;
  queued: number;
  ready: number;
  reportReady: number;
  review_needed: number;
  reviewNeeded: number;
  running: number;
  total: number;
  waiting: number;
};

export type QueueWidgetGlobalState = {
  errorCount: number;
  lastRefreshAt: string;
  status:
    | "idle"
    | "has_running_work"
    | "blocked"
    | "awaiting_review"
    | "autorun_running"
    | "autorun_stopping"
    | "failed";
  unsupportedReason?: string | null;
};

export type QueueWidgetAutonomousState = {
  activeItemId?: string | null;
  available: boolean;
  isActive: boolean;
  isSessionOnly: boolean;
  selectedExecutorRef?: string | null;
  status: string;
  stopReason?: string | null;
  unsupportedReason?: string | null;
  waitingRunId?: string | null;
};

export type QueueWidgetLocalExecutorState = {
  activeRunCount: number;
  assignedCount: number;
  available: boolean;
  executorCount: number;
  unsupportedReason?: string | null;
  workerCount: number;
};

export type QueueWidgetReportSummary = {
  changedFilesCount?: number;
  errorMessage?: string;
  errorsCount?: number;
  failedCommand?: string;
  status: "none" | "pending" | "report_ready" | "evidence_missing" | "unknown";
  summary?: string;
  validationSummary?: string;
  warningsCount?: number;
};

export type QueueWidgetEvidenceSummary = {
  reviewStatus?: string | null;
  runRefs: string[];
  status: "none" | "available" | "missing" | "unknown";
  validationStatus?: string | null;
};

export type QueueWidgetRunLinkSummary = Pick<
  AgentQueueTaskRunLinkSummary,
  | "completedAt"
  | "directWorkRunId"
  | "executorWidgetId"
  | "linkId"
  | "reviewStatus"
  | "source"
  | "startedAt"
  | "status"
  | "validationStatus"
>;

export type QueueWidgetItemSnapshot = {
  approvalPolicy?: DirectWorkApprovalPolicy | null;
  assignedExecutorWidgetId?: string | null;
  blockers: QueueWidgetBlocker[];
  codexExecutable?: string | null;
  coordinatorStatus?: AgentQueueCoordinatorStatus | null;
  createdAt?: string;
  dependencies: string[];
  description: string;
  evidenceSummary: QueueWidgetEvidenceSummary;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionStatus: AgentQueueTaskStatus;
  executionWorkspace?: string | null;
  id: string;
  index?: number | null;
  itemType?: AgentQueueTaskItemType | null;
  order?: number | null;
  priority: number;
  prompt: string;
  queueId: string;
  queueTag: {
    id: string | null;
    name: string | null;
  };
  reportSummary: QueueWidgetReportSummary;
  runLinks: QueueWidgetRunLinkSummary[];
  sandbox?: DirectWorkSandbox | null;
  status: AgentQueueTaskStatus;
  title: string;
  updatedAt?: string;
  validationStatus?: AgentQueueTaskValidationStatus | null;
  workspaceId: string;
};

export type QueueWidgetSnapshot = {
  autonomousRunnerState: QueueWidgetAutonomousState;
  blockers: QueueWidgetBlocker[];
  blockersCount: number;
  capsAndRedactions: string[];
  coordinatorId: "primary";
  countsByStatus: QueueWidgetItemCounts;
  finalizedCount: number;
  globalQueueState: QueueWidgetGlobalState;
  itemCounts: QueueWidgetItemCounts;
  items: QueueWidgetItemSnapshot[];
  lastEvents: QueueWidgetEvent[];
  localExecutorState: QueueWidgetLocalExecutorState;
  pendingConfirmations: Array<{
    action: string;
    itemId?: string;
    reason: string;
  }>;
  queueId: string;
  queueTags: QueueWidgetQueueTagSummary[];
  reportReadyCount: number;
  revision: string | null;
  runningCount: number;
  selectedItem: QueueWidgetItemSnapshot | null;
  selectedItemId: string | null;
  snapshotGeneratedAt: string;
  unsupportedReason?: string | null;
  waitingCount: number;
  widgetType: QueueWidgetType;
  workspaceId: string;
};

export type QueueWidgetActionError = {
  code: string;
  message: string;
};

export type QueueWidgetActionResult<T = QueueWidgetItemSnapshot> = {
  action: QueueWidgetActionName;
  error?: QueueWidgetActionError;
  events: QueueWidgetEvent[];
  item?: T;
  message: string;
  ok: boolean;
  safetyClass: QueueWidgetSafetyClass;
  snapshot?: QueueWidgetSnapshot;
};

export type QueueGetSnapshotRequest = {
  eventLimit?: number;
  includeSelectedItem?: boolean;
  itemLimit?: number;
  queueId?: string;
  runLinkLimitPerItem?: number;
  selectedItemId?: string | null;
  workspaceId: string;
};

export type QueueCreateItemRequest = {
  actor?: QueueWidgetActor;
  approvalPolicy?: DirectWorkApprovalPolicy | null;
  codexExecutable?: string | null;
  dependencies?: string[];
  description?: string;
  executionPolicy?: AgentQueueTaskExecutionPolicy;
  executionWorkspace?: string | null;
  expectedRevision?: string;
  itemType?: AgentQueueTaskItemType;
  priority?: number;
  prompt?: string;
  queueId?: string;
  queueTag?: { id?: string | null; name?: string | null };
  sandbox?: DirectWorkSandbox | null;
  status?: Extract<AgentQueueTaskStatus, "draft" | "queued">;
  title: string;
  workspaceId: string;
};

export type QueueUpdateItemPatch = Partial<{
  approvalPolicy: DirectWorkApprovalPolicy | null;
  codexExecutable: string | null;
  dependencies: string[];
  description: string;
  executionPolicy: AgentQueueTaskExecutionPolicy;
  executionWorkspace: string | null;
  index: number | null;
  itemType: AgentQueueTaskItemType | null;
  order: number | null;
  priority: number;
  prompt: string;
  queueTag: { id?: string | null; name?: string | null };
  sandbox: DirectWorkSandbox | null;
  status: AgentQueueTaskStatus;
  title: string;
  validationStatus: AgentQueueTaskValidationStatus | null;
  appendWorkerExecutionReport: AgentQueueWorkerExecutionReport;
  workerExecutionReports: AgentQueueWorkerExecutionReport[];
}>;

export type QueueUpdateItemRequest = {
  actor?: QueueWidgetActor;
  expectedRevision?: string;
  itemId: string;
  patch: QueueUpdateItemPatch;
  queueId?: string;
  reason?: string;
  workspaceId: string;
};

export type AgentQueueWidgetApi = {
  createItem: (
    request: QueueCreateItemRequest,
  ) => Promise<QueueWidgetActionResult>;
  getSnapshot: (
    request?: Partial<QueueGetSnapshotRequest>,
  ) => Promise<QueueWidgetActionResult<QueueWidgetSnapshot>>;
  updateItem: (
    request: QueueUpdateItemRequest,
  ) => Promise<QueueWidgetActionResult>;
};

export type QueueWidgetApiDependencies = {
  agentExecutorSlots?: AgentExecutorSlot[];
  createAgentQueueTask: (
    request: Omit<CreateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask>;
  getAgentQueueRunnerSnapshot?: () => Promise<AgentQueueRunnerSnapshot>;
  getAgentQueueTask: (queueItemId: string) => Promise<AgentQueueTask | null>;
  listAgentQueueTaskRunLinks?: (
    queueItemId: string,
  ) => Promise<AgentQueueTaskRunLinkSummary[]>;
  listAgentQueueTasks: () => Promise<AgentQueueTask[]>;
  listAgentQueueWorkers?: () => Promise<AgentQueueWorkerConfig[]>;
  now?: () => string;
  queueId?: string;
  selectedItemId?: string | null;
  updateAgentQueueTask: (
    request: Omit<UpdateAgentQueueTaskRequest, "workspaceId">,
  ) => Promise<AgentQueueTask | null>;
  workspaceId: string;
};
