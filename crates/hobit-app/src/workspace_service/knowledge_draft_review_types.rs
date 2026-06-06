#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecordKnowledgeDraftReviewInput {
    pub workspace_id: String,
    pub draft_pack_id: String,
    pub source_fingerprint: Option<String>,
    pub source_queue_item_id: Option<String>,
    pub source_run_id: Option<String>,
    pub proposed_item_id: String,
    pub proposed_item_key: Option<String>,
    pub action: String,
    pub reviewed_at: Option<String>,
    pub accepted_knowledge_document_id: Option<String>,
    pub accepted_skill_id: Option<String>,
    pub rejection_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListKnowledgeDraftReviewsInput {
    pub workspace_id: String,
    pub draft_pack_id: String,
    pub source_fingerprint: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDraftReviewSummary {
    pub review_id: String,
    pub workspace_id: String,
    pub draft_pack_id: String,
    pub source_fingerprint: String,
    pub source_queue_item_id: Option<String>,
    pub source_run_id: Option<String>,
    pub proposed_item_id: String,
    pub proposed_item_key: String,
    pub action: String,
    pub reviewed_at: String,
    pub accepted_knowledge_document_id: Option<String>,
    pub accepted_skill_id: Option<String>,
    pub rejection_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
