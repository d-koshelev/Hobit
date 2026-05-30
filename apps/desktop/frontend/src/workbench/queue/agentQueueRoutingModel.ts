import type { AgentQueueTask } from "../../workspace/types";
import {
  getQueueTaskDependencyState,
  normalizeQueueTag,
  normalizeTaskPriority,
  queueGlobalExecutionStateBlocksNewWork,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "../agentQueueTaskUiModel";
import {
  hasQueueTaskRunnablePrompt,
  isQueueTaskRunnableStatus,
} from "./queueExecutionPolicy";

export type AgentQueueRoutingBlockedReasonCode =
  | "assigned_worker_unavailable"
  | "assigned_to_another_worker"
  | "item_awaiting_coordinator_review"
  | "item_dependency_graph_invalid"
  | "item_missing_prompt"
  | "item_not_runnable_status"
  | "item_validation_in_progress"
  | "queue_stop_kill_requested"
  | "queue_stopped"
  | "queue_tag_paused"
  | "worker_disabled"
  | "worker_scope_mismatch"
  | "waiting_for_dependencies";

export type AgentQueueRoutingBlockedReason = {
  code: AgentQueueRoutingBlockedReasonCode;
  label: string;
};

export type AgentQueueRoutingContext = {
  dependencyStates?: ReadonlyMap<string, AgentQueueDependencyState>;
  globalExecutionState?: QueueGlobalStatus;
  pausedQueueTagIds?: ReadonlySet<string>;
  tasks: AgentQueueTask[];
};

export type AgentQueueWorkerRoutingSummary = {
  blockedReasonSummary: string | null;
  eligibleItemCount: number;
  nextItem: AgentQueueTask | null;
};

export type AgentQueueAssignedWorkerRoutingState = {
  assignedWorker: AgentWorkerSummary | null;
  blockedReasons: AgentQueueRoutingBlockedReason[];
  canTake: boolean;
};

export function canWorkerTakeQueueItem(
  worker: AgentWorkerSummary,
  item: AgentQueueTask,
  context: AgentQueueRoutingContext,
) {
  return getWorkerItemBlockedReasons(worker, item, context).length === 0;
}

export function getWorkerItemBlockedReasons(
  worker: AgentWorkerSummary,
  item: AgentQueueTask,
  context: AgentQueueRoutingContext,
): AgentQueueRoutingBlockedReason[] {
  const reasons: AgentQueueRoutingBlockedReason[] = [];
  const queueTag = normalizeQueueTag(item);
  const dependencyState =
    context.dependencyStates?.get(item.queueItemId) ??
    getQueueTaskDependencyState(item, context.tasks);
  const assignedWorkerId = item.assignedWorkerId ?? item.assignedExecutorWidgetId;

  if (queueGlobalExecutionStateBlocksNewWork(context.globalExecutionState ?? "started")) {
    reasons.push(
      reason(
        context.globalExecutionState === "stop_kill_requested"
          ? "queue_stop_kill_requested"
          : "queue_stopped",
      ),
    );
  }

  if (!worker.enabled) {
    reasons.push(reason("worker_disabled"));
  }

  if (!isQueueTaskRunnableStatus(item.status)) {
    reasons.push(reason("item_not_runnable_status"));
  }

  if (!hasQueueTaskRunnablePrompt(item)) {
    reasons.push(reason("item_missing_prompt"));
  }

  if (item.validationStatus === "validating") {
    reasons.push(reason("item_validation_in_progress"));
  }

  if (item.coordinatorStatus === "awaiting_coordinator_review") {
    reasons.push(reason("item_awaiting_coordinator_review"));
  }

  if (context.pausedQueueTagIds?.has(queueTag.queueTagId)) {
    reasons.push(reason("queue_tag_paused"));
  }

  if (dependencyState.status === "invalid") {
    reasons.push(reason("item_dependency_graph_invalid"));
  } else if (dependencyState.status === "blocked") {
    reasons.push(reason("waiting_for_dependencies"));
  }

  if (
    worker.scope.kind === "queue_tag" &&
    worker.scope.queueTagId !== queueTag.queueTagId
  ) {
    reasons.push(reason("worker_scope_mismatch"));
  }

  if (assignedWorkerId && assignedWorkerId !== worker.workerId) {
    reasons.push(reason("assigned_to_another_worker"));
  }

  return reasons;
}

export function getEligibleItemsForWorker(
  worker: AgentWorkerSummary,
  items: AgentQueueTask[],
  context: AgentQueueRoutingContext,
) {
  return items
    .filter((item) => canWorkerTakeQueueItem(worker, item, context))
    .sort(compareQueueRoutingItems);
}

export function getBestNextItemForWorker(
  worker: AgentWorkerSummary,
  items: AgentQueueTask[],
  context: AgentQueueRoutingContext,
) {
  return getEligibleItemsForWorker(worker, items, context)[0] ?? null;
}

export function getWorkerRoutingSummary(
  worker: AgentWorkerSummary,
  items: AgentQueueTask[],
  context: AgentQueueRoutingContext,
): AgentQueueWorkerRoutingSummary {
  const eligibleItems = getEligibleItemsForWorker(worker, items, context);

  return {
    blockedReasonSummary:
      eligibleItems.length === 0
        ? blockedReasonSummary(
            items.flatMap((item) =>
              getWorkerItemBlockedReasons(worker, item, context),
            ),
          )
        : null,
    eligibleItemCount: eligibleItems.length,
    nextItem: eligibleItems[0] ?? null,
  };
}

export function getAssignedWorkerRoutingState(
  item: AgentQueueTask,
  workers: AgentWorkerSummary[],
  context: AgentQueueRoutingContext,
): AgentQueueAssignedWorkerRoutingState {
  const assignedWorkerId = item.assignedWorkerId ?? item.assignedExecutorWidgetId;

  if (!assignedWorkerId) {
    return {
      assignedWorker: null,
      blockedReasons: [],
      canTake: false,
    };
  }

  const assignedWorker =
    workers.find((worker) => worker.workerId === assignedWorkerId) ?? null;

  if (!assignedWorker) {
    return {
      assignedWorker: null,
      blockedReasons: [reason("assigned_worker_unavailable")],
      canTake: false,
    };
  }

  const blockedReasons = getWorkerItemBlockedReasons(
    assignedWorker,
    item,
    context,
  );

  return {
    assignedWorker,
    blockedReasons,
    canTake: blockedReasons.length === 0,
  };
}

export function getAssignedWorkerRoutingStates(
  items: AgentQueueTask[],
  workers: AgentWorkerSummary[],
  context: AgentQueueRoutingContext,
) {
  return new Map(
    items.map((item) => [
      item.queueItemId,
      getAssignedWorkerRoutingState(item, workers, context),
    ]),
  );
}

export function compareQueueRoutingItems(
  first: AgentQueueTask,
  second: AgentQueueTask,
) {
  const firstOrderIndex =
    typeof first.orderIndex === "number" && Number.isFinite(first.orderIndex)
      ? first.orderIndex
      : Number.POSITIVE_INFINITY;
  const secondOrderIndex =
    typeof second.orderIndex === "number" && Number.isFinite(second.orderIndex)
      ? second.orderIndex
      : Number.POSITIVE_INFINITY;

  return (
    normalizeTaskPriority(second.priority) - normalizeTaskPriority(first.priority) ||
    firstOrderIndex - secondOrderIndex ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.queueItemId.localeCompare(second.queueItemId)
  );
}

export function routingBlockedReasonLabel(
  code: AgentQueueRoutingBlockedReasonCode,
) {
  return reason(code).label;
}

export function firstRoutingBlockedReasonLabel(
  reasons: readonly AgentQueueRoutingBlockedReason[],
) {
  return reasons[0]?.label ?? null;
}

function blockedReasonSummary(reasons: AgentQueueRoutingBlockedReason[]) {
  const uniqueCodes = Array.from(new Set(reasons.map((item) => item.code)));

  if (uniqueCodes.length === 0) {
    return "No queue items are available for this worker.";
  }

  return uniqueCodes
    .slice(0, 2)
    .map((code) => routingBlockedReasonLabel(code))
    .join("; ");
}

function reason(
  code: AgentQueueRoutingBlockedReasonCode,
): AgentQueueRoutingBlockedReason {
  switch (code) {
    case "assigned_worker_unavailable":
      return {
        code,
        label: "Assigned worker is unavailable",
      };
    case "assigned_to_another_worker":
      return {
        code,
        label: "Item is assigned to another worker",
      };
    case "item_awaiting_coordinator_review":
      return {
        code,
        label: "Item is awaiting coordinator review",
      };
    case "item_dependency_graph_invalid":
      return {
        code,
        label: "Item dependency graph is invalid",
      };
    case "item_missing_prompt":
      return {
        code,
        label: "Item prompt is empty",
      };
    case "item_not_runnable_status":
      return {
        code,
        label: "Item is not in a runnable execution state",
      };
    case "item_validation_in_progress":
      return {
        code,
        label: "Item validation is in progress",
      };
    case "queue_stopped":
      return {
        code,
        label: "Queue is stopped",
      };
    case "queue_stop_kill_requested":
      return {
        code,
        label: "Stop + kill running requested",
      };
    case "queue_tag_paused":
      return {
        code,
        label: "Queue tag is paused",
      };
    case "worker_disabled":
      return {
        code,
        label: "Worker is disabled",
      };
    case "worker_scope_mismatch":
      return {
        code,
        label: "Worker is scoped to another queue tag",
      };
    case "waiting_for_dependencies":
      return {
        code,
        label: "Item is waiting for dependencies",
      };
  }
}
