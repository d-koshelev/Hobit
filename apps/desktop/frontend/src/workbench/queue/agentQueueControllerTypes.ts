import type {
  AgentQueueExecutionPlanPreview,
  AgentQueueCoordinatorStatus,
  AgentQueueReportActionCard,
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskContextRef,
  AgentQueueTaskRunLinkSummary,
  AgentQueueWorkerExecutionReport,
  AgentExecutorRunDetail,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import type {
  AgentQueueKnowledgeContextAttachInput,
  AgentQueueKnowledgeContextAttachResult,
} from "../agentQueueKnowledgeContext";
import type {
  AgentWorkerSummary,
  QueueGlobalStatus,
  QueueTagColorToken,
  QueueTagSummary,
  WorkerScope,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import type { AgentQueueEmbeddedExecutorSectionModel, AgentQueueSchedulerPlan } from "./agentQueueSchedulerModel";
import type { AgentQueueRunnerStatus } from "./agentQueueControllerHelpers";
import type {
  AgentQueueRunActivitySnapshot,
  AgentQueueRunActivityState,
} from "./agentQueueRunActivity";

export type UseAgentQueueControllerOptions = Pick<
  WidgetRenderProps,
  | "agentExecutorSlots"
  | "onAssignAgentQueueTaskToExecutor"
  | "onAttachKnowledgeToQueueTask"
  | "onAttachSkillToQueueTask"
  | "onClearAgentQueueTaskAssignment"
  | "onCreateAgentQueueTask"
  | "onDeleteAgentQueueTask"
  | "onDetachKnowledgeFromQueueTask"
  | "onDetachSkillFromQueueTask"
  | "onCreateAgentQueueWorker"
  | "onDeleteAgentQueueWorker"
  | "onDirectWorkRunHandoffStarted"
  | "onGetAgentExecutorRunDetail"
  | "onGetAgentQueueTask"
  | "onGetAgentQueueTaskLatestRunLink"
  | "onGetAgentQueueRunnerSnapshot"
  | "onListenToDirectWorkStreamEvents"
  | "onListAgentQueueTaskRunLinks"
  | "onListAgentQueueTasks"
  | "onListAgentQueueWorkers"
  | "onStartAssignedAgentQueueTask"
  | "onStartAgentQueueRunnerSession"
  | "onStopAgentQueueRunnerSession"
  | "onUpdateAgentQueueTask"
  | "onUpdateAgentQueueWorker"
  | "queueTaskAutoRefreshRequest"
> & {
  queueWidgetInstanceId?: string | null;
};

export type AgentQueueAutonomousStatus =
  | "idle"
  | "needs_setup"
  | "blocked"
  | "running"
  | "stopping"
  | "failed"
  | "completed";

export type AgentQueueAutonomousTimelineEvent = {
  id: string;
  title: string;
  detail: string | null;
  status: "info" | "success" | "warning" | "error";
  timestamp: string;
};

export type AgentQueueAutonomousController = {
  activeQueueItemId: string | null;
  activeTaskTitle: string | null;
  apiAvailable: boolean;
  canStart: boolean;
  completedCount: number;
  currentStage: string | null;
  error: string | null;
  failedCount: number;
  latestReportState: string | null;
  message: string | null;
  approvalPolicy: DirectWorkApprovalPolicy;
  codexExecutableDraft: string;
  currentWorkspaceRoot: string | null;
  onApprovalPolicyChange: (approvalPolicy: DirectWorkApprovalPolicy) => void;
  onCodexExecutableDraftChange: (codexExecutable: string) => void;
  onRepoRootDraftChange: (repoRoot: string) => void;
  onSandboxChange: (sandbox: DirectWorkSandbox) => void;
  onStart: () => void;
  onStopAfterCurrent: () => void;
  preconditionMessages: string[];
  repoRootDraft: string;
  remainingEligibleCount: number;
  sandbox: DirectWorkSandbox;
  skippedBlockedCount: number;
  status: AgentQueueAutonomousStatus;
  timeline: AgentQueueAutonomousTimelineEvent[];
};

export type AgentQueueRunController = {
  approvalPolicy: DirectWorkApprovalPolicy | "";
  canStart: boolean;
  codexExecutableDraft: string;
  executorSelectionMessage: string | null;
  hasUnsavedTaskSettings: boolean;
  isStarting: boolean;
  onApprovalPolicyChange: (approvalPolicy: DirectWorkApprovalPolicy) => void;
  onCodexExecutableDraftChange: (codexExecutable: string) => void;
  onRepoRootDraftChange: (repoRoot: string) => void;
  onSandboxChange: (sandbox: DirectWorkSandbox) => void;
  onSaveTaskSettings: () => void;
  onStartAssignedTask: () => void;
  preconditionMessages: string[];
  readinessMessage: string | null;
  repoRootDraft: string;
  sandbox: DirectWorkSandbox | "";
  startError: string | null;
  startedRunId: string | null;
  startMessage: string | null;
  usesDefaultExecutorOnStart: boolean;
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

export type AgentQueueRunEvidenceController = {
  apiAvailable: boolean;
  detail: AgentExecutorRunDetail | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
};

export type AgentQueueRunActivityController = AgentQueueRunActivitySnapshot & {
  eventState: AgentQueueRunActivityState;
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

export type AgentQueueReportActionCardController = {
  diffReviewReportCard: AgentQueueReportActionCard | null;
  latestShownCardId: string | null;
  message: string | null;
  onShown: (cardId: string) => void;
  workerReportCard: AgentQueueReportActionCard | null;
};

export type AgentQueueDiffReviewController = {
  canCreate: boolean;
  linkedReviewTasks: AgentQueueTask[];
  message: string | null;
  onCreate: () => void;
};

export type AgentQueueCoordinatorFinalizationController = {
  canAct: boolean;
  message: string | null;
  onAcceptWithoutCommit: () => void;
  onCommitResult: () => void;
  onCreateFollowUp: () => void;
  onFinalize: () => void;
  onMarkBlocked: () => void;
  onMarkFailedRejected: () => void;
  onMarkFollowUpRequired: () => void;
  onMarkNeedsChanges: () => void;
  onMarkReadyForFinalization: () => void;
  onMarkRollbackRequired: () => void;
  status: AgentQueueCoordinatorStatus;
};

export type AgentQueueSmartRetryController = {
  canRetrySame: boolean;
  canRetryWithModifiedPrompt: boolean;
  error: string | null;
  isRetrying: boolean;
  message: string | null;
  onRetrySame: () => void;
  onRetryWithModifiedPrompt: (modifiedPrompt: string) => Promise<boolean>;
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

export type AgentQueueKnowledgeContextController = {
  onAttachSelected: (
    input: AgentQueueKnowledgeContextAttachInput,
  ) => Promise<AgentQueueKnowledgeContextAttachResult>;
  onDetachSelected: (
    ref: AgentQueueTaskContextRef,
  ) => Promise<AgentQueueKnowledgeContextAttachResult>;
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
  onSetQueueTagColor: (
    queueTagId: string,
    colorToken: QueueTagColorToken,
  ) => boolean;
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
