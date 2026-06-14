import type { AgentQueueTask } from "../../../../workspace/types";
import type {
  SmartQueueBlockerKind,
  SmartQueueDependencyGate,
  SmartQueueState,
  SmartQueueTaskHumanStatus,
} from "../../../../workspace/types/smartQueue";

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

export function computeDependencyGate(
  task: AgentQueueTask,
  tasks: readonly AgentQueueTask[],
  dependencies: readonly QueueTaskDependency[] = [],
): QueueDependencyGate {
  const upstreamTaskIds = dependencyIdsForTask(task, dependencies);

  if (upstreamTaskIds.length === 0) {
    return emptyGate("none");
  }

  const tasksById = new Map(tasks.map((candidate) => [candidate.queueItemId, candidate]));
  const waitingOnTaskIds: string[] = [];
  const failedTaskIds: string[] = [];
  const blockedTaskIds: string[] = [];
  const missingTaskIds: string[] = [];
  const satisfiedTaskIds: string[] = [];

  for (const upstreamTaskId of upstreamTaskIds) {
    const upstreamTask = tasksById.get(upstreamTaskId);

    if (!upstreamTask) {
      missingTaskIds.push(upstreamTaskId);
      continue;
    }

    if (isTaskClosedSuccessfully(upstreamTask)) {
      satisfiedTaskIds.push(upstreamTaskId);
      continue;
    }

    if (isTaskFailed(upstreamTask)) {
      failedTaskIds.push(upstreamTaskId);
      continue;
    }

    if (isTaskBlocked(upstreamTask)) {
      blockedTaskIds.push(upstreamTaskId);
      continue;
    }

    waitingOnTaskIds.push(upstreamTaskId);
  }

  if (failedTaskIds.length > 0) {
    return {
      gate: "failed",
      waitingOnTaskIds,
      failedTaskIds,
      blockedTaskIds,
      missingTaskIds,
      satisfiedTaskIds,
    };
  }

  if (blockedTaskIds.length > 0) {
    return {
      gate: "blocked",
      waitingOnTaskIds,
      failedTaskIds,
      blockedTaskIds,
      missingTaskIds,
      satisfiedTaskIds,
    };
  }

  if (waitingOnTaskIds.length > 0 || missingTaskIds.length > 0) {
    return {
      gate: "waiting",
      waitingOnTaskIds,
      failedTaskIds,
      blockedTaskIds,
      missingTaskIds,
      satisfiedTaskIds,
    };
  }

  return {
    gate: "satisfied",
    waitingOnTaskIds,
    failedTaskIds,
    blockedTaskIds,
    missingTaskIds,
    satisfiedTaskIds,
  };
}

export function computeTaskBlockers(
  task: AgentQueueTask,
  graphState: QueueTaskGraphState,
): QueueTaskBlocker[] {
  const blockers: QueueTaskBlocker[] = [];

  for (const upstreamTaskId of graphState.dependencyGate.failedTaskIds) {
    blockers.push({
      kind: "dependency_failed",
      message: `Dependency ${upstreamTaskId} failed.`,
      taskId: task.queueItemId,
      upstreamTaskId,
    });
  }

  for (const upstreamTaskId of graphState.dependencyGate.blockedTaskIds) {
    blockers.push({
      kind: "dependency_blocked",
      message: `Dependency ${upstreamTaskId} is blocked.`,
      taskId: task.queueItemId,
      upstreamTaskId,
    });
  }

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

  return blockers;
}

export function computeHumanQueueTaskStatus(
  task: AgentQueueTask,
  queueState: QueueModelState,
  graphState: QueueTaskGraphState,
): { readonly status: SmartQueueTaskHumanStatus; readonly text: string } {
  const blockers = computeTaskBlockers(task, graphState);

  if (task.status === "running") {
    return { status: "running", text: "Running" };
  }

  if (task.status === "review_needed") {
    return { status: "review", text: "Review" };
  }

  if (isTaskClosedSuccessfully(task)) {
    return { status: "closed", text: "Closed" };
  }

  if (isTaskFailed(task)) {
    return { status: "failed", text: "Failed" };
  }

  if (task.status === "cancelled") {
    return { status: "cancelled", text: "Cancelled" };
  }

  if (blockers.some((blocker) => blocker.kind === "dependency_failed")) {
    return { status: "blocked", text: "Blocked: dependency failed" };
  }

  if (blockers.some((blocker) => blocker.kind === "dependency_blocked")) {
    return { status: "blocked", text: "Blocked: dependency blocked" };
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

  if (blockers.length > 0 || isTaskBlocked(task)) {
    return { status: "blocked", text: `Blocked: ${blockers[0]?.message ?? "needs decision"}` };
  }

  if (task.coordinatorStatus === "awaiting_coordinator_review") {
    return { status: "needs_decision", text: "Needs decision" };
  }

  return {
    status: "ready",
    text: queueState.state === "paused" ? "Ready (Queue paused)" : "Ready",
  };
}

export function computeTaskEligibility(
  task: AgentQueueTask,
  queueState: QueueModelState,
  graphState: QueueTaskGraphState,
  workerCapacity: QueueWorkerCapacity,
): QueueTaskEligibility {
  const humanStatus = computeHumanQueueTaskStatus(task, queueState, graphState);
  const blockers = computeTaskBlockers(task, graphState);
  const hasCapacity = workerCapacity.availableSlots > 0;

  if (queueState.state !== "active") {
    return {
      canAutoStart: false,
      blockers,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: queueState.state === "paused" ? "Queue Paused" : "Queue is not active",
    };
  }

  if (humanStatus.status !== "ready") {
    return {
      canAutoStart: false,
      blockers,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: humanStatus.text,
    };
  }

  if (graphState.dependencyGate.gate !== "none" && graphState.dependencyGate.gate !== "satisfied") {
    return {
      canAutoStart: false,
      blockers,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: humanStatus.text,
    };
  }

  if (blockers.length > 0) {
    return {
      canAutoStart: false,
      blockers,
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: blockers[0]?.message ?? "Task has blockers",
    };
  }

  if (!hasCapacity) {
    return {
      canAutoStart: false,
      blockers: [
        ...blockers,
        {
          kind: "worker_unavailable",
          message: "No worker capacity is available.",
          taskId: task.queueItemId,
        },
      ],
      dependencyGate: graphState.dependencyGate.gate,
      humanStatus: humanStatus.status,
      reason: "No worker capacity is available.",
    };
  }

  return {
    canAutoStart: true,
    blockers,
    dependencyGate: graphState.dependencyGate.gate,
    humanStatus: humanStatus.status,
    reason: "Eligible",
  };
}

function dependencyIdsForTask(
  task: AgentQueueTask,
  dependencies: readonly QueueTaskDependency[],
) {
  const fromRecords = dependencies
    .filter((dependency) => dependency.downstreamTaskId === task.queueItemId)
    .map((dependency) => dependency.upstreamTaskId);

  return Array.from(new Set([...(task.dependsOn ?? []), ...fromRecords]));
}

function emptyGate(gate: SmartQueueDependencyGate): QueueDependencyGate {
  return {
    gate,
    waitingOnTaskIds: [],
    failedTaskIds: [],
    blockedTaskIds: [],
    missingTaskIds: [],
    satisfiedTaskIds: [],
  };
}

function isTaskClosedSuccessfully(task: AgentQueueTask) {
  return (
    task.status === "completed" ||
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

function formatWaitingTaskList(taskIds: readonly string[]) {
  if (taskIds.length === 0) {
    return "dependencies";
  }

  if (taskIds.length === 1) {
    return formatTaskId(taskIds[0] ?? "");
  }

  return taskIds.map(formatTaskId).join(", ");
}

function formatTaskId(taskId: string) {
  return taskId.replace(/^task[-_]?/i, "Task ");
}
