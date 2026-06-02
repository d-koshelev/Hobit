import type {
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
  isStarting,
}: {
  apiAvailable: boolean;
  isStarting: boolean;
}) {
  const messages: string[] = [];

  if (!apiAvailable) {
    messages.push("Autonomous Queue is only available in the Tauri desktop shell.");
  }

  if (isStarting) {
    messages.push("Autonomous Queue is already active.");
  }

  return messages;
}

export function autonomousPreflightBlockerMessages({
  hasOpenTaskEdit,
  tasks,
}: {
  hasOpenTaskEdit: boolean;
  tasks: AgentQueueTask[];
}) {
  const messages: string[] = [];

  if (hasOpenTaskEdit) {
    messages.push(SAVE_TASK_EDITS_SETUP);
  }

  const scan = scanAutonomousTasks(tasks, new Set());
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
) {
  const scan = scanAutonomousTasks(tasks, startedQueueItemIds);

  return { skippedCount: scan.dependencyBlockedCount, task: scan.nextTask };
}

function scanAutonomousTasks(
  tasks: AgentQueueTask[],
  startedQueueItemIds: ReadonlySet<string>,
) {
  let dependencyBlockedCount = 0;
  let eligibleCount = 0;
  let firstSetupBlockedTask: AgentQueueTask | null = null;
  let nextTask: AgentQueueTask | null = null;

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
) {
  return scanAutonomousTasks(tasks, startedQueueItemIds).eligibleCount;
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

function firstRunnableCandidateMissingSetup(tasks: AgentQueueTask[]) {
  return sortQueueTasksForDisplay(tasks).find((task) =>
    taskIsRunnableCandidate(task) && Boolean(autonomousTaskSetupMessage(task)),
  );
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
