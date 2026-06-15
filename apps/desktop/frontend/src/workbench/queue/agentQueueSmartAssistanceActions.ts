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
  applySmartQueueAssistanceRequestToTask,
  type SmartQueueAssistanceRequestRecord,
} from "./smartQueueAssistanceRequest";

export type AgentQueueSmartAssistanceActionsContext = Pick<
  WidgetRenderProps,
  "onUpdateAgentQueueTask"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  isCreating: boolean;
  isEditing: boolean;
  isRequestingAssistance: boolean;
  isSaving: boolean;
  localTaskFieldsRef: MutableRefObject<Map<string, AgentQueueLocalTaskFields>>;
  selectedTask: AgentQueueTask | null;
  setEditorError: Dispatch<SetStateAction<string | null>>;
  setIsRequestingAssistance: Dispatch<SetStateAction<boolean>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedDraft: (task: AgentQueueTask) => void;
  setSmartAssistanceError: Dispatch<SetStateAction<string | null>>;
  setSmartAssistanceMessage: Dispatch<SetStateAction<string | null>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
};

export function createAgentQueueSmartAssistanceActions({
  applyUpdatedTask,
  isCreating,
  isEditing,
  isRequestingAssistance,
  isSaving,
  localTaskFieldsRef,
  onUpdateAgentQueueTask,
  selectedTask,
  setEditorError,
  setIsRequestingAssistance,
  setLocalTaskFields,
  setSaveStateText,
  setSelectedDraft,
  setSmartAssistanceError,
  setSmartAssistanceMessage,
  setValidationMessage,
}: AgentQueueSmartAssistanceActionsContext) {
  async function askWorkspaceAgentAssistance() {
    if (
      !selectedTask ||
      isEditing ||
      isSaving ||
      isCreating ||
      isRequestingAssistance
    ) {
      return null;
    }

    if (!onUpdateAgentQueueTask) {
      setSmartAssistanceError("Cannot prepare assistance request");
      setSmartAssistanceMessage(null);
      return null;
    }

    const assistance = applySmartQueueAssistanceRequestToTask({
      task: selectedTask,
    });

    if (!assistance.ok) {
      setSmartAssistanceError(assistance.reason);
      setSmartAssistanceMessage(null);
      return null;
    }

    setIsRequestingAssistance(true);
    setEditorError(null);
    setSmartAssistanceError(null);
    setSmartAssistanceMessage(null);
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
        status: assistance.task.status,
        title: selectedTask.title,
        validationStatus: assistance.task.validationStatus,
        workerExecutionReports: assistance.task.workerExecutionReports,
      });

      if (!updatedTask) {
        setSmartAssistanceError("Cannot prepare assistance request");
        return null;
      }

      const taskFoundation: Partial<AgentQueueTask> = {
        coordinatorStatus: assistance.task.coordinatorStatus,
        validationStatus: assistance.task.validationStatus,
        workerExecutionReports: assistance.task.workerExecutionReports,
      };
      const taskForApply: AgentQueueTask = {
        ...updatedTask,
        ...taskFoundation,
        status: assistance.task.status,
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
      setSmartAssistanceMessage("Assistance request prepared");
      setSaveStateText("Saved");
      return assistance.request;
    } catch {
      setSmartAssistanceError("Cannot prepare assistance request");
      setSmartAssistanceMessage(null);
      return null;
    } finally {
      setIsRequestingAssistance(false);
    }
  }

  return {
    askWorkspaceAgentAssistance,
  };
}

export type AgentQueueSmartAssistanceRequest = SmartQueueAssistanceRequestRecord;
