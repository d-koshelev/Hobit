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
import {
  cleanString,
  normalizeChangedFilesSummary,
} from "./queueBridgePrimitiveHelpers";
import {
  aggregateReadUnavailableResult,
  bridgeUnavailableResult,
} from "./queueBridgeResultHelpers";
import { queueTaskSummaryFromAggregate } from "./queueBridgeTaskProjection";

export async function createReviewMessageThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentReviewCreateMessageInput, "taskId">> &
    Omit<QueueAgentReviewCreateMessageInput, "taskId">,
  context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>> {
  const taskId = input.taskId.trim();
  if (!taskId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
      "queue.review.createMessage requires taskId.",
    );
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
      "Queue review command API is unavailable.",
    );
  }

  if (context.dryRun) {
    return previewReviewCommandFromAggregate(
      backendApi,
      queueControlStateFromBridge(bridge),
      taskId,
      context,
      "Queue review message creation preview prepared.",
      "Queue review message created",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
    );
  }

  try {
    const result = await backendApi.createReviewMessage({
      actorId: reviewActorId(input.coordinatorAgentId, context),
      evidenceBundleId: cleanString(input.evidenceBundleId) ?? null,
      messageBody: reviewMessageBodyFromInput(input),
      runId: cleanString(input.runId) ?? null,
      taskId,
    });
    if (result.status !== "succeeded") {
      return reviewCreateMessageBlocked(
        result,
        queueControlStateFromBridge(bridge),
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
      );
    }
    return reviewCreateMessageSucceeded(
      result,
      queueControlStateFromBridge(bridge),
      "Queue review message created.",
      "Queue review message created",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue review message create request failed before backend blocker details were returned.",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
    );
  }
}

export async function ackReviewThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentReviewAckInput, "messageId" | "taskId">> &
    Omit<QueueAgentReviewAckInput, "messageId" | "taskId">,
  context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>> {
  const taskId = input.taskId.trim();
  const messageId = input.messageId.trim();
  if (!taskId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
      "queue.review.ack requires taskId.",
    );
  }
  if (!messageId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
      "queue.review.ack requires messageId.",
    );
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
      "Queue review command API is unavailable.",
    );
  }

  if (context.dryRun) {
    return previewReviewCommandFromAggregate(
      backendApi,
      queueControlStateFromBridge(bridge),
      taskId,
      context,
      "Queue review acknowledgment preview prepared.",
      "Queue review acknowledged",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
    );
  }

  try {
    const result = await backendApi.ackReviewMessage({
      actorId: reviewActorId(input.coordinatorAgentId, context),
      messageId,
      taskId,
    });
    return reviewCommandSucceeded(
      result,
      queueControlStateFromBridge(bridge),
      "Queue review acknowledged.",
      "Queue review acknowledged",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
      "queue.lifecycle.get",
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue review message could not be acknowledged.",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
    );
  }
}

export async function previewReviewCommandFromAggregate(
  backendApi: QueueBackendCapabilityPort,
  queueControlState: WorkspaceAgentQueueControlState | null,
  taskId: string,
  context: QueueAgentLifecycleHandlerContext,
  message: string,
  actionLabel: string,
  activityEventNames: readonly string[],
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>> {
  try {
    const aggregate = await backendApi.getItemAggregate({ taskId });
    if (!aggregate) {
      return {
        activityEventNames: [...activityEventNames],
        message: `Queue item "${taskId}" was not found.`,
        reasonCode: "precondition_failed",
        reasons: [`Queue item "${taskId}" was not found.`],
        status: "precondition_failed",
      };
    }

    return {
      activityEventNames: [...activityEventNames],
      message,
      output: reviewTransitionOutputFromAggregate({
        actionLabel,
        aggregate,
        queueControlState,
        context,
        durable: false,
        queueMutation: "none",
      }),
      status: "succeeded",
    };
  } catch (error) {
    return aggregateReadUnavailableResult(
      activityEventNames,
      error,
      "Queue aggregate lifecycle read API is unavailable.",
    );
  }
}

export function reviewCommandSucceeded(
  result: AgentQueueReviewCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
  message: string,
  actionLabel: string,
  activityEventNames: readonly string[],
  nextSuggestedCapabilityOverride?: QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"],
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    output: reviewTransitionOutputFromAggregate({
      actionLabel,
      aggregate: result.aggregate,
      queueControlState,
      context: null,
      durable: result.durable,
      messageId: result.messageId,
      nextSuggestedCapabilityOverride,
      queueMutation: "backend_domain",
      reviewMessage: result.reviewMessage,
    }),
    status: "succeeded",
  };
}

export function reviewCreateMessageSucceeded(
  result: AgentQueueReviewCreateMessageResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
  message: string,
  actionLabel: string,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  if (!result.aggregate || !result.messageId || !result.reviewMessage) {
    const failureMessage =
      "Queue review message create returned an incomplete backend success.";
    return {
      activityEventNames: [...activityEventNames],
      message: failureMessage,
      reasons: [failureMessage],
      reasonCode: "unexpected_error",
      status: "failed_unexpected",
    };
  }

  return {
    activityEventNames: [...activityEventNames],
    message,
    output: reviewTransitionOutputFromAggregate({
      actionLabel,
      aggregate: result.aggregate,
      backendCreateMessageStatus: result.status,
      evidenceBundleId: result.evidenceBundleId ?? undefined,
      queueControlState,
      context: null,
      durable: result.durable,
      messageId: result.messageId,
      queueMutation: "backend_domain",
      reviewMessage: result.reviewMessage,
      runId: result.runId ?? undefined,
    }),
    status: "succeeded",
  };
}

export function reviewCreateMessageBlocked(
  result: AgentQueueReviewCreateMessageResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  const message = reviewCreateMessageBlockerMessage(result);
  const isDuplicateWithKnownMessage =
    result.blocker?.blockerCode === "review_message_already_exists" &&
    Boolean(result.blocker.existingMessageId);
  const output = reviewCreateMessageBlockedOutput(result, queueControlState);
  return {
    activityEventNames: [...activityEventNames],
    message,
    output,
    ...(isDuplicateWithKnownMessage ? {} : { reasons: [message] }),
    reasonCode:
      result.blocker?.blockerCode ??
      (result.status === "invalid_input"
        ? "invalid_payload"
        : result.status === "already_exists"
          ? "review_message_already_exists"
          : "precondition_failed"),
    status: isDuplicateWithKnownMessage
      ? "already_exists"
      : result.status === "invalid_input"
        ? "invalid_input"
        : output.nextAction
          ? "blocked_actionable"
          : "precondition_failed",
  };
}

export function reviewCommandFailed<TOutput>(
  error: unknown,
  fallbackMessage: string,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<TOutput> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error.trim()
        : fallbackMessage;
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    reasonCode: "unexpected_error",
    status: "failed_unexpected",
  };
}

export function invalidReviewCommandInput<TOutput>(
  activityEventNames: readonly string[],
  message: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasonCode: "invalid_payload",
    reasons: [message],
    status: "invalid_input",
  };
}

export function reviewTransitionOutputFromAggregate({
  actionLabel,
  aggregate,
  backendCreateMessageStatus,
  blocker,
  evidenceBundleId,
  queueControlState,
  context,
  durable,
  messageId,
  nextSuggestedCapabilityOverride,
  queueMutation,
  reviewMessage,
  runId,
}: {
  actionLabel: string;
  aggregate: AgentQueueItemAggregate;
  backendCreateMessageStatus?: string;
  blocker?: AgentQueueReviewCreateMessageResult["blocker"];
  evidenceBundleId?: string;
  queueControlState: WorkspaceAgentQueueControlState | null;
  context: QueueAgentLifecycleHandlerContext | null;
  durable: boolean;
  messageId?: string;
  nextSuggestedCapabilityOverride?: QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"];
  queueMutation: "backend_domain" | "none";
  reviewMessage?: unknown;
  runId?: string;
}): QueueAgentLifecycleTransitionOutput {
  const summary = queueTaskSummaryFromAggregate(aggregate, queueControlState);
  const selectedEvidenceBundleId =
    evidenceBundleId ?? blocker?.evidenceBundleId ?? undefined;
  const selectedRunId =
    runId ?? blocker?.runId ?? aggregate.latestRun?.runId ?? undefined;
  const selectedMessageId = messageId ?? blocker?.existingMessageId ?? undefined;
  const nextSuggestedCapability =
    nextSuggestedCapabilityOverride ??
    ((blocker?.nextSuggestedCapability as
      | QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"]
      | undefined) ||
      summary.nextSuggestedCapability ||
      null);
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    evidenceBundleId: selectedEvidenceBundleId,
    messageId: selectedMessageId,
    nextSuggestedCapability,
    reason:
      "Queue review result exposed the next review lifecycle capability.",
    runId: selectedRunId,
    taskId: aggregate.taskId,
  });
  const productStatus =
    backendCreateMessageStatus === "already_exists" ||
    blocker?.blockerCode === "review_message_already_exists"
      ? "already_exists"
      : blocker && nextActionFields.nextAction
        ? "blocked_actionable"
        : undefined;

  return {
    actionLabel,
    additionalPromptCount: 0,
    agentPromptState: "completed",
    aggregate,
    backendCreateMessageStatus,
    blockerCode: blocker?.blockerCode,
    blockerMessage: blocker?.blockerMessage,
    blockers: aggregate.blockers,
    dryRunOnly: context?.dryRun ?? false,
    durable,
    evidenceBundleId: selectedEvidenceBundleId,
    evidenceBundleIdRequired: blocker?.evidenceBundleIdRequired,
    evidenceState: aggregate.evidenceState,
    existingReviewMessageId: blocker?.existingMessageId ?? undefined,
    lifecycle: null,
    messageId: selectedMessageId,
    missingRequiredField: blocker?.missingRequiredField ?? undefined,
    ...nextActionFields,
    nextActions: summary.nextActions ?? [],
    nextSuggestedCapability,
    previousAgentPromptState: "completed",
    previousTicketState: aggregate.ticketState,
    ...(productStatus ? { productStatus } : {}),
    queueMutation,
    reviewMessage,
    reviewMessageAlreadyExists: blocker?.reviewMessageAlreadyExists,
    reviewOutcome: null,
    reviewState: aggregate.reviewState,
    runId: selectedRunId,
    runIdRequired: blocker?.runIdRequired,
    taskId: aggregate.taskId,
    ticketState: aggregate.ticketState,
    value: reviewMessage,
    workerRunState: aggregate.workerRunState,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: queueMutation === "backend_domain" && durable,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

export function reviewCreateMessageBlockedOutput(
  result: AgentQueueReviewCreateMessageResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentLifecycleTransitionOutput {
  const blocker = result.blocker;
  const actionLabel = "Queue review message blocked";
  if (result.aggregate) {
    return reviewTransitionOutputFromAggregate({
      actionLabel,
      aggregate: result.aggregate,
      backendCreateMessageStatus: result.status,
      blocker,
      evidenceBundleId: result.evidenceBundleId ?? undefined,
      queueControlState,
      context: null,
      durable: result.durable,
      messageId: result.messageId ?? undefined,
      queueMutation: "none",
      reviewMessage: result.reviewMessage ?? blocker ?? undefined,
      runId: result.runId ?? undefined,
    });
  }

  const nextSuggestedCapability =
    (blocker?.nextSuggestedCapability as
      | QueueAgentLifecycleTransitionOutput["nextSuggestedCapability"]
      | undefined) ?? null;
  const selectedMessageId = result.messageId ?? blocker?.existingMessageId ?? undefined;
  const selectedRunId = result.runId ?? blocker?.runId ?? undefined;
  const selectedEvidenceBundleId =
    result.evidenceBundleId ?? blocker?.evidenceBundleId ?? undefined;
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    evidenceBundleId: selectedEvidenceBundleId,
    messageId: selectedMessageId,
    nextSuggestedCapability,
    reason:
      "Queue review create blocker exposed a schema-valid follow-up capability.",
    runId: selectedRunId,
    taskId: result.taskId,
  });
  const productStatus =
    result.status === "already_exists" ||
    blocker?.blockerCode === "review_message_already_exists"
      ? "already_exists"
      : nextActionFields.nextAction
        ? "blocked_actionable"
        : undefined;

  return {
    actionLabel,
    additionalPromptCount: 0,
    agentPromptState: "completed",
    backendCreateMessageStatus: result.status,
    blockerCode: blocker?.blockerCode,
    blockerMessage: blocker?.blockerMessage,
    blockers: blocker
      ? [{ code: blocker.blockerCode, message: blocker.blockerMessage }]
      : [],
    dryRunOnly: false,
    durable: result.durable,
    evidenceBundleId: selectedEvidenceBundleId,
    evidenceBundleIdRequired: blocker?.evidenceBundleIdRequired,
    evidenceState: blocker?.evidenceState ?? undefined,
    existingReviewMessageId: blocker?.existingMessageId ?? undefined,
    lifecycle: null,
    messageId: selectedMessageId,
    missingRequiredField: blocker?.missingRequiredField ?? undefined,
    ...nextActionFields,
    nextActions: [],
    nextSuggestedCapability,
    previousAgentPromptState: "completed",
    previousTicketState: blocker?.ticketState ?? "unknown",
    ...(productStatus ? { productStatus } : {}),
    queueMutation: "none",
    reviewMessage: result.reviewMessage ?? blocker ?? undefined,
    reviewMessageAlreadyExists: blocker?.reviewMessageAlreadyExists,
    reviewOutcome: null,
    reviewState: blocker?.reviewState ?? undefined,
    runId: selectedRunId,
    runIdRequired: blocker?.runIdRequired,
    taskId: result.taskId,
    ticketState: blocker?.ticketState ?? "unknown",
    value: blocker ?? result,
    workerRunState: blocker?.workerRunState ?? undefined,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: false,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

export function reviewCreateMessageBlockerMessage(
  result: AgentQueueReviewCreateMessageResult,
) {
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
  ].filter(Boolean);
  const details = [
    blocker?.blockerCode ? `blockerCode=${blocker.blockerCode}` : null,
    ...stateParts,
    blocker?.missingRequiredField
      ? `missingRequiredField=${blocker.missingRequiredField}`
      : null,
    blocker ? `runIdRequired=${String(blocker.runIdRequired)}` : null,
    blocker
      ? `evidenceBundleIdRequired=${String(blocker.evidenceBundleIdRequired)}`
      : null,
    blocker
      ? `reviewMessageAlreadyExists=${String(
          blocker.reviewMessageAlreadyExists,
        )}`
      : null,
    blocker?.existingMessageId
      ? `existingMessageId=${blocker.existingMessageId}`
      : null,
    result.runId ?? blocker?.runId
      ? `runId=${result.runId ?? blocker?.runId}`
      : null,
    result.evidenceBundleId ?? blocker?.evidenceBundleId
      ? `evidenceBundleId=${result.evidenceBundleId ?? blocker?.evidenceBundleId}`
      : null,
    blocker?.nextSuggestedCapability
      ? `nextSuggestedCapability=${blocker.nextSuggestedCapability}`
      : null,
  ].filter((part): part is string => Boolean(part));

  return [
    blocker?.blockerMessage ??
      `Queue review message was not created. backendStatus=${result.status}`,
    details.length > 0 ? details.join(" ") : null,
  ]
    .filter(Boolean)
    .join(" ");
}


export function reviewActorId(
  coordinatorAgentId: string | undefined,
  context: QueueAgentLifecycleHandlerContext,
) {
  return coordinatorAgentId?.trim() || context.agentId.trim() || "workspace-agent";
}

export function reviewMessageBodyFromInput(
  input: QueueAgentReviewCreateMessageInput,
): string | null {
  return (
    input.finalAgentMessage?.trim() ||
    normalizeChangedFilesSummary(input.changedFilesSummary) ||
    input.validationSummary?.trim() ||
    null
  );
}


