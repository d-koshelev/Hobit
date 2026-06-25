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
import { nextActionFieldsForSuggestedCapability } from "./queueBridgeNextActionHelpers";
import {
  isFinalStatus,
  isRunnableStatus,
  isSupportedApprovalPolicy,
  isSupportedSandbox,
} from "./queueBridgePrimitiveHelpers";

export async function createdQueueItemReadiness(
  bridge: WorkspaceAgentQueueBridge,
  item: QueueWidgetItemSnapshot,
) {
  const queueControlState = queueControlStateFromBridge(bridge);
  const aggregate = await readCreatedQueueItemAggregate(bridge, item.id);

  return aggregate
    ? queueTaskSummaryFromAggregate(aggregate, queueControlState)
    : queueTaskSummaryFromSnapshot(
        item,
        executorTargets(bridge),
        queueControlState,
      );
}

export async function readCreatedQueueItemAggregate(
  bridge: WorkspaceAgentQueueBridge,
  taskId: string,
): Promise<AgentQueueItemAggregate | null> {
  if (!bridge.getItemAggregate) {
    return null;
  }

  try {
    return await bridge.getItemAggregate({ taskId });
  } catch {
    return null;
  }
}

export const AGGREGATE_SOURCE = "tauri_queue_item_aggregate" as const;
export const QUEUE_DISABLED_MESSAGE = "Queue disabled.";
export const QUEUE_DISABLED_BLOCKER = {
  code: "queue_disabled",
  message: QUEUE_DISABLED_MESSAGE,
} as const;

export function queueTaskSummaryFromAggregate(
  aggregate: AgentQueueItemAggregate,
  queueControlState: WorkspaceAgentQueueControlState | null = null,
): QueueAgentTaskSummary {
  const readiness = queueTaskReadinessFromAggregate(
    aggregate,
    queueControlState,
  );
  const nextActions = aggregate.nextActions.map((action) =>
    nextActionFromAggregate(action, queueControlState),
  );
  const blockers = readiness.blockerReasons.includes(QUEUE_DISABLED_MESSAGE)
    ? withQueueDisabledBlocker(aggregate.blockers)
    : aggregate.blockers;
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    executorWidgetId: aggregate.runSettings.assignedExecutorWidgetId,
    nextSuggestedCapability: readiness.nextSuggestedCapability,
    reason: "Queue aggregate exposed this task's next available capability.",
    runId: aggregate.latestRun?.runId,
    taskId: aggregate.taskId,
  });

  return {
    ...readiness,
    ...nextActionFields,
    aggregateSource: AGGREGATE_SOURCE,
    assignedExecutorWidgetId:
      aggregate.runSettings.assignedExecutorWidgetId ?? null,
    authoritativeBackendAggregate: true,
    blockers,
    commitState: aggregate.commitState,
    dependencyState: aggregate.dependencyState,
    durableFlags: aggregate.durableFlags,
    evidenceState: aggregate.evidenceState,
    evidenceSummary: aggregate.evidenceSummary,
    latestRun: aggregate.latestRun,
    latestRunId: aggregate.latestRun?.runId ?? null,
    nextActions,
    reviewState: aggregate.reviewState,
    status: aggregate.ticketState,
    taskId: aggregate.taskId,
    ticketState: aggregate.ticketState,
    title: aggregate.title,
    updatedAt: aggregate.updatedAt,
    validationState: aggregate.validationState,
    workerRunState: aggregate.workerRunState,
  };
}

export function queueTaskReadinessFromAggregate(
  aggregate: AgentQueueItemAggregate,
  queueControlState: WorkspaceAgentQueueControlState | null = null,
): QueueAgentTaskReadiness {
  const hasPrompt = !aggregate.blockers.some(
    (blocker) => blocker.code === "missing_prompt",
  );
  const hasWorkspace = Boolean(aggregate.runSettings.executionWorkspace?.trim());
  const hasCodexExecutable = Boolean(aggregate.runSettings.codexExecutable?.trim());
  const hasSandbox = isSupportedSandbox(aggregate.runSettings.sandbox);
  const hasApprovalPolicy = isSupportedApprovalPolicy(
    aggregate.runSettings.approvalPolicy,
  );
  const canPromote = aggregate.nextActions.some(
    (action) => action.code === "promote_draft" && action.available,
  );
  const canStart = aggregate.nextActions.some(
    (action) => action.code === "start_run" && action.available,
  );
  const blockerReasons = uniqueStrings([
    ...aggregate.blockers.map((blocker) => blocker.message),
    ...missingRunSettingsBlockers({
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
    }),
  ]);

  if (aggregate.ticketState === "draft") {
    return {
      blockerReasons,
      canPromote,
      canStart: false,
      draftState: "draft",
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
      nextSuggestedCapability: canPromote
        ? "queue.item.promoteDraft"
        : nextSuggestedCapabilityFromAggregate(aggregate),
      readinessState: canPromote ? "ready_to_queue" : "not_ready",
    };
  }

  if (
    aggregate.ticketState === "running" ||
    aggregate.workerRunState === "running"
  ) {
    return {
      blockerReasons,
      canPromote: false,
      canStart: false,
      draftState: "not_draft",
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
      readinessState: "running",
    };
  }

  if (isFinalStatus(aggregate.ticketState)) {
    return {
      blockerReasons,
      canPromote: false,
      canStart: false,
      draftState: "not_draft",
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
      readinessState: "final",
    };
  }

  const queueDisabledBlocksStart = aggregateQueueDisabledBlocksStart(
    aggregate,
    queueControlState,
  );

  return {
    blockerReasons: queueDisabledBlocksStart
      ? uniqueStrings([...blockerReasons, QUEUE_DISABLED_MESSAGE])
      : blockerReasons,
    canPromote: false,
    canStart: queueDisabledBlocksStart ? false : canStart,
    draftState: "not_draft",
    hasApprovalPolicy,
    hasCodexExecutable,
    hasPrompt,
    hasSandbox,
    hasWorkspace,
    nextSuggestedCapability: queueDisabledBlocksStart
      ? "queue.enable"
      : canStart
        ? "queue.item.startRun"
        : nextSuggestedCapabilityFromAggregate(aggregate),
    readinessState: queueDisabledBlocksStart
      ? "blocked"
      : canStart
        ? "runnable"
        : "blocked",
  };
}

export function nextActionFromAggregate(
  action: AgentQueueItemAggregate["nextActions"][number],
  queueControlState: WorkspaceAgentQueueControlState | null = null,
): QueueAgentAggregateNextAction {
  return {
    ...action,
    suggestedCapability:
      action.code === "start_run" &&
      action.available &&
      queueControlState?.queueEnabled === false
        ? "queue.enable"
        : nextActionSuggestedCapability(action.code),
  };
}

export function nextSuggestedCapabilityFromAggregate(
  aggregate: AgentQueueItemAggregate,
) {
  const mappedAvailableAction = aggregate.nextActions.find(
    (action) => action.available && nextActionSuggestedCapability(action.code),
  );
  if (mappedAvailableAction) {
    return nextActionSuggestedCapability(mappedAvailableAction.code);
  }

  const mappedAction = aggregate.nextActions.find((action) =>
    nextActionSuggestedCapability(action.code),
  );

  return mappedAction ? nextActionSuggestedCapability(mappedAction.code) : null;
}

export function nextActionSuggestedCapability(code: string) {
  switch (code) {
    case "create_review_message":
      return "queue.review.createMessage";
    case "ack_review":
      return "queue.review.ack";
    case "mark_done":
      return "queue.item.markDone";
    case "promote_draft":
      return "queue.item.promoteDraft";
    case "start_run":
      return "queue.item.startRun";
    case "update_run_settings":
      return "queue.item.updateRunSettings";
    default:
      return null;
  }
}

export function queueTaskSummaryFromSnapshot(
  item: QueueWidgetItemSnapshot,
  availableExecutors: readonly QueueAgentExecutorTarget[] = [],
  queueControlState: WorkspaceAgentQueueControlState | null = null,
): QueueAgentTaskSummary {
  const readiness = queueTaskReadinessFromSnapshot(
    item,
    availableExecutors,
    queueControlState,
  );
  const latestRunId = item.runLinks?.[0]?.directWorkRunId ?? null;
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    executorWidgetId: item.assignedExecutorWidgetId,
    nextSuggestedCapability: readiness.nextSuggestedCapability,
    reason: "Queue snapshot exposed this task's next available capability.",
    runId: latestRunId,
    taskId: item.id,
  });

  return {
    ...readiness,
    ...nextActionFields,
    assignedExecutorWidgetId: item.assignedExecutorWidgetId ?? null,
    ...(readiness.blockerReasons.includes(QUEUE_DISABLED_MESSAGE)
      ? { blockers: [QUEUE_DISABLED_BLOCKER] }
      : {}),
    latestRunId,
    status: item.status,
    taskId: item.id,
    title: item.title,
  };
}

export function queueTaskReadinessFromSnapshot(
  item: QueueWidgetItemSnapshot,
  availableExecutors: readonly QueueAgentExecutorTarget[],
  queueControlState: WorkspaceAgentQueueControlState | null = null,
): QueueAgentTaskReadiness {
  const hasPrompt = Boolean(item.prompt?.trim());
  const hasWorkspace = Boolean(item.executionWorkspace?.trim());
  const hasCodexExecutable = Boolean(item.codexExecutable?.trim());
  const hasSandbox = isSupportedSandbox(item.sandbox);
  const hasApprovalPolicy = isSupportedApprovalPolicy(item.approvalPolicy);
  const hasExplicitExecutor =
    availableExecutors.length > 0 || Boolean(item.assignedExecutorWidgetId);
  const readinessBlockers = missingRunSettingsBlockers({
    hasApprovalPolicy,
    hasCodexExecutable,
    hasPrompt,
    hasSandbox,
    hasWorkspace,
  });
  const snapshotBlockers = (item.blockers ?? [])
    .filter((blocker) => shouldBlockQueueAgentRun(blocker.code))
    .map((blocker) => blocker.message);

  if (item.status === "draft") {
    const blockers = [...readinessBlockers, ...snapshotBlockers];
    const canPromote = blockers.length === 0;

    return {
      blockerReasons: blockers,
      canPromote,
      canStart: false,
      draftState: "draft",
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
      nextSuggestedCapability: canPromote
        ? "queue.item.promoteDraft"
        : "queue.item.updateRunSettings",
      readinessState: canPromote ? "ready_to_queue" : "not_ready",
    };
  }

  if (item.status === "running") {
    return {
      blockerReasons: ["This Queue item is already running."],
      canPromote: false,
      canStart: false,
      draftState: "not_draft",
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
      readinessState: "running",
    };
  }

  if (isFinalStatus(item.status)) {
    return {
      blockerReasons: ["Final-status Queue items cannot be started."],
      canPromote: false,
      canStart: false,
      draftState: "not_draft",
      hasApprovalPolicy,
      hasCodexExecutable,
      hasPrompt,
      hasSandbox,
      hasWorkspace,
      readinessState: "final",
    };
  }

  const executorBlockers = hasExplicitExecutor
    ? []
    : ["No explicit Agent Executor widget id is available."];
  const unsupportedStatusBlockers = isRunnableStatus(item.status)
    ? []
    : [`Queue item status cannot be started: ${item.status}.`];
  const blockerReasons = [
    ...readinessBlockers,
    ...executorBlockers,
    ...unsupportedStatusBlockers,
    ...snapshotBlockers,
  ];
  const canStart = blockerReasons.length === 0;
  const queueDisabledBlocksStart =
    canStart && queueControlState?.queueEnabled === false;

  return {
    blockerReasons: queueDisabledBlocksStart
      ? uniqueStrings([...blockerReasons, QUEUE_DISABLED_MESSAGE])
      : blockerReasons,
    canPromote: false,
    canStart: queueDisabledBlocksStart ? false : canStart,
    draftState: "not_draft",
    hasApprovalPolicy,
    hasCodexExecutable,
    hasPrompt,
    hasSandbox,
    hasWorkspace,
    nextSuggestedCapability: queueDisabledBlocksStart
      ? "queue.enable"
      : canStart
        ? "queue.item.startRun"
        : "queue.item.updateRunSettings",
    readinessState: queueDisabledBlocksStart
      ? "blocked"
      : canStart
        ? "runnable"
        : "blocked",
  };
}

export function queueControlStateFromBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
): WorkspaceAgentQueueControlState | null {
  return bridge?.getQueueControlState?.() ?? null;
}

export function aggregateQueueDisabledBlocksStart(
  aggregate: AgentQueueItemAggregate,
  queueControlState: WorkspaceAgentQueueControlState | null,
) {
  return (
    queueControlState?.queueEnabled === false &&
    aggregate.nextActions.some(
      (action) => action.code === "start_run" && action.available,
    )
  );
}

export function withQueueDisabledBlocker(
  blockers: readonly AgentQueueItemAggregate["blockers"][number][],
) {
  if (blockers.some((blocker) => blocker.code === QUEUE_DISABLED_BLOCKER.code)) {
    return [...blockers];
  }

  return [...blockers, QUEUE_DISABLED_BLOCKER];
}

export function isQueueDisabledStartBlocker(reasons: readonly string[]) {
  // TODO(queue-status-taxonomy): replace this compatibility text check with a
  // typed queue_disabled blocker code once the backend aggregate exposes it.
  return reasons.some((reason) =>
    reason.toLowerCase().includes("enable queue before starting") ||
    reason.toLowerCase().includes("queue disabled"),
  );
}

export function missingRunSettingsBlockers({
  hasApprovalPolicy,
  hasCodexExecutable,
  hasPrompt,
  hasSandbox,
  hasWorkspace,
}: {
  hasApprovalPolicy: boolean;
  hasCodexExecutable: boolean;
  hasPrompt: boolean;
  hasSandbox: boolean;
  hasWorkspace: boolean;
}) {
  return [
    hasPrompt ? null : "Missing prompt.",
    hasWorkspace ? null : "Missing workspace.",
    hasCodexExecutable ? null : "Missing Codex executable.",
    hasSandbox ? null : "Missing sandbox.",
    hasApprovalPolicy ? null : "Missing approval policy.",
  ].filter((reason): reason is string => Boolean(reason));
}

export function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => Boolean(value.trim())))];
}

export function shouldBlockQueueAgentRun(code: string) {
  return (
    code !== "manual_policy" &&
    code !== "missing_executor" &&
    code !== "missing_prompt" &&
    code !== "missing_execution_workspace"
  );
}

export function nextCapabilityForSummaries(
  items: readonly QueueAgentTaskSummary[],
) {
  return (
    items.find((item) => item.nextSuggestedCapability)?.nextSuggestedCapability ??
    null
  );
}

export function nextCapabilityForLifecycleRead(summary: QueueAgentTaskSummary) {
  if (
    summary.nextSuggestedCapability === "queue.review.createMessage" &&
    summary.evidenceState === "available" &&
    summary.latestRunId
  ) {
    return "queue.review.getEvidenceBundle";
  }

  return summary.nextSuggestedCapability ?? null;
}

export function executorTargets(
  bridge: WorkspaceAgentQueueBridge,
): QueueAgentExecutorTarget[] {
  return (bridge.getAvailableExecutorTargets?.() ?? [])
    .slice(0, 8)
    .map((slot) => ({
      executorWidgetId: slot.widgetInstanceId,
      label: slot.label,
      ownerKind: slot.ownerKind ?? "agent_executor",
    }));
}
