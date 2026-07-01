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
import { boundedText, normalizedString } from "./queueBridgePrimitiveHelpers";
import { bridgeUnavailableResult } from "./queueBridgeResultHelpers";
import { QUEUE_DISABLED_BLOCKER } from "./queueBridgeTaskProjection";

export function getQueueControlStateThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: QueueAgentControlGetInput,
  _context: unknown,
): QueueAgentAdapterResult<QueueAgentControlGetResult> {
  if (!bridge?.getQueueControlState) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.controlGet,
      "Queue control read API is unavailable.",
    );
  }

  const state = bridge.getQueueControlState();
  if (!state) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.controlGet,
      "Queue control state is unavailable.",
    );
  }

  const requestedWorkspaceId = normalizedString(input.workspaceId);
  const stateWorkspaceId = normalizedString(state.workspaceId);
  if (
    requestedWorkspaceId &&
    stateWorkspaceId &&
    requestedWorkspaceId !== stateWorkspaceId
  ) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.controlGet],
      message: "Queue control workspaceId does not match current workspace.",
      output: {
        backendOwned: state.backendOwned === true,
        blockers: ["workspace_mismatch"],
        didAutoRunWorkers: false,
        didMutateQueue: false,
        didStartWorkers: false,
        globalExecutionState: state.globalExecutionState ?? null,
        missingCapabilities: ["workspace_mismatch"],
        queueEnabled: state.queueEnabled,
        reason: boundedText(state.reason),
        status:
          state.status ?? (state.queueEnabled ? "manual_enabled" : "disabled"),
        updatedAt: state.updatedAt ?? null,
        updatedByActorId: state.updatedByActorId ?? null,
        version: state.version ?? null,
        workspaceId: stateWorkspaceId,
      },
      reasonCode: "precondition_failed",
      reasons: ["Queue control workspaceId does not match current workspace."],
      status: "precondition_failed",
    };
  }

  const status = state.status ?? (state.queueEnabled ? "manual_enabled" : "disabled");
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.controlGet],
    message: "Queue control state read.",
    output: {
      backendOwned: state.backendOwned === true,
      blockers: [],
      didAutoRunWorkers: false,
      didMutateQueue: false,
      didStartWorkers: false,
      globalExecutionState: state.globalExecutionState ?? null,
      missingCapabilities: [],
      queueEnabled: state.queueEnabled,
      reason: boundedText(state.reason),
      status,
      updatedAt: state.updatedAt ?? null,
      updatedByActorId: state.updatedByActorId ?? null,
      version: state.version ?? null,
      workspaceId: requestedWorkspaceId ?? stateWorkspaceId,
    },
    status: "succeeded",
  };
}

export async function setQueueControlManualEnabledThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: QueueAgentControlSetManualEnabledInput,
  context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentControlSetManualEnabledResult>> {
  if (!bridge?.setQueueControlManualEnabled) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.controlSetManualEnabled,
      "Queue manual control API is unavailable.",
    );
  }

  const result = await bridge.setQueueControlManualEnabled({
    actorId: context.agentId || "workspace-agent",
    dryRun: context.dryRun,
    expectedVersion: input.expectedVersion ?? null,
    reason: input.reason ?? null,
    workspaceId: input.workspaceId ?? null,
  });

  if (result.status === "unavailable") {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.controlSetManualEnabled,
      result.message,
    );
  }

  const controlState = result.controlState;
  const resultStatus =
    result.status === "preview"
      ? controlState?.status === "manual_enabled"
        ? "already_in_state"
        : "succeeded"
      : queueControlSetManualEnabledResultStatus(result.status);
  const output: QueueAgentControlSetManualEnabledResult = {
    backendOwned: true,
    blockers: result.blockerReasons ?? [],
    controlState: controlState
      ? {
          reason: boundedText(controlState.reason),
          status:
            controlState.status ??
            (controlState.queueEnabled ? "manual_enabled" : "disabled"),
          updatedAt: controlState.updatedAt ?? null,
          updatedByActorId: controlState.updatedByActorId ?? null,
          version: controlState.version ?? null,
        }
      : null,
    didAutoRunWorkers: false,
    didCreateRunLinks: false,
    didInvokeWorkflowRunner: false,
    didMutateEvidence: false,
    didMutateFinalization: false,
    didMutateQueueControlState: result.didMutateQueueControlState,
    didMutateQueueTasks: false,
    didMutateReviews: false,
    didScheduleOrAutodispatch: false,
    didStartDownstream: false,
    didStartWorkers: false,
    queueEnabled: result.queueEnabled,
    resultStatus,
    workspaceId: result.workspaceId ?? controlState?.workspaceId ?? null,
  };

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.controlSetManualEnabled],
    message: result.message,
    output,
    reasonCode: queueControlSetManualEnabledReasonCode(result.status),
    reasons: result.ok ? [] : result.blockerReasons,
    status: queueControlSetManualEnabledBrokerStatus(result.status),
  };
}

export async function enableQueueThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  _input: QueueAgentEnableInput,
  context: { dryRun: boolean },
): Promise<QueueAgentAdapterResult<QueueAgentEnableResult>> {
  if (!bridge?.enableQueue) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.enable,
      "Queue enable controls are unavailable.",
    );
  }

  const result = await bridge.enableQueue({ dryRun: context.dryRun });
  const blockerReasons = result.blockerReasons ?? [];
  const nextSuggestedCapability = result.ok
    ? result.queueEnabled
      ? "queue.item.startRun"
      : "queue.enable"
    : "queue.items.list";
  const output: QueueAgentEnableResult = {
    backendOwned: result.backendOwned,
    blockerReasons,
    didAutoRunWorkers: false,
    didStartWorkers: false,
    globalExecutionState: result.globalExecutionState,
    ...nextActionFieldsForSuggestedCapability({
      nextSuggestedCapability,
      reason: "Queue enable reported the next available Queue capability.",
    }),
    nextSuggestedCapability,
    queueControlStatus: result.queueControlStatus,
    queueEnabled: result.queueEnabled,
    version: result.version,
  };

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.enable],
    message: result.message,
    output,
    reasons: blockerReasons,
    status: result.ok
      ? "succeeded"
      : result.status === "unavailable"
        ? "unavailable"
        : "failed",
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


export function queueControlSetManualEnabledResultStatus(
  status: string,
): QueueAgentControlSetManualEnabledResult["resultStatus"] {
  switch (status) {
    case "succeeded":
    case "already_in_state":
    case "invalid_input":
    case "workspace_not_found":
    case "version_conflict":
      return status;
    default:
      return "failed_unexpected";
  }
}

export function queueControlSetManualEnabledBrokerStatus(
  status: string,
): QueueAgentCapabilityStatus {
  switch (status) {
    case "preview":
    case "succeeded":
      return "succeeded";
    case "already_in_state":
      return "already_exists";
    case "invalid_input":
      return "invalid_input";
    case "workspace_not_found":
    case "version_conflict":
      return "precondition_failed";
    case "unavailable":
      return "unavailable";
    default:
      return "failed_unexpected";
  }
}

export function queueControlSetManualEnabledReasonCode(status: string) {
  switch (status) {
    case "invalid_input":
      return "invalid_payload";
    case "workspace_not_found":
      return "workspace_not_found";
    case "version_conflict":
      return "version_conflict";
    case "unavailable":
      return "capability_unavailable";
    case "failed_unexpected":
      return "failed_unexpected";
    default:
      return undefined;
  }
}

