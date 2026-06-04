import type { KnowledgeDocument } from "../workspace/types";
import {
  knowledgeDraftAcceptedSourceLabel,
  knowledgeDraftAcceptedSourceRef,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";
import {
  DEFAULT_DOCUMENT_TITLE,
  type KnowledgeCatalogView,
} from "./skillLibraryModel";

export function errorToMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function emptyCatalogText(view: KnowledgeCatalogView) {
  if (view === "active") {
    return "No active catalog items match this view.";
  }

  if (view === "global") {
    return "Add the first local-global catalog item for this desktop database.";
  }

  if (view === "workspace") {
    return "Add the first workspace-local catalog item for this workspace.";
  }

  if (view === "skills") {
    return "Create the first saved Skill from the Skills tab.";
  }

  if (view === "drafts") {
    return "No draft catalog items need review.";
  }

  if (view === "stale") {
    return "No stale catalog items need refresh.";
  }

  if (view === "archived") {
    return "No archived catalog items are retained for review.";
  }

  return "Add the first workspace-local or local-global catalog item.";
}

export function documentLifecycleUpdateMessage(
  lifecycleStatus: KnowledgeDocument["lifecycleStatus"],
) {
  switch (lifecycleStatus) {
    case "active":
      return "Document restored to active.";
    case "stale":
      return "Document marked stale.";
    case "archived":
      return "Document archived.";
    case "draft":
      return "Document marked draft.";
    case "rejected":
      return "Document rejected.";
    default:
      return "Document status updated.";
  }
}

export function draftDecisionLabel(
  decision: "accepted" | "pending" | "rejected",
) {
  switch (decision) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Archived";
    case "pending":
    default:
      return "Pending";
  }
}

export function sourceNotesForDraft(
  pack: KnowledgeDraftReviewPack,
  item: KnowledgeDraftReviewItem,
) {
  return [
    knowledgeDraftAcceptedSourceLabel(pack, item),
    knowledgeDraftAcceptedSourceRef(pack, item)
      ? `Source ref: ${knowledgeDraftAcceptedSourceRef(pack, item)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function draftRiskNotes(item: KnowledgeDraftReviewItem) {
  return [
    item.blockers ? `Blockers: ${item.blockers}` : "",
    item.reviewNotes ? `Review notes: ${item.reviewNotes}` : "",
    item.confidence ? `Confidence: ${item.confidence}` : "",
    item.activationRecommendation
      ? `Activation recommendation: ${item.activationRecommendation}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isSourceBackedDocument(document: KnowledgeDocument) {
  return Boolean(document.sourceRef.trim());
}

export function refreshQueueTaskRequestFromDocument(
  document: KnowledgeDocument,
) {
  const sourceLabel = document.sourceLabel.trim() || "Knowledge source";
  const sourceRef = document.sourceRef.trim();
  const title = `Refresh Knowledge: ${document.title.trim() || DEFAULT_DOCUMENT_TITLE}`;

  return {
    title,
    description: [
      "Refresh an existing source-backed Knowledge item and return a draft update for operator review.",
      `Knowledge document id: ${document.knowledgeDocumentId}`,
      `Current status: ${document.lifecycleStatus}`,
      `Scope: ${document.scope}`,
      `Type: ${document.catalogItemType}`,
      `Source label: ${sourceLabel}`,
      `Source kind: ${document.sourceKind.trim() || "source_ref"}`,
      `Source ref: ${sourceRef}`,
      "The current item must remain unchanged until the operator manually accepts an update.",
    ].join("\n"),
    executionPolicy: "manual" as const,
    priority: 2,
    prompt: [
      "Create a draft Knowledge update for the existing Knowledge item below.",
      "",
      "Use only the explicitly listed source ref. Do not scan folders, use hidden workspace context, mutate files, mutate Git, create Knowledge, enable Knowledge, or run background refresh.",
      "",
      `Knowledge document id: ${document.knowledgeDocumentId}`,
      `Title: ${document.title}`,
      `Current quick summary: ${document.quickSummary || "(empty)"}`,
      `Current tags: ${document.tags || "(empty)"}`,
      `Current scope: ${document.scope}`,
      `Current type: ${document.catalogItemType}`,
      `Source label: ${sourceLabel}`,
      `Source kind: ${document.sourceKind.trim() || "source_ref"}`,
      `Source ref: ${sourceRef}`,
      "",
      "Return a bounded draft Knowledge pack for review. The draft should propose updated title, quickSummary, fullContent, tags, type, scope, confidence, blockers, and source refs. Do not activate the update.",
    ].join("\n"),
    status: "queued" as const,
  };
}
