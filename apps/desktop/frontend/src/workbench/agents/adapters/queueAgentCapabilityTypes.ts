import type { PromptPackFileEntry, PromptPackImportPreviewModel } from "../../promptPack";
import type {
  AgentQueueItemAggregate,
  AgentQueueItemAggregateBlocker,
  AgentQueueItemAggregateDurableFlags,
  AgentQueueItemAggregateEvidenceSummary,
  AgentQueueItemAggregateLatestRun,
  AgentQueueItemAggregateNextAction,
  AgentQueueWorkerEvidenceBundle,
} from "../../../workspace/types";
import type { QueueBackendCapabilityPort } from "./queueBackendCapabilityPort";
import type {
  SmartQueueDogfoodLifecycleItem,
  SmartQueueDogfoodReviewOutcome,
  SmartQueueFollowUpPrompt,
  SmartQueueReviewMessage,
  SmartQueueValidationApproval,
} from "../../queue/smartQueueDogfoodLifecycle";
import type {
  SmartQueueMaterializationPreview,
  SmartQueuePromptPackInput,
} from "../../queue/smartQueuePromptPackMaterialization";
import type {
  QueueWorkerEvidenceBundle,
  QueueWorkerEvidenceBundleInput,
  QueueWorkerEvidenceSummary,
} from "../../queue/smartQueueWorkerEvidenceBundle";

export const QUEUE_AGENT_CAPABILITY_IDS = [
  "queue.createItem",
  "queue.createItems",
  "queue.enable",
  "queue.coordinator.addFollowUpPrompt",
  "queue.coordinator.approveValidation",
  "queue.importPromptPack",
  "queue.item.block",
  "queue.item.fail",
  "queue.item.markDone",
  "queue.item.promoteDraft",
  "queue.item.startRun",
  "queue.item.updateRunSettings",
  "queue.items.list",
  "queue.lifecycle.agentFinished",
  "queue.lifecycle.get",
  "queue.preparePromptPackPreview",
  "queue.review.ack",
  "queue.review.createMessage",
  "queue.review.getEvidenceBundle",
  "queue.selfTest",
  "queue.targetSingletonQueue",
] as const;

export const QUEUE_ACTIVITY_EVENTS = {
  createItem: ["hobit.agent.capability.queue.createItem.requested", "queue.itemCreated"],
  createItems: ["hobit.agent.capability.queue.createItems.requested", "queue.itemCreated"],
  enable: ["hobit.agent.capability.queue.enable.requested"],
  importPromptPack: [
    "hobit.agent.capability.queue.importPromptPack.requested",
    "queue.itemCreated",
  ],
  itemsList: ["hobit.agent.capability.queue.items.list.requested"],
  lifecycleAgentFinished: [
    "hobit.agent.capability.queue.lifecycle.agentFinished.requested",
  ],
  lifecycleGet: ["hobit.agent.capability.queue.lifecycle.get.requested"],
  lifecycleItemBlock: [
    "hobit.agent.capability.queue.item.block.requested",
  ],
  lifecycleItemFail: ["hobit.agent.capability.queue.item.fail.requested"],
  lifecycleItemMarkDone: [
    "hobit.agent.capability.queue.item.markDone.requested",
  ],
  promoteDraft: [
    "hobit.agent.capability.queue.item.promoteDraft.requested",
  ],
  startRun: ["hobit.agent.capability.queue.item.startRun.requested"],
  lifecycleReviewAck: [
    "hobit.agent.capability.queue.review.ack.requested",
  ],
  lifecycleReviewCreateMessage: [
    "hobit.agent.capability.queue.review.createMessage.requested",
  ],
  lifecycleReviewEvidenceBundle: [
    "hobit.agent.capability.queue.review.getEvidenceBundle.requested",
  ],
  lifecycleValidationApproved: [
    "hobit.agent.capability.queue.coordinator.approveValidation.requested",
  ],
  lifecycleFollowUpPromptAdded: [
    "hobit.agent.capability.queue.coordinator.addFollowUpPrompt.requested",
  ],
  preparePromptPackPreview: [
    "hobit.agent.capability.queue.preparePromptPackPreview.requested",
  ],
  selfTest: ["hobit.agent.capability.queue.selfTest.requested"],
  targetSingletonQueue: [
    "hobit.agent.capability.queue.targetSingletonQueue.requested",
  ],
  updateRunSettings: [
    "hobit.agent.capability.queue.item.updateRunSettings.requested",
  ],
} as const;

export type QueueAgentCapabilityId =
  (typeof QUEUE_AGENT_CAPABILITY_IDS)[number];

export type QueueAgentCapabilityStatus =
  | "succeeded"
  | "failed"
  | "invalid_input"
  | "unavailable"
  | "policy_blocked"
  | "dry_run_required"
  | "confirmation_required";

export type QueueAgentSideEffectFlags = {
  didAutoRunWorkers: false;
  didCreateDuplicateQueueView: false;
  didExecuteRollback: false;
  didLaunchCodex: false;
  didLaunchShell: false;
  didLaunchTerminal: false;
  didMutateGit: false;
  didMutateQueue: false;
  didStartWorkers: false;
};

export type QueueAgentSingletonTarget = {
  queueId: "workspace-queue";
  singleton: true;
  singletonKey: "workspace-queue";
  widgetDefinitionId: "agent-queue";
  wouldCreateDuplicateQueueView: false;
};

export type QueueAgentSourceMetadata = {
  [key: string]: unknown;
};

// Raw structured input from a Hobit action request before adapter validation.
// title and prompt stay optional here so invalid envelopes can be represented
// and rejected by normalizeCreateItemsInput without weakening validation.
export type QueueAgentCreateItemInput = {
  dependencies?: readonly string[];
  description?: string | null;
  id?: string;
  prompt?: string;
  source?: QueueAgentSourceMetadata;
  sourceMetadata?: QueueAgentSourceMetadata;
  status?: "draft" | "queued" | "ready";
  title?: string;
};

export type QueueAgentCreateItemsInput = {
  items?: readonly QueueAgentCreateItemInput[];
  source?: QueueAgentSourceMetadata;
};

export type QueueAgentNormalizedCreateItem = {
  dependencies: string[];
  description: string;
  id: string;
  prompt: string;
  sourceMetadata: QueueAgentSourceMetadata | null;
  status: "draft" | "queued";
  title: string;
};

export type QueueAgentCreateItemsRequest = {
  items: QueueAgentNormalizedCreateItem[];
  sourceMetadata: QueueAgentSourceMetadata | null;
  target: QueueAgentSingletonTarget;
};

export type QueueAgentCreateItemsPreview = {
  items: QueueAgentNormalizedCreateItem[];
  wouldAutoRunWorkers: false;
  wouldCreateDuplicateQueueView: false;
  wouldCreateItems: number;
  wouldTargetSingletonQueue: true;
};

export type QueueAgentCreatedItem = {
  dependencies: string[];
  id: string;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  prompt: string;
  readiness?: QueueAgentTaskReadiness;
  sourceMetadata: QueueAgentSourceMetadata | null;
  status: "draft" | "queued";
  title: string;
};

export type QueueAgentCreateItemsResult = QueueAgentCreateItemsPreview & {
  createdItemCount: number;
  createdItems: QueueAgentCreatedItem[];
  createdTaskIds: string[];
  dependencyEdgesPreserved: boolean;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
};

export type QueueAgentRunSandbox =
  | "danger_full_access"
  | "read_only"
  | "workspace_write";

export type QueueAgentRunApprovalPolicy =
  | "never"
  | "on_request"
  | "untrusted";

export type QueueAgentTaskReadinessState =
  | "blocked"
  | "final"
  | "not_ready"
  | "ready_to_queue"
  | "running"
  | "runnable";

export type QueueAgentTaskReadiness = {
  blockerReasons: string[];
  canPromote: boolean;
  canStart: boolean;
  draftState: "draft" | "not_draft";
  hasApprovalPolicy: boolean;
  hasCodexExecutable: boolean;
  hasPrompt: boolean;
  hasSandbox: boolean;
  hasWorkspace: boolean;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  readinessState: QueueAgentTaskReadinessState;
};

export type QueueAgentAggregateSource = "tauri_queue_item_aggregate";

export type QueueAgentAggregateNextAction =
  AgentQueueItemAggregateNextAction & {
    suggestedCapability?: QueueAgentCapabilityId | null;
  };

export type QueueAgentTaskSummary = QueueAgentTaskReadiness & {
  aggregateSource?: QueueAgentAggregateSource;
  assignedExecutorWidgetId?: string | null;
  authoritativeBackendAggregate?: boolean;
  blockers?: AgentQueueItemAggregateBlocker[];
  commitState?: string;
  dependencyState?: string;
  durableFlags?: AgentQueueItemAggregateDurableFlags;
  evidenceState?: string;
  evidenceSummary?: AgentQueueItemAggregateEvidenceSummary | null;
  latestRunId?: string | null;
  latestRun?: AgentQueueItemAggregateLatestRun | null;
  nextActions?: QueueAgentAggregateNextAction[];
  reviewState?: string;
  status: string;
  taskId: string;
  ticketState?: string;
  title: string;
  updatedAt?: string;
  validationState?: string;
  workerRunState?: string;
};

export type QueueAgentExecutorTarget = {
  executorWidgetId: string;
  label: string;
  ownerKind: "agent_executor" | "agent_queue";
};

export type QueueAgentListItemsInput = {
  limit?: number;
  taskId?: string;
};

export type QueueAgentListItemsResult = {
  aggregateSource?: QueueAgentAggregateSource;
  authoritativeBackendAggregate?: boolean;
  availableExecutors: QueueAgentExecutorTarget[];
  capped: boolean;
  itemCount: number;
  items: QueueAgentTaskSummary[];
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
};

export type QueueAgentUpdateRunSettingsInput = {
  approvalPolicy?: QueueAgentRunApprovalPolicy | null;
  codexExecutable?: string | null;
  sandbox?: QueueAgentRunSandbox | null;
  taskId?: string;
  workspaceRoot?: string | null;
};

export type QueueAgentUpdateRunSettingsResult = {
  appliedFields: string[];
  item: QueueAgentTaskSummary;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  taskId: string;
};

export type QueueAgentPromoteDraftInput = {
  taskId?: string;
};

export type QueueAgentPromoteDraftResult = {
  item: QueueAgentTaskSummary;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  previousStatus: string;
  taskId: string;
  wouldPromote: boolean;
};

export type QueueAgentEnableInput = Record<string, never>;

export type QueueAgentEnableResult = {
  blockerReasons: string[];
  didAutoRunWorkers: false;
  didStartWorkers: false;
  globalExecutionState?: string;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  queueEnabled: boolean;
};

export type QueueAgentStartRunInput = {
  executorWidgetId?: string;
  queueId?: string;
  taskId?: string;
};

export type QueueAgentStartRunResult = {
  executorWidgetId: string;
  queueItemId: string;
  queueLinkedMetadata: {
    executorWidgetId: string;
    queueItemId: string;
    runId: string;
    source: "queue_manual_start";
    workspaceId?: string | null;
  };
  runId: string;
  startedDirectWork: true;
  taskId: string;
};

export type QueueAgentPromptPackInput = {
  fileEntries?: readonly PromptPackFileEntry[];
  preview?: PromptPackImportPreviewModel;
  smartQueuePromptPack?: SmartQueuePromptPackInput;
  sourceText?: string;
};

export type QueueAgentPromptPackPreview = {
  importAvailable: boolean;
  itemCount: number;
  selectedItemCount: number;
  smartQueueMaterialization: SmartQueueMaterializationPreview;
  wouldAutoRunWorkers: false;
  wouldCreateDuplicateQueueView: false;
  wouldCreateItems: number;
  wouldStartWorkers: false;
  wouldTargetSingletonQueue: true;
};

export type QueueAgentPromptPackImportResult = QueueAgentPromptPackPreview & {
  createdItemCount: number;
  createdItems: QueueAgentCreatedItem[];
  createdTaskIds: string[];
  dependencyEdgesPreserved: boolean;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
};

export type QueueAgentLifecycleAgentFinishedInput = {
  attemptId?: string;
  changedFilesSummary?: readonly string[] | string;
  evidenceBundle?: QueueWorkerEvidenceBundleInput | QueueWorkerEvidenceBundle;
  finalAgentMessage?: string;
  finishedAt?: string;
  outcome?: SmartQueueDogfoodReviewOutcome;
  runId?: string;
  source?: string;
  taskId?: string;
  threadId?: string;
  validationSummary?: string;
  workerId?: string;
};

export type QueueAgentReviewCreateMessageInput = {
  attemptId?: string;
  changedFilesSummary?: readonly string[] | string;
  coordinatorAgentId?: string;
  createdAt?: string;
  evidenceBundle?: QueueWorkerEvidenceBundleInput | QueueWorkerEvidenceBundle;
  finalAgentMessage?: string;
  messageId?: string;
  taskId?: string;
  validationSummary?: string;
};

export type QueueAgentReviewAckInput = {
  ackId?: string;
  coordinatorAgentId?: string;
  messageId?: string;
  receivedAt?: string;
  taskId?: string;
};

export type QueueAgentApproveValidationInput = {
  approvedAt?: string;
  coordinatorAgentId?: string;
  summary?: string;
  taskId?: string;
  validationApprovalId?: string;
};

export type QueueAgentAddFollowUpPromptInput = {
  coordinatorAgentId?: string;
  createdAt?: string;
  followUpPromptId?: string;
  parentAttemptId?: string;
  prompt?: string;
  taskId?: string;
  threadId?: string;
};

export type QueueAgentMarkDoneInput = {
  commit?: {
    commitHash?: string;
    commitResultId?: string;
    commitTitle?: string;
  };
  completedAt?: string;
  coordinatorAgentId?: string;
  decisionId?: string;
  reason?: string;
  taskId?: string;
  validationApproved?: boolean;
  validationApprovalId?: string;
  validationSummary?: string;
};

export type QueueAgentBlockInput = {
  blockedAt?: string;
  coordinatorAgentId?: string;
  decisionId?: string;
  reason?: string;
  taskId?: string;
};

export type QueueAgentFailInput = {
  coordinatorAgentId?: string;
  decisionId?: string;
  failedAt?: string;
  reason?: string;
  taskId?: string;
};

export type QueueAgentLifecycleGetInput = {
  taskId?: string;
};

export type QueueAgentReviewEvidenceBundleInput = {
  runId?: string;
  taskId?: string;
};

export type QueueAgentLifecycleHandlerContext = {
  agentId: string;
  dryRun: boolean;
  requestedAt: string;
  requestId: string;
};

export type QueueAgentLifecycleTaskSeed = {
  createdAt?: string;
  prompt?: string;
  status?:
    | "cancelled"
    | "completed"
    | "draft"
    | "failed"
    | "queued"
    | "ready"
    | "review_needed"
    | "running";
  taskId: string;
  title?: string;
  updatedAt?: string;
};

export type QueueAgentLifecycleTransitionOutput = {
  actionLabel: string;
  additionalPromptCount: number;
  agentPromptState: SmartQueueDogfoodLifecycleItem["agentPromptState"];
  aggregate?: AgentQueueItemAggregate;
  blockers?: AgentQueueItemAggregateBlocker[];
  evidenceBundleId?: string;
  evidenceBundle?: AgentQueueWorkerEvidenceBundle | null;
  evidenceState?: string;
  dryRunOnly: boolean;
  durable?: boolean;
  lifecycle: SmartQueueDogfoodLifecycleItem | null;
  messageId?: string;
  nextActions?: QueueAgentAggregateNextAction[];
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  previousAgentPromptState: SmartQueueDogfoodLifecycleItem["agentPromptState"];
  previousTicketState: SmartQueueDogfoodLifecycleItem["ticketState"] | string;
  queueMutation: "backend_domain" | "frontend_controller_overlay" | "none";
  reviewMessage?: unknown;
  reviewState?: string;
  reviewOutcome: SmartQueueDogfoodReviewOutcome | null;
  runId?: string;
  taskId: string;
  ticketState: SmartQueueDogfoodLifecycleItem["ticketState"] | string;
  value?: unknown;
  wouldAutoRunWorkers: false;
  wouldCallGit: false;
  wouldExecuteRollback: false;
  wouldLaunchTerminal: false;
  wouldPersistBackend: boolean;
  wouldRunValidation: false;
  wouldStartWorkers: false;
};

export type QueueAgentLifecycleGetOutput = {
  aggregate?: QueueAgentTaskSummary;
  aggregateSource?: QueueAgentAggregateSource;
  authoritativeBackendAggregate?: boolean;
  blockerReasons?: string[];
  blockers?: AgentQueueItemAggregateBlocker[];
  commitState?: string;
  dependencyState?: string;
  durableFlags?: AgentQueueItemAggregateDurableFlags;
  evidenceState?: string;
  evidenceSummary?: AgentQueueItemAggregateEvidenceSummary | null;
  latestRun?: AgentQueueItemAggregateLatestRun | null;
  lifecycle: SmartQueueDogfoodLifecycleItem | null;
  lifecycles?: SmartQueueDogfoodLifecycleItem[];
  nextActions?: QueueAgentAggregateNextAction[];
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  reviewState?: string;
  taskId?: string;
  ticketState?: string;
  updatedAt?: string;
  validationState?: string;
  workerRunState?: string;
};

export type QueueAgentReviewEvidenceBundleOutput = {
  aggregate?: AgentQueueItemAggregate | null;
  backendEvidenceBundle?: AgentQueueWorkerEvidenceBundle | null;
  blockers?: AgentQueueItemAggregateBlocker[];
  changedFilesSummary?: string;
  evidenceBundle: QueueWorkerEvidenceBundle | null;
  evidenceBundleId?: string;
  evidenceBundlePersistence:
    | "backend_durable"
    | "backend_no_evidence"
    | "frontend_only_not_durable";
  evidenceState?: string;
  evidenceSummary?: QueueWorkerEvidenceSummary;
  finalAgentMessage?: string;
  latestReviewMessage: SmartQueueReviewMessage | null;
  lifecycle: SmartQueueDogfoodLifecycleItem;
  nextActions?: QueueAgentAggregateNextAction[];
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  reviewMessages: SmartQueueReviewMessage[];
  reviewOutcome: SmartQueueDogfoodReviewOutcome | null;
  runId?: string | null;
  taskId: string;
  validationApprovals: SmartQueueValidationApproval[];
  validationSummary?: string;
};

export type QueueAgentDogfoodLifecycleAdapterApi = {
  ackReview: (
    input: Required<Pick<QueueAgentReviewAckInput, "messageId" | "taskId">> &
      Omit<QueueAgentReviewAckInput, "messageId" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  addFollowUpPrompt: (
    input: Required<Pick<QueueAgentAddFollowUpPromptInput, "coordinatorAgentId" | "prompt" | "taskId">> &
      Omit<QueueAgentAddFollowUpPromptInput, "coordinatorAgentId" | "prompt" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  agentFinished: (
    input: Required<Pick<QueueAgentLifecycleAgentFinishedInput, "finalAgentMessage" | "outcome" | "runId" | "taskId">> &
      Omit<QueueAgentLifecycleAgentFinishedInput, "finalAgentMessage" | "outcome" | "runId" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  approveValidation: (
    input: Required<Pick<QueueAgentApproveValidationInput, "coordinatorAgentId" | "taskId">> &
      Omit<QueueAgentApproveValidationInput, "coordinatorAgentId" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  blockItem: (
    input: Required<Pick<QueueAgentBlockInput, "coordinatorAgentId" | "reason" | "taskId">> &
      Omit<QueueAgentBlockInput, "coordinatorAgentId" | "reason" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  createReviewMessage: (
    input: Required<Pick<QueueAgentReviewCreateMessageInput, "taskId">> &
      Omit<QueueAgentReviewCreateMessageInput, "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  failItem: (
    input: Required<Pick<QueueAgentFailInput, "coordinatorAgentId" | "reason" | "taskId">> &
      Omit<QueueAgentFailInput, "coordinatorAgentId" | "reason" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  getEvidenceBundle: (
    input: Required<Pick<QueueAgentReviewEvidenceBundleInput, "taskId">> &
      Omit<QueueAgentReviewEvidenceBundleInput, "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentReviewEvidenceBundleOutput>>;
  getLifecycle: (
    input: QueueAgentLifecycleGetInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleGetOutput>>;
  markDone: (
    input: Required<Pick<QueueAgentMarkDoneInput, "coordinatorAgentId" | "taskId" | "validationApproved">> &
      Omit<QueueAgentMarkDoneInput, "coordinatorAgentId" | "taskId" | "validationApproved">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
};

export type QueueAgentSelfTestCaseStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";

export type QueueAgentSelfTestCaseResult = {
  caseId: string;
  evidence: string[];
  message: string;
  reason?: string;
  status: QueueAgentSelfTestCaseStatus;
};

export type QueueAgentSelfTestReport = {
  cases: QueueAgentSelfTestCaseResult[];
  hiddenSideEffectFlags: QueueAgentSideEffectFlags;
  productSummary: string;
  status: QueueAgentSelfTestCaseStatus;
  summary: {
    blocked: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
  };
};

export type QueueAgentAdapterResult<TOutput> = {
  activityEventNames?: string[];
  message: string;
  output?: TOutput;
  reasons?: string[];
  status: QueueAgentCapabilityStatus;
};

export type QueueAgentMaybePromise<T> = T | Promise<T>;

export type QueueAgentAdapterApi = {
  backend?: QueueBackendCapabilityPort | null;
  dogfoodLifecycle?: QueueAgentDogfoodLifecycleAdapterApi;
  enableQueue?: (
    input: QueueAgentEnableInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentEnableResult>>;
  getSingletonQueueTarget: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSingletonTarget>>;
  listItems?: (
    input: QueueAgentListItemsInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentListItemsResult>>;
  previewCreateItems: (
    request: QueueAgentCreateItemsRequest,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentCreateItemsPreview>>;
  createItems: (
    request: QueueAgentCreateItemsRequest,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentCreateItemsResult>>;
  previewPromptPack: (
    input: QueueAgentPromptPackInput,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentPromptPackPreview>>;
  importPromptPack: (
    input: QueueAgentPromptPackInput,
    request: QueueAgentCreateItemsRequest,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentPromptPackImportResult>>;
  promoteDraft?: (
    input: Required<Pick<QueueAgentPromoteDraftInput, "taskId">>,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentPromoteDraftResult>>;
  runQueueSelfTest?: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSelfTestReport>>;
  startQueueLinkedRun?: (
    input: Required<Pick<QueueAgentStartRunInput, "executorWidgetId" | "taskId">> &
      Omit<QueueAgentStartRunInput, "executorWidgetId" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentStartRunResult>>;
  supportsDependencyEdges: boolean;
  supportsSafeMutationSandbox?: boolean;
  updateRunSettings?: (
    input: Required<Pick<QueueAgentUpdateRunSettingsInput, "taskId">> &
      Omit<QueueAgentUpdateRunSettingsInput, "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentUpdateRunSettingsResult>>;
};

export function singletonQueueTarget(): QueueAgentSingletonTarget {
  return {
    queueId: "workspace-queue",
    singleton: true,
    singletonKey: "workspace-queue",
    widgetDefinitionId: "agent-queue",
    wouldCreateDuplicateQueueView: false,
  };
}

export function queueSideEffectFlags(): QueueAgentSideEffectFlags {
  return {
    didAutoRunWorkers: false,
    didCreateDuplicateQueueView: false,
    didExecuteRollback: false,
    didLaunchCodex: false,
    didLaunchShell: false,
    didLaunchTerminal: false,
    didMutateGit: false,
    didMutateQueue: false,
    didStartWorkers: false,
  };
}

export function noHiddenSideEffectFlags() {
  return {
    noCodexRun: false,
    noGitMutation: false,
    noQueueMutation: false,
    noRollbackExecution: false,
    noShellCommand: false,
    noTerminalLaunch: false,
    noWorkerStart: false,
  } as const;
}

export function createQueueAgentItemsPreview(
  items: readonly QueueAgentNormalizedCreateItem[],
): QueueAgentCreateItemsPreview {
  return {
    items: [...items],
    wouldAutoRunWorkers: false,
    wouldCreateDuplicateQueueView: false,
    wouldCreateItems: items.length,
    wouldTargetSingletonQueue: true,
  };
}

export function queueAgentCreatedItem(
  item: QueueAgentNormalizedCreateItem,
): QueueAgentCreatedItem {
  return {
    dependencies: [...item.dependencies],
    id: item.id,
    nextSuggestedCapability: "queue.item.updateRunSettings",
    prompt: item.prompt,
    readiness: {
      blockerReasons: [
        "Workspace, Codex executable, sandbox, and approval policy may still be required before this task can be queued or started.",
      ],
      canPromote: false,
      canStart: false,
      draftState: item.status === "draft" ? "draft" : "not_draft",
      hasApprovalPolicy: false,
      hasCodexExecutable: false,
      hasPrompt: Boolean(item.prompt.trim()),
      hasSandbox: false,
      hasWorkspace: false,
      nextSuggestedCapability: "queue.item.updateRunSettings",
      readinessState: "not_ready",
    },
    sourceMetadata: item.sourceMetadata,
    status: item.status,
    title: item.title,
  };
}

export function createQueueSelfTestReport(
  cases: readonly QueueAgentSelfTestCaseResult[],
): QueueAgentSelfTestReport {
  const summary = {
    blocked: cases.filter((item) => item.status === "blocked").length,
    failed: cases.filter((item) => item.status === "failed").length,
    passed: cases.filter((item) => item.status === "passed").length,
    skipped: cases.filter((item) => item.status === "skipped").length,
    total: cases.length,
  };

  return {
    cases: [...cases],
    hiddenSideEffectFlags: queueSideEffectFlags(),
    productSummary:
      summary.failed > 0
        ? "Queue self-test failed"
        : summary.blocked > 0
          ? "Queue self-test blocked"
          : "Queue self-test passed",
    status:
      summary.failed > 0
        ? "failed"
        : summary.blocked > 0
          ? "blocked"
          : "passed",
    summary,
  };
}
