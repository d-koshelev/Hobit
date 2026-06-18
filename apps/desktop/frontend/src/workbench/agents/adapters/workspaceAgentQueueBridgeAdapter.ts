import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type {
  AgentQueueItemAggregate,
  AgentQueueReviewCommandResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
} from "../../../workspace/types";
import {
  createQueueBackendCapabilityPort,
  type QueueBackendCapabilityPort,
} from "./queueBackendCapabilityPort";
import { createInMemoryQueueDogfoodLifecycleAdapterApi } from "./queueAgentDogfoodLifecycleController";
import { createDefaultQueueAgentAdapterApi } from "./queueAgentCapabilities";
import {
  createQueueAgentItemsPreview,
  queueAgentCreatedItem,
  QUEUE_ACTIVITY_EVENTS,
  type QueueAgentAdapterApi,
  type QueueAgentAdapterResult,
  type QueueAgentAggregateNextAction,
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
  type QueueAgentPromoteDraftResult,
  type QueueAgentPromptPackInput,
  type QueueAgentRunApprovalPolicy,
  type QueueAgentRunSandbox,
  type QueueAgentReviewAckInput,
  type QueueAgentReviewCreateMessageInput,
  type QueueAgentReviewEvidenceBundleInput,
  type QueueAgentReviewEvidenceBundleOutput,
  type QueueAgentStartRunResult,
  type QueueAgentTaskReadiness,
  type QueueAgentTaskSummary,
  type QueueAgentUpdateRunSettingsInput,
  type QueueAgentUpdateRunSettingsResult,
} from "./queueAgentCapabilityTypes";
import type {
  QueueUpdateItemPatch,
  QueueWidgetActionResult,
  QueueWidgetItemSnapshot,
  QueueWidgetSnapshot,
} from "../../queue/agentQueueWidgetApiTypes";

export type WorkspaceAgentQueueBridgeAdapterOptions = {
  backendApi?: QueueBackendCapabilityPort | null;
};

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
    enableQueue: (input, context) =>
      enableQueueThroughBridge(bridge, input, context),
    dogfoodLifecycle: dogfoodLifecycle
      ? {
          ...dogfoodLifecycle,
          ackReview: (input, context) =>
            ackReviewThroughBackend(backendApi, input, context),
          agentFinished: (input, context) =>
            recordWorkerFinishedThroughBackend(backendApi, input, context),
          createReviewMessage: (input, context) =>
            createReviewMessageThroughBackend(backendApi, input, context),
          getEvidenceBundle: (input, context) =>
            getWorkerEvidenceBundleThroughBackend(backendApi, input, context),
          getLifecycle: (input, context) =>
            getLifecycleThroughAggregate(backendApi, input, context),
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

function createUnavailableDogfoodLifecycleAdapterApi(): NonNullable<
  QueueAgentAdapterApi["dogfoodLifecycle"]
> {
  return {
    ackReview: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
        "Queue review command API is unavailable.",
      ),
    addFollowUpPrompt: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleFollowUpPromptAdded,
        "Queue follow-up prompt is transitional and requires the Queue controller overlay.",
      ),
    agentFinished: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
        "Queue worker evidence command API is unavailable.",
      ),
    approveValidation: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleValidationApproved,
        "Queue validation approval is transitional and requires the Queue controller overlay.",
      ),
    blockItem: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleItemBlock,
        "Queue block is transitional and requires the Queue controller overlay.",
      ),
    createReviewMessage: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
        "Queue review command API is unavailable.",
      ),
    failItem: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleItemFail,
        "Queue fail is transitional and requires the Queue controller overlay.",
      ),
    getEvidenceBundle: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle,
        "Queue worker evidence read API is unavailable.",
      ),
    getLifecycle: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleGet,
        "Queue aggregate lifecycle read API is unavailable.",
      ),
    markDone: () =>
      unavailableLifecycleResult(
        QUEUE_ACTIVITY_EVENTS.lifecycleItemMarkDone,
        "Queue mark done is transitional and requires the Queue controller overlay.",
      ),
  };
}

function unavailableLifecycleResult<TOutput>(
  activityEventNames: readonly string[],
  message: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    status: "unavailable",
  };
}

async function getLifecycleThroughAggregate(
  backendApi: QueueBackendCapabilityPort | null | undefined,
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
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "failed",
    };
  }

  const summary = queueTaskSummaryFromAggregate(aggregate);

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
      nextActions: summary.nextActions ?? [],
      nextSuggestedCapability: summary.nextSuggestedCapability,
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

async function getLifecycleTaskSeed(
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
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "failed",
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

async function listQueueItemsThroughBackend(
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
      reasons: [`Queue item "${input.taskId}" was not found.`],
      status: "failed",
    };
  }

  const items = sourceItems
    .slice(0, limit)
    .map((item) => queueTaskSummaryFromAggregate(item));

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
      nextSuggestedCapability: nextCapabilityForSummaries(items),
    },
    status: "succeeded",
  };
}

async function updateRunSettingsThroughBridge(
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
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.updateRunSettings],
      message: "Queue run settings update preview prepared.",
      output: {
        appliedFields,
        item: queueTaskSummaryFromSnapshot(
          {
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
            sandbox:
              patch.sandbox === undefined ? currentItem.sandbox : patch.sandbox,
          },
          executorTargets(bridge),
        ),
        nextSuggestedCapability: "queue.item.promoteDraft",
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

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.updateRunSettings],
    message: "Queue run settings updated.",
    output: {
      appliedFields,
      item: queueTaskSummaryFromSnapshot(updatedItem, executorTargets(bridge)),
      nextSuggestedCapability:
        updatedItem.status === "draft"
          ? "queue.item.promoteDraft"
          : "queue.item.startRun",
      taskId: input.taskId,
    },
    status: "succeeded",
  };
}

async function promoteDraftThroughBridge(
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

  const summary = queueTaskSummaryFromSnapshot(currentItem, executorTargets(bridge));
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
      reasons: [`Queue item "${taskId}" is not a Draft.`],
      status: "failed",
    };
  }

  if (!summary.canPromote) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
      message:
        summary.blockerReasons[0] ?? "Complete draft readiness before queuing.",
      output: {
        item: summary,
        nextSuggestedCapability: summary.nextSuggestedCapability,
        previousStatus: currentItem.status,
        taskId,
        wouldPromote: false,
      },
      reasons: summary.blockerReasons,
      status: "failed",
    };
  }

  if (dryRun) {
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
      message: "Queue draft promotion preview prepared.",
      output: {
        item: {
          ...summary,
          nextSuggestedCapability: "queue.item.startRun",
        },
        nextSuggestedCapability: "queue.item.startRun",
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

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.promoteDraft],
    message: "Queue draft promoted to queued.",
    output: {
      item: queueTaskSummaryFromSnapshot(updatedItem, executorTargets(bridge)),
      nextSuggestedCapability: "queue.enable",
      previousStatus: currentItem.status,
      taskId,
      wouldPromote: true,
    },
    status: "succeeded",
  };
}

async function enableQueueThroughBridge(
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
  const output: QueueAgentEnableResult = {
    blockerReasons,
    didAutoRunWorkers: false,
    didStartWorkers: false,
    globalExecutionState: result.globalExecutionState,
    nextSuggestedCapability: result.ok ? "queue.item.startRun" : "queue.items.list",
    queueEnabled: result.queueEnabled,
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

async function startQueueLinkedRunThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: { executorWidgetId: string; queueId?: string; taskId: string },
  dryRun: boolean,
): Promise<QueueAgentAdapterResult<QueueAgentStartRunResult>> {
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
    const status =
      result.status === "confirmation_required"
        ? "confirmation_required"
        : result.status === "unavailable"
          ? "unavailable"
          : "failed";
    return {
      activityEventNames: [...QUEUE_ACTIVITY_EVENTS.startRun],
      message: result.message,
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
    },
    status: "succeeded",
  };
}

async function recordWorkerFinishedThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
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

    return workerFinishedCommandSucceeded(result);
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue worker evidence could not be recorded.",
      QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished,
    );
  }
}

async function getWorkerEvidenceBundleThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
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

    return workerEvidenceBundleReadSucceeded(result);
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue worker evidence bundle could not be read.",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle,
    );
  }
}

function workerFinishedCommandSucceeded(
  result: AgentQueueWorkerFinishedCommandResult,
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleAgentFinished],
    message: "Queue worker evidence recorded.",
    output: workerFinishedOutputFromBackend(result),
    status: "succeeded",
  };
}

function workerFinishedOutputFromBackend(
  result: AgentQueueWorkerFinishedCommandResult,
): QueueAgentLifecycleTransitionOutput {
  const summary = queueTaskSummaryFromAggregate(result.aggregate);

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
    nextActions: summary.nextActions ?? [],
    nextSuggestedCapability: summary.nextSuggestedCapability ?? null,
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

function workerEvidenceBundleReadSucceeded(
  result: AgentQueueWorkerEvidenceQueryResult,
): QueueAgentAdapterResult<QueueAgentReviewEvidenceBundleOutput> {
  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.lifecycleReviewEvidenceBundle],
    message:
      result.state === "available"
        ? "Queue worker evidence bundle read from backend."
        : "Queue worker evidence bundle was not found.",
    output: workerEvidenceBundleOutputFromBackend(result),
    status: "succeeded",
  };
}

function workerEvidenceBundleOutputFromBackend(
  result: AgentQueueWorkerEvidenceQueryResult,
): QueueAgentReviewEvidenceBundleOutput {
  const aggregateSummary = result.aggregate
    ? queueTaskSummaryFromAggregate(result.aggregate)
    : null;
  const bundle = result.evidenceBundle;

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
    nextActions: aggregateSummary?.nextActions ?? [],
    nextSuggestedCapability: aggregateSummary?.nextSuggestedCapability ?? null,
    reviewMessages: [],
    reviewOutcome: bundle?.outcome ?? null,
    runId: result.runId,
    taskId: result.taskId,
    validationApprovals: [],
    validationSummary: bundle?.validationSummary ?? undefined,
  };
}

function backendEvidenceCompatibilityLifecycle(
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

function changedFilesFromWorkerFinishedInput(
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

function changedFilesSummaryFromWorkerFinishedInput(
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

async function createReviewMessageThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
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
      messageBody: reviewMessageBodyFromInput(input),
      taskId,
    });
    return reviewCommandSucceeded(
      result,
      "Queue review message created.",
      "Queue review message created",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue review message could not be created.",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewCreateMessage,
    );
  }
}

async function ackReviewThroughBackend(
  backendApi: QueueBackendCapabilityPort | null | undefined,
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
      "Queue review acknowledged.",
      "Queue review acknowledged",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
    );
  } catch (error) {
    return reviewCommandFailed(
      error,
      "Queue review message could not be acknowledged.",
      QUEUE_ACTIVITY_EVENTS.lifecycleReviewAck,
    );
  }
}

async function previewReviewCommandFromAggregate(
  backendApi: QueueBackendCapabilityPort,
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
        reasons: [`Queue item "${taskId}" was not found.`],
        status: "failed",
      };
    }

    return {
      activityEventNames: [...activityEventNames],
      message,
      output: reviewTransitionOutputFromAggregate({
        actionLabel,
        aggregate,
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

function reviewCommandSucceeded(
  result: AgentQueueReviewCommandResult,
  message: string,
  actionLabel: string,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueAgentLifecycleTransitionOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    output: reviewTransitionOutputFromAggregate({
      actionLabel,
      aggregate: result.aggregate,
      context: null,
      durable: result.durable,
      messageId: result.messageId,
      queueMutation: "backend_domain",
      reviewMessage: result.reviewMessage,
    }),
    status: "succeeded",
  };
}

function reviewCommandFailed<TOutput>(
  error: unknown,
  fallbackMessage: string,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<TOutput> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    status: "failed",
  };
}

function invalidReviewCommandInput<TOutput>(
  activityEventNames: readonly string[],
  message: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    status: "invalid_input",
  };
}

function reviewTransitionOutputFromAggregate({
  actionLabel,
  aggregate,
  context,
  durable,
  messageId,
  queueMutation,
  reviewMessage,
}: {
  actionLabel: string;
  aggregate: AgentQueueItemAggregate;
  context: QueueAgentLifecycleHandlerContext | null;
  durable: boolean;
  messageId?: string;
  queueMutation: "backend_domain" | "none";
  reviewMessage?: unknown;
}): QueueAgentLifecycleTransitionOutput {
  const summary = queueTaskSummaryFromAggregate(aggregate);

  return {
    actionLabel,
    additionalPromptCount: 0,
    agentPromptState: "completed",
    aggregate,
    blockers: aggregate.blockers,
    dryRunOnly: context?.dryRun ?? false,
    durable,
    lifecycle: null,
    messageId,
    nextActions: summary.nextActions ?? [],
    nextSuggestedCapability: summary.nextSuggestedCapability ?? null,
    previousAgentPromptState: "completed",
    previousTicketState: aggregate.ticketState,
    queueMutation,
    reviewMessage,
    reviewOutcome: null,
    reviewState: aggregate.reviewState,
    taskId: aggregate.taskId,
    ticketState: aggregate.ticketState,
    value: reviewMessage,
    wouldAutoRunWorkers: false,
    wouldCallGit: false,
    wouldExecuteRollback: false,
    wouldLaunchTerminal: false,
    wouldPersistBackend: queueMutation === "backend_domain" && durable,
    wouldRunValidation: false,
    wouldStartWorkers: false,
  };
}

function reviewActorId(
  coordinatorAgentId: string | undefined,
  context: QueueAgentLifecycleHandlerContext,
) {
  return coordinatorAgentId?.trim() || context.agentId.trim() || "workspace-agent";
}

function reviewMessageBodyFromInput(
  input: QueueAgentReviewCreateMessageInput,
): string | null {
  return (
    input.finalAgentMessage?.trim() ||
    normalizeChangedFilesSummary(input.changedFilesSummary) ||
    input.validationSummary?.trim() ||
    null
  );
}

function normalizeChangedFilesSummary(value: readonly string[] | string | undefined) {
  if (Array.isArray(value)) {
    const changedFiles = value.map((item) => item.trim()).filter(Boolean);
    return changedFiles.length > 0 ? changedFiles.join(", ") : undefined;
  }

  return typeof value === "string" ? value.trim() || undefined : undefined;
}

async function createQueueItemsThroughBridge(
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
        reasons: [result.error?.message ?? result.message],
        status: "failed",
      };
    }

    createdItems.push({
      ...queueAgentCreatedItem(item),
      dependencies: [...result.item.dependencies],
      id: result.item.id,
      nextSuggestedCapability: "queue.item.updateRunSettings",
      prompt: result.item.prompt,
      readiness: queueTaskSummaryFromSnapshot(
        result.item,
        executorTargets(bridge),
      ),
      status: result.item.status === "draft" ? "draft" : "queued",
      title: result.item.title,
    });
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.createItems],
    message: "Queue items created",
    output: {
      ...createQueueAgentItemsPreview(request.items),
      createdItemCount: createdItems.length,
      createdItems,
      createdTaskIds: createdItems.map((item) => item.id),
      dependencyEdgesPreserved: true,
      nextSuggestedCapability: "queue.item.updateRunSettings",
    },
    status: "succeeded",
  };
}

const AGGREGATE_SOURCE = "tauri_queue_item_aggregate" as const;

function queueTaskSummaryFromAggregate(
  aggregate: AgentQueueItemAggregate,
): QueueAgentTaskSummary {
  const readiness = queueTaskReadinessFromAggregate(aggregate);
  const nextActions = aggregate.nextActions.map(nextActionFromAggregate);

  return {
    ...readiness,
    aggregateSource: AGGREGATE_SOURCE,
    assignedExecutorWidgetId:
      aggregate.runSettings.assignedExecutorWidgetId ?? null,
    authoritativeBackendAggregate: true,
    blockers: aggregate.blockers,
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

function queueTaskReadinessFromAggregate(
  aggregate: AgentQueueItemAggregate,
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

  return {
    blockerReasons,
    canPromote: false,
    canStart,
    draftState: "not_draft",
    hasApprovalPolicy,
    hasCodexExecutable,
    hasPrompt,
    hasSandbox,
    hasWorkspace,
    nextSuggestedCapability: canStart
      ? "queue.item.startRun"
      : nextSuggestedCapabilityFromAggregate(aggregate),
    readinessState: canStart ? "runnable" : "blocked",
  };
}

function nextActionFromAggregate(
  action: AgentQueueItemAggregate["nextActions"][number],
): QueueAgentAggregateNextAction {
  return {
    ...action,
    suggestedCapability: nextActionSuggestedCapability(action.code),
  };
}

function nextSuggestedCapabilityFromAggregate(
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

function nextActionSuggestedCapability(code: string) {
  switch (code) {
    case "create_review_message":
      return "queue.review.createMessage";
    case "ack_review":
      return "queue.review.ack";
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

function queueTaskSummaryFromSnapshot(
  item: QueueWidgetItemSnapshot,
  availableExecutors: readonly QueueAgentExecutorTarget[] = [],
): QueueAgentTaskSummary {
  const readiness = queueTaskReadinessFromSnapshot(item, availableExecutors);
  const latestRunId = item.runLinks?.[0]?.directWorkRunId ?? null;

  return {
    ...readiness,
    assignedExecutorWidgetId: item.assignedExecutorWidgetId ?? null,
    latestRunId,
    status: item.status,
    taskId: item.id,
    title: item.title,
  };
}

function queueTaskReadinessFromSnapshot(
  item: QueueWidgetItemSnapshot,
  availableExecutors: readonly QueueAgentExecutorTarget[],
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

  return {
    blockerReasons,
    canPromote: false,
    canStart,
    draftState: "not_draft",
    hasApprovalPolicy,
    hasCodexExecutable,
    hasPrompt,
    hasSandbox,
    hasWorkspace,
    nextSuggestedCapability: canStart
      ? "queue.item.startRun"
      : "queue.item.updateRunSettings",
    readinessState: canStart ? "runnable" : "blocked",
  };
}

function missingRunSettingsBlockers({
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

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => Boolean(value.trim())))];
}

function shouldBlockQueueAgentRun(code: string) {
  return (
    code !== "manual_policy" &&
    code !== "missing_executor" &&
    code !== "missing_prompt" &&
    code !== "missing_execution_workspace"
  );
}

function nextCapabilityForSummaries(
  items: readonly QueueAgentTaskSummary[],
) {
  return (
    items.find((item) => item.nextSuggestedCapability)?.nextSuggestedCapability ??
    null
  );
}

function executorTargets(
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

function runSettingsPatch(
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

async function loadQueueItemSnapshot(
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
      reasons: [`Queue item "${taskId}" was not found.`],
      status: "failed",
    };
  }

  return {
    activityEventNames: [...QUEUE_ACTIVITY_EVENTS.itemsList],
    message: "Queue item loaded.",
    output: item,
    status: "succeeded",
  };
}

function validSnapshotOrResult(
  result: QueueWidgetActionResult<QueueWidgetSnapshot>,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueWidgetSnapshot> {
  if (!result.ok || !result.snapshot) {
    return {
      activityEventNames: [...activityEventNames],
      message:
        result.error?.message ?? result.message ?? "Queue snapshot unavailable.",
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

function validItemOrResult(
  result: QueueWidgetActionResult<QueueWidgetItemSnapshot>,
  activityEventNames: readonly string[],
): QueueAgentAdapterResult<QueueWidgetItemSnapshot> {
  if (!result.ok || !result.item) {
    return {
      activityEventNames: [...activityEventNames],
      message: result.error?.message ?? result.message ?? "Queue item unavailable.",
      reasons: [result.error?.message ?? result.message],
      status: result.error?.code === "item_not_found" ? "failed" : "unavailable",
    };
  }

  return {
    activityEventNames: [...activityEventNames],
    message: result.message,
    output: result.item,
    status: "succeeded",
  };
}

function adapterFailure<TOutput>(
  result: QueueAgentAdapterResult<unknown>,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: result.activityEventNames,
    message: result.message,
    reasons: result.reasons,
    status: result.status,
  };
}

function bridgeUnavailableResult<TOutput>(
  activityEventNames: readonly string[],
  message: string,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    status: "unavailable",
  };
}

function aggregateReadUnavailableResult<TOutput>(
  activityEventNames: readonly string[],
  error: unknown,
  fallbackMessage: string,
): QueueAgentAdapterResult<TOutput> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    activityEventNames: [...activityEventNames],
    message,
    reasons: [message],
    status: "unavailable",
  };
}

function boundedItemLimit(limit: number | undefined) {
  return Math.max(1, Math.min(50, limit ?? 25));
}

function isRunnableStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

function isFinalStatus(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isSupportedSandbox(
  value: string | null | undefined,
): value is QueueAgentRunSandbox {
  return (
    value === "danger_full_access" ||
    value === "read_only" ||
    value === "workspace_write"
  );
}

function isSupportedApprovalPolicy(
  value: string | null | undefined,
): value is QueueAgentRunApprovalPolicy {
  return value === "never" || value === "on_request" || value === "untrusted";
}

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  object: TObject,
  key: TKey,
): object is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}
