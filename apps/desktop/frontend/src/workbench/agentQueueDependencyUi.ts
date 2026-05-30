import type { AgentQueueTask } from "../workspace/types";
import { type BadgeVariant } from "./agentQueueFormatting";
import { displayTaskTitle } from "./agentQueueStatusLabels";

export type AgentQueueDependencyStatus = "ready" | "blocked" | "invalid";
export type AgentQueueDependencyBlockReason =
  | "cycle"
  | "missing"
  | "not_completed"
  | "not_finalized"
  | "self";

export type AgentQueueDependencyBlocker = {
  queueItemId: string;
  reason: AgentQueueDependencyBlockReason;
  title: string;
};

export type AgentQueueDependencyState = {
  blockedBy: AgentQueueDependencyBlocker[];
  dependsOn: string[];
  status: AgentQueueDependencyStatus;
};

export function normalizeTaskDependencies(
  dependsOn: string[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const dependencyId of dependsOn ?? []) {
    const trimmedDependencyId = dependencyId.trim();

    if (!trimmedDependencyId || seen.has(trimmedDependencyId)) {
      continue;
    }

    seen.add(trimmedDependencyId);
    normalized.push(trimmedDependencyId);
  }

  return normalized;
}

export function buildQueueDependencyGraph(tasks: AgentQueueTask[]) {
  return new Map(
    tasks.map((task) => [
      task.queueItemId,
      normalizeTaskDependencies(task.dependsOn),
    ]),
  );
}

export function queueDependencyStatusLabel(
  status: AgentQueueDependencyStatus,
) {
  switch (status) {
    case "blocked":
      return "Deps blocked";
    case "invalid":
      return "Deps invalid";
    case "ready":
    default:
      return "Deps ready";
  }
}

export function queueDependencyBadgeVariant(
  status: AgentQueueDependencyStatus,
): BadgeVariant {
  switch (status) {
    case "blocked":
      return "warning";
    case "invalid":
      return "error";
    case "ready":
    default:
      return "success";
  }
}

export function queueDependencyBlockedSummary(
  dependencyState: AgentQueueDependencyState,
) {
  if (dependencyState.status === "ready") {
    return "Dependencies ready.";
  }

  const blockedBy = dependencyState.blockedBy
    .map((blocker) => blocker.title)
    .join(", ");

  return blockedBy ? `Blocked by: ${blockedBy}` : "Dependencies are blocked.";
}

export function queueDependencyReadinessMessage(
  dependencyState: AgentQueueDependencyState,
) {
  if (dependencyState.status === "ready") {
    return null;
  }

  return dependencyState.status === "invalid"
    ? `Fix dependency errors before running. ${queueDependencyBlockedSummary(
        dependencyState,
      )}`
    : `Resolve dependencies before running. ${queueDependencyBlockedSummary(
        dependencyState,
      )}`;
}

export function queueDependencyBlockerLabel(
  blocker: AgentQueueDependencyBlocker,
) {
  switch (blocker.reason) {
    case "cycle":
      return `${blocker.title} creates a dependency cycle.`;
    case "missing":
      return `${blocker.title} is missing.`;
    case "not_completed":
      return `${blocker.title} is not completed.`;
    case "not_finalized":
      return `${blocker.title} is not coordinator accepted.`;
    case "self":
      return "A task cannot depend on itself.";
  }
}

export function getQueueTaskDependencyState(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
): AgentQueueDependencyState {
  const dependsOn = normalizeTaskDependencies(task.dependsOn);
  const tasksById = new Map(
    tasks.map((candidate) => [candidate.queueItemId, candidate]),
  );
  const blockers: AgentQueueDependencyBlocker[] = [];

  for (const dependencyId of dependsOn) {
    if (dependencyId === task.queueItemId) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "self",
        title: displayTaskTitle(task),
      });
      continue;
    }

    const dependency = tasksById.get(dependencyId);

    if (!dependency) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "missing",
        title: dependencyId,
      });
      continue;
    }

    if (hasQueueDependencyCycle({
      dependencyGraph: buildQueueDependencyGraph([
        ...tasks.filter((candidate) => candidate.queueItemId !== task.queueItemId),
        { ...task, dependsOn },
      ]),
      queueItemId: task.queueItemId,
    })) {
      blockers.push({
        queueItemId: dependencyId,
        reason: "cycle",
        title: displayTaskTitle(dependency),
      });
      continue;
    }

    if (dependency.status !== "completed") {
      blockers.push({
        queueItemId: dependencyId,
        reason: "not_completed",
        title: displayTaskTitle(dependency),
      });
      continue;
    }

    if (dependency.coordinatorStatus !== "finalized") {
      blockers.push({
        queueItemId: dependencyId,
        reason: "not_finalized",
        title: displayTaskTitle(dependency),
      });
    }
  }

  const hasInvalidBlocker = blockers.some(
    (blocker) =>
      blocker.reason === "cycle" ||
      blocker.reason === "missing" ||
      blocker.reason === "self",
  );

  return {
    blockedBy: blockers,
    dependsOn,
    status:
      blockers.length === 0 ? "ready" : hasInvalidBlocker ? "invalid" : "blocked",
  };
}

export function queueDependencyStatesByTask(tasks: AgentQueueTask[]) {
  return new Map(
    tasks.map((task) => [
      task.queueItemId,
      getQueueTaskDependencyState(task, tasks),
    ]),
  );
}

export function validateQueueTaskDependencies(
  task: AgentQueueTask,
  tasks: AgentQueueTask[],
) {
  const dependencyState = getQueueTaskDependencyState(task, tasks);
  const invalidBlocker = dependencyState.blockedBy.find(
    (blocker) =>
      blocker.reason === "cycle" ||
      blocker.reason === "missing" ||
      blocker.reason === "self",
  );

  return invalidBlocker ? queueDependencyBlockerLabel(invalidBlocker) : null;
}

export function dependentTasksForQueueItem(
  tasks: AgentQueueTask[],
  queueItemId: string,
) {
  return tasks.filter((task) =>
    normalizeTaskDependencies(task.dependsOn).includes(queueItemId),
  );
}

function hasQueueDependencyCycle({
  dependencyGraph,
  queueItemId,
}: {
  dependencyGraph: ReadonlyMap<string, string[]>;
  queueItemId: string;
}) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(currentQueueItemId: string): boolean {
    if (visiting.has(currentQueueItemId)) {
      return true;
    }

    if (visited.has(currentQueueItemId)) {
      return false;
    }

    visiting.add(currentQueueItemId);

    for (const dependencyId of dependencyGraph.get(currentQueueItemId) ?? []) {
      if (visit(dependencyId)) {
        return true;
      }
    }

    visiting.delete(currentQueueItemId);
    visited.add(currentQueueItemId);
    return false;
  }

  return visit(queueItemId);
}
