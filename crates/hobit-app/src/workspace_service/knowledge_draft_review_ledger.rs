use hobit_storage_sqlite::NewKnowledgeDraftReviewRecord;

use crate::WorkspaceServiceError;

use super::{
    knowledge_draft_review_types::{
        KnowledgeDraftReviewSummary, ListKnowledgeDraftReviewsInput,
        RecordKnowledgeDraftReviewInput,
    },
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    WorkspaceService,
};

const ACTION_ACCEPTED: &str = "accepted";
const ACTION_EDITED_BEFORE_ACCEPT: &str = "edited_before_accept";
const ACTION_REJECTED: &str = "rejected";

impl WorkspaceService {
    pub fn record_knowledge_draft_review(
        &self,
        input: RecordKnowledgeDraftReviewInput,
    ) -> Result<KnowledgeDraftReviewSummary, WorkspaceServiceError> {
        let input = normalize_record_input(input)?;
        self.validate_knowledge_draft_review_record(&input)?;

        let review_id = placeholder_id("kdr_");
        let now = placeholder_timestamp();
        let reviewed_at = input.reviewed_at.as_deref().unwrap_or(&now);
        let row = self.store.with_immediate_transaction(|store| {
            let row =
                store.upsert_knowledge_draft_review_record(NewKnowledgeDraftReviewRecord {
                    review_id: &review_id,
                    workspace_id: &input.workspace_id,
                    draft_pack_id: &input.draft_pack_id,
                    source_fingerprint: &input.source_fingerprint,
                    source_queue_item_id: input.source_queue_item_id.as_deref(),
                    source_run_id: input.source_run_id.as_deref(),
                    proposed_item_id: &input.proposed_item_id,
                    proposed_item_key: &input.proposed_item_key,
                    action: &input.action,
                    reviewed_at: Some(reviewed_at),
                    accepted_knowledge_document_id: input.accepted_knowledge_document_id.as_deref(),
                    accepted_skill_id: input.accepted_skill_id.as_deref(),
                    rejection_reason: input.rejection_reason.as_deref(),
                    created_at: Some(&now),
                    updated_at: Some(&now),
                })?;
            store.touch_workspace(&input.workspace_id)?;
            Ok(row)
        })?;

        Ok(knowledge_draft_review_summary(row))
    }

    pub fn list_knowledge_draft_reviews(
        &self,
        input: ListKnowledgeDraftReviewsInput,
    ) -> Result<Vec<KnowledgeDraftReviewSummary>, WorkspaceServiceError> {
        let input = normalize_list_input(input)?;
        if self.store.get_workspace(&input.workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {}",
                input.workspace_id
            )));
        }

        Ok(self
            .store
            .list_knowledge_draft_review_records_for_pack(
                &input.workspace_id,
                &input.draft_pack_id,
                Some(&input.source_fingerprint),
            )?
            .into_iter()
            .map(knowledge_draft_review_summary)
            .collect())
    }

    fn validate_knowledge_draft_review_record(
        &self,
        input: &NormalizedRecordKnowledgeDraftReviewInput,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(&input.workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {}",
                input.workspace_id
            )));
        }

        if input.action == ACTION_REJECTED {
            if input.accepted_knowledge_document_id.is_some() || input.accepted_skill_id.is_some() {
                return Err(WorkspaceServiceError::InvalidInput(
                    "rejected draft review records must not link accepted Knowledge or Skill ids"
                        .to_owned(),
                ));
            }
            return Ok(());
        }

        match (
            input.accepted_knowledge_document_id.as_deref(),
            input.accepted_skill_id.as_deref(),
        ) {
            (Some(knowledge_document_id), None) => {
                let document = self
                    .store
                    .get_knowledge_document(&input.workspace_id, knowledge_document_id)?;
                if document.is_none() {
                    return Err(WorkspaceServiceError::InvalidInput(format!(
                        "accepted Knowledge Document not found for workspace: {knowledge_document_id}"
                    )));
                }
            }
            (None, Some(skill_id)) => {
                let skill = self.store.get_skill(&input.workspace_id, skill_id)?;
                if skill.is_none() {
                    return Err(WorkspaceServiceError::InvalidInput(format!(
                        "accepted Skill not found for workspace: {skill_id}"
                    )));
                }
            }
            (None, None) => {
                return Err(WorkspaceServiceError::InvalidInput(
                    "accepted draft review records must link the created Knowledge Document or Skill id"
                        .to_owned(),
                ));
            }
            (Some(_), Some(_)) => {
                return Err(WorkspaceServiceError::InvalidInput(
                    "draft review records must not link both Knowledge Document and Skill ids"
                        .to_owned(),
                ));
            }
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedRecordKnowledgeDraftReviewInput {
    workspace_id: String,
    draft_pack_id: String,
    source_fingerprint: String,
    source_queue_item_id: Option<String>,
    source_run_id: Option<String>,
    proposed_item_id: String,
    proposed_item_key: String,
    action: String,
    reviewed_at: Option<String>,
    accepted_knowledge_document_id: Option<String>,
    accepted_skill_id: Option<String>,
    rejection_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedListKnowledgeDraftReviewsInput {
    workspace_id: String,
    draft_pack_id: String,
    source_fingerprint: String,
}

fn normalize_record_input(
    input: RecordKnowledgeDraftReviewInput,
) -> Result<NormalizedRecordKnowledgeDraftReviewInput, WorkspaceServiceError> {
    let draft_pack_id = required_owned(input.draft_pack_id, "draft pack id")?;
    let proposed_item_id = required_owned(input.proposed_item_id, "proposed item id")?;
    let source_fingerprint =
        normalize_optional_line(input.source_fingerprint).unwrap_or_else(|| draft_pack_id.clone());
    let proposed_item_key = normalize_optional_line(input.proposed_item_key)
        .unwrap_or_else(|| proposed_item_id.clone());
    let action = normalize_action(input.action)?;

    Ok(NormalizedRecordKnowledgeDraftReviewInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        draft_pack_id,
        source_fingerprint,
        source_queue_item_id: normalize_optional_line(input.source_queue_item_id),
        source_run_id: normalize_optional_line(input.source_run_id),
        proposed_item_id,
        proposed_item_key,
        action,
        reviewed_at: normalize_optional_line(input.reviewed_at),
        accepted_knowledge_document_id: normalize_optional_line(
            input.accepted_knowledge_document_id,
        ),
        accepted_skill_id: normalize_optional_line(input.accepted_skill_id),
        rejection_reason: normalize_optional_line(input.rejection_reason),
    })
}

fn normalize_list_input(
    input: ListKnowledgeDraftReviewsInput,
) -> Result<NormalizedListKnowledgeDraftReviewsInput, WorkspaceServiceError> {
    let draft_pack_id = required_owned(input.draft_pack_id, "draft pack id")?;
    Ok(NormalizedListKnowledgeDraftReviewsInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        source_fingerprint: normalize_optional_line(input.source_fingerprint)
            .unwrap_or_else(|| draft_pack_id.clone()),
        draft_pack_id,
    })
}

fn normalize_action(action: String) -> Result<String, WorkspaceServiceError> {
    let action = required_owned(action, "draft review action")?;
    match action.as_str() {
        ACTION_ACCEPTED | ACTION_EDITED_BEFORE_ACCEPT | ACTION_REJECTED => Ok(action),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported draft review action: {action}"
        ))),
    }
}

fn normalize_optional_line(value: Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn knowledge_draft_review_summary(
    row: hobit_storage_sqlite::KnowledgeDraftReviewRecordRow,
) -> KnowledgeDraftReviewSummary {
    KnowledgeDraftReviewSummary {
        review_id: row.review_id,
        workspace_id: row.workspace_id,
        draft_pack_id: row.draft_pack_id,
        source_fingerprint: row.source_fingerprint,
        source_queue_item_id: row.source_queue_item_id,
        source_run_id: row.source_run_id,
        proposed_item_id: row.proposed_item_id,
        proposed_item_key: row.proposed_item_key,
        action: row.action,
        reviewed_at: row.reviewed_at,
        accepted_knowledge_document_id: row.accepted_knowledge_document_id,
        accepted_skill_id: row.accepted_skill_id,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}
