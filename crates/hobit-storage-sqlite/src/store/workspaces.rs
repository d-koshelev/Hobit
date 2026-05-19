use rusqlite::{params, OptionalExtension, Result};

use crate::mappers::{workspace_row, workspace_summary_row};
use crate::rows::{WorkspaceRow, WorkspaceSummaryRow};
use crate::time::{now_precise_timestamp, now_timestamp};

use super::SqliteStore;

impl SqliteStore {
    pub fn create_workspace(
        &self,
        id: &str,
        title: &str,
        description: Option<&str>,
        status: &str,
    ) -> Result<WorkspaceRow> {
        let now = now_timestamp();
        self.connection.execute(
            "INSERT INTO workspaces (
                id, title, description, status, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, title, description, status, now, now],
        )?;

        self.get_workspace(id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_workspace(&self, id: &str) -> Result<Option<WorkspaceRow>> {
        self.connection
            .query_row(
                "SELECT id, title, description, status, created_at, updated_at
                 FROM workspaces
                 WHERE id = ?1",
                params![id],
                workspace_row,
            )
            .optional()
    }

    pub fn list_workspaces(&self) -> Result<Vec<WorkspaceRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, title, description, status, created_at, updated_at
             FROM workspaces
             ORDER BY updated_at DESC, id",
        )?;

        let rows = statement.query_map([], workspace_row)?;
        rows.collect()
    }

    pub fn list_workspace_summaries_with_workbench(&self) -> Result<Vec<WorkspaceSummaryRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                workspaces.id,
                workspaces.title,
                workspaces.description,
                workspaces.status,
                workspaces.created_at,
                workspaces.updated_at,
                (
                    SELECT workspace_workbenches.id
                    FROM workspace_workbenches
                    WHERE workspace_workbenches.workspace_id = workspaces.id
                    ORDER BY workspace_workbenches.created_at, workspace_workbenches.id
                    LIMIT 1
                ) AS workbench_id
             FROM workspaces
             ORDER BY workspaces.updated_at DESC, workspaces.id",
        )?;

        let rows = statement.query_map([], workspace_summary_row)?;
        rows.collect()
    }

    pub fn touch_workspace(&self, workspace_id: &str) -> Result<()> {
        let updated_at = now_precise_timestamp();
        self.connection.execute(
            "UPDATE workspaces
             SET updated_at = ?1
             WHERE id = ?2",
            params![updated_at, workspace_id],
        )?;
        Ok(())
    }

    pub fn delete_workspace_and_local_data(&self, workspace_id: &str) -> Result<()> {
        self.connection.execute(
            "DELETE FROM jdbc_connectors
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM agent_queue_tasks
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM agent_queue_items
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM notes
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM widget_results
             WHERE run_id IN (
                SELECT widget_runs.id
                FROM widget_runs
                INNER JOIN widget_instances
                    ON widget_instances.id = widget_runs.widget_instance_id
                WHERE widget_instances.workspace_id = ?1
             )",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM widget_logs
             WHERE widget_instance_id IN (
                SELECT id
                FROM widget_instances
                WHERE workspace_id = ?1
             )",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM widget_runs
             WHERE widget_instance_id IN (
                SELECT id
                FROM widget_instances
                WHERE workspace_id = ?1
             )",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM widget_instances
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM shared_state_objects
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM workbench_events
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM workspace_sessions
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        self.connection.execute(
            "DELETE FROM workspace_workbenches
             WHERE workspace_id = ?1",
            params![workspace_id],
        )?;
        let affected_rows = self.connection.execute(
            "DELETE FROM workspaces
             WHERE id = ?1",
            params![workspace_id],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok(())
    }
}
