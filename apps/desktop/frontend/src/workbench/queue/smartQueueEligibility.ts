import type {
  SmartQueueBlockerKind as SmartQueueBlockerKindValue,
  SmartQueueDependencyGate as SmartQueueDependencyGateValue,
  SmartQueueState,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types/smartQueue";

export type SmartQueueTaskLifecycle =
  | "draft"
  | "queued"
  | "ready"
  | "running"
  | "review"
  | "closed"
  | "failed"
  | "cancelled"
  | "blocked";

export type SmartQueueTaskInput = {
  readonly taskId: string;
  readonly title?: string;
  readonly lifecycle: SmartQueueTaskLifecycle;
  readonly blockers?: readonly SmartQueueBlocker[];
};

export type SmartQueueDependency = {
  readonly dependencyId?: string;
  readonly upstreamTaskId: string;
  readonly downstreamTaskId: string;
  readonly kind: "blocks_start";
};

export type SmartQueueDependencyGate = {
  readonly gate: SmartQueueDependencyGateValue;
  readonly upstreamTaskIds: readonly string[];
  readonly waitingTaskIds: readonly string[];
  readonly satisfiedTaskIds: readonly string[];
  readonly failedTaskIds: readonly string[];
  readonly blockedTaskIds: readonly string[];
  readonly missingTaskIds: readonly string[];
  readonly rootFailedTaskIds: readonly string[];
  readonly rootBlockedTaskIds: readonly string[];
};

export type SmartQueueBlocker = {
  readonly kind: SmartQueueBlockerKindValue;
  readonly reason: string;
  readonly taskId?: string;
  readonly upstreamTaskId?: string;
  readonly rootCauseTaskIds?: readonly string[];
};

export type SmartQueueHumanStatus = {
  readonly status: SmartQueueTaskHumanStatus;
  readonly label: string;
  readonly reason?: string;
  readonly text: string;
};

export type SmartQueueEligibility = {
  readonly autoEligibleToStart: boolean;
  readonly blockers: readonly SmartQueueBlocker[];
  readonly dependencyGate: SmartQueueDependencyGate;
  readonly humanStatus: SmartQueueHumanStatus;
  readonly reason: string;
};

export type SmartQueueEligibilityContext = {
  readonly queueState: SmartQueueState;
  readonly capacityAvailable: boolean;
};

export type SmartQueueDependencyFailurePropagation = {
  readonly affectedTaskIds: readonly string[];
  readonly blockersByTaskId: Readonly<Record<string, readonly SmartQueueBlocker[]>>;
  readonly gatesByTaskId: Readonly<Record<string, SmartQueueDependencyGate>>;
};

type EffectiveDependencyState = {
  readonly state: Exclude<SmartQueueDependencyGateValue, "none">;
  readonly rootFailedTaskIds: readonly string[];
  readonly rootBlockedTaskIds: readonly string[];
};

const DECISION_BLOCKER_KINDS = new Set<SmartQueueBlockerKindValue>([
  "validation_requires_decision",
  "requires_human_input",
]);

export function computeDependencyGate(
  task: SmartQueueTaskInput,
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[] = [],
): SmartQueueDependencyGate {
  return computeDependencyGateInternal(
    task.taskId,
    taskMap(tasks),
    dependencyMap(dependencies),
    new Set(),
  );
}

export function computeTaskBlockers(
  task: SmartQueueTaskInput,
  dependencyGate: SmartQueueDependencyGate,
): readonly SmartQueueBlocker[] {
  const blockers: SmartQueueBlocker[] = [];

  for (const upstreamTaskId of dependencyGate.failedTaskIds) {
    blockers.push({
      kind: "dependency_failed",
      reason: "dependency failed",
      rootCauseTaskIds: dependencyGate.rootFailedTaskIds,
      taskId: task.taskId,
      upstreamTaskId,
    });
  }

  for (const upstreamTaskId of dependencyGate.blockedTaskIds) {
    blockers.push({
      kind: "dependency_blocked",
      reason: "dependency blocked",
      rootCauseTaskIds: dependencyGate.rootBlockedTaskIds,
      taskId: task.taskId,
      upstreamTaskId,
    });
  }

  return [...blockers, ...(task.blockers ?? [])];
}

export function computeHumanQueueStatus(
  task: SmartQueueTaskInput,
  dependencyGate: SmartQueueDependencyGate,
): SmartQueueHumanStatus {
  if (task.lifecycle === "running") {
    return humanStatus("running", "Running");
  }

  if (task.lifecycle === "closed") {
    return humanStatus("closed", "Closed");
  }

  if (task.lifecycle === "failed") {
    return humanStatus("failed", "Failed");
  }

  if (task.lifecycle === "cancelled") {
    return humanStatus("cancelled", "Cancelled");
  }

  if (dependencyGate.gate === "failed") {
    return humanStatus("blocked", "Blocked: dependency failed");
  }

  if (dependencyGate.gate === "blocked") {
    return humanStatus("blocked", "Blocked: dependency blocked");
  }

  if (dependencyGate.gate === "waiting") {
    return humanStatus(
      "waiting_dependency",
      "Waiting dependency",
      `Waiting for: ${formatDependencyList(dependencyGate.waitingTaskIds)}`,
    );
  }

  const blockers = task.blockers ?? [];
  const decisionBlocker = blockers.find((blocker) =>
    DECISION_BLOCKER_KINDS.has(blocker.kind),
  );

  if (decisionBlocker) {
    return humanStatus(
      "needs_decision",
      `Needs decision: ${shortReason(decisionBlocker)}`,
    );
  }

  const blocker = blockers[0];

  if (task.lifecycle === "blocked" || blocker) {
    return humanStatus("blocked", `Blocked: ${shortReason(blocker)}`);
  }

  if (task.lifecycle === "review") {
    return humanStatus("review", "Review");
  }

  return humanStatus("ready", "Ready");
}

export function computeTaskEligibility(
  task: SmartQueueTaskInput,
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[],
  context: SmartQueueEligibilityContext,
): SmartQueueEligibility {
  const dependencyGate = computeDependencyGate(task, tasks, dependencies);
  const blockers = computeTaskBlockers(task, dependencyGate);
  const humanStatus = computeHumanQueueStatus(
    { ...task, blockers },
    dependencyGate,
  );

  if (humanStatus.status !== "ready") {
    return {
      autoEligibleToStart: false,
      blockers,
      dependencyGate,
      humanStatus,
      reason: humanStatus.text,
    };
  }

  if (
    dependencyGate.gate !== "none" &&
    dependencyGate.gate !== "satisfied"
  ) {
    return {
      autoEligibleToStart: false,
      blockers,
      dependencyGate,
      humanStatus,
      reason: humanStatus.text,
    };
  }

  if (blockers.length > 0) {
    return {
      autoEligibleToStart: false,
      blockers,
      dependencyGate,
      humanStatus,
      reason: `Blocked: ${shortReason(blockers[0])}`,
    };
  }

  if (context.queueState !== "active") {
    return {
      autoEligibleToStart: false,
      blockers,
      dependencyGate,
      humanStatus,
      reason: context.queueState === "paused" ? "Queue Paused" : "Queue is not active",
    };
  }

  if (!context.capacityAvailable) {
    const capacityBlocker: SmartQueueBlocker = {
      kind: "worker_unavailable",
      reason: "worker unavailable",
      taskId: task.taskId,
    };

    return {
      autoEligibleToStart: false,
      blockers: [...blockers, capacityBlocker],
      dependencyGate,
      humanStatus,
      reason: "No worker capacity is available",
    };
  }

  return {
    autoEligibleToStart: true,
    blockers,
    dependencyGate,
    humanStatus,
    reason: "Eligible",
  };
}

export function computeDependencyFailurePropagation(
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[],
): SmartQueueDependencyFailurePropagation {
  const gatesByTaskId: Record<string, SmartQueueDependencyGate> = {};
  const blockersByTaskId: Record<string, readonly SmartQueueBlocker[]> = {};
  const affectedTaskIds: string[] = [];

  for (const task of tasks) {
    const gate = computeDependencyGate(task, tasks, dependencies);
    const blockers = computeTaskBlockers(task, gate).filter(
      (blocker) =>
        blocker.kind === "dependency_failed" ||
        blocker.kind === "dependency_blocked",
    );

    if (blockers.length > 0) {
      affectedTaskIds.push(task.taskId);
      gatesByTaskId[task.taskId] = gate;
      blockersByTaskId[task.taskId] = blockers;
    }
  }

  return {
    affectedTaskIds,
    blockersByTaskId,
    gatesByTaskId,
  };
}

function computeDependencyGateInternal(
  taskId: string,
  tasksById: ReadonlyMap<string, SmartQueueTaskInput>,
  upstreamIdsByTaskId: ReadonlyMap<string, readonly string[]>,
  visiting: ReadonlySet<string>,
): SmartQueueDependencyGate {
  const upstreamTaskIds = [...(upstreamIdsByTaskId.get(taskId) ?? [])];

  if (upstreamTaskIds.length === 0) {
    return emptyDependencyGate("none", upstreamTaskIds);
  }

  const waitingTaskIds: string[] = [];
  const satisfiedTaskIds: string[] = [];
  const failedTaskIds: string[] = [];
  const blockedTaskIds: string[] = [];
  const missingTaskIds: string[] = [];
  const rootFailedTaskIds = new Set<string>();
  const rootBlockedTaskIds = new Set<string>();

  for (const upstreamTaskId of upstreamTaskIds) {
    const upstreamTask = tasksById.get(upstreamTaskId);

    if (!upstreamTask) {
      missingTaskIds.push(upstreamTaskId);
      blockedTaskIds.push(upstreamTaskId);
      rootBlockedTaskIds.add(upstreamTaskId);
      continue;
    }

    const effectiveState = effectiveDependencyState(
      upstreamTask,
      tasksById,
      upstreamIdsByTaskId,
      visiting,
    );

    switch (effectiveState.state) {
      case "satisfied":
        satisfiedTaskIds.push(upstreamTaskId);
        break;
      case "failed":
        failedTaskIds.push(upstreamTaskId);
        for (const rootId of effectiveState.rootFailedTaskIds) {
          rootFailedTaskIds.add(rootId);
        }
        break;
      case "blocked":
        blockedTaskIds.push(upstreamTaskId);
        for (const rootId of effectiveState.rootBlockedTaskIds) {
          rootBlockedTaskIds.add(rootId);
        }
        break;
      case "waiting":
        waitingTaskIds.push(upstreamTaskId);
        break;
    }
  }

  if (failedTaskIds.length > 0) {
    return {
      blockedTaskIds,
      failedTaskIds,
      gate: "failed",
      missingTaskIds,
      rootBlockedTaskIds: [...rootBlockedTaskIds],
      rootFailedTaskIds: [...rootFailedTaskIds],
      satisfiedTaskIds,
      upstreamTaskIds,
      waitingTaskIds,
    };
  }

  if (blockedTaskIds.length > 0) {
    return {
      blockedTaskIds,
      failedTaskIds,
      gate: "blocked",
      missingTaskIds,
      rootBlockedTaskIds: [...rootBlockedTaskIds],
      rootFailedTaskIds: [...rootFailedTaskIds],
      satisfiedTaskIds,
      upstreamTaskIds,
      waitingTaskIds,
    };
  }

  if (waitingTaskIds.length > 0) {
    return {
      blockedTaskIds,
      failedTaskIds,
      gate: "waiting",
      missingTaskIds,
      rootBlockedTaskIds: [],
      rootFailedTaskIds: [],
      satisfiedTaskIds,
      upstreamTaskIds,
      waitingTaskIds,
    };
  }

  return {
    blockedTaskIds,
    failedTaskIds,
    gate: "satisfied",
    missingTaskIds,
    rootBlockedTaskIds: [],
    rootFailedTaskIds: [],
    satisfiedTaskIds,
    upstreamTaskIds,
    waitingTaskIds,
  };
}

function effectiveDependencyState(
  upstreamTask: SmartQueueTaskInput,
  tasksById: ReadonlyMap<string, SmartQueueTaskInput>,
  upstreamIdsByTaskId: ReadonlyMap<string, readonly string[]>,
  visiting: ReadonlySet<string>,
): EffectiveDependencyState {
  if (upstreamTask.lifecycle === "closed") {
    return {
      rootBlockedTaskIds: [],
      rootFailedTaskIds: [],
      state: "satisfied",
    };
  }

  if (upstreamTask.lifecycle === "failed" || upstreamTask.lifecycle === "cancelled") {
    return {
      rootBlockedTaskIds: [],
      rootFailedTaskIds: [upstreamTask.taskId],
      state: "failed",
    };
  }

  if (upstreamTask.lifecycle === "blocked") {
    return {
      rootBlockedTaskIds: [upstreamTask.taskId],
      rootFailedTaskIds: [],
      state: "blocked",
    };
  }

  if (visiting.has(upstreamTask.taskId)) {
    return {
      rootBlockedTaskIds: [upstreamTask.taskId],
      rootFailedTaskIds: [],
      state: "blocked",
    };
  }

  const nextVisiting = new Set(visiting);
  nextVisiting.add(upstreamTask.taskId);

  const upstreamGate = computeDependencyGateInternal(
    upstreamTask.taskId,
    tasksById,
    upstreamIdsByTaskId,
    nextVisiting,
  );

  if (upstreamGate.gate === "failed") {
    return {
      rootBlockedTaskIds: upstreamGate.rootBlockedTaskIds,
      rootFailedTaskIds: upstreamGate.rootFailedTaskIds,
      state: "failed",
    };
  }

  if (upstreamGate.gate === "blocked") {
    return {
      rootBlockedTaskIds: upstreamGate.rootBlockedTaskIds,
      rootFailedTaskIds: upstreamGate.rootFailedTaskIds,
      state: "blocked",
    };
  }

  return {
    rootBlockedTaskIds: [],
    rootFailedTaskIds: [],
    state: "waiting",
  };
}

function taskMap(tasks: readonly SmartQueueTaskInput[]) {
  return new Map(tasks.map((task) => [task.taskId, task]));
}

function dependencyMap(dependencies: readonly SmartQueueDependency[]) {
  const upstreamIdsByTaskId = new Map<string, string[]>();

  for (const dependency of dependencies) {
    if (dependency.kind !== "blocks_start") {
      continue;
    }

    const upstreamIds =
      upstreamIdsByTaskId.get(dependency.downstreamTaskId) ?? [];

    if (!upstreamIds.includes(dependency.upstreamTaskId)) {
      upstreamIds.push(dependency.upstreamTaskId);
    }

    upstreamIdsByTaskId.set(dependency.downstreamTaskId, upstreamIds);
  }

  return upstreamIdsByTaskId;
}

function emptyDependencyGate(
  gate: SmartQueueDependencyGateValue,
  upstreamTaskIds: readonly string[],
): SmartQueueDependencyGate {
  return {
    blockedTaskIds: [],
    failedTaskIds: [],
    gate,
    missingTaskIds: [],
    rootBlockedTaskIds: [],
    rootFailedTaskIds: [],
    satisfiedTaskIds: [],
    upstreamTaskIds,
    waitingTaskIds: [],
  };
}

function humanStatus(
  status: SmartQueueTaskHumanStatus,
  label: string,
  reason?: string,
): SmartQueueHumanStatus {
  return {
    label,
    reason,
    status,
    text: reason ?? label,
  };
}

function formatDependencyList(taskIds: readonly string[]) {
  if (taskIds.length === 0) {
    return "dependencies";
  }

  return taskIds.map(formatTaskId).join(", ");
}

function formatTaskId(taskId: string) {
  return taskId.trim() || "dependency";
}

function shortReason(blocker: SmartQueueBlocker | undefined) {
  if (!blocker) {
    return "needs intervention";
  }

  return blocker.reason.trim() || defaultBlockerReason(blocker.kind);
}

function defaultBlockerReason(kind: SmartQueueBlockerKindValue) {
  switch (kind) {
    case "dependency_failed":
      return "dependency failed";
    case "dependency_blocked":
      return "dependency blocked";
    case "missing_config":
      return "missing config";
    case "validation_requires_decision":
      return "validation requires decision";
    case "worker_unavailable":
      return "worker unavailable";
    case "dirty_worktree":
      return "dirty worktree";
    case "missing_prompt":
      return "missing prompt";
    case "requires_human_input":
      return "human input required";
  }
}
