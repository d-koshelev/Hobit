import type { AgentQueueRunnerSnapshot, AgentQueueTask } from "../../workspace/types";
import type { AgentExecutorSlot } from "../types";
import {
  getQueueTaskDependencyState,
  normalizeQueueTag,
  queueDependencyReadinessMessage,
  selectBestAvailableExecutorForTask,
  type AgentQueueDependencyState,
  type AgentWorkerSummary,
  type QueueGlobalStatus,
} from "../agentQueueTaskUiModel";
import {
  queueAutorunPreconditionMessages,
  queueRunReadinessMessage,
  runPreconditionMessages,
} from "./agentQueueControllerHelpers";
import {
  firstRoutingBlockedReasonLabel,
  type AgentQueueAssignedWorkerRoutingState,
} from "./agentQueueRoutingModel";

type SelectedRunStateInput = {
  agentExecutorSlots: AgentExecutorSlot[];
  assignedWorkerRoutingStates: ReadonlyMap<
    string,
    AgentQueueAssignedWorkerRoutingState
  >;
  assignmentApiAvailable: boolean;
  codexExecutable: string;
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>;
  globalExecutionState: QueueGlobalStatus;
  hasOpenTaskEdit: boolean;
  isStarting: boolean;
  manualExecutorOverrideTaskId: string | null;
  pausedQueueTagIds: ReadonlySet<string>;
  repoRoot: string;
  selectedExecutorWidgetId: string;
  selectedTask: AgentQueueTask | null;
  selectedTaskApprovalPolicy: string;
  selectedTaskSandbox: string;
  startApiAvailable: boolean;
  tasks: AgentQueueTask[];
  workers: AgentWorkerSummary[];
};

export function buildAgentQueueSelectedRunState({
  agentExecutorSlots,
  assignedWorkerRoutingStates,
  assignmentApiAvailable,
  codexExecutable,
  dependencyStates,
  globalExecutionState,
  hasOpenTaskEdit,
  isStarting,
  manualExecutorOverrideTaskId,
  pausedQueueTagIds,
  repoRoot,
  selectedExecutorWidgetId,
  selectedTask,
  selectedTaskApprovalPolicy,
  selectedTaskSandbox,
  startApiAvailable,
  tasks,
  workers,
}: SelectedRunStateInput) {
  const selectedQueueTagId = selectedTask
    ? normalizeQueueTag(selectedTask).queueTagId
    : null;
  const selectedQueueTagPaused = Boolean(
    selectedQueueTagId && pausedQueueTagIds.has(selectedQueueTagId),
  );
  const selectedTaskAssignedWorkerRouting = selectedTask
    ? assignedWorkerRoutingStates.get(selectedTask.queueItemId)
    : null;
  const selectedExecutorSelection = selectBestAvailableExecutorForTask({
    currentSelection: selectedExecutorWidgetId,
    executorSlots: agentExecutorSlots,
    manualOverride: selectedTask
      ? manualExecutorOverrideTaskId === selectedTask.queueItemId
      : false,
    task: selectedTask,
    workers,
  });
  const selectedTaskRoutingMessage =
    selectedTaskAssignedWorkerRouting &&
    selectedTaskAssignedWorkerRouting.blockedReasons.length > 0
      ? firstRoutingBlockedReasonLabel(
          selectedTaskAssignedWorkerRouting.blockedReasons.filter(
            (reason) => reason.code !== "queue_stopped",
          ),
        )
      : null;
  const globalRunBlockMessage =
    globalExecutionState === "stop_kill_requested"
      ? "STOP + KILL RUNNING is requested. Review running work or click Enable before starting new work."
      : null;
  const canUseDefaultLocalExecutor = Boolean(
    selectedTask &&
      selectedExecutorSelection.executorWidgetId &&
      (agentExecutorSlots.find(
        (slot) =>
          slot.widgetInstanceId === selectedExecutorSelection.executorWidgetId,
      )?.ownerKind === "agent_queue" ||
        assignmentApiAvailable) &&
      selectedTask.assignedExecutorWidgetId !==
        selectedExecutorSelection.executorWidgetId &&
      selectedExecutorWidgetId,
  );
  const effectiveSelectedTaskRoutingMessage =
    canUseDefaultLocalExecutor &&
    (selectedTaskAssignedWorkerRouting?.blockedReasons.some(
      (reason) =>
        reason.code === "assigned_worker_unavailable" ||
        reason.code === "worker_disabled" ||
        reason.code === "worker_scope_mismatch",
    ) ??
      false)
      ? null
      : selectedTaskRoutingMessage;
  const executorAvailabilityMessage =
    selectedTask && !selectedExecutorSelection.executorWidgetId
      ? "Local executor unavailable."
      : null;
  const readinessMessage = globalRunBlockMessage
    ? globalRunBlockMessage
    : selectedQueueTagPaused
      ? "Resume this queue tag before running the selected task."
      : selectedTask
        ? executorAvailabilityMessage ??
          queueRunReadinessMessage({
            allowDefaultExecutorAssignment: canUseDefaultLocalExecutor,
            isDirty: hasOpenTaskEdit,
            selectedTask,
            startApiAvailable,
          }) ??
          queueDependencyReadinessMessage(
            dependencyStates.get(selectedTask.queueItemId) ??
              getQueueTaskDependencyState(selectedTask, tasks),
          ) ??
          effectiveSelectedTaskRoutingMessage
        : "Local executor unavailable.";
  const preconditionMessages = readinessMessage
    ? []
    : runPreconditionMessages({
        codexExecutable,
        isStarting,
        repoRoot,
      }).map((message) =>
        message === "Set workspace." ? "Set task workspace." : message,
      );

  if (!readinessMessage && selectedTask && !selectedTaskSandbox) {
    preconditionMessages.push("Set sandbox.");
  }

  if (!readinessMessage && selectedTask && !selectedTaskApprovalPolicy) {
    preconditionMessages.push("Set approval policy.");
  }

  return {
    canStart: !readinessMessage && preconditionMessages.length === 0,
    canUseDefaultLocalExecutor,
    preconditionMessages,
    readinessMessage,
    selectedExecutorSelection,
  };
}

type AutorunStateInput = {
  agentExecutorSlots: AgentExecutorSlot[];
  assignedWorkerRoutingStates: ReadonlyMap<
    string,
    AgentQueueAssignedWorkerRoutingState
  >;
  autorunApiAvailable: boolean;
  autorunSnapshot: AgentQueueRunnerSnapshot | null;
  codexExecutable: string;
  dependencyStates: ReadonlyMap<string, AgentQueueDependencyState>;
  globalExecutionState: QueueGlobalStatus;
  isAutorunLoading: boolean;
  isAutorunStarting: boolean;
  isAutorunStopping: boolean;
  pausedQueueTagIds: ReadonlySet<string>;
  repoRoot: string;
  selectedExecutorWidgetId: string;
  tasks: AgentQueueTask[];
};

export function buildAgentQueueAutorunState({
  agentExecutorSlots,
  assignedWorkerRoutingStates,
  autorunApiAvailable,
  autorunSnapshot,
  codexExecutable,
  dependencyStates,
  globalExecutionState,
  isAutorunLoading,
  isAutorunStarting,
  isAutorunStopping,
  pausedQueueTagIds,
  repoRoot,
  selectedExecutorWidgetId,
  tasks,
}: AutorunStateInput) {
  const autorunSelectedExecutor = agentExecutorSlots.find(
    (slot) => slot.widgetInstanceId === selectedExecutorWidgetId,
  );
  const autorunPreconditionMessages = queueAutorunPreconditionMessages({
    apiAvailable: autorunApiAvailable,
    codexExecutable,
    globalExecutionState,
    hasExecutorSelection: Boolean(selectedExecutorWidgetId),
    isStarting: isAutorunStarting,
    repoRoot,
  });

  if (pausedQueueTagIds.size > 0) {
    autorunPreconditionMessages.unshift(
      "Resume paused queue tags before arming Queue Autorun.",
    );
  }

  if (
    Array.from(dependencyStates.values()).some(
      (dependencyState) => dependencyState.status !== "ready",
    )
  ) {
    autorunPreconditionMessages.unshift(
      "Resolve blocked or invalid queue dependencies before arming Queue Autorun.",
    );
  }

  if (selectedExecutorWidgetId) {
    const hasEligibleAssignedAutorunTask = tasks.some((task) => {
      const assignedWorkerId =
        task.assignedWorkerId ?? task.assignedExecutorWidgetId;
      const routingState = assignedWorkerRoutingStates.get(task.queueItemId);

      return (
        assignedWorkerId === selectedExecutorWidgetId &&
        task.executionPolicy === "auto" &&
        Boolean(routingState?.canTake)
      );
    });
    const hasContextAttachedAutorunTask = tasks.some((task) => {
      const assignedWorkerId =
        task.assignedWorkerId ?? task.assignedExecutorWidgetId;
      const routingState = assignedWorkerRoutingStates.get(task.queueItemId);
      const contextSummary = task.context
        ? task.context.attachedKnowledgeRefs.length +
          task.context.attachedSkillRefs.length
        : 0;

      return (
        assignedWorkerId === selectedExecutorWidgetId &&
        task.executionPolicy === "auto" &&
        contextSummary > 0 &&
        Boolean(routingState?.canTake)
      );
    });

    if (!hasEligibleAssignedAutorunTask) {
      autorunPreconditionMessages.unshift(
        "No assigned auto task is currently eligible for the selected worker.",
      );
    } else if (hasContextAttachedAutorunTask) {
      autorunPreconditionMessages.unshift(
        "Attached Queue context requires a visible manual or frontend runner start before execution.",
      );
    }
  }

  const isAutorunActive = Boolean(autorunSnapshot?.isActive);

  return {
    autorunPreconditionMessages,
    autorunSelectedExecutorLabel: autorunSelectedExecutor?.label ?? null,
    canArmAutorun:
      autorunPreconditionMessages.length === 0 &&
      !isAutorunActive &&
      !isAutorunLoading &&
      !isAutorunStopping,
    isAutorunActive,
  };
}
