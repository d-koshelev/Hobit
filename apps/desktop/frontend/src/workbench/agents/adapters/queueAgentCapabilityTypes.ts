import type { PromptPackFileEntry, PromptPackImportPreviewModel } from "../../promptPack";
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

export const QUEUE_AGENT_CAPABILITY_IDS = [
  "queue.createItem",
  "queue.createItems",
  "queue.coordinator.addFollowUpPrompt",
  "queue.coordinator.approveValidation",
  "queue.importPromptPack",
  "queue.item.block",
  "queue.item.fail",
  "queue.item.markDone",
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
  importPromptPack: [
    "hobit.agent.capability.queue.importPromptPack.requested",
    "queue.itemCreated",
  ],
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
  prompt: string;
  sourceMetadata: QueueAgentSourceMetadata | null;
  status: "draft" | "queued";
  title: string;
};

export type QueueAgentCreateItemsResult = QueueAgentCreateItemsPreview & {
  createdItems: QueueAgentCreatedItem[];
  dependencyEdgesPreserved: boolean;
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
  createdItems: QueueAgentCreatedItem[];
  dependencyEdgesPreserved: boolean;
};

export type QueueAgentLifecycleAgentFinishedInput = {
  attemptId?: string;
  changedFilesSummary?: readonly string[] | string;
  finalAgentMessage?: string;
  finishedAt?: string;
  outcome?: SmartQueueDogfoodReviewOutcome;
  taskId?: string;
  validationSummary?: string;
};

export type QueueAgentReviewCreateMessageInput = {
  attemptId?: string;
  changedFilesSummary?: readonly string[] | string;
  coordinatorAgentId?: string;
  createdAt?: string;
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
  dryRunOnly: boolean;
  lifecycle: SmartQueueDogfoodLifecycleItem;
  previousAgentPromptState: SmartQueueDogfoodLifecycleItem["agentPromptState"];
  previousTicketState: SmartQueueDogfoodLifecycleItem["ticketState"];
  queueMutation: "frontend_controller_overlay" | "none";
  reviewOutcome: SmartQueueDogfoodReviewOutcome | null;
  taskId: string;
  ticketState: SmartQueueDogfoodLifecycleItem["ticketState"];
  value?: unknown;
  wouldAutoRunWorkers: false;
  wouldCallGit: false;
  wouldExecuteRollback: false;
  wouldLaunchTerminal: false;
  wouldPersistBackend: false;
  wouldRunValidation: false;
  wouldStartWorkers: false;
};

export type QueueAgentLifecycleGetOutput = {
  lifecycle: SmartQueueDogfoodLifecycleItem | null;
  lifecycles?: SmartQueueDogfoodLifecycleItem[];
};

export type QueueAgentReviewEvidenceBundleOutput = {
  changedFilesSummary?: string;
  finalAgentMessage?: string;
  latestReviewMessage: SmartQueueReviewMessage | null;
  lifecycle: SmartQueueDogfoodLifecycleItem;
  reviewMessages: SmartQueueReviewMessage[];
  reviewOutcome: SmartQueueDogfoodReviewOutcome | null;
  taskId: string;
  validationApprovals: SmartQueueValidationApproval[];
  validationSummary?: string;
};

export type QueueAgentDogfoodLifecycleAdapterApi = {
  ackReview: (
    input: Required<Pick<QueueAgentReviewAckInput, "coordinatorAgentId" | "messageId" | "taskId">> &
      Omit<QueueAgentReviewAckInput, "coordinatorAgentId" | "messageId" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  addFollowUpPrompt: (
    input: Required<Pick<QueueAgentAddFollowUpPromptInput, "coordinatorAgentId" | "prompt" | "taskId">> &
      Omit<QueueAgentAddFollowUpPromptInput, "coordinatorAgentId" | "prompt" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  agentFinished: (
    input: Required<Pick<QueueAgentLifecycleAgentFinishedInput, "finalAgentMessage" | "outcome" | "taskId">> &
      Omit<QueueAgentLifecycleAgentFinishedInput, "finalAgentMessage" | "outcome" | "taskId">,
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
    input: Required<Pick<QueueAgentReviewCreateMessageInput, "coordinatorAgentId" | "taskId">> &
      Omit<QueueAgentReviewCreateMessageInput, "coordinatorAgentId" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  failItem: (
    input: Required<Pick<QueueAgentFailInput, "coordinatorAgentId" | "reason" | "taskId">> &
      Omit<QueueAgentFailInput, "coordinatorAgentId" | "reason" | "taskId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>>;
  getEvidenceBundle: (
    input: Required<Pick<QueueAgentReviewEvidenceBundleInput, "taskId">>,
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
  dogfoodLifecycle?: QueueAgentDogfoodLifecycleAdapterApi;
  getSingletonQueueTarget: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSingletonTarget>>;
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
  runQueueSelfTest?: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSelfTestReport>>;
  supportsDependencyEdges: boolean;
  supportsSafeMutationSandbox?: boolean;
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
    prompt: item.prompt,
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
