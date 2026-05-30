use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{AgentQueueWorkerUpdate, NewAgentQueueWorker};
use crate::mappers::agent_queue_worker_row;
use crate::rows::AgentQueueWorkerRow;
use crate::store::SqliteStore;
use crate::time::now_timestamp;

impl SqliteStore {
    pub fn create_agent_queue_worker(
        &self,
        input: NewAgentQueueWorker<'_>,
    ) -> Result<AgentQueueWorkerRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_workers (
                worker_id, workspace_id, name, enabled, scope_kind,
                queue_tag_id, queue_tag_name, display_order, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                input.worker_id,
                input.workspace_id,
                input.name,
                bool_to_i64(input.enabled),
                input.scope_kind,
                input.queue_tag_id,
                input.queue_tag_name,
                input.display_order,
                created_at,
                updated_at
            ],
        )?;

        self.get_agent_queue_worker(input.workspace_id, input.worker_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_agent_queue_workers(&self, workspace_id: &str) -> Result<Vec<AgentQueueWorkerRow>> {
        let mut statement = self.connection.prepare(
            "SELECT worker_id, workspace_id, name, enabled, scope_kind,
                    queue_tag_id, queue_tag_name, display_order, created_at, updated_at
             FROM agent_queue_workers
             WHERE workspace_id = ?1
             ORDER BY display_order ASC, created_at ASC, worker_id ASC",
        )?;

        let rows = statement.query_map(params![workspace_id], agent_queue_worker_row)?;
        rows.collect()
    }

    pub fn get_agent_queue_worker(
        &self,
        workspace_id: &str,
        worker_id: &str,
    ) -> Result<Option<AgentQueueWorkerRow>> {
        self.connection
            .query_row(
                "SELECT worker_id, workspace_id, name, enabled, scope_kind,
                        queue_tag_id, queue_tag_name, display_order, created_at, updated_at
                 FROM agent_queue_workers
                 WHERE workspace_id = ?1 AND worker_id = ?2",
                params![workspace_id, worker_id],
                agent_queue_worker_row,
            )
            .optional()
    }

    pub fn update_agent_queue_worker(
        &self,
        workspace_id: &str,
        worker_id: &str,
        update: AgentQueueWorkerUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkerRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        let updated = self.connection.execute(
            "UPDATE agent_queue_workers
             SET name = ?3,
                 enabled = ?4,
                 scope_kind = ?5,
                 queue_tag_id = ?6,
                 queue_tag_name = ?7,
                 display_order = ?8,
                 updated_at = ?9
             WHERE workspace_id = ?1 AND worker_id = ?2",
            params![
                workspace_id,
                worker_id,
                update.name,
                bool_to_i64(update.enabled),
                update.scope_kind,
                update.queue_tag_id,
                update.queue_tag_name,
                update.display_order,
                updated_at
            ],
        )?;

        if updated == 0 {
            return Ok(None);
        }

        self.get_agent_queue_worker(workspace_id, worker_id)
    }

    pub fn delete_agent_queue_worker(&self, workspace_id: &str, worker_id: &str) -> Result<bool> {
        let deleted = self.connection.execute(
            "DELETE FROM agent_queue_workers
             WHERE workspace_id = ?1 AND worker_id = ?2",
            params![workspace_id, worker_id],
        )?;

        Ok(deleted > 0)
    }
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}
