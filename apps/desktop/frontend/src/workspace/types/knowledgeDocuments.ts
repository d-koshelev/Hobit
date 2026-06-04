export type KnowledgeDocumentScope = "workspace" | "global";

export type KnowledgeCatalogItemType =
  | "codebase_knowledge"
  | "documentation_knowledge"
  | "architecture_decision"
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
  catalogItemType?: KnowledgeCatalogItemType;
  quickSummary?: string;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  title: string;
  sourceLabel: string;
  sourceKind?: string;
  sourceRef?: string;
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
  catalogItemType: KnowledgeCatalogItemType;
  quickSummary: string;
  lifecycleStatus: KnowledgeLifecycleStatus;
  title: string;
  sourceLabel: string;
  sourceKind: string;
  sourceRef: string;
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
