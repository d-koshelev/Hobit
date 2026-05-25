export type CreateKnowledgeDocumentRequest = {
  workspaceId: string;
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

export type KnowledgeDocument = {
  knowledgeDocumentId: string;
  workspaceId: string;
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
  sourceLabel: string;
  tags: string;
  chunkId: string;
  chunkIndex: number;
  snippet: string;
  score: number;
};
