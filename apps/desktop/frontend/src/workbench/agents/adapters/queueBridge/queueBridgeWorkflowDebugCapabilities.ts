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
import {
  boundedItemLimit,
  normalizedString,
} from "./queueBridgePrimitiveHelpers";
import {
  aggregateReadUnavailableResult,
  bridgeUnavailableResult,
} from "./queueBridgeResultHelpers";
import { workflowNotFoundResult } from "./queueBridgeRunCapabilities";
import {
  workflowActionLogResult,
  workflowNoMutationFlags,
  workflowPlanResumeResult,
  workflowReportResult,
  workflowRunSummary,
} from "./queueBridgeWorkflowProjection";

export async function getWorkflowThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentWorkflowGetInput, "workflowRunId">> &
    Omit<QueueAgentWorkflowGetInput, "workflowRunId">,
  _context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentWorkflowGetResult>> {
  if (!bridge?.getWorkflow) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowGet,
      "Queue workflow get API is unavailable.",
    );
  }

  const precheck = workflowWorkspacePrecheck<QueueAgentWorkflowGetResult>(
    bridge,
    input.workspaceId,
    QUEUE_ACTIVITY_EVENTS.workflowGet,
  );
  if (precheck) {
    return precheck;
  }

  let workflowRun: AgentQueueWorkflowRun | null;
  try {
    workflowRun = await bridge.getWorkflow({
      workflowRunId: input.workflowRunId,
    });
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowGet,
      error,
      "Queue workflow get API is unavailable.",
    );
  }

  if (!workflowRun) {
    return workflowNotFoundResult(
      QUEUE_ACTIVITY_EVENTS.workflowGet,
      input.workflowRunId,
    );
  }

  const mismatch = workflowRunWorkspaceMismatchResult<QueueAgentWorkflowGetResult>(
    workflowRun,
    input.workspaceId,
    QUEUE_ACTIVITY_EVENTS.workflowGet,
  );
  if (mismatch) {
    return mismatch;
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.workflowGet],
    message: "Queue workflow run read.",
    output: workflowRunSummary(workflowRun),
    status: "succeeded",
  };
}

export async function listWorkflowsThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: QueueAgentWorkflowListInput,
  _context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentWorkflowListResult>> {
  if (!bridge?.listWorkflows) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowList,
      "Queue workflow list API is unavailable.",
    );
  }

  const precheck = workflowWorkspacePrecheck<QueueAgentWorkflowListResult>(
    bridge,
    input.workspaceId,
    QUEUE_ACTIVITY_EVENTS.workflowList,
  );
  if (precheck) {
    return precheck;
  }

  let workflowRuns: AgentQueueWorkflowRun[];
  try {
    workflowRuns = await bridge.listWorkflows({
      status: input.status ?? null,
      workflowId: input.workflowId ?? null,
    });
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowList,
      error,
      "Queue workflow list API is unavailable.",
    );
  }

  const requestedWorkspaceId = normalizedString(input.workspaceId);
  const mismatchedRun = requestedWorkspaceId
    ? workflowRuns.find(
        (run) => normalizedString(run.workspaceId) !== requestedWorkspaceId,
      )
    : null;
  if (mismatchedRun) {
    return workflowRunWorkspaceMismatchResult<QueueAgentWorkflowListResult>(
      mismatchedRun,
      input.workspaceId,
      QUEUE_ACTIVITY_EVENTS.workflowList,
    )!;
  }

  const limit = boundedItemLimit(input.limit);
  const boundedRuns = workflowRuns.slice(0, limit);
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.workflowList],
    message: "Queue workflow runs listed.",
    output: {
      ...workflowNoMutationFlags(),
      limit,
      statusFilter: input.status ?? null,
      total: workflowRuns.length,
      truncated: workflowRuns.length > limit,
      workflowIdFilter: input.workflowId ?? null,
      workflows: boundedRuns.map(workflowRunSummary),
    },
    status: "succeeded",
  };
}

export async function getWorkflowReportThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentWorkflowGetReportInput, "workflowRunId">> &
    Omit<QueueAgentWorkflowGetReportInput, "workflowRunId">,
  _context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentWorkflowReportResult>> {
  if (!bridge?.getWorkflowReport) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowGetReport,
      "Queue workflow report read API is unavailable.",
    );
  }

  const precheck = workflowWorkspacePrecheck<QueueAgentWorkflowReportResult>(
    bridge,
    input.workspaceId,
    QUEUE_ACTIVITY_EVENTS.workflowGetReport,
  );
  if (precheck) {
    return precheck;
  }

  let report: AgentQueueWorkflowReport | null;
  try {
    report = await bridge.getWorkflowReport({
      workflowRunId: input.workflowRunId,
    });
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowGetReport,
      error,
      "Queue workflow report read API is unavailable.",
    );
  }

  if (!report) {
    return workflowNotFoundResult(
      QUEUE_ACTIVITY_EVENTS.workflowGetReport,
      input.workflowRunId,
    );
  }

  const mismatch =
    workflowRunWorkspaceMismatchResult<QueueAgentWorkflowReportResult>(
      report.workflowRun,
      input.workspaceId,
      QUEUE_ACTIVITY_EVENTS.workflowGetReport,
    );
  if (mismatch) {
    return mismatch;
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.workflowGetReport],
    message: "Queue workflow report read.",
    output: workflowReportResult(report),
    status: "succeeded",
  };
}

export async function planWorkflowResumeThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentWorkflowPlanResumeInput, "workflowRunId">> &
    Omit<QueueAgentWorkflowPlanResumeInput, "workflowRunId">,
  _context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentWorkflowPlanResumeResult>> {
  if (!bridge?.planWorkflowResume) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowPlanResume,
      "Queue workflow resume planning API is unavailable.",
    );
  }

  const precheck = workflowWorkspacePrecheck<QueueAgentWorkflowPlanResumeResult>(
    bridge,
    input.workspaceId,
    QUEUE_ACTIVITY_EVENTS.workflowPlanResume,
  );
  if (precheck) {
    return precheck;
  }

  let plan: AgentQueueWorkflowResumePlan | null;
  try {
    plan = await bridge.planWorkflowResume({
      expectedVersion: input.expectedVersion ?? null,
      workflowRunId: input.workflowRunId,
    });
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowPlanResume,
      error,
      "Queue workflow resume planning API is unavailable.",
    );
  }

  if (!plan) {
    return workflowNotFoundResult(
      QUEUE_ACTIVITY_EVENTS.workflowPlanResume,
      input.workflowRunId,
    );
  }

  const mismatch =
    workflowRunWorkspaceMismatchResult<QueueAgentWorkflowPlanResumeResult>(
      plan.workflowRun,
      input.workspaceId,
      QUEUE_ACTIVITY_EVENTS.workflowPlanResume,
    );
  if (mismatch) {
    return mismatch;
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.workflowPlanResume],
    message: "Queue workflow resume plan read.",
    output: workflowPlanResumeResult(plan),
    status: "succeeded",
  };
}

export async function readWorkflowActionLogThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<
    Pick<QueueAgentWorkflowReadActionLogInput, "workflowRunId">
  > &
    Omit<QueueAgentWorkflowReadActionLogInput, "workflowRunId">,
  _context: QueueAgentLifecycleHandlerContext,
): Promise<QueueAgentAdapterResult<QueueAgentWorkflowReadActionLogResult>> {
  if (!bridge?.getWorkflowReport) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowReadActionLog,
      "Queue workflow report read API is unavailable.",
    );
  }

  const precheck =
    workflowWorkspacePrecheck<QueueAgentWorkflowReadActionLogResult>(
      bridge,
      input.workspaceId,
      QUEUE_ACTIVITY_EVENTS.workflowReadActionLog,
    );
  if (precheck) {
    return precheck;
  }

  let report: AgentQueueWorkflowReport | null;
  try {
    report = await bridge.getWorkflowReport({
      workflowRunId: input.workflowRunId,
    });
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.workflowReadActionLog,
      error,
      "Queue workflow action-log read API is unavailable.",
    );
  }

  if (!report) {
    return workflowNotFoundResult(
      QUEUE_ACTIVITY_EVENTS.workflowReadActionLog,
      input.workflowRunId,
    );
  }

  const mismatch =
    workflowRunWorkspaceMismatchResult<QueueAgentWorkflowReadActionLogResult>(
      report.workflowRun,
      input.workspaceId,
      QUEUE_ACTIVITY_EVENTS.workflowReadActionLog,
    );
  if (mismatch) {
    return mismatch;
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.workflowReadActionLog],
    message: "Queue workflow action log read.",
    output: workflowActionLogResult(report, input),
    status: "succeeded",
  };
}

export function workflowWorkspacePrecheck<TOutput>(
  bridge: WorkspaceAgentQueueBridge,
  requestedWorkspaceId: string | null | undefined,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<TOutput> | null {
  const requested = normalizedString(requestedWorkspaceId);
  const current = normalizedString(bridge.getQueueControlState?.()?.workspaceId);
  if (!requested || !current || requested === current) {
    return null;
  }

  return {
    activityEventNames: [...activityEventNames],
    message: "Queue workflow workspaceId does not match current workspace.",
    reasonCode: "precondition_failed",
    reasons: ["Queue workflow workspaceId does not match current workspace."],
    status: "precondition_failed",
  };
}

export function workflowRunWorkspaceMismatchResult<TOutput>(
  workflowRun: AgentQueueWorkflowRun,
  requestedWorkspaceId: string | null | undefined,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<TOutput> | null {
  const requested = normalizedString(requestedWorkspaceId);
  const actual = normalizedString(workflowRun.workspaceId);
  if (!requested || !actual || requested === actual) {
    return null;
  }

  return {
    activityEventNames: [...activityEventNames],
    message: "Queue workflow workspaceId does not match returned workflow run.",
    reasonCode: "precondition_failed",
    reasons: [
      "Queue workflow workspaceId does not match returned workflow run.",
    ],
    status: "precondition_failed",
  };
}

