import type { AgentQueueTask } from "../../workspace/types";
import type {
  SmartQueueDependencyGate,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types/smartQueue";
import {
  computeHumanQueueStatus,
  type SmartQueueDependency,
  type SmartQueueBlocker,
  type SmartQueueDependencyGate as SmartQueueComputedDependencyGate,
  type SmartQueueTaskLifecycle,
  type SmartQueueTaskInput,
} from "./smartQueueEligibility";
import {
  computeSmartQueueDependencyGate,
} from "./smartQueueDependencyPropagation";
import {
  presentSmartQueueStatus,
  type SmartQueueDependencyLabel,
} from "./smartQueueStatusPresentation";
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
  detail: string | null;
  label: string;
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
  const smartGate = smartDependencyGateFromSummary(dependencySummary);
  const smartBlockers = smartQueueBlockersFromQueueV2Reasons(task, blockedReasons);
  const smartTask = {
    blockers: smartBlockers,
    lifecycle: smartLifecycleForQueueV2(lifecycle),
    taskId: task.queueItemId,
    title: displayTaskTitle(task),
  };
  const dependencyLabels = dependencySummary.items.map(
    (item): SmartQueueDependencyLabel => ({
      label: item.title.trim() || formatQueueTaskId(item.taskId),
      taskId: item.taskId,
    }),
  );

  if (
    boardLane === "waiting_dependency" ||
    dependencySummary.gate === "failed" ||
    dependencySummary.gate === "blocked" ||
    validationStatus === "failed" ||
    smartBlockers.some((blocker) => blocker.kind === "missing_config")
  ) {
    return presentSmartQueueStatus({
      dependencyGate: smartGate,
      dependencyLabels,
      humanStatus: computeHumanQueueStatus(smartTask, smartGate),
    });
  }

  if (
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "awaiting_validation" ||
    coordinatorStatus === "ready_for_finalization" ||
    coordinatorStatus === "worker_reported"
  ) {
    return presentSmartQueueStatus({
      humanStatus: {
        label: "Needs decision: coordinator review",
        status: "needs_decision",
        text: "Needs decision: coordinator review",
      },
    });
  }

  if (boardLane === "blocked") {
    return presentation("blocked", blockedHumanStatusText(blockedReasons));
  }

  switch (lifecycle) {
    case "draft":
    case "queued":
    case "ready":
      return presentation("ready", "Ready");
    case "running":
      return presentation("running", "Running");
    case "report_ready":
    case "review_required":
      return presentation("review", "Review");
    case "finalized":
      return presentation("closed", "Closed");
    case "failed":
      return presentation("failed", "Failed");
    case "cancelled":
      return presentation("cancelled", "Closed");
  }

  return presentation("blocked", "Blocked");
}

function presentation(
  status: SmartQueueTaskHumanStatus,
  label: string,
  detail: string | null = null,
): QueueTaskHumanStatusView {
  return {
    detail,
    label,
    status,
    text: label,
  };
}

function smartLifecycleForQueueV2(
  lifecycle: QueueTaskLifecycle,
): SmartQueueTaskLifecycle {
  switch (lifecycle) {
    case "draft":
      return "draft";
    case "queued":
      return "queued";
    case "ready":
      return "ready";
    case "running":
      return "running";
    case "report_ready":
    case "review_required":
      return "review";
    case "finalized":
      return "closed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }

  return "blocked";
}

function smartQueueBlockersFromQueueV2Reasons(
  task: AgentQueueTask,
  blockedReasons: readonly QueueBlockedReason[],
): SmartQueueBlocker[] {
  const blockers: SmartQueueBlocker[] = [];
  const reasonCodes = new Set(blockedReasons.map((reason) => reason.code));

  if (reasonCodes.has("validation_failed")) {
    blockers.push({
      kind: "validation_requires_decision",
      reason: "validation failed",
      taskId: task.queueItemId,
    });
  }

  if (
    reasonCodes.has("missing_execution_workspace") ||
    reasonCodes.has("missing_codex_executable")
  ) {
    blockers.push({
      kind: "missing_config",
      reason: "missing config",
      taskId: task.queueItemId,
    });
  }

  return blockers;
}

function smartDependencyGateFromSummary(
  summary: QueueTaskDependencySummary,
): SmartQueueComputedDependencyGate {
  return {
    blockedTaskIds: summary.items
      .filter(
        (item) =>
          item.status === "blocked" ||
          item.status === "invalid" ||
          item.status === "missing",
      )
      .map((item) => item.taskId),
    failedTaskIds: summary.items
      .filter((item) => item.status === "failed")
      .map((item) => item.taskId),
    gate: summary.gate,
    missingTaskIds: summary.items
      .filter((item) => item.status === "missing")
      .map((item) => item.taskId),
    rootBlockedTaskIds: summary.items
      .filter(
        (item) =>
          item.status === "blocked" ||
          item.status === "invalid" ||
          item.status === "missing",
      )
      .map((item) => item.taskId),
    rootFailedTaskIds: summary.items
      .filter((item) => item.status === "failed")
      .map((item) => item.taskId),
    satisfiedTaskIds: summary.items
      .filter((item) => item.status === "satisfied")
      .map((item) => item.taskId),
    upstreamTaskIds: summary.items.map((item) => item.taskId),
    waitingTaskIds: summary.items
      .filter((item) => item.status === "waiting" || item.status === "missing")
      .map((item) => item.taskId),
  };
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
  const smartTasks = tasks.map(smartTaskInputForQueueTask);
  const smartTask =
    smartTasks.find((candidate) => candidate.taskId === task.queueItemId) ??
    smartTaskInputForQueueTask(task);
  const smartGate = computeSmartQueueDependencyGate(
    smartTask,
    smartTasks,
    smartQueueDependenciesForTasks(tasks),
  );
  const items = dependencyIds.map((dependencyId): QueueTaskDependencyDetail => {
    const upstream = tasksById.get(dependencyId);

    if (!upstream) {
      return { status: "missing", taskId: dependencyId, title: dependencyId };
    }

    if (smartGate.satisfiedTaskIds.includes(dependencyId)) {
      return {
        status: "satisfied",
        taskId: dependencyId,
        title: displayTaskTitle(upstream),
      };
    }

    if (smartGate.failedTaskIds.includes(dependencyId)) {
      return {
        status: "failed",
        taskId: dependencyId,
        title: displayTaskTitle(upstream),
      };
    }

    if (smartGate.blockedTaskIds.includes(dependencyId)) {
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
    gate: smartGate.gate,
    items,
    message: dependencyMessage(smartGate.gate, items),
  };
}

function smartTaskInputForQueueTask(task: AgentQueueTask): SmartQueueTaskInput {
  return {
    blockers: smartQueueBlockersForQueueTask(task),
    lifecycle: smartLifecycleForAgentQueueTask(task),
    taskId: task.queueItemId,
    title: displayTaskTitle(task),
  };
}

function smartLifecycleForAgentQueueTask(
  task: AgentQueueTask,
): SmartQueueTaskLifecycle {
  const lifecycle = queueV2LifecycleForTask(task);

  switch (lifecycle) {
    case "draft":
      return "draft";
    case "queued":
      return "queued";
    case "ready":
      return "ready";
    case "running":
      return "running";
    case "report_ready":
    case "review_required":
      return "review";
    case "finalized":
      return "closed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }

  return "blocked";
}

function smartQueueBlockersForQueueTask(task: AgentQueueTask): SmartQueueBlocker[] {
  const blockers: SmartQueueBlocker[] = [];
  const validationStatus = normalizeValidationStatus(task.validationStatus);
  const coordinatorStatus = normalizeCoordinatorStatus(task.coordinatorStatus);

  if (validationStatus === "failed") {
    blockers.push({
      kind: "validation_requires_decision",
      reason: "validation failed",
      taskId: task.queueItemId,
    });
  }

  if (
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "awaiting_validation" ||
    coordinatorStatus === "ready_for_finalization" ||
    coordinatorStatus === "worker_reported"
  ) {
    blockers.push({
      kind: "requires_human_input",
      reason: "coordinator review",
      taskId: task.queueItemId,
    });
  }

  return blockers;
}

function smartQueueDependenciesForTasks(
  tasks: readonly AgentQueueTask[],
): SmartQueueDependency[] {
  return tasks.flatMap((candidate) =>
    (candidate.dependsOn ?? [])
      .map((dependencyId) => dependencyId.trim())
      .filter(Boolean)
      .map((upstreamTaskId) => ({
        downstreamTaskId: candidate.queueItemId,
        kind: "blocks_start" as const,
        upstreamTaskId,
      })),
  );
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

  return sources
    .map((item) => item.title.trim() || formatQueueTaskId(item.taskId))
    .join(", ");
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
