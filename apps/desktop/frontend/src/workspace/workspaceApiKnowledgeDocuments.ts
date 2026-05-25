import { getWorkspaceApi } from "./workspaceApiRuntime";
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

export function createKnowledgeDocument(
  request: CreateKnowledgeDocumentRequest,
): Promise<KnowledgeDocument> {
  return getWorkspaceApi().createKnowledgeDocument(request);
}

export function listKnowledgeDocuments(
  request: ListKnowledgeDocumentsRequest,
): Promise<KnowledgeDocument[]> {
  return getWorkspaceApi().listKnowledgeDocuments(request);
}

export function getKnowledgeDocument(
  request: GetKnowledgeDocumentRequest,
): Promise<KnowledgeDocument | null> {
  return getWorkspaceApi().getKnowledgeDocument(request);
}

export function updateKnowledgeDocument(
  request: UpdateKnowledgeDocumentRequest,
): Promise<KnowledgeDocument | null> {
  return getWorkspaceApi().updateKnowledgeDocument(request);
}

export function deleteKnowledgeDocument(
  request: DeleteKnowledgeDocumentRequest,
): Promise<boolean> {
  return getWorkspaceApi().deleteKnowledgeDocument(request);
}

export function searchKnowledgeDocuments(
  request: SearchKnowledgeDocumentsRequest,
): Promise<KnowledgeDocumentSearchResult[]> {
  return getWorkspaceApi().searchKnowledgeDocuments(request);
}
