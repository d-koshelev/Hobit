import type { AgentQueueTask } from "../../workspace/types";
import {
  displayTaskTitle,
  getQueueTaskDependencyState,
  normalizeCoordinatorStatus,
  normalizeQueueTag,
  normalizeTaskPriority,
  normalizeValidationStatus,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "../agentQueueTaskUiModel";
import {
  queueV2NextActionForTask,
  type QueueNextAction,
} from "./queueV2NextActionModel";
import {
  queueV2ClosureStateForTask,
  queueV2LifecycleForTask,
  type QueueTaskClosureState,
  type QueueTaskLifecycle,
} from "./queueV2LifecycleModel";

export type QueueBoardLane =
  | "intake_draft"
  | "ready"
  | "running"
  | "review"
  | "blocked"
  | "closed";

export type QueueBlockedReasonCode =
  | "queue_disabled" | "not_ready_lifecycle"
  | "dependency_open" | "dependency_failed_or_rejected" | "dependency_graph_invalid"
  | "capacity_unavailable" | "runtime_unavailable"
  | "run_settings_invalid"
  | "context_missing" | "context_invalid"
  | "worker_paused" | "tag_paused" | "safety_blocker" | "operator_review_required";

export type QueueBlockedReason = {
  code: QueueBlockedReasonCode;
  label: string;
  source?: string;
};

export type QueueTaskEligibility = {
  taskId: string;
  eligibleNow: boolean;
  lifecycleOk: boolean;
  queueEnabled: boolean;
  dependencyOk: boolean;
  capacityOk: boolean;
  runSettingsOk: boolean;
  contextOk: boolean;
  tagOrWorkerOk: boolean;
  safetyOk: boolean;
  compatibleWorkerIds: string[];
  blockedReasons: QueueBlockedReason[];
  dryRunPosition: number | null;
};

export type QueueWorkerSnapshot = {
  workerId: string;
  label: string;
  kind: "agent_executor" | "provider";
  capacity: number;
  runningCount: number;
  availableCount: number;
  paused: boolean;
  unavailableReason: string | null;
  compatibleTags: string[];
  currentTaskIds: string[];
};

export type QueueWorkerCapacity = {
  queueEnabled: boolean;
  autorunArmed: boolean;
  totalSlots: number;
  availableSlots: number;
  runningSlots: number;
  pausedSlots: number;
  unavailableSlots: number;
  workers: QueueWorkerSnapshot[];
  pausedTags: string[];
  eligibleNowCount: number;
  reviewNeededCount: number;
};

export type QueueTaskViewModel = {
  task: AgentQueueTask;
  taskId: string;
  title: string;
  lifecycle: QueueTaskLifecycle;
  closureState: QueueTaskClosureState | null;
  boardLane: QueueBoardLane;
  nextAction: QueueNextAction;
  blockedReasons: QueueBlockedReason[];
  eligibility: QueueTaskEligibility;
};

export type QueueInspectorSnapshot = {
  taskId: string;
  title: string;
  objective: string;
  lifecycle: QueueTaskLifecycle;
  closureState: QueueTaskClosureState | null;
  boardLane: QueueBoardLane;
  priority: number;
  nextAction: QueueNextAction;
  secondaryActions: QueueNextAction[];
  dependencyState: AgentQueueDependencyState;
  eligibility: QueueTaskEligibility;
  blockedReasons: QueueBlockedReason[];
  workerAssignment: {
    assignedWorkerId: string | null;
    assignedExecutorWidgetId: string | null;
    compatibleWorkerIds: string[];
  };
  runSummary: {
    latestRunId: string | null;
    latestRunStatus: string | null;
    reportCount: number;
  };
  reportSummary: string | null;
  reviewDecisionState: QueueTaskClosureState | "review_open" | "none";
  contextSummary: {
    attachedKnowledgeCount: number;
    attachedSkillCount: number;
    warningCount: number;
    overBudget: boolean;
  };
  attachmentSummary: string;
  sourceRefSummary: string | null;
  activityGroupIds: string[];
};

export type QueueV2ViewModel = {
  tasks: QueueTaskViewModel[];
  lanes: Record<QueueBoardLane, QueueTaskViewModel[]>;
  counts: { reviewNeeded: number; eligibleNow: number; running: number };
  capacity: QueueWorkerCapacity;
  inspector: QueueInspectorSnapshot | null;
};

export type QueueV2ViewModelInput = {
  tasks: readonly AgentQueueTask[];
  selectedTaskId?: string | null;
  workers?: readonly AgentWorkerSummary[];
  globalExecutionState?: QueueGlobalStatus;
  autorunArmed?: boolean;
  pausedQueueTagIds?: ReadonlySet<string>;
};

export function selectQueueV2ViewModel({
  autorunArmed = false,
  globalExecutionState = "started",
  pausedQueueTagIds = new Set(),
  selectedTaskId = null,
  tasks,
  workers = [],
}: QueueV2ViewModelInput): QueueV2ViewModel {
  const queueEnabled = globalExecutionState === "started";
  const dependencyStates = new Map(
    tasks.map((task) => [
      task.queueItemId,
      getQueueTaskDependencyState(task, [...tasks]),
    ]),
  );

  const firstPass = tasks.map((task) => {
    const dependencyState = dependencyStates.get(task.queueItemId)!;
    const lifecycle = queueV2LifecycleForTask(task);
    const closureState = queueV2ClosureStateForTask(task);
    const blockedReasons = queueV2BlockedReasonsForTask({
      dependencyState,
      lifecycle,
      pausedQueueTagIds,
      queueEnabled,
      task,
      workers,
    });
    const eligibility = queueV2EligibilityForTask({
      blockedReasons,
      lifecycle,
      queueEnabled,
      task,
      workers,
    });
    const boardLane = queueV2BoardLaneForTask({
      blockedReasons,
      hasReviewableOutput: taskHasReviewableOutput(task),
      lifecycle,
    });
    const nextAction = queueV2NextActionForTask({
      blockedReasonCodes: blockedReasons.map((reason) => reason.code),
      eligibleNow: eligibility.eligibleNow,
      hasAssignedWorker: Boolean(
        task.assignedWorkerId ?? task.assignedExecutorWidgetId,
      ),
      hasReviewableOutput: taskHasReviewableOutput(task),
      lifecycle,
      reviewActionHint: queueV2ReviewActionHintForTask(task),
    });

    return {
      boardLane,
      blockedReasons,
      closureState,
      eligibility,
      lifecycle,
      nextAction,
      task,
      taskId: task.queueItemId,
      title: displayTaskTitle(task),
    } satisfies QueueTaskViewModel;
  });
  const eligibleTaskIds = new Set(
    firstPass
      .filter((item) => item.eligibility.eligibleNow)
      .map((item) => item.taskId),
  );
  let dryRunPosition = 0;
  const taskViewModels = firstPass.map((item) => ({
    ...item,
    eligibility: {
      ...item.eligibility,
      dryRunPosition: eligibleTaskIds.has(item.taskId) ? dryRunPosition++ : null,
    },
  }));
  const reviewNeeded = taskViewModels.filter(
    (item) =>
      item.lifecycle === "report_ready" ||
      item.lifecycle === "review_required" ||
      (item.lifecycle === "failed" && taskHasReviewableOutput(item.task)),
  ).length;
  const eligibleNow = taskViewModels.filter(
    (item) => item.eligibility.eligibleNow,
  ).length;
  const running = taskViewModels.filter(
    (item) => item.lifecycle === "running",
  ).length;

  return {
    capacity: queueV2CapacitySummary({
      autorunArmed,
      eligibleNowCount: eligibleNow,
      queueEnabled,
      reviewNeededCount: reviewNeeded,
      workers,
    }),
    counts: {
      eligibleNow,
      reviewNeeded,
      running,
    },
    inspector: selectedTaskId
      ? queueV2InspectorSnapshot(
          taskViewModels.find((item) => item.taskId === selectedTaskId) ?? null,
          dependencyStates,
        )
      : null,
    lanes: groupQueueV2TasksByLane(taskViewModels),
    tasks: taskViewModels,
  };
}

export function queueV2BoardLaneForTask({
  blockedReasons,
  hasReviewableOutput,
  lifecycle,
}: {
  blockedReasons: readonly QueueBlockedReason[];
  hasReviewableOutput: boolean;
  lifecycle: QueueTaskLifecycle;
}): QueueBoardLane {
  if (lifecycle === "finalized") {
    return "closed";
  }
  if (lifecycle === "running") {
    return "running";
  }
  if (lifecycle === "report_ready" || lifecycle === "review_required") {
    return "review";
  }
  if (lifecycle === "failed") {
    return hasReviewableOutput ? "review" : "blocked";
  }
  if (blockedReasons.length > 0 || lifecycle === "blocked") {
    return "blocked";
  }
  if (lifecycle === "draft") {
    return "intake_draft";
  }
  if (lifecycle === "queued" || lifecycle === "ready") {
    return "ready";
  }
  if (lifecycle === "cancelled") {
    return hasReviewableOutput ? "review" : "closed";
  }
  return "blocked";
}

function queueV2BlockedReasonsForTask({
  dependencyState,
  lifecycle,
  pausedQueueTagIds,
  queueEnabled,
  task,
  workers,
}: {
  dependencyState: AgentQueueDependencyState;
  lifecycle: QueueTaskLifecycle;
  pausedQueueTagIds: ReadonlySet<string>;
  queueEnabled: boolean;
  task: AgentQueueTask;
  workers: readonly AgentWorkerSummary[];
}): QueueBlockedReason[] {
  const reasons: QueueBlockedReason[] = [];

  if (!queueEnabled && (lifecycle === "queued" || lifecycle === "ready")) {
    reasons.push(reason("queue_disabled"));
  }

  if (dependencyState.status === "invalid") {
    reasons.push(reason("dependency_graph_invalid"));
  } else if (dependencyState.status === "blocked") {
    reasons.push(reason("dependency_open"));
  }

  if (lifecycle === "queued" || lifecycle === "ready") {
    if (!task.prompt.trim()) {
      reasons.push(reason("run_settings_invalid", "Task prompt is empty"));
    }

    if (normalizeValidationStatus(task.validationStatus) === "validating") {
      reasons.push(reason("operator_review_required", "Validation is running"));
    }

    const context = task.context;
    if (context?.contextTokenBudget.overBudget) {
      reasons.push(reason("context_invalid", "Attached context is over budget"));
    }
    if (
      context?.contextWarnings.some((warning) => warning.severity === "blocked")
    ) {
      reasons.push(reason("context_invalid"));
    }

    const queueTag = normalizeQueueTag(task);
    if (pausedQueueTagIds.has(queueTag.queueTagId)) {
      reasons.push(reason("tag_paused"));
    }

    const compatibleWorkers = compatibleQueueV2Workers(task, workers);
    if (workers.length === 0) {
      reasons.push(reason("runtime_unavailable"));
    } else if (compatibleWorkers.length === 0) {
      const hasPausedCompatibleWorker = workers.some(
        (worker) =>
          workerMatchesTaskTag(worker, task) &&
          (!worker.enabled || worker.status === "paused"),
      );
      reasons.push(
        hasPausedCompatibleWorker
          ? reason("worker_paused")
          : reason("capacity_unavailable"),
      );
    }
  }

  if (lifecycle === "review_required") {
    reasons.push(reason("operator_review_required"));
  }

  if (
    normalizeCoordinatorStatus(task.coordinatorStatus) === "blocked" ||
    task.closureState === "closure_blocked"
  ) {
    reasons.push(reason("safety_blocker"));
  }

  return dedupeReasons(reasons);
}

function queueV2EligibilityForTask({
  blockedReasons,
  lifecycle,
  queueEnabled,
  task,
  workers,
}: {
  blockedReasons: readonly QueueBlockedReason[];
  lifecycle: QueueTaskLifecycle;
  queueEnabled: boolean;
  task: AgentQueueTask;
  workers: readonly AgentWorkerSummary[];
}): QueueTaskEligibility {
  const blockedCodes = new Set(blockedReasons.map((item) => item.code));
  const lifecycleOk = lifecycle === "queued" || lifecycle === "ready";
  const compatibleWorkerIds = compatibleQueueV2Workers(task, workers).map(
    (worker) => worker.workerId,
  );
  const dependencyOk =
    !blockedCodes.has("dependency_open") &&
    !blockedCodes.has("dependency_failed_or_rejected") &&
    !blockedCodes.has("dependency_graph_invalid");
  const capacityOk =
    !blockedCodes.has("capacity_unavailable") &&
    !blockedCodes.has("runtime_unavailable");
  const runSettingsOk = !blockedCodes.has("run_settings_invalid");
  const contextOk =
    !blockedCodes.has("context_missing") && !blockedCodes.has("context_invalid");
  const tagOrWorkerOk =
    !blockedCodes.has("worker_paused") && !blockedCodes.has("tag_paused");
  const safetyOk =
    !blockedCodes.has("safety_blocker") &&
    !blockedCodes.has("operator_review_required");

  return {
    blockedReasons: [...blockedReasons],
    capacityOk,
    compatibleWorkerIds,
    contextOk,
    dependencyOk,
    dryRunPosition: null,
    eligibleNow:
      lifecycleOk &&
      queueEnabled &&
      dependencyOk &&
      capacityOk &&
      runSettingsOk &&
      contextOk &&
      tagOrWorkerOk &&
      safetyOk &&
      compatibleWorkerIds.length > 0,
    lifecycleOk,
    queueEnabled,
    runSettingsOk,
    safetyOk,
    tagOrWorkerOk,
    taskId: task.queueItemId,
  };
}

function queueV2CapacitySummary({
  autorunArmed,
  eligibleNowCount,
  queueEnabled,
  reviewNeededCount,
  workers,
}: {
  autorunArmed: boolean;
  eligibleNowCount: number;
  queueEnabled: boolean;
  reviewNeededCount: number;
  workers: readonly AgentWorkerSummary[];
}): QueueWorkerCapacity {
  const workerSnapshots = workers.map((worker) => {
    const paused = !worker.enabled || worker.status === "paused";
    const running = worker.status === "running";

    return {
      availableCount: !paused && !running ? 1 : 0,
      capacity: 1,
      compatibleTags:
        worker.scope.kind === "queue_tag" ? [worker.scope.queueTagId] : ["*"],
      currentTaskIds: worker.currentItemId ? [worker.currentItemId] : [],
      kind: "agent_executor" as const,
      label: worker.name,
      paused,
      runningCount: running ? 1 : 0,
      unavailableReason: paused
        ? "Worker is paused or disabled"
        : running
          ? "Worker is running a task"
          : null,
      workerId: worker.workerId,
    };
  });

  return {
    autorunArmed,
    availableSlots: workerSnapshots.reduce(
      (sum, worker) => sum + worker.availableCount,
      0,
    ),
    eligibleNowCount,
    pausedSlots: workerSnapshots.filter((worker) => worker.paused).length,
    pausedTags: [],
    queueEnabled,
    reviewNeededCount,
    runningSlots: workerSnapshots.reduce(
      (sum, worker) => sum + worker.runningCount,
      0,
    ),
    totalSlots: workerSnapshots.length,
    unavailableSlots: workerSnapshots.filter(
      (worker) => worker.unavailableReason !== null && !worker.paused,
    ).length,
    workers: workerSnapshots,
  };
}

function queueV2InspectorSnapshot(
  viewModel: QueueTaskViewModel | null,
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>,
): QueueInspectorSnapshot | null {
  if (!viewModel) {
    return null;
  }

  const { task } = viewModel;
  const latestReport =
    task.workerExecutionReports?.[task.workerExecutionReports.length - 1] ?? null;

  return {
    activityGroupIds: [
      `queue-v2:${task.queueItemId}:lifecycle`,
      ...(latestReport ? [`queue-v2:${task.queueItemId}:run`] : []),
    ],
    attachmentSummary: `${task.context?.attachedKnowledgeRefs.length ?? 0} knowledge, ${
      task.context?.attachedSkillRefs.length ?? 0
    } skills`,
    blockedReasons: viewModel.blockedReasons,
    boardLane: viewModel.boardLane,
    closureState: viewModel.closureState,
    contextSummary: {
      attachedKnowledgeCount: task.context?.attachedKnowledgeRefs.length ?? 0,
      attachedSkillCount: task.context?.attachedSkillRefs.length ?? 0,
      overBudget: task.context?.contextTokenBudget.overBudget ?? false,
      warningCount: task.context?.contextWarnings.length ?? 0,
    },
    dependencyState:
      dependencyStates.get(task.queueItemId) ??
      getQueueTaskDependencyState(task, [task]),
    eligibility: viewModel.eligibility,
    lifecycle: viewModel.lifecycle,
    nextAction: viewModel.nextAction,
    objective: task.description.trim() || task.prompt.trim(),
    priority: normalizeTaskPriority(task.priority),
    reportSummary: latestReport?.summary ?? null,
    reviewDecisionState:
      viewModel.closureState ??
      (taskHasReviewableOutput(task) ? "review_open" : "none"),
    runSummary: {
      latestRunId: latestReport?.reportId ?? null,
      latestRunStatus: latestReport?.reportStatus ?? null,
      reportCount: task.workerExecutionReports?.length ?? 0,
    },
    secondaryActions: secondaryActionsForTask(viewModel),
    sourceRefSummary: task.diffReview?.sourceItemId ?? null,
    taskId: task.queueItemId,
    title: viewModel.title,
    workerAssignment: {
      assignedExecutorWidgetId: task.assignedExecutorWidgetId,
      assignedWorkerId: task.assignedWorkerId ?? null,
      compatibleWorkerIds: viewModel.eligibility.compatibleWorkerIds,
    },
  };
}

function groupQueueV2TasksByLane(taskViewModels: QueueTaskViewModel[]) {
  const lanes: Record<QueueBoardLane, QueueTaskViewModel[]> = {
    blocked: [],
    closed: [],
    intake_draft: [],
    ready: [],
    review: [],
    running: [],
  };

  for (const taskViewModel of taskViewModels) {
    lanes[taskViewModel.boardLane].push(taskViewModel);
  }

  return lanes;
}

function compatibleQueueV2Workers(
  task: AgentQueueTask,
  workers: readonly AgentWorkerSummary[],
) {
  const assignedWorkerId = task.assignedWorkerId ?? task.assignedExecutorWidgetId;

  return workers.filter((worker) => {
    if (assignedWorkerId && worker.workerId !== assignedWorkerId) {
      return false;
    }

    return (
      worker.enabled &&
      worker.status === "idle" &&
      workerMatchesTaskTag(worker, task)
    );
  });
}

function workerMatchesTaskTag(worker: AgentWorkerSummary, task: AgentQueueTask) {
  const queueTag = normalizeQueueTag(task);

  return (
    worker.scope.kind === "all" || worker.scope.queueTagId === queueTag.queueTagId
  );
}

function taskHasReviewableOutput(task: AgentQueueTask) {
  return (
    (task.workerExecutionReports?.length ?? 0) > 0 ||
    task.status === "completed" ||
    task.status === "review_needed"
  );
}

function queueV2ReviewActionHintForTask(
  task: AgentQueueTask,
): "request_changes" | "create_follow_up" | null {
  switch (normalizeCoordinatorStatus(task.coordinatorStatus)) {
    case "needs_changes":
      return "request_changes";
    case "follow_up_required":
      return "create_follow_up";
    default:
      return null;
  }
}

function secondaryActionsForTask(
  viewModel: QueueTaskViewModel,
): QueueNextAction[] {
  if (
    viewModel.lifecycle === "report_ready" ||
    viewModel.lifecycle === "review_required"
  ) {
    return ["accept_result", "request_changes", "create_follow_up", "reject_result"];
  }

  if (viewModel.lifecycle === "failed") {
    return ["review_report", "retry_or_rerun"];
  }

  return [];
}

function reason(
  code: QueueBlockedReasonCode,
  label = defaultBlockedReasonLabel(code),
): QueueBlockedReason {
  return { code, label };
}

function dedupeReasons(reasons: QueueBlockedReason[]) {
  const seen = new Set<QueueBlockedReasonCode>();
  const deduped: QueueBlockedReason[] = [];

  for (const item of reasons) {
    if (!seen.has(item.code)) {
      seen.add(item.code);
      deduped.push(item);
    }
  }

  return deduped;
}

function defaultBlockedReasonLabel(code: QueueBlockedReasonCode) {
  switch (code) {
    case "queue_disabled":
      return "Queue is disabled";
    case "not_ready_lifecycle":
      return "Task is not ready to run";
    case "dependency_open":
      return "Dependency is still open";
    case "dependency_failed_or_rejected":
      return "Dependency failed or was rejected";
    case "dependency_graph_invalid":
      return "Dependency graph is invalid";
    case "capacity_unavailable":
      return "No compatible worker capacity is available";
    case "run_settings_invalid":
      return "Run settings are incomplete";
    case "context_missing":
      return "Required context is missing";
    case "context_invalid":
      return "Attached context is blocked";
    case "worker_paused":
      return "Compatible worker is paused";
    case "tag_paused":
      return "Queue tag is paused";
    case "safety_blocker":
      return "Safety review blocks this task";
    case "operator_review_required":
      return "Operator review is required";
    case "runtime_unavailable":
      return "No visible worker runtime is available";
  }
}
