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
import { boundedItemLimit } from "./queueBridgePrimitiveHelpers";
import {
  aggregateReadUnavailableResult,
  bridgeUnavailableResult,
} from "./queueBridgeResultHelpers";
import {
  AGGREGATE_SOURCE,
  createdQueueItemReadiness,
  queueTaskSummaryFromAggregate,
} from "./queueBridgeTaskProjection";

export async function getLifecycleThroughAggregate(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: QueueAgentLifecycleGetInput,
  _context: unknown,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleGetOutput>> {
  const taskId = input.taskId?.trim() ?? "";
  if (!taskId) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
      message: "queue.lifecycle.get requires taskId.",
      reasons: ["queue.lifecycle.get requires taskId."],
      status: "invalid_input",
    };
  }

  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleGet,
      "Queue aggregate lifecycle read API is unavailable.",
    );
  }

  let aggregate: AgentQueueItemAggregate | null;
  try {
    aggregate = await backendApi.getItemAggregate({ taskId });
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleGet,
      error,
      "Queue aggregate lifecycle read API is unavailable.",
    );
  }

  if (!aggregate) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
      message: `Queue item "${taskId}" was not found.`,
      reasonCode: "precondition_failed",
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "precondition_failed",
    };
  }

  const summary = queueTaskSummaryFromAggregate(
    aggregate,
    queueControlStateFromBridge(bridge),
  );
  const nextSuggestedCapability = nextCapabilityForLifecycleRead(summary);
  const nextActionFields = nextActionFieldsForSuggestedCapability({
    executorWidgetId: summary.assignedExecutorWidgetId,
    nextSuggestedCapability,
    reason:
      "Queue lifecycle read exposed the next task-scoped lifecycle capability.",
    runId: summary.latestRunId,
    taskId: summary.taskId,
  });

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
    message: "Queue lifecycle read from backend aggregate.",
    output: {
      aggregate: summary,
      aggregateSource: AGGREGATE_SOURCE,
      authoritativeBackendAggregate: true,
      blockerReasons: summary.blockerReasons,
      blockers: summary.blockers ?? [],
      commitState: summary.commitState,
      dependencyState: summary.dependencyState,
      durableFlags: summary.durableFlags,
      evidenceState: summary.evidenceState,
      evidenceSummary: summary.evidenceSummary ?? null,
      latestRun: summary.latestRun ?? null,
      lifecycle: null,
      ...nextActionFields,
      nextActions: summary.nextActions ?? [],
      nextSuggestedCapability,
      reviewState: summary.reviewState,
      taskId: summary.taskId,
      ticketState: summary.ticketState,
      updatedAt: summary.updatedAt,
      validationState: summary.validationState,
      workerRunState: summary.workerRunState,
    },
    status: "succeeded",
  };
}

export async function getLifecycleTaskSeed(
  bridge: WorkspaceAgentQueueBridge,
  taskId: string,
): Promise<QueueAgentAdapterResult<QueueAgentLifecycleTaskSeed>> {
  const snapshotResult = await bridge.getSnapshot({
    includeSelectedItem: true,
    itemLimit: 200,
    selectedItemId: taskId,
  });
  if (!snapshotResult.ok || !snapshotResult.snapshot) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
      message:
        snapshotResult.error?.message ??
        snapshotResult.message ??
        "Queue snapshot is unavailable.",
      reasons: [
        snapshotResult.error?.message ??
          snapshotResult.message ??
          "Queue snapshot is unavailable.",
      ],
      status: "unavailable",
    };
  }

  const item =
    snapshotResult.snapshot.selectedItem?.id === taskId
      ? snapshotResult.snapshot.selectedItem
      : snapshotResult.snapshot.items.find((candidate) => candidate.id === taskId);

  if (!item) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
      message: `Queue item "${taskId}" was not found.`,
      reasonCode: "precondition_failed",
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "precondition_failed",
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleGet],
    message: "Queue dogfood lifecycle task seed loaded.",
    output: {
      createdAt: item.createdAt,
      prompt: item.prompt,
      status: item.status,
      taskId: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
    },
    status: "succeeded",
  };
}

export async function listQueueItemsThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: QueueAgentListItemsInput,
): Promise<QueueAgentAdapterResult<QueueAgentListItemsResult>> {
  if (!backendApi) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.itemsList,
      "Queue aggregate list read API is unavailable.",
    );
  }

  const limit = boundedItemLimit(input.limit);
  let aggregates: AgentQueueItemAggregate[];
  try {
    aggregates = await backendApi.listItemAggregates();
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.itemsList,
      error,
      "Queue aggregate list read API is unavailable.",
    );
  }

  const availableExecutors = bridge ? executorTargets(bridge) : [];
  const sourceItems = input.taskId
    ? aggregates.filter((item) => item.taskId === input.taskId)
    : aggregates;

  if (input.taskId && sourceItems.length === 0) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.itemsList],
      message: `Queue item "${input.taskId}" was not found.`,
      output: {
        aggregateSource: AGGREGATE_SOURCE,
        authoritativeBackendAggregate: true,
        availableExecutors,
        capped: false,
        itemCount: 0,
        items: [],
        nextSuggestedCapability: "queue.items.list",
      },
      reasonCode: "precondition_failed",
      reasons: [`Queue item "${input.taskId}" was not found.`],
      status: "precondition_failed",
    };
  }

  const queueControlState = queueControlStateFromBridge(bridge);
  const items = sourceItems
    .slice(0, limit)
    .map((item) => queueTaskSummaryFromAggregate(item, queueControlState));
  const nextSuggestedCapability = nextCapabilityForSummaries(items);
  const nextActionFields = nextActionFieldsForSingleTaskSummary(
    items,
    nextSuggestedCapability,
  );

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.itemsList],
    message: input.taskId
      ? "Queue item read from backend aggregate."
      : "Queue items listed from backend aggregate.",
    output: {
      aggregateSource: AGGREGATE_SOURCE,
      authoritativeBackendAggregate: true,
      availableExecutors,
      capped: !input.taskId && sourceItems.length > items.length,
      itemCount: items.length,
      items,
      ...nextActionFields,
      nextSuggestedCapability,
    },
    status: "succeeded",
  };
}


export async function createQueueItemsThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  request: QueueAgentCreateItemsRequest,
): Promise<QueueAgentAdapterResult<QueueAgentCreateItemsResult>> {
  if (!bridge) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
      message: "Queue capability unavailable",
      reasons: ["Workspace Queue bridge is unavailable."],
      status: "unavailable",
    };
  }

  const createdItems: QueueAgentCreatedItem[] = [];

  for (const item of request.items) {
    const result = await bridge.createItem({
      dependencies: item.dependencies,
      description: item.description,
      prompt: item.prompt,
      status: item.status,
      title: item.title,
    });

    if (!result.ok || !result.item) {
      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
        message: result.error?.message ?? result.message,
        reasonCode: "unexpected_error",
        reasons: [result.error?.message ?? result.message],
        status: "failed_unexpected",
      };
    }

    const readiness = await createdQueueItemReadiness(bridge, result.item);
    const createdItem = queueAgentCreatedItem({
      ...item,
      id: result.item.id,
    });
    const readinessNextActionFields = nextActionFieldsForSingleTaskSummary(
      [readiness],
      readiness.nextSuggestedCapability ?? null,
    );
    createdItems.push({
      ...createdItem,
      ...readinessNextActionFields,
      dependencies: [...result.item.dependencies],
      id: result.item.id,
      nextSuggestedCapability: readiness.nextSuggestedCapability ?? null,
      prompt: result.item.prompt,
      readiness,
      status: result.item.status === "draft" ? "draft" : "queued",
      title: result.item.title,
    });
  }

  const nextSuggestedCapability =
    createdItems.find((item) => item.nextSuggestedCapability)
      ?.nextSuggestedCapability ?? null;
  const nextActionFields = nextActionFieldsForSingleCreatedItem(
    createdItems,
    nextSuggestedCapability,
  );

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
    message: "Queue items created",
    output: {
      ...createQueueAgentItemsPreview(request.items),
      ...nextActionFields,
      createdItemCount: createdItems.length,
      createdItems,
      createdTaskIds: createdItems.map((item) => item.id),
      dependencyEdgesPreserved: true,
      nextSuggestedCapability,
    },
    status: "succeeded",
  };
}

export function nextActionFieldsForSingleCreatedItem(
  createdItems: readonly QueueAgentCreatedItem[],
  nextSuggestedCapability: string | null,
): QueueAgentNextActionFields {
  if (!nextSuggestedCapability) {
    return {};
  }

  if (createdItems.length !== 1) {
    return queueNextActionUnavailableFields({
      ambiguousCandidateIds: createdItems.map((item) => item.id),
      reasonCode: "ambiguous_next_action",
      reasonMessage:
        "A top-level Queue nextAction is unavailable because the result contains multiple created task ids.",
    });
  }

  const item = createdItems[0];
  return item.nextAction
    ? { nextAction: item.nextAction }
    : queueNextActionUnavailableFields({
        invalidPayloadReason: item.nextActionUnavailableReason,
        missingRequiredInputs: item.missingNextActionInput ?? [],
        reasonCode: item.missingNextActionInput?.length
          ? "missing_required_input"
          : "next_action_unavailable",
        reasonMessage:
          item.nextActionUnavailableReason ??
          "A top-level Queue nextAction is unavailable for the created task.",
      });
}

export function nextActionFieldsForSingleTaskSummary(
  items: readonly QueueAgentTaskSummary[],
  nextSuggestedCapability: string | null,
): QueueAgentNextActionFields {
  if (!nextSuggestedCapability) {
    return {};
  }

  if (items.length !== 1) {
    return queueNextActionUnavailableFields({
      ambiguousCandidateIds: items.map((item) => item.taskId),
      reasonCode: "ambiguous_next_action",
      reasonMessage:
        "A top-level Queue nextAction is unavailable because the result contains multiple candidate task ids.",
    });
  }

  const item = items[0];
  return item.nextAction
    ? { nextAction: item.nextAction }
    : queueNextActionUnavailableFields({
        invalidPayloadReason: item.nextActionUnavailableReason,
        missingRequiredInputs: item.missingNextActionInput ?? [],
        reasonCode: item.missingNextActionInput?.length
          ? "missing_required_input"
          : "next_action_unavailable",
        reasonMessage:
          item.nextActionUnavailableReason ??
          "A top-level Queue nextAction is unavailable for the selected task.",
      });
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

