import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  DirectWorkApprovalPolicy,
  DirectWorkSandbox,
} from "../../workspace/types";
import { errorToMessage, normalizeQueueTag, shortWidgetInstanceId } from "../agentQueueTaskUiModel";
import type { AgentQueueTaskStartRequest } from "../agentQueueTaskWidgetActions";
import type { WidgetRenderProps } from "../types";
import { queueRunStartErrorMessage } from "./agentQueueControllerHelpers";
import { staleExecutionPlanPreview } from "./agentQueueExecutionPlanModel";
import type { AgentQueueLocalTaskFields } from "./useAgentQueueTaskActions";

type RunActionsContext = Pick<
  WidgetRenderProps,
  | "onAssignAgentQueueTaskToExecutor"
  | "onClearAgentQueueTaskAssignment"
  | "onDirectWorkRunHandoffStarted"
  | "onGetAgentQueueRunnerSnapshot"
  | "onStartAgentQueueRunnerSession"
  | "onStartAssignedAgentQueueTask"
  | "onStopAgentQueueRunnerSession"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  approvalPolicy: DirectWorkApprovalPolicy;
  canAutoAssignSelectedTask: boolean;
  canArmAutorun: boolean;
  canStart: boolean;
  codexExecutable: string;
  hasOpenTaskEdit: boolean;
  isAssigning: boolean;
  isAutorunStarting: boolean;
  isAutorunStopping: boolean;
  isStarting: boolean;
  loadTasks: (
    preferredTaskId?: string | null,
    options?: { preserveCurrentOnError?: boolean },
  ) => Promise<string | null>;
  queueRunnerClearError: () => void;
  refreshLatestRunLink: (
    queueItemId: string | null | undefined,
    options?: { silent?: boolean },
  ) => Promise<void>;
  repoRoot: string;
  sandbox: DirectWorkSandbox;
  selectedExecutorWidgetId: string;
  selectedTask: AgentQueueTask | null;
  setAssignmentError: Dispatch<SetStateAction<string | null>>;
  setAssignmentMessage: Dispatch<SetStateAction<string | null>>;
  setAutorunError: Dispatch<SetStateAction<string | null>>;
  setAutorunMessage: Dispatch<SetStateAction<string | null>>;
  setAutorunSnapshot: Dispatch<SetStateAction<AgentQueueRunnerSnapshot | null>>;
  setCodexExecutableDraft: Dispatch<SetStateAction<string>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setDeleteMessage: Dispatch<SetStateAction<string | null>>;
  setIsAssigning: Dispatch<SetStateAction<boolean>>;
  setIsAutorunLoading: Dispatch<SetStateAction<boolean>>;
  setIsAutorunStarting: Dispatch<SetStateAction<boolean>>;
  setIsAutorunStopping: Dispatch<SetStateAction<boolean>>;
  setIsStarting: Dispatch<SetStateAction<boolean>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setManualExecutorOverrideTaskId: Dispatch<SetStateAction<string | null>>;
  setRepoRootDraft: Dispatch<SetStateAction<string>>;
  setSelectedExecutorWidgetId: Dispatch<SetStateAction<string>>;
  setStartError: Dispatch<SetStateAction<string | null>>;
  setStartedRunId: Dispatch<SetStateAction<string | null>>;
  setStartMessage: Dispatch<SetStateAction<string | null>>;
  startInFlightRef: MutableRefObject<boolean>;
  workerConfigsRef: MutableRefObject<
    Array<{ enabled: boolean; workerId: string }>
  >;
  workerScopes: Map<string, { kind: "all" } | { kind: "queue_tag"; queueTagId: string }>;
};

export function createAgentQueueRunActions({
  applyUpdatedTask,
  approvalPolicy,
  canAutoAssignSelectedTask,
  canArmAutorun,
  canStart,
  codexExecutable,
  hasOpenTaskEdit,
  isAssigning,
  isAutorunStarting,
  isAutorunStopping,
  loadTasks,
  onAssignAgentQueueTaskToExecutor,
  onClearAgentQueueTaskAssignment,
  onDirectWorkRunHandoffStarted,
  onGetAgentQueueRunnerSnapshot,
  onStartAgentQueueRunnerSession,
  onStartAssignedAgentQueueTask,
  onStopAgentQueueRunnerSession,
  queueRunnerClearError,
  refreshLatestRunLink,
  repoRoot,
  sandbox,
  selectedExecutorWidgetId,
  selectedTask,
  setAssignmentError,
  setAssignmentMessage,
  setAutorunError,
  setAutorunMessage,
  setAutorunSnapshot,
  setCodexExecutableDraft,
  setDeleteError,
  setDeleteMessage,
  setIsAssigning,
  setIsAutorunLoading,
  setIsAutorunStarting,
  setIsAutorunStopping,
  setIsStarting,
  setLocalTaskFields,
  setManualExecutorOverrideTaskId,
  setRepoRootDraft,
  setSelectedExecutorWidgetId,
  setStartError,
  setStartedRunId,
  setStartMessage,
  startInFlightRef,
  workerConfigsRef,
  workerScopes,
}: RunActionsContext) {
  async function assignSelectedTask() {
    if (
      !selectedTask ||
      !onAssignAgentQueueTaskToExecutor ||
      !selectedExecutorWidgetId ||
      isAssigning ||
      hasOpenTaskEdit
    ) {
      return null;
    }

    const selectedWorkerScope = workerScopes.get(selectedExecutorWidgetId);
    const selectedWorkerConfig = workerConfigsRef.current.find(
      (worker) => worker.workerId === selectedExecutorWidgetId,
    );
    const selectedTaskQueueTag = normalizeQueueTag(selectedTask);

    if (selectedWorkerConfig && !selectedWorkerConfig.enabled) {
      setAssignmentError(
        "Selected worker is disabled. Enable it before assigning new work.",
      );
      setAssignmentMessage(null);
      return null;
    }

    if (
      selectedWorkerScope?.kind === "queue_tag" &&
      selectedWorkerScope.queueTagId !== selectedTaskQueueTag.queueTagId
    ) {
      setAssignmentError(
        "Selected worker is scoped to another queue tag. Choose a matching worker or change the worker scope.",
      );
      setAssignmentMessage(null);
      return null;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const updatedTask = await onAssignAgentQueueTaskToExecutor({
        executorWidgetInstanceId: selectedExecutorWidgetId,
        queueItemId: selectedTask.queueItemId,
      });
      setLocalTaskFields((current) =>
        new Map(current).set(updatedTask.queueItemId, {
          ...(current.get(updatedTask.queueItemId) ?? {}),
          assignedWorkerId: selectedExecutorWidgetId,
          executionPlanPreview: selectedTask.executionPlanPreview
            ? staleExecutionPlanPreview(selectedTask.executionPlanPreview, {
                workerId: selectedExecutorWidgetId,
              })
            : selectedTask.executionPlanPreview,
        }),
      );
      applyUpdatedTask(
        {
          ...updatedTask,
          assignedWorkerId: selectedExecutorWidgetId,
          executionPlanPreview: selectedTask.executionPlanPreview
            ? staleExecutionPlanPreview(selectedTask.executionPlanPreview, {
                workerId: selectedExecutorWidgetId,
              })
            : selectedTask.executionPlanPreview,
        },
        { select: true },
      );
      setAssignmentMessage(
        selectedTask.executionPlanPreview
          ? "Assignment saved. Existing plan preview is stale for this worker."
          : "Assignment saved.",
      );
      return updatedTask;
    } catch (error) {
      setAssignmentError(errorToMessage(error, "Unable to assign queue task."));
      return null;
    } finally {
      setIsAssigning(false);
    }
  }

  async function clearSelectedTaskAssignment() {
    if (
      !selectedTask ||
      !onClearAgentQueueTaskAssignment ||
      isAssigning ||
      hasOpenTaskEdit
    ) {
      return;
    }

    setIsAssigning(true);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const updatedTask = await onClearAgentQueueTaskAssignment({
        queueItemId: selectedTask.queueItemId,
      });
      setLocalTaskFields((current) =>
        new Map(current).set(updatedTask.queueItemId, {
          ...(current.get(updatedTask.queueItemId) ?? {}),
          assignedWorkerId: null,
          executionPlanPreview: selectedTask.executionPlanPreview
            ? staleExecutionPlanPreview(selectedTask.executionPlanPreview, {
                workerId: "unassigned",
              })
            : selectedTask.executionPlanPreview,
        }),
      );
      applyUpdatedTask(
        {
          ...updatedTask,
          assignedWorkerId: null,
          executionPlanPreview: selectedTask.executionPlanPreview
            ? staleExecutionPlanPreview(selectedTask.executionPlanPreview, {
                workerId: "unassigned",
              })
            : selectedTask.executionPlanPreview,
        },
        { select: true },
      );
      setAssignmentMessage(
        selectedTask.executionPlanPreview
          ? "Assignment cleared. Existing plan preview is stale."
          : "Assignment cleared.",
      );
    } catch (error) {
      setAssignmentError(
        errorToMessage(error, "Unable to clear queue task assignment."),
      );
    } finally {
      setIsAssigning(false);
    }
  }

  async function startAssignedTask() {
    if (
      !selectedTask ||
      !canStart ||
      !onStartAssignedAgentQueueTask ||
      startInFlightRef.current
    ) {
      return;
    }

    startInFlightRef.current = true;
    setIsStarting(true);
    setStartMessage(null);
    setStartedRunId(null);
    setStartError(null);

    let taskForRun = selectedTask;

    if (taskForRun.assignedExecutorWidgetId !== selectedExecutorWidgetId) {
      if (!canAutoAssignSelectedTask) {
        setStartError("Assign a local executor before running this task.");
        startInFlightRef.current = false;
        setIsStarting(false);
        return;
      }

      const assignedTask = await assignSelectedTask();

      if (!assignedTask) {
        setStartError("Local executor assignment failed. No work was started.");
        startInFlightRef.current = false;
        setIsStarting(false);
        return;
      }

      taskForRun = assignedTask;
    }

    const request: AgentQueueTaskStartRequest = {
      approvalPolicy,
      codexExecutable,
      queueItemId: taskForRun.queueItemId,
      repoRoot,
      sandbox,
    };

    try {
      const response = await onStartAssignedAgentQueueTask(request);
      onDirectWorkRunHandoffStarted?.({
        executorWidgetInstanceId: response.executorWidgetInstanceId,
        queueItemId: response.queueItemId,
        repoRoot: request.repoRoot,
        runId: response.runId,
        startedAt: new Date().toISOString(),
        taskTitle: taskForRun.title,
        workbenchId: response.workbenchId,
        workspaceId: response.workspaceId,
      });
      await loadTasks(response.queueItemId);
      await refreshLatestRunLink(response.queueItemId, { silent: true });
      setStartMessage(
        `Task started in Agent Executor ${shortWidgetInstanceId(
          response.executorWidgetInstanceId,
        )}.`,
      );
      setStartedRunId(response.runId);
    } catch (error) {
      setStartError(queueRunStartErrorMessage(error));
    } finally {
      startInFlightRef.current = false;
      setIsStarting(false);
    }
  }

  async function refreshAutorunSnapshot(options?: { silent?: boolean }) {
    if (!onGetAgentQueueRunnerSnapshot) {
      setAutorunSnapshot(null);
      setAutorunError(
        "Queue Autorun is only available in the Tauri desktop shell.",
      );
      return;
    }

    if (!options?.silent) {
      setIsAutorunLoading(true);
      setAutorunError(null);
    }

    try {
      const snapshot = await onGetAgentQueueRunnerSnapshot();
      setAutorunSnapshot(snapshot);
      await refreshLatestRunLink(
        snapshot.activeQueueItemId ?? selectedTask?.queueItemId ?? null,
        { silent: true },
      );
      if (!options?.silent) {
        setAutorunMessage("Queue Autorun status refreshed.");
      }
    } catch (error) {
      setAutorunError(
        errorToMessage(error, "Unable to refresh Queue Autorun status."),
      );
    } finally {
      if (!options?.silent) {
        setIsAutorunLoading(false);
      }
    }
  }

  async function armAutorunSession() {
    if (
      !onStartAgentQueueRunnerSession ||
      !selectedExecutorWidgetId ||
      !canArmAutorun ||
      isAutorunStarting
    ) {
      return;
    }

    setIsAutorunStarting(true);
    setAutorunError(null);
    setAutorunMessage(null);

    try {
      const snapshot = await onStartAgentQueueRunnerSession({
        approvalPolicy,
        codexExecutable,
        executorWidgetInstanceId: selectedExecutorWidgetId,
        policy: {
          stopOnCancel: true,
          stopOnFailure: true,
          stopOnReviewNeeded: true,
        },
        repoRoot,
        sandbox,
      });
      setAutorunSnapshot(snapshot);
      if (snapshot.activeQueueItemId && snapshot.waitingRunId) {
        await loadTasks(snapshot.activeQueueItemId, {
          preserveCurrentOnError: true,
        });
        await refreshLatestRunLink(snapshot.activeQueueItemId, {
          silent: true,
        });
      }
      setAutorunMessage(
        snapshot.activeQueueItemId
          ? "Queue Autorun started. It will continue automatically while Hobit is open."
          : "Queue Autorun found no eligible task to start.",
      );
    } catch (error) {
      setAutorunError(errorToMessage(error, "Unable to arm Queue Autorun."));
    } finally {
      setIsAutorunStarting(false);
    }
  }

  async function stopAutorunSession() {
    if (!onStopAgentQueueRunnerSession || isAutorunStopping) {
      return;
    }

    setIsAutorunStopping(true);
    setAutorunError(null);
    setAutorunMessage(null);

    try {
      const snapshot = await onStopAgentQueueRunnerSession();
      setAutorunSnapshot(snapshot);
      setAutorunMessage("Queue Autorun session stopped.");
    } catch (error) {
      setAutorunError(errorToMessage(error, "Unable to stop Queue Autorun."));
    } finally {
      setIsAutorunStopping(false);
    }
  }

  function selectExecutorWidget(executorWidgetInstanceId: string) {
    setSelectedExecutorWidgetId(executorWidgetInstanceId);
    setManualExecutorOverrideTaskId(selectedTask?.queueItemId ?? null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    queueRunnerClearError();
  }

  function updateRepoRootDraft(repoRootValue: string) {
    setRepoRootDraft(repoRootValue);
    setStartError(null);
    setDeleteError(null);
    setDeleteMessage(null);
  }

  function updateCodexExecutableDraft(codexExecutableValue: string) {
    setCodexExecutableDraft(codexExecutableValue);
    setStartError(null);
  }

  return {
    armAutorunSession,
    assignSelectedTask,
    clearSelectedTaskAssignment,
    refreshAutorunSnapshot,
    selectExecutorWidget,
    startAssignedTask,
    stopAutorunSession,
    updateCodexExecutableDraft,
    updateRepoRootDraft,
  };
}
