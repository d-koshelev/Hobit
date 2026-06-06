import { invoke } from "@tauri-apps/api/core";
import {
  knowledgeSourceRefFromLegacyFields,
  legacyKnowledgeSourceFromRefs,
} from "./types";
import type {
  CreateKnowledgeDocumentRequest,
  DeleteKnowledgeDocumentRequest,
  GetKnowledgeDocumentRequest,
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
  KnowledgeSourceRef,
  ListKnowledgeDocumentsRequest,
  SearchKnowledgeDocumentsRequest,
  UpdateKnowledgeDocumentRequest,
} from "./types";

type TauriKnowledgeDocument = {
  knowledge_document_id: string;
  workspace_id: string;
  scope?: string | null;
  catalog_item_type?: string | null;
  quick_summary?: string | null;
  lifecycle_status?: string | null;
  title: string;
  source_label: string;
  source_kind?: string | null;
  source_ref?: string | null;
  source_refs?: TauriKnowledgeSourceRef[] | null;
  relations?: TauriKnowledgeRelation[] | null;
  content: string;
  tags: string;
  enabled: boolean;
  searchable?: boolean | null;
  version?: number | null;
  version_summary?: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  created_by_task_id?: string | null;
  created_from_run_id?: string | null;
};

type TauriKnowledgeDocumentSearchResult = {
  knowledge_document_id: string;
  document_title: string;
  scope?: string | null;
  source_label: string;
  tags: string;
  chunk_id: string;
  chunk_index: number;
  snippet: string;
  score: number;
};

type TauriKnowledgeSourceRef =
  | {
      kind: "codebase_path" | "docs_path";
      label: string;
      path: string;
      selector?: string | null;
      source_version?: string | null;
      captured_at?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    }
  | {
      kind: "queue_task";
      label: string;
      queue_task_id: string;
      source_version?: string | null;
      captured_at?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    }
  | {
      kind: "queue_run";
      label: string;
      queue_task_id?: string | null;
      run_id: string;
      source_version?: string | null;
      captured_at?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    }
  | {
      kind: "note";
      label: string;
      note_id: string;
      source_version?: string | null;
      captured_at?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    }
  | {
      kind: "finder_selection";
      label: string;
      selection_id?: string | null;
      path: string;
      selection_kind?: string | null;
      source_version?: string | null;
      captured_at?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    }
  | {
      kind: "manual";
      label: string;
      ref_text: string;
      captured_at?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    }
  | {
      kind: "import_file";
      label: string;
      path: string;
      file_name?: string | null;
      imported_at?: string | null;
      source_version?: string | null;
      redaction?: string | null;
      cap?: string | null;
      workspace_scope?: string | null;
      reason?: string | null;
      caps?: string[] | null;
      warnings?: string[] | null;
    };

type TauriKnowledgeRelation = {
  relation_id: string;
  relation_type: string;
  target_ref: string;
  label: string;
  created_at?: string | null;
};

export async function createKnowledgeDocument(
  request: CreateKnowledgeDocumentRequest,
): Promise<KnowledgeDocument> {
  const document = await invoke<TauriKnowledgeDocument>(
    "create_knowledge_document",
    {
      request: toTauriCreateKnowledgeDocumentRequest(request),
    },
  );

  return normalizeKnowledgeDocument(document);
}

export async function listKnowledgeDocuments(
  request: ListKnowledgeDocumentsRequest,
): Promise<KnowledgeDocument[]> {
  const documents = await invoke<TauriKnowledgeDocument[]>(
    "list_knowledge_documents",
    {
      request: {
        workspace_id: request.workspaceId,
      },
    },
  );

  return documents.map(normalizeKnowledgeDocument);
}

export async function getKnowledgeDocument(
  request: GetKnowledgeDocumentRequest,
): Promise<KnowledgeDocument | null> {
  const document = await invoke<TauriKnowledgeDocument | null>(
    "get_knowledge_document",
    {
      request: {
        workspace_id: request.workspaceId,
        knowledge_document_id: request.knowledgeDocumentId,
      },
    },
  );

  return document ? normalizeKnowledgeDocument(document) : null;
}

export async function updateKnowledgeDocument(
  request: UpdateKnowledgeDocumentRequest,
): Promise<KnowledgeDocument | null> {
  const legacySource = legacyKnowledgeSourceFromRefs(request.sourceRefs);
  const document = await invoke<TauriKnowledgeDocument | null>(
    "update_knowledge_document",
    {
      request: {
        workspace_id: request.workspaceId,
        knowledge_document_id: request.knowledgeDocumentId,
        scope: request.scope ?? "workspace",
        catalog_item_type: request.catalogItemType ?? "documentation_knowledge",
        quick_summary: request.quickSummary ?? "",
        lifecycle_status: request.lifecycleStatus ?? "active",
        title: request.title,
        source_label: request.sourceLabel,
        source_kind:
          request.sourceKind ?? legacySource?.sourceKind ?? "operator_authored",
        source_ref: request.sourceRef ?? legacySource?.sourceRef ?? "",
        ...(request.sourceRefs
          ? { source_refs: request.sourceRefs.map(toTauriKnowledgeSourceRef) }
          : {}),
        ...(request.relations
          ? { relations: request.relations.map(toTauriKnowledgeRelation) }
          : {}),
        content: request.content,
        tags: request.tags,
        enabled: request.enabled,
        searchable: request.searchable ?? true,
        version_summary: request.versionSummary ?? null,
        reviewed_at: request.reviewedAt ?? null,
        created_by_task_id: request.createdByTaskId ?? null,
        created_from_run_id: request.createdFromRunId ?? null,
      },
    },
  );

  return document ? normalizeKnowledgeDocument(document) : null;
}

export async function deleteKnowledgeDocument(
  request: DeleteKnowledgeDocumentRequest,
): Promise<boolean> {
  return invoke<boolean>("delete_knowledge_document", {
    request: {
      workspace_id: request.workspaceId,
      knowledge_document_id: request.knowledgeDocumentId,
    },
  });
}

export async function searchKnowledgeDocuments(
  request: SearchKnowledgeDocumentsRequest,
): Promise<KnowledgeDocumentSearchResult[]> {
  const results = await invoke<TauriKnowledgeDocumentSearchResult[]>(
    "search_knowledge_documents",
    {
      request: {
        workspace_id: request.workspaceId,
        query: request.query,
        limit: request.limit ?? null,
      },
    },
  );

  return results.map(normalizeKnowledgeDocumentSearchResult);
}

function toTauriCreateKnowledgeDocumentRequest(
  request: CreateKnowledgeDocumentRequest,
) {
  const legacySource = legacyKnowledgeSourceFromRefs(request.sourceRefs);
  return {
    workspace_id: request.workspaceId,
    scope: request.scope ?? "workspace",
    catalog_item_type: request.catalogItemType ?? "documentation_knowledge",
    quick_summary: request.quickSummary ?? "",
    lifecycle_status: request.lifecycleStatus ?? "active",
    title: request.title,
    source_label: request.sourceLabel,
    source_kind:
      request.sourceKind ?? legacySource?.sourceKind ?? "operator_authored",
    source_ref: request.sourceRef ?? legacySource?.sourceRef ?? "",
    ...(request.sourceRefs
      ? { source_refs: request.sourceRefs.map(toTauriKnowledgeSourceRef) }
      : {}),
    ...(request.relations
      ? { relations: request.relations.map(toTauriKnowledgeRelation) }
      : {}),
    content: request.content,
    tags: request.tags,
    enabled: request.enabled,
    searchable: request.searchable ?? true,
    version_summary: request.versionSummary ?? null,
    reviewed_at: request.reviewedAt ?? null,
    created_by_task_id: request.createdByTaskId ?? null,
    created_from_run_id: request.createdFromRunId ?? null,
  };
}

function normalizeKnowledgeDocument(
  document: TauriKnowledgeDocument,
): KnowledgeDocument {
  return {
    knowledgeDocumentId: document.knowledge_document_id,
    workspaceId: document.workspace_id,
    scope: normalizeKnowledgeDocumentScope(document.scope),
    catalogItemType: normalizeKnowledgeCatalogItemType(
      document.catalog_item_type,
    ),
    quickSummary: document.quick_summary ?? "",
    lifecycleStatus: normalizeKnowledgeLifecycleStatus(
      document.lifecycle_status,
    ),
    title: document.title,
    sourceLabel: document.source_label,
    sourceKind: document.source_kind ?? "operator_authored",
    sourceRef: document.source_ref ?? "",
    sourceRefs: normalizeKnowledgeSourceRefs(document),
    relations: document.relations?.map(normalizeKnowledgeRelation) ?? [],
    content: document.content,
    tags: document.tags,
    enabled: document.enabled,
    searchable: document.searchable ?? true,
    version: document.version ?? 1,
    versionSummary: document.version_summary ?? "",
    createdAt: document.created_at,
    updatedAt: document.updated_at,
    reviewedAt: document.reviewed_at ?? null,
    createdByTaskId: document.created_by_task_id ?? null,
    createdFromRunId: document.created_from_run_id ?? null,
  };
}

function normalizeKnowledgeDocumentSearchResult(
  result: TauriKnowledgeDocumentSearchResult,
): KnowledgeDocumentSearchResult {
  return {
    knowledgeDocumentId: result.knowledge_document_id,
    documentTitle: result.document_title,
    scope: normalizeKnowledgeDocumentScope(result.scope),
    sourceLabel: result.source_label,
    tags: result.tags,
    chunkId: result.chunk_id,
    chunkIndex: result.chunk_index,
    snippet: result.snippet,
    score: result.score,
  };
}

function normalizeKnowledgeSourceRefs(
  document: TauriKnowledgeDocument,
): KnowledgeSourceRef[] {
  if (document.source_refs?.length) {
    return document.source_refs.map(normalizeKnowledgeSourceRef);
  }

  return [
    knowledgeSourceRefFromLegacyFields({
      sourceKind: document.source_kind,
      sourceLabel: document.source_label,
      sourceRef: document.source_ref,
    }),
  ];
}

function normalizeKnowledgeSourceRef(
  sourceRef: TauriKnowledgeSourceRef,
): KnowledgeSourceRef {
  switch (sourceRef.kind) {
    case "codebase_path":
    case "docs_path":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        capturedAt: sourceRef.captured_at,
        kind: sourceRef.kind,
        label: sourceRef.label,
        path: sourceRef.path,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        selector: sourceRef.selector,
        sourceVersion: sourceRef.source_version,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
    case "queue_task":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        capturedAt: sourceRef.captured_at,
        kind: "queue_task",
        label: sourceRef.label,
        queueTaskId: sourceRef.queue_task_id,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        sourceVersion: sourceRef.source_version,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
    case "queue_run":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        capturedAt: sourceRef.captured_at,
        kind: "queue_run",
        label: sourceRef.label,
        queueTaskId: sourceRef.queue_task_id,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        runId: sourceRef.run_id,
        sourceVersion: sourceRef.source_version,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
    case "note":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        capturedAt: sourceRef.captured_at,
        kind: "note",
        label: sourceRef.label,
        noteId: sourceRef.note_id,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        sourceVersion: sourceRef.source_version,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
    case "finder_selection":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        capturedAt: sourceRef.captured_at,
        kind: "finder_selection",
        label: sourceRef.label,
        path: sourceRef.path,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        selectionId: sourceRef.selection_id,
        selectionKind: sourceRef.selection_kind,
        sourceVersion: sourceRef.source_version,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
    case "manual":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        capturedAt: sourceRef.captured_at,
        kind: "manual",
        label: sourceRef.label,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        refText: sourceRef.ref_text,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
    case "import_file":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps ?? [],
        fileName: sourceRef.file_name,
        importedAt: sourceRef.imported_at,
        kind: "import_file",
        label: sourceRef.label,
        path: sourceRef.path,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        sourceVersion: sourceRef.source_version,
        warnings: sourceRef.warnings ?? [],
        workspaceScope: normalizeKnowledgeSourceRefScope(sourceRef.workspace_scope),
      };
  }
}

function normalizeKnowledgeRelation(relation: TauriKnowledgeRelation) {
  return {
    relationId: relation.relation_id,
    relationType: relation.relation_type,
    targetRef: relation.target_ref,
    label: relation.label,
    createdAt: relation.created_at,
  };
}

function toTauriKnowledgeRelation(
  relation: NonNullable<KnowledgeDocument["relations"]>[number],
): TauriKnowledgeRelation {
  return {
    relation_id: relation.relationId,
    relation_type: relation.relationType,
    target_ref: relation.targetRef,
    label: relation.label,
    created_at: relation.createdAt,
  };
}

function toTauriKnowledgeSourceRef(
  sourceRef: KnowledgeSourceRef,
): TauriKnowledgeSourceRef {
  switch (sourceRef.kind) {
    case "codebase_path":
    case "docs_path":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        captured_at: sourceRef.capturedAt,
        kind: sourceRef.kind,
        label: sourceRef.label,
        path: sourceRef.path,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        selector: sourceRef.selector,
        source_version: sourceRef.sourceVersion,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
    case "queue_task":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        captured_at: sourceRef.capturedAt,
        kind: "queue_task",
        label: sourceRef.label,
        queue_task_id: sourceRef.queueTaskId,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        source_version: sourceRef.sourceVersion,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
    case "queue_run":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        captured_at: sourceRef.capturedAt,
        kind: "queue_run",
        label: sourceRef.label,
        queue_task_id: sourceRef.queueTaskId,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        run_id: sourceRef.runId,
        source_version: sourceRef.sourceVersion,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
    case "note":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        captured_at: sourceRef.capturedAt,
        kind: "note",
        label: sourceRef.label,
        note_id: sourceRef.noteId,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        source_version: sourceRef.sourceVersion,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
    case "finder_selection":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        captured_at: sourceRef.capturedAt,
        kind: "finder_selection",
        label: sourceRef.label,
        path: sourceRef.path,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        selection_id: sourceRef.selectionId,
        selection_kind: sourceRef.selectionKind,
        source_version: sourceRef.sourceVersion,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
    case "manual":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        captured_at: sourceRef.capturedAt,
        kind: "manual",
        label: sourceRef.label,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        ref_text: sourceRef.refText,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
    case "import_file":
      return {
        cap: sourceRef.cap,
        caps: sourceRef.caps,
        file_name: sourceRef.fileName,
        imported_at: sourceRef.importedAt,
        kind: "import_file",
        label: sourceRef.label,
        path: sourceRef.path,
        reason: sourceRef.reason,
        redaction: sourceRef.redaction,
        source_version: sourceRef.sourceVersion,
        warnings: sourceRef.warnings,
        workspace_scope: sourceRef.workspaceScope,
      };
  }
}

function normalizeKnowledgeDocumentScope(scope: string | null | undefined) {
  return scope === "global" ? "global" : "workspace";
}

function normalizeKnowledgeCatalogItemType(
  itemType: string | null | undefined,
) {
  switch (itemType) {
    case "document":
    case "codebase_knowledge":
    case "decision":
    case "architecture_decision":
    case "runbook":
    case "skill":
    case "prompt_template":
    case "validation_rule":
    case "known_issue":
    case "workflow":
    case "command_history_summary":
    case "investigation_summary":
    case "external_reference":
      return itemType;
    case "documentation_knowledge":
    default:
      return "documentation_knowledge";
  }
}

function normalizeKnowledgeLifecycleStatus(
  status: string | null | undefined,
) {
  switch (status) {
    case "draft":
    case "stale":
    case "archived":
    case "rejected":
      return status;
    case "active":
    default:
      return "active";
  }
}

function normalizeKnowledgeSourceRefScope(scope: string | null | undefined) {
  if (
    scope === "global" ||
    scope === "workspace-local" ||
    scope === "current-session-visible"
  ) {
    return scope;
  }

  return null;
}
