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
import { nextActionFieldsForSuggestedCapability } from "./queueBridgeNextActionHelpers";
import {
  cleanString,
  normalizeChangedFilesSummary,
} from "./queueBridgePrimitiveHelpers";
import {
  aggregateReadUnavailableResult,
  bridgeUnavailableResult,
} from "./queueBridgeResultHelpers";
import {
  invalidReviewCommandInput,
  previewReviewCommandFromAggregate,
  reviewCommandFailed,
} from "./queueBridgeReviewCapabilities";
import { queueTaskSummaryFromAggregate } from "./queueBridgeTaskProjection";

export async function recordWorkerFinishedThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<
    Pick<
      QueueAgentLifecycleAgentFinishedInput,
      "finalAgentMessage" | "outcome" | "runId" | "taskId"
    >
  > &
    Omit<
      QueueAgentLifecycleAgentFinishedInput,
      "finalAgentMessage" | "outcome" | "runId" | "taskId"
    >,
  context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput>> {
  const taskId = input.taskId.trim();
  const runId = input.runId.trim();
  if (!taskId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
      "queue.lifecycle.agentFinished requires taskId.",
    );
  }
  if (!runId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
      "queue.lifecycle.agentFinished requires runId.",
    );
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
      "Queue worker evidence command API is unavailable.",
    );
  }

  if (context.dryRun) {
    return previewReviewCommandFromAggregate(
      backendApi,
      queueControlStateFromBridge(bridge),
      taskId,
      context,
      "Queue worker evidence recording preview prepared.",
      "Queue worker evidence recorded",
      QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
    );
  }

  try {
    const result = await backendApi.recordWorkerFinished({
      changedFiles: changedFilesFromWorkerFinishedInput(input),
      changedFilesSummary: changedFilesSummaryFromWorkerFinishedInput(input),
      errorSummary:
        input.outcome === "failed" ? input.finalAgentMessage.trim() : null,
      finishedAt: input.finishedAt?.trim() || null,
      outcome: input.outcome,
      runId,
      source: input.source?.trim() || "workspace_agent",
      summary: input.finalAgentMessage,
      taskId,
      validationSummary: input.validationSummary?.trim() || null,
      workerId: input.workerId?.trim() || context.agentId.trim() || null,
    });

    return workerFinishedCommandSucceeded(result, queueControlStateFromBridge(bridge));
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue worker evidence could not be recorded.",
      QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
    );
  }
}

export async function getWorkerEvidenceBundleThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentReviewEvidenceBundleInput, "taskId">> &
    Omit<QueueAgentReviewEvidenceBundleInput, "taskId">,
  _context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentReviewEvidenceBundleOutput>> {
  const taskId = input.taskId.trim();
  const runId = input.runId?.trim() || null;
  if (!taskId) {
    return invalidReviewCommandInput(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle,
      "queue.review.getEvidenceBundle requires taskId.",
    );
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle,
      "Queue worker evidence read API is unavailable.",
    );
  }

  try {
    const result = await backendApi.getWorkerEvidenceBundle({
      runId,
      taskId,
    });

    return workerEvidenceBundleReadSucceeded(
      result,
      queueControlStateFromBridge(bridge),
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue worker evidence bundle could not be read.",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle,
    );
  }
}

export function workerFinishedCommandSucceeded(
  result: AgentQueueWorkerFinishedCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished],
    message: "Queue worker evidence recorded.",
    output: workerFinishedOutputFromBackend(result, queueControlState),
    status: "succeeded",
  };
}

export function workerFinishedOutputFromBackend(
  result: AgentQueueWorkerFinishedCommandResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentLifecycleTransitionOutput {
  const summary = queueTaskSummaryFromAggregate(
    result.aggregate,
    queueControlState,
  );
  const nextSuggestedCapability = summary.nextSuggestedCapability ?? null;
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    evidenceBundleId: result.bundleId,
    nextSuggestedCapability,
    reason:
      "Queue worker evidence was recorded and can be followed by the next lifecycle capability.",
    runId: result.runId,
    taskId: result.taskId,
  });

  return {
    actionLabel: "Queue worker evidence recorded",
    additionalPromptCount: 0,
    agentPromptState: "completed",
    aggregate: result.aggregate,
    blockers: result.aggregate.blockers,
    dryRunOnly: false,
    durable: result.durable,
    evidenceBundle: result.evidenceBundle,
    evidenceBundleId: result.bundleId,
    evidenceState: result.aggregate.evidenceState,
    lifecycle: null,
    ...nextActionFields,
    nextActions: summary.nextActions ?? [],
    nextSuggestedCapability,
    previousAgentPromptState: "completed",
    previousTicketState: result.aggregate.ticketState,
    queueMutation: "backend_domain",
    reviewOutcome: result.evidenceBundle.outcome,
    reviewState: result.aggregate.reviewState,
    runId: result.runId,
    taskId: result.taskId,
    ticketState: result.aggregate.ticketState,
    value: result.evidenceBundle,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: result.durable,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

export function workerEvidenceBundleReadSucceeded(
  result: AgentQueueWorkerEvidenceQueryResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentAdapterResult<QueueAgentReviewEvidenceBundleOutput> {
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle],
    message:
      result.state === "available"
        ? "Queue worker evidence bundle read from backend."
        : "Queue worker evidence bundle was not found.",
    output: workerEvidenceBundleOutputFromBackend(result, queueControlState),
    status: "succeeded",
  };
}

export function workerEvidenceBundleOutputFromBackend(
  result: AgentQueueWorkerEvidenceQueryResult,
  queueControlState: WorkspaceAgentQueueControlState | null,
): QueueAgentReviewEvidenceBundleOutput {
  const aggregateSummary = result.aggregate
    ? queueTaskSummaryFromAggregate(result.aggregate, queueControlState)
    : null;
  const bundle = result.evidenceBundle;
  const nextSuggestedCapability =
    result.state === "available"
      ? aggregateSummary?.nextSuggestedCapability ?? null
      : null;
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    evidenceBundleId: bundle?.bundleId,
    nextSuggestedCapability,
    reason:
      "Queue evidence bundle was read and can be followed by the next review capability.",
    runId: result.runId ?? bundle?.runId,
    taskId: result.taskId,
  });

  return {
    aggregate: result.aggregate,
    backendEvidenceBundle: bundle,
    blockers: result.aggregate?.blockers ?? [],
    changedFilesSummary: bundle?.changedFilesSummary ?? undefined,
    evidenceBundle: null,
    evidenceBundleId: bundle?.bundleId,
    evidenceBundlePersistence:
      result.state === "available" && result.durable
        ? "backend_durable"
        : "backend_no_evidence",
    evidenceState: result.aggregate?.evidenceState ?? result.state,
    finalAgentMessage: bundle?.summary,
    latestReviewMessage: null,
    lifecycle: backendEvidenceCompatibilityLifecycle(result),
    ...nextActionFields,
    nextActions: aggregateSummary?.nextActions ?? [],
    nextSuggestedCapability,
    reviewMessages: [],
    reviewOutcome: bundle?.outcome ?? null,
    runId: result.runId,
    taskId: result.taskId,
    validationApprovals: [],
    validationSummary: bundle?.validationSummary ?? undefined,
  };
}

export function backendEvidenceCompatibilityLifecycle(
  result: AgentQueueWorkerEvidenceQueryResult,
): QueueAgentReviewEvidenceBundleOutput["lifecycle"] {
  const aggregate = result.aggregate;
  const bundle = result.evidenceBundle;
  const now = bundle?.updatedAt ?? aggregate?.updatedAt ?? "";

  return {
    additionalPromptCount: 0,
    agentPromptState:
      aggregate?.workerRunState === "running" ? "running" : "completed",
    changedFilesSummary: bundle?.changedFilesSummary ?? undefined,
    commitRequests: [],
    commitResults: [],
    coordinatorDecisions: [],
    createdAt: bundle?.createdAt ?? now,
    currentAttemptId: undefined,
    currentRunnablePrompt: undefined,
    currentThreadId: undefined,
    finalAgentMessage: bundle?.summary ?? undefined,
    followUpPrompts: [],
    originalPrompt: undefined,
    reviewAcks: [],
    reviewMessages: [],
    reviewOutcome: bundle?.outcome ?? undefined,
    sideEffects: {
      wouldCallCodex: false,
      wouldCallShell: false,
      wouldCallWorkspaceApi: false,
      wouldExecuteCommit: false,
      wouldExecuteRollback: false,
      wouldLaunchTerminal: false,
      wouldMutateGit: false,
      wouldPersist: false,
      wouldStartWorker: false,
    },
    taskId: result.taskId,
    ticketState: aggregate?.ticketState ?? "unknown",
    title: aggregate?.title,
    updatedAt: now,
    validationApprovals: [],
    validationSummary: bundle?.validationSummary ?? undefined,
  } as QueueAgentReviewEvidenceBundleOutput["lifecycle"];
}

export function changedFilesFromWorkerFinishedInput(
  input: QueueAgentLifecycleAgentFinishedInput,
): string[] | null {
  const bundleFiles = input.evidenceBundle
    ? (input.evidenceBundle as { changedFiles?: unknown }).changedFiles
    : undefined;
  if (Array.isArray(bundleFiles)) {
    const files = bundleFiles
      .filter((file): file is string => typeof file === "string")
      .map((file) => file.trim())
      .filter(Boolean);
    if (files.length > 0) {
      return files;
    }
  }

  if (Array.isArray(input.changedFilesSummary)) {
    const files = input.changedFilesSummary
      .map((file) => file.trim())
      .filter(Boolean);
    return files.length > 0 ? files : null;
  }

  return null;
}

export function changedFilesSummaryFromWorkerFinishedInput(
  input: QueueAgentLifecycleAgentFinishedInput,
): string | null {
  const bundleSummary = input.evidenceBundle
    ? (input.evidenceBundle as { changedFilesSummary?: unknown })
        .changedFilesSummary
    : undefined;
  const cleanBundleSummary =
    typeof bundleSummary === "string" ? bundleSummary.trim() : "";

  return (
    normalizeChangedFilesSummary(input.changedFilesSummary) ??
    (cleanBundleSummary || null)
  );
}
