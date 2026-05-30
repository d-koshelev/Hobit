import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import {
  getQueueTaskDependencyState,
  normalizeQueueTag,
  queueGlobalExecutionStateDescription,
  queueGlobalExecutionStateLabel,
  type QueueGlobalStatus,
  type QueueTagPauseState,
} from "../agentQueueTaskUiModel";
import { buildAgentQueueExecutionPlanPreview } from "./agentQueueExecutionPlanModel";
import {
  reorderQueueTask,
  type QueueTaskReorderPosition,
} from "./agentQueueOrderingActions";
import { buildDemoWorkerExecutionReport } from "./useAgentQueueReportActions";
import type { AgentQueueLocalTaskFields } from "./useAgentQueueTaskActions";

type PlanningActionsContext = {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  hasOpenTaskEdit: boolean;
  isSaving: boolean;
  selectedExecutorWidgetId: string;
  selectedTask: AgentQueueTask | null;
  setAssignmentMessage: Dispatch<SetStateAction<string | null>>;
  setExecutionPlanMessage: Dispatch<SetStateAction<string | null>>;
  setGlobalExecutionState: Dispatch<SetStateAction<QueueGlobalStatus>>;
  setGlobalMessage: Dispatch<SetStateAction<string | null>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setMaxExecutorMessage: Dispatch<SetStateAction<string | null>>;
  setMaxExecutors: Dispatch<SetStateAction<number>>;
  setOrderingMessage: Dispatch<SetStateAction<string | null>>;
  setQueueTagPauseStates: Dispatch<
    SetStateAction<Map<string, QueueTagPauseState>>
  >;
  setSelectedTask: Dispatch<SetStateAction<AgentQueueTask | null>>;
  setStartError: Dispatch<SetStateAction<string | null>>;
  setTagManagementError: Dispatch<SetStateAction<string | null>>;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  setWorkerReportMessage: Dispatch<SetStateAction<string | null>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
  workerCount: number;
};

export function createAgentQueuePlanningActions({
  applyUpdatedTask,
  hasOpenTaskEdit,
  isSaving,
  selectedExecutorWidgetId,
  selectedTask,
  setAssignmentMessage,
  setExecutionPlanMessage,
  setGlobalExecutionState,
  setGlobalMessage,
  setLocalTaskFields,
  setMaxExecutorMessage,
  setMaxExecutors,
  setOrderingMessage,
  setQueueTagPauseStates,
  setSelectedTask,
  setStartError,
  setTagManagementError,
  setTasks,
  setValidationMessage,
  setWorkerReportMessage,
  tasksRef,
  workerCount,
}: PlanningActionsContext) {
  function generateExecutionPlanPreview() {
    if (!selectedTask || isSaving || hasOpenTaskEdit) {
      return;
    }

    const workerId =
      selectedTask.assignedWorkerId ??
      selectedTask.assignedExecutorWidgetId ??
      selectedExecutorWidgetId ??
      "unassigned";
    const plan = buildAgentQueueExecutionPlanPreview({
      task: selectedTask,
      workerId,
    });

    setLocalTaskFields((current) =>
      new Map(current).set(selectedTask.queueItemId, {
        ...(current.get(selectedTask.queueItemId) ?? {}),
        executionPlanPreview: plan,
      }),
    );
    applyUpdatedTask(
      {
        ...selectedTask,
        executionPlanPreview: plan,
      },
      { select: true },
    );
    setExecutionPlanMessage("Plan preview generated. No execution was started.");
    setWorkerReportMessage(null);
    setStartError(null);
    setAssignmentMessage(null);
  }

  function attachDemoWorkerReport() {
    if (!selectedTask || isSaving || hasOpenTaskEdit) {
      return;
    }

    const report = buildDemoWorkerExecutionReport({
      task: selectedTask,
      workerId:
        selectedTask.assignedWorkerId ??
        selectedTask.assignedExecutorWidgetId ??
        selectedExecutorWidgetId ??
        "unassigned",
    });
    const reports = [...(selectedTask.workerExecutionReports ?? []), report];
    const updatedTask = {
      ...selectedTask,
      coordinatorStatus: "awaiting_coordinator_review" as const,
      workerExecutionReports: reports,
    };

    setLocalTaskFields((current) =>
      new Map(current).set(selectedTask.queueItemId, {
        ...(current.get(selectedTask.queueItemId) ?? {}),
        coordinatorStatus: "awaiting_coordinator_review",
        workerExecutionReports: reports,
      }),
    );
    applyUpdatedTask(updatedTask, { select: true });
    setWorkerReportMessage(
      "Worker report attached as evidence. Awaiting validation/coordinator review; item status was not finalized.",
    );
    setExecutionPlanMessage(null);
    setStartError(null);
    setAssignmentMessage(null);
  }

  function startWorkers() {
    setGlobalExecutionState("started");
    setGlobalMessage(
      `${queueGlobalExecutionStateLabel(
        "started",
      )}: ${queueGlobalExecutionStateDescription(
        "started",
      )} This does not start real workers or run tasks automatically.`,
    );
  }

  function stopWorkers() {
    setGlobalExecutionState("stopped");
    setGlobalMessage(
      `${queueGlobalExecutionStateLabel(
        "stopped",
      )}: ${queueGlobalExecutionStateDescription(
        "stopped",
      )} Running Executor work, if any, remains owned by Agent Executor.`,
    );
  }

  function stopAndKillRunning() {
    setGlobalExecutionState("stop_kill_requested");
    setGlobalMessage(
      `${queueGlobalExecutionStateLabel(
        "stop_kill_requested",
      )}: ${queueGlobalExecutionStateDescription(
        "stop_kill_requested",
      )} Queue does not kill processes in this block.`,
    );
  }

  function updateMaxExecutors(value: string) {
    const parsedValue = Number.parseInt(value, 10);
    const nextMaxExecutors = Number.isFinite(parsedValue)
      ? Math.max(1, parsedValue)
      : 1;

    setMaxExecutorMessage(null);
    setTagManagementError(null);

    if (nextMaxExecutors < workerCount) {
      setMaxExecutorMessage(
        `Max executors cannot be lower than ${workerCount.toString()} configured worker${
          workerCount === 1 ? "" : "s"
        }. Remove workers explicitly before lowering it.`,
      );
      return;
    }

    setMaxExecutors(nextMaxExecutors);
    setMaxExecutorMessage(
      `Max executors set to ${nextMaxExecutors.toString()}. No workers were started or stopped.`,
    );
  }

  function moveSelectedTask(position: QueueTaskReorderPosition) {
    if (!selectedTask) {
      setOrderingMessage(null);
      return;
    }

    if (hasOpenTaskEdit) {
      setValidationMessage("Save current task edits before reordering tasks.");
      return;
    }

    const result = reorderQueueTask({
      position,
      queueItemId: selectedTask.queueItemId,
      tasks: tasksRef.current,
    });

    if (!result.changed) {
      setOrderingMessage("Task is already at that position.");
      return;
    }

    const queueTag = normalizeQueueTag(selectedTask);
    setLocalTaskFields((current) => {
      const next = new Map(current);
      for (const task of result.updatedTasks) {
        if (normalizeQueueTag(task).queueTagId !== queueTag.queueTagId) {
          continue;
        }
        next.set(task.queueItemId, {
          ...(next.get(task.queueItemId) ?? {}),
          orderIndex: task.orderIndex,
        });
      }
      return next;
    });
    setQueueTagPauseStates((current) =>
      new Map(current).set(queueTag.queueTagId, {
        paused: true,
        reason: "edit_review",
      }),
    );
    setTasks(result.updatedTasks);
    tasksRef.current = result.updatedTasks;
    setSelectedTask(
      result.updatedTasks.find(
        (task) => task.queueItemId === selectedTask.queueItemId,
      ) ?? selectedTask,
    );
    setOrderingMessage("Task order updated. No Queue work was started.");
    setGlobalMessage(
      "Queue order changed. The affected queue tag is paused for coordinator review.",
    );
  }

  return {
    attachDemoWorkerReport,
    generateExecutionPlanPreview,
    moveSelectedTask,
    startWorkers,
    stopAndKillRunning,
    stopWorkers,
    updateMaxExecutors,
  };
}
