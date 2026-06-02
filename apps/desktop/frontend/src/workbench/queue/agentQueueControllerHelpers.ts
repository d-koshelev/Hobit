import type {
  AgentQueueGlobalExecutionState,
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
} from "../../workspace/types";
import {
  dependentTasksForQueueItem,
  errorToMessage,
  isFinalQueueTaskStatus,
  queueDependencyBlockedSummary,
  sortQueueTasksForDisplay,
  statusLabel,
} from "../agentQueueTaskUiModel";
import { getNextQueueRunnerTaskDecision } from "./queueRunner";

const WINDOWS_CODEX_EXECUTABLE = "codex.cmd";

export type AgentQueueRunnerStatus =
  | "idle"
  | "running"
  | "assigning"
  | "starting"
  | "waiting_for_executor"
  | "stopped"
  | "completed"
  | "error";

export function runPreconditionMessages({
  codexExecutable,
  globalExecutionState,
  isStarting,
  repoRoot,
}: {
  codexExecutable: string;
  globalExecutionState?: AgentQueueGlobalExecutionState;
  isStarting: boolean;
  repoRoot: string;
}) {
  const messages: string[] = [];

  if (globalExecutionState === "stopped") {
    messages.push("Enable queue.");
  }

  if (!repoRoot) {
    messages.push("Set workspace.");
  }

  if (!codexExecutable) {
    messages.push("Set Codex executable.");
  }

  if (isStarting) {
    messages.push("Run request is already in flight.");
  }

  return messages;
}

export function queueRunnerPreconditionMessages({
  assignmentApiAvailable,
  codexExecutable,
  globalExecutionState,
  hasExecutorSelection,
  isDirty,
  isStarting,
  repoRoot,
  runnerInFlight,
  runnerStatus,
  startApiAvailable,
  taskCount,
}: {
  assignmentApiAvailable: boolean;
  codexExecutable: string;
  globalExecutionState: AgentQueueGlobalExecutionState;
  hasExecutorSelection: boolean;
  isDirty: boolean;
  isStarting: boolean;
  repoRoot: string;
  runnerInFlight: boolean;
  runnerStatus: AgentQueueRunnerStatus;
  startApiAvailable: boolean;
  taskCount: number;
}) {
  const messages = runPreconditionMessages({
    codexExecutable,
    isStarting: isStarting || runnerInFlight || isQueueRunnerActive(runnerStatus),
    repoRoot,
  });

  if (globalExecutionState === "stop_kill_requested") {
    messages.unshift(
      "STOP + KILL RUNNING is requested. Review running work or click Enable before starting the Sequential Queue Runner.",
    );
  } else if (globalExecutionState === "stopped") {
    messages.unshift("Click Enable before starting the Sequential Queue Runner.");
  }

  if (!startApiAvailable) {
    messages.unshift("Assigned-task execution is not available in this runtime.");
  }

  if (!assignmentApiAvailable) {
    messages.unshift("Assignment persistence is not available in this runtime.");
  }

  if (!hasExecutorSelection) {
    messages.unshift("Select one local executor for the Sequential Queue Runner.");
  }

  if (taskCount === 0) {
    messages.unshift("Add queue tasks before starting the Sequential Queue Runner.");
  }

  if (isDirty) {
    messages.unshift("Save task edits before starting the Sequential Queue Runner.");
  }

  return messages;
}

export function queueAutorunPreconditionMessages({
  apiAvailable,
  codexExecutable,
  globalExecutionState,
  hasExecutorSelection,
  isStarting,
  repoRoot,
}: {
  apiAvailable: boolean;
  codexExecutable: string;
  globalExecutionState: AgentQueueGlobalExecutionState;
  hasExecutorSelection: boolean;
  isStarting: boolean;
  repoRoot: string;
}) {
  const messages: string[] = [];

  if (!apiAvailable) {
    messages.push(
      "Queue Autorun session control is only available in the Tauri desktop shell.",
    );
  }

  if (globalExecutionState === "stop_kill_requested") {
    messages.push(
      "STOP + KILL RUNNING is requested. Review running work or click Enable before arming Queue Autorun.",
    );
  } else if (globalExecutionState === "stopped") {
    messages.push("Click Enable before arming Queue Autorun.");
  }

  if (!hasExecutorSelection) {
    messages.push("Select one local executor before arming Queue Autorun.");
  }

  if (!repoRoot) {
    messages.push("Set workspace.");
  }

  if (!codexExecutable) {
    messages.push("Codex executable is required before arming Queue Autorun.");
  }

  if (isStarting) {
    messages.push("Queue Autorun arm request is already in flight.");
  }

  return messages;
}

export function isQueueRunnerActive(status: AgentQueueRunnerStatus) {
  return (
    status === "assigning" ||
    status === "running" ||
    status === "starting" ||
    status === "waiting_for_executor"
  );
}

type QueueRunnerStopDecision = Extract<
  ReturnType<typeof getNextQueueRunnerTaskDecision>,
  { kind: "stop" }
>;

export function queueRunnerStopMessage(decision: QueueRunnerStopDecision) {
  switch (decision.reason) {
    case "assigned_to_different_executor":
      return `Sequential Queue Runner stopped because "${decision.task.title}" is assigned to another local executor.`;
    case "dependency_blocked":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because dependencies are not ready. ${
        decision.dependencyState
          ? queueDependencyBlockedSummary(decision.dependencyState)
          : "Resolve dependencies before running."
      }`;
    case "manual":
      return `Sequential Queue Runner stopped at manual task "${decision.task.title}". Operator action is required.`;
    case "paused_queue_tag":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because its queue tag is paused for coordinator review.`;
    case "previous_success_required":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because it requires a previous task completed in this runner pass.`;
    case "previous_task_not_successful":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because the previous task did not complete successfully.`;
    case "routing_blocked":
      return `Sequential Queue Runner stopped before "${decision.task.title}" because ${
        decision.blockedReasons?.[0]?.label ?? "worker routing is blocked"
      }.`;
  }
}

export function replaceQueueTask(
  tasks: AgentQueueTask[],
  updatedTask: AgentQueueTask,
) {
  return tasks.map((task) =>
    task.queueItemId === updatedTask.queueItemId ? updatedTask : task,
  );
}

export function reconcileQueueTask(
  tasks: AgentQueueTask[],
  updatedTask: AgentQueueTask,
) {
  const nextTasks = replaceQueueTask(tasks, updatedTask);
  const foundTask = nextTasks.some(
    (task) => task.queueItemId === updatedTask.queueItemId,
  );

  return sortQueueTasksForDisplay(foundTask ? nextTasks : [...nextTasks, updatedTask]);
}

export function queueRunReadinessMessage({
  allowDefaultExecutorAssignment = false,
  isDirty,
  selectedTask,
  startApiAvailable,
}: {
  allowDefaultExecutorAssignment?: boolean;
  isDirty: boolean;
  selectedTask: AgentQueueTask;
  startApiAvailable: boolean;
}) {
  if (!startApiAvailable) {
    return "Assigned-task execution is not available in this runtime.";
  }

  if (!selectedTask.assignedExecutorWidgetId && !allowDefaultExecutorAssignment) {
    return "Local executor unavailable.";
  }

  if (isDirty) {
    return "Save task edits before configuring execution.";
  }

  if (!selectedTask.prompt.trim()) {
    return "Add a task prompt before configuring execution.";
  }

  if (selectedTask.status === "draft") {
    return "Draft tasks can stay in planning without an execution workspace. Set status to queued, ready, or review needed before configuring execution.";
  }

  if (selectedTask.status === "running") {
    return "This task is already running.";
  }

  if (isFinalQueueTaskStatus(selectedTask.status)) {
    return "Final-status tasks cannot be run in this version.";
  }

  if (!isRunnableQueueTaskStatus(selectedTask.status)) {
    return `Task status cannot be run: ${statusLabel(selectedTask.status)}.`;
  }

  return null;
}

function isRunnableQueueTaskStatus(status: string) {
  return status === "queued" || status === "ready" || status === "review_needed";
}

export function queueRunStartErrorMessage(error: unknown) {
  const message = errorToMessage(error, "Unable to start assigned queue task.");

  if (/already has an active Direct Work run/i.test(message)) {
    return "Local executor is already running another task.";
  }

  if (/repo root must not be empty/i.test(message)) {
    return "Set workspace.";
  }

  if (/queue task status cannot be run/i.test(message)) {
    return message;
  }

  return message;
}

export function queueTaskDeleteBlockedReason({
  apiAvailable,
  autorunSnapshot,
  isDeleting,
  isDirty,
  runnerActiveQueueItemId,
  runnerStatus,
  selectedTask,
  tasks,
}: {
  apiAvailable: boolean;
  autorunSnapshot: AgentQueueRunnerSnapshot | null;
  isDeleting: boolean;
  isDirty: boolean;
  runnerActiveQueueItemId: string | null;
  runnerStatus: AgentQueueRunnerStatus;
  selectedTask: AgentQueueTask | null;
  tasks: AgentQueueTask[];
}) {
  if (!selectedTask) {
    return "Select a queue task before deleting.";
  }

  if (!apiAvailable) {
    return "Queue task deletion is not available in this runtime.";
  }

  if (isDirty) {
    return "Save or discard task edits before deleting.";
  }

  if (isDeleting) {
    return "Delete request is already in flight.";
  }

  if (selectedTask.status === "running") {
    return "Running tasks cannot be deleted.";
  }

  if (
    isQueueRunnerActive(runnerStatus) &&
    runnerActiveQueueItemId === selectedTask.queueItemId
  ) {
    return "This task is active in the Sequential Queue Runner.";
  }

  if (
    autorunSnapshot?.isActive &&
    autorunSnapshot.activeQueueItemId === selectedTask.queueItemId
  ) {
    return "This task is active in Queue Autorun.";
  }

  const dependents = dependentTasksForQueueItem(tasks, selectedTask.queueItemId);

  if (dependents.length > 0) {
    const dependentTitle = dependents[0]?.title.trim() || dependents[0]?.queueItemId;

    return dependents.length === 1
      ? `Remove dependency from "${dependentTitle}" before deleting this task.`
      : `Remove dependencies from ${dependents.length.toString()} tasks before deleting this task.`;
  }

  return null;
}

export function nextQueueTaskSelection(
  tasks: AgentQueueTask[],
  deletedQueueItemId: string,
) {
  const deletedIndex = tasks.findIndex(
    (task) => task.queueItemId === deletedQueueItemId,
  );
  const remainingTasks = tasks.filter(
    (task) => task.queueItemId !== deletedQueueItemId,
  );

  if (remainingTasks.length === 0) {
    return null;
  }

  if (deletedIndex < 0) {
    return remainingTasks[0]?.queueItemId ?? null;
  }

  return (
    remainingTasks[Math.min(deletedIndex, remainingTasks.length - 1)]
      ?.queueItemId ?? null
  );
}

export function defaultCodexExecutable(): string {
  return WINDOWS_CODEX_EXECUTABLE;
}

export function areStringArraysEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
}
