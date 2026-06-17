import type { WorkspaceAgentQueueBridge } from "../../workspaceAgentQueueBridge";
import type { AgentQueueItemAggregate } from "../../../workspace/types";
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
  type QueueAgentLifecycleGetInput,
  type QueueAgentLifecycleGetOutput,
  type QueueAgentListItemsInput,
  type QueueAgentListItemsResult,
  type QueueAgentPromoteDraftResult,
  type QueueAgentPromptPackInput,
  type QueueAgentRunApprovalPolicy,
  type QueueAgentRunSandbox,
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

export function createWorkspaceAgentQueueBridgeAdapterApi(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
): QueueAgentAdapterApi {
  const defaultAdapter = createDefaultQueueAgentAdapterApi();
  const transitionalDogfoodLifecycle = bridge
    ? createInMemoryQueueDogfoodLifecycleAdapterApi({
        getTaskSeed: (taskId) => getLifecycleTaskSeed(bridge, taskId),
      })
    : undefined;

  return {
    ...defaultAdapter,
    createItems: (request) => createQueueItemsThroughBridge(bridge, request),
    enableQueue: (input, context) =>
      enableQueueThroughBridge(bridge, input, context),
    dogfoodLifecycle: transitionalDogfoodLifecycle
      ? {
          ...transitionalDogfoodLifecycle,
          getLifecycle: (input, context) =>
            getLifecycleThroughAggregate(bridge, input, context),
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
    listItems: (input) => listQueueItemsThroughBridge(bridge, input),
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

async function getLifecycleThroughAggregate(
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

  if (!bridge?.getItemAggregate) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.lifecycleGet,
      "Queue aggregate lifecycle read API is unavailable.",
    );
  }

  let aggregate: AgentQueueItemAggregate | null;
  try {
    aggregate = await bridge.getItemAggregate({ taskId });
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

async function listQueueItemsThroughBridge(
  bridge: WorkspaceAgentQueueBridge | null | undefined,
  input: QueueAgentListItemsInput,
): Promise<QueueAgentAdapterResult<QueueAgentListItemsResult>> {
  if (!bridge) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.itemsList,
      "Queue task listing is unavailable.",
    );
  }

  if (!bridge.listItemAggregates) {
    return bridgeUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.itemsList,
      "Queue aggregate list read API is unavailable.",
    );
  }

  const limit = boundedItemLimit(input.limit);
  let aggregates: AgentQueueItemAggregate[];
  try {
    aggregates = await bridge.listItemAggregates();
  } catch (error) {
    return aggregateReadUnavailableResult(
      QUEUE_ACTIVITY_EVENTS.itemsList,
      error,
      "Queue aggregate list read API is unavailable.",
    );
  }

  const availableExecutors = executorTargets(bridge);
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
  const blockerReasons = aggregate.blockers.map((blocker) => blocker.message);
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
