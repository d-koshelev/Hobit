use rusqlite::{params, Result};

use crate::inputs::NewKnowledgeDraftReviewRecord;
use crate::mappers::knowledge_draft_review_record_row;
use crate::rows::KnowledgeDraftReviewRecordRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn upsert_knowledge_draft_review_record(
        &self,
        input: NewKnowledgeDraftReviewRecord<'_>,
    ) -> Result<KnowledgeDraftReviewRecordRow> {
        let reviewed_at = input
            .reviewed_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(|| reviewed_at.clone());
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| reviewed_at.clone());

        self.connection.execute(
            "INSERT INTO knowledge_draft_review_ledger (
                review_id, workspace_id, draft_pack_id, source_fingerprint,
                source_queue_item_id, source_run_id, proposed_item_id,
                proposed_item_key, action, reviewed_at,
                accepted_knowledge_document_id, accepted_skill_id,
                rejection_reason, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15
            )
            ON CONFLICT(workspace_id, draft_pack_id, proposed_item_id) DO UPDATE SET
                review_id = excluded.review_id,
                source_fingerprint = excluded.source_fingerprint,
                source_queue_item_id = excluded.source_queue_item_id,
                source_run_id = excluded.source_run_id,
                proposed_item_key = excluded.proposed_item_key,
                action = excluded.action,
                reviewed_at = excluded.reviewed_at,
                accepted_knowledge_document_id = excluded.accepted_knowledge_document_id,
                accepted_skill_id = excluded.accepted_skill_id,
                rejection_reason = excluded.rejection_reason,
                updated_at = excluded.updated_at",
            params![
                input.review_id,
                input.workspace_id,
                input.draft_pack_id,
                input.source_fingerprint,
                input.source_queue_item_id,
                input.source_run_id,
                input.proposed_item_id,
                input.proposed_item_key,
                input.action,
                reviewed_at,
                input.accepted_knowledge_document_id,
                input.accepted_skill_id,
                input.rejection_reason,
                created_at,
                updated_at,
            ],
        )?;

        self.get_knowledge_draft_review_record(
            input.workspace_id,
            input.draft_pack_id,
            input.proposed_item_id,
        )?
        .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_knowledge_draft_review_record(
        &self,
        workspace_id: &str,
        draft_pack_id: &str,
        proposed_item_id: &str,
    ) -> Result<Option<KnowledgeDraftReviewRecordRow>> {
        self.connection
            .query_row(
                "SELECT review_id, workspace_id, draft_pack_id, source_fingerprint,
                    source_queue_item_id, source_run_id, proposed_item_id,
                    proposed_item_key, action, reviewed_at,
                    accepted_knowledge_document_id, accepted_skill_id,
                    rejection_reason, created_at, updated_at
             FROM knowledge_draft_review_ledger
             WHERE workspace_id = ?1
                AND draft_pack_id = ?2
                AND proposed_item_id = ?3",
                params![workspace_id, draft_pack_id, proposed_item_id],
                knowledge_draft_review_record_row,
            )
            .optional()
    }

    pub fn list_knowledge_draft_review_records_for_pack(
        &self,
        workspace_id: &str,
        draft_pack_id: &str,
        source_fingerprint: Option<&str>,
    ) -> Result<Vec<KnowledgeDraftReviewRecordRow>> {
        if let Some(source_fingerprint) = source_fingerprint.filter(|value| !value.is_empty()) {
            let mut statement = self.connection.prepare(
                "SELECT review_id, workspace_id, draft_pack_id, source_fingerprint,
                        source_queue_item_id, source_run_id, proposed_item_id,
                        proposed_item_key, action, reviewed_at,
                        accepted_knowledge_document_id, accepted_skill_id,
                        rejection_reason, created_at, updated_at
                 FROM knowledge_draft_review_ledger
                 WHERE workspace_id = ?1
                    AND (draft_pack_id = ?2 OR source_fingerprint = ?3)
                 ORDER BY reviewed_at DESC, updated_at DESC",
            )?;

            let rows = statement.query_map(
                params![workspace_id, draft_pack_id, source_fingerprint],
                knowledge_draft_review_record_row,
            )?;
            rows.collect()
        } else {
            let mut statement = self.connection.prepare(
                "SELECT review_id, workspace_id, draft_pack_id, source_fingerprint,
                        source_queue_item_id, source_run_id, proposed_item_id,
                        proposed_item_key, action, reviewed_at,
                        accepted_knowledge_document_id, accepted_skill_id,
                        rejection_reason, created_at, updated_at
                 FROM knowledge_draft_review_ledger
                 WHERE workspace_id = ?1
                    AND draft_pack_id = ?2
                 ORDER BY reviewed_at DESC, updated_at DESC",
            )?;

            let rows = statement.query_map(
                params![workspace_id, draft_pack_id],
                knowledge_draft_review_record_row,
            )?;
            rows.collect()
        }
    }
}

trait OptionalRow<T> {
    fn optional(self) -> Result<Option<T>>;
}

impl<T> OptionalRow<T> for Result<T> {
    fn optional(self) -> Result<Option<T>> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}
