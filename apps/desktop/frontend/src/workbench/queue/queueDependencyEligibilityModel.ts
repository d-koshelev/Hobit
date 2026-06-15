import type { AgentQueueTask } from "../../workspace/types";
import type {
  SmartQueueBlockerKind,
  SmartQueueDependencyGate,
  SmartQueueState,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types/smartQueue";
import {
  computeSmartQueueDependencyGate,
  dependencyBlockersForGate,
} from "./smartQueueDependencyPropagation";
import type {
  SmartQueueBlocker,
  SmartQueueDependency,
  SmartQueueTaskInput,
  SmartQueueTaskLifecycle,
} from "./smartQueueEligibility";

export type QueueTaskLifecycleStatus =
  | "draft"
  | "queued"
  | "ready"
  | "running"
  | "review_needed"
  | "closed"
  | "failed"
  | "cancelled"
  | "blocked";

export type QueueTaskDependency = {
  readonly dependencyId: string;
  readonly upstreamTaskId: string;
  readonly downstreamTaskId: string;
  readonly kind: "blocks_start";
  readonly createdBy?: "queue_importer" | "queue_coordinator" | "human_operator";
  readonly createdAt?: string;
};

export type QueueTaskBlocker = {
  readonly kind: SmartQueueBlockerKind;
  readonly message: string;
  readonly taskId: string;
  readonly upstreamTaskId?: string;
};

export type QueueDependencyGate = {
  readonly gate: SmartQueueDependencyGate;
  readonly waitingOnTaskIds: string[];
  readonly failedTaskIds: string[];
  readonly blockedTaskIds: string[];
  readonly missingTaskIds: string[];
  readonly satisfiedTaskIds: string[];
};

export type QueueTaskGraphState = {
  readonly dependencyGate: QueueDependencyGate;
};

export type QueueTaskEligibility = {
  readonly canAutoStart: boolean;
  readonly blockers: QueueTaskBlocker[];
  readonly dependencyGate: SmartQueueDependencyGate;
  readonly humanStatus: SmartQueueTaskHumanStatus;
  readonly reason: string;
};

export type QueueWorkerCapacity = {
  readonly availableSlots: number;
};

export type QueueModelState = {
  readonly state: SmartQueueState;
};

export type QueueFailurePropagation = {
  readonly blockers: QueueTaskBlocker[];
  readonly downstreamTaskId: string;
  readonly gate: SmartQueueDependencyGate;
  readonly summary: string;
};

const DECISION_BLOCKER_KINDS = new Set<SmartQueueBlockerKind>([
  "validation_requires_decision",
  "requires_human_input",
]);

export function computeDependencyGate(
  task: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
  dependencies: readonly QueueTaskDependency[] = [],
): QueueDependencyGate {
  const smartTasks = tasks.map(smartTaskInputForQueueTask);
  const smartTask =
    smartTasks.find((candidate) => candidate.taskId === task.queueItemId) ??
    smartTaskInputForQueueTask(task);
  const smartGate = computeSmartQueueDependencyGate(
    smartTask,
    smartTasks,
    smartDependenciesForQueueTasks(tasks, dependencies),
  );

  return {
    blockedTaskIds: [...smartGate.blockedTaskIds],
    failedTaskIds: [...smartGate.failedTaskIds],
    gate: smartGate.gate,
    missingTaskIds: [...smartGate.missingTaskIds],
    satisfiedTaskIds: [...smartGate.satisfiedTaskIds],
    waitingOnTaskIds: [...smartGate.waitingTaskIds],
  };
}

export function computeTaskBlockers(
  task: AgentQueueTask,
  graphState: QueueTaskGraphState,
): QueueTaskBlocker[] {
  const blockers: QueueTaskBlocker[] = dependencyBlockersForGate(
    task.queueItemId,
    {
      blockedTaskIds: graphState.dependencyGate.blockedTaskIds,
      failedTaskIds: graphState.dependencyGate.failedTaskIds,
      gate: graphState.dependencyGate.gate,
      missingTaskIds: graphState.dependencyGate.missingTaskIds,
      rootBlockedTaskIds: graphState.dependencyGate.blockedTaskIds,
      rootFailedTaskIds: graphState.dependencyGate.failedTaskIds,
      satisfiedTaskIds: graphState.dependencyGate.satisfiedTaskIds,
      upstreamTaskIds: [
        ...graphState.dependencyGate.waitingOnTaskIds,
        ...graphState.dependencyGate.failedTaskIds,
        ...graphState.dependencyGate.blockedTaskIds,
        ...graphState.dependencyGate.missingTaskIds,
        ...graphState.dependencyGate.satisfiedTaskIds,
      ],
      waitingTaskIds: graphState.dependencyGate.waitingOnTaskIds,
    },
  ).map((blocker) => ({
    kind: blocker.kind,
    message:
      blocker.kind === "dependency_failed"
        ? `Dependency ${blocker.upstreamTaskId ?? "dependency"} failed.`
        : `Dependency ${blocker.upstreamTaskId ?? "dependency"} is blocked.`,
    taskId: task.queueItemId,
    upstreamTaskId: blocker.upstreamTaskId,
  }));

  if (!task.prompt.trim()) {
    blockers.push({
      kind: "missing_prompt",
      message: "Task is missing a prompt.",
      taskId: task.queueItemId,
    });
  }

  if (!hasRequiredRunConfig(task)) {
    blockers.push({
      kind: "missing_config",
      message: "Task is missing required run configuration.",
      taskId: task.queueItemId,
    });
  }

  if (task.validationStatus === "needs_review") {
    blockers.push({
      kind: "validation_requires_decision",
      message: "Validation requires a coordinator decision.",
      taskId: task.queueItemId,
    });
  }

  if (task.coordinatorStatus === "awaiting_coordinator_review") {
    blockers.push({
      kind: "requires_human_input",
      message: "Task requires a coordinator decision.",
      taskId: task.queueItemId,
    });
  }

  return blockers;
}

export function computeHumanQueueStatus(
  task: AgentQueueTask,
  queueState: QueueModelState,
  graphState: QueueTaskGraphState,
): { readonly status: SmartQueueTaskHumanStatus; readonly text: string } {
  const dependencyBlockers = computeTaskBlockers(task, graphState).filter(
    (blocker) =>
      blocker.kind === "dependency_failed" ||
      blocker.kind === "dependency_blocked",
  );
  const blockers = computeTaskBlockers(task, graphState);

  if (task.status === "running") {
    return { status: "running", text: "Running" };
  }

  if (isTaskClosedSuccessfully(task)) {
    return { status: "closed", text: "Closed" };
  }

  if (isTaskFailed(task)) {
    return { status: "failed", text: "Failed" };
  }

  if (task.status === "cancelled") {
    return { status: "cancelled", text: "Closed" };
  }

  if (dependencyBlockers.some((blocker) => blocker.kind === "dependency_failed")) {
    return {
      status: "blocked",
      text: `Blocked: ${formatDependencySummary(
        graphState.dependencyGate.failedTaskIds,
        "dependency failed",
      )}`,
    };
  }

  if (dependencyBlockers.some((blocker) => blocker.kind === "dependency_blocked")) {
    return {
      status: "blocked",
      text: `Blocked: ${formatDependencySummary(
        graphState.dependencyGate.blockedTaskIds,
        "dependency blocked",
      )}`,
    };
  }

  if (graphState.dependencyGate.gate === "waiting") {
    return {
      status: "waiting_dependency",
      text: `Waiting for ${formatWaitingTaskList([
        ...graphState.dependencyGate.waitingOnTaskIds,
        ...graphState.dependencyGate.missingTaskIds,
      ])}`,
    };
  }

  if (task.status === "review_needed") {
    return { status: "needs_decision", text: "Needs decision" };
  }

  if (task.coordinatorStatus === "awaiting_coordinator_review") {
    return { status: "needs_decision", text: "Needs decision" };
  }

  if (blockers.some((blocker) => DECISION_BLOCKER_KINDS.has(blocker.kind))) {
    return { status: "needs_decision", text: "Needs decision" };
  }

  if (blockers.length > 0 || isTaskBlocked(task)) {
    return {
      status: "blocked",
      text: `Blocked: ${blockers[0]?.message ?? "needs decision"}`,
    };
  }

  return {
    status: "ready",
    text: queueState.state === "paused" ? "Ready (Queue paused)" : "Ready",
  };
}

export const computeHumanQueueTaskStatus = computeHumanQueueStatus;

export function computeTaskEligibility(
  task: AgentQueueTask,
  queueState: QueueModelState,
  graphState: QueueTaskGraphState,
  workerCapacity: QueueWorkerCapacity,
): QueueTaskEligibility {
  const humanStatus = computeHumanQueueStatus(task, queueState, graphState);
  const blockers = computeTaskBlockers(task, graphState);
  const hasCapacity = workerCapacity.availableSlots > 0;

  if (queueState.state !== "active") {
    return {
      blockers,
      canAutoStart: false,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: queueState.state === "paused" ? "Queue Paused" : "Queue is not active",
    };
  }

  if (humanStatus.status !== "ready") {
    return {
      blockers,
      canAutoStart: false,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: humanStatus.text,
    };
  }

  if (
    graphState.dependencyGate.gate !== "none" &&
    graphState.dependencyGate.gate !== "satisfied"
  ) {
    return {
      blockers,
      canAutoStart: false,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: humanStatus.text,
    };
  }

  if (blockers.length > 0) {
    return {
      blockers,
      canAutoStart: false,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: blockers[0]?.message ?? "Task has blockers",
    };
  }

  if (!hasCapacity) {
    return {
      blockers: [
        ...blockers,
        {
          kind: "worker_unavailable",
          message: "No worker capacity is available.",
          taskId: task.queueItemId,
        },
      ],
      canAutoStart: false,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: "No worker capacity is available.",
    };
  }

  return {
    blockers,
    canAutoStart: true,
    dependencyGate: graphState.dependencyGate.gate,
    humanStatus: humanStatus.status,
    reason: "Eligible",
  };
}

export function computeFailurePropagation(
  downstreamTask: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
  dependencies: readonly QueueTaskDependency[] = [],
): QueueFailurePropagation {
  const dependencyGate = computeDependencyGate(
    downstreamTask,
    tasks,
    dependencies,
  );
  const blockers = computeTaskBlockers(downstreamTask, { dependencyGate }).filter(
    (blocker) =>
      blocker.kind === "dependency_failed" ||
      blocker.kind === "dependency_blocked",
  );

  return {
    blockers,
    downstreamTaskId: downstreamTask.queueItemId,
    gate: dependencyGate.gate,
    summary:
      blockers.length === 0
        ? "No dependency failure propagation."
        : blockers.map((blocker) => blocker.message).join(" "),
  };
}

function isTaskClosedSuccessfully(task: AgentQueueTask) {
  return (
    task.coordinatorStatus === "finalized" ||
    task.closureState === "no_change_accepted" ||
    task.closureState === "commit_created"
  );
}

function isTaskFailed(task: AgentQueueTask) {
  return task.status === "failed" || task.coordinatorStatus === "failed";
}

function isTaskBlocked(task: AgentQueueTask) {
  return (
    task.coordinatorStatus === "blocked" ||
    task.coordinatorStatus === "rollback_required" ||
    task.closureState === "closure_blocked"
  );
}

function hasRequiredRunConfig(task: AgentQueueTask) {
  return Boolean(task.executionWorkspace?.trim() && task.codexExecutable?.trim());
}

function smartTaskInputForQueueTask(task: AgentQueueTask): SmartQueueTaskInput {
  return {
    blockers: smartBlockersForQueueTask(task),
    lifecycle: smartLifecycleForQueueTask(task),
    taskId: task.queueItemId,
    title: task.title,
  };
}

function smartLifecycleForQueueTask(task: AgentQueueTask): SmartQueueTaskLifecycle {
  if (isTaskClosedSuccessfully(task)) {
    return "closed";
  }

  if (isTaskFailed(task)) {
    return "failed";
  }

  if (isTaskBlocked(task)) {
    return "blocked";
  }

  switch (task.status) {
    case "draft":
    case "queued":
    case "ready":
    case "running":
    case "failed":
    case "cancelled":
      return task.status;
    case "completed":
    case "review_needed":
      return "review";
    default:
      return "ready";
  }
}

function smartBlockersForQueueTask(task: AgentQueueTask) {
  const blockers: SmartQueueBlocker[] = [];

  if (!task.prompt.trim()) {
    blockers.push({
      kind: "missing_prompt",
      reason: "missing prompt",
      taskId: task.queueItemId,
    });
  }

  if (!hasRequiredRunConfig(task)) {
    blockers.push({
      kind: "missing_config",
      reason: "missing config",
      taskId: task.queueItemId,
    });
  }

  if (task.validationStatus === "needs_review") {
    blockers.push({
      kind: "validation_requires_decision",
      reason: "validation requires decision",
      taskId: task.queueItemId,
    });
  }

  if (task.coordinatorStatus === "awaiting_coordinator_review") {
    blockers.push({
      kind: "requires_human_input",
      reason: "coordinator decision required",
      taskId: task.queueItemId,
    });
  }

  return blockers;
}

function smartDependenciesForQueueTasks(
  tasks: readonly AgentQueueTask[],
  dependencies: readonly QueueTaskDependency[],
): SmartQueueDependency[] {
  const byKey = new Map<string, SmartQueueDependency>();

  for (const task of tasks) {
    for (const upstreamTaskId of task.dependsOn ?? []) {
      const trimmed = upstreamTaskId.trim();

      if (trimmed) {
        byKey.set(`${trimmed}->${task.queueItemId}`, {
          downstreamTaskId: task.queueItemId,
          kind: "blocks_start",
          upstreamTaskId: trimmed,
        });
      }
    }
  }

  for (const dependency of dependencies) {
    byKey.set(`${dependency.upstreamTaskId}->${dependency.downstreamTaskId}`, {
      downstreamTaskId: dependency.downstreamTaskId,
      kind: "blocks_start",
      upstreamTaskId: dependency.upstreamTaskId,
    });
  }

  return [...byKey.values()];
}

function formatWaitingTaskList(taskIds: readonly string[]) {
  if (taskIds.length === 0) {
    return "dependencies";
  }

  if (taskIds.length === 1) {
    return formatTaskId(taskIds[0] ?? "");
  }

  return taskIds.map(formatTaskId).join(", ");
}

function formatDependencySummary(taskIds: readonly string[], fallback: string) {
  if (taskIds.length <= 1) {
    return fallback;
  }

  return `${fallback} (${formatWaitingTaskList(taskIds)})`;
}

function formatTaskId(taskId: string) {
  const compact = taskId.match(/^task[-_]?([0-9]+)$/i);
  if (compact) {
    return `Task ${compact[1]}`;
  }

  return taskId;
}
