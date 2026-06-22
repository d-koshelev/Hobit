use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{AgentQueueReviewMessageAckUpdate, NewAgentQueueReviewMessage};
use crate::mappers::agent_queue_review_message_row;
use crate::rows::AgentQueueReviewMessageRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_review_message(
        &self,
        input: NewAgentQueueReviewMessage<'_>,
    ) -> Result<AgentQueueReviewMessageRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_review_messages (
                message_id, workspace_id, queue_task_id, run_id, run_link_id, actor_id,
                message_body, status, created_at, acked_at, ack_actor_id, metadata_json, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                input.message_id,
                input.workspace_id,
                input.queue_task_id,
                input.run_id,
                input.run_link_id,
                input.actor_id,
                input.message_body,
                input.status,
                created_at,
                input.acked_at,
                input.ack_actor_id,
                input.metadata_json,
                updated_at,
            ],
        )?;

        self.get_agent_queue_review_message(
            input.workspace_id,
            input.queue_task_id,
            input.message_id,
        )?
        .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_review_message(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
        message_id: &str,
    ) -> Result<Option<AgentQueueReviewMessageRow>> {
        self.connection
            .query_row(
                "SELECT
                    message_id, workspace_id, queue_task_id, run_id, run_link_id, actor_id,
                    message_body, status, created_at, acked_at, ack_actor_id, metadata_json, updated_at
                 FROM agent_queue_review_messages
                 WHERE workspace_id = ?1 AND queue_task_id = ?2 AND message_id = ?3",
                params![workspace_id, queue_task_id, message_id],
                agent_queue_review_message_row,
            )
            .optional()
    }

    pub fn get_agent_queue_review_message_by_id(
        &self,
        workspace_id: &str,
        message_id: &str,
    ) -> Result<Option<AgentQueueReviewMessageRow>> {
        self.connection
            .query_row(
                "SELECT
                    message_id, workspace_id, queue_task_id, run_id, run_link_id, actor_id,
                    message_body, status, created_at, acked_at, ack_actor_id, metadata_json, updated_at
                 FROM agent_queue_review_messages
                 WHERE workspace_id = ?1 AND message_id = ?2",
                params![workspace_id, message_id],
                agent_queue_review_message_row,
            )
            .optional()
    }

    pub fn get_latest_agent_queue_review_message(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Option<AgentQueueReviewMessageRow>> {
        self.connection
            .query_row(
                "SELECT
                    message_id, workspace_id, queue_task_id, run_id, run_link_id, actor_id,
                    message_body, status, created_at, acked_at, ack_actor_id, metadata_json, updated_at
                 FROM agent_queue_review_messages
                 WHERE workspace_id = ?1 AND queue_task_id = ?2
                 ORDER BY created_at DESC, message_id DESC
                 LIMIT 1",
                params![workspace_id, queue_task_id],
                agent_queue_review_message_row,
            )
            .optional()
    }

    pub fn list_agent_queue_review_messages(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Vec<AgentQueueReviewMessageRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                message_id, workspace_id, queue_task_id, run_id, run_link_id, actor_id,
                message_body, status, created_at, acked_at, ack_actor_id, metadata_json, updated_at
             FROM agent_queue_review_messages
             WHERE workspace_id = ?1 AND queue_task_id = ?2
             ORDER BY created_at DESC, message_id DESC",
        )?;

        let rows = statement.query_map(
            params![workspace_id, queue_task_id],
            agent_queue_review_message_row,
        )?;
        rows.collect()
    }

    pub fn ack_agent_queue_review_message(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
        message_id: &str,
        update: AgentQueueReviewMessageAckUpdate<'_>,
    ) -> Result<Option<AgentQueueReviewMessageRow>> {
        let acked_at = update
            .acked_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| acked_at.clone());
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_review_messages
             SET status = ?1,
                 acked_at = ?2,
                 ack_actor_id = ?3,
                 updated_at = ?4
             WHERE workspace_id = ?5 AND queue_task_id = ?6 AND message_id = ?7",
            params![
                update.status,
                acked_at,
                update.actor_id,
                updated_at,
                workspace_id,
                queue_task_id,
                message_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_review_message(workspace_id, queue_task_id, message_id)
    }
}
