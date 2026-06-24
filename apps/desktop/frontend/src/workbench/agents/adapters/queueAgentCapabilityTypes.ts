import type { PromptPackFileEntry, PromptPackImportPreviewModel } from "../../promptPack";
import type {
  AgentQueueItemAggregate,
  AgentQueueItemAggregateBlocker,
  AgentQueueItemAggregateDurableFlags,
  AgentQueueItemAggregateEvidenceSummary,
  AgentQueueItemAggregateLatestRun,
  AgentQueueItemAggregateNextAction,
  AgentQueueCompletionDecision,
  AgentQueueControlStatus,
  AgentQueueFailureDecision,
  AgentQueueWorkerEvidenceBundle,
  AgentQueueWorkflowActionStatus,
  AgentQueueWorkflowRunStatus,
} from "../../../workspace/types";
import type {
  HobitAgentActionReasonCode,
  HobitAgentActionStatus,
  HobitNextActionUnavailable,
} from "../broker/types";
import { createHobitNextActionUnavailable } from "../broker/nextAction";
import type { QueueBackendCapabilityPort } from "./queueBackendCapabilityPort";
import {
  buildQueueCapabilityNextAction,
  type QueueCapabilityNextAction,
} from "../capabilities/queueCapabilityContracts";
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
  "queue.control.get",
  "queue.control.setManualEnabled",
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
  "queue.workflow.get",
  "queue.workflow.getReport",
  "queue.workflow.list",
  "queue.workflow.planResume",
  "queue.workflow.readActionLog",
] as const;

export const QUEUE_ACTIVITY_EVENTS = {
  controlGet: ["hobit.agent.capability.queue.control.get.requested"],
  controlSetManualEnabled: [
    "hobit.agent.capability.queue.control.setManualEnabled.requested",
  ],
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
  workflowGet: ["hobit.agent.capability.queue.workflow.get.requested"],
  workflowGetReport: [
    "hobit.agent.capability.queue.workflow.getReport.requested",
  ],
  workflowList: ["hobit.agent.capability.queue.workflow.list.requested"],
  workflowPlanResume: [
    "hobit.agent.capability.queue.workflow.planResume.requested",
  ],
  workflowReadActionLog: [
    "hobit.agent.capability.queue.workflow.readActionLog.requested",
  ],
} as const;

export type QueueAgentCapabilityId =
  (typeof QUEUE_AGENT_CAPABILITY_IDS)[number];

export type QueueAgentCapabilityStatus =
  | "succeeded"
  | "blocked"
  | "blocked_actionable"
  | "failed"
  | "failed_unexpected"
  | "invalid_input"
  | "unavailable"
  | "policy_blocked"
  | "already_exists"
  | "already_done"
  | "already_failed"
  | "precondition_failed"
  | "paused"
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
  description?: string | null;
  dependsOn?: readonly string[];
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
} & QueueAgentNextActionFields;

export type QueueAgentNextActionFields = {
  candidateTaskIds?: string[];
  missingNextActionInput?: string[];
  nextAction?: QueueCapabilityNextAction;
  nextActionUnavailable?: HobitNextActionUnavailable;
  nextActionUnavailableCode?: string;
  nextActionUnavailableReason?: string;
};

export type QueueAgentCreateItemsResult = QueueAgentCreateItemsPreview & {
  createdItemCount: number;
  createdItems: QueueAgentCreatedItem[];
  createdTaskIds: string[];
  dependencyEdgesPreserved: boolean;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
} & QueueAgentNextActionFields;

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
} & QueueAgentNextActionFields;

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
} & QueueAgentNextActionFields;

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
} & QueueAgentNextActionFields;

export type QueueAgentPromoteDraftInput = {
  taskId?: string;
};

export type QueueAgentPromoteDraftResult = {
  item: QueueAgentTaskSummary;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  previousStatus: string;
  taskId: string;
  wouldPromote: boolean;
} & QueueAgentNextActionFields;

export type QueueAgentEnableInput = Record<string, never>;

export type QueueAgentControlGetInput = {
  workspaceId?: string;
};

export type QueueAgentControlSetManualEnabledInput = {
  expectedVersion?: number;
  reason?: string;
  workspaceId?: string;
};

export type QueueAgentControlGetResult = {
  backendOwned: boolean;
  blockers: string[];
  didAutoRunWorkers: false;
  didMutateQueue: false;
  didStartWorkers: false;
  globalExecutionState: string | null;
  missingCapabilities: string[];
  queueEnabled: boolean;
  reason: string | null;
  status: AgentQueueControlStatus;
  updatedAt: string | null;
  updatedByActorId: string | null;
  version: number | null;
  workspaceId: string | null;
};

export type QueueAgentControlSetManualEnabledResultStatus =
  | "succeeded"
  | "already_in_state"
  | "invalid_input"
  | "workspace_not_found"
  | "version_conflict"
  | "failed_unexpected";

export type QueueAgentControlSetManualEnabledResult = {
  backendOwned: true;
  blockers: string[];
  controlState: {
    reason: string | null;
    status: AgentQueueControlStatus;
    updatedAt: string | null;
    updatedByActorId: string | null;
    version: number | null;
  } | null;
  didAutoRunWorkers: false;
  didCreateRunLinks: false;
  didInvokeWorkflowRunner: false;
  didMutateEvidence: false;
  didMutateFinalization: false;
  didMutateQueueControlState: boolean;
  didMutateQueueTasks: false;
  didMutateReviews: false;
  didScheduleOrAutodispatch: false;
  didStartDownstream: false;
  didStartWorkers: false;
  queueEnabled: boolean;
  resultStatus: QueueAgentControlSetManualEnabledResultStatus;
  workspaceId: string | null;
};

export type QueueAgentWorkflowGetInput = {
  workflowRunId?: string;
  workspaceId?: string;
};

export type QueueAgentWorkflowListInput = {
  limit?: number;
  status?: AgentQueueWorkflowRunStatus;
  workflowId?: string;
  workspaceId?: string;
};

export type QueueAgentWorkflowGetReportInput = QueueAgentWorkflowGetInput;

export type QueueAgentWorkflowPlanResumeInput = QueueAgentWorkflowGetInput & {
  expectedVersion?: number;
};

export type QueueAgentWorkflowReadActionLogInput = QueueAgentWorkflowGetInput & {
  actionType?: string;
  includeRefs?: boolean;
  limit?: number;
  slot?: string;
  status?: AgentQueueWorkflowActionStatus | string;
};

export type QueueAgentWorkflowSafeJsonValue =
  | boolean
  | null
  | number
  | string
  | QueueAgentWorkflowSafeJsonValue[]
  | { [key: string]: QueueAgentWorkflowSafeJsonValue };

export type QueueAgentWorkflowRefMaps = {
  completionDecisionIdsBySlot: Record<string, string>;
  evidenceBundleIdsBySlot: Record<string, string>;
  failureDecisionIdsBySlot: Record<string, string>;
  messageIdsBySlot: Record<string, string>;
  runIdsBySlot: Record<string, string>;
  taskIdsBySlot: Record<string, string>;
};

export type QueueAgentWorkflowBlockerSummary = {
  blockerCode: string;
  blockerMessage: string;
  completionDecisionId?: string | null;
  evidenceBundleId?: string | null;
  failureDecisionId?: string | null;
  messageId?: string | null;
  missingRequiredField?: string | null;
  runId?: string | null;
  slot?: string | null;
  taskId?: string | null;
};

export type QueueAgentWorkflowActionCountSummary = {
  byActionType: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
};

export type QueueAgentWorkflowNoMutationFlags = {
  didAutoRunWorkers: false;
  didExecuteRollback: false;
  didInvokeWorkflowRunner: false;
  didLaunchShell: false;
  didLaunchTerminal: false;
  didMutateEvidence: false;
  didMutateFinalization: false;
  didMutateGit: false;
  didMutateQueue: false;
  didMutateReviews: false;
  didRunValidation: false;
  didStartWorkers: false;
};

export type QueueAgentWorkflowRunSummary = QueueAgentWorkflowNoMutationFlags & {
  actionLogSummary?: QueueAgentWorkflowSafeJsonValue | null;
  blockers: QueueAgentWorkflowBlockerSummary[];
  completedAt: string | null;
  createdAt: string;
  currentStep: string | null;
  missingCapabilities: string[];
  phase: string;
  requestId: string;
  slotBindingsSummary?: QueueAgentWorkflowSafeJsonValue | null;
  status: string;
  updatedAt: string;
  variablesSummary?: QueueAgentWorkflowSafeJsonValue | null;
  version: number;
  workflowId: string;
  workflowRunId: string;
  workspaceId: string;
} & QueueAgentWorkflowRefMaps;

export type QueueAgentWorkflowGetResult = QueueAgentWorkflowRunSummary;

export type QueueAgentWorkflowListResult = QueueAgentWorkflowNoMutationFlags & {
  limit: number;
  statusFilter: string | null;
  total: number;
  truncated: boolean;
  workflowIdFilter: string | null;
  workflows: QueueAgentWorkflowRunSummary[];
};

export type QueueAgentWorkflowActionSummary = {
  actionId: string;
  actionType: string;
  attemptCount: number;
  blockerCode: string | null;
  blockerMessage?: string | null;
  completedAt: string | null;
  createdAt: string;
  idempotencyKey: string;
  resultRefs: QueueAgentWorkflowSafeJsonValue | null;
  startedAt: string | null;
  status: string;
  stepId: string;
  targetRefs: QueueAgentWorkflowSafeJsonValue | null;
  updatedAt: string;
};

export type QueueAgentWorkflowFocusedAction = {
  actionId: string;
  actionType: string;
  blockerCode: string | null;
  blockerMessage: string | null;
  createdAt: string;
  idempotencyKey: string;
  resultRefs: QueueAgentWorkflowSafeJsonValue | null;
  status: string;
  targetRefs: QueueAgentWorkflowSafeJsonValue | null;
  updatedAt: string;
};

export type QueueAgentWorkflowSlotBindingSummary = {
  completionDecisionId: string | null;
  evidenceBundleId: string | null;
  executionTarget: {
    kind: string | null;
    providerId: string | null;
  } | null;
  executionTargetHash: string | null;
  failureDecisionId: string | null;
  messageId: string | null;
  runId: string | null;
  settingsHash: string | null;
  taskId: string | null;
  taskSpecHash: string | null;
};

export type QueueAgentWorkflowStartWorkerDiagnostics = {
  actionId: string | null;
  actionPresent: boolean;
  blockerCode: string | null;
  blockerMessage: string | null;
  executionTargetHash: string | null;
  hasExecutionTargetHash: boolean;
  hasRunId: boolean;
  hasSettingsHash: boolean;
  hasSlot: boolean;
  hasTaskId: boolean;
  idempotencyKey: string | null;
  resultRefs: QueueAgentWorkflowSafeJsonValue | null;
  runId: string | null;
  settingsHash: string | null;
  slot: string | null;
  status: string | null;
  targetRefs: QueueAgentWorkflowSafeJsonValue | null;
  taskId: string | null;
};

export type QueueAgentWorkflowReportDiagnostics = {
  recoveryState: {
    canDiagnoseWorkerEvidence: boolean;
    missingRefs: string[];
    suspectedBlocker: string | null;
  };
  refMaps: QueueAgentWorkflowRefMaps;
  startWorker: QueueAgentWorkflowStartWorkerDiagnostics;
};

export type QueueAgentWorkflowResumeDiagnostics = {
  blockers: QueueAgentWorkflowBlockerSummary[];
  continuationRefs: QueueAgentWorkflowRefMaps;
  missingRefs: QueueAgentWorkflowBlockerSummary[];
  nextPhase: string | null;
  nextStep: string | null;
  reasonIfNotSafe: string | null;
  recoveredRefs: QueueAgentWorkflowRefMaps;
  safeToRecordWorkerEvidence: boolean;
  startWorkerRefCheck: {
    actionPresent: boolean;
    actionStatus: string | null;
    executionTargetHashPresent: boolean;
    missingRefs: string[];
    runIdPresent: boolean;
    settingsHashPresent: boolean;
    slotPresent: boolean;
    taskIdPresent: boolean;
  };
  status: string;
  workerState: {
    evidenceState: string | null;
    latestRunId: string | null;
    latestRunStatus: string | null;
    runExists: boolean | null;
    runId: string | null;
    taskExists: boolean | null;
    taskId: string | null;
    ticketState: string | null;
    workerRunState: string | null;
  };
};

export type QueueAgentWorkflowReportResult =
  QueueAgentWorkflowNoMutationFlags &
    QueueAgentWorkflowRefMaps & {
      actionSummaryCount: number;
      actionCountSummary: QueueAgentWorkflowActionCountSummary;
      actionSummaries: QueueAgentWorkflowActionSummary[];
      blockers: QueueAgentWorkflowBlockerSummary[];
      completedAt: string | null;
      currentStep: string | null;
      diagnostics: QueueAgentWorkflowReportDiagnostics;
      nextAction: QueueAgentWorkflowSafeJsonValue | null;
      nextPhase: string | null;
      nextStep: string | null;
      persistentStatus: string;
      phase: string;
      reportSummary: string;
      requestId: string;
      resumeAvailable: boolean;
      resumeStatus: string;
      slotBindings: Record<string, QueueAgentWorkflowSlotBindingSummary>;
      slotBindingsSummary: QueueAgentWorkflowSafeJsonValue | null;
      status: string;
      truncatedActionSummaries: boolean;
      variablesSummary: QueueAgentWorkflowSafeJsonValue | null;
      workflowId: string;
      workflowRunId: string;
      workspaceId: string;
    };

export type QueueAgentWorkflowPlanResumeResult =
  QueueAgentWorkflowNoMutationFlags &
    QueueAgentWorkflowRefMaps & {
      actionCountSummary: QueueAgentWorkflowActionCountSummary;
      actionSummaries: QueueAgentWorkflowActionSummary[];
      blockers: QueueAgentWorkflowBlockerSummary[];
      diagnostics: QueueAgentWorkflowResumeDiagnostics;
      missingRefs: QueueAgentWorkflowBlockerSummary[];
      nextPhase: string | null;
      nextStep: string | null;
      persistentStatus: string;
      reconciledVariablesSummary: QueueAgentWorkflowSafeJsonValue | null;
      reportSummary: string;
      requiredConfirmation: boolean;
      requiredContinuationRefs: QueueAgentWorkflowRefMaps;
      requiredFreshGrant: boolean;
      resumeAvailable: boolean;
      resumeStatus: string;
      slotReconciliations: readonly {
        aggregateDependencyState: string | null;
        aggregateEvidenceState: string | null;
        aggregateReviewState: string | null;
        aggregateTicketState: string | null;
        blockerCode: string | null;
        completionDecisionExists: boolean;
        completionDecisionId: string | null;
        evidenceBundleId: string | null;
        evidenceExists: boolean;
        executorWidgetId: string | null;
        failureDecisionExists: boolean;
        failureDecisionId: string | null;
        messageId: string | null;
        reviewMessageExists: boolean;
        reviewMessageStatus: string | null;
        runExists: boolean;
        runId: string | null;
        slot: string;
        taskExists: boolean;
        taskId: string | null;
      }[];
      status: string;
      taskSnapshots: readonly {
        dependencyState: string;
        evidenceState: string;
        latestCompletionDecisionId: string | null;
        latestEvidenceBundleId: string | null;
        latestFailureDecisionId: string | null;
        latestReviewMessageId: string | null;
        latestRunId: string | null;
        reviewState: string;
        taskId: string;
        ticketState: string;
        validationState: string;
        workerRunState: string;
      }[];
      terminalStatus: string | null;
      workflowId: string;
      workflowRunId: string;
      workspaceId: string;
    };

export type QueueAgentWorkflowReadActionLogResult =
  QueueAgentWorkflowNoMutationFlags & {
    actionCountSummary: QueueAgentWorkflowActionCountSummary;
    actionTypeFilter: string | null;
    ambiguous: boolean;
    actions: QueueAgentWorkflowActionSummary[];
    blocker: QueueAgentWorkflowBlockerSummary | null;
    focusedAction: QueueAgentWorkflowFocusedAction | null;
    includeRefs: boolean;
    limit: number;
    matchingActions: QueueAgentWorkflowFocusedAction[];
    slotFilter: string | null;
    statusFilter: string | null;
    total: number;
    truncated: boolean;
    workflowId: string;
    workflowRunId: string;
    workspaceId: string;
  };

export type QueueAgentEnableResult = {
  backendOwned?: boolean;
  blockerReasons: string[];
  didAutoRunWorkers: false;
  didStartWorkers: false;
  globalExecutionState?: string;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  queueControlStatus?: "disabled" | "manual_enabled";
  queueEnabled: boolean;
  version?: number;
} & QueueAgentNextActionFields;

export type QueueAgentStartRunInput = {
  executorWidgetId?: string;
  queueId?: string;
  taskId?: string;
};

export type QueueAgentStartRunResult = {
  executorWidgetId: string;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
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
} & QueueAgentNextActionFields;

export type QueueAgentStartRunBlockedResult = {
  blockers?: AgentQueueItemAggregateBlocker[];
  blockerReasons: string[];
  executorWidgetId?: string;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  queueEnabled?: boolean;
  startedDirectWork: false;
  taskId?: string;
} & QueueAgentNextActionFields;

export type QueueAgentStartRunAttemptResult =
  | QueueAgentStartRunBlockedResult
  | QueueAgentStartRunResult;

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
} & QueueAgentNextActionFields;

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
  evidenceBundleId?: string;
  evidenceBundle?: QueueWorkerEvidenceBundleInput | QueueWorkerEvidenceBundle;
  finalAgentMessage?: string;
  messageId?: string;
  runId?: string;
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
  confirmationToken?: string;
  messageId?: string;
  reason?: string;
  reviewMessageId?: string;
  runId?: string;
  taskId?: string;
};

export type QueueAgentBlockInput = {
  blockedAt?: string;
  coordinatorAgentId?: string;
  decisionId?: string;
  reason?: string;
  taskId?: string;
};

export type QueueAgentFailInput = {
  confirmationToken?: string;
  evidenceBundleId?: string;
  messageId?: string;
  reason?: string;
  reviewMessageId?: string;
  runId?: string;
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
  backendCreateMessageStatus?: string;
  backendCompletionStatus?: string;
  backendFailureStatus?: string;
  blockerCode?: string;
  blockerMessage?: string;
  blockers?: AgentQueueItemAggregateBlocker[];
  evidenceBundleId?: string;
  evidenceBundleIdRequired?: boolean;
  evidenceBundle?: AgentQueueWorkerEvidenceBundle | null;
  evidenceState?: string;
  existingReviewMessageId?: string;
  dryRunOnly: boolean;
  durable?: boolean;
  completionDecision?: AgentQueueCompletionDecision | null;
  failureDecision?: AgentQueueFailureDecision | null;
  lifecycle: SmartQueueDogfoodLifecycleItem | null;
  messageId?: string;
  missingRequiredField?: string;
  missingNextActionInput?: string[];
  nextActions?: QueueAgentAggregateNextAction[];
  nextAction?: QueueCapabilityNextAction;
  nextActionUnavailable?: HobitNextActionUnavailable;
  nextActionUnavailableReason?: string;
  nextSuggestedCapability?: QueueAgentCapabilityId | null;
  previousAgentPromptState: SmartQueueDogfoodLifecycleItem["agentPromptState"];
  previousTicketState: SmartQueueDogfoodLifecycleItem["ticketState"] | string;
  productStatus?: string;
  queueMutation: "backend_domain" | "frontend_controller_overlay" | "none";
  reviewMessage?: unknown;
  reviewMessageAlreadyExists?: boolean;
  reviewState?: string;
  reviewOutcome: SmartQueueDogfoodReviewOutcome | null;
  runId?: string;
  runIdRequired?: boolean;
  taskId: string;
  ticketState: SmartQueueDogfoodLifecycleItem["ticketState"] | string;
  value?: unknown;
  workerRunState?: string;
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
  missingNextActionInput?: string[];
  nextActions?: QueueAgentAggregateNextAction[];
  nextAction?: QueueCapabilityNextAction;
  nextActionUnavailable?: HobitNextActionUnavailable;
  nextActionUnavailableReason?: string;
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
  missingNextActionInput?: string[];
  nextActions?: QueueAgentAggregateNextAction[];
  nextAction?: QueueCapabilityNextAction;
  nextActionUnavailable?: HobitNextActionUnavailable;
  nextActionUnavailableReason?: string;
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
    input: Required<Pick<QueueAgentFailInput, "confirmationToken" | "reason" | "taskId">> &
      Omit<QueueAgentFailInput, "confirmationToken" | "reason" | "taskId">,
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
    input: Required<Pick<QueueAgentMarkDoneInput, "confirmationToken" | "taskId">> &
      Omit<QueueAgentMarkDoneInput, "confirmationToken" | "taskId">,
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
  fieldPath?: string;
  fieldPaths?: string[];
  message: string;
  output?: TOutput;
  reasonCode?: HobitAgentActionReasonCode;
  reasons?: string[];
  status: QueueAgentCapabilityStatus;
};

export type QueueAgentMaybePromise<T> = T | Promise<T>;

export type QueueAgentAdapterApi = {
  backend?: QueueBackendCapabilityPort | null;
  dogfoodLifecycle?: QueueAgentDogfoodLifecycleAdapterApi;
  getQueueControlState?: (
    input: QueueAgentControlGetInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentControlGetResult>>;
  setQueueControlManualEnabled?: (
    input: QueueAgentControlSetManualEnabledInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentControlSetManualEnabledResult>>;
  enableQueue?: (
    input: QueueAgentEnableInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentEnableResult>>;
  getSingletonQueueTarget: () => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentSingletonTarget>>;
  listItems?: (
    input: QueueAgentListItemsInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentListItemsResult>>;
  getWorkflow?: (
    input: Required<Pick<QueueAgentWorkflowGetInput, "workflowRunId">> &
      Omit<QueueAgentWorkflowGetInput, "workflowRunId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentWorkflowGetResult>>;
  listWorkflows?: (
    input: QueueAgentWorkflowListInput,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentWorkflowListResult>>;
  getWorkflowReport?: (
    input: Required<Pick<QueueAgentWorkflowGetReportInput, "workflowRunId">> &
      Omit<QueueAgentWorkflowGetReportInput, "workflowRunId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentWorkflowReportResult>>;
  planWorkflowResume?: (
    input: Required<Pick<QueueAgentWorkflowPlanResumeInput, "workflowRunId">> &
      Omit<QueueAgentWorkflowPlanResumeInput, "workflowRunId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentWorkflowPlanResumeResult>>;
  readWorkflowActionLog?: (
    input: Required<Pick<QueueAgentWorkflowReadActionLogInput, "workflowRunId">> &
      Omit<QueueAgentWorkflowReadActionLogInput, "workflowRunId">,
    context: QueueAgentLifecycleHandlerContext,
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentWorkflowReadActionLogResult>>;
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
  ) => QueueAgentMaybePromise<QueueAgentAdapterResult<QueueAgentStartRunAttemptResult>>;
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

export function queueNextActionUnavailableFields({
  ambiguousCandidateIds = [],
  invalidPayloadReason,
  missingRequiredInputs = [],
  reasonCode,
  reasonMessage,
}: HobitNextActionUnavailable): QueueAgentNextActionFields {
  const nextActionUnavailable = createHobitNextActionUnavailable({
    ambiguousCandidateIds,
    invalidPayloadReason,
    missingRequiredInputs,
    reasonCode,
    reasonMessage,
  });

  return {
    ...(ambiguousCandidateIds.length > 0
      ? { candidateTaskIds: [...ambiguousCandidateIds] }
      : {}),
    ...(missingRequiredInputs.length > 0
      ? { missingNextActionInput: [...missingRequiredInputs] }
      : {}),
    nextActionUnavailable,
    nextActionUnavailableCode: reasonCode,
    nextActionUnavailableReason: reasonMessage,
  };
}

export function queueAgentCapabilityStatusToBrokerStatus(
  status: QueueAgentCapabilityStatus,
): HobitAgentActionStatus {
  return status === "confirmation_required" ? "needs_confirmation" : status;
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
  const nextAction = buildQueueCapabilityNextAction({
    capabilityId: "queue.item.updateRunSettings",
    input: { taskId: item.id },
    reason: "New Queue item needs task-scoped run settings before it can run.",
  });
  return {
    dependencies: [...item.dependencies],
    id: item.id,
    ...(nextAction.ok
      ? { nextAction: nextAction.nextAction }
      : queueNextActionUnavailableFields({
          invalidPayloadReason: nextAction.reason,
          missingRequiredInputs: nextAction.missingRequiredFields,
          reasonCode: "invalid_next_action_payload",
          reasonMessage: nextAction.reason,
        })),
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
