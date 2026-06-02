import type {
  AgentQueueTask,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
  AgentQueueWorkerConfig,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  coordinatorStatusBlocksNewWork,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskExecutionPolicy,
  normalizeTaskPriority,
  normalizeTaskStatus,
  normalizeValidationStatus,
  queueTagsFromTasks,
} from "../agentQueueTaskUiModel";
import {
  getQueueTaskDependencyState,
  normalizeTaskDependencies,
  queueDependencyBlockedSummary,
} from "../agentQueueDependencyUi";
import type {
  QueueGetSnapshotRequest,
  QueueWidgetApiDependencies,
  QueueWidgetAutonomousState,
  QueueWidgetBlocker,
  QueueWidgetGlobalState,
  QueueWidgetItemCounts,
  QueueWidgetItemSnapshot,
  QueueWidgetLocalExecutorState,
  QueueWidgetQueueTagSummary,
  QueueWidgetReportSummary,
  QueueWidgetRunLinkSummary,
  QueueWidgetSnapshot,
} from "./agentQueueWidgetApiTypes";

const DEFAULT_RUN_LINK_LIMIT_PER_ITEM = 3;
const QUEUE_WIDGET_TYPE = "agent-queue";
const PRIMARY_COORDINATOR_ID = "primary";

export async function buildQueueWidgetSnapshot({
  dependencies,
  queueId,
  request,
  timestamp,
}: {
  dependencies: QueueWidgetApiDependencies;
  queueId: string;
  request: Partial<QueueGetSnapshotRequest>;
  timestamp: string;
}): Promise<QueueWidgetSnapshot> {
  const capsAndRedactions = [
    "Snapshot omits raw Executor logs, stdout, stderr, full final responses, diffs, Terminal output, Git state, files, secrets, and hidden widget state.",
  ];
  const loadedTasks = await dependencies.listAgentQueueTasks();
  const tasks = loadedTasks
    .slice(0, request.itemLimit ?? loadedTasks.length)
    .map((task) => ({ ...task }));
  if (tasks.length < loadedTasks.length) {
    capsAndRedactions.push(
      `Items capped at ${tasks.length.toString()} of ${loadedTasks.length.toString()}.`,
    );
  }

  const runnerState = await readAutonomousState({
    dependencies,
    capsAndRedactions,
  });
  const workers = await readWorkers({
    dependencies,
    capsAndRedactions,
  });
  const runLinksByItem = await readRunLinksByItem({
    capsAndRedactions,
    dependencies,
    runLinkLimitPerItem:
      request.runLinkLimitPerItem ?? DEFAULT_RUN_LINK_LIMIT_PER_ITEM,
    tasks,
  });
  const items = tasks.map((task) =>
    queueWidgetItemSnapshot({
      queueId,
      runLinks: runLinksByItem.get(task.queueItemId) ?? [],
      task,
      tasks,
    }),
  );
  const selectedItemId =
    request.selectedItemId ??
    dependencies.selectedItemId ??
    (request.includeSelectedItem === false ? null : null);
  const selectedItem =
    selectedItemId && request.includeSelectedItem !== false
      ? items.find((item) => item.id === selectedItemId) ?? null
      : null;
  const counts = itemCounts(items);
  const blockers = items.flatMap((item) => item.blockers);
  const globalQueueState = buildGlobalState({
    blockers,
    counts,
    runnerState,
    timestamp,
  });

  return {
    autonomousRunnerState: runnerState,
    blockers,
    blockersCount: blockers.length,
    capsAndRedactions,
    coordinatorId: PRIMARY_COORDINATOR_ID,
    countsByStatus: counts,
    finalizedCount: counts.finalized,
    globalQueueState,
    itemCounts: counts,
    items,
    lastEvents: [],
    localExecutorState: localExecutorState({
      slots: dependencies.agentExecutorSlots ?? [],
      tasks,
      workers,
    }),
    pendingConfirmations: [],
    queueId,
    queueTags: queueTagSummaries({ items, tasks }),
    reportReadyCount: counts.reportReady,
    revision: latestRevision(tasks),
    runningCount: counts.running,
    selectedItem,
    selectedItemId,
    snapshotGeneratedAt: timestamp,
    unsupportedReason: null,
    waitingCount: counts.waiting,
    widgetType: QUEUE_WIDGET_TYPE,
    workspaceId: dependencies.workspaceId,
  };
}

export function queueWidgetItemSnapshot({
  queueId,
  runLinks,
  task,
  tasks,
}: {
  queueId: string;
  runLinks: QueueWidgetRunLinkSummary[];
  task: AgentQueueTask;
  tasks: AgentQueueTask[];
}): QueueWidgetItemSnapshot {
  const dependencies = normalizeTaskDependencies(task.dependsOn);
  const dependencyState = getQueueTaskDependencyState(
    { ...task, dependsOn: dependencies },
    tasks,
  );
  const latestReport = latestWorkerReport(task);
  const queueTag = normalizeQueueTag(task);
  const validationStatus = normalizeValidationStatus(task.validationStatus);

  return {
    approvalPolicy: task.approvalPolicy ?? null,
    assignedExecutorWidgetId: task.assignedExecutorWidgetId,
    blockers: blockersForTask({
      dependencyState,
      task,
      validationStatus,
    }),
    codexExecutable: task.codexExecutable ?? null,
    coordinatorStatus: task.coordinatorStatus ?? null,
    createdAt: task.createdAt,
    dependencies,
    description: task.description,
    evidenceSummary: {
      reviewStatus: runLinks[0]?.reviewStatus ?? null,
      runRefs: runLinks.map((link) => link.directWorkRunId),
      status:
        runLinks.length > 0 || latestReport
          ? "available"
          : task.status === "completed"
            ? "missing"
            : "none",
      validationStatus,
    },
    executionPolicy: normalizeTaskExecutionPolicy(task.executionPolicy),
    executionStatus: normalizeTaskStatus(task.status),
    executionWorkspace: task.executionWorkspace ?? null,
    id: task.queueItemId,
    index: task.orderIndex ?? null,
    itemType: normalizeItemType(task.itemType),
    order: task.orderIndex ?? null,
    priority: normalizeTaskPriority(task.priority),
    prompt: task.prompt,
    queueId,
    queueTag: {
      id: queueTag.queueTagId,
      name: queueTag.queueTagName,
    },
    reportSummary: reportSummaryForTask({ latestReport, runLinks, task }),
    runLinks,
    sandbox: task.sandbox ?? null,
    status: normalizeTaskStatus(task.status),
    title: task.title,
    updatedAt: task.updatedAt,
    validationStatus,
    workspaceId: task.workspaceId,
  };
}

function blockersForTask({
  dependencyState,
  task,
  validationStatus,
}: {
  dependencyState: ReturnType<typeof getQueueTaskDependencyState>;
  task: AgentQueueTask;
  validationStatus: AgentQueueTaskValidationStatus;
}): QueueWidgetBlocker[] {
  const blockers: QueueWidgetBlocker[] = [];

  if (task.status !== "draft" && !task.prompt.trim()) {
    blockers.push({
      code: "missing_prompt",
      itemId: task.queueItemId,
      message: "Prompt is required before this Queue item can run.",
    });
  }

  if (
    (task.status === "queued" ||
      task.status === "ready" ||
      task.status === "review_needed") &&
    !task.executionWorkspace?.trim()
  ) {
    blockers.push({
      code: "missing_execution_workspace",
      itemId: task.queueItemId,
      message: "Execution workspace is not set.",
    });
  }

  if (
    (task.status === "queued" ||
      task.status === "ready" ||
      task.status === "review_needed") &&
    !task.assignedExecutorWidgetId
  ) {
    blockers.push({
      code: "missing_executor",
      itemId: task.queueItemId,
      message: "No Agent Executor is assigned.",
    });
  }

  if (dependencyState.status !== "ready") {
    blockers.push({
      code: "dependency_blocked",
      itemId: task.queueItemId,
      message: queueDependencyBlockedSummary(dependencyState),
    });
  }

  if (normalizeTaskExecutionPolicy(task.executionPolicy) === "manual") {
    blockers.push({
      code: "manual_policy",
      itemId: task.queueItemId,
      message: "Execution policy is manual.",
    });
  }

  if (validationStatus === "failed") {
    blockers.push({
      code: "validation_failed",
      itemId: task.queueItemId,
      message: "Validation status is failed.",
    });
  }

  if (coordinatorStatusBlocksNewWork(task.coordinatorStatus)) {
    blockers.push({
      code: "operator_decision_required",
      itemId: task.queueItemId,
      message: "Coordinator/operator review is required.",
    });
  }

  return blockers;
}

function reportSummaryForTask({
  latestReport,
  runLinks,
  task,
}: {
  latestReport: AgentQueueWorkerExecutionReport | null;
  runLinks: QueueWidgetRunLinkSummary[];
  task: AgentQueueTask;
}): QueueWidgetReportSummary {
  if (latestReport) {
    return {
      changedFilesCount: latestReport.changedFiles.length,
      errorMessage: latestReport.errors[0],
      errorsCount: latestReport.errors.length,
      failedCommand: failedCommandForReport(latestReport),
      status: "report_ready",
      summary: latestReport.summary,
      validationSummary: validationSummaryForReport(latestReport),
      warningsCount: latestReport.warnings.length,
    };
  }

  if (
    task.coordinatorStatus === "worker_reported" ||
    task.coordinatorStatus === "awaiting_coordinator_review" ||
    task.coordinatorStatus === "ready_for_finalization" ||
    task.status === "review_needed"
  ) {
    return {
      status: "report_ready",
      summary: "Queue item is awaiting review.",
    };
  }

  if (task.status === "completed" && runLinks.length === 0) {
    return {
      status: "evidence_missing",
      summary: "Execution is complete but no safe run evidence is linked.",
    };
  }

  return {
    status: "none",
  };
}

function latestWorkerReport(
  task: AgentQueueTask,
): AgentQueueWorkerExecutionReport | null {
  const reports = task.workerExecutionReports ?? [];

  return reports[reports.length - 1] ?? null;
}

function failedCommandForReport(report: AgentQueueWorkerExecutionReport) {
  if (
    report.reportStatus !== "failed" &&
    report.validationResult !== "failed" &&
    report.errors.length === 0
  ) {
    return undefined;
  }

  return (
    report.validationCommandsRun?.[0] ??
    report.commandsRun[report.commandsRun.length - 1] ??
    undefined
  );
}

function validationSummaryForReport(report: AgentQueueWorkerExecutionReport) {
  const result = report.validationResult
    ? `Validation result: ${report.validationResult}.`
    : null;
  const commands =
    report.validationCommandsRun && report.validationCommandsRun.length > 0
      ? `Validation commands already reported: ${report.validationCommandsRun.join("; ")}.`
      : report.validationCommandsSuggested.length > 0
        ? `Validation commands suggested: ${report.validationCommandsSuggested.join("; ")}.`
        : null;

  return [result, commands].filter(Boolean).join(" ") || undefined;
}

function itemCounts(items: QueueWidgetItemSnapshot[]): QueueWidgetItemCounts {
  const counts = {
    awaitingCoordinatorReview: 0,
    blocked: 0,
    cancelled: 0,
    completed: 0,
    draft: 0,
    failed: 0,
    finalized: 0,
    queued: 0,
    ready: 0,
    reportReady: 0,
    review_needed: 0,
    reviewNeeded: 0,
    running: 0,
    total: items.length,
    waiting: 0,
  } satisfies QueueWidgetItemCounts;

  for (const item of items) {
    switch (item.status) {
      case "cancelled":
        counts.cancelled += 1;
        break;
      case "completed":
        counts.completed += 1;
        break;
      case "draft":
        counts.draft += 1;
        break;
      case "failed":
        counts.failed += 1;
        break;
      case "queued":
        counts.queued += 1;
        break;
      case "ready":
        counts.ready += 1;
        break;
      case "review_needed":
        counts.review_needed += 1;
        counts.reviewNeeded += 1;
        break;
      case "running":
        counts.running += 1;
        break;
    }
    if (item.blockers.length > 0) {
      counts.blocked += 1;
    }
    if (
      item.status === "queued" ||
      item.status === "ready" ||
      item.status === "draft"
    ) {
      counts.waiting += 1;
    }
    if (item.reportSummary.status === "report_ready") {
      counts.reportReady += 1;
    }
    if (item.coordinatorStatus === "awaiting_coordinator_review") {
      counts.awaitingCoordinatorReview += 1;
    }
    if (item.coordinatorStatus === "finalized") {
      counts.finalized += 1;
    }
  }

  return counts;
}

function buildGlobalState({
  blockers,
  counts,
  runnerState,
  timestamp,
}: {
  blockers: QueueWidgetBlocker[];
  counts: QueueWidgetItemCounts;
  runnerState: QueueWidgetAutonomousState;
  timestamp: string;
}): QueueWidgetGlobalState {
  if (runnerState.isActive) {
    return {
      errorCount: 0,
      lastRefreshAt: timestamp,
      status:
        runnerState.status === "stopping"
          ? "autorun_stopping"
          : "autorun_running",
    };
  }

  if (counts.running > 0) {
    return {
      errorCount: 0,
      lastRefreshAt: timestamp,
      status: "has_running_work",
    };
  }

  if (counts.failed > 0) {
    return {
      errorCount: counts.failed,
      lastRefreshAt: timestamp,
      status: "failed",
    };
  }

  if (counts.reportReady > 0 || counts.awaitingCoordinatorReview > 0) {
    return {
      errorCount: 0,
      lastRefreshAt: timestamp,
      status: "awaiting_review",
    };
  }

  if (blockers.length > 0) {
    return {
      errorCount: 0,
      lastRefreshAt: timestamp,
      status: "blocked",
    };
  }

  return {
    errorCount: 0,
    lastRefreshAt: timestamp,
    status: "idle",
  };
}

function queueTagSummaries({
  items,
  tasks,
}: {
  items: QueueWidgetItemSnapshot[];
  tasks: AgentQueueTask[];
}): QueueWidgetQueueTagSummary[] {
  return queueTagsFromTasks(tasks, new Map()).map((tag) => {
    const tagItems = items.filter(
      (item) => item.queueTag.id === tag.queueTagId,
    );

    return {
      blockedCount: tagItems.filter((item) => item.blockers.length > 0).length,
      finalizedCount: tagItems.filter(
        (item) => item.coordinatorStatus === "finalized",
      ).length,
      itemCount: tagItems.length,
      queueTagId: tag.queueTagId,
      queueTagName: tag.queueTagName,
      reportReadyCount: tagItems.filter(
        (item) => item.reportSummary.status === "report_ready",
      ).length,
      runningCount: tagItems.filter((item) => item.status === "running").length,
      waitingCount: tagItems.filter(
        (item) =>
          item.status === "queued" ||
          item.status === "ready" ||
          item.status === "draft",
      ).length,
    };
  });
}

function localExecutorState({
  slots,
  tasks,
  workers,
}: {
  slots: QueueWidgetApiDependencies["agentExecutorSlots"];
  tasks: AgentQueueTask[];
  workers: AgentQueueWorkerConfig[];
}): QueueWidgetLocalExecutorState {
  const assignedExecutorIds = new Set(
    tasks
      .map((task) => task.assignedExecutorWidgetId)
      .filter((executorId): executorId is string => Boolean(executorId)),
  );
  const workerIds = new Set(workers.map((worker) => worker.workerId));
  const slotIds = new Set((slots ?? []).map((slot) => slot.widgetInstanceId));
  const executorCount = new Set([...workerIds, ...slotIds]).size;

  return {
    activeRunCount: tasks.filter((task) => task.status === "running").length,
    assignedCount: assignedExecutorIds.size,
    available: executorCount > 0,
    executorCount,
    unsupportedReason:
      executorCount > 0 ? null : "No visible local executor state is available.",
    workerCount: workers.length,
  };
}

async function readAutonomousState({
  dependencies,
  capsAndRedactions,
}: {
  capsAndRedactions: string[];
  dependencies: QueueWidgetApiDependencies;
}): Promise<QueueWidgetAutonomousState> {
  if (!dependencies.getAgentQueueRunnerSnapshot) {
    return {
      available: false,
      isActive: false,
      isSessionOnly: true,
      status: "unavailable",
      unsupportedReason: "Queue Autorun status API is not available.",
    };
  }

  try {
    const snapshot = await dependencies.getAgentQueueRunnerSnapshot();

    return {
      activeItemId: snapshot.activeQueueItemId,
      available: true,
      isActive: snapshot.isActive,
      isSessionOnly: snapshot.isSessionOnly,
      status: snapshot.status,
      stopReason: snapshot.stopReason,
      waitingRunId: snapshot.waitingRunId,
    };
  } catch (error) {
    const message = errorToMessage(error, "Queue Autorun status is unavailable.");
    capsAndRedactions.push(`Queue Autorun state unavailable: ${message}`);

    return {
      available: false,
      isActive: false,
      isSessionOnly: true,
      status: "unavailable",
      unsupportedReason: message,
    };
  }
}

async function readWorkers({
  dependencies,
  capsAndRedactions,
}: {
  capsAndRedactions: string[];
  dependencies: QueueWidgetApiDependencies;
}) {
  if (!dependencies.listAgentQueueWorkers) {
    return [];
  }

  try {
    return await dependencies.listAgentQueueWorkers();
  } catch (error) {
    capsAndRedactions.push(
      `Queue worker state unavailable: ${errorToMessage(
        error,
        "Unable to read Queue workers.",
      )}`,
    );
    return [];
  }
}

async function readRunLinksByItem({
  capsAndRedactions,
  dependencies,
  runLinkLimitPerItem,
  tasks,
}: {
  capsAndRedactions: string[];
  dependencies: QueueWidgetApiDependencies;
  runLinkLimitPerItem: number;
  tasks: AgentQueueTask[];
}) {
  const linksByItem = new Map<string, QueueWidgetRunLinkSummary[]>();

  if (!dependencies.listAgentQueueTaskRunLinks) {
    return linksByItem;
  }

  for (const task of tasks) {
    try {
      const links = await dependencies.listAgentQueueTaskRunLinks(
        task.queueItemId,
      );
      linksByItem.set(
        task.queueItemId,
        links.slice(0, runLinkLimitPerItem).map((link) => ({
          completedAt: link.completedAt,
          directWorkRunId: link.directWorkRunId,
          executorWidgetId: link.executorWidgetId,
          linkId: link.linkId,
          reviewStatus: link.reviewStatus,
          source: link.source,
          startedAt: link.startedAt,
          status: link.status,
          validationStatus: link.validationStatus,
        })),
      );
    } catch (error) {
      capsAndRedactions.push(
        `Run-link metadata unavailable for ${task.queueItemId}: ${errorToMessage(
          error,
          "Unable to read Queue run-link metadata.",
        )}`,
      );
    }
  }

  return linksByItem;
}

function latestRevision(tasks: AgentQueueTask[]) {
  const updatedAts = tasks
    .map((task) => task.updatedAt)
    .filter(Boolean)
    .sort();

  return updatedAts[updatedAts.length - 1] ?? null;
}

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
