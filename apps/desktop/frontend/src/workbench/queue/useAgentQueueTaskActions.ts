import type { Dispatch, SetStateAction } from "react";
import type { MutableRefObject } from "react";

import type { AgentQueueRunnerSnapshot, AgentQueueTask } from "../../workspace/types";
import {
  clamp,
  DEFAULT_TASK_TITLE,
  emptyDraft,
  errorToMessage,
  MAX_PRIORITY,
  MIN_PRIORITY,
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskDependencies,
  normalizeTaskExecutionPolicy,
  normalizeTaskStatus,
  normalizeValidationStatus,
  queueTagNameToId,
  sortQueueTasksForDisplay,
  validateDraft,
  validateQueueTaskDependencies,
  type QueueTagPauseState,
  type TaskDraft,
  type WorkerScope,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import {
  nextQueueTaskSelection,
  queueTaskDeleteBlockedReason,
  type AgentQueueRunnerStatus,
} from "./agentQueueControllerHelpers";
import {
  nextOrderIndexForQueueTag,
  withQueueOrderIndexes,
  type QueueTaskInsertPosition,
} from "./agentQueueOrderingActions";
import { staleExecutionPlanPreview } from "./agentQueueExecutionPlanModel";

export type AgentQueueLocalTaskFields = Pick<
  AgentQueueTask,
  | "assignedWorkerId"
  | "coordinatorStatus"
  | "dependsOn"
  | "itemType"
  | "orderIndex"
  | "queueTagId"
  | "queueTagName"
  | "validationStatus"
  | "executionPlanPreview"
  | "workerExecutionReports"
>;

type TaskActionsContext = Pick<
  WidgetRenderProps,
  | "onClearAgentQueueTaskAssignment"
  | "onCreateAgentQueueTask"
  | "onDeleteAgentQueueTask"
  | "onGetAgentQueueTask"
  | "onUpdateAgentQueueTask"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  autorunSnapshot: AgentQueueRunnerSnapshot | null;
  draft: TaskDraft;
  editPauseMessage: string;
  hasOpenTaskEdit: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  isDirty: boolean;
  isEditing: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isSelecting: boolean;
  loadTasks: (
    preferredTaskId?: string | null,
    options?: { preserveCurrentOnError?: boolean },
  ) => Promise<string | null>;
  mergeTaskFoundation: (task: AgentQueueTask) => AgentQueueTask;
  queueRunnerActiveQueueItemId: string | null;
  queueRunnerStatus: AgentQueueRunnerStatus;
  selectedTask: AgentQueueTask | null;
  setAssignmentError: Dispatch<SetStateAction<string | null>>;
  setAssignmentMessage: Dispatch<SetStateAction<string | null>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setDeleteMessage: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<TaskDraft>>;
  setEditorError: Dispatch<SetStateAction<string | null>>;
  setExecutionPlanMessage: Dispatch<SetStateAction<string | null>>;
  setGlobalMessage: Dispatch<SetStateAction<string | null>>;
  setIsConfirmingDelete: Dispatch<SetStateAction<boolean>>;
  setIsCreating: Dispatch<SetStateAction<boolean>>;
  setIsDeleting: Dispatch<SetStateAction<boolean>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setIsSelecting: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setOrderingMessage: Dispatch<SetStateAction<string | null>>;
  setQueueTagPauseStates: Dispatch<
    SetStateAction<Map<string, QueueTagPauseState>>
  >;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedDraft: (task: AgentQueueTask) => void;
  setTasks: Dispatch<SetStateAction<AgentQueueTask[]>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  setWorkerReportMessage: Dispatch<SetStateAction<string | null>>;
  tasksRef: MutableRefObject<AgentQueueTask[]>;
  workerScopes: Map<string, WorkerScope>;
};

export function createAgentQueueTaskActions({
  applyUpdatedTask,
  autorunSnapshot,
  draft,
  editPauseMessage,
  hasOpenTaskEdit,
  isCreating,
  isDeleting,
  isDirty,
  isEditing,
  isLoading,
  isSaving,
  isSelecting,
  loadTasks,
  mergeTaskFoundation,
  onClearAgentQueueTaskAssignment,
  onCreateAgentQueueTask,
  onDeleteAgentQueueTask,
  onGetAgentQueueTask,
  onUpdateAgentQueueTask,
  queueRunnerActiveQueueItemId,
  queueRunnerStatus,
  selectedTask,
  setAssignmentError,
  setAssignmentMessage,
  setDeleteError,
  setDeleteMessage,
  setDraft,
  setEditorError,
  setExecutionPlanMessage,
  setGlobalMessage,
  setIsConfirmingDelete,
  setIsCreating,
  setIsDeleting,
  setIsEditing,
  setIsSaving,
  setIsSelecting,
  setLoadError,
  setLocalTaskFields,
  setOrderingMessage,
  setQueueTagPauseStates,
  setSaveStateText,
  setSelectedDraft,
  setTasks,
  setValidationMessage,
  setWorkerReportMessage,
  tasksRef,
  workerScopes,
}: TaskActionsContext) {
  async function createTask(
    nextDraft?: TaskDraft,
    options?: { insertPosition?: QueueTaskInsertPosition },
  ) {
    if (!onCreateAgentQueueTask || isCreating || isLoading) {
      return false;
    }

    if (isEditing || isDirty) {
      setValidationMessage("Save current task before creating another task.");
      return false;
    }

    const taskDraft = nextDraft ?? {
      ...emptyDraft(),
      title: DEFAULT_TASK_TITLE,
    };
    const validationError = validateDraft(taskDraft);

    if (validationError) {
      setValidationMessage(validationError);
      return false;
    }

    setIsCreating(true);
    setLoadError(null);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);
    setDeleteError(null);
    setDeleteMessage(null);
    setIsConfirmingDelete(false);

    try {
      const createdTask = await onCreateAgentQueueTask({
        title: taskDraft.title.trim(),
        description: taskDraft.description,
        prompt: taskDraft.prompt,
        status: taskDraft.status,
        priority: taskDraft.priority,
        executionPolicy: taskDraft.executionPolicy,
        itemType: taskDraft.itemType,
        queueTagId: queueTagNameToId(taskDraft.queueTagName),
        queueTagName: taskDraft.queueTagName.trim(),
        validationStatus: taskDraft.validationStatus,
      });
      const taskFoundation = {
        dependsOn: [],
        itemType: taskDraft.itemType,
        orderIndex: nextOrderIndexForQueueTag({
          insertPosition: options?.insertPosition ?? "bottom",
          queueTagId: queueTagNameToId(taskDraft.queueTagName),
          tasks: tasksRef.current,
        }),
        queueTagId: queueTagNameToId(taskDraft.queueTagName),
        queueTagName: taskDraft.queueTagName.trim(),
        validationStatus: taskDraft.validationStatus,
        coordinatorStatus: "not_reported" as const,
        workerExecutionReports: [],
      };
      setLocalTaskFields((current) =>
        new Map(current).set(createdTask.queueItemId, taskFoundation),
      );
      applyUpdatedTask({ ...createdTask, ...taskFoundation }, { select: true });
      setOrderingMessage(
        options?.insertPosition === "top"
          ? "Task inserted at the top of its queue tag."
          : "Task inserted at the bottom of its queue tag.",
      );
      setIsEditing(false);
      return true;
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create queue task."));
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  async function refreshTasks() {
    if (isEditing || isDirty) {
      setValidationMessage("Save current task before refreshing the queue.");
      return;
    }

    await loadTasks(selectedTask?.queueItemId ?? null);
  }

  async function selectTask(queueItemId: string) {
    if (
      !onGetAgentQueueTask ||
      isSelecting ||
      selectedTask?.queueItemId === queueItemId
    ) {
      return;
    }

    if (isEditing || isDirty) {
      setValidationMessage("Save current task before selecting another task.");
      return;
    }

    setIsSelecting(true);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);

    try {
      const detail = await onGetAgentQueueTask(queueItemId);

      if (!detail) {
        setEditorError("The selected queue task could not be found.");
        return;
      }

      const mergedDetail = withQueueOrderIndexes([
        ...tasksRef.current.filter((task) => task.queueItemId !== detail.queueItemId),
        mergeTaskFoundation(detail),
      ]).find((task) => task.queueItemId === detail.queueItemId);
      setSelectedDraft(mergedDetail ?? detail);
      setIsEditing(false);
      setTasks((currentTasks) =>
        sortQueueTasksForDisplay(
          currentTasks.map((task) =>
            task.queueItemId === detail.queueItemId
              ? (mergedDetail ?? mergeTaskFoundation(detail))
              : task,
          ),
        ),
      );
      setSaveStateText("Saved");
      setDeleteError(null);
      setDeleteMessage(null);
      setIsConfirmingDelete(false);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to open queue task."));
    } finally {
      setIsSelecting(false);
    }
  }

  async function saveTask() {
    if (
      !selectedTask ||
      !onUpdateAgentQueueTask ||
      !isEditing ||
      !isDirty ||
      isSaving
    ) {
      return;
    }

    const validationError = validateDraft(draft);

    if (validationError) {
      setValidationMessage(validationError);
      return;
    }

    const dependencyValidationError = validateQueueTaskDependencies(
      { ...selectedTask, dependsOn: draft.dependsOn },
      tasksRef.current,
    );

    if (dependencyValidationError) {
      setValidationMessage(dependencyValidationError);
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);
    setSaveStateText("Saving");

    try {
      const updatedTask = await onUpdateAgentQueueTask({
        queueItemId: selectedTask.queueItemId,
        title: draft.title.trim(),
        description: draft.description,
        prompt: draft.prompt,
        status: draft.status,
        priority: draft.priority,
        executionPolicy: draft.executionPolicy,
        itemType: draft.itemType,
        queueTagId: queueTagNameToId(draft.queueTagName),
        queueTagName: draft.queueTagName.trim(),
        validationStatus: draft.validationStatus,
      });

      if (!updatedTask) {
        setEditorError("The selected queue task could not be found.");
        setSaveStateText("Unsaved changes");
        return;
      }

      const previousQueueTagId = normalizeQueueTag(selectedTask).queueTagId;
      const queueTagId = queueTagNameToId(draft.queueTagName);
      const validationStatus =
        draft.validationStatus === "not_started"
          ? "needs_review"
          : draft.validationStatus;
      const taskFoundation: Partial<AgentQueueTask> = {
        dependsOn: normalizeTaskDependencies(draft.dependsOn),
        executionPlanPreview: selectedTask.executionPlanPreview
          ? staleExecutionPlanPreview(selectedTask.executionPlanPreview)
          : selectedTask.executionPlanPreview,
        itemType: draft.itemType,
        orderIndex: selectedTask.orderIndex,
        queueTagId,
        queueTagName: draft.queueTagName.trim(),
        validationStatus,
        coordinatorStatus: "awaiting_coordinator_review" as const,
      };
      let taskForApply = updatedTask;
      const assignedScope = updatedTask.assignedExecutorWidgetId
        ? workerScopes.get(updatedTask.assignedExecutorWidgetId)
        : null;
      if (
        previousQueueTagId !== queueTagId &&
        assignedScope?.kind === "queue_tag" &&
        assignedScope.queueTagId !== queueTagId
      ) {
        taskFoundation.assignedWorkerId = null;
        if (onClearAgentQueueTaskAssignment) {
          try {
            taskForApply = await onClearAgentQueueTaskAssignment({
              queueItemId: selectedTask.queueItemId,
            });
            setAssignmentMessage(
              "Assignment cleared because the worker is scoped to another queue tag.",
            );
          } catch (error) {
            setAssignmentError(
              errorToMessage(
                error,
                "Task moved tags, but its scoped worker assignment could not be cleared.",
              ),
            );
          }
        } else {
          setAssignmentError(
            "Task moved tags. Recheck the scoped worker assignment before running.",
          );
        }
      }
      setQueueTagPauseStates((current) => {
        const next = new Map(current);
        next.set(queueTagId, { paused: true, reason: "edit_review" });
        if (previousQueueTagId !== queueTagId) {
          next.set(previousQueueTagId, {
            paused: true,
            reason: "edit_review",
          });
        }
        return next;
      });
      setLocalTaskFields((current) =>
        new Map(current).set(taskForApply.queueItemId, {
          ...(current.get(taskForApply.queueItemId) ?? {}),
          ...taskFoundation,
        }),
      );
      applyUpdatedTask({ ...taskForApply, ...taskFoundation }, { select: true });
      setValidationMessage(editPauseMessage);
      setExecutionPlanMessage(
        selectedTask.executionPlanPreview
          ? "Existing plan preview is stale after task edits. Refresh before execution."
          : null,
      );
      setGlobalMessage(editPauseMessage);
      setSaveStateText("Saved");
      setIsEditing(false);
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to save queue task."));
      setSaveStateText("Unsaved changes");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteSelectedTask() {
    const blockedReason = queueTaskDeleteBlockedReason({
      apiAvailable: Boolean(onDeleteAgentQueueTask),
      autorunSnapshot,
      isDeleting,
      isDirty,
      runnerActiveQueueItemId: queueRunnerActiveQueueItemId,
      runnerStatus: queueRunnerStatus,
      selectedTask,
      tasks: tasksRef.current,
    });

    setDeleteMessage(null);
    setDeleteError(null);

    if (blockedReason) {
      setDeleteError(blockedReason);
      setIsConfirmingDelete(false);
      return;
    }

    setIsConfirmingDelete(true);
  }

  function cancelDeleteSelectedTask() {
    setIsConfirmingDelete(false);
    setDeleteError(null);
  }

  async function confirmDeleteSelectedTask() {
    if (!selectedTask || !onDeleteAgentQueueTask || isDeleting) {
      return;
    }

    const blockedReason = queueTaskDeleteBlockedReason({
      apiAvailable: true,
      autorunSnapshot,
      isDeleting: false,
      isDirty,
      runnerActiveQueueItemId: queueRunnerActiveQueueItemId,
      runnerStatus: queueRunnerStatus,
      selectedTask,
      tasks: tasksRef.current,
    });

    if (blockedReason) {
      setDeleteError(blockedReason);
      setIsConfirmingDelete(false);
      return;
    }

    const deletedTaskId = selectedTask.queueItemId;
    const nextTaskId = nextQueueTaskSelection(tasksRef.current, deletedTaskId);

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const didDelete = await onDeleteAgentQueueTask({
        queueItemId: deletedTaskId,
      });

      if (!didDelete) {
        setDeleteError("The selected queue task could not be found.");
        setIsConfirmingDelete(false);
        await loadTasks(nextTaskId);
        return;
      }

      setIsConfirmingDelete(false);
      setLocalTaskFields((current) => {
        const next = new Map(current);
        next.delete(deletedTaskId);
        return next;
      });
      setDeleteMessage("Queue task deleted.");
      await loadTasks(nextTaskId);
    } catch (error) {
      setDeleteError(errorToMessage(error, "Unable to delete queue task."));
    } finally {
      setIsDeleting(false);
    }
  }

  function updateDraft(nextDraft: Partial<TaskDraft>) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...nextDraft,
    }));
    setAssignmentMessage(null);
    setValidationMessage(null);
    setDeleteMessage(null);
  }

  function updatePriority(value: string) {
    if (!isEditing) {
      return;
    }

    const parsedValue = Number.parseInt(value, 10);
    const priority = Number.isFinite(parsedValue)
      ? clamp(parsedValue, MIN_PRIORITY, MAX_PRIORITY)
      : MIN_PRIORITY;

    updateDraft({ priority });
  }

  function startEditingSelectedTask() {
    if (!selectedTask || isSaving) {
      return;
    }

    setIsEditing(true);
    setValidationMessage(null);
    setDeleteMessage(null);
    setDeleteError(null);
  }

  function cancelSelectedTaskEdits() {
    if (!selectedTask || isSaving) {
      return;
    }

    setSelectedDraft(selectedTask);
    setIsEditing(false);
    setSaveStateText("Saved");
    setValidationMessage(null);
    setEditorError(null);
  }

  return {
    cancelDeleteSelectedTask,
    cancelSelectedTaskEdits,
    confirmDeleteSelectedTask,
    createTask,
    refreshTasks,
    requestDeleteSelectedTask,
    saveTask,
    selectTask,
    startEditingSelectedTask,
    updateDraft,
    updatePriority,
  };
}
