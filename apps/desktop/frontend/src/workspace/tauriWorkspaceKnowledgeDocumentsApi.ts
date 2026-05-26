import { invoke } from "@tauri-apps/api/core";
import type {
  CreateKnowledgeDocumentRequest,
  DeleteKnowledgeDocumentRequest,
  GetKnowledgeDocumentRequest,
  KnowledgeDocument,
  KnowledgeDocumentSearchResult,
  ListKnowledgeDocumentsRequest,
  SearchKnowledgeDocumentsRequest,
  UpdateKnowledgeDocumentRequest,
} from "./types";

type TauriKnowledgeDocument = {
  knowledge_document_id: string;
  workspace_id: string;
  scope?: string | null;
  title: string;
  source_label: string;
  content: string;
  tags: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
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
  const document = await invoke<TauriKnowledgeDocument | null>(
    "update_knowledge_document",
    {
      request: {
        workspace_id: request.workspaceId,
        knowledge_document_id: request.knowledgeDocumentId,
        scope: request.scope ?? "workspace",
        title: request.title,
        source_label: request.sourceLabel,
        content: request.content,
        tags: request.tags,
        enabled: request.enabled,
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
  return {
    workspace_id: request.workspaceId,
    scope: request.scope ?? "workspace",
    title: request.title,
    source_label: request.sourceLabel,
    content: request.content,
    tags: request.tags,
    enabled: request.enabled,
  };
}

function normalizeKnowledgeDocument(
  document: TauriKnowledgeDocument,
): KnowledgeDocument {
  return {
    knowledgeDocumentId: document.knowledge_document_id,
    workspaceId: document.workspace_id,
    scope: normalizeKnowledgeDocumentScope(document.scope),
    title: document.title,
    sourceLabel: document.source_label,
    content: document.content,
    tags: document.tags,
    enabled: document.enabled,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
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

function normalizeKnowledgeDocumentScope(scope: string | null | undefined) {
  return scope === "global" ? "global" : "workspace";
}
