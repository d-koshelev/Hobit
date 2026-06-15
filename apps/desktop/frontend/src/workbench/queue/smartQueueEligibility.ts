import type {
  SmartQueueBlockerKind as SmartQueueBlockerKindValue,
  SmartQueueDependencyGate as SmartQueueDependencyGateValue,
  SmartQueueState,
  SmartQueueTaskHumanStatus,
} from "../../workspace/types/smartQueue";
import {
  computeSmartQueueDependencyGate,
  dependencyBlockersForGate,
  isDependencyBlocker,
} from "./smartQueueDependencyPropagation";

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

const DECISION_BLOCKER_KINDS = new Set<SmartQueueBlockerKindValue>([
  "validation_requires_decision",
  "requires_human_input",
]);

export function computeDependencyGate(
  task: SmartQueueTaskInput,
  tasks: readonly SmartQueueTaskInput[],
  dependencies: readonly SmartQueueDependency[] = [],
): SmartQueueDependencyGate {
  return computeSmartQueueDependencyGate(task, tasks, dependencies);
}

export function computeTaskBlockers(
  task: SmartQueueTaskInput,
  dependencyGate: SmartQueueDependencyGate,
): readonly SmartQueueBlocker[] {
  return [
    ...dependencyBlockersForGate(task.taskId, dependencyGate),
    ...(task.blockers ?? []),
  ];
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
      isDependencyBlocker,
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
