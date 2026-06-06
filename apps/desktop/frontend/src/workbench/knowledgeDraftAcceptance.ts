import type { KnowledgeDocument, Skill } from "../workspace/types";
import { knowledgeDocumentQuickSummaryWarning } from "./knowledgeDocumentQuickSummaryWarning";
import {
  knowledgeDraftAcceptedSourceLabel,
  knowledgeDraftAcceptedSourceRef,
  knowledgeDraftAcceptedSourceRefs,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";
import {
  draftRiskNotes,
  sourceNotesForDraft,
} from "./SkillLibraryDocumentsPanel.helpers";
import type { WidgetRenderProps } from "./types";

type AcceptKnowledgeDraftItemParams = {
  item: KnowledgeDraftReviewItem;
  onCreateKnowledgeDocument: WidgetRenderProps["onCreateKnowledgeDocument"];
  onCreateSkill: WidgetRenderProps["onCreateSkill"];
  pack: KnowledgeDraftReviewPack;
};

export type AcceptedKnowledgeDraftResult =
  | {
      document: KnowledgeDocument;
      kind: "document";
      message: string;
    }
  | {
      kind: "skill";
      message: string;
      skill: Skill;
    };

export async function acceptKnowledgeDraftItem({
  item,
  onCreateKnowledgeDocument,
  onCreateSkill,
  pack,
}: AcceptKnowledgeDraftItemParams): Promise<AcceptedKnowledgeDraftResult> {
  if (item.targetKind === "skill") {
    if (!onCreateSkill) {
      throw new Error("Skill API is not available for accepting this draft.");
    }

    const skill = await onCreateSkill({
      title: item.title,
      whenToUse: item.quickSummary,
      prerequisites: sourceNotesForDraft(pack, item),
      steps: item.fullContent,
      validation: "",
      risks: draftRiskNotes(item),
      tags: item.suggestedTags,
      reviewStatus: "reviewed",
    });

    return {
      kind: "skill",
      message: "Draft item accepted as a Skill.",
      skill,
    };
  }

  if (!onCreateKnowledgeDocument) {
    throw new Error(
      "Knowledge Document API is not available for accepting this draft.",
    );
  }

  const document = await onCreateKnowledgeDocument({
    scope: item.suggestedScope,
    catalogItemType: item.suggestedType,
    quickSummary: item.quickSummary.trim(),
    lifecycleStatus: "active",
    title: item.title,
    sourceLabel: knowledgeDraftAcceptedSourceLabel(pack, item),
    sourceKind: "queue_draft",
    sourceRef: knowledgeDraftAcceptedSourceRef(pack, item),
    sourceRefs: knowledgeDraftAcceptedSourceRefs(pack, item),
    content: item.fullContent,
    tags: item.suggestedTags,
    enabled: true,
  });

  return {
    document,
    kind: "document",
    message: [
      "Draft item accepted as a Knowledge Document.",
      knowledgeDocumentQuickSummaryWarning(document),
    ]
      .filter(Boolean)
      .join(" "),
  };
}
