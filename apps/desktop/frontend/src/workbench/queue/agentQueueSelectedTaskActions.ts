import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { AgentQueueTask } from "../../workspace/types";
import {
  attachContextToQueueTask,
  buildQueueContextAttachment,
  type AgentQueueKnowledgeContextAttachInput,
  type AgentQueueKnowledgeContextAttachResult,
} from "../agentQueueKnowledgeContext";
import type { AgentQueueLocalTaskFields } from "./agentQueueTaskActionTypes";

type SelectedTaskActionsInput = {
  applyUpdatedTask: (
    task: AgentQueueTask,
    options?: { select?: boolean },
  ) => void;
  hasOpenTaskEdit: boolean;
  localTaskFieldsRef: MutableRefObject<Map<string, AgentQueueLocalTaskFields>>;
  selectedTask: AgentQueueTask | null;
  setLocalTaskFields: Dispatch<
    SetStateAction<Map<string, AgentQueueLocalTaskFields>>
  >;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  setWorkerReportMessage: Dispatch<SetStateAction<string | null>>;
};

export function createAgentQueueSelectedTaskActions({
  applyUpdatedTask,
  hasOpenTaskEdit,
  localTaskFieldsRef,
  selectedTask,
  setLocalTaskFields,
  setValidationMessage,
  setWorkerReportMessage,
}: SelectedTaskActionsInput) {
  function markReportActionCardShown(cardId: string) {
    if (!selectedTask) {
      return;
    }

    const taskFoundation = {
      ...(localTaskFieldsRef.current.get(selectedTask.queueItemId) ?? {}),
      workspaceChatReportCardId: cardId,
      workspaceChatReportCardStatus: "shown" as const,
    };
    const updatedTask = {
      ...selectedTask,
      workspaceChatReportCardId: cardId,
      workspaceChatReportCardStatus: "shown" as const,
    };

    setLocalTaskFields((current) =>
      new Map(current).set(selectedTask.queueItemId, taskFoundation),
    );
    applyUpdatedTask(updatedTask, { select: true });
    setWorkerReportMessage(
      "Report card shown in Workspace Chat. Coordinator action is still required; no final status was applied.",
    );
  }

  function attachKnowledgeContextToSelectedTask(
    input: AgentQueueKnowledgeContextAttachInput,
  ): AgentQueueKnowledgeContextAttachResult {
    if (!selectedTask) {
      return {
        message: "Select a Queue task before attaching Knowledge / Skills context.",
        status: "unavailable",
      };
    }

    if (hasOpenTaskEdit) {
      return {
        message: "Save or cancel the selected Queue task edits before attaching context.",
        status: "unavailable",
        taskTitle: selectedTask.title,
      };
    }

    const attachment = buildQueueContextAttachment(input);
    const blockedWarnings = attachment.warnings.filter(
      (warning) => warning.severity === "blocked",
    );

    if (blockedWarnings.length > 0) {
      return {
        message: blockedWarnings[0]?.message ?? "This context is blocked.",
        status: "blocked",
        taskTitle: selectedTask.title,
      };
    }

    const updatedTask = attachContextToQueueTask(selectedTask, input);
    const taskFoundation: Partial<AgentQueueTask> = {
      context: updatedTask.context,
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
    applyUpdatedTask(updatedTask, { select: true });
    setValidationMessage(
      "Context attached to the selected Queue task as safe refs and summaries. No prompt was materialized and no work was started.",
    );

    return {
      message: `${attachment.ref.title} attached to ${selectedTask.title}.`,
      status: "attached",
      taskTitle: selectedTask.title,
    };
  }

  return {
    attachKnowledgeContextToSelectedTask,
    markReportActionCardShown,
  };
}
