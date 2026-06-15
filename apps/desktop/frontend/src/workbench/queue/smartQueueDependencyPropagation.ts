import type {
  SmartQueueBlockerKind as SmartQueueBlockerKindValue,
  SmartQueueDependencyGate as SmartQueueDependencyGateValue,
} from "../../workspace/types/smartQueue";
import type {
  SmartQueueBlocker,
  SmartQueueDependency,
  SmartQueueDependencyGate,
  SmartQueueTaskInput,
} from "./smartQueueEligibility";

export type SmartQueueDependencyPropagationState =
  | "dependency_failed"
  | "dependency_blocked"
  | "waiting_dependency"
  | "satisfied";

export type SmartQueueDependencyPropagationResult = {
  readonly blockers: readonly SmartQueueBlocker[];
  readonly gate: SmartQueueDependencyGate;
  readonly state: SmartQueueDependencyPropagationState;
};

type UpstreamDependencyState = {
  readonly state: SmartQueueDependencyPropagationState;
  readonly rootBlockedTaskIds: readonly string[];
  readonly rootFailedTaskIds: readonly string[];
};

const DEPENDENCY_BLOCKER_KINDS = new Set<SmartQueueBlockerKindValue>([
  "dependency_failed",
  "dependency_blocked",
]);

export function computeSmartQueueDependencyPropagation(
  task: SmartQueueTaskInput,
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[] = [],
): SmartQueueDependencyPropagationResult {
  const tasksById = new Map(tasks.map((candidate) => [candidate.taskId, candidate]));
  const upstreamIdsByTaskId = dependencyMap(dependencies);
  const gate = computeSmartQueueDependencyGateForTaskId(
    task.taskId,
    tasksById,
    upstreamIdsByTaskId,
    new Set(),
  );

  return {
    blockers: dependencyBlockersForGate(task.taskId, gate),
    gate,
    state: propagationStateForGate(gate),
  };
}

export function computeSmartQueueDependencyGate(
  task: SmartQueueTaskInput,
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[] = [],
): SmartQueueDependencyGate {
  return computeSmartQueueDependencyPropagation(task, tasks, dependencies).gate;
}

export function dependencyBlockersForGate(
  taskId: string,
  gate: SmartQueueDependencyGate,
): readonly SmartQueueBlocker[] {
  const blockers: SmartQueueBlocker[] = [];

  for (const upstreamTaskId of gate.failedTaskIds) {
    blockers.push({
      kind: "dependency_failed",
      reason: "dependency failed",
      rootCauseTaskIds: gate.rootFailedTaskIds,
      taskId,
      upstreamTaskId,
    });
  }

  for (const upstreamTaskId of gate.blockedTaskIds) {
    blockers.push({
      kind: "dependency_blocked",
      reason: "dependency blocked",
      rootCauseTaskIds: gate.rootBlockedTaskIds,
      taskId,
      upstreamTaskId,
    });
  }

  return blockers;
}

export function isDependencyBlocker(blocker: SmartQueueBlocker) {
  return DEPENDENCY_BLOCKER_KINDS.has(blocker.kind);
}

function computeSmartQueueDependencyGateForTaskId(
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

    const upstreamState = computeUpstreamDependencyState(
      upstreamTask,
      tasksById,
      upstreamIdsByTaskId,
      visiting,
    );

    switch (upstreamState.state) {
      case "satisfied":
        satisfiedTaskIds.push(upstreamTaskId);
        break;
      case "dependency_failed":
        failedTaskIds.push(upstreamTaskId);
        for (const rootId of upstreamState.rootFailedTaskIds) {
          rootFailedTaskIds.add(rootId);
        }
        break;
      case "dependency_blocked":
        blockedTaskIds.push(upstreamTaskId);
        rootBlockedTaskIds.add(upstreamTaskId);
        for (const rootId of upstreamState.rootBlockedTaskIds) {
          rootBlockedTaskIds.add(rootId);
        }
        break;
      case "waiting_dependency":
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

function computeUpstreamDependencyState(
  upstreamTask: SmartQueueTaskInput,
  tasksById: ReadonlyMap<string, SmartQueueTaskInput>,
  upstreamIdsByTaskId: ReadonlyMap<string, readonly string[]>,
  visiting: ReadonlySet<string>,
): UpstreamDependencyState {
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
      state: "dependency_failed",
    };
  }

  if (upstreamTask.lifecycle === "blocked") {
    return {
      rootBlockedTaskIds: [upstreamTask.taskId],
      rootFailedTaskIds: [],
      state: "dependency_blocked",
    };
  }

  if (visiting.has(upstreamTask.taskId)) {
    return {
      rootBlockedTaskIds: [upstreamTask.taskId],
      rootFailedTaskIds: [],
      state: "dependency_blocked",
    };
  }

  const nextVisiting = new Set(visiting);
  nextVisiting.add(upstreamTask.taskId);

  const upstreamGate = computeSmartQueueDependencyGateForTaskId(
    upstreamTask.taskId,
    tasksById,
    upstreamIdsByTaskId,
    nextVisiting,
  );

  if (upstreamGate.gate === "failed" || upstreamGate.gate === "blocked") {
    return {
      rootBlockedTaskIds: [upstreamTask.taskId],
      rootFailedTaskIds: [],
      state: "dependency_blocked",
    };
  }

  return {
    rootBlockedTaskIds: [],
    rootFailedTaskIds: [],
    state: "waiting_dependency",
  };
}

function propagationStateForGate(
  gate: SmartQueueDependencyGate,
): SmartQueueDependencyPropagationState {
  switch (gate.gate) {
    case "failed":
      return "dependency_failed";
    case "blocked":
      return "dependency_blocked";
    case "waiting":
    case "none":
      return "waiting_dependency";
    case "satisfied":
      return "satisfied";
    default:
      return "waiting_dependency";
  }
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
