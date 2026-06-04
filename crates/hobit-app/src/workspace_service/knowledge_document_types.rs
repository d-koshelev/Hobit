#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateKnowledgeDocumentInput {
    pub workspace_id: String,
    pub scope: Option<String>,
    pub catalog_item_type: Option<String>,
    pub quick_summary: Option<String>,
    pub lifecycle_status: Option<String>,
    pub title: String,
    pub source_label: String,
    pub source_kind: Option<String>,
    pub source_ref: Option<String>,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateKnowledgeDocumentInput {
    pub workspace_id: String,
    pub knowledge_document_id: String,
    pub scope: Option<String>,
    pub catalog_item_type: Option<String>,
    pub quick_summary: Option<String>,
    pub lifecycle_status: Option<String>,
    pub title: String,
    pub source_label: String,
    pub source_kind: Option<String>,
    pub source_ref: Option<String>,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeleteKnowledgeDocumentInput {
    pub workspace_id: String,
    pub knowledge_document_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchKnowledgeDocumentsInput {
    pub workspace_id: String,
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDocumentSummary {
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
    pub content: String,
    pub tags: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDocumentSearchResultSummary {
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
