use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewAgentQueueItem;
use crate::mappers::agent_queue_item_row;
use crate::rows::AgentQueueItemRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_item(
        &self,
        input: NewAgentQueueItem<'_>,
    ) -> Result<AgentQueueItemRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_items (
                id, workspace_id, workbench_id, source_run_id, source_result_id,
                source_widget_instance_id, title, status, payload_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                input.id,
                input.workspace_id,
                input.workbench_id,
                input.source_run_id,
                input.source_result_id,
                input.source_widget_instance_id,
                input.title,
                input.status,
                input.payload_json,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_item(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_item(&self, id: &str) -> Result<Option<AgentQueueItemRow>> {
        self.connection
            .query_row(
                "SELECT
                    id, workspace_id, workbench_id, source_run_id, source_result_id,
                    source_widget_instance_id, title, status, payload_json, created_at, updated_at
                 FROM agent_queue_items
                 WHERE id = ?1",
                params![id],
                agent_queue_item_row,
            )
            .optional()
    }

    pub fn list_agent_queue_items(
        &self,
        workspace_id: &str,
        workbench_id: &str,
    ) -> Result<Vec<AgentQueueItemRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                id, workspace_id, workbench_id, source_run_id, source_result_id,
                source_widget_instance_id, title, status, payload_json, created_at, updated_at
             FROM agent_queue_items
             WHERE workspace_id = ?1 AND workbench_id = ?2
             ORDER BY created_at DESC, id DESC",
        )?;

        let rows =
            statement.query_map(params![workspace_id, workbench_id], agent_queue_item_row)?;
        rows.collect()
    }
}
