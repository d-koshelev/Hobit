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
import { cleanString } from "./queueBridgePrimitiveHelpers";

export function statePart(label: string, value: string | null | undefined) {
  return value ? `${label}=${value}` : null;
}

export function nextActionFieldsForSuggestedCapability({
  executorWidgetId,
  evidenceBundleId,
  messageId,
  nextSuggestedCapability,
  reason,
  runId,
  taskId,
}: {
  executorWidgetId?: string | null;
  evidenceBundleId?: string | null;
  messageId?: string | null;
  nextSuggestedCapability?: string | null;
  reason: string;
  runId?: string | null;
  taskId?: string | null;
}): QueueAgentNextActionFields {
  if (!nextSuggestedCapability) {
    return {};
  }

  switch (nextSuggestedCapability) {
    case "queue.enable":
    case "queue.items.list":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: {},
        reason,
      });
    case "queue.item.promoteDraft":
    case "queue.item.updateRunSettings":
    case "queue.lifecycle.get":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ taskId }),
        reason,
      });
    case "queue.item.startRun":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ executorWidgetId, taskId }),
        reason,
      });
    case "queue.review.ack":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ messageId, taskId }),
        reason,
      });
    case "queue.review.createMessage":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ evidenceBundleId, runId, taskId }),
        reason,
      });
    case "queue.review.getEvidenceBundle":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ runId, taskId }),
        reason,
      });
    default:
      return queueNextActionUnavailableFields({
        reasonCode: "next_action_unavailable",
        reasonMessage: `${nextSuggestedCapability} is not a supported Queue nextAction target.`,
      });
  }
}

export function queueNextActionFields({
  autoContinuationSafe,
  capabilityId,
  input,
  reason,
}: {
  autoContinuationSafe?: boolean;
  capabilityId: string;
  input: Record<string, unknown>;
  reason: string;
}): QueueAgentNextActionFields {
  const result = buildQueueCapabilityNextAction({
    autoContinuationSafe,
    capabilityId,
    input,
    reason,
  });

  return result.ok
    ? { nextAction: result.nextAction }
    : queueNextActionUnavailableFields({
        invalidPayloadReason: result.reason,
        missingRequiredInputs: result.missingRequiredFields,
        reasonCode: result.missingRequiredFields.length > 0
          ? "missing_required_input"
          : "invalid_next_action_payload",
        reasonMessage: result.reason,
      });
}

export function compactNextActionInput(
  input: Record<string, string | null | undefined>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => Boolean(cleanString(value))),
  );
}
