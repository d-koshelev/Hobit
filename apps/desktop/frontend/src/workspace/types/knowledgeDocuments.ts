export type KnowledgeDocumentScope = "workspace" | "global";

export type CreateKnowledgeDocumentRequest = {
  workspaceId: string;
  scope?: KnowledgeDocumentScope;
  title: string;
  sourceLabel: string;
  content: string;
  tags: string;
  enabled: boolean;
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
  title: string;
  sourceLabel: string;
  content: string;
  tags: string;
  enabled: boolean;
};

export type DeleteKnowledgeDocumentRequest = {
  workspaceId: string;
  knowledgeDocumentId: string;
};

export type SearchKnowledgeDocumentsRequest = {
  workspaceId: string;
  query: string;
  limit?: number | null;
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
  title: string;
  sourceLabel: string;
  content: string;
  tags: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
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
