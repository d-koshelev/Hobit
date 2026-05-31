import type {
  AgentQueueExecutionPlanPreview,
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerExecutionReport,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import type {
  AgentWorkerSummary,
  QueueGlobalStatus,
  QueueTagSummary,
  WorkerScope,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import type { AgentQueueEmbeddedExecutorSectionModel, AgentQueueSchedulerPlan } from "./agentQueueSchedulerModel";
import type { AgentQueueRunnerStatus } from "./agentQueueControllerHelpers";

export type UseAgentQueueControllerOptions = Pick<
  WidgetRenderProps,
  | "agentExecutorSlots"
  | "onAssignAgentQueueTaskToExecutor"
  | "onClearAgentQueueTaskAssignment"
  | "onCreateAgentQueueTask"
  | "onDeleteAgentQueueTask"
  | "onCreateAgentQueueWorker"
  | "onDeleteAgentQueueWorker"
  | "onDirectWorkRunHandoffStarted"
  | "onGetAgentQueueTask"
  | "onGetAgentQueueTaskLatestRunLink"
  | "onGetAgentQueueRunnerSnapshot"
  | "onListAgentQueueTaskRunLinks"
  | "onListAgentQueueTasks"
  | "onListAgentQueueWorkers"
  | "onStartAssignedAgentQueueTask"
  | "onStartAgentQueueRunnerSession"
  | "onStopAgentQueueRunnerSession"
  | "onUpdateAgentQueueTask"
  | "onUpdateAgentQueueWorker"
  | "queueTaskAutoRefreshRequest"
>;

export type AgentQueueRunController = {
  approvalPolicy: DirectWorkApprovalPolicy;
  canStart: boolean;
  codexExecutableDraft: string;
  isStarting: boolean;
  onApprovalPolicyChange: (approvalPolicy: DirectWorkApprovalPolicy) => void;
  onCodexExecutableDraftChange: (codexExecutable: string) => void;
  onRepoRootDraftChange: (repoRoot: string) => void;
  onSandboxChange: (sandbox: DirectWorkSandbox) => void;
  onStartAssignedTask: () => void;
  preconditionMessages: string[];
  readinessMessage: string | null;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox;
  startError: string | null;
  startedRunId: string | null;
  startMessage: string | null;
};

export type AgentQueueRunnerController = {
  canStart: boolean;
  error: string | null;
  message: string | null;
  onStart: () => void;
  onStop: () => void;
  preconditionMessages: string[];
  status: AgentQueueRunnerStatus;
};

export type AgentQueueAutorunController = {
  apiAvailable: boolean;
  canArm: boolean;
  error: string | null;
  isLoading: boolean;
  isStarting: boolean;
  isStopping: boolean;
  message: string | null;
  onArm: () => void;
  onRefresh: () => void;
  onStop: () => void;
  preconditionMessages: string[];
  selectedExecutorLabel: string | null;
  snapshot: AgentQueueRunnerSnapshot | null;
};

export type AgentQueueLatestRunLinkController = {
  apiAvailable: boolean;
  error: string | null;
  isLoading: boolean;
  link: AgentQueueTaskRunLinkSummary | null;
  onRefresh: () => void;
};

export type AgentQueueRunHistoryController = {
  apiAvailable: boolean;
  error: string | null;
  isLoading: boolean;
  links: AgentQueueTaskRunLinkSummary[];
  onRefresh: () => void;
  totalCount: number;
};

export type AgentQueueDeleteController = {
  blockedReason: string | null;
  canRequest: boolean;
  error: string | null;
  isConfirming: boolean;
  isDeleting: boolean;
  message: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRequest: () => void;
};

export type AgentQueueExecutionPlanController = {
  canGenerate: boolean;
  message: string | null;
  onGenerate: () => void;
  plan: AgentQueueExecutionPlanPreview | null;
};

export type AgentQueueWorkerReportController = {
  canAttach: boolean;
  latestReport: AgentQueueWorkerExecutionReport | null;
  message: string | null;
  onAttachDemoReport: () => void;
};

export type AgentQueueDiffReviewController = {
  canCreate: boolean;
  linkedReviewTasks: AgentQueueTask[];
  message: string | null;
  onCreate: () => void;
};

export type AgentQueueOrderingController = {
  canMoveDown: boolean;
  canMoveToBottom: boolean;
  canMoveToTop: boolean;
  canMoveUp: boolean;
  message: string | null;
  orderLabel: string | null;
  onMoveDown: () => void;
  onMoveToBottom: () => void;
  onMoveToTop: () => void;
  onMoveUp: () => void;
};

export type AgentQueueEditController = {
  isEditing: boolean;
  onCancel: () => void;
  onStart: () => void;
};

export type AgentQueueFoundationController = {
  embeddedExecutor: AgentQueueEmbeddedExecutorSectionModel;
  globalExecutionState: QueueGlobalStatus;
  globalMessage: string | null;
  globalStatus: QueueGlobalStatus;
  maxExecutorMessage: string | null;
  onMaxExecutorsChange: (maxExecutors: string) => void;
  onCreateQueueTag: (queueTagName: string) => boolean;
  onDeleteQueueTag: (queueTagId: string) => boolean;
  onCreateWorker: () => void;
  onDeleteWorker: (workerId: string) => void;
  onPauseQueueTag: (queueTagId: string) => void;
  onRenameWorker: (workerId: string, name: string) => void;
  onRenameQueueTag: (queueTagId: string, queueTagName: string) => Promise<boolean>;
  onResumeQueueTag: (queueTagId: string) => void;
  onStartWorkers: () => void;
  onStopAndKillRunning: () => void;
  onStopWorkers: () => void;
  onWorkerEnabledChange: (workerId: string, enabled: boolean) => void;
  onWorkerScopeChange: (workerId: string, scope: WorkerScope) => void;
  pausedQueueTagIds: ReadonlySet<string>;
  queueTags: QueueTagSummary[];
  schedulerPlan: AgentQueueSchedulerPlan;
  tagManagementError: string | null;
  tagManagementMessage: string | null;
  validationSummary: Record<string, number>;
  workers: AgentWorkerSummary[];
};
