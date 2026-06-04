import type { KnowledgeDocument } from "../workspace/types";
import type { KnowledgeDocumentDraft } from "./skillLibraryModel";

type KnowledgeSummaryWarningInput = Pick<
  KnowledgeDocument | KnowledgeDocumentDraft,
  "enabled" | "lifecycleStatus" | "quickSummary"
>;

export function knowledgeDocumentQuickSummaryWarning(
  document: KnowledgeSummaryWarningInput,
) {
  if (document.quickSummary.trim()) {
    return null;
  }

  if (document.lifecycleStatus === "active" && document.enabled) {
    return "Summary missing. Active searchable Knowledge should have a quick summary before use.";
  }

  if (document.lifecycleStatus === "draft") {
    return "Summary missing. Draft Knowledge may stay incomplete, but it remains warning-bearing until a quick summary is added.";
  }

  return "Summary missing. Add a quick summary before relying on this Knowledge item.";
}

export function knowledgeDocumentMessageWithSummaryWarning(
  message: string,
  document: KnowledgeSummaryWarningInput,
) {
  return [message, knowledgeDocumentQuickSummaryWarning(document)]
    .filter(Boolean)
    .join(" ");
}
