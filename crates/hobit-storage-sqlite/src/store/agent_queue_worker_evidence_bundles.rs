use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewAgentQueueWorkerEvidenceBundle;
use crate::mappers::agent_queue_worker_evidence_bundle_row;
use crate::rows::AgentQueueWorkerEvidenceBundleRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn upsert_agent_queue_worker_evidence_bundle(
        &self,
        input: NewAgentQueueWorkerEvidenceBundle<'_>,
    ) -> Result<AgentQueueWorkerEvidenceBundleRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_worker_evidence_bundles (
                bundle_id, workspace_id, queue_task_id, run_id, run_link_id, executor_widget_id,
                worker_id, source, outcome, summary, changed_files_json, changed_files_count,
                changed_files_summary, validation_summary, error_summary, metadata_json,
                created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
            )
            ON CONFLICT(workspace_id, queue_task_id, run_id) DO UPDATE SET
                run_link_id = excluded.run_link_id,
                executor_widget_id = excluded.executor_widget_id,
                worker_id = excluded.worker_id,
                source = excluded.source,
                outcome = excluded.outcome,
                summary = excluded.summary,
                changed_files_json = excluded.changed_files_json,
                changed_files_count = excluded.changed_files_count,
                changed_files_summary = excluded.changed_files_summary,
                validation_summary = excluded.validation_summary,
                error_summary = excluded.error_summary,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at",
            params![
                input.bundle_id,
                input.workspace_id,
                input.queue_task_id,
                input.run_id,
                input.run_link_id,
                input.executor_widget_id,
                input.worker_id,
                input.source,
                input.outcome,
                input.summary,
                input.changed_files_json,
                input.changed_files_count,
                input.changed_files_summary,
                input.validation_summary,
                input.error_summary,
                input.metadata_json,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_worker_evidence_bundle(
            input.workspace_id,
            input.queue_task_id,
            input.run_id,
        )?
        .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_worker_evidence_bundle(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
        run_id: &str,
    ) -> Result<Option<AgentQueueWorkerEvidenceBundleRow>> {
        self.connection
            .query_row(
                "SELECT
                    bundle_id, workspace_id, queue_task_id, run_id, run_link_id, executor_widget_id,
                    worker_id, source, outcome, summary, changed_files_json, changed_files_count,
                    changed_files_summary, validation_summary, error_summary, metadata_json,
                    created_at, updated_at
                 FROM agent_queue_worker_evidence_bundles
                 WHERE workspace_id = ?1 AND queue_task_id = ?2 AND run_id = ?3",
                params![workspace_id, queue_task_id, run_id],
                agent_queue_worker_evidence_bundle_row,
            )
            .optional()
    }

    pub fn get_agent_queue_worker_evidence_bundle_by_id(
        &self,
        workspace_id: &str,
        bundle_id: &str,
    ) -> Result<Option<AgentQueueWorkerEvidenceBundleRow>> {
        self.connection
            .query_row(
                "SELECT
                    bundle_id, workspace_id, queue_task_id, run_id, run_link_id, executor_widget_id,
                    worker_id, source, outcome, summary, changed_files_json, changed_files_count,
                    changed_files_summary, validation_summary, error_summary, metadata_json,
                    created_at, updated_at
                 FROM agent_queue_worker_evidence_bundles
                 WHERE workspace_id = ?1 AND bundle_id = ?2",
                params![workspace_id, bundle_id],
                agent_queue_worker_evidence_bundle_row,
            )
            .optional()
    }

    pub fn get_latest_agent_queue_worker_evidence_bundle(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Option<AgentQueueWorkerEvidenceBundleRow>> {
        self.connection
            .query_row(
                "SELECT
                    bundle_id, workspace_id, queue_task_id, run_id, run_link_id, executor_widget_id,
                    worker_id, source, outcome, summary, changed_files_json, changed_files_count,
                    changed_files_summary, validation_summary, error_summary, metadata_json,
                    created_at, updated_at
                 FROM agent_queue_worker_evidence_bundles
                 WHERE workspace_id = ?1 AND queue_task_id = ?2
                 ORDER BY updated_at DESC, created_at DESC, bundle_id DESC
                 LIMIT 1",
                params![workspace_id, queue_task_id],
                agent_queue_worker_evidence_bundle_row,
            )
            .optional()
    }
}
