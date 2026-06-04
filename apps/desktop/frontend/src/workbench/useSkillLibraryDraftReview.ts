import { useState } from "react";
import type { KnowledgeDocument } from "../workspace/types";
import {
  knowledgeDraftAcceptedSourceLabel,
  knowledgeDraftAcceptedSourceRef,
  parseKnowledgeDraftPackFromText,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";
import {
  draftRiskNotes,
  errorToMessage,
  sourceNotesForDraft,
} from "./SkillLibraryDocumentsPanel.helpers";
import type { WidgetRenderProps } from "./types";

type UseSkillLibraryDraftReviewParams = {
  loadDocuments: (preferredDocumentId: string | null) => Promise<void>;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  setDocumentError: (message: string | null) => void;
  setDocumentMessage: (message: string | null) => void;
  setSelectedDocumentDraft: (document: KnowledgeDocument) => void;
};

export function useSkillLibraryDraftReview({
  loadDocuments,
  onCreateKnowledgeDocument,
  onCreateSkill,
  setDocumentError,
  setDocumentMessage,
  setSelectedDocumentDraft,
}: UseSkillLibraryDraftReviewParams) {
  const [draftPayload, setDraftPayload] = useState("");
  const [draftReviewPack, setDraftReviewPack] =
    useState<KnowledgeDraftReviewPack | null>(null);
  const [draftReviewDecisions, setDraftReviewDecisions] = useState<
    Record<string, "accepted" | "pending" | "rejected">
  >({});
  const [isAcceptingDraftItem, setIsAcceptingDraftItem] = useState(false);

  function updateDraftPayload(payload: string) {
    setDraftPayload(payload);
    setDocumentMessage(null);
    setDocumentError(null);
  }

  function loadDraftReviewPayload() {
    const parsedPack = parseKnowledgeDraftPackFromText(draftPayload);

    if (!parsedPack) {
      setDocumentMessage(null);
      setDocumentError(
        "No draft Knowledge pack was found in the imported payload.",
      );
      return;
    }

    setDraftReviewPack(parsedPack);
    setDraftReviewDecisions(
      Object.fromEntries(
        parsedPack.proposedItems.map((item) => [item.draftItemId, "pending"]),
      ),
    );
    setDocumentMessage(
      `Loaded ${parsedPack.proposedItems.length.toString()} draft item${
        parsedPack.proposedItems.length === 1 ? "" : "s"
      } for review.`,
    );
    setDocumentError(null);
  }

  function clearDraftReviewPayload() {
    setDraftPayload("");
    setDraftReviewPack(null);
    setDraftReviewDecisions({});
    setDocumentMessage(null);
    setDocumentError(null);
  }

  function rejectDraftItem(item: KnowledgeDraftReviewItem) {
    setDraftReviewDecisions((current) => ({
      ...current,
      [item.draftItemId]: "rejected",
    }));
    setDocumentMessage("Draft item rejected and archived for this review.");
    setDocumentError(null);
  }

  async function acceptDraftItem(item: KnowledgeDraftReviewItem) {
    if (!draftReviewPack || isAcceptingDraftItem) {
      return;
    }

    if (item.targetKind === "skill" && !onCreateSkill) {
      setDocumentError("Skill API is not available for accepting this draft.");
      return;
    }

    if (item.targetKind === "document" && !onCreateKnowledgeDocument) {
      setDocumentError(
        "Knowledge Document API is not available for accepting this draft.",
      );
      return;
    }

    setIsAcceptingDraftItem(true);
    setDocumentMessage(null);
    setDocumentError(null);

    try {
      if (item.targetKind === "skill" && onCreateSkill) {
        await onCreateSkill({
          title: item.title,
          whenToUse: item.quickSummary,
          prerequisites: sourceNotesForDraft(draftReviewPack, item),
          steps: item.fullContent,
          validation: "",
          risks: draftRiskNotes(item),
          tags: item.suggestedTags,
          reviewStatus: "reviewed",
        });
        await loadDocuments(null);
      } else if (onCreateKnowledgeDocument) {
        const acceptedDocument = await onCreateKnowledgeDocument({
          scope: item.suggestedScope,
          catalogItemType: item.suggestedType,
          quickSummary: item.quickSummary,
          lifecycleStatus: "active",
          title: item.title,
          sourceLabel: knowledgeDraftAcceptedSourceLabel(draftReviewPack, item),
          sourceKind: "queue_draft",
          sourceRef: knowledgeDraftAcceptedSourceRef(draftReviewPack, item),
          content: item.fullContent,
          tags: item.suggestedTags,
          enabled: true,
        });
        setSelectedDocumentDraft(acceptedDocument);
        await loadDocuments(acceptedDocument.knowledgeDocumentId);
      }

      setDraftReviewDecisions((current) => ({
        ...current,
        [item.draftItemId]: "accepted",
      }));
      setDocumentMessage("Draft item accepted into Knowledge / Skills.");
    } catch (acceptError) {
      setDocumentError(
        errorToMessage(acceptError, "Unable to accept draft item."),
      );
    } finally {
      setIsAcceptingDraftItem(false);
    }
  }

  return {
    acceptDraftItem,
    clearDraftReviewPayload,
    draftPayload,
    draftReviewDecisions,
    draftReviewPack,
    isAcceptingDraftItem,
    loadDraftReviewPayload,
    rejectDraftItem,
    updateDraftPayload,
  };
}
