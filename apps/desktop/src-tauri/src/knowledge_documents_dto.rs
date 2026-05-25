use hobit_app::{
    CreateKnowledgeDocumentInput, DeleteKnowledgeDocumentInput,
    KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary, SearchKnowledgeDocumentsInput,
    UpdateKnowledgeDocumentInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateKnowledgeDocumentRequest {
    pub workspace_id: String,
    pub title: String,
    pub source_label: String,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListKnowledgeDocumentsRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetKnowledgeDocumentRequest {
    pub workspace_id: String,
    pub knowledge_document_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct UpdateKnowledgeDocumentRequest {
    pub workspace_id: String,
    pub knowledge_document_id: String,
    pub title: String,
    pub source_label: String,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct DeleteKnowledgeDocumentRequest {
    pub workspace_id: String,
    pub knowledge_document_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct SearchKnowledgeDocumentsRequest {
    pub workspace_id: String,
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct KnowledgeDocumentDto {
    pub knowledge_document_id: String,
    pub workspace_id: String,
    pub title: String,
    pub source_label: String,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct KnowledgeDocumentSearchResultDto {
    pub knowledge_document_id: String,
    pub document_title: String,
    pub source_label: String,
    pub tags: String,
    pub chunk_id: String,
    pub chunk_index: i64,
    pub snippet: String,
    pub score: i64,
}

impl From<CreateKnowledgeDocumentRequest> for CreateKnowledgeDocumentInput {
    fn from(request: CreateKnowledgeDocumentRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            title: request.title,
            source_label: request.source_label,
            content: request.content,
            tags: request.tags,
            enabled: request.enabled,
        }
    }
}

impl From<UpdateKnowledgeDocumentRequest> for UpdateKnowledgeDocumentInput {
    fn from(request: UpdateKnowledgeDocumentRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            knowledge_document_id: request.knowledge_document_id,
            title: request.title,
            source_label: request.source_label,
            content: request.content,
            tags: request.tags,
            enabled: request.enabled,
        }
    }
}

impl From<DeleteKnowledgeDocumentRequest> for DeleteKnowledgeDocumentInput {
    fn from(request: DeleteKnowledgeDocumentRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            knowledge_document_id: request.knowledge_document_id,
        }
    }
}

impl From<SearchKnowledgeDocumentsRequest> for SearchKnowledgeDocumentsInput {
    fn from(request: SearchKnowledgeDocumentsRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            query: request.query,
            limit: request.limit,
        }
    }
}

impl From<KnowledgeDocumentSummary> for KnowledgeDocumentDto {
    fn from(summary: KnowledgeDocumentSummary) -> Self {
        Self {
            knowledge_document_id: summary.knowledge_document_id,
            workspace_id: summary.workspace_id,
            title: summary.title,
            source_label: summary.source_label,
            content: summary.content,
            tags: summary.tags,
            enabled: summary.enabled,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}

impl From<KnowledgeDocumentSearchResultSummary> for KnowledgeDocumentSearchResultDto {
    fn from(summary: KnowledgeDocumentSearchResultSummary) -> Self {
        Self {
            knowledge_document_id: summary.knowledge_document_id,
            document_title: summary.document_title,
            source_label: summary.source_label,
            tags: summary.tags,
            chunk_id: summary.chunk_id,
            chunk_index: summary.chunk_index,
            snippet: summary.snippet,
            score: summary.score,
        }
    }
}
