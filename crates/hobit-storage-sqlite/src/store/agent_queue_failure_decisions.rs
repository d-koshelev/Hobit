use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewAgentQueueFailureDecision;
use crate::mappers::agent_queue_failure_decision_row;
use crate::rows::AgentQueueFailureDecisionRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_failure_decision(
        &self,
        input: NewAgentQueueFailureDecision<'_>,
    ) -> Result<AgentQueueFailureDecisionRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);

        self.connection.execute(
            "INSERT INTO agent_queue_failure_decisions (
                decision_id, workspace_id, queue_task_id, run_id, run_link_id,
                evidence_bundle_id, review_message_id, actor_id, decision, reason,
                metadata_json, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                input.decision_id,
                input.workspace_id,
                input.queue_task_id,
                input.run_id,
                input.run_link_id,
                input.evidence_bundle_id,
                input.review_message_id,
                input.actor_id,
                input.decision,
                input.reason,
                input.metadata_json,
                created_at,
            ],
        )?;

        self.get_agent_queue_failure_decision(
            input.workspace_id,
            input.queue_task_id,
            input.decision_id,
        )?
        .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_failure_decision(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
        decision_id: &str,
    ) -> Result<Option<AgentQueueFailureDecisionRow>> {
        self.connection
            .query_row(
                "SELECT
                    decision_id, workspace_id, queue_task_id, run_id, run_link_id,
                    evidence_bundle_id, review_message_id, actor_id, decision, reason,
                    metadata_json, created_at
                 FROM agent_queue_failure_decisions
                 WHERE workspace_id = ?1 AND queue_task_id = ?2 AND decision_id = ?3",
                params![workspace_id, queue_task_id, decision_id],
                agent_queue_failure_decision_row,
            )
            .optional()
    }

    pub fn get_agent_queue_failure_decision_by_id(
        &self,
        workspace_id: &str,
        decision_id: &str,
    ) -> Result<Option<AgentQueueFailureDecisionRow>> {
        self.connection
            .query_row(
                "SELECT
                    decision_id, workspace_id, queue_task_id, run_id, run_link_id,
                    evidence_bundle_id, review_message_id, actor_id, decision, reason,
                    metadata_json, created_at
                 FROM agent_queue_failure_decisions
                 WHERE workspace_id = ?1 AND decision_id = ?2",
                params![workspace_id, decision_id],
                agent_queue_failure_decision_row,
            )
            .optional()
    }

    pub fn get_latest_agent_queue_failure_decision(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Option<AgentQueueFailureDecisionRow>> {
        self.connection
            .query_row(
                "SELECT
                    decision_id, workspace_id, queue_task_id, run_id, run_link_id,
                    evidence_bundle_id, review_message_id, actor_id, decision, reason,
                    metadata_json, created_at
                 FROM agent_queue_failure_decisions
                 WHERE workspace_id = ?1 AND queue_task_id = ?2
                 ORDER BY created_at DESC, decision_id DESC
                 LIMIT 1",
                params![workspace_id, queue_task_id],
                agent_queue_failure_decision_row,
            )
            .optional()
    }
}
