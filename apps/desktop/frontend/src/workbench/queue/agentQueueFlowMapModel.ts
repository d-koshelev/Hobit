import type { AgentQueueTask } from "../../workspace/types";
import {
  displayTaskTitle,
  isFinalQueueTaskStatus,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskDependencies,
  normalizeTaskPriority,
  normalizeValidationStatus,
  queueDependencyBlockedSummary,
  queueTaskPriorityLabel,
  statusLabel,
  validationStatusLabel,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
} from "../agentQueueTaskUiModel";
import {
  compareQueueRoutingItems,
  firstRoutingBlockedReasonLabel,
  type AgentQueueAssignedWorkerRoutingState,
} from "./agentQueueRoutingModel";
import type { AgentQueueSchedulerPlan } from "./agentQueueSchedulerModel";

export type QueueFlowTagColorToken =
  | "queue-flow-tag-1"
  | "queue-flow-tag-2"
  | "queue-flow-tag-3"
  | "queue-flow-tag-4"
  | "queue-flow-tag-5"
  | "queue-flow-tag-6";

export type QueueFlowMap = {
  columns: QueueFlowColumn[];
  executorLanes: QueueExecutorLane[];
  resultGroups: QueueResultGroup[];
};

export type QueueFlowColumn = {
  barriersAfter: QueueFlowBarrier[];
  depth: number;
  groups: QueueFlowGroup[];
  id: string;
  label: string;
};

export type QueueFlowGroup = {
  colorToken: QueueFlowTagColorToken;
  id: string;
  items: QueueFlowItemBlock[];
  queueTagId: string;
  queueTagName: string;
};

export type QueueFlowItemBlock = {
  assignedWorkerLabel: string | null;
  blockedReasons: string[];
  colorToken: QueueFlowTagColorToken;
  dependencyStatus: AgentQueueDependencyState["status"];
  dependsOn: string[];
  itemType: string;
  priorityLabel: string;
  queueItemId: string;
  queueTagId: string;
  queueTagName: string;
  shortId: string;
  status: AgentQueueTask["status"];
  statusLabel: string;
  title: string;
  validationStatus: NonNullable<AgentQueueTask["validationStatus"]>;
  validationStatusLabel: string;
};

export type QueueFlowBarrier = {
  afterDepth: number;
  blockedItemIds: string[];
  blockedSummary: string;
  blockingItemIds: string[];
  blockingSummary: string;
  id: string;
  label: string;
};

export type QueueExecutorLane = {
  activeItem: QueueFlowItemBlock | null;
  colorToken: QueueFlowTagColorToken | null;
  idleReason: string | null;
  id: string;
  isWorking: boolean;
  label: string;
  nextItemTitle: string | null;
  reviewMessage: string | null;
  scopeLabel: string;
  status: AgentWorkerSummary["status"];
  workerId: string;
};

export type QueueResultGroup = {
  colorToken: QueueFlowTagColorToken;
  id: string;
  items: QueueFlowItemBlock[];
  queueTagId: string;
  queueTagName: string;
};

export type BuildQueueFlowMapInput = {
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>;
  pausedQueueTagIds?: ReadonlySet<string>;
  routingStates: ReadonlyMap<string, AgentQueueAssignedWorkerRoutingState>;
  schedulerPlan?: AgentQueueSchedulerPlan;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

export function buildQueueFlowMap({
  dependencyStates,
  pausedQueueTagIds = new Set(),
  routingStates,
  schedulerPlan,
  tasks,
  workers,
}: BuildQueueFlowMapInput): QueueFlowMap {
  const itemBlocksById = new Map(
    tasks.map((task) => [
      task.queueItemId,
      queueFlowItemBlock({
        dependencyState: dependencyStates.get(task.queueItemId),
        pausedQueueTagIds,
        routingState: routingStates.get(task.queueItemId),
        task,
      }),
    ]),
  );
  const activeTasks = tasks.filter((task) => !isFinalQueueTaskStatus(task.status));
  const resultTasks = tasks.filter((task) => isFinalQueueTaskStatus(task.status));
  const depths = dependencyDepths(tasks);
  const activeDepths = Array.from(
    new Set(activeTasks.map((task) => depths.get(task.queueItemId) ?? 0)),
  ).sort((first, second) => first - second);
  const columns = activeDepths.map((depth, index) => {
    const layerTasks = activeTasks
      .filter((task) => (depths.get(task.queueItemId) ?? 0) === depth)
      .sort(compareQueueRoutingItems);

    return {
      barriersAfter: barrierAfterDepth({
        currentDepth: depth,
        depths,
        itemBlocksById,
        nextDepth: activeDepths[index + 1],
        tasks: activeTasks,
      }),
      depth,
      groups: groupBlocksByTag(
        layerTasks.map((task) => itemBlocksById.get(task.queueItemId)).filter(isBlock),
      ),
      id: `layer-${depth.toString()}`,
      label:
        depth === 0
          ? "Ready layer"
          : `Dependency layer ${depth.toString()}`,
    } satisfies QueueFlowColumn;
  });

  return {
    columns,
    executorLanes: workers
      .slice()
      .sort((first, second) => first.displayOrder - second.displayOrder)
      .map((worker) => {
        const runningTask =
          worker.status === "running" && worker.currentItemId
            ? tasks.find((task) => task.queueItemId === worker.currentItemId) ??
              null
            : null;
        const activeItem = runningTask
          ? itemBlocksById.get(runningTask.queueItemId) ?? null
          : null;
        const workerPlan = schedulerPlan?.workerPlans.find(
          (plan) => plan.workerId === worker.workerId,
        );

        return {
          activeItem,
          colorToken: activeItem?.colorToken ?? null,
          idleReason: workerPlan?.idleReason ?? null,
          id: `executor-${worker.workerId}`,
          isWorking: Boolean(activeItem),
          label: worker.name,
          nextItemTitle: workerPlan?.bestNextItem?.title ?? null,
          reviewMessage:
            activeItem && schedulerPlan?.globalState.code === "stop_kill_requested"
              ? "Termination requested / coordinator review needed"
              : null,
          scopeLabel: workerScopeLabel(worker),
          status: worker.status,
          workerId: worker.workerId,
        };
      }),
    resultGroups: groupBlocksByTag(
      resultTasks
        .slice()
        .sort(compareQueueRoutingItems)
        .map((task) => itemBlocksById.get(task.queueItemId))
        .filter(isBlock),
    ).map((group) => ({
      colorToken: group.colorToken,
      id: `results-${group.queueTagId}`,
      items: group.items,
      queueTagId: group.queueTagId,
      queueTagName: group.queueTagName,
    })),
  };
}

export function queueTagColorToken(queueTagId: string): QueueFlowTagColorToken {
  const tokens: QueueFlowTagColorToken[] = [
    "queue-flow-tag-1",
    "queue-flow-tag-2",
    "queue-flow-tag-3",
    "queue-flow-tag-4",
    "queue-flow-tag-5",
    "queue-flow-tag-6",
  ];
  let hash = 0;

  for (const character of queueTagId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return tokens[hash % tokens.length] ?? "queue-flow-tag-1";
}

function queueFlowItemBlock({
  dependencyState,
  pausedQueueTagIds,
  routingState,
  task,
}: {
  dependencyState?: AgentQueueDependencyState;
  pausedQueueTagIds: ReadonlySet<string>;
  routingState?: AgentQueueAssignedWorkerRoutingState;
  task: AgentQueueTask;
}): QueueFlowItemBlock {
  const queueTag = normalizeQueueTag(task);
  const normalizedValidationStatus = normalizeValidationStatus(
    task.validationStatus,
  );
  const normalizedDependencyState =
    dependencyState ??
    ({
      blockedBy: [],
      dependsOn: normalizeTaskDependencies(task.dependsOn),
      status: "ready",
    } satisfies AgentQueueDependencyState);
  const routingBlockedReason =
    routingState && !routingState.canTake
      ? firstRoutingBlockedReasonLabel(routingState.blockedReasons)
      : null;
  const blockedReasons = [
    pausedQueueTagIds.has(queueTag.queueTagId) ? "Queue tag is paused" : null,
    normalizedDependencyState.dependsOn.length > 0 &&
    normalizedDependencyState.status !== "ready"
      ? queueDependencyBlockedSummary(normalizedDependencyState)
      : null,
    routingBlockedReason,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    assignedWorkerLabel: routingState?.assignedWorker?.name ?? null,
    blockedReasons,
    colorToken: queueTagColorToken(queueTag.queueTagId),
    dependencyStatus: normalizedDependencyState.status,
    dependsOn: normalizedDependencyState.dependsOn,
    itemType: normalizeItemType(task.itemType),
    priorityLabel: queueTaskPriorityLabel(normalizeTaskPriority(task.priority)),
    queueItemId: task.queueItemId,
    queueTagId: queueTag.queueTagId,
    queueTagName: queueTag.queueTagName,
    shortId: shortQueueItemId(task.queueItemId),
    status: task.status,
    statusLabel: statusLabel(task.status),
    title: displayTaskTitle(task),
    validationStatus: normalizedValidationStatus,
    validationStatusLabel: validationStatusLabel(normalizedValidationStatus),
  };
}

function groupBlocksByTag(blocks: QueueFlowItemBlock[]): QueueFlowGroup[] {
  const groups = new Map<string, QueueFlowGroup>();

  for (const block of blocks) {
    const group =
      groups.get(block.queueTagId) ??
      ({
        colorToken: block.colorToken,
        id: `tag-${block.queueTagId}`,
        items: [],
        queueTagId: block.queueTagId,
        queueTagName: block.queueTagName,
      } satisfies QueueFlowGroup);

    group.items.push(block);
    groups.set(block.queueTagId, group);
  }

  return Array.from(groups.values()).sort((first, second) =>
    first.queueTagName.localeCompare(second.queueTagName),
  );
}

function barrierAfterDepth({
  currentDepth,
  depths,
  itemBlocksById,
  nextDepth,
  tasks,
}: {
  currentDepth: number;
  depths: ReadonlyMap<string, number>;
  itemBlocksById: ReadonlyMap<string, QueueFlowItemBlock>;
  nextDepth?: number;
  tasks: AgentQueueTask[];
}): QueueFlowBarrier[] {
  if (nextDepth === undefined) {
    return [];
  }

  const blockingItemIds = tasks
    .filter((task) => (depths.get(task.queueItemId) ?? 0) === currentDepth)
    .map((task) => task.queueItemId);
  const blockedItemIds = tasks
    .filter((task) => (depths.get(task.queueItemId) ?? 0) === nextDepth)
    .filter((task) =>
      normalizeTaskDependencies(task.dependsOn).some((dependencyId) =>
        blockingItemIds.includes(dependencyId),
      ),
    )
    .map((task) => task.queueItemId);
  const blockingTitles = blockingItemIds
    .map((queueItemId) => itemBlocksById.get(queueItemId)?.title)
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  const blockedTitles = blockedItemIds
    .map((queueItemId) => itemBlocksById.get(queueItemId)?.title)
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);

  return [
    {
      afterDepth: currentDepth,
      blockedItemIds,
      blockedSummary: compactTitleSummary({
        fallback: `Layer ${(nextDepth + 1).toString()} work`,
        totalCount: blockedItemIds.length,
        visibleTitles: blockedTitles,
      }),
      blockingItemIds,
      blockingSummary: compactTitleSummary({
        fallback: `Layer ${(currentDepth + 1).toString()} work`,
        totalCount: blockingItemIds.length,
        visibleTitles: blockingTitles,
      }),
      id: `barrier-${currentDepth.toString()}-${nextDepth.toString()}`,
      label: "Dependency barrier",
    },
  ];
}

function compactTitleSummary({
  fallback,
  totalCount,
  visibleTitles,
}: {
  fallback: string;
  totalCount: number;
  visibleTitles: string[];
}) {
  if (visibleTitles.length === 0) {
    return fallback;
  }

  const remainingCount = totalCount - visibleTitles.length;

  return remainingCount > 0
    ? `${visibleTitles.join(", ")} and ${remainingCount.toString()} more`
    : visibleTitles.join(", ");
}

function dependencyDepths(tasks: AgentQueueTask[]) {
  const tasksById = new Map(tasks.map((task) => [task.queueItemId, task]));
  const depths = new Map<string, number>();

  function visit(task: AgentQueueTask, visiting: Set<string>): number {
    const existingDepth = depths.get(task.queueItemId);

    if (existingDepth !== undefined) {
      return existingDepth;
    }

    if (visiting.has(task.queueItemId)) {
      return 0;
    }

    visiting.add(task.queueItemId);

    const dependencyDepth = normalizeTaskDependencies(task.dependsOn)
      .map((dependencyId) => tasksById.get(dependencyId))
      .filter((dependency): dependency is AgentQueueTask => Boolean(dependency))
      .reduce(
        (maxDepth, dependency) =>
          Math.max(maxDepth, visit(dependency, new Set(visiting)) + 1),
        0,
      );

    depths.set(task.queueItemId, dependencyDepth);
    return dependencyDepth;
  }

  for (const task of tasks) {
    visit(task, new Set());
  }

  return depths;
}

function workerScopeLabel(worker: AgentWorkerSummary) {
  return worker.scope.kind === "queue_tag"
    ? `Scoped to ${worker.scope.queueTagName}`
    : "All queues";
}

function shortQueueItemId(queueItemId: string) {
  const compact = queueItemId.replace(/[^a-z0-9]/gi, "");

  return compact.slice(-6) || queueItemId.slice(-6) || "task";
}

function isBlock(
  block: QueueFlowItemBlock | undefined,
): block is QueueFlowItemBlock {
  return Boolean(block);
}
