import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  AgentQueueTask,
  AgentQueueTaskContextRef,
} from "../../workspace/types";
import {
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
  onAttachKnowledgeToQueueTask?: (request: {
    queueItemId: string;
    knowledgeId: string;
  }) => Promise<AgentQueueTask>;
  onAttachSkillToQueueTask?: (request: {
    queueItemId: string;
    skillId: string;
  }) => Promise<AgentQueueTask>;
  onDetachKnowledgeFromQueueTask?: (request: {
    queueItemId: string;
    knowledgeId: string;
  }) => Promise<AgentQueueTask>;
  onDetachSkillFromQueueTask?: (request: {
    queueItemId: string;
    skillId: string;
  }) => Promise<AgentQueueTask>;
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
  onAttachKnowledgeToQueueTask,
  onAttachSkillToQueueTask,
  onDetachKnowledgeFromQueueTask,
  onDetachSkillFromQueueTask,
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

  async function attachKnowledgeContextToSelectedTask(
    input: AgentQueueKnowledgeContextAttachInput,
  ): Promise<AgentQueueKnowledgeContextAttachResult> {
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

    if (!onAttachKnowledgeToQueueTask || !onAttachSkillToQueueTask) {
      return {
        message: "Queue task persistence is unavailable; context was not attached.",
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

    const persistedTask = await persistContextAttach(input).catch(() => null);
    if (!persistedTask) {
      return {
        message: "Unable to save Queue context on the selected task.",
        status: "unavailable",
        taskTitle: selectedTask.title,
      };
    }

    applyPersistedContextTask(persistedTask);
    setValidationMessage(
      "Context attached to the selected Queue task as durable refs and bounded snapshots. No prompt was materialized and no work was started.",
    );

    return {
      message: `${attachment.ref.title} attached to ${selectedTask.title}.`,
      status: "attached",
      taskTitle: selectedTask.title,
    };
  }

  async function detachKnowledgeContextFromSelectedTask(
    ref: AgentQueueTaskContextRef,
  ): Promise<AgentQueueKnowledgeContextAttachResult> {
    if (!selectedTask) {
      return {
        message: "Select a Queue task before removing Knowledge / Skills context.",
        status: "unavailable",
      };
    }

    if (hasOpenTaskEdit) {
      return {
        message: "Save or cancel the selected Queue task edits before removing context.",
        status: "unavailable",
        taskTitle: selectedTask.title,
      };
    }

    if (!onDetachKnowledgeFromQueueTask || !onDetachSkillFromQueueTask) {
      return {
        message: "Queue task persistence is unavailable; context was not removed.",
        status: "unavailable",
        taskTitle: selectedTask.title,
      };
    }

    const persistedTask = await persistContextDetach(ref).catch(() => null);
    if (!persistedTask) {
      return {
        message: "Unable to remove Queue context from the selected task.",
        status: "unavailable",
        taskTitle: selectedTask.title,
      };
    }

    applyPersistedContextTask(persistedTask);
    setValidationMessage(
      "Context removed from the selected Queue task. No prompt was materialized and no work was started.",
    );

    return {
      message: `${ref.title} removed from ${selectedTask.title}.`,
      status: "detached",
      taskTitle: selectedTask.title,
    };
  }

  async function persistContextAttach(input: AgentQueueKnowledgeContextAttachInput) {
    if (input.kind === "knowledge_document") {
      return (
        onAttachKnowledgeToQueueTask?.({
          queueItemId: selectedTask?.queueItemId ?? "",
          knowledgeId: input.document.knowledgeDocumentId,
        }) ?? null
      );
    }

    return (
      onAttachSkillToQueueTask?.({
        queueItemId: selectedTask?.queueItemId ?? "",
        skillId: input.skill.skillId,
      }) ?? null
    );
  }

  async function persistContextDetach(ref: AgentQueueTaskContextRef) {
    if (ref.kind === "knowledge_document") {
      return (
        onDetachKnowledgeFromQueueTask?.({
          queueItemId: selectedTask?.queueItemId ?? "",
          knowledgeId: ref.id,
        }) ?? null
      );
    }

    return (
      onDetachSkillFromQueueTask?.({
        queueItemId: selectedTask?.queueItemId ?? "",
        skillId: ref.id,
      }) ?? null
    );
  }

  function applyPersistedContextTask(updatedTask: AgentQueueTask) {
    const nextLocalTaskFields = new Map(localTaskFieldsRef.current).set(
      updatedTask.queueItemId,
      {
        ...(localTaskFieldsRef.current.get(updatedTask.queueItemId) ?? {}),
        context: updatedTask.context,
      },
    );
    localTaskFieldsRef.current = nextLocalTaskFields;
    setLocalTaskFields(nextLocalTaskFields);
    applyUpdatedTask(updatedTask, { select: true });
  }

  return {
    attachKnowledgeContextToSelectedTask,
    detachKnowledgeContextFromSelectedTask,
    markReportActionCardShown,
  };
}
