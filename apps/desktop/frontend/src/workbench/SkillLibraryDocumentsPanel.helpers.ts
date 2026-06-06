import type { KnowledgeDocument, KnowledgeSourceRef } from "../workspace/types";
import {
  knowledgeDraftAcceptedSourceLabel,
  knowledgeDraftAcceptedSourceRef,
  type KnowledgeDraftReviewItem,
  type KnowledgeDraftReviewPack,
} from "./knowledgeDraftPacks";
import {
  DEFAULT_DOCUMENT_TITLE,
  type KnowledgeDocumentDraft,
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
    return "Create a Skill with New skill or load a Skill draft from Import file.";
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
  const sourceRefs = sourceRefsForDocument(document);
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
      "Structured source refs:",
      ...sourceRefs.map((ref, index) => `${index + 1}. ${sourceRefSummary(ref)}`),
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
      "Structured source refs from current Knowledge item:",
      ...sourceRefs.map((ref, index) => `${index + 1}. ${sourceRefSummary(ref)}`),
      "",
      "Return a bounded draft Knowledge pack for review. The draft should propose updated title, quickSummary, fullContent, tags, type, scope, confidence, blockers, and source refs. Do not activate the update.",
    ].join("\n"),
    status: "queued" as const,
  };
}

export function knowledgeDocumentRequestFromDraft(
  draft: KnowledgeDocumentDraft,
  title: string,
) {
  return {
    scope: draft.scope,
    catalogItemType: draft.catalogItemType,
    quickSummary: draft.quickSummary,
    lifecycleStatus: draft.lifecycleStatus,
    title,
    sourceLabel: draft.sourceLabel,
    sourceKind: draft.sourceKind,
    sourceRef: draft.sourceRef,
    sourceRefs: sourceRefsForDraft(draft),
    content: draft.content,
    tags: draft.tags,
    enabled: draft.enabled,
  };
}

export function knowledgeDocumentRequestFromDocument(
  document: KnowledgeDocument,
  lifecycleStatus = document.lifecycleStatus,
) {
  return {
    scope: document.scope,
    catalogItemType: document.catalogItemType,
    quickSummary: document.quickSummary,
    lifecycleStatus,
    title: document.title,
    sourceLabel: document.sourceLabel,
    sourceKind: document.sourceKind,
    sourceRef: document.sourceRef,
    sourceRefs: sourceRefsForDocument(document),
    content: document.content,
    tags: document.tags,
    enabled: document.enabled,
  };
}

function sourceRefsForDraft(draft: KnowledgeDocumentDraft): KnowledgeSourceRef[] {
  const sourceKind = draft.sourceKind.trim();
  const sourceRef = draft.sourceRef.trim();
  const sourceLabel = draft.sourceLabel.trim() || "Manual Knowledge source";

  if (sourceKind === "import_file" || sourceKind === "file_import") {
    return [
      {
        cap: "Explicit single-file plain text/Markdown import only",
        caps: ["Explicit single-file plain text/Markdown import only"],
        kind: "import_file",
        label: sourceLabel,
        path: sourceRef,
        reason: "Operator imported one selected text/Markdown file.",
        warnings: ["No folder import, binary parsing, or background ingest."],
        workspaceScope:
          draft.scope === "global" ? "global" : "workspace-local",
      },
    ];
  }

  return [
    {
      cap: "Operator-authored or manually entered Knowledge source",
      caps: ["Operator-authored or manually entered source ref only"],
      kind: "manual",
      label: sourceLabel,
      reason: "Operator manually authored or entered this Knowledge source.",
      refText: sourceRef,
      warnings: ["No automatic source discovery or hidden context was used."],
      workspaceScope:
        draft.scope === "global" ? "global" : "workspace-local",
    },
  ];
}

function sourceRefsForDocument(document: KnowledgeDocument): KnowledgeSourceRef[] {
  if (document.sourceRefs?.length) {
    return document.sourceRefs;
  }

  const scope = document.scope === "global" ? "global" : "workspace-local";
  const sourceLabel = document.sourceLabel.trim() || "Knowledge source";
  const sourceRef = document.sourceRef.trim();

  if (document.sourceKind === "workspace_note" || document.sourceKind === "note") {
    return [
      {
        cap: "Explicit saved Note promotion only",
        caps: ["Explicit saved Note promotion only"],
        kind: "note",
        label: sourceLabel,
        noteId: sourceRef,
        reason: "Operator promoted a saved selected Note into Knowledge.",
        warnings: ["Original Note remains unchanged; Notes are not auto-ingested."],
        workspaceScope: scope,
      },
    ];
  }

  return [
    {
      cap: "Legacy single source ref fallback",
      caps: ["Legacy single source ref fallback"],
      kind: "manual",
      label: sourceLabel,
      reason: "Structured source refs were not present; preserving the visible legacy source ref.",
      refText: sourceRef,
      warnings: ["Partial provenance only."],
      workspaceScope: scope,
    },
  ];
}

function sourceRefSummary(sourceRef: KnowledgeSourceRef) {
  const common = [
    `kind=${sourceRef.kind}`,
    `label=${sourceRef.label}`,
    sourceRef.reason ? `reason=${sourceRef.reason}` : "",
    sourceRef.workspaceScope ? `scope=${sourceRef.workspaceScope}` : "",
  ].filter(Boolean);

  switch (sourceRef.kind) {
    case "codebase_path":
    case "docs_path":
      return [...common, `path=${sourceRef.path}`].join("; ");
    case "queue_task":
      return [...common, `id=${sourceRef.queueTaskId}`].join("; ");
    case "queue_run":
      return [...common, `id=${sourceRef.runId}`].join("; ");
    case "note":
      return [...common, `id=${sourceRef.noteId}`].join("; ");
    case "finder_selection":
      return [...common, `path=${sourceRef.path}`].join("; ");
    case "import_file":
      return [...common, `path=${sourceRef.path}`].join("; ");
    case "manual":
      return [...common, `selector=${sourceRef.refText}`].join("; ");
  }
}
