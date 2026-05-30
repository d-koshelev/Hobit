import type { AgentQueueTask } from "../../workspace/types";
import {
  displayTaskTitle,
  isFinalQueueTaskStatus,
  queueGlobalExecutionStateAllowsScheduling,
  queueGlobalExecutionStateLabel,
  queueDependencyStatesByTask,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "../agentQueueTaskUiModel";
import {
  getEligibleItemsForWorker,
  getWorkerItemBlockedReasons,
  routingBlockedReasonLabel,
  type AgentQueueRoutingBlockedReasonCode,
} from "./agentQueueRoutingModel";

export type AgentQueueSchedulerGlobalState = {
  allowsScheduling: boolean;
  affectedRunningItemIds: string[];
  code: QueueGlobalStatus;
  explanation: string;
  label: "START" | "STOP" | "STOP + KILL RUNNING";
  runningItemCount: number;
};

export type AgentQueueSchedulerBlockedReasonCode =
  | AgentQueueRoutingBlockedReasonCode
  | "assigned_worker_disabled"
  | "no_available_worker"
  | "no_worker_configured"
  | "worker_already_running";

export type AgentQueueSchedulerBlockedReason = {
  code: AgentQueueSchedulerBlockedReasonCode;
  label: string;
};

export type AgentQueueSchedulerRecommendation = {
  explanation: string;
  queueItemId: string;
  title: string;
  workerId: string;
  workerName: string;
};

export type AgentQueueWorkerPlan = {
  bestNextItem: AgentQueueSchedulerRecommendation | null;
  blockedReasonSummary: string | null;
  eligibleItemCount: number;
  idleReason: string | null;
  isAvailable: boolean;
  workerId: string;
  workerName: string;
};

export type AgentQueueItemEligibility = {
  blockedReasons: AgentQueueSchedulerBlockedReason[];
  eligibleWorkerIds: string[];
  eligibleWorkerNames: string[];
  isSchedulable: boolean;
  queueItemId: string;
  title: string;
};

export type AgentQueueBlockedItemSummary = {
  explanation: string;
  queueItemId: string;
  reasonCodes: AgentQueueSchedulerBlockedReasonCode[];
  reasonLabels: string[];
  title: string;
};

export type AgentQueueSchedulerPlan = {
  blockedItems: AgentQueueBlockedItemSummary[];
  explanation: string;
  globalState: AgentQueueSchedulerGlobalState;
  itemEligibility: AgentQueueItemEligibility[];
  recommendations: AgentQueueSchedulerRecommendation[];
  schedulableItemCount: number;
  topBlockedReasons: Array<{
    code: AgentQueueSchedulerBlockedReasonCode;
    count: number;
    label: string;
  }>;
  unassignedEligibleItems: AgentQueueItemEligibility[];
  workerPlans: AgentQueueWorkerPlan[];
};

export type BuildAgentQueueSchedulerPlanInput = {
  dependencyStates?: ReadonlyMap<string, AgentQueueDependencyState>;
  globalExecutionState: QueueGlobalStatus;
  pausedQueueTagIds?: ReadonlySet<string>;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

export function buildAgentQueueSchedulerPlan({
  dependencyStates,
  globalExecutionState,
  pausedQueueTagIds = new Set(),
  tasks,
  workers,
}: BuildAgentQueueSchedulerPlanInput): AgentQueueSchedulerPlan {
  const resolvedDependencyStates =
    dependencyStates ?? queueDependencyStatesByTask(tasks);
  const globalState = schedulerGlobalState({
    globalExecutionState,
    tasks,
  });
  const routingContext = {
    dependencyStates: resolvedDependencyStates,
    globalExecutionState,
    pausedQueueTagIds,
    tasks,
  };

  const workerPlans = workers
    .slice()
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .map((worker): AgentQueueWorkerPlan => {
      const isAvailable =
        globalState.allowsScheduling && worker.enabled && worker.status !== "running";
      const eligibleItems = isAvailable
        ? getEligibleItemsForWorker(worker, tasks, routingContext)
        : [];
      const bestNextTask = eligibleItems[0] ?? null;
      const bestNextItem = bestNextTask
        ? {
            explanation: `${worker.name} would take ${displayTaskTitle(
              bestNextTask,
            )}.`,
            queueItemId: bestNextTask.queueItemId,
            title: displayTaskTitle(bestNextTask),
            workerId: worker.workerId,
            workerName: worker.name,
          }
        : null;

      return {
        bestNextItem,
        blockedReasonSummary: bestNextItem
          ? null
          : workerBlockedReasonSummary({
              globalState,
              tasks,
              worker,
              routingContext,
            }),
        eligibleItemCount: eligibleItems.length,
        idleReason: bestNextItem
          ? null
          : workerIdleReason({
              globalState,
              tasks,
              worker,
              routingContext,
            }),
        isAvailable,
        workerId: worker.workerId,
        workerName: worker.name,
      };
    });

  const itemEligibility = tasks.map((task): AgentQueueItemEligibility => {
    const workerResults = workers.map((worker) => {
      const routingReasons = getWorkerItemBlockedReasons(
        worker,
        task,
        routingContext,
      );
      const schedulerReasons = worker.status === "running"
        ? [schedulerReason("worker_already_running")]
        : [];

      return {
        reasons: [...routingReasons.map(toSchedulerReason), ...schedulerReasons],
        worker,
      };
    });
    const eligibleWorkers = globalState.allowsScheduling
      ? workerResults
          .filter(
            ({ reasons, worker }) =>
              worker.enabled && worker.status !== "running" && reasons.length === 0,
          )
          .map(({ worker }) => worker)
      : [];
    const blockedReasons = uniqueSchedulerReasons([
      ...workerResults.flatMap(({ reasons }) => reasons),
      ...itemLevelSchedulerReasons({
        task,
        workers,
      }),
    ]);

    return {
      blockedReasons,
      eligibleWorkerIds: eligibleWorkers.map((worker) => worker.workerId),
      eligibleWorkerNames: eligibleWorkers.map((worker) => worker.name),
      isSchedulable: eligibleWorkers.length > 0,
      queueItemId: task.queueItemId,
      title: displayTaskTitle(task),
    };
  });

  const blockedItems = itemEligibility
    .filter((eligibility) => {
      const task = tasks.find(
        (candidate) => candidate.queueItemId === eligibility.queueItemId,
      );

      return task && !isFinalQueueTaskStatus(task.status) && !eligibility.isSchedulable;
    })
    .map(
      (eligibility): AgentQueueBlockedItemSummary => ({
        explanation:
          eligibility.blockedReasons[0]?.label ??
          "No available worker can take this item",
        queueItemId: eligibility.queueItemId,
        reasonCodes: eligibility.blockedReasons.map((reason) => reason.code),
        reasonLabels: eligibility.blockedReasons.map((reason) => reason.label),
        title: eligibility.title,
      }),
    );
  const recommendations = workerPlans
    .map((workerPlan) => workerPlan.bestNextItem)
    .filter(
      (
        recommendation,
      ): recommendation is AgentQueueSchedulerRecommendation =>
        Boolean(recommendation),
    );

  return {
    blockedItems,
    explanation: planExplanation(globalState, recommendations.length),
    globalState,
    itemEligibility,
    recommendations,
    schedulableItemCount: itemEligibility.filter(
      (eligibility) => eligibility.isSchedulable,
    ).length,
    topBlockedReasons: topBlockedReasons(blockedItems),
    unassignedEligibleItems: itemEligibility.filter((eligibility) => {
      const task = tasks.find(
        (candidate) => candidate.queueItemId === eligibility.queueItemId,
      );
      const assignedWorkerId =
        task?.assignedWorkerId ?? task?.assignedExecutorWidgetId;

      return eligibility.isSchedulable && !assignedWorkerId;
    }),
    workerPlans,
  };
}

export function schedulerBlockedReasonLabel(
  code: AgentQueueSchedulerBlockedReasonCode,
) {
  return schedulerReason(code).label;
}

function schedulerGlobalState({
  globalExecutionState,
  tasks,
}: {
  globalExecutionState: QueueGlobalStatus;
  tasks: AgentQueueTask[];
}): AgentQueueSchedulerGlobalState {
  const affectedRunningItemIds = tasks
    .filter((task) => task.status === "running")
    .map((task) => task.queueItemId);

  if (globalExecutionState === "stop_kill_requested") {
    return {
      affectedRunningItemIds,
      allowsScheduling: false,
      code: globalExecutionState,
      explanation:
        "STOP + KILL RUNNING requested. No new work is recommended; affected running items need Agent Executor and coordinator review.",
      label: queueGlobalExecutionStateLabel(globalExecutionState),
      runningItemCount: affectedRunningItemIds.length,
    };
  }

  if (!queueGlobalExecutionStateAllowsScheduling(globalExecutionState)) {
    return {
      affectedRunningItemIds,
      allowsScheduling: false,
      code: globalExecutionState,
      explanation: "Queue is stopped. No new work is recommended.",
      label: queueGlobalExecutionStateLabel(globalExecutionState),
      runningItemCount: affectedRunningItemIds.length,
    };
  }

  return {
    affectedRunningItemIds,
    allowsScheduling: true,
    code: globalExecutionState,
    explanation:
      "START is active. Dry-run recommendations show what would run without starting work.",
    label: queueGlobalExecutionStateLabel(globalExecutionState),
    runningItemCount: affectedRunningItemIds.length,
  };
}

function workerBlockedReasonSummary({
  globalState,
  routingContext,
  tasks,
  worker,
}: {
  globalState: AgentQueueSchedulerGlobalState;
  routingContext: Parameters<typeof getWorkerItemBlockedReasons>[2];
  tasks: AgentQueueTask[];
  worker: AgentWorkerSummary;
}) {
  if (!globalState.allowsScheduling) {
    return globalState.explanation;
  }

  if (!worker.enabled) {
    return schedulerBlockedReasonLabel("worker_disabled");
  }

  if (worker.status === "running") {
    return schedulerBlockedReasonLabel("worker_already_running");
  }

  const uniqueReasons = uniqueSchedulerReasons(
    tasks.flatMap((task) =>
      getWorkerItemBlockedReasons(worker, task, routingContext).map(
        toSchedulerReason,
      ),
    ),
  );

  return (
    uniqueReasons
      .slice(0, 2)
      .map((reason) => reason.label)
      .join("; ") || "No eligible item"
  );
}

function workerIdleReason({
  globalState,
  routingContext,
  tasks,
  worker,
}: {
  globalState: AgentQueueSchedulerGlobalState;
  routingContext: Parameters<typeof getWorkerItemBlockedReasons>[2];
  tasks: AgentQueueTask[];
  worker: AgentWorkerSummary;
}) {
  if (!globalState.allowsScheduling) {
    return globalState.code === "stop_kill_requested"
      ? "STOP + KILL RUNNING requested"
      : "Queue is stopped";
  }

  if (!worker.enabled) {
    return "Worker is disabled";
  }

  if (worker.status === "running") {
    return "Worker is already running an item";
  }

  return workerBlockedReasonSummary({
    globalState,
    routingContext,
    tasks,
    worker,
  });
}

function itemLevelSchedulerReasons({
  task,
  workers,
}: {
  task: AgentQueueTask;
  workers: AgentWorkerSummary[];
}) {
  const reasons: AgentQueueSchedulerBlockedReason[] = [];
  const assignedWorkerId = task.assignedWorkerId ?? task.assignedExecutorWidgetId;

  if (workers.length === 0) {
    reasons.push(schedulerReason("no_worker_configured"));
  }

  if (assignedWorkerId) {
    const assignedWorker =
      workers.find((worker) => worker.workerId === assignedWorkerId) ?? null;

    if (assignedWorker && !assignedWorker.enabled) {
      reasons.push(schedulerReason("assigned_worker_disabled"));
    }
  }

  return reasons;
}

function topBlockedReasons(blockedItems: AgentQueueBlockedItemSummary[]) {
  const counts = new Map<AgentQueueSchedulerBlockedReasonCode, number>();

  for (const item of blockedItems) {
    const firstReasonCode = item.reasonCodes[0] ?? "no_available_worker";
    counts.set(firstReasonCode, (counts.get(firstReasonCode) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(
      ([firstCode, firstCount], [secondCode, secondCount]) =>
        secondCount - firstCount || firstCode.localeCompare(secondCode),
    )
    .slice(0, 3)
    .map(([code, count]) => ({
      code,
      count,
      label: schedulerBlockedReasonLabel(code),
    }));
}

function planExplanation(
  globalState: AgentQueueSchedulerGlobalState,
  recommendationCount: number,
) {
  if (!globalState.allowsScheduling) {
    return `${globalState.explanation} Dry-run only; no work is started.`;
  }

  if (recommendationCount === 0) {
    return "START is active, but no worker has an eligible next item. Dry-run only; no work is started.";
  }

  return `START is active. ${recommendationCount.toString()} worker recommendation${
    recommendationCount === 1 ? "" : "s"
  } available. Dry-run only; no work is started.`;
}

function toSchedulerReason(reason: {
  code: AgentQueueRoutingBlockedReasonCode;
}): AgentQueueSchedulerBlockedReason {
  return schedulerReason(reason.code);
}

function uniqueSchedulerReasons(
  reasons: AgentQueueSchedulerBlockedReason[],
) {
  const byCode = new Map<AgentQueueSchedulerBlockedReasonCode, AgentQueueSchedulerBlockedReason>();

  for (const reason of reasons) {
    byCode.set(reason.code, reason);
  }

  return Array.from(byCode.values());
}

function schedulerReason(
  code: AgentQueueSchedulerBlockedReasonCode,
): AgentQueueSchedulerBlockedReason {
  switch (code) {
    case "assigned_worker_disabled":
      return { code, label: "Assigned worker is disabled" };
    case "item_awaiting_coordinator_review":
      return { code, label: "Awaiting coordinator review" };
    case "item_dependency_graph_invalid":
      return { code, label: "Dependency graph is invalid" };
    case "item_missing_prompt":
      return { code, label: "Missing prompt" };
    case "item_validation_in_progress":
      return { code, label: "Validation is in progress" };
    case "no_available_worker":
      return { code, label: "No available worker can take this item" };
    case "no_worker_configured":
      return { code, label: "No worker configured" };
    case "queue_stopped":
      return { code, label: "Queue is stopped" };
    case "queue_stop_kill_requested":
      return { code, label: "Stop + kill running requested" };
    case "queue_tag_paused":
      return { code, label: "Tag is paused" };
    case "worker_already_running":
      return { code, label: "Worker is already running an item" };
    case "worker_disabled":
      return { code, label: "Worker is disabled" };
    case "worker_scope_mismatch":
      return { code, label: "Worker scoped to another tag" };
    case "waiting_for_dependencies":
      return { code, label: "Waiting for dependencies" };
    default:
      return {
        code,
        label: routingBlockedReasonLabel(code),
      };
  }
}
