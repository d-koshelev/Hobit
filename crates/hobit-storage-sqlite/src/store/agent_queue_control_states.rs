use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{AgentQueueControlStateUpdate, NewAgentQueueControlState};
use crate::mappers::agent_queue_control_state_row;
use crate::rows::AgentQueueControlStateRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_control_state(
        &self,
        input: NewAgentQueueControlState<'_>,
    ) -> Result<AgentQueueControlStateRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_control_states (
                workspace_id, status, version, updated_by_actor_id, reason, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.workspace_id,
                input.status,
                input.version,
                input.updated_by_actor_id,
                input.reason,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_control_state(input.workspace_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_control_state(
        &self,
        workspace_id: &str,
    ) -> Result<Option<AgentQueueControlStateRow>> {
        self.connection
            .query_row(
                "SELECT workspace_id, status, version, updated_by_actor_id, reason, created_at, updated_at
                 FROM agent_queue_control_states
                 WHERE workspace_id = ?1",
                params![workspace_id],
                agent_queue_control_state_row,
            )
            .optional()
    }

    pub fn ensure_agent_queue_control_state(
        &self,
        input: NewAgentQueueControlState<'_>,
    ) -> Result<AgentQueueControlStateRow> {
        if let Some(existing) = self.get_agent_queue_control_state(input.workspace_id)? {
            return Ok(existing);
        }

        self.insert_agent_queue_control_state(input)
    }

    pub fn update_agent_queue_control_state(
        &self,
        workspace_id: &str,
        update: AgentQueueControlStateUpdate<'_>,
    ) -> Result<Option<AgentQueueControlStateRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);

        let updated = self.connection.execute(
            "UPDATE agent_queue_control_states
             SET status = ?2,
                 version = version + 1,
                 updated_by_actor_id = ?3,
                 reason = ?4,
                 updated_at = ?5
             WHERE workspace_id = ?1",
            params![
                workspace_id,
                update.status,
                update.updated_by_actor_id,
                update.reason,
                updated_at,
            ],
        )?;

        if updated == 0 {
            return Ok(None);
        }

        self.get_agent_queue_control_state(workspace_id)
    }
}
