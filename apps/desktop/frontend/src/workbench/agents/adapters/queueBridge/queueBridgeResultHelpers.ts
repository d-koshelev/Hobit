import type {
  WorkspaceAgentQueueBridge,
  WorkspaceAgentQueueControlState,
} from "../../../workspaceAgentQueueBridge";
import type {
  AgentQueueItemAggregate,
  AgentQueueCompletionCommandResult,
  AgentQueueFailureCommandResult,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
  AgentQueueWorkflowAction,
  AgentQueueWorkflowReport,
  AgentQueueWorkflowResumeBlocker,
  AgentQueueWorkflowResumePlan,
  AgentQueueWorkflowRun,
  AgentQueueWorkflowSlotReconciliation,
  AgentQueueWorkflowTaskResumeSnapshot,
} from "../../../../workspace/types";
import {
  createQueueBackendCapabilityPort,
  type QueueBackendCapabilityPort,
} from "../queueBackendCapabilityPort";
import {
  buildQueueCapabilityNextAction,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../../capabilities/queueCapabilityContracts";
import { createInMemoryQueueDogfoodLifecycleAdapterApi } from "../queueAgentDogfoodLifecycleController";
import { createDefaultQueueAgentAdapterApi } from "../queueAgentCapabilities";
import {
  createQueueAgentItemsPreview,
  queueAgentCreatedItem,
  queueNextActionUnavailableFields,
  QUEUE_ACTIVITY_EVENTS,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentAggregateNextAction,
  type QueueAgentCapabilityStatus,
  type QueueAgentControlGetInput,
  type QueueAgentControlGetResult,
  type QueueAgentControlSetManualEnabledInput,
  type QueueAgentControlSetManualEnabledResult,
  type QueueAgentCreateItemsRequest,
  type QueueAgentCreateItemsResult,
  type QueueAgentCreatedItem,
  type QueueAgentEnableInput,
  type QueueAgentEnableResult,
  type QueueAgentExecutorTarget,
  type QueueAgentLifecycleTaskSeed,
  type QueueAgentLifecycleAgentFinishedInput,
  type QueueAgentLifecycleGetInput,
  type QueueAgentLifecycleGetOutput,
  type QueueAgentLifecycleHandlerContext,
  type QueueAgentLifecycleTransitionOutput,
  type QueueAgentListItemsInput,
  type QueueAgentListItemsResult,
  type QueueAgentFailInput,
  type QueueAgentMarkDoneInput,
  type QueueAgentPromoteDraftResult,
  type QueueAgentPromptPackInput,
  type QueueAgentRunApprovalPolicy,
  type QueueAgentRunSandbox,
  type QueueAgentNextActionFields,
  type QueueAgentReviewAckInput,
  type QueueAgentReviewCreateMessageInput,
  type QueueAgentReviewEvidenceBundleInput,
  type QueueAgentReviewEvidenceBundleOutput,
  type QueueAgentStartRunAttemptResult,
  type QueueAgentTaskReadiness,
  type QueueAgentTaskSummary,
  type QueueAgentUpdateRunSettingsInput,
  type QueueAgentUpdateRunSettingsResult,
  type QueueAgentWorkflowActionCountSummary,
  type QueueAgentWorkflowFocusedAction,
  type QueueAgentWorkflowActionSummary,
  type QueueAgentWorkflowBlockerSummary,
  type QueueAgentWorkflowGetInput,
  type QueueAgentWorkflowGetReportInput,
  type QueueAgentWorkflowGetResult,
  type QueueAgentWorkflowListInput,
  type QueueAgentWorkflowListResult,
  type QueueAgentWorkflowNoMutationFlags,
  type QueueAgentWorkflowPlanResumeInput,
  type QueueAgentWorkflowPlanResumeResult,
  type QueueAgentWorkflowReadActionLogInput,
  type QueueAgentWorkflowReadActionLogResult,
  type QueueAgentWorkflowRefMaps,
  type QueueAgentWorkflowReportDiagnostics,
  type QueueAgentWorkflowReportResult,
  type QueueAgentWorkflowResumeDiagnostics,
  type QueueAgentWorkflowRunSummary,
  type QueueAgentWorkflowSafeJsonValue,
  type QueueAgentWorkflowSlotBindingSummary,
} from "../queueAgentCapabilityTypes";
import type {
  QueueUpdateItemPatch,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "../../../queue/agentQueueWidgetApiTypes";

export function createUnavailableDogfoodLifecycleAdapterApi(): NonNullable<
  QueueAgentAdapterApi["dogfoodLifecycle"]
> {
  return {
    ackReview: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
        "Queue review command API is unavailable.",
      ),
    addFollowUpPrompt: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleFollowUpPromptAdded,
        "Queue follow-up prompt is transitional and requires the Queue controller overlay.",
      ),
    agentFinished: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
        "Queue worker evidence command API is unavailable.",
      ),
    approveValidation: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleValidationApproved,
        "Queue validation approval is transitional and requires the Queue controller overlay.",
      ),
    blockItem: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleItemBlock,
        "Queue block is transitional and requires the Queue controller overlay.",
      ),
    createReviewMessage: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
        "Queue review command API is unavailable.",
      ),
    failItem: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
        "Queue terminal failure command API is unavailable.",
      ),
    getEvidenceBundle: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle,
        "Queue worker evidence read API is unavailable.",
      ),
    getLifecycle: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleGet,
        "Queue aggregate lifecycle read API is unavailable.",
      ),
    markDone: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
        "Queue accepted completion command API is unavailable.",
      ),
  };
}

export function unavailableLifecycleResult<TOutput>(
  activityEventNames: readonly string[],
  message: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasonCode: "capability_unavailable",
    reasons: [message],
    status: "unavailable",
  };
}

export function adapterFailure<TOutput>(
  result: QueueAgentAdapterResult<unknown>,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: result.activityEventNames,
    fieldPath: result.fieldPath,
    fieldPaths: result.fieldPaths,
    message: result.message,
    reasonCode: result.reasonCode,
    reasons: result.reasons,
    status: result.status,
  };
}

export function bridgeUnavailableResult<TOutput>(
  activityEventNames: readonly string[],
  message: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasonCode: "capability_unavailable",
    reasons: [message],
    status: "unavailable",
  };
}

export function aggregateReadUnavailableResult<TOutput>(
  activityEventNames: readonly string[],
  error: unknown,
  fallbackMessage: string,
): QueueAgentAdapterResult<TOutput> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    status: "unavailable",
  };
}

