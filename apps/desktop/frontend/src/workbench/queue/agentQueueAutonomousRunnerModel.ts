import type {
  AgentQueueGlobalExecutionState,
  AgentExecutorRunDetail,
  AgentQueueTask,
  AgentQueueWorkerExecutionReport,
} from "../../workspace/types";
import {
  getQueueTaskDependencyState,
  normalizeTaskStatus,
  normalizeValidationStatus,
  sortQueueTasksForDisplay,
} from "../agentQueueTaskUiModel";
import {
  canStartTaskNow,
  queueExecutionModeFromGlobalState,
} from "./smartQueueExecutionGate";
import type {
  SmartQueueBlocker,
  SmartQueueDependency,
  SmartQueueTaskInput,
  SmartQueueTaskLifecycle,
} from "./smartQueueEligibility";

export const NO_ELIGIBLE_TASK_BLOCKER = "No eligible queued tasks.";
export const DEPENDENCY_BLOCKER =
  "No task can run because dependencies are not finalized.";
export const MISSING_CODEX_EXECUTABLE_SETUP =
  "Set Codex executable before autonomous run.";
export const MISSING_SANDBOX_SETUP =
  "Set sandbox before autonomous run.";
export const MISSING_APPROVAL_POLICY_SETUP =
  "Set approval policy before autonomous run.";
export const SAVE_TASK_EDITS_SETUP =
  "Save task edits before autonomous run.";
export const AUTONOMOUS_REPORT_READY_NOTE =
  "Execution complete. Report ready. Awaiting coordinator review.";

export function autonomousPreconditionMessages({
  apiAvailable,
  globalExecutionState = "started",
  isStarting,
}: {
  apiAvailable: boolean;
  globalExecutionState?: AgentQueueGlobalExecutionState;
  isStarting: boolean;
}) {
  const messages: string[] = [];
  const queueMode = queueExecutionModeFromGlobalState(globalExecutionState);

  if (!apiAvailable) {
    messages.push("Autonomous Queue is only available in the Tauri desktop shell.");
  }

  if (queueMode.reason) {
    messages.push(queueMode.reason);
  }

  if (isStarting) {
    messages.push("Autonomous Queue is already active.");
  }

  return messages;
}

export function autonomousPreflightBlockerMessages({
  globalExecutionState = "started",
  hasOpenTaskEdit,
  tasks,
}: {
  globalExecutionState?: AgentQueueGlobalExecutionState;
  hasOpenTaskEdit: boolean;
  tasks: AgentQueueTask[];
}) {
  const messages: string[] = [];
  const queueMode = queueExecutionModeFromGlobalState(globalExecutionState);

  if (hasOpenTaskEdit) {
    messages.push(SAVE_TASK_EDITS_SETUP);
  }

  if (queueMode.reason) {
    messages.push(queueMode.reason);
  }

  const scan = scanAutonomousTasks({
    globalExecutionState,
    startedQueueItemIds: new Set(),
    tasks,
  });
  const missingSettingsTask = scan.firstSetupBlockedTask;
  if (!scan.nextTask && missingSettingsTask) {
    const setupMessage = autonomousTaskSetupMessage(missingSettingsTask);
    if (setupMessage) {
      messages.push(setupMessage);
    }
  }

  if (!scan.nextTask && !missingSettingsTask) {
    messages.push(scan.dependencyBlockedCount > 0
      ? DEPENDENCY_BLOCKER
      : NO_ELIGIBLE_TASK_BLOCKER);
  }

  return messages;
}

export function autonomousSetupBlockerMessages(
  options: Parameters<typeof autonomousPreflightBlockerMessages>[0],
) {
  return autonomousPreflightBlockerMessages(options).filter(isAutonomousSetupBlocker);
}

export function autonomousTaskBlockerMessages(
  options: Parameters<typeof autonomousPreflightBlockerMessages>[0],
) {
  return autonomousPreflightBlockerMessages(options).filter(
    (message) => message === NO_ELIGIBLE_TASK_BLOCKER || message === DEPENDENCY_BLOCKER,
  );
}

export function isAutonomousSetupBlocker(message: string) {
  return (
    message.endsWith("is missing execution workspace.") ||
    message === MISSING_CODEX_EXECUTABLE_SETUP ||
    message === MISSING_SANDBOX_SETUP ||
    message === MISSING_APPROVAL_POLICY_SETUP ||
    message === SAVE_TASK_EDITS_SETUP
  );
}

export function selectNextAutonomousTask(
  tasks: AgentQueueTask[],
  startedQueueItemIds: ReadonlySet<string>,
  globalExecutionState: AgentQueueGlobalExecutionState = "started",
) {
  const scan = scanAutonomousTasks({
    globalExecutionState,
    startedQueueItemIds,
    tasks,
  });

  return { skippedCount: scan.dependencyBlockedCount, task: scan.nextTask };
}

function scanAutonomousTasks({
  globalExecutionState,
  startedQueueItemIds,
  tasks,
}: {
  globalExecutionState: AgentQueueGlobalExecutionState;
  startedQueueItemIds: ReadonlySet<string>;
  tasks: AgentQueueTask[];
}) {
  let dependencyBlockedCount = 0;
  let eligibleCount = 0;
  let firstSetupBlockedTask: AgentQueueTask | null = null;
  let nextTask: AgentQueueTask | null = null;
  const queueMode = queueExecutionModeFromGlobalState(globalExecutionState);
  const smartTasks = tasks.map(smartTaskInputForQueueTask);
  const smartDependencies = smartQueueDependenciesForTasks(tasks);

  for (const task of sortQueueTasksForDisplay(tasks)) {
    if (startedQueueItemIds.has(task.queueItemId)) {
      continue;
    }

    const coordinatorStatus = task.coordinatorStatus ?? "not_reported";
    const dependencyState = getQueueTaskDependencyState(task, tasks);

    if (!taskIsRunnableCandidate(task)) {
      continue;
    }

    if (dependencyState.status !== "ready") {
      dependencyBlockedCount += 1;
      continue;
    }

    if (coordinatorStatusBlocksAutonomousTask(coordinatorStatus)) {
      continue;
    }

    const gate = canStartTaskNow({
      capacityAvailable: true,
      dependencies: smartDependencies,
      queueState: queueMode.queueState,
      task: smartTaskInputForQueueTask(task),
      tasks: smartTasks,
    });

    if (!gate.canStartTaskNow) {
      if (gate.dependencyReason) {
        dependencyBlockedCount += 1;
      }
      continue;
    }

    if (autonomousTaskSetupMessage(task)) {
      firstSetupBlockedTask = firstSetupBlockedTask ?? task;
      continue;
    }

    eligibleCount += 1;
    nextTask = nextTask ?? task;
  }

  return {
    dependencyBlockedCount,
    eligibleCount,
    firstSetupBlockedTask,
    nextTask,
  };
}

export function countRemainingAutonomousEligibleTasks(
  tasks: AgentQueueTask[],
  startedQueueItemIds: ReadonlySet<string>,
  globalExecutionState: AgentQueueGlobalExecutionState = "started",
) {
  return scanAutonomousTasks({
    globalExecutionState,
    startedQueueItemIds,
    tasks,
  }).eligibleCount;
}

export function autonomousTaskSetupMessage(task: AgentQueueTask) {
  if (!task.executionWorkspace?.trim()) {
    return `Task ${sanitizeTaskTitleForMessage(task.title)} is missing execution workspace.`;
  }

  if (!task.codexExecutable?.trim()) {
    return MISSING_CODEX_EXECUTABLE_SETUP;
  }

  if (!task.sandbox?.trim()) {
    return MISSING_SANDBOX_SETUP;
  }

  if (!task.approvalPolicy?.trim()) {
    return MISSING_APPROVAL_POLICY_SETUP;
  }

  return null;
}

function taskIsRunnableCandidate(task: AgentQueueTask) {
  const status = normalizeTaskStatus(task.status);
  const coordinatorStatus = task.coordinatorStatus ?? "not_reported";

  return (
    (status === "queued" || status === "ready" || status === "review_needed") &&
    task.prompt.trim().length > 0 &&
    !coordinatorStatusBlocksAutonomousTask(coordinatorStatus) &&
    normalizeValidationStatus(task.validationStatus) !== "failed"
  );
}

function coordinatorStatusBlocksAutonomousTask(coordinatorStatus: string) {
  return (
    coordinatorStatus === "awaiting_coordinator_review" ||
    coordinatorStatus === "finalized" ||
    coordinatorStatus === "blocked" ||
    coordinatorStatus === "failed"
  );
}

function smartTaskInputForQueueTask(task: AgentQueueTask): SmartQueueTaskInput {
  return {
    blockers: smartQueueBlockersForQueueTask(task),
    lifecycle: smartLifecycleForQueueTask(task),
    taskId: task.queueItemId,
    title: task.title,
  };
}

function smartLifecycleForQueueTask(
  task: AgentQueueTask,
): SmartQueueTaskLifecycle {
  const status = normalizeTaskStatus(task.status);
  const coordinatorStatus = task.coordinatorStatus ?? "not_reported";

  if (status === "completed" && coordinatorStatus === "finalized") {
    return "closed";
  }

  if (status === "completed" || status === "review_needed") {
    return "review";
  }

  if (status === "queued") {
    return "ready";
  }

  return status;
}

function smartQueueDependenciesForTasks(
  tasks: AgentQueueTask[],
): SmartQueueDependency[] {
  return tasks.flatMap((task) =>
    (task.dependsOn ?? [])
      .map((upstreamTaskId) => upstreamTaskId.trim())
      .filter(Boolean)
      .map((upstreamTaskId) => ({
        downstreamTaskId: task.queueItemId,
        kind: "blocks_start" as const,
        upstreamTaskId,
      })),
  );
}

function smartQueueBlockersForQueueTask(task: AgentQueueTask) {
  const blockers: SmartQueueBlocker[] = [];

  if (!task.prompt.trim()) {
    blockers.push({
      kind: "missing_prompt",
      reason: "missing prompt",
      taskId: task.queueItemId,
    });
  }

  if (normalizeValidationStatus(task.validationStatus) === "failed") {
    blockers.push({
      kind: "validation_requires_decision",
      reason: "validation failed",
      taskId: task.queueItemId,
    });
  }

  return blockers;
}

function sanitizeTaskTitleForMessage(title: string) {
  return title.replace(/\s+/g, " ").trim() || "Untitled task";
}

export function assessAutonomousSuccess(
  detail: AgentExecutorRunDetail | null | undefined,
  finalStatus: string,
) {
  if (finalStatus !== "completed") {
    return {
      ok: false,
      reason: `Direct Work run ended with ${finalStatus}.`,
    };
  }

  if (!detail) {
    return { ok: false, reason: "Direct Work result evidence could not be loaded." };
  }

  if (detail.summary.status !== "completed") {
    return {
      ok: false,
      reason: `Direct Work evidence reports ${detail.summary.status}.`,
    };
  }

  if (detail.errorMessage) {
    return { ok: false, reason: detail.errorMessage };
  }

  if (!detail.finalMessage?.trim()) {
    return { ok: false, reason: "Direct Work final response is missing." };
  }

  if (detail.validationStatus === "failed") {
    return {
      ok: false,
      reason: "Direct Work evidence reports validation failed.",
    };
  }

  if (evidenceReportsFailure(detail.finalMessage)) {
    return {
      ok: false,
      reason: "Direct Work evidence reports blocked, failed, or needs changes.",
    };
  }

  return { ok: true, reason: "" };
}

export function buildAutonomousWorkerReport({
  detail,
  runId,
  task,
}: {
  detail: AgentExecutorRunDetail;
  runId: string;
  task: AgentQueueTask;
}): AgentQueueWorkerExecutionReport {
  return {
    changedFiles: [],
    commandsRun: [],
    createdAt: new Date().toISOString(),
    errors: [],
    itemId: task.queueItemId,
    rawReportPreview: detail.finalMessage ?? detail.resultContent ?? undefined,
    reportId: `autonomous_${runId}`,
    reportStatus: "reported",
    summary: AUTONOMOUS_REPORT_READY_NOTE,
    validationCommandsRun: [],
    validationCommandsSuggested: [],
    validationResult:
      detail.validationStatus === "passed"
        ? "passed"
        : detail.validationStatus === "failed"
          ? "failed"
          : "not_run",
    warnings: [],
    workerId: task.assignedWorkerId ?? task.assignedExecutorWidgetId ?? "agent-queue",
  };
}

function evidenceReportsFailure(finalMessage: string) {
  return /(^|\b)(blocked|failed|failure|needs changes|validation failed)(\b|$)/i.test(
    finalMessage,
  );
}
