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
import { queueControlStateFromBridge } from "./queueBridgeControlCapabilities";
import {
  nextActionFieldsForSuggestedCapability,
  statePart,
} from "./queueBridgeNextActionHelpers";
import { cleanString } from "./queueBridgePrimitiveHelpers";
import { bridgeUnavailableResult } from "./queueBridgeResultHelpers";
import {
  invalidReviewCommandInput,
  previewReviewCommandFromAggregate,
  reviewActorId,
  reviewCommandFailed,
} from "./queueBridgeReviewCapabilities";
import { queueTaskSummaryFromAggregate } from "./queueBridgeTaskProjection";

export async function markDoneThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentMarkDoneInput, "confirmationToken" | "taskId">> &
    Omit<QueueAgentMarkDoneInput, "confirmationToken" | "taskId">,
  context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>> {
  const taskId = input.taskId.trim();
  const confirmationToken = input.confirmationToken.trim();
  if (!taskId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
      "queue.item.markDone requires taskId.",
    );
  }
  if (confirmationToken !== QUEUE_START_RUN_CONFIRMATION_TOKEN) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
      "queue.item.markDone requires exact structured confirmation.",
    );
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
      "Queue accepted completion command API is unavailable.",
    );
  }

  if (context.dryRun) {
    return previewReviewCommandFromAggregate(
      backendApi,
      queueControlStateFromBridge(bridge),
      taskId,
      context,
      "Queue accepted completion preview prepared.",
      "Queue item accepted as done",
      QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
    );
  }

  try {
    const result = await backendApi.markItemDone({
      actorId: reviewActorId(undefined, context),
      confirmationToken,
      reason: cleanString(input.reason),
      reviewMessageId:
        cleanString(input.reviewMessageId) ?? cleanString(input.messageId) ?? null,
      runId: cleanString(input.runId) ?? null,
      taskId,
    });

    if (result.status !== "succeeded" && result.status !== "already_done") {
      return completionCommandBlocked(
        result,
        queueControlStateFromBridge(bridge),
        QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
      );
    }

    return completionCommandSucceeded(
      result,
      queueControlStateFromBridge(bridge),
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue accepted completion request failed before backend blocker details were returned.",
      QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
    );
  }
}

export async function failItemThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentFailInput, "confirmationToken" | "reason" | "taskId">> &
    Omit<QueueAgentFailInput, "confirmationToken" | "reason" | "taskId">,
  context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>> {
  const taskId = input.taskId.trim();
  const confirmationToken = input.confirmationToken.trim();
  const reason = input.reason.trim();
  if (!taskId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
      "queue.item.fail requires taskId.",
    );
  }
  if (!reason) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
      "queue.item.fail requires reason.",
    );
  }
  if (confirmationToken !== QUEUE_START_RUN_CONFIRMATION_TOKEN) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
      "queue.item.fail requires exact structured confirmation.",
    );
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
      "Queue terminal failure command API is unavailable.",
    );
  }

  if (context.dryRun) {
    return previewReviewCommandFromAggregate(
      backendApi,
      queueControlStateFromBridge(bridge),
      taskId,
      context,
      "Queue terminal failure preview prepared.",
      "Queue item terminal failure",
      QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
    );
  }

  try {
    const result = await backendApi.failItem({
      actorId: reviewActorId(undefined, context),
      confirmationToken,
      evidenceBundleId: cleanString(input.evidenceBundleId) ?? null,
      reason,
      reviewMessageId:
        cleanString(input.reviewMessageId) ?? cleanString(input.messageId) ?? null,
      runId: cleanString(input.runId) ?? null,
      taskId,
    });

    if (result.status !== "succeeded" && result.status !== "already_failed") {
      return failureCommandBlocked(
        result,
        queueControlStateFromBridge(bridge),
        QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
      );
    }

    return failureCommandSucceeded(
      result,
      queueControlStateFromBridge(bridge),
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue terminal failure request failed before backend blocker details were returned.",
      QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
    );
  }
}

export function completionCommandSucceeded(
  result: AgentQueueCompletionCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  if (!result.aggregate) {
    const failureMessage =
      "Queue accepted completion returned an incomplete backend success.";
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone],
      message: failureMessage,
      reasons: [failureMessage],
      reasonCode: "unexpected_error",
      status: "failed_unexpected",
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone],
    message:
      result.status === "already_done"
        ? "Queue item was already done."
        : "Queue item marked done.",
    output: completionTransitionOutputFromBackend({
      actionLabel:
        result.status === "already_done"
          ? "Queue item already done"
          : "Queue item marked done",
      queueControlState,
      queueMutation: result.status === "succeeded" ? "backend_domain" : "none",
      result,
    }),
    reasonCode: result.status === "already_done" ? "already_done" : undefined,
    status: result.status === "already_done" ? "already_done" : "succeeded",
  };
}

export function failureCommandSucceeded(
  result: AgentQueueFailureCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  if (!result.aggregate) {
    const failureMessage =
      "Queue terminal failure returned an incomplete backend success.";
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleItemFail],
      message: failureMessage,
      reasons: [failureMessage],
      reasonCode: "unexpected_error",
      status: "failed_unexpected",
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleItemFail],
    message:
      result.status === "already_failed"
        ? "Queue item was already failed."
        : "Queue item marked failed.",
    output: failureTransitionOutputFromBackend({
      actionLabel:
        result.status === "already_failed"
          ? "Queue item already failed"
          : "Queue item marked failed",
      queueControlState,
      queueMutation: result.status === "succeeded" ? "backend_domain" : "none",
      result,
    }),
    reasonCode:
      result.status === "already_failed" ? "already_failed" : undefined,
    status: result.status === "already_failed" ? "already_failed" : "succeeded",
  };
}

export function completionCommandBlocked(
  result: AgentQueueCompletionCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  const message = completionBlockerMessage(result);
  const output = completionTransitionOutputFromBackend({
    actionLabel: "Queue accepted completion blocked",
    queueControlState,
    queueMutation: "none",
    result,
  });
  return {
    activityEventNames: [...activityEventNames],
    message,
    output,
    reasonCode: completionCommandReasonCode(result),
    reasons: [message],
    status: completionCommandStatus(result, output),
  };
}

export function failureCommandBlocked(
  result: AgentQueueFailureCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  const message = failureBlockerMessage(result);
  const output = failureTransitionOutputFromBackend({
    actionLabel: "Queue terminal failure blocked",
    queueControlState,
    queueMutation: "none",
    result,
  });
  return {
    activityEventNames: [...activityEventNames],
    message,
    output,
    reasonCode: failureCommandReasonCode(result),
    reasons: [message],
    status: failureCommandStatus(result, output),
  };
}

export function completionCommandStatus(
  result: AgentQueueCompletionCommandResult,
  output: QueueAgentLifecycleTransitionOutput,
): QueueAgentCapabilityStatus {
  if (result.status === "invalid_input") {
    return "invalid_input";
  }

  if (result.status === "already_done") {
    return "already_done";
  }

  return output.nextAction ? "blocked_actionable" : "precondition_failed";
}

export function completionCommandReasonCode(
  result: AgentQueueCompletionCommandResult,
) {
  if (result.blocker?.blockerCode) {
    return result.blocker.blockerCode;
  }

  if (result.status === "invalid_input") {
    return "invalid_payload";
  }

  if (result.status === "already_done") {
    return "already_done";
  }

  return "precondition_failed";
}

export function failureCommandStatus(
  result: AgentQueueFailureCommandResult,
  output: QueueAgentLifecycleTransitionOutput,
): QueueAgentCapabilityStatus {
  if (result.status === "invalid_input") {
    return "invalid_input";
  }

  if (result.status === "already_done") {
    return "already_done";
  }

  if (result.status === "already_failed") {
    return "already_failed";
  }

  return output.nextAction ? "blocked_actionable" : "precondition_failed";
}

export function failureCommandReasonCode(result: AgentQueueFailureCommandResult) {
  if (result.blocker?.blockerCode) {
    return result.blocker.blockerCode;
  }

  if (result.status === "invalid_input") {
    return "invalid_payload";
  }

  if (result.status === "already_done") {
    return "already_done";
  }

  if (result.status === "already_failed") {
    return "already_failed";
  }

  return "precondition_failed";
}

export function completionTransitionOutputFromBackend({
  actionLabel,
  queueControlState,
  queueMutation,
  result,
}: {
  actionLabel: string;
  queueControlState: WorkspaceAgentQueueControlState | null;
  queueMutation: "backend_domain" | "none";
  result: AgentQueueCompletionCommandResult;
}): QueueAgentLifecycleTransitionOutput {
  const blocker = result.blocker;
  const aggregate = result.aggregate;
  const summary = aggregate
    ? queueTaskSummaryFromAggregate(aggregate, queueControlState)
    : null;
  const blockers = aggregate?.blockers ?? (blocker
    ? [{ code: blocker.blockerCode, message: blocker.blockerMessage }]
    : []);
  const backendNext =
    (blocker?.nextSuggestedCapability as
      | QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"]
      | undefined) ??
    (aggregate?.ticketState === "done" ? null : summary?.nextSuggestedCapability) ??
    null;
  const nextSuggestedCapability = completionSafeNextCapability(backendNext);
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    evidenceBundleId:
      result.evidenceBundleId ?? blocker?.evidenceBundleId ?? undefined,
    messageId: result.reviewMessageId ?? blocker?.reviewMessageId ?? undefined,
    nextSuggestedCapability,
    reason:
      "Queue completion result exposed a safe read-only follow-up capability.",
    runId: result.runId ?? blocker?.runId ?? undefined,
    taskId: result.taskId,
  });

  return {
    actionLabel,
    additionalPromptCount: 0,
    agentPromptState: "completed",
    aggregate: aggregate ?? undefined,
    backendCompletionStatus: result.status,
    blockerCode: blocker?.blockerCode,
    blockerMessage: blocker?.blockerMessage,
    blockers,
    completionDecision: result.completionDecision,
    dryRunOnly: false,
    durable: result.durable,
    evidenceBundleId:
      result.evidenceBundleId ?? blocker?.evidenceBundleId ?? undefined,
    evidenceState: aggregate?.evidenceState ?? blocker?.evidenceState ?? undefined,
    lifecycle: null,
    messageId:
      result.reviewMessageId ?? blocker?.reviewMessageId ?? undefined,
    missingRequiredField: blocker?.missingRequiredField ?? undefined,
    ...nextActionFields,
    nextActions: summary?.nextActions ?? [],
    nextSuggestedCapability,
    previousAgentPromptState: "completed",
    previousTicketState: blocker?.ticketState ?? aggregate?.ticketState ?? "unknown",
    queueMutation,
    reviewMessage: result.completionDecision ?? blocker ?? undefined,
    reviewOutcome: null,
    reviewState: aggregate?.reviewState ?? blocker?.reviewState ?? undefined,
    runId: result.runId ?? blocker?.runId ?? undefined,
    taskId: result.taskId,
    ticketState: aggregate?.ticketState ?? blocker?.ticketState ?? "unknown",
    value: result.completionDecision ?? blocker ?? result,
    workerRunState:
      aggregate?.workerRunState ?? blocker?.workerRunState ?? undefined,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: queueMutation === "backend_domain" && result.durable,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

export function failureTransitionOutputFromBackend({
  actionLabel,
  queueControlState,
  queueMutation,
  result,
}: {
  actionLabel: string;
  queueControlState: WorkspaceAgentQueueControlState | null;
  queueMutation: "backend_domain" | "none";
  result: AgentQueueFailureCommandResult;
}): QueueAgentLifecycleTransitionOutput {
  const blocker = result.blocker;
  const aggregate = result.aggregate;
  const summary = aggregate
    ? queueTaskSummaryFromAggregate(aggregate, queueControlState)
    : null;
  const blockers = aggregate?.blockers ?? (blocker
    ? [{ code: blocker.blockerCode, message: blocker.blockerMessage }]
    : []);
  const backendNext =
    result.status === "succeeded" || result.status === "already_failed"
      ? null
      : ((blocker?.nextSuggestedCapability as
          | QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"]
          | undefined) ??
        summary?.nextSuggestedCapability ??
        null);
  const nextSuggestedCapability = failureSafeNextCapability(backendNext);
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    evidenceBundleId:
      result.evidenceBundleId ?? blocker?.evidenceBundleId ?? undefined,
    messageId: result.reviewMessageId ?? blocker?.reviewMessageId ?? undefined,
    nextSuggestedCapability,
    reason:
      "Queue failure result exposed a safe read-only follow-up capability.",
    runId: result.runId ?? blocker?.runId ?? undefined,
    taskId: result.taskId,
  });
  const agentPromptState =
    aggregate?.workerRunState === "failed" ? "failed" : "completed";

  return {
    actionLabel,
    additionalPromptCount: 0,
    agentPromptState,
    aggregate: aggregate ?? undefined,
    backendFailureStatus: result.status,
    blockerCode: blocker?.blockerCode,
    blockerMessage: blocker?.blockerMessage,
    blockers,
    dryRunOnly: false,
    durable: result.durable,
    evidenceBundleId:
      result.evidenceBundleId ?? blocker?.evidenceBundleId ?? undefined,
    evidenceState: aggregate?.evidenceState ?? blocker?.evidenceState ?? undefined,
    failureDecision: result.failureDecision,
    lifecycle: null,
    messageId:
      result.reviewMessageId ?? blocker?.reviewMessageId ?? undefined,
    missingRequiredField: blocker?.missingRequiredField ?? undefined,
    ...nextActionFields,
    nextActions: summary?.nextActions ?? [],
    nextSuggestedCapability,
    previousAgentPromptState: agentPromptState,
    previousTicketState: blocker?.ticketState ?? aggregate?.ticketState ?? "unknown",
    queueMutation,
    reviewMessage: result.failureDecision ?? blocker ?? undefined,
    reviewOutcome:
      aggregate?.ticketState === "failure" || result.failureDecision ? "failed" : null,
    reviewState: aggregate?.reviewState ?? blocker?.reviewState ?? undefined,
    runId: result.runId ?? blocker?.runId ?? undefined,
    taskId: result.taskId,
    ticketState: aggregate?.ticketState ?? blocker?.ticketState ?? "unknown",
    value: result.failureDecision ?? blocker ?? result,
    workerRunState:
      aggregate?.workerRunState ?? blocker?.workerRunState ?? undefined,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: queueMutation === "backend_domain" && result.durable,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

export function completionBlockerMessage(result: AgentQueueCompletionCommandResult) {
  const blocker = result.blocker;
  const stateParts = [
    statePart("ticketState", blocker?.ticketState ?? result.aggregate?.ticketState),
    statePart(
      "workerRunState",
      blocker?.workerRunState ?? result.aggregate?.workerRunState,
    ),
    statePart("reviewState", blocker?.reviewState ?? result.aggregate?.reviewState),
    statePart(
      "evidenceState",
      blocker?.evidenceState ?? result.aggregate?.evidenceState,
    ),
    statePart(
      "dependencyState",
      blocker?.dependencyState ?? result.aggregate?.dependencyState,
    ),
  ].filter(Boolean);

  return [
    blocker?.blockerMessage ??
      "Queue accepted completion is blocked by backend preconditions.",
    stateParts.length > 0 ? `(${stateParts.join(", ")})` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function failureBlockerMessage(result: AgentQueueFailureCommandResult) {
  const blocker = result.blocker;
  const stateParts = [
    statePart("ticketState", blocker?.ticketState ?? result.aggregate?.ticketState),
    statePart(
      "workerRunState",
      blocker?.workerRunState ?? result.aggregate?.workerRunState,
    ),
    statePart("reviewState", blocker?.reviewState ?? result.aggregate?.reviewState),
    statePart(
      "evidenceState",
      blocker?.evidenceState ?? result.aggregate?.evidenceState,
    ),
    statePart(
      "dependencyState",
      blocker?.dependencyState ?? result.aggregate?.dependencyState,
    ),
  ].filter(Boolean);

  return [
    blocker?.blockerMessage ??
      "Queue terminal failure is blocked by backend preconditions.",
    stateParts.length > 0 ? `(${stateParts.join(", ")})` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function completionSafeNextCapability(
  backendNext: QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"],
): QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"] {
  switch (backendNext) {
    case "queue.lifecycle.get":
    case "queue.review.getEvidenceBundle":
      return backendNext;
    case "queue.review.ack":
    case "queue.review.createMessage":
      return "queue.lifecycle.get";
    default:
      return null;
  }
}

export function failureSafeNextCapability(
  backendNext: QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"],
): QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"] {
  switch (backendNext) {
    case "queue.lifecycle.get":
    case "queue.review.getEvidenceBundle":
      return backendNext;
    case "queue.review.ack":
    case "queue.review.createMessage":
      return "queue.lifecycle.get";
    default:
      return null;
  }
}
