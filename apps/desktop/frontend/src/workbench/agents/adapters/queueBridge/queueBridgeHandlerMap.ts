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
  enableQueueThroughBridge,
  getQueueControlStateThroughBridge,
  setQueueControlManualEnabledThroughBridge,
} from "./queueBridgeControlCapabilities";
import { markDoneThroughBackend, failItemThroughBackend } from "./queueBridgeFinalizationCapabilities";
import {
  createQueueItemsThroughBridge,
  getLifecycleTaskSeed,
  getLifecycleThroughAggregate,
  listQueueItemsThroughBackend,
} from "./queueBridgeItemCapabilities";
import {
  createUnavailableDogfoodLifecycleAdapterApi,
} from "./queueBridgeResultHelpers";
import {
  promoteDraftThroughBridge,
  startQueueLinkedRunThroughBridge,
  updateRunSettingsThroughBridge,
} from "./queueBridgeRunCapabilities";
import {
  ackReviewThroughBackend,
  createReviewMessageThroughBackend,
} from "./queueBridgeReviewCapabilities";
import {
  getWorkerEvidenceBundleThroughBackend,
  recordWorkerFinishedThroughBackend,
} from "./queueBridgeWorkerEvidenceCapabilities";
import {
  getWorkflowReportThroughBridge,
  getWorkflowThroughBridge,
  listWorkflowsThroughBridge,
  planWorkflowResumeThroughBridge,
  readWorkflowActionLogThroughBridge,
} from "./queueBridgeWorkflowDebugCapabilities";

export type WorkspaceAgentQueueBridgeAdapterOptions = {
  backendApi?: QueueBackendCapabilityPort | null;
};

const WORKFLOW_DIAGNOSTIC_REF_MAP_LIMIT = 25;

export function createWorkspaceAgentQueueBridgeAdapterApi(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  options: WorkspaceAgentQueueBridgeAdapterOptions = {},
): QueueAgentAdapterApi {
  const defaultAdapter = createDefaultQueueAgentAdapterApi();
  const backendApi =
    options.backendApi === undefined
      ? createQueueBackendCapabilityPort(bridge)
      : options.backendApi;
  const transitionalDogfoodLifecycle = bridge
    ? createInMemoryQueueDogfoodLifecycleAdapterApi({
        getTaskSeed: (taskId) => getLifecycleTaskSeed(bridge, taskId),
      })
    : undefined;
  const dogfoodLifecycle =
    transitionalDogfoodLifecycle ??
    (backendApi ? createUnavailableDogfoodLifecycleAdapterApi() : undefined);

  return {
    ...defaultAdapter,
    backend: backendApi,
    createItems: (request) => createQueueItemsThroughBridge(bridge, request),
    getQueueControlState: (input, context) =>
      getQueueControlStateThroughBridge(bridge, input, context),
    getWorkflow: (input, context) =>
      getWorkflowThroughBridge(bridge, input, context),
    getWorkflowReport: (input, context) =>
      getWorkflowReportThroughBridge(bridge, input, context),
    listWorkflows: (input, context) =>
      listWorkflowsThroughBridge(bridge, input, context),
    planWorkflowResume: (input, context) =>
      planWorkflowResumeThroughBridge(bridge, input, context),
    readWorkflowActionLog: (input, context) =>
      readWorkflowActionLogThroughBridge(bridge, input, context),
    setQueueControlManualEnabled: (input, context) =>
      setQueueControlManualEnabledThroughBridge(bridge, input, context),
    enableQueue: (input, context) =>
      enableQueueThroughBridge(bridge, input, context),
    dogfoodLifecycle: dogfoodLifecycle
      ? {
          ...dogfoodLifecycle,
          ackReview: (input, context) =>
            ackReviewThroughBackend(backendApi, bridge, input, context),
          agentFinished: (input, context) =>
            recordWorkerFinishedThroughBackend(backendApi, bridge, input, context),
          createReviewMessage: (input, context) =>
            createReviewMessageThroughBackend(backendApi, bridge, input, context),
          getEvidenceBundle: (input, context) =>
            getWorkerEvidenceBundleThroughBackend(backendApi, bridge, input, context),
          getLifecycle: (input, context) =>
            getLifecycleThroughAggregate(backendApi, bridge, input, context),
          failItem: (input, context) =>
            failItemThroughBackend(backendApi, bridge, input, context),
          markDone: (input, context) =>
            markDoneThroughBackend(backendApi, bridge, input, context),
        }
      : undefined,
    importPromptPack: async (input, request) => {
      const preview = await defaultAdapter.previewPromptPack(input);
      if (preview.status !== "succeeded" || !preview.output) {
        return {
          activityEventNames: preview.activityEventNames,
          message: preview.message,
          reasons: preview.reasons,
          status: preview.status,
        };
      }

      const createResult = await createQueueItemsThroughBridge(bridge, request);
      if (createResult.status !== "succeeded" || !createResult.output) {
        return {
          activityEventNames: createResult.activityEventNames,
          message: createResult.message,
          reasons: createResult.reasons,
          status: createResult.status,
        };
      }

      return {
        activityEventNames: [...QUEUE_ACTIVITY_EVENTS.importPromptPack],
        message: "Queue items created",
        output: {
          ...preview.output,
          createdItemCount: createResult.output.createdItemCount,
          createdItems: createResult.output.createdItems,
          createdTaskIds: createResult.output.createdTaskIds,
          dependencyEdgesPreserved: createResult.output.dependencyEdgesPreserved,
          nextSuggestedCapability: createResult.output.nextSuggestedCapability,
        },
        status: "succeeded",
      };
    },
    listItems: (input) => listQueueItemsThroughBackend(backendApi, bridge, input),
    promoteDraft: (input, context) =>
      promoteDraftThroughBridge(bridge, input.taskId, context.dryRun),
    startQueueLinkedRun: (input, context) =>
      startQueueLinkedRunThroughBridge(bridge, input, context.dryRun),
    supportsDependencyEdges: true,
    supportsSafeMutationSandbox: false,
    updateRunSettings: (input, context) =>
      updateRunSettingsThroughBridge(bridge, input, context.dryRun),
  };
}
