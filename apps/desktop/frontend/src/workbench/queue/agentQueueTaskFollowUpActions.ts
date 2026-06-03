import type { AgentQueueTask } from "../../workspace/types";
import {
  DEFAULT_TASK_TITLE,
  errorToMessage,
  normalizeQueueTag,
  sortQueueTasksForDisplay,
} from "../agentQueueTaskUiModel";
import { nextOrderIndexForQueueTag } from "./agentQueueOrderingActions";
import type {
  AgentQueueLocalTaskFields,
  TaskActionsContext,
} from "./agentQueueTaskActionTypes";
import { followUpPromptFromTask } from "./agentQueueTaskCoordinatorActions";

type FollowUpTaskActionContext = Pick<
  TaskActionsContext,
  | "applyUpdatedTask"
  | "isCreating"
  | "isSaving"
  | "onCreateAgentQueueTask"
  | "selectedTask"
  | "setCoordinatorFinalizationMessage"
  | "setEditorError"
  | "setIsCreating"
  | "setLocalTaskFields"
  | "setTasks"
  | "setValidationMessage"
  | "tasksRef"
>;

export async function createFollowUpTaskFromSelectedTask({
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
}: FollowUpTaskActionContext) {
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
      approvalPolicy: selectedTask.approvalPolicy ?? null,
      codexExecutable: selectedTask.codexExecutable ?? null,
      description: `Follow-up/sub-block for ${selectedTask.title.trim() || DEFAULT_TASK_TITLE}.`,
      executionPolicy: "manual",
      executionWorkspace: selectedTask.executionWorkspace ?? null,
      itemType: "follow_up",
      priority: selectedTask.priority,
      prompt: followUpPromptFromTask(selectedTask),
      queueTagId: queueTag.queueTagId,
      queueTagName: queueTag.queueTagName,
      sandbox: selectedTask.sandbox ?? null,
      status: "queued",
      title: `Follow-up: ${selectedTask.title.trim() || DEFAULT_TASK_TITLE}`,
      validationStatus: "not_started",
    });
    const createdFoundation: AgentQueueLocalTaskFields = {
      coordinatorStatus: "not_reported",
      dependsOn: [],
      itemType: "follow_up",
      orderIndex: nextOrderIndexForQueueTag({
        insertPosition: "bottom",
        queueTagId: queueTag.queueTagId,
        tasks: tasksRef.current,
      }),
      queueTagId: queueTag.queueTagId,
      queueTagName: queueTag.queueTagName,
      validationStatus: "not_started",
      workerExecutionReports: [],
    };
    const sourceFoundation: Partial<AgentQueueTask> = {
      coordinatorStatus: "follow_up_required",
      validationStatus: "needs_review",
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
