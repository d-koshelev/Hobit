use hobit_app::{
    CreateKnowledgeDocumentInput, DeleteKnowledgeDocumentInput,
    KnowledgeDocumentSearchResultSummary, KnowledgeDocumentSummary, KnowledgeSourceRef,
    SearchKnowledgeDocumentsFiltersInput, SearchKnowledgeDocumentsInput,
    UpdateKnowledgeDocumentInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateKnowledgeDocumentRequest {
    pub workspace_id: String,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub catalog_item_type: Option<String>,
    #[serde(default)]
    pub quick_summary: Option<String>,
    #[serde(default)]
    pub lifecycle_status: Option<String>,
    pub title: String,
    pub source_label: String,
    #[serde(default)]
    pub source_kind: Option<String>,
    #[serde(default)]
    pub source_ref: Option<String>,
    #[serde(default)]
    pub source_refs: Option<Vec<KnowledgeSourceRef>>,
    #[serde(default)]
    pub relations: Vec<hobit_app::KnowledgeRelation>,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub searchable: bool,
    #[serde(default)]
    pub version_summary: Option<String>,
    #[serde(default)]
    pub reviewed_at: Option<String>,
    #[serde(default)]
    pub created_by_task_id: Option<String>,
    #[serde(default)]
    pub created_from_run_id: Option<String>,
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
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub catalog_item_type: Option<String>,
    #[serde(default)]
    pub quick_summary: Option<String>,
    #[serde(default)]
    pub lifecycle_status: Option<String>,
    pub title: String,
    pub source_label: String,
    #[serde(default)]
    pub source_kind: Option<String>,
    #[serde(default)]
    pub source_ref: Option<String>,
    #[serde(default)]
    pub source_refs: Option<Vec<KnowledgeSourceRef>>,
    #[serde(default)]
    pub relations: Vec<hobit_app::KnowledgeRelation>,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub searchable: bool,
    #[serde(default)]
    pub version_summary: Option<String>,
    #[serde(default)]
    pub reviewed_at: Option<String>,
    #[serde(default)]
    pub created_by_task_id: Option<String>,
    #[serde(default)]
    pub created_from_run_id: Option<String>,
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
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub catalog_item_types: Vec<String>,
    #[serde(default)]
    pub lifecycle_statuses: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub source_kinds: Vec<String>,
    #[serde(default)]
    pub updated_after: Option<String>,
    #[serde(default)]
    pub updated_within_days: Option<u32>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct KnowledgeDocumentDto {
    pub knowledge_document_id: String,
    pub workspace_id: String,
    pub scope: String,
    pub catalog_item_type: String,
    pub quick_summary: String,
    pub lifecycle_status: String,
    pub title: String,
    pub source_label: String,
    pub source_kind: String,
    pub source_ref: String,
    pub source_refs: Vec<KnowledgeSourceRef>,
    pub relations: Vec<hobit_app::KnowledgeRelation>,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
    pub searchable: bool,
    pub version: i64,
    pub version_summary: String,
    pub created_at: String,
    pub updated_at: String,
    pub reviewed_at: Option<String>,
    pub created_by_task_id: Option<String>,
    pub created_from_run_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct KnowledgeDocumentSearchResultDto {
    pub knowledge_document_id: String,
    pub document_title: String,
    pub scope: String,
    pub source_label: String,
    pub tags: String,
    pub chunk_id: String,
    pub chunk_index: i64,
    pub snippet: String,
    pub score: i64,
}

impl From<CreateKnowledgeDocumentRequest> for CreateKnowledgeDocumentInput {
    fn from(request: CreateKnowledgeDocumentRequest) -> Self {
        let source_kind = request.source_kind.or_else(|| {
            request
                .source_refs
                .as_ref()
                .and_then(|source_refs| source_refs.first())
                .map(|source_ref| source_ref.legacy_kind().to_owned())
        });
        let source_ref = request.source_ref.or_else(|| {
            request
                .source_refs
                .as_ref()
                .and_then(|source_refs| source_refs.first())
                .map(|source_ref| source_ref.legacy_ref().to_owned())
        });

        Self {
            workspace_id: request.workspace_id,
            scope: request.scope,
            catalog_item_type: request.catalog_item_type,
            quick_summary: request.quick_summary,
            lifecycle_status: request.lifecycle_status,
            title: request.title,
            source_label: request.source_label,
            source_kind,
            source_ref,
            source_refs: request.source_refs.unwrap_or_default(),
            relations: request.relations,
            content: request.content,
            tags: request.tags,
            enabled: request.enabled,
            searchable: request.searchable,
            version_summary: request.version_summary,
            reviewed_at: request.reviewed_at,
            created_by_task_id: request.created_by_task_id,
            created_from_run_id: request.created_from_run_id,
        }
    }
}

impl From<UpdateKnowledgeDocumentRequest> for UpdateKnowledgeDocumentInput {
    fn from(request: UpdateKnowledgeDocumentRequest) -> Self {
        let source_kind = request.source_kind.or_else(|| {
            request
                .source_refs
                .as_ref()
                .and_then(|source_refs| source_refs.first())
                .map(|source_ref| source_ref.legacy_kind().to_owned())
        });
        let source_ref = request.source_ref.or_else(|| {
            request
                .source_refs
                .as_ref()
                .and_then(|source_refs| source_refs.first())
                .map(|source_ref| source_ref.legacy_ref().to_owned())
        });

        Self {
            workspace_id: request.workspace_id,
            knowledge_document_id: request.knowledge_document_id,
            scope: request.scope,
            catalog_item_type: request.catalog_item_type,
            quick_summary: request.quick_summary,
            lifecycle_status: request.lifecycle_status,
            title: request.title,
            source_label: request.source_label,
            source_kind,
            source_ref,
            source_refs: request.source_refs.unwrap_or_default(),
            relations: request.relations,
            content: request.content,
            tags: request.tags,
            enabled: request.enabled,
            searchable: request.searchable,
            version_summary: request.version_summary,
            reviewed_at: request.reviewed_at,
            created_by_task_id: request.created_by_task_id,
            created_from_run_id: request.created_from_run_id,
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

impl SearchKnowledgeDocumentsRequest {
    pub(crate) fn into_parts(
        self,
    ) -> (
        SearchKnowledgeDocumentsInput,
        SearchKnowledgeDocumentsFiltersInput,
    ) {
        (
            SearchKnowledgeDocumentsInput {
                workspace_id: self.workspace_id,
                query: self.query,
                limit: self.limit,
            },
            SearchKnowledgeDocumentsFiltersInput {
                scopes: self.scopes,
                catalog_item_types: self.catalog_item_types,
                lifecycle_statuses: self.lifecycle_statuses,
                tags: self.tags,
                source_kinds: self.source_kinds,
                updated_after: self.updated_after,
                updated_within_days: self.updated_within_days,
            },
        )
    }
}

impl From<KnowledgeDocumentSummary> for KnowledgeDocumentDto {
    fn from(summary: KnowledgeDocumentSummary) -> Self {
        Self {
            knowledge_document_id: summary.knowledge_document_id,
            workspace_id: summary.workspace_id,
            scope: summary.scope,
            catalog_item_type: summary.catalog_item_type,
            quick_summary: summary.quick_summary,
            lifecycle_status: summary.lifecycle_status,
            title: summary.title,
            source_label: summary.source_label,
            source_refs: summary.source_refs,
            relations: summary.relations,
            source_kind: summary.source_kind,
            source_ref: summary.source_ref,
            content: summary.content,
            tags: summary.tags,
            enabled: summary.enabled,
            searchable: summary.searchable,
            version: summary.version,
            version_summary: summary.version_summary,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
            reviewed_at: summary.reviewed_at,
            created_by_task_id: summary.created_by_task_id,
            created_from_run_id: summary.created_from_run_id,
        }
    }
}

impl From<KnowledgeDocumentSearchResultSummary> for KnowledgeDocumentSearchResultDto {
    fn from(summary: KnowledgeDocumentSearchResultSummary) -> Self {
        Self {
            knowledge_document_id: summary.knowledge_document_id,
            document_title: summary.document_title,
            scope: summary.scope,
            source_label: summary.source_label,
            tags: summary.tags,
            chunk_id: summary.chunk_id,
            chunk_index: summary.chunk_index,
            snippet: summary.snippet,
            score: summary.score,
        }
    }
}

fn default_true() -> bool {
    true
}
