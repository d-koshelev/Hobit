use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewWorkspaceSession;
use crate::mappers::workspace_session_row;
use crate::rows::WorkspaceSessionRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn create_workspace_session(
        &self,
        input: NewWorkspaceSession<'_>,
    ) -> Result<WorkspaceSessionRow> {
        let opened_at = input
            .opened_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO workspace_sessions (
                id, workspace_id, status, opened_at, closed_at, active_widget_id,
                current_focus_kind, current_focus_ref
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.id,
                input.workspace_id,
                input.status,
                opened_at,
                input.closed_at,
                input.active_widget_id,
                input.current_focus_kind,
                input.current_focus_ref,
            ],
        )?;

        self.get_workspace_session(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_workspace_session(&self, id: &str) -> Result<Option<WorkspaceSessionRow>> {
        self.connection
            .query_row(
                "SELECT
                    id, workspace_id, status, opened_at, closed_at, active_widget_id,
                    current_focus_kind, current_focus_ref
                 FROM workspace_sessions
                 WHERE id = ?1",
                params![id],
                workspace_session_row,
            )
            .optional()
    }
}
