use rusqlite::{params, OptionalExtension, Result};

use crate::mappers::workbench_event_row;
use crate::rows::WorkbenchEventRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn append_workbench_event(
        &self,
        id: &str,
        workspace_id: &str,
        kind: &str,
        summary: &str,
        payload: Option<&str>,
    ) -> Result<WorkbenchEventRow> {
        let created_at = now_timestamp();
        self.connection.execute(
            "INSERT INTO workbench_events (
                id, workspace_id, kind, summary, payload, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, workspace_id, kind, summary, payload, created_at],
        )?;

        self.get_workbench_event(id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_workbench_event(&self, id: &str) -> Result<Option<WorkbenchEventRow>> {
        self.connection
            .query_row(
                "SELECT id, workspace_id, kind, summary, payload, created_at
                 FROM workbench_events
                 WHERE id = ?1",
                params![id],
                workbench_event_row,
            )
            .optional()
    }

    pub fn list_workbench_events(&self, workspace_id: &str) -> Result<Vec<WorkbenchEventRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, workspace_id, kind, summary, payload, created_at
             FROM workbench_events
             WHERE workspace_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workspace_id], workbench_event_row)?;
        rows.collect()
    }

    pub fn list_recent_workspace_events(
        &self,
        workspace_id: &str,
        limit: usize,
    ) -> Result<Vec<WorkbenchEventRow>> {
        let limit = limit.min(i64::MAX as usize) as i64;
        let mut statement = self.connection.prepare(
            "SELECT
                id,
                workspace_id,
                kind,
                summary,
                payload,
                created_at
             FROM workbench_events
             WHERE workspace_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT ?2",
        )?;

        let rows = statement.query_map(params![workspace_id, limit], workbench_event_row)?;
        let mut events: Vec<_> = rows.collect::<Result<Vec<_>>>()?;
        events.reverse();
        Ok(events)
    }
}
