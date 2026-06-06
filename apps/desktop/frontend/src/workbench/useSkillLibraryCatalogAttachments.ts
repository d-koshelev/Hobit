import { useState } from "react";
import type { KnowledgeDocument, Skill } from "../workspace/types";
import {
  DEFAULT_DOCUMENT_TITLE,
  skillCoordinatorContextText,
  type KnowledgeCatalogAttachmentState,
} from "./skillLibraryModel";
import type { WidgetRenderProps } from "./types";

type UseSkillLibraryCatalogAttachmentsParams = {
  isDocumentDirty: boolean;
  onAttachContextToCoordinator: WidgetRenderProps["onAttachContextToCoordinator"];
  onAttachKnowledgeContextToQueueTask: WidgetRenderProps["onAttachKnowledgeContextToQueueTask"];
  selectedDocument: KnowledgeDocument | null;
  selectedSkill: Skill | null;
  setDocumentError: (message: string | null) => void;
  setDocumentMessage: (message: string | null) => void;
};

export function useSkillLibraryCatalogAttachments({
  isDocumentDirty,
  onAttachContextToCoordinator,
  onAttachKnowledgeContextToQueueTask,
  selectedDocument,
  selectedSkill,
  setDocumentError,
  setDocumentMessage,
}: UseSkillLibraryCatalogAttachmentsParams) {
  const [attachmentStateByCatalogItemId, setAttachmentStateByCatalogItemId] =
    useState<Record<string, KnowledgeCatalogAttachmentState>>({});

  function attachSelectedSkillToCoordinator() {
    if (!selectedSkill || !onAttachContextToCoordinator) {
      return;
    }

    onAttachContextToCoordinator({
      contextText: skillCoordinatorContextText(selectedSkill),
      sourceLabel: "Skill Library / Skill",
    });
    rememberCatalogAttachment(`skill:${selectedSkill.skillId}`, {
      workspaceAgentContextAttached: true,
    });
    setDocumentMessage("Skill attached to Workspace Agent as visible context.");
    setDocumentError(null);
  }

  async function attachSelectedSkillToQueueTask() {
    if (!selectedSkill || !onAttachKnowledgeContextToQueueTask) {
      return;
    }

    const result = await Promise.resolve(onAttachKnowledgeContextToQueueTask({
        kind: "skill",
        skill: selectedSkill,
      })).catch((error) => ({
        message:
          error instanceof Error
            ? error.message
            : "Unable to attach Skill to the selected Queue task.",
        status: "unavailable" as const,
      }));
    if (result.status === "attached") {
      rememberCatalogAttachment(`skill:${selectedSkill.skillId}`, {
        queueTaskTitle: result.taskTitle ?? "Selected Queue task",
      });
    }
    setDocumentMessage(result.message);
    setDocumentError(result.status === "blocked" ? result.message : null);
  }

  async function attachSelectedDocumentToQueueTask() {
    if (
      !selectedDocument ||
      isDocumentDirty ||
      !onAttachKnowledgeContextToQueueTask
    ) {
      return;
    }

    if (selectedDocument.lifecycleStatus === "stale") {
      const confirmed = window.confirm(
        `Attach stale Knowledge Document "${selectedDocument.title.trim() || DEFAULT_DOCUMENT_TITLE}" to the selected Queue task? The task will keep a visible stale-context warning.`,
      );
      if (!confirmed) {
        return;
      }
    }

    const result = await Promise.resolve(onAttachKnowledgeContextToQueueTask({
        document: selectedDocument,
        kind: "knowledge_document",
      })).catch((error) => ({
        message:
          error instanceof Error
            ? error.message
            : "Unable to attach Knowledge Document to the selected Queue task.",
        status: "unavailable" as const,
      }));
    if (result.status === "attached") {
      rememberCatalogAttachment(
        `document:${selectedDocument.knowledgeDocumentId}`,
        {
          queueTaskTitle: result.taskTitle ?? "Selected Queue task",
        },
      );
    }
    setDocumentMessage(
      result.status === "attached" &&
        selectedDocument.lifecycleStatus === "stale"
        ? `${result.message} Stale context warning will be shown on the Queue task.`
        : result.message,
    );
    setDocumentError(result.status === "blocked" ? result.message : null);
  }

  function rememberCatalogAttachment(
    catalogItemId: string,
    state: KnowledgeCatalogAttachmentState,
  ) {
    setAttachmentStateByCatalogItemId((currentState) => ({
      ...currentState,
      [catalogItemId]: {
        ...currentState[catalogItemId],
        ...state,
      },
    }));
  }

  return {
    attachSelectedDocumentToQueueTask,
    attachSelectedSkillToCoordinator,
    attachSelectedSkillToQueueTask,
    attachmentStateByCatalogItemId,
  };
}
