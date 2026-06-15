import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import {
  normalizeItemType,
  normalizeQueueTag,
  normalizeTaskExecutionPolicy,
} from "../agentQueueTaskUiModel";
import type { WidgetRenderProps } from "../types";
import type { AgentQueueLocalTaskFields } from "./agentQueueTaskActionTypes";
import {
  applySmartQueueRetrySameActionToTask,
  applySmartQueueRetryWithModifiedPromptActionToTask,
} from "./smartQueueRetrySameAction";

export type AgentQueueSmartRetryActionsContext = Pick<
  WidgetRenderProps,
  "onUpdateAgentQueueTask"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  isCreating: boolean;
  isEditing: boolean;
  isSaving: boolean;
  isSmartRetrying: boolean;
  localTaskFieldsRef: MutableRefObject<Map<string, AgentQueueLocalTaskFields>>;
  selectedTask: AgentQueueTask | null;
  setEditorError: Dispatch<SetStateAction<string | null>>;
  setIsSmartRetrying: Dispatch<SetStateAction<boolean>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedDraft: (task: AgentQueueTask) => void;
  setSmartRetryError: Dispatch<SetStateAction<string | null>>;
  setSmartRetryMessage: Dispatch<SetStateAction<string | null>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
};

export function createAgentQueueSmartRetryActions({
  applyUpdatedTask,
  isCreating,
  isEditing,
  isSaving,
  isSmartRetrying,
  localTaskFieldsRef,
  onUpdateAgentQueueTask,
  selectedTask,
  setEditorError,
  setIsSmartRetrying,
  setLocalTaskFields,
  setSaveStateText,
  setSelectedDraft,
  setSmartRetryError,
  setSmartRetryMessage,
  setValidationMessage,
}: AgentQueueSmartRetryActionsContext) {
  async function retrySelectedTaskSame() {
    if (!selectedTask || isEditing || isSaving || isCreating || isSmartRetrying) {
      return false;
    }

    if (!onUpdateAgentQueueTask) {
      setSmartRetryError("Cannot retry task");
      setSmartRetryMessage(null);
      return false;
    }

    const retry = applySmartQueueRetrySameActionToTask({
      task: selectedTask,
    });

    if (!retry.ok) {
      setSmartRetryError("Cannot retry task");
      setSmartRetryMessage(null);
      return false;
    }

    setIsSmartRetrying(true);
    setEditorError(null);
    setSmartRetryError(null);
    setSmartRetryMessage(null);
    setValidationMessage(null);

    try {
      const queueTag = normalizeQueueTag(selectedTask);
      const updatedTask = await onUpdateAgentQueueTask({
        approvalPolicy: selectedTask.approvalPolicy ?? null,
        codexExecutable: selectedTask.codexExecutable ?? null,
        dependsOn: selectedTask.dependsOn,
        description: selectedTask.description,
        executionPolicy: normalizeTaskExecutionPolicy(
          selectedTask.executionPolicy,
        ),
        executionWorkspace: selectedTask.executionWorkspace ?? null,
        itemType: normalizeItemType(selectedTask.itemType),
        priority: selectedTask.priority,
        prompt: selectedTask.prompt,
        queueItemId: selectedTask.queueItemId,
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        sandbox: selectedTask.sandbox ?? null,
        status: retry.task.status,
        title: selectedTask.title,
        validationStatus: retry.task.validationStatus,
        workerExecutionReports: retry.task.workerExecutionReports,
      });

      if (!updatedTask) {
        setSmartRetryError("Cannot retry task");
        return false;
      }

      const taskFoundation: Partial<AgentQueueTask> = {
        coordinatorStatus: retry.task.coordinatorStatus,
        validationStatus: retry.task.validationStatus,
        workerExecutionReports: retry.task.workerExecutionReports,
      };
      const taskForApply: AgentQueueTask = {
        ...updatedTask,
        ...taskFoundation,
        status: retry.task.status,
      };
      const nextLocalTaskFields = new Map(localTaskFieldsRef.current).set(
        taskForApply.queueItemId,
        {
          ...(localTaskFieldsRef.current.get(taskForApply.queueItemId) ?? {}),
          ...taskFoundation,
        },
      );

      localTaskFieldsRef.current = nextLocalTaskFields;
      setLocalTaskFields(nextLocalTaskFields);
      applyUpdatedTask(taskForApply, { select: true });
      setSelectedDraft(taskForApply);
      setSmartRetryMessage("Retry queued");
      setSaveStateText("Saved");
      return true;
    } catch {
      setSmartRetryError("Cannot retry task");
      setSmartRetryMessage(null);
      return false;
    } finally {
      setIsSmartRetrying(false);
    }
  }

  async function retrySelectedTaskWithModifiedPrompt(modifiedPrompt: string) {
    if (!selectedTask || isEditing || isSaving || isCreating || isSmartRetrying) {
      return false;
    }

    if (!onUpdateAgentQueueTask) {
      setSmartRetryError("Cannot retry task");
      setSmartRetryMessage(null);
      return false;
    }

    const retry = applySmartQueueRetryWithModifiedPromptActionToTask({
      modifiedPrompt,
      task: selectedTask,
    });

    if (!retry.ok) {
      setSmartRetryError(retry.reason);
      setSmartRetryMessage(null);
      return false;
    }

    setIsSmartRetrying(true);
    setEditorError(null);
    setSmartRetryError(null);
    setSmartRetryMessage(null);
    setValidationMessage(null);

    try {
      const queueTag = normalizeQueueTag(selectedTask);
      const updatedTask = await onUpdateAgentQueueTask({
        approvalPolicy: selectedTask.approvalPolicy ?? null,
        codexExecutable: selectedTask.codexExecutable ?? null,
        dependsOn: selectedTask.dependsOn,
        description: selectedTask.description,
        executionPolicy: normalizeTaskExecutionPolicy(
          selectedTask.executionPolicy,
        ),
        executionWorkspace: selectedTask.executionWorkspace ?? null,
        itemType: normalizeItemType(selectedTask.itemType),
        priority: selectedTask.priority,
        prompt: retry.task.prompt,
        queueItemId: selectedTask.queueItemId,
        queueTagId: queueTag.queueTagId,
        queueTagName: queueTag.queueTagName,
        sandbox: selectedTask.sandbox ?? null,
        status: retry.task.status,
        title: selectedTask.title,
        validationStatus: retry.task.validationStatus,
        workerExecutionReports: retry.task.workerExecutionReports,
      });

      if (!updatedTask) {
        setSmartRetryError("Cannot retry task");
        return false;
      }

      const taskFoundation: Partial<AgentQueueTask> = {
        coordinatorStatus: retry.task.coordinatorStatus,
        validationStatus: retry.task.validationStatus,
        workerExecutionReports: retry.task.workerExecutionReports,
      };
      const taskForApply: AgentQueueTask = {
        ...updatedTask,
        ...taskFoundation,
        prompt: retry.task.prompt,
        status: retry.task.status,
      };
      const nextLocalTaskFields = new Map(localTaskFieldsRef.current).set(
        taskForApply.queueItemId,
        {
          ...(localTaskFieldsRef.current.get(taskForApply.queueItemId) ?? {}),
          ...taskFoundation,
        },
      );

      localTaskFieldsRef.current = nextLocalTaskFields;
      setLocalTaskFields(nextLocalTaskFields);
      applyUpdatedTask(taskForApply, { select: true });
      setSelectedDraft(taskForApply);
      setSmartRetryMessage("Retry with changes queued");
      setSaveStateText("Saved");
      return true;
    } catch {
      setSmartRetryError("Cannot retry task");
      setSmartRetryMessage(null);
      return false;
    } finally {
      setIsSmartRetrying(false);
    }
  }

  return {
    retrySelectedTaskSame,
    retrySelectedTaskWithModifiedPrompt,
  };
}
