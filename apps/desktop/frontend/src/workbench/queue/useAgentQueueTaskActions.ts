import type {
  AgentQueueReportActionType,
  AgentQueueTask,
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
  type TaskDraft,
} from "../agentQueueTaskUiModel";
import {
  nextQueueTaskSelection,
  queueTaskDeleteBlockedReason,
} from "./agentQueueControllerHelpers";
import { coordinatorDecisionForAction } from "./agentQueueTaskCoordinatorActions";
import { createFollowUpTaskFromSelectedTask } from "./agentQueueTaskFollowUpActions";
import type { TaskActionsContext } from "./agentQueueTaskActionTypes";
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

export type { AgentQueueLocalTaskFields } from "./agentQueueTaskActionTypes";

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
  localTaskFieldsRef,
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
        approvalPolicy: taskDraft.approvalPolicy || null,
        codexExecutable: taskDraft.codexExecutable.trim() || null,
        title: taskDraft.title.trim(),
        description: taskDraft.description,
        executionWorkspace: taskDraft.executionWorkspace.trim() || null,
        prompt: taskDraft.prompt,
        status: taskDraft.status,
        priority: taskDraft.priority,
        executionPolicy: taskDraft.executionPolicy,
        itemType: taskDraft.itemType,
        queueTagId: queueTagNameToId(taskDraft.queueTagName),
        queueTagName: taskDraft.queueTagName.trim(),
        sandbox: taskDraft.sandbox || null,
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
        approvalPolicy: selectedTask.approvalPolicy ?? null,
        codexExecutable: selectedTask.codexExecutable ?? null,
        description:
          "Review the source implementation diff against the worker report, declared scope, and Hobit contracts.",
        executionPolicy: "manual",
        executionWorkspace: selectedTask.executionWorkspace ?? null,
        itemType: "diff_review",
        priority: selectedTask.priority,
        prompt,
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        sandbox: selectedTask.sandbox ?? null,
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
    if (!selectedTask || isEditing || isSaving || isCreating) {
      return false;
    }

    if (actionType === "create_follow_up") {
      return createFollowUpTaskFromSelectedTask({
        applyUpdatedTask,
        isCreating,
        isSaving,
        onCreateAgentQueueTask,
        selectedTask,
        setCoordinatorFinalizationMessage,
        setEditorError,
        setIsCreating,
        setLocalTaskFields,
        setTasks,
        setValidationMessage,
        tasksRef,
      });
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
            executionWorkspace: selectedTask.executionWorkspace ?? null,
            codexExecutable: selectedTask.codexExecutable ?? null,
            sandbox: selectedTask.sandbox ?? null,
            approvalPolicy: selectedTask.approvalPolicy ?? null,
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
      const nextLocalTaskFields = new Map(localTaskFieldsRef.current).set(
        updatedTask.queueItemId,
        {
          ...(localTaskFieldsRef.current.get(updatedTask.queueItemId) ?? {}),
          ...taskFoundation,
        },
      );
      localTaskFieldsRef.current = nextLocalTaskFields;
      setLocalTaskFields(nextLocalTaskFields);
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
        approvalPolicy: draft.approvalPolicy || null,
        codexExecutable: draft.codexExecutable.trim() || null,
        queueItemId: selectedTask.queueItemId,
        title: draft.title.trim(),
        description: draft.description,
        executionWorkspace: draft.executionWorkspace.trim() || null,
        prompt: draft.prompt,
        status: draft.status,
        priority: draft.priority,
        executionPolicy: draft.executionPolicy,
        itemType: draft.itemType,
        queueTagId: queueTagNameToId(draft.queueTagName),
        queueTagName: draft.queueTagName.trim(),
        sandbox: draft.sandbox || null,
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

  async function promoteSelectedDraftToQueued() {
    if (!selectedTask || selectedTask.status !== "draft") {
      return false;
    }

    if (!onUpdateAgentQueueTask) {
      setValidationMessage(
        "Queue task updates are unavailable. Use Task edit when persistence is available.",
      );
      return false;
    }

    if (hasOpenTaskEdit) {
      setValidationMessage("Save or cancel task edits before promoting.");
      return false;
    }

    if (isSaving || isCreating) {
      return false;
    }

    const queueTag = normalizeQueueTag(selectedTask);
    const validationStatus = normalizeValidationStatus(
      selectedTask.validationStatus,
    );
      const nextDraft: TaskDraft = {
        dependsOn: normalizeTaskDependencies(selectedTask.dependsOn),
        approvalPolicy: selectedTask.approvalPolicy ?? "",
        codexExecutable: selectedTask.codexExecutable ?? "",
        description: selectedTask.description,
        executionPolicy: normalizeTaskExecutionPolicy(
          selectedTask.executionPolicy,
        ),
        executionWorkspace: selectedTask.executionWorkspace ?? "",
        itemType: normalizeItemType(selectedTask.itemType),
        priority: selectedTask.priority,
        prompt: selectedTask.prompt,
        queueTagName: queueTag.queueTagName,
        sandbox: selectedTask.sandbox ?? "",
        status: "queued",
        title: selectedTask.title,
        validationStatus,
    };
    const validationError = validateDraft(nextDraft);

    if (validationError) {
      setValidationMessage(validationError);
      return false;
    }

    setIsSaving(true);
    setEditorError(null);
    setAssignmentError(null);
    setAssignmentMessage(null);
    setValidationMessage(null);
    setSaveStateText("Saving");

    try {
      const updatedTask = await onUpdateAgentQueueTask({
        approvalPolicy: selectedTask.approvalPolicy ?? null,
        codexExecutable: selectedTask.codexExecutable ?? null,
        description: selectedTask.description,
        executionPolicy: nextDraft.executionPolicy,
        executionWorkspace: selectedTask.executionWorkspace ?? null,
        itemType: nextDraft.itemType,
        priority: selectedTask.priority,
        prompt: selectedTask.prompt,
        queueItemId: selectedTask.queueItemId,
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        sandbox: selectedTask.sandbox ?? null,
        status: "queued",
        title: selectedTask.title,
        validationStatus,
      });

      if (!updatedTask) {
        setEditorError("The selected queue task could not be found.");
        setSaveStateText("Unsaved changes");
        return false;
      }

      const taskFoundation: Partial<AgentQueueTask> = {
        dependsOn: nextDraft.dependsOn,
        executionPlanPreview: selectedTask.executionPlanPreview,
        itemType: nextDraft.itemType,
        orderIndex: selectedTask.orderIndex,
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        validationStatus,
        coordinatorStatus: selectedTask.coordinatorStatus ?? "not_reported",
      };

      setLocalTaskFields((current) =>
        new Map(current).set(updatedTask.queueItemId, {
          ...(current.get(updatedTask.queueItemId) ?? {}),
          ...taskFoundation,
        }),
      );
      applyUpdatedTask({ ...updatedTask, ...taskFoundation }, { select: true });
      setDraft(nextDraft);
      setSaveStateText("Saved");
      setIsEditing(false);
      setValidationMessage(
        "Task promoted to queued. No Executor run, validation, Git action, or coordinator finalization was started.",
      );
      return true;
    } catch (error) {
      setEditorError(errorToMessage(error, "Unable to promote queue task."));
      setSaveStateText("Unsaved changes");
      return false;
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
    promoteSelectedDraftToQueued,
    startEditingSelectedTask,
    updateDraft,
    updatePriority,
  };
}
