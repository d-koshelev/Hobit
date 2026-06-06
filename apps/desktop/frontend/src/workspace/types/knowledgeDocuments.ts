export type KnowledgeDocumentScope = "workspace" | "global";

export type KnowledgeScope = "workspace-local" | "global";

export type KnowledgeItemType =
  | "document"
  | "skill"
  | "workflow"
  | "runbook"
  | "decision"
  | "validation_rule"
  | "known_issue"
  | "codebase_knowledge"
  | "documentation_knowledge"
  | "command_history_summary"
  | "external_reference";

export type KnowledgeCatalogItemType =
  | "document"
  | "codebase_knowledge"
  | "documentation_knowledge"
  | "architecture_decision"
  | "decision"
  | "runbook"
  | "skill"
  | "prompt_template"
  | "validation_rule"
  | "known_issue"
  | "workflow"
  | "command_history_summary"
  | "investigation_summary"
  | "external_reference";

export type KnowledgeLifecycleStatus =
  | "draft"
  | "active"
  | "stale"
  | "archived"
  | "rejected";

export type KnowledgeSourceRefMetadata = {
  workspaceScope?: KnowledgeScope | "current-session-visible" | null;
  reason?: string | null;
  caps?: string[] | null;
  warnings?: string[] | null;
};

export type KnowledgeSourceRef =
  | (KnowledgeSourceRefMetadata & {
      kind: "codebase_path";
      label: string;
      path: string;
      selector?: string | null;
      sourceVersion?: string | null;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "docs_path";
      label: string;
      path: string;
      selector?: string | null;
      sourceVersion?: string | null;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "queue_task";
      label: string;
      queueTaskId: string;
      sourceVersion?: string | null;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "queue_run";
      label: string;
      queueTaskId?: string | null;
      runId: string;
      sourceVersion?: string | null;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "note";
      label: string;
      noteId: string;
      sourceVersion?: string | null;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "finder_selection";
      label: string;
      selectionId?: string | null;
      path: string;
      selectionKind?: string | null;
      sourceVersion?: string | null;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "manual";
      label: string;
      refText: string;
      capturedAt?: string | null;
      redaction?: string | null;
      cap?: string | null;
    })
  | (KnowledgeSourceRefMetadata & {
      kind: "import_file";
      label: string;
      path: string;
      fileName?: string | null;
      importedAt?: string | null;
      sourceVersion?: string | null;
      redaction?: string | null;
      cap?: string | null;
    });

export type KnowledgeRelation = {
  relationId: string;
  relationType: string;
  targetRef: string;
  label: string;
  createdAt?: string | null;
};

export type KnowledgeVersionSummary = {
  knowledgeItemId: string;
  versionId: string;
  version: string;
  lifecycleStatus: KnowledgeLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  sourceRefs: KnowledgeSourceRef[];
};

export type KnowledgeDraftReviewDecisionKind =
  | "accepted"
  | "rejected"
  | "edited_before_accept"
  | "blocked";

export type KnowledgeDraftReviewDecision = {
  reviewId: string;
  workspaceId: string;
  draftPackId: string;
  sourceFingerprint: string;
  sourceQueueItemId?: string | null;
  sourceRunId?: string | null;
  proposedItemId: string;
  proposedItemKey: string;
  action: KnowledgeDraftReviewDecisionKind;
  reviewedAt: string;
  acceptedKnowledgeDocumentId?: string | null;
  acceptedSkillId?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordKnowledgeDraftReviewRequest = {
  workspaceId: string;
  draftPackId: string;
  sourceFingerprint?: string | null;
  sourceQueueItemId?: string | null;
  sourceRunId?: string | null;
  proposedItemId: string;
  proposedItemKey?: string | null;
  action: Extract<
    KnowledgeDraftReviewDecisionKind,
    "accepted" | "rejected" | "edited_before_accept"
  >;
  reviewedAt?: string | null;
  acceptedKnowledgeDocumentId?: string | null;
  acceptedSkillId?: string | null;
  rejectionReason?: string | null;
};

export type ListKnowledgeDraftReviewsRequest = {
  workspaceId: string;
  draftPackId: string;
  sourceFingerprint?: string | null;
};

export type KnowledgeSafetyWarningSeverity = "info" | "warning" | "blocked";

export type KnowledgeSafetyWarning = {
  warningId: string;
  sourceRefId?: string | null;
  severity: KnowledgeSafetyWarningSeverity;
  code: string;
  message: string;
  createdAt: string;
  acknowledgedAt?: string | null;
};

export type KnowledgeContextSnapshot = {
  snapshotId: string;
  sourceRefId: string;
  title: string;
  quickSummary: string;
  itemType: KnowledgeItemType;
  scope: KnowledgeScope;
  lifecycleStatus: KnowledgeLifecycleStatus;
  version: string;
  materializedAt: string;
  tokenEstimate: number;
  contentKind: "summary" | "excerpt";
  content: string;
  capped: boolean;
  warnings: KnowledgeSafetyWarning[];
};

export type CreateKnowledgeDocumentRequest = {
  workspaceId: string;
  scope?: KnowledgeDocumentScope;
  catalogItemType?: KnowledgeCatalogItemType;
  quickSummary?: string;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  title: string;
  sourceLabel: string;
  sourceKind?: string;
  sourceRef?: string;
  sourceRefs?: KnowledgeSourceRef[];
  relations?: KnowledgeRelation[];
  content: string;
  tags: string;
  enabled: boolean;
  searchable?: boolean;
  versionSummary?: string | null;
  reviewedAt?: string | null;
  createdByTaskId?: string | null;
  createdFromRunId?: string | null;
};

export type ListKnowledgeDocumentsRequest = {
  workspaceId: string;
};

export type GetKnowledgeDocumentRequest = {
  workspaceId: string;
  knowledgeDocumentId: string;
};

export type UpdateKnowledgeDocumentRequest = {
  workspaceId: string;
  knowledgeDocumentId: string;
  scope?: KnowledgeDocumentScope;
  catalogItemType?: KnowledgeCatalogItemType;
  quickSummary?: string;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  title: string;
  sourceLabel: string;
  sourceKind?: string;
  sourceRef?: string;
  sourceRefs?: KnowledgeSourceRef[];
  relations?: KnowledgeRelation[];
  content: string;
  tags: string;
  enabled: boolean;
  searchable?: boolean;
  versionSummary?: string | null;
  reviewedAt?: string | null;
  createdByTaskId?: string | null;
  createdFromRunId?: string | null;
};

export type DeleteKnowledgeDocumentRequest = {
  workspaceId: string;
  knowledgeDocumentId: string;
};

export type SearchKnowledgeDocumentsRequest = {
  workspaceId: string;
  query: string;
  limit?: number | null;
  scopes?: KnowledgeDocumentScope[] | null;
  catalogItemTypes?: KnowledgeCatalogItemType[] | null;
  lifecycleStatuses?: KnowledgeLifecycleStatus[] | null;
  tags?: string[] | null;
  sourceKinds?: string[] | null;
  updatedAfter?: string | null;
  updatedWithinDays?: number | null;
};

export type ReadKnowledgeDocumentImportFileRequest = {
  path: string;
};

export type KnowledgeDocumentImportFile = {
  fileName: string;
  title: string;
  content: string;
};

export type KnowledgeDocument = {
  knowledgeDocumentId: string;
  workspaceId: string;
  scope: KnowledgeDocumentScope;
  catalogItemType: KnowledgeCatalogItemType;
  quickSummary: string;
  lifecycleStatus: KnowledgeLifecycleStatus;
  title: string;
  sourceLabel: string;
  sourceKind: string;
  sourceRef: string;
  sourceRefs?: KnowledgeSourceRef[];
  relations?: KnowledgeRelation[];
  content: string;
  tags: string;
  enabled: boolean;
  searchable?: boolean;
  version?: number;
  versionSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  createdByTaskId?: string | null;
  createdFromRunId?: string | null;
};

export type KnowledgeDocumentSearchResult = {
  knowledgeDocumentId: string;
  documentTitle: string;
  scope: KnowledgeDocumentScope;
  sourceLabel: string;
  tags: string;
  chunkId: string;
  chunkIndex: number;
  snippet: string;
  score: number;
};

export function knowledgeScopeFromDocumentScope(
  scope: KnowledgeDocumentScope,
): KnowledgeScope {
  return scope === "global" ? "global" : "workspace-local";
}

export function knowledgeDocumentScopeFromKnowledgeScope(
  scope: KnowledgeScope,
): KnowledgeDocumentScope {
  return scope === "global" ? "global" : "workspace";
}

export function knowledgeItemTypeFromCatalogItemType(
  itemType: KnowledgeCatalogItemType,
): KnowledgeItemType {
  switch (itemType) {
    case "document":
      return "document";
    case "architecture_decision":
    case "decision":
      return "decision";
    case "prompt_template":
    case "investigation_summary":
      return "document";
    default:
      return itemType;
  }
}

export function knowledgeSourceRefFromLegacyFields({
  sourceKind,
  sourceLabel,
  sourceRef,
}: {
  sourceKind?: string | null;
  sourceLabel: string;
  sourceRef?: string | null;
}): KnowledgeSourceRef {
  const label = sourceLabel.trim() || "Knowledge source";
  const ref = sourceRef?.trim() ?? "";

  switch (sourceKind?.trim()) {
    case "codebase_path":
    case "codebase":
    case "file":
      return { kind: "codebase_path", label, path: ref };
    case "docs_path":
    case "docs":
    case "documentation":
      return { kind: "docs_path", label, path: ref };
    case "queue_task":
    case "queue":
      return { kind: "queue_task", label, queueTaskId: ref };
    case "queue_run":
    case "run":
      return { kind: "queue_run", label, runId: ref };
    case "note":
      return { kind: "note", label, noteId: ref };
    case "finder_selection":
    case "finder":
      return { kind: "finder_selection", label, path: ref };
    case "import_file":
    case "import":
      return { kind: "import_file", label, path: ref };
    case "manual":
    case "operator_authored":
    default:
      return { kind: "manual", label, refText: ref };
  }
}

export function legacyKnowledgeSourceFromRefs(sourceRefs?: KnowledgeSourceRef[]) {
  const sourceRef = sourceRefs?.[0];
  if (!sourceRef) {
    return null;
  }

  switch (sourceRef.kind) {
    case "codebase_path":
    case "docs_path":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.path };
    case "queue_task":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.queueTaskId };
    case "queue_run":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.runId };
    case "note":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.noteId };
    case "finder_selection":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.path };
    case "manual":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.refText };
    case "import_file":
      return { sourceKind: sourceRef.kind, sourceRef: sourceRef.path };
  }
}
