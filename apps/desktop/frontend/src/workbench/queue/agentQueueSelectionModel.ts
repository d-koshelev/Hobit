import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import {
  emptyDraft,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskDependencies,
  normalizeTaskExecutionPolicy,
  normalizeTaskPriority,
  normalizeTaskStatus,
  normalizeValidationStatus,
  sortQueueTasksForDisplay,
  type TaskDraft,
} from "../agentQueueTaskUiModel";
import { reconcileQueueTask } from "./agentQueueControllerHelpers";
import type { AgentQueueLocalTaskFields } from "./useAgentQueueTaskActions";

type QueueSelectionModelContext = {
  localTaskFieldsRef: MutableRefObject<Map<string, AgentQueueLocalTaskFields>>;
  selectedTask: AgentQueueTask | null;
  setDraft: Dispatch<SetStateAction<TaskDraft>>;
  setExecutionPlanMessage: Dispatch<SetStateAction<string | null>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedTask: Dispatch<SetStateAction<AgentQueueTask | null>>;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  setWorkerReportMessage: Dispatch<SetStateAction<string | null>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
};

export function createAgentQueueSelectionModel({
  localTaskFieldsRef,
  selectedTask,
  setDraft,
  setExecutionPlanMessage,
  setIsEditing,
  setSaveStateText,
  setSelectedTask,
  setTasks,
  setWorkerReportMessage,
  tasksRef,
}: QueueSelectionModelContext) {
  function setSelectedDraft(task: AgentQueueTask) {
    const mergedTask = mergeTaskFoundation(task);
    const queueTag = normalizeQueueTag(mergedTask);
    setSelectedTask(mergedTask);
    setDraft({
      dependsOn: normalizeTaskDependencies(mergedTask.dependsOn),
      description: mergedTask.description,
      executionPolicy: normalizeTaskExecutionPolicy(mergedTask.executionPolicy),
      itemType: normalizeItemType(mergedTask.itemType),
      priority: mergedTask.priority,
      prompt: mergedTask.prompt,
      queueTagName: queueTag.queueTagName,
      status: normalizeTaskStatus(mergedTask.status),
      title: mergedTask.title,
      validationStatus: normalizeValidationStatus(mergedTask.validationStatus),
    });
    setExecutionPlanMessage(null);
    setWorkerReportMessage(null);
  }

  function applyUpdatedTask(
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) {
    const existingTask = tasksRef.current.find(
      (candidate) => candidate.queueItemId === task.queueItemId,
    );
    const mergedTask = mergeTaskFoundation({
      ...task,
      orderIndex: task.orderIndex ?? existingTask?.orderIndex,
    });
    const nextTasks = reconcileQueueTask(tasksRef.current, mergedTask);
    tasksRef.current = nextTasks;
    setTasks(nextTasks);

    if (options?.select || selectedTask?.queueItemId === mergedTask.queueItemId) {
      setSelectedDraft(mergedTask);
    }
  }

  function clearSelectedTask() {
    setSelectedTask(null);
    setDraft(emptyDraft());
    setSaveStateText("Saved");
    setIsEditing(false);
  }

  function mergeTaskFoundation(task: AgentQueueTask): AgentQueueTask {
    const localFields = localTaskFieldsRef.current.get(task.queueItemId);
    const queueTag = normalizeQueueTag({
      queueTagId: localFields?.queueTagId ?? task.queueTagId,
      queueTagName: localFields?.queueTagName ?? task.queueTagName,
    });

    return {
      ...task,
      assignedWorkerId:
        localFields?.assignedWorkerId ??
        task.assignedWorkerId ??
        task.assignedExecutorWidgetId,
      coordinatorStatus:
        localFields?.coordinatorStatus ??
        task.coordinatorStatus ??
        "not_reported",
      dependsOn: normalizeTaskDependencies(
        localFields?.dependsOn ?? task.dependsOn,
      ),
      executionPlanPreview:
        task.executionPlanPreview !== undefined
          ? task.executionPlanPreview
          : localFields?.executionPlanPreview ?? null,
      itemType: localFields?.itemType ?? normalizeItemType(task.itemType),
      orderIndex: localFields?.orderIndex ?? task.orderIndex,
      priority: normalizeTaskPriority(task.priority),
      queueTagId: queueTag.queueTagId,
      queueTagName: queueTag.queueTagName,
      validationStatus:
        localFields?.validationStatus ??
        normalizeValidationStatus(task.validationStatus),
      workerExecutionReports:
        task.workerExecutionReports !== undefined
          ? task.workerExecutionReports
          : localFields?.workerExecutionReports ?? [],
    };
  }

  return {
    applyUpdatedTask,
    clearSelectedTask,
    mergeTaskFoundation,
    setSelectedDraft,
  };
}
