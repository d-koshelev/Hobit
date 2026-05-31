import type { AgentQueueTask } from "../../workspace/types";
import {
  displayTaskTitle,
  coordinatorStatusBlocksNewWork,
  isFinalQueueTaskStatus,
  itemTypeLabel,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskDependencies,
  normalizeTaskPriority,
  normalizeValidationStatus,
  queueDependencyBlockedSummary,
  queueExecutorInfoForTask,
  queueTaskPriorityLabel,
  statusLabel,
  validationStatusLabel,
  type AgentQueueDependencyState,
  type AgentQueueExecutorInfoTone,
  type AgentWorkerSummary,
} from "../agentQueueTaskUiModel";
import {
  compareQueueRoutingItems,
  firstRoutingBlockedReasonLabel,
  type AgentQueueAssignedWorkerRoutingState,
  type AgentQueueRoutingBlockedReasonCode,
} from "./agentQueueRoutingModel";
import { executionPlanStatusLabel } from "./agentQueueExecutionPlanModel";
import type { AgentQueueSchedulerPlan } from "./agentQueueSchedulerModel";
import {
  coordinatorStatusLabel,
  normalizeCoordinatorStatus,
} from "../agentQueueStatusLabels";

export type QueueFlowTagColorToken =
  | "queue-flow-tag-1"
  | "queue-flow-tag-2"
  | "queue-flow-tag-3"
  | "queue-flow-tag-4"
  | "queue-flow-tag-5"
  | "queue-flow-tag-6";

export type QueueFlowMap = {
  blockedColumns: QueueFlowColumn[];
  columns: QueueFlowColumn[];
  executorLanes: QueueExecutorLane[];
  resultGroups: QueueResultGroup[];
  waitingColumns: QueueFlowColumn[];
  workColumns: QueueFlowColumn[];
};

export type QueueFlowPrimaryZone =
  | "blocked"
  | "executor"
  | "results"
  | "waiting"
  | "work";

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
  executorInfoDetail: string;
  executorInfoLabel: string;
  executorInfoTone: AgentQueueExecutorInfoTone;
  itemType: string;
  hasWorkerReport: boolean;
  hasLinkedDiffReview: boolean;
  primaryZone: QueueFlowPrimaryZone;
  planStatusLabel: string;
  coordinatorStatusLabel: string;
  coordinatorStatus: NonNullable<AgentQueueTask["coordinatorStatus"]>;
  priorityLabel: string;
  queueItemId: string;
  queueTagId: string;
  queueTagName: string;
  shortId: string;
  status: AgentQueueTask["status"];
  statusLabel: string;
  sourceItemLabel: string | null;
  reviewTargetSummary: string | null;
  routingBlockedReasonCodes: AgentQueueRoutingBlockedReasonCode[];
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
        tasks,
        task,
      }),
    ]),
  );
  const activeTasks = tasks.filter((task) =>
    isIntakeFlowZone(itemBlocksById.get(task.queueItemId)?.primaryZone),
  );
  const resultTasks = tasks.filter(
    (task) => itemBlocksById.get(task.queueItemId)?.primaryZone === "results",
  );
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
          ? "Backlog lane"
          : `Dependency lane ${depth.toString()}`,
    } satisfies QueueFlowColumn;
  });

  return {
    blockedColumns: filterFlowColumns(
      columns,
      (item) => item.primaryZone === "blocked",
      true,
    ),
    columns,
    executorLanes: executorLanes({
      itemBlocksById,
      schedulerPlan,
      tasks,
      workers,
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
    waitingColumns: filterFlowColumns(
      columns,
      (item) => item.primaryZone === "waiting",
      false,
    ),
    workColumns: filterFlowColumns(
      columns,
      (item) => item.primaryZone === "work",
      false,
    ),
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
  tasks,
  task,
}: {
  dependencyState?: AgentQueueDependencyState;
  pausedQueueTagIds: ReadonlySet<string>;
  routingState?: AgentQueueAssignedWorkerRoutingState;
  tasks: AgentQueueTask[];
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
  const routingBlockedReasonCodes =
    routingState && !routingState.canTake
      ? routingState.blockedReasons.map((reason) => reason.code)
      : [];
  const executorInfo = queueExecutorInfoForTask({
    dependencyState: normalizedDependencyState,
    routingState,
    task,
  });
  const blockedReasons = [
    pausedQueueTagIds.has(queueTag.queueTagId) ? "Queue tag is paused" : null,
    normalizedDependencyState.dependsOn.length > 0 &&
    normalizedDependencyState.status !== "ready"
      ? queueDependencyBlockedSummary(normalizedDependencyState)
      : null,
    routingBlockedReason,
  ].filter((reason): reason is string => Boolean(reason));
  const itemType = normalizeItemType(task.itemType);
  const sourceItemId = task.diffReview?.sourceItemId;
  const sourceTask = sourceItemId
    ? tasks.find((candidate) => candidate.queueItemId === sourceItemId)
    : null;

  const block = {
    assignedWorkerLabel: routingState?.assignedWorker?.name ?? null,
    blockedReasons,
    colorToken: queueTagColorToken(queueTag.queueTagId),
    dependencyStatus: normalizedDependencyState.status,
    dependsOn: normalizedDependencyState.dependsOn,
    executorInfoDetail: executorInfo.detail,
    executorInfoLabel: executorInfo.label,
    executorInfoTone: executorInfo.tone,
    hasLinkedDiffReview: tasks.some(
      (candidate) =>
        normalizeItemType(candidate.itemType) === "diff_review" &&
        candidate.diffReview?.sourceItemId === task.queueItemId,
    ),
    hasWorkerReport: hasWorkerReport(task),
    itemType: itemTypeLabel(itemType),
    planStatusLabel: executionPlanStatusLabel(task.executionPlanPreview),
    coordinatorStatus: normalizeCoordinatorStatus(task.coordinatorStatus),
    coordinatorStatusLabel: coordinatorStatusLabel(task.coordinatorStatus),
    priorityLabel: queueTaskPriorityLabel(normalizeTaskPriority(task.priority)),
    queueItemId: task.queueItemId,
    queueTagId: queueTag.queueTagId,
    queueTagName: queueTag.queueTagName,
    shortId: shortQueueItemId(task.queueItemId),
    sourceItemLabel: sourceItemId
      ? sourceTask
        ? `${displayTaskTitle(sourceTask)} (${sourceItemId})`
        : sourceItemId
      : null,
    status: task.status,
    statusLabel: statusLabel(task.status),
    reviewTargetSummary: task.diffReview?.reviewTargetSummary ?? null,
    routingBlockedReasonCodes,
    title: displayTaskTitle(task),
    validationStatus: normalizedValidationStatus,
    validationStatusLabel: validationStatusLabel(normalizedValidationStatus),
  } satisfies Omit<QueueFlowItemBlock, "primaryZone">;

  return {
    ...block,
    primaryZone: queueFlowPrimaryZone(block),
  };
}

function hasWorkerReport(task: AgentQueueTask) {
  return (task.workerExecutionReports?.length ?? 0) > 0;
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

  const currentLayerItemIds = new Set(
    tasks
      .filter((task) => (depths.get(task.queueItemId) ?? 0) === currentDepth)
      .map((task) => task.queueItemId),
  );
  const blockedTasks = tasks
    .filter((task) => (depths.get(task.queueItemId) ?? 0) === nextDepth)
    .filter((task) =>
      normalizeTaskDependencies(task.dependsOn).some((dependencyId) =>
        currentLayerItemIds.has(dependencyId),
      ),
    );
  const blockedItemIds = blockedTasks.map((task) => task.queueItemId);
  const blockingItemIds = Array.from(
    new Set(
      blockedTasks.flatMap((task) =>
        normalizeTaskDependencies(task.dependsOn).filter((dependencyId) =>
          currentLayerItemIds.has(dependencyId),
        ),
      ),
    ),
  );

  if (blockedItemIds.length === 0 || blockingItemIds.length === 0) {
    return [];
  }

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
        fallback: `Dependency lane ${nextDepth.toString()} work`,
        totalCount: blockedItemIds.length,
        visibleTitles: blockedTitles,
      }),
      blockingItemIds,
      blockingSummary: compactTitleSummary({
        fallback: `Backlog lane ${currentDepth.toString()} work`,
        totalCount: blockingItemIds.length,
        visibleTitles: blockingTitles,
      }),
      id: `barrier-${currentDepth.toString()}-${nextDepth.toString()}`,
      label: "Dependency barrier",
    },
  ];
}

function filterFlowColumns(
  columns: QueueFlowColumn[],
  itemPredicate: (item: QueueFlowItemBlock) => boolean,
  includeMatchingBarriers: boolean,
) {
  return columns
    .map((column) => {
      const groups = column.groups
        .map((group) => ({
          ...group,
          items: group.items.filter(itemPredicate),
        }))
        .filter((group) => group.items.length > 0);
      const itemIds = new Set(
        groups.flatMap((group) => group.items.map((item) => item.queueItemId)),
      );

      return {
        ...column,
        barriersAfter: includeMatchingBarriers
          ? column.barriersAfter.filter((barrier) =>
              barrier.blockedItemIds.some((queueItemId) =>
                itemIds.has(queueItemId),
              ),
            )
          : [],
        groups,
      } satisfies QueueFlowColumn;
    })
    .filter((column) => column.groups.length > 0);
}

function isIntakeFlowZone(zone: QueueFlowPrimaryZone | undefined) {
  return zone === "blocked" || zone === "waiting" || zone === "work";
}

function queueFlowPrimaryZone(
  item: Omit<QueueFlowItemBlock, "primaryZone">,
): QueueFlowPrimaryZone {
  if (isFinalQueueTaskStatus(item.status) || item.hasWorkerReport) {
    return "results";
  }

  if (isExecutorFlowBlock(item)) {
    return "executor";
  }

  if (isBlockedFlowBlock(item)) {
    return "blocked";
  }

  if (isWaitingFlowBlock(item)) {
    return "waiting";
  }

  return "work";
}

function isExecutorFlowBlock(item: Omit<QueueFlowItemBlock, "primaryZone">) {
  return item.status === "running";
}

function isBlockedFlowBlock(item: Omit<QueueFlowItemBlock, "primaryZone">) {
  return (
    item.coordinatorStatus === "blocked" ||
    coordinatorStatusBlocksNewWork(item.coordinatorStatus) ||
    item.dependencyStatus !== "ready" ||
    item.routingBlockedReasonCodes.some((code) => REAL_BLOCKER_REASON_CODES.has(code))
  );
}

function isWaitingFlowBlock(item: Omit<QueueFlowItemBlock, "primaryZone">) {
  return (
    item.status === "draft" ||
    item.routingBlockedReasonCodes.some((code) => WAITING_REASON_CODES.has(code))
  );
}

const REAL_BLOCKER_REASON_CODES: ReadonlySet<AgentQueueRoutingBlockedReasonCode> =
  new Set([
    "assigned_to_another_worker",
    "item_awaiting_coordinator_review",
    "item_dependency_graph_invalid",
    "queue_tag_paused",
    "worker_disabled",
    "worker_scope_mismatch",
    "waiting_for_dependencies",
  ]);

const WAITING_REASON_CODES: ReadonlySet<AgentQueueRoutingBlockedReasonCode> =
  new Set([
    "assigned_worker_unavailable",
    "item_missing_prompt",
    "item_not_runnable_status",
    "item_validation_in_progress",
    "queue_stop_kill_requested",
    "queue_stopped",
  ]);

function executorLanes({
  itemBlocksById,
  schedulerPlan,
  tasks,
  workers,
}: {
  itemBlocksById: ReadonlyMap<string, QueueFlowItemBlock>;
  schedulerPlan?: AgentQueueSchedulerPlan;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
}): QueueExecutorLane[] {
  const renderedExecutorItemIds = new Set<string>();
  const lanes = workers
    .slice()
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .map((worker) => {
      const runningTask = runningTaskForWorker({ tasks, worker });
      const activeItem = runningTask
        ? itemBlocksById.get(runningTask.queueItemId) ?? null
        : null;
      const workerPlan = schedulerPlan?.workerPlans.find(
        (plan) => plan.workerId === worker.workerId,
      );

      if (activeItem) {
        renderedExecutorItemIds.add(activeItem.queueItemId);
      }

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
      } satisfies QueueExecutorLane;
    });

  const unmatchedRunningLanes = tasks
    .filter((task) => itemBlocksById.get(task.queueItemId)?.primaryZone === "executor")
    .filter((task) => !renderedExecutorItemIds.has(task.queueItemId))
    .sort(compareQueueRoutingItems)
    .map((task) => {
      const activeItem = itemBlocksById.get(task.queueItemId) ?? null;
      const workerId = task.assignedWorkerId ?? task.assignedExecutorWidgetId;

      return {
        activeItem,
        colorToken: activeItem?.colorToken ?? null,
        idleReason: null,
        id: `executor-running-${task.queueItemId}`,
        isWorking: Boolean(activeItem),
        label: activeItem?.assignedWorkerLabel ?? "Working executor",
        nextItemTitle: null,
        reviewMessage:
          activeItem && schedulerPlan?.globalState.code === "stop_kill_requested"
            ? "Termination requested / coordinator review needed"
            : null,
        scopeLabel: workerId ? `Assigned to ${workerId}` : "Running item",
        status: "running",
        workerId: workerId ?? `running-${task.queueItemId}`,
      } satisfies QueueExecutorLane;
    });

  return [...lanes, ...unmatchedRunningLanes];
}

function runningTaskForWorker({
  tasks,
  worker,
}: {
  tasks: AgentQueueTask[];
  worker: AgentWorkerSummary;
}) {
  if (worker.status === "running" && worker.currentItemId) {
    const currentTask = tasks.find(
      (task) =>
        task.queueItemId === worker.currentItemId && task.status === "running",
    );

    if (currentTask) {
      return currentTask;
    }
  }

  return (
    tasks.find(
      (task) =>
        task.status === "running" &&
        (task.assignedWorkerId === worker.workerId ||
          task.assignedExecutorWidgetId === worker.workerId),
    ) ?? null
  );
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
