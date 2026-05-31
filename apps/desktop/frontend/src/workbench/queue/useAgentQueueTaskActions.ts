import type { Dispatch, SetStateAction } from "react";
import type { MutableRefObject } from "react";

import type {
  AgentQueueCoordinatorStatus,
  AgentQueueReportActionType,
  AgentQueueRunnerSnapshot,
  AgentQueueTask,
  AgentQueueTaskStatus,
  AgentQueueTaskValidationStatus,
} from "../../workspace/types";
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
import {
  buildDiffReviewMetadata,
  buildDiffReviewPrompt,
  canCreateDiffReviewItem,
  latestWorkerExecutionReport,
} from "./agentQueueDiffReviewModel";

export type AgentQueueLocalTaskFields = Pick<
  AgentQueueTask,
  | "assignedWorkerId"
  | "coordinatorStatus"
  | "dependsOn"
  | "diffReview"
  | "itemType"
  | "orderIndex"
  | "queueTagId"
  | "queueTagName"
  | "validationStatus"
  | "executionPlanPreview"
  | "workerExecutionReports"
  | "workspaceChatReportCardId"
  | "workspaceChatReportCardStatus"
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
  setCoordinatorFinalizationMessage: Dispatch<SetStateAction<string | null>>;
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
  setCoordinatorFinalizationMessage,
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

  async function createDiffReviewTask() {
    if (
      !selectedTask ||
      !onCreateAgentQueueTask ||
      isCreating ||
      isLoading ||
      isSaving ||
      hasOpenTaskEdit ||
      !canCreateDiffReviewItem(selectedTask)
    ) {
      return false;
    }

    const report = latestWorkerExecutionReport(selectedTask);
    const queueTag = normalizeQueueTag(selectedTask);
    const metadata = buildDiffReviewMetadata({
      report,
      sourceTask: selectedTask,
    });
    const prompt = buildDiffReviewPrompt({
      report,
      sourceTask: selectedTask,
    });

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
        description:
          "Review the source implementation diff against the worker report, declared scope, and Hobit contracts.",
        executionPolicy: "manual",
        itemType: "diff_review",
        priority: selectedTask.priority,
        prompt,
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        status: "queued",
        title: `Diff review: ${selectedTask.title.trim() || DEFAULT_TASK_TITLE}`,
        validationStatus: "not_started",
      });
      const taskFoundation = {
        coordinatorStatus: "not_reported" as const,
        dependsOn: [],
        diffReview: metadata,
        itemType: "diff_review" as const,
        orderIndex: nextOrderIndexForQueueTag({
          insertPosition: "bottom",
          queueTagId: queueTag.queueTagId,
          tasks: tasksRef.current,
        }),
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        validationStatus: "not_started" as const,
        workerExecutionReports: [],
      };

      setLocalTaskFields((current) =>
        new Map(current).set(createdTask.queueItemId, taskFoundation),
      );
      applyUpdatedTask({ ...createdTask, ...taskFoundation }, { select: true });
      setWorkerReportMessage(
        "Diff review item created. It is queued independently and no Executor, Codex, validation, or source finalization was started.",
      );
      setExecutionPlanMessage(null);
      setOrderingMessage("Diff review item inserted at the bottom of its queue tag.");
      setIsEditing(false);
      return true;
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to create diff review item."));
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  async function applyCoordinatorFinalization(
    actionType: AgentQueueReportActionType,
  ) {
    if (!selectedTask || hasOpenTaskEdit || isSaving || isCreating) {
      return false;
    }

    if (actionType === "create_follow_up") {
      return createFollowUpTaskFromSelectedTask();
    }

    const decision = coordinatorDecisionForAction(actionType);

    if (!decision) {
      setCoordinatorFinalizationMessage(
        "Coordinator action is not supported for Queue finalization.",
      );
      return false;
    }

    setIsSaving(true);
    setEditorError(null);
    setCoordinatorFinalizationMessage(null);
    setValidationMessage(null);

    try {
      const updatedTask = onUpdateAgentQueueTask
        ? await onUpdateAgentQueueTask({
            description: selectedTask.description,
            executionPolicy: normalizeTaskExecutionPolicy(
              selectedTask.executionPolicy,
            ),
            itemType: normalizeItemType(selectedTask.itemType),
            priority: selectedTask.priority,
            prompt: selectedTask.prompt,
            queueItemId: selectedTask.queueItemId,
            queueTagId: normalizeQueueTag(selectedTask).queueTagId,
            queueTagName: normalizeQueueTag(selectedTask).queueTagName,
            status: decision.status,
            title: selectedTask.title,
            validationStatus: decision.validationStatus,
          })
        : selectedTask;

      if (!updatedTask) {
        setCoordinatorFinalizationMessage(
          "The source Queue item could not be found. No hidden work ran.",
        );
        return false;
      }

      const taskFoundation: Partial<AgentQueueTask> = {
        coordinatorStatus: decision.coordinatorStatus,
        validationStatus: decision.validationStatus,
      };
      setLocalTaskFields((current) =>
        new Map(current).set(updatedTask.queueItemId, {
          ...(current.get(updatedTask.queueItemId) ?? {}),
          ...taskFoundation,
        }),
      );
      applyUpdatedTask(
        {
          ...updatedTask,
          ...taskFoundation,
          status: decision.status,
        },
        { select: true },
      );
      setCoordinatorFinalizationMessage(decision.message);
      setSaveStateText("Saved");
      return true;
    } catch (error) {
      setCoordinatorFinalizationMessage(
        errorToMessage(error, "Unable to apply coordinator finalization action."),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function createFollowUpTaskFromSelectedTask() {
    if (!selectedTask || !onCreateAgentQueueTask || isCreating || isSaving) {
      setCoordinatorFinalizationMessage(
        "Queue task creation is unavailable. No follow-up work ran.",
      );
      return false;
    }

    const queueTag = normalizeQueueTag(selectedTask);
    const report =
      selectedTask.workerExecutionReports?.[
        selectedTask.workerExecutionReports.length - 1
      ] ?? null;

    setIsCreating(true);
    setCoordinatorFinalizationMessage(null);
    setEditorError(null);
    setValidationMessage(null);

    try {
      const createdTask = await onCreateAgentQueueTask({
        description: `Follow-up/sub-block for ${selectedTask.title.trim() || DEFAULT_TASK_TITLE}.`,
        executionPolicy: "manual",
        itemType: "follow_up",
        priority: selectedTask.priority,
        prompt: followUpPromptFromTask(selectedTask),
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        status: "queued",
        title: `Follow-up: ${selectedTask.title.trim() || DEFAULT_TASK_TITLE}`,
        validationStatus: "not_started",
      });
      const createdFoundation = {
        coordinatorStatus: "not_reported" as const,
        dependsOn: [],
        itemType: "follow_up" as const,
        orderIndex: nextOrderIndexForQueueTag({
          insertPosition: "bottom",
          queueTagId: queueTag.queueTagId,
          tasks: tasksRef.current,
        }),
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        validationStatus: "not_started" as const,
        workerExecutionReports: [],
      };
      const sourceFoundation = {
        coordinatorStatus: "follow_up_required" as const,
        validationStatus: "needs_review" as const,
      };

      setLocalTaskFields((current) => {
        const next = new Map(current);
        next.set(createdTask.queueItemId, createdFoundation);
        next.set(selectedTask.queueItemId, {
          ...(next.get(selectedTask.queueItemId) ?? {}),
          ...sourceFoundation,
        });
        return next;
      });
      const nextTasks = sortQueueTasksForDisplay([
        ...tasksRef.current.map((task) =>
          task.queueItemId === selectedTask.queueItemId
            ? {
                ...task,
                ...sourceFoundation,
                status: "review_needed" as const,
              }
            : task,
        ),
        { ...createdTask, ...createdFoundation },
      ]);

      tasksRef.current = nextTasks;
      setTasks(nextTasks);
      applyUpdatedTask(
        {
          ...selectedTask,
          ...sourceFoundation,
          status: "review_needed",
        },
        { select: true },
      );
      setCoordinatorFinalizationMessage(
        `Follow-up item ${createdTask.queueItemId} was queued. Source remains follow-up required; no work was started.${report?.reportId ? ` Source report: ${report.reportId}.` : ""}`,
      );
      return true;
    } catch (error) {
      setCoordinatorFinalizationMessage(
        errorToMessage(error, "Unable to create follow-up item."),
      );
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
    createDiffReviewTask,
    applyCoordinatorFinalization,
    refreshTasks,
    requestDeleteSelectedTask,
    saveTask,
    selectTask,
    startEditingSelectedTask,
    updateDraft,
    updatePriority,
  };
}

function coordinatorDecisionForAction(
  actionType: AgentQueueReportActionType,
):
  | {
      coordinatorStatus: AgentQueueCoordinatorStatus;
      message: string;
      status: AgentQueueTaskStatus;
      validationStatus: AgentQueueTaskValidationStatus;
    }
  | null {
  switch (actionType) {
    case "mark_ready_for_finalization":
      return {
        coordinatorStatus: "ready_for_finalization",
        message:
          "Marked ready for coordinator finalization. No dependent item was started.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "finalize_accept_item":
      return {
        coordinatorStatus: "finalized",
        message:
          "Finalized / accepted by coordinator. Dependencies may now be eligible in dry-run only; no work was started.",
        status: "completed",
        validationStatus: "passed",
      };
    case "mark_needs_changes":
      return {
        coordinatorStatus: "needs_changes",
        message:
          "Marked needs changes. Dependencies remain blocked; create a follow-up when ready.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_follow_up_required":
      return {
        coordinatorStatus: "follow_up_required",
        message:
          "Marked follow-up required. Dependencies remain blocked until reviewed and accepted.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_blocked":
      return {
        coordinatorStatus: "blocked",
        message:
          "Marked blocked by coordinator. The item remains visible and no follow-up was auto-run.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    case "mark_failed_rejected":
      return {
        coordinatorStatus: "failed",
        message:
          "Marked failed / rejected by coordinator. Evidence is preserved and rollback was not executed.",
        status: "failed",
        validationStatus: "failed",
      };
    case "mark_rollback_required":
      return {
        coordinatorStatus: "rollback_required",
        message:
          "Marked rollback required as a coordinator decision marker only. No rollback, git reset, or process kill ran.",
        status: "review_needed",
        validationStatus: "needs_review",
      };
    default:
      return null;
  }
}

function followUpPromptFromTask(task: AgentQueueTask) {
  const report = task.workerExecutionReports?.[
    task.workerExecutionReports.length - 1
  ];

  return [
    `Follow-up/sub-block for Queue item ${task.queueItemId}.`,
    "",
    `Source title: ${task.title.trim() || DEFAULT_TASK_TITLE}`,
    `Source status: ${task.status}`,
    `Coordinator decision: follow-up required`,
    report ? `Source report: ${report.reportId}` : null,
    report?.summary ? `Report summary: ${report.summary}` : null,
    report?.followUpRecommendation
      ? `Follow-up recommendation: ${report.followUpRecommendation}`
      : "Follow-up recommendation: coordinator requested changes before finalization.",
    "",
    "Do not run automatically. Complete this focused sub-block and return it for coordinator review.",
  ]
    .filter(Boolean)
    .join("\n");
}
