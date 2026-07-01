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
  isQueueDisabledStartBlocker,
  queueControlStateFromBridge,
} from "./queueBridgeControlCapabilities";
import { nextActionFieldsForSingleTaskSummary } from "./queueBridgeItemCapabilities";
import { nextActionFieldsForSuggestedCapability } from "./queueBridgeNextActionHelpers";
import { hasOwn } from "./queueBridgePrimitiveHelpers";
import {
  adapterFailure,
  bridgeUnavailableResult,
} from "./queueBridgeResultHelpers";
import {
  executorTargets,
  queueTaskSummaryFromSnapshot,
  QUEUE_DISABLED_BLOCKER,
  QUEUE_DISABLED_MESSAGE,
} from "./queueBridgeTaskProjection";

export function workflowNotFoundResult<TOutput>(
  activityEventNames: readonly string[],
  workflowRunId: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message: `Queue workflow run "${workflowRunId}" was not found.`,
    reasonCode: "precondition_failed",
    reasons: [`Queue workflow run "${workflowRunId}" was not found.`],
    status: "precondition_failed",
  };
}

export async function updateRunSettingsThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: Required<Pick<QueueAgentUpdateRunSettingsInput, "taskId">> &
    Omit<QueueAgentUpdateRunSettingsInput, "taskId">,
  dryRun: boolean,
): Promise<QueueAgentAdapterResult<QueueAgentUpdateRunSettingsResult>> {
  if (!bridge) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.updateRunSettings,
      "Queue run settings update is unavailable.",
    );
  }

  const current = await loadQueueItemSnapshot(bridge, input.taskId);
  if (current.status !== "succeeded" || !current.output) {
    return adapterFailure(current);
  }
  const currentItem = current.output;

  const patch = runSettingsPatch(input);
  const appliedFields = Object.keys(patch);
  if (appliedFields.length === 0) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.updateRunSettings],
      message:
        "Queue run settings update requires at least one supplied setting.",
      reasons: [
        "Queue run settings update requires at least one supplied setting.",
      ],
      status: "invalid_input",
    };
  }

  if (dryRun) {
    const previewItem = {
      ...currentItem,
      approvalPolicy:
        patch.approvalPolicy === undefined
          ? currentItem.approvalPolicy
          : patch.approvalPolicy,
      codexExecutable:
        patch.codexExecutable === undefined
          ? currentItem.codexExecutable
          : patch.codexExecutable,
      executionWorkspace:
        patch.executionWorkspace === undefined
          ? currentItem.executionWorkspace
          : patch.executionWorkspace,
      sandbox: patch.sandbox === undefined ? currentItem.sandbox : patch.sandbox,
    };
    const previewSummary = queueTaskSummaryFromSnapshot(
      previewItem,
      executorTargets(bridge),
      queueControlStateFromBridge(bridge),
    );

    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.updateRunSettings],
      message: "Queue run settings update preview prepared.",
      output: {
        appliedFields,
        item: previewSummary,
        ...nextActionFieldsForSingleTaskSummary(
          [previewSummary],
          previewSummary.nextSuggestedCapability ?? null,
        ),
        nextSuggestedCapability: previewSummary.nextSuggestedCapability,
        taskId: input.taskId,
      },
      status: "succeeded",
    };
  }

  const updateResult = await bridge.updateItem({
    itemId: input.taskId,
    patch,
    reason: "workspace_agent_run_settings",
  });
  const updated = validItemOrResult(
    updateResult,
    QUEUE_ACTIVITY_EVENTS.updateRunSettings,
  );
  if (updated.status !== "succeeded" || !updated.output) {
    return adapterFailure(updated);
  }
  const updatedItem = updated.output;

  const summary = queueTaskSummaryFromSnapshot(
    updatedItem,
    executorTargets(bridge),
    queueControlStateFromBridge(bridge),
  );

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.updateRunSettings],
    message: "Queue run settings updated.",
    output: {
      appliedFields,
      item: summary,
      ...nextActionFieldsForSingleTaskSummary(
        [summary],
        summary.nextSuggestedCapability ?? null,
      ),
      nextSuggestedCapability: summary.nextSuggestedCapability,
      taskId: input.taskId,
    },
    status: "succeeded",
  };
}

export async function promoteDraftThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  taskId: string,
  dryRun: boolean,
): Promise<QueueAgentAdapterResult<QueueAgentPromoteDraftResult>> {
  if (!bridge) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.promoteDraft,
      "Queue draft promotion is unavailable.",
    );
  }

  const current = await loadQueueItemSnapshot(bridge, taskId);
  if (current.status !== "succeeded" || !current.output) {
    return adapterFailure(current);
  }
  const currentItem = current.output;

  const queueControlState = queueControlStateFromBridge(bridge);
  const summary = queueTaskSummaryFromSnapshot(
    currentItem,
    executorTargets(bridge),
    queueControlState,
  );
  if (currentItem.status !== "draft") {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
      message: `Queue item "${taskId}" is not a Draft.`,
      output: {
        item: summary,
        previousStatus: currentItem.status,
        taskId,
        wouldPromote: false,
      },
      reasonCode: "precondition_failed",
      reasons: [`Queue item "${taskId}" is not a Draft.`],
      status: "precondition_failed",
    };
  }

  if (!summary.canPromote) {
    const nextActionFields = nextActionFieldsForSingleTaskSummary(
      [summary],
      summary.nextSuggestedCapability ?? null,
    );
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
      message:
        summary.blockerReasons[0] ?? "Complete draft readiness before queuing.",
      output: {
        item: summary,
        ...nextActionFields,
        nextSuggestedCapability: summary.nextSuggestedCapability,
        previousStatus: currentItem.status,
        taskId,
        wouldPromote: false,
      },
      reasonCode: "task_not_ready",
      reasons: summary.blockerReasons,
      status: nextActionFields.nextAction
        ? "blocked_actionable"
        : "precondition_failed",
    };
  }

  if (dryRun) {
    const promotedSummary = queueTaskSummaryFromSnapshot(
      {
        ...currentItem,
        status: "queued",
      },
      executorTargets(bridge),
      queueControlState,
    );

    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
      message: "Queue draft promotion preview prepared.",
      output: {
        item: promotedSummary,
        ...nextActionFieldsForSingleTaskSummary(
          [promotedSummary],
          promotedSummary.nextSuggestedCapability ?? null,
        ),
        nextSuggestedCapability: promotedSummary.nextSuggestedCapability,
        previousStatus: currentItem.status,
        taskId,
        wouldPromote: true,
      },
      status: "succeeded",
    };
  }

  const updateResult = await bridge.updateItem({
    itemId: taskId,
    patch: { status: "queued" },
    reason: "workspace_agent_promote_draft",
  });
  const updated = validItemOrResult(
    updateResult,
    QUEUE_ACTIVITY_EVENTS.promoteDraft,
  );
  if (updated.status !== "succeeded" || !updated.output) {
    return adapterFailure(updated);
  }
  const updatedItem = updated.output;

  const updatedSummary = queueTaskSummaryFromSnapshot(
    updatedItem,
    executorTargets(bridge),
    queueControlState,
  );

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
    message: "Queue draft promoted to queued.",
    output: {
      item: updatedSummary,
      ...nextActionFieldsForSingleTaskSummary(
        [updatedSummary],
        updatedSummary.nextSuggestedCapability ?? null,
      ),
      nextSuggestedCapability: updatedSummary.nextSuggestedCapability,
      previousStatus: currentItem.status,
      taskId,
      wouldPromote: true,
    },
    status: "succeeded",
  };
}

export async function startQueueLinkedRunThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: { executorWidgetId: string; queueId?: string; taskId: string },
  dryRun: boolean,
): Promise<QueueAgentAdapterResult<QueueAgentStartRunAttemptResult>> {
  if (!bridge?.startQueueLinkedRun) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.startRun,
      "Queue-linked start controls are unavailable.",
    );
  }

  const result = await bridge.startQueueLinkedRun({
    dryRun,
    executorWidgetId: input.executorWidgetId,
    queueId: input.queueId,
    taskId: input.taskId,
  });

  if (!result.ok || !result.response) {
    const queueDisabled =
      queueControlStateFromBridge(bridge)?.queueEnabled === false ||
      isQueueDisabledStartBlocker(result.blockerReasons ?? [result.message]);
    const status =
      result.status === "confirmation_required"
        ? "confirmation_required"
        : result.status === "unavailable"
          ? "unavailable"
          : queueDisabled
            ? "blocked_actionable"
            : "precondition_failed";
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.startRun],
      message: result.message,
      output: queueDisabled
        ? {
            blockers: [QUEUE_DISABLED_BLOCKER],
            blockerReasons: [QUEUE_DISABLED_MESSAGE],
            executorWidgetId: input.executorWidgetId,
            ...nextActionFieldsForSuggestedCapability({
              nextSuggestedCapability: "queue.enable",
              reason:
                "Queue-linked run start is blocked until Queue execution is enabled.",
            }),
            nextSuggestedCapability: "queue.enable",
            queueEnabled: false,
            startedDirectWork: false,
            taskId: input.taskId,
          }
        : undefined,
      reasonCode: queueDisabled ? "queue_disabled" : "precondition_failed",
      reasons: result.blockerReasons ?? [result.message],
      status,
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.startRun],
    message: dryRun
      ? "Queue-linked run start preview prepared."
      : "Queue-linked run started.",
    output: {
      executorWidgetId: result.response.executorWidgetInstanceId,
      ...nextActionFieldsForSuggestedCapability({
        nextSuggestedCapability: "queue.lifecycle.get",
        reason: "Queue-linked run start can be followed by a lifecycle read.",
        taskId: result.response.queueItemId,
      }),
      queueItemId: result.response.queueItemId,
      queueLinkedMetadata: {
        executorWidgetId: result.response.executorWidgetInstanceId,
        queueItemId: result.response.queueItemId,
        runId: result.response.runId,
        source: "queue_manual_start",
        workspaceId: result.response.workspaceId,
      },
      runId: result.response.runId,
      startedDirectWork: true,
      taskId: result.response.queueItemId,
      nextSuggestedCapability: "queue.lifecycle.get",
    },
    status: "succeeded",
  };
}

export function runSettingsPatch(
  input: Required<Pick<QueueAgentUpdateRunSettingsInput, "taskId">> &
    Omit<QueueAgentUpdateRunSettingsInput, "taskId">,
): QueueUpdateItemPatch {
  const patch: QueueUpdateItemPatch = {};

  if (hasOwn(input, "codexExecutable")) {
    patch.codexExecutable = input.codexExecutable ?? null;
  }

  if (hasOwn(input, "workspaceRoot")) {
    patch.executionWorkspace = input.workspaceRoot ?? null;
  }

  if (hasOwn(input, "sandbox")) {
    patch.sandbox = input.sandbox ?? null;
  }

  if (hasOwn(input, "approvalPolicy")) {
    patch.approvalPolicy = input.approvalPolicy ?? null;
  }

  return patch;
}

export async function loadQueueItemSnapshot(
  bridge: WorkspaceAgentQueueBridge,
  taskId: string,
): Promise<QueueAgentAdapterResult<QueueWidgetItemSnapshot>> {
  const result = await bridge.getSnapshot({
    includeSelectedItem: true,
    itemLimit: 200,
    runLinkLimitPerItem: 1,
    selectedItemId: taskId,
  });
  const snapshot = validSnapshotOrResult(
    result,
    QUEUE_ACTIVITY_EVENTS.itemsList,
  );
  if (snapshot.status !== "succeeded" || !snapshot.output) {
    return adapterFailure(snapshot);
  }
  const queueSnapshot = snapshot.output;

  const item =
    queueSnapshot.selectedItem?.id === taskId
      ? queueSnapshot.selectedItem
      : queueSnapshot.items.find((candidate) => candidate.id === taskId);

  if (!item) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.itemsList],
      message: `Queue item "${taskId}" was not found.`,
      reasonCode: "precondition_failed",
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "precondition_failed",
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.itemsList],
    message: "Queue item loaded.",
    output: item,
    status: "succeeded",
  };
}

export function validSnapshotOrResult(
  result: QueueWidgetActionResult<QueueWidgetSnapshot>,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueWidgetSnapshot> {
  if (!result.ok || !result.snapshot) {
    return {
      activityEventNames: [...activityEventNames],
      message:
        result.error?.message ?? result.message ?? "Queue snapshot unavailable.",
      reasonCode: "capability_unavailable",
      reasons: [result.error?.message ?? result.message],
      status: "unavailable",
    };
  }

  return {
    activityEventNames: [...activityEventNames],
    message: result.message,
    output: result.snapshot,
    status: "succeeded",
  };
}

export function validItemOrResult(
  result: QueueWidgetActionResult<QueueWidgetItemSnapshot>,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueWidgetItemSnapshot> {
  if (!result.ok || !result.item) {
    const notFound = result.error?.code === "item_not_found";
    return {
      activityEventNames: [...activityEventNames],
      message: result.error?.message ?? result.message ?? "Queue item unavailable.",
      reasonCode: notFound ? "precondition_failed" : "capability_unavailable",
      reasons: [result.error?.message ?? result.message],
      status: notFound ? "precondition_failed" : "unavailable",
    };
  }

  return {
    activityEventNames: [...activityEventNames],
    message: result.message,
    output: result.item,
    status: "succeeded",
  };
}

export function isRunnableStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

export function isFinalStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isSupportedSandbox(
  value: string | null | undefined,
): value is QueueAgentRunSandbox {
  return (
    value === "danger_full_access" ||
    value === "read_only" ||
    value === "workspace_write"
  );
}

export function isSupportedApprovalPolicy(
  value: string | null | undefined,
): value is QueueAgentRunApprovalPolicy {
  return value === "never" || value === "on_request" || value === "untrusted";
}

