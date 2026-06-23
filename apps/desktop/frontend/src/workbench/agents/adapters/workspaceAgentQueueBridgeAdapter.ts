import type {
  WorkspaceAgentQueueBridge,
  WorkspaceAgentQueueControlState,
} from "../../workspaceAgentQueueBridge";
import type {
  AgentQueueItemAggregate,
  AgentQueueCompletionCommandResult,
  AgentQueueFailureCommandResult,
  AgentQueueReviewCommandResult,
  AgentQueueReviewCreateMessageResult,
  AgentQueueWorkerEvidenceQueryResult,
  AgentQueueWorkerFinishedCommandResult,
} from "../../../workspace/types";
import {
  createQueueBackendCapabilityPort,
  type QueueBackendCapabilityPort,
} from "./queueBackendCapabilityPort";
import {
  buildQueueCapabilityNextAction,
  QUEUE_START_RUN_CONFIRMATION_TOKEN,
} from "../capabilities/queueCapabilityContracts";
import { createInMemoryQueueDogfoodLifecycleAdapterApi } from "./queueAgentDogfoodLifecycleController";
import { createDefaultQueueAgentAdapterApi } from "./queueAgentCapabilities";
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
    getQueueControlState: (input, context) =>
      getQueueControlStateThroughBridge(bridge, input, context),
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
        "Queue terminal failure command API is unavailable.",
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
        "Queue accepted completion command API is unavailable.",
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
    reasonCode: "capability_unavailable",
    reasons: [message],
    status: "unavailable",
  };
}

function getQueueControlStateThroughBridge(
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

async function setQueueControlManualEnabledThroughBridge(
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

async function getLifecycleThroughAggregate(
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

async function startQueueLinkedRunThroughBridge(
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

async function recordWorkerFinishedThroughBackend(
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

async function getWorkerEvidenceBundleThroughBackend(
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

function workerFinishedCommandSucceeded(
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

function workerFinishedOutputFromBackend(
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

function workerEvidenceBundleReadSucceeded(
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

function workerEvidenceBundleOutputFromBackend(
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

async function ackReviewThroughBackend(
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

async function markDoneThroughBackend(
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

async function failItemThroughBackend(
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

function completionCommandSucceeded(
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

function failureCommandSucceeded(
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

function completionCommandBlocked(
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

function failureCommandBlocked(
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

function completionCommandStatus(
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

function completionCommandReasonCode(
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

function failureCommandStatus(
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

function failureCommandReasonCode(result: AgentQueueFailureCommandResult) {
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

function completionTransitionOutputFromBackend({
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

function failureTransitionOutputFromBackend({
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

function completionBlockerMessage(result: AgentQueueCompletionCommandResult) {
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

function failureBlockerMessage(result: AgentQueueFailureCommandResult) {
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

function completionSafeNextCapability(
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

function failureSafeNextCapability(
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

async function previewReviewCommandFromAggregate(
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

function reviewCommandSucceeded(
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

function reviewCreateMessageSucceeded(
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

function reviewCreateMessageBlocked(
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

function reviewCommandFailed<TOutput>(
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

function invalidReviewCommandInput<TOutput>(
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

function reviewTransitionOutputFromAggregate({
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

function reviewCreateMessageBlockedOutput(
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

function reviewCreateMessageBlockerMessage(
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

function statePart(label: string, value: string | null | undefined) {
  return value ? `${label}=${value}` : null;
}

function nextActionFieldsForSuggestedCapability({
  executorWidgetId,
  evidenceBundleId,
  messageId,
  nextSuggestedCapability,
  reason,
  runId,
  taskId,
}: {
  executorWidgetId?: string | null;
  evidenceBundleId?: string | null;
  messageId?: string | null;
  nextSuggestedCapability?: string | null;
  reason: string;
  runId?: string | null;
  taskId?: string | null;
}): QueueAgentNextActionFields {
  if (!nextSuggestedCapability) {
    return {};
  }

  switch (nextSuggestedCapability) {
    case "queue.enable":
    case "queue.items.list":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: {},
        reason,
      });
    case "queue.item.promoteDraft":
    case "queue.item.updateRunSettings":
    case "queue.lifecycle.get":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ taskId }),
        reason,
      });
    case "queue.item.startRun":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ executorWidgetId, taskId }),
        reason,
      });
    case "queue.review.ack":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ messageId, taskId }),
        reason,
      });
    case "queue.review.createMessage":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ evidenceBundleId, runId, taskId }),
        reason,
      });
    case "queue.review.getEvidenceBundle":
      return queueNextActionFields({
        capabilityId: nextSuggestedCapability,
        input: compactNextActionInput({ runId, taskId }),
        reason,
      });
    default:
      return queueNextActionUnavailableFields({
        reasonCode: "next_action_unavailable",
        reasonMessage: `${nextSuggestedCapability} is not a supported Queue nextAction target.`,
      });
  }
}

function queueNextActionFields({
  autoContinuationSafe,
  capabilityId,
  input,
  reason,
}: {
  autoContinuationSafe?: boolean;
  capabilityId: string;
  input: Record<string, unknown>;
  reason: string;
}): QueueAgentNextActionFields {
  const result = buildQueueCapabilityNextAction({
    autoContinuationSafe,
    capabilityId,
    input,
    reason,
  });

  return result.ok
    ? { nextAction: result.nextAction }
    : queueNextActionUnavailableFields({
        invalidPayloadReason: result.reason,
        missingRequiredInputs: result.missingRequiredFields,
        reasonCode: result.missingRequiredFields.length > 0
          ? "missing_required_input"
          : "invalid_next_action_payload",
        reasonMessage: result.reason,
      });
}

function compactNextActionInput(
  input: Record<string, string | null | undefined>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => Boolean(cleanString(value))),
  );
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

function cleanString(value: string | null | undefined) {
  return value?.trim() || undefined;
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

function nextActionFieldsForSingleCreatedItem(
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

function nextActionFieldsForSingleTaskSummary(
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

async function createdQueueItemReadiness(
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

async function readCreatedQueueItemAggregate(
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

const AGGREGATE_SOURCE = "tauri_queue_item_aggregate" as const;
const QUEUE_DISABLED_MESSAGE = "Queue disabled.";
const QUEUE_DISABLED_BLOCKER = {
  code: "queue_disabled",
  message: QUEUE_DISABLED_MESSAGE,
} as const;

function queueTaskSummaryFromAggregate(
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

function queueTaskReadinessFromAggregate(
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

function nextActionFromAggregate(
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

function queueTaskSummaryFromSnapshot(
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

function queueTaskReadinessFromSnapshot(
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

function queueControlStateFromBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
): WorkspaceAgentQueueControlState | null {
  return bridge?.getQueueControlState?.() ?? null;
}

function aggregateQueueDisabledBlocksStart(
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

function withQueueDisabledBlocker(
  blockers: readonly AgentQueueItemAggregate["blockers"][number][],
) {
  if (blockers.some((blocker) => blocker.code === QUEUE_DISABLED_BLOCKER.code)) {
    return [...blockers];
  }

  return [...blockers, QUEUE_DISABLED_BLOCKER];
}

function isQueueDisabledStartBlocker(reasons: readonly string[]) {
  // TODO(queue-status-taxonomy): replace this compatibility text check with a
  // typed queue_disabled blocker code once the backend aggregate exposes it.
  return reasons.some((reason) =>
    reason.toLowerCase().includes("enable queue before starting") ||
    reason.toLowerCase().includes("queue disabled"),
  );
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

function nextCapabilityForLifecycleRead(summary: QueueAgentTaskSummary) {
  if (
    summary.nextSuggestedCapability === "queue.review.createMessage" &&
    summary.evidenceState === "available" &&
    summary.latestRunId
  ) {
    return "queue.review.getEvidenceBundle";
  }

  return summary.nextSuggestedCapability ?? null;
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

function validSnapshotOrResult(
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

function validItemOrResult(
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

function adapterFailure<TOutput>(
  result: QueueAgentAdapterResult<unknown>,
): QueueAgentAdapterResult<TOutput> {
  return {
    activityEventNames: result.activityEventNames,
    fieldPath: result.fieldPath,
    fieldPaths: result.fieldPaths,
    message: result.message,
    reasonCode: result.reasonCode,
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
    reasonCode: "capability_unavailable",
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

function queueControlSetManualEnabledResultStatus(
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

function queueControlSetManualEnabledBrokerStatus(
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

function queueControlSetManualEnabledReasonCode(status: string) {
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

function boundedText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
}

function normalizedString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  object: TObject,
  key: TKey,
): object is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}
