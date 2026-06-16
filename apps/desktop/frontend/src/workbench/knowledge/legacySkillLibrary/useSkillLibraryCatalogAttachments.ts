import { useState } from "react";
import type { KnowledgeDocument, Skill } from "../../../workspace/types";
import {
  DEFAULT_DOCUMENT_TITLE,
  knowledgeDocumentWorkspaceAgentContextText,
  skillCoordinatorContextText,
  type KnowledgeCatalogAttachmentState,
} from "./skillLibraryModel";
import type { WidgetRenderProps } from "../../types";

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
      sourceLabel: "Knowledge / Skills / Skill",
    });
    rememberCatalogAttachment(`skill:${selectedSkill.skillId}`, {
      workspaceAgentContextAttached: true,
    });
    setDocumentMessage("Skill attached to Workspace Agent as visible context.");
    setDocumentError(null);
  }

  function attachSelectedDocumentToWorkspaceAgent() {
    if (!selectedDocument || !onAttachContextToCoordinator || isDocumentDirty) {
      return;
    }

    const title = selectedDocument.title.trim() || DEFAULT_DOCUMENT_TITLE;

    if (!selectedDocument.enabled || selectedDocument.searchable === false) {
      setDocumentMessage(
        `${title} is disabled and cannot be attached to Workspace Agent.`,
      );
      setDocumentError(
        `${title} is disabled and cannot be attached to Workspace Agent.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "rejected") {
      setDocumentMessage(
        `${title} is rejected and cannot be attached to Workspace Agent.`,
      );
      setDocumentError(
        `${title} is rejected and cannot be attached to Workspace Agent.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "archived") {
      setDocumentMessage(
        `${title} is archived. Restore it before attaching to Workspace Agent.`,
      );
      setDocumentError(
        `${title} is archived. Restore it before attaching to Workspace Agent.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "draft") {
      setDocumentMessage(
        `${title} is still a draft. Mark it active after review before attaching to Workspace Agent.`,
      );
      setDocumentError(
        `${title} is still a draft. Mark it active after review before attaching to Workspace Agent.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "stale") {
      const confirmed = window.confirm(
        `Attach stale Knowledge Document "${title}" to Workspace Agent as a bounded visible snapshot?`,
      );
      if (!confirmed) {
        return;
      }
    }

    onAttachContextToCoordinator({
      contextText: knowledgeDocumentWorkspaceAgentContextText(selectedDocument),
      sourceLabel: "Knowledge / Skills / Knowledge Document",
    });
    rememberCatalogAttachment(
      `document:${selectedDocument.knowledgeDocumentId}`,
      {
        workspaceAgentContextAttached: true,
      },
    );
    setDocumentMessage(
      selectedDocument.lifecycleStatus === "stale"
        ? "Knowledge Document attached to Workspace Agent as a bounded visible snapshot with stale warning."
        : "Knowledge Document attached to Workspace Agent as a bounded visible snapshot.",
    );
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

    const title = selectedDocument.title.trim() || DEFAULT_DOCUMENT_TITLE;

    if (!selectedDocument.enabled || selectedDocument.searchable === false) {
      setDocumentMessage(
        `${title} is disabled and cannot be used as Queue context.`,
      );
      setDocumentError(
        `${title} is disabled and cannot be used as Queue context.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "rejected") {
      setDocumentMessage(
        `${title} is rejected and cannot be used as Queue context.`,
      );
      setDocumentError(
        `${title} is rejected and cannot be used as Queue context.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "archived") {
      setDocumentMessage(
        `${title} is archived. Restore it before using it as Queue context.`,
      );
      setDocumentError(
        `${title} is archived. Restore it before using it as Queue context.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "draft") {
      setDocumentMessage(
        `${title} is still a draft. Mark it active after review before using it as Queue context.`,
      );
      setDocumentError(
        `${title} is still a draft. Mark it active after review before using it as Queue context.`,
      );
      return;
    }

    if (selectedDocument.lifecycleStatus === "stale") {
      const confirmed = window.confirm(
        `Attach stale Knowledge Document "${title}" to the selected Queue task? The task will keep a visible stale-context warning.`,
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
    attachSelectedDocumentToWorkspaceAgent,
    attachSelectedSkillToCoordinator,
    attachSelectedSkillToQueueTask,
    attachmentStateByCatalogItemId,
  };
}
