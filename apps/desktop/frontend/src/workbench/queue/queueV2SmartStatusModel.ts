import type { AgentQueueTask } from "../../workspace/types";
import type {
  SmartQueueDependencyGate,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types/smartQueue";
import {
  displayTaskTitle,
  normalizeCoordinatorStatus,
  normalizeValidationStatus,
} from "../agentQueueTaskUiModel";
import type { QueueBoardLane } from "./queueV2ViewModel";
import type { QueueBlockedReason } from "./queueV2BlockerSummary";
import {
  queueV2LifecycleForTask,
  type QueueTaskLifecycle,
} from "./queueV2LifecycleModel";

export type QueueTaskDependencyDetail = {
  taskId: string;
  title: string;
  status: "satisfied" | "waiting" | "failed" | "blocked" | "missing" | "invalid";
};

export type QueueTaskDependencySummary = {
  gate: SmartQueueDependencyGate;
  message: string;
  items: readonly QueueTaskDependencyDetail[];
};

export type QueueTaskHumanStatusView = {
  status: SmartQueueTaskHumanStatus;
  text: string;
};

export function queueV2HumanStatusForTask({
  boardLane,
  blockedReasons = [],
  dependencySummary,
  lifecycle,
  task,
}: {
  boardLane: QueueBoardLane;
  blockedReasons?: readonly QueueBlockedReason[];
  dependencySummary: QueueTaskDependencySummary;
  lifecycle: QueueTaskLifecycle;
  task: AgentQueueTask;
}): QueueTaskHumanStatusView {
  const validationStatus = normalizeValidationStatus(task.validationStatus);
  const coordinatorStatus = normalizeCoordinatorStatus(task.coordinatorStatus);

  if (boardLane === "waiting_dependency") {
    return {
      status: "waiting_dependency",
      text: `Waiting for: ${dependencyWaitingLabel(dependencySummary)}`,
    };
  }

  if (dependencySummary.gate === "failed") {
    return { status: "blocked", text: "Blocked: dependency failed" };
  }

  if (dependencySummary.gate === "blocked") {
    return { status: "blocked", text: "Blocked: dependency blocked" };
  }

  if (validationStatus === "failed") {
    return { status: "needs_decision", text: "Needs decision: validation failed" };
  }

  if (
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "awaiting_validation" ||
    coordinatorStatus === "ready_for_finalization" ||
    coordinatorStatus === "worker_reported"
  ) {
    return { status: "needs_decision", text: "Needs decision: coordinator review" };
  }

  if (boardLane === "blocked") {
    return { status: "blocked", text: blockedHumanStatusText(blockedReasons) };
  }

  switch (lifecycle) {
    case "draft":
    case "queued":
    case "ready":
      return { status: "ready", text: "Ready" };
    case "running":
      return { status: "running", text: "Running" };
    case "report_ready":
    case "review_required":
      return { status: "review", text: "Review" };
    case "finalized":
      return { status: "closed", text: "Closed" };
    case "failed":
      return { status: "failed", text: "Failed" };
    case "cancelled":
      return { status: "cancelled", text: "Closed" };
  }

  return { status: "blocked", text: "Blocked" };
}

function blockedHumanStatusText(blockedReasons: readonly QueueBlockedReason[]) {
  const reasonCodes = new Set(blockedReasons.map((reason) => reason.code));

  if (
    reasonCodes.has("missing_execution_workspace") ||
    reasonCodes.has("missing_codex_executable")
  ) {
    return "Blocked: missing config";
  }

  if (reasonCodes.has("run_settings_invalid")) {
    return "Blocked: missing prompt";
  }

  if (reasonCodes.has("queue_disabled")) {
    return "Blocked: Queue disabled";
  }

  if (
    reasonCodes.has("runtime_unavailable") ||
    reasonCodes.has("capacity_unavailable") ||
    reasonCodes.has("worker_paused") ||
    reasonCodes.has("tag_paused")
  ) {
    return "Blocked: worker unavailable";
  }

  if (reasonCodes.has("context_missing") || reasonCodes.has("context_invalid")) {
    return "Blocked: context issue";
  }

  if (reasonCodes.has("safety_blocker")) {
    return "Blocked: safety review";
  }

  return "Blocked";
}

export function queueV2DependencySummaryForTask(
  task: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
): QueueTaskDependencySummary {
  const dependencyIds = [...(task.dependsOn ?? [])]
    .map((dependencyId) => dependencyId.trim())
    .filter(Boolean);

  if (dependencyIds.length === 0) {
    return { gate: "none", items: [], message: "No dependencies" };
  }

  const tasksById = new Map(tasks.map((candidate) => [candidate.queueItemId, candidate]));
  const items = dependencyIds.map((dependencyId): QueueTaskDependencyDetail => {
    const upstream = tasksById.get(dependencyId);

    if (!upstream) {
      return { status: "missing", taskId: dependencyId, title: dependencyId };
    }

    const upstreamLifecycle = queueV2LifecycleForTask(upstream);
    const upstreamCoordinatorStatus = normalizeCoordinatorStatus(
      upstream.coordinatorStatus,
    );

    if (upstreamLifecycle === "finalized") {
      return {
        status: "satisfied",
        taskId: dependencyId,
        title: displayTaskTitle(upstream),
      };
    }

    if (upstreamLifecycle === "failed" || upstreamCoordinatorStatus === "failed") {
      return {
        status: "failed",
        taskId: dependencyId,
        title: displayTaskTitle(upstream),
      };
    }

    if (
      upstreamLifecycle === "blocked" ||
      upstreamCoordinatorStatus === "blocked" ||
      upstreamCoordinatorStatus === "rollback_required"
    ) {
      return {
        status: "blocked",
        taskId: dependencyId,
        title: displayTaskTitle(upstream),
      };
    }

    return {
      status: "waiting",
      taskId: dependencyId,
      title: displayTaskTitle(upstream),
    };
  });

  const gate = dependencyGateForItems(items);

  return {
    gate,
    items,
    message: dependencyMessage(gate, items),
  };
}

function dependencyGateForItems(
  items: readonly QueueTaskDependencyDetail[],
): SmartQueueDependencyGate {
  if (items.length === 0) {
    return "none";
  }

  if (items.some((item) => item.status === "failed")) {
    return "failed";
  }

  if (
    items.some(
      (item) =>
        item.status === "blocked" ||
        item.status === "missing" ||
        item.status === "invalid",
    )
  ) {
    return "blocked";
  }

  if (items.some((item) => item.status === "waiting")) {
    return "waiting";
  }

  return "satisfied";
}

function dependencyMessage(
  gate: SmartQueueDependencyGate,
  items: readonly QueueTaskDependencyDetail[],
) {
  switch (gate) {
    case "none":
      return "No dependencies";
    case "satisfied":
      return "Dependencies satisfied";
    case "waiting":
      return `Waiting for: ${dependencyWaitingLabel({ items })}`;
    case "failed":
      return "Blocked by failed dependency";
    case "blocked":
      return "Blocked by dependency";
  }
}

function dependencyWaitingLabel(summary: Pick<QueueTaskDependencySummary, "items">) {
  const waitingItems = summary.items.filter(
    (item) => item.status === "waiting" || item.status === "missing",
  );
  const sources = waitingItems.length > 0 ? waitingItems : summary.items;

  return sources.map((item) => formatQueueTaskId(item.taskId)).join(", ");
}

export function queueV2BlockedByDependencyLabel(
  summary: QueueTaskDependencySummary,
) {
  const blockedItems = summary.items.filter(
    (item) =>
      item.status === "failed" ||
      item.status === "blocked" ||
      item.status === "missing" ||
      item.status === "invalid",
  );

  if (blockedItems.length === 0) {
    return null;
  }

  return `Blocked by: ${blockedItems
    .map((item) => formatQueueTaskId(item.taskId))
    .join(", ")}`;
}

function formatQueueTaskId(taskId: string) {
  const trimmed = taskId.trim();
  const numericSuffix = trimmed.match(/(?:task|queue)?[-_]?(\d+)$/i)?.[1];

  if (numericSuffix) {
    return `Task ${numericSuffix}`;
  }

  return trimmed || "dependency";
}
