use rusqlite::{params, OptionalExtension, Result};

use crate::mappers::workspace_workbench_row;
use crate::rows::WorkspaceWorkbenchRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn create_workspace_workbench(
        &self,
        id: &str,
        workspace_id: &str,
        preset_origin_id: Option<&str>,
    ) -> Result<WorkspaceWorkbenchRow> {
        let now = now_timestamp();
        self.connection.execute(
            "INSERT INTO workspace_workbenches (
                id, workspace_id, preset_origin_id, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, workspace_id, preset_origin_id, now, now],
        )?;

        self.get_workspace_workbench(id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_workspace_workbench(&self, id: &str) -> Result<Option<WorkspaceWorkbenchRow>> {
        self.connection
            .query_row(
                "SELECT id, workspace_id, preset_origin_id, created_at, updated_at
                 FROM workspace_workbenches
                 WHERE id = ?1",
                params![id],
                workspace_workbench_row,
            )
            .optional()
    }

    pub fn list_workspace_workbenches(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<WorkspaceWorkbenchRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, workspace_id, preset_origin_id, created_at, updated_at
             FROM workspace_workbenches
             WHERE workspace_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workspace_id], workspace_workbench_row)?;
        rows.collect()
    }
}
