use hobit_app::{
    KnowledgeDraftReviewSummary, ListKnowledgeDraftReviewsInput, RecordKnowledgeDraftReviewInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct RecordKnowledgeDraftReviewRequest {
    pub workspace_id: String,
    pub draft_pack_id: String,
    #[serde(default)]
    pub source_fingerprint: Option<String>,
    #[serde(default)]
    pub source_queue_item_id: Option<String>,
    #[serde(default)]
    pub source_run_id: Option<String>,
    pub proposed_item_id: String,
    #[serde(default)]
    pub proposed_item_key: Option<String>,
    pub action: String,
    #[serde(default)]
    pub reviewed_at: Option<String>,
    #[serde(default)]
    pub accepted_knowledge_document_id: Option<String>,
    #[serde(default)]
    pub accepted_skill_id: Option<String>,
    #[serde(default)]
    pub rejection_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListKnowledgeDraftReviewsRequest {
    pub workspace_id: String,
    pub draft_pack_id: String,
    #[serde(default)]
    pub source_fingerprint: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct KnowledgeDraftReviewDto {
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

impl From<RecordKnowledgeDraftReviewRequest> for RecordKnowledgeDraftReviewInput {
    fn from(request: RecordKnowledgeDraftReviewRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            draft_pack_id: request.draft_pack_id,
            source_fingerprint: request.source_fingerprint,
            source_queue_item_id: request.source_queue_item_id,
            source_run_id: request.source_run_id,
            proposed_item_id: request.proposed_item_id,
            proposed_item_key: request.proposed_item_key,
            action: request.action,
            reviewed_at: request.reviewed_at,
            accepted_knowledge_document_id: request.accepted_knowledge_document_id,
            accepted_skill_id: request.accepted_skill_id,
            rejection_reason: request.rejection_reason,
        }
    }
}

impl From<ListKnowledgeDraftReviewsRequest> for ListKnowledgeDraftReviewsInput {
    fn from(request: ListKnowledgeDraftReviewsRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            draft_pack_id: request.draft_pack_id,
            source_fingerprint: request.source_fingerprint,
        }
    }
}

impl From<KnowledgeDraftReviewSummary> for KnowledgeDraftReviewDto {
    fn from(summary: KnowledgeDraftReviewSummary) -> Self {
        Self {
            review_id: summary.review_id,
            workspace_id: summary.workspace_id,
            draft_pack_id: summary.draft_pack_id,
            source_fingerprint: summary.source_fingerprint,
            source_queue_item_id: summary.source_queue_item_id,
            source_run_id: summary.source_run_id,
            proposed_item_id: summary.proposed_item_id,
            proposed_item_key: summary.proposed_item_key,
            action: summary.action,
            reviewed_at: summary.reviewed_at,
            accepted_knowledge_document_id: summary.accepted_knowledge_document_id,
            accepted_skill_id: summary.accepted_skill_id,
            rejection_reason: summary.rejection_reason,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
