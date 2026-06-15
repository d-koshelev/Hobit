import type { AgentQueueTask } from "../../workspace/types";
import { getQueuePromptPackImportMetadata } from "../promptPack/queuePromptPackMetadata";
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
import { queueV2NextActionForTask, type QueueNextAction } from "./queueV2NextActionModel";
import { diffReviewLinkageViewForTask, type DiffReviewLinkageView } from "./agentQueueDiffReviewModel";
import {
  queueV2ClosureStateForTask,
  queueV2LifecycleForTask,
  type QueueTaskClosureState,
  type QueueTaskLifecycle,
} from "./queueV2LifecycleModel";
import {
  prioritizeQueueV2BlockedReasons,
  queueV2BlockedReason,
  queueV2BlockerSummaryForTask,
  type QueueBlockedReasonCode,
  type QueueBlockedReason,
  type QueueBlockerSummary,
} from "./queueV2BlockerSummary";
import {
  queueV2ReviewActionHintForTask,
  secondaryActionsForTask,
} from "./queueV2ReviewActionModel";
import {
  queueV2DependencySummaryForTask,
  queueV2HumanStatusForTask,
  type QueueTaskDependencySummary,
  type QueueTaskHumanStatusView,
} from "./queueV2SmartStatusModel";

export type QueueBoardLane =
  | "intake_draft"
  | "ready"
  | "waiting_dependency"
  | "running"
  | "review"
  | "blocked"
  | "closed";
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
  humanStatus: QueueTaskHumanStatusView;
  dependencySummary: QueueTaskDependencySummary;
  blockedReasons: QueueBlockedReason[];
  blockerSummary: QueueBlockerSummary;
  eligibility: QueueTaskEligibility;
  diffReview: DiffReviewLinkageView;
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
  humanStatus: QueueTaskHumanStatusView;
  dependencySummary: QueueTaskDependencySummary;
  secondaryActions: QueueNextAction[];
  dependencyState: AgentQueueDependencyState;
  eligibility: QueueTaskEligibility;
  blockedReasons: QueueBlockedReason[];
  blockerSummary: QueueBlockerSummary;
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
    const dependencySummary = queueV2DependencySummaryForTask(task, tasks);
    const lifecycle = queueV2LifecycleForTask(task);
    const closureState = queueV2ClosureStateForTask(task);
    const promptPackMetadata = getQueuePromptPackImportMetadata(task);
    const blockedReasons = queueV2BlockedReasonsForTask({
      dependencyState,
      dependencySummary,
      lifecycle,
      pausedQueueTagIds,
      queueEnabled,
      task,
      workers,
    });
    const eligibility = queueV2EligibilityForTask({
      blockedReasons,
      dependencySummary,
      lifecycle,
      queueEnabled,
      task,
      workers,
    });
    const boardLane = queueV2BoardLaneForTask({
      blockedReasons,
      dependencySummary,
      hasReviewableOutput: taskHasReviewableOutput(task),
      lifecycle,
    });
    const humanStatus = queueV2HumanStatusForTask({
      boardLane,
      blockedReasons,
      dependencySummary,
      lifecycle,
      task,
    });
    const nextAction =
      dependencySummary.gate === "waiting"
        ? "resolve_dependency"
        : queueV2NextActionForTask({
            blockedReasonCodes: blockedReasons.map((reason) => reason.code),
            canQueueDraft: Boolean(promptPackMetadata && task.prompt.trim()),
            eligibleNow: eligibility.eligibleNow,
            hasAssignedWorker: Boolean(
              task.assignedWorkerId ?? task.assignedExecutorWidgetId,
            ),
            hasReviewableOutput: taskHasReviewableOutput(task),
            lifecycle,
            reviewActionHint: queueV2ReviewActionHintForTask(task),
          });
    const blockerSummary = queueV2BlockerSummaryForTask({
      blockedReasons,
      dependencyState,
      nextAction,
    });

    return {
      boardLane,
      blockerSummary,
      blockedReasons,
      closureState,
      dependencySummary,
      diffReview: diffReviewLinkageViewForTask(task, tasks),
      eligibility,
      humanStatus,
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
  dependencySummary,
  hasReviewableOutput,
  lifecycle,
}: {
  blockedReasons: readonly QueueBlockedReason[];
  dependencySummary: QueueTaskDependencySummary;
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
  if (
    dependencySummary.gate === "waiting" &&
    !hasMaterialBlockerWhileWaiting(blockedReasons) &&
    (lifecycle === "queued" || lifecycle === "ready" || lifecycle === "draft")
  ) {
    return "waiting_dependency";
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

function hasMaterialBlockerWhileWaiting(
  blockedReasons: readonly QueueBlockedReason[],
) {
  const nonMaterialWhileWaiting = new Set<QueueBlockedReasonCode>([
    "capacity_unavailable",
    "runtime_unavailable",
  ]);

  return blockedReasons.some((reason) => !nonMaterialWhileWaiting.has(reason.code));
}

function queueV2BlockedReasonsForTask({
  dependencyState,
  dependencySummary,
  lifecycle,
  pausedQueueTagIds,
  queueEnabled,
  task,
  workers,
}: {
  dependencyState: AgentQueueDependencyState;
  dependencySummary: QueueTaskDependencySummary;
  lifecycle: QueueTaskLifecycle;
  pausedQueueTagIds: ReadonlySet<string>;
  queueEnabled: boolean;
  task: AgentQueueTask;
  workers: readonly AgentWorkerSummary[];
}): QueueBlockedReason[] {
  const reasons: QueueBlockedReason[] = [];

  if (dependencyState.status === "invalid") {
    reasons.push(queueV2BlockedReason("dependency_graph_invalid"));
  } else if (dependencySummary.gate === "failed") {
    reasons.push(queueV2BlockedReason("dependency_failed_or_rejected"));
  } else if (dependencySummary.gate === "blocked") {
    reasons.push(queueV2BlockedReason("dependency_blocked"));
  }

  if (lifecycle === "queued" || lifecycle === "ready") {
    if (!task.executionWorkspace?.trim()) {
      reasons.push(queueV2BlockedReason("missing_execution_workspace"));
    }

    if (!task.codexExecutable?.trim()) {
      reasons.push(queueV2BlockedReason("missing_codex_executable"));
    }

    if (!queueEnabled) {
      reasons.push(queueV2BlockedReason("queue_disabled"));
    }

    if (!task.prompt.trim()) {
      reasons.push(
        queueV2BlockedReason("run_settings_invalid", "Task prompt is empty"),
      );
    }

    const validationStatus = normalizeValidationStatus(task.validationStatus);
    if (validationStatus === "validating") {
      reasons.push(
        queueV2BlockedReason("operator_review_required", "Validation is running"),
      );
    } else if (validationStatus === "failed") {
      reasons.push(queueV2BlockedReason("validation_failed"));
    }

    const context = task.context;
    if (context?.contextTokenBudget.overBudget) {
      reasons.push(
        queueV2BlockedReason("context_invalid", "Attached context is over budget"),
      );
    }
    if (
      context?.contextWarnings.some((warning) => warning.severity === "blocked")
    ) {
      reasons.push(queueV2BlockedReason("context_invalid"));
    }

    const queueTag = normalizeQueueTag(task);
    if (pausedQueueTagIds.has(queueTag.queueTagId)) {
      reasons.push(queueV2BlockedReason("tag_paused"));
    }

    const compatibleWorkers = compatibleQueueV2Workers(task, workers);
    if (workers.length === 0) {
      reasons.push(queueV2BlockedReason("runtime_unavailable"));
    } else if (compatibleWorkers.length === 0) {
      const hasPausedCompatibleWorker = workers.some(
        (worker) =>
          workerMatchesTaskTag(worker, task) &&
          (!worker.enabled || worker.status === "paused"),
      );
      reasons.push(
        hasPausedCompatibleWorker
          ? queueV2BlockedReason("worker_paused")
          : queueV2BlockedReason("capacity_unavailable"),
      );
    }
  }

  if (lifecycle === "review_required") {
    reasons.push(queueV2BlockedReason("operator_review_required"));
  }

  if (
    normalizeCoordinatorStatus(task.coordinatorStatus) === "blocked" ||
    task.closureState === "closure_blocked"
  ) {
    reasons.push(queueV2BlockedReason("safety_blocker"));
  }

  return prioritizeQueueV2BlockedReasons(dedupeReasons(reasons));
}

function queueV2EligibilityForTask({
  blockedReasons,
  dependencySummary,
  lifecycle,
  queueEnabled,
  task,
  workers,
}: {
  blockedReasons: readonly QueueBlockedReason[];
  dependencySummary: QueueTaskDependencySummary;
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
    (dependencySummary.gate === "none" || dependencySummary.gate === "satisfied") &&
    !blockedCodes.has("dependency_open") &&
    !blockedCodes.has("dependency_blocked") &&
    !blockedCodes.has("dependency_failed_or_rejected") &&
    !blockedCodes.has("dependency_graph_invalid");
  const capacityOk =
    !blockedCodes.has("capacity_unavailable") &&
    !blockedCodes.has("runtime_unavailable");
  const runSettingsOk =
    !blockedCodes.has("run_settings_invalid") &&
    !blockedCodes.has("missing_execution_workspace") &&
    !blockedCodes.has("missing_codex_executable");
  const contextOk =
    !blockedCodes.has("context_missing") && !blockedCodes.has("context_invalid");
  const tagOrWorkerOk =
    !blockedCodes.has("worker_paused") && !blockedCodes.has("tag_paused");
  const safetyOk =
    !blockedCodes.has("safety_blocker") &&
    !blockedCodes.has("operator_review_required") &&
    !blockedCodes.has("validation_failed");

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
    blockerSummary: viewModel.blockerSummary,
    boardLane: viewModel.boardLane,
    closureState: viewModel.closureState,
    dependencySummary: viewModel.dependencySummary,
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
    humanStatus: viewModel.humanStatus,
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
    waiting_dependency: [],
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
