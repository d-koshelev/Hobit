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
  applySmartQueueRollbackProposalToTask,
  type SmartQueueRollbackProposalRecord,
} from "./smartQueueRollbackProposal";

export type AgentQueueSmartRollbackActionsContext = Pick<
  WidgetRenderProps,
  "onUpdateAgentQueueTask"
> & {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  isCreating: boolean;
  isEditing: boolean;
  isPreparingRollbackProposal: boolean;
  isSaving: boolean;
  localTaskFieldsRef: MutableRefObject<Map<string, AgentQueueLocalTaskFields>>;
  selectedTask: AgentQueueTask | null;
  setEditorError: Dispatch<SetStateAction<string | null>>;
  setIsPreparingRollbackProposal: Dispatch<SetStateAction<boolean>>;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setSaveStateText: Dispatch<SetStateAction<string>>;
  setSelectedDraft: (task: AgentQueueTask) => void;
  setSmartRollbackError: Dispatch<SetStateAction<string | null>>;
  setSmartRollbackMessage: Dispatch<SetStateAction<string | null>>;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
};

export function createAgentQueueSmartRollbackActions({
  applyUpdatedTask,
  isCreating,
  isEditing,
  isPreparingRollbackProposal,
  isSaving,
  localTaskFieldsRef,
  onUpdateAgentQueueTask,
  selectedTask,
  setEditorError,
  setIsPreparingRollbackProposal,
  setLocalTaskFields,
  setSaveStateText,
  setSelectedDraft,
  setSmartRollbackError,
  setSmartRollbackMessage,
  setValidationMessage,
}: AgentQueueSmartRollbackActionsContext) {
  async function prepareRollbackProposal() {
    if (
      !selectedTask ||
      isEditing ||
      isSaving ||
      isCreating ||
      isPreparingRollbackProposal
    ) {
      return null;
    }

    if (!onUpdateAgentQueueTask) {
      setSmartRollbackError("Cannot prepare rollback proposal");
      setSmartRollbackMessage(null);
      return null;
    }

    const rollback = applySmartQueueRollbackProposalToTask({
      task: selectedTask,
    });

    if (!rollback.ok) {
      setSmartRollbackError(rollback.reason);
      setSmartRollbackMessage(null);
      return null;
    }

    setIsPreparingRollbackProposal(true);
    setEditorError(null);
    setSmartRollbackError(null);
    setSmartRollbackMessage(null);
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
        status: rollback.task.status,
        title: selectedTask.title,
        validationStatus: rollback.task.validationStatus,
        workerExecutionReports: rollback.task.workerExecutionReports,
      });

      if (!updatedTask) {
        setSmartRollbackError("Cannot prepare rollback proposal");
        return null;
      }

      const taskFoundation: Partial<AgentQueueTask> = {
        coordinatorStatus: rollback.task.coordinatorStatus,
        validationStatus: rollback.task.validationStatus,
        workerExecutionReports: rollback.task.workerExecutionReports,
      };
      const taskForApply: AgentQueueTask = {
        ...updatedTask,
        ...taskFoundation,
        status: rollback.task.status,
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
      setSmartRollbackMessage("Rollback proposal prepared");
      setSaveStateText("Saved");
      return rollback.proposal;
    } catch {
      setSmartRollbackError("Cannot prepare rollback proposal");
      setSmartRollbackMessage(null);
      return null;
    } finally {
      setIsPreparingRollbackProposal(false);
    }
  }

  return {
    prepareRollbackProposal,
  };
}

export type AgentQueueSmartRollbackProposal = SmartQueueRollbackProposalRecord;
