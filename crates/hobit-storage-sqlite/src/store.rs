//! Small row-level SQLite storage primitives.
//!
//! This module intentionally stores simple rows and text payloads. It does not
//! provide a repository abstraction, migrations framework, or full domain model
//! mapping yet.

use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension, Result};

pub use crate::inputs::{
    NewSharedStateObject, NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun,
    NewWorkspaceSession, WidgetInstanceLayoutUpdate,
};
use crate::mappers::{
    bool_to_i64, shared_state_object_row, widget_instance_row, widget_log_row, widget_result_row,
    widget_run_row, workbench_event_row, workspace_row, workspace_session_row,
    workspace_summary_row, workspace_workbench_row,
};
use crate::rows::TableColumn;
pub use crate::rows::{
    SharedStateObjectRow, WidgetInstanceRow, WidgetLogRow, WidgetResultRow, WidgetRunRow,
    WorkbenchEventRow, WorkspaceRow, WorkspaceSessionRow, WorkspaceSummaryRow,
    WorkspaceWorkbenchRow,
};
use crate::schema;
use crate::time::{now_precise_timestamp, now_timestamp};

/// SQLite store for local Hobit persistence primitives.
pub struct SqliteStore {
    connection: Connection,
}

impl SqliteStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let store = Self {
            connection: Connection::open(path)?,
        };
        store.enable_foreign_keys()?;
        Ok(store)
    }

    pub fn open_in_memory() -> Result<Self> {
        let store = Self {
            connection: Connection::open_in_memory()?,
        };
        store.enable_foreign_keys()?;
        Ok(store)
    }

    pub fn init_schema(&self) -> Result<()> {
        self.enable_foreign_keys()?;
        self.connection.execute_batch(schema::INIT_SCHEMA)?;
        self.upgrade_schema()?;
        Ok(())
    }

    /// Runs a set of store operations in a single SQLite transaction.
    ///
    /// Callers must avoid nesting this helper.
    pub fn with_immediate_transaction<T>(
        &self,
        operation: impl FnOnce(&Self) -> Result<T>,
    ) -> Result<T> {
        self.connection.execute_batch("BEGIN IMMEDIATE")?;

        match operation(self) {
            Ok(value) => {
                if let Err(error) = self.connection.execute_batch("COMMIT") {
                    let _ = self.connection.execute_batch("ROLLBACK");
                    return Err(error);
                }

                Ok(value)
            }
            Err(error) => {
                let _ = self.connection.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    fn upgrade_schema(&self) -> Result<()> {
        self.upgrade_widget_logs_schema()?;
        self.ensure_column(
            "widget_results",
            "result_type",
            "result_type TEXT NOT NULL DEFAULT 'generic'",
        )?;
        self.ensure_column("widget_results", "content", "content TEXT NULL")?;
        self.connection.execute_batch(schema::POST_INIT_SCHEMA)?;
        Ok(())
    }

    fn upgrade_widget_logs_schema(&self) -> Result<()> {
        let columns = self.table_columns("widget_logs")?;
        let has_widget_instance_id = columns
            .iter()
            .any(|column| column.name == "widget_instance_id");
        let run_id_is_not_null = columns
            .iter()
            .find(|column| column.name == "run_id")
            .is_some_and(|column| column.not_null);

        if has_widget_instance_id && !run_id_is_not_null {
            return Ok(());
        }

        let widget_instance_id_expression = if has_widget_instance_id {
            "legacy.widget_instance_id"
        } else {
            "widget_runs.widget_instance_id"
        };
        let widget_run_join = if has_widget_instance_id {
            ""
        } else {
            "INNER JOIN widget_runs ON widget_runs.id = legacy.run_id"
        };

        let sql = format!(
            r#"
            ALTER TABLE widget_logs RENAME TO widget_logs_legacy;

            CREATE TABLE widget_logs (
                id TEXT PRIMARY KEY,
                widget_instance_id TEXT NOT NULL REFERENCES widget_instances(id),
                run_id TEXT NULL REFERENCES widget_runs(id),
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                details TEXT NULL
            );

            INSERT INTO widget_logs (
                id, widget_instance_id, run_id, level, message, created_at, details
            )
            SELECT
                legacy.id,
                {widget_instance_id_expression},
                legacy.run_id,
                legacy.level,
                legacy.message,
                legacy.created_at,
                legacy.details
            FROM widget_logs_legacy legacy
            {widget_run_join};

            DROP TABLE widget_logs_legacy;
            "#
        );

        self.connection.execute_batch(&sql)?;
        Ok(())
    }

    fn ensure_column(
        &self,
        table_name: &str,
        column_name: &str,
        column_definition: &str,
    ) -> Result<()> {
        let columns = self.table_columns(table_name)?;
        if columns.iter().any(|column| column.name == column_name) {
            return Ok(());
        }

        let sql = format!("ALTER TABLE {table_name} ADD COLUMN {column_definition}");
        self.connection.execute(&sql, [])?;
        Ok(())
    }

    fn table_columns(&self, table_name: &str) -> Result<Vec<TableColumn>> {
        let sql = format!("PRAGMA table_info({table_name})");
        let mut statement = self.connection.prepare(&sql)?;
        let rows = statement.query_map([], |row| {
            Ok(TableColumn {
                name: row.get(1)?,
                not_null: row.get::<_, i64>(3)? != 0,
            })
        })?;

        rows.collect()
    }

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

    pub fn insert_widget_instance(
        &self,
        input: NewWidgetInstance<'_>,
    ) -> Result<WidgetInstanceRow> {
        let now = now_timestamp();
        self.connection.execute(
            "INSERT INTO widget_instances (
                id, workspace_id, workbench_id, definition_id, title, category,
                layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                popout_y, popout_width, popout_height, always_on_top,
                is_visible, config, state, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                ?15, ?16, ?17, ?18, ?19, ?20, ?21
            )",
            params![
                input.id,
                input.workspace_id,
                input.workbench_id,
                input.definition_id,
                input.title,
                input.category,
                input.layout_mode,
                input.dock_x,
                input.dock_y,
                input.dock_width,
                input.dock_height,
                input.popout_x,
                input.popout_y,
                input.popout_width,
                input.popout_height,
                bool_to_i64(input.always_on_top),
                bool_to_i64(input.is_visible),
                input.config,
                input.state,
                now,
                now,
            ],
        )?;

        self.get_widget_instance(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_instance(&self, id: &str) -> Result<Option<WidgetInstanceRow>> {
        self.connection
            .query_row(
                "SELECT
                    id, workspace_id, workbench_id, definition_id, title, category,
                    layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                    popout_y, popout_width, popout_height, always_on_top,
                    is_visible, config, state, created_at, updated_at
                 FROM widget_instances
                 WHERE id = ?1",
                params![id],
                widget_instance_row,
            )
            .optional()
    }

    pub fn update_widget_instance_state(
        &self,
        widget_instance_id: &str,
        state: &str,
    ) -> Result<()> {
        let updated_at = now_precise_timestamp();
        let affected_rows = self.connection.execute(
            "UPDATE widget_instances
             SET state = ?1, updated_at = ?2
             WHERE id = ?3",
            params![state, updated_at, widget_instance_id],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok(())
    }

    pub fn update_widget_instance_layout(
        &self,
        widget_instance_id: &str,
        layout: WidgetInstanceLayoutUpdate<'_>,
    ) -> Result<()> {
        let updated_at = now_precise_timestamp();
        let affected_rows = self.connection.execute(
            "UPDATE widget_instances
             SET
                layout_mode = ?1,
                dock_x = ?2,
                dock_y = ?3,
                dock_width = ?4,
                dock_height = ?5,
                popout_x = ?6,
                popout_y = ?7,
                popout_width = ?8,
                popout_height = ?9,
                always_on_top = ?10,
                is_visible = ?11,
                updated_at = ?12
             WHERE id = ?13",
            params![
                layout.layout_mode,
                layout.dock_x,
                layout.dock_y,
                layout.dock_width,
                layout.dock_height,
                layout.popout_x,
                layout.popout_y,
                layout.popout_width,
                layout.popout_height,
                bool_to_i64(layout.always_on_top),
                bool_to_i64(layout.is_visible),
                updated_at,
                widget_instance_id,
            ],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok(())
    }

    pub fn list_widget_instances(&self, workspace_id: &str) -> Result<Vec<WidgetInstanceRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                id, workspace_id, workbench_id, definition_id, title, category,
                layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                popout_y, popout_width, popout_height, always_on_top,
                is_visible, config, state, created_at, updated_at
             FROM widget_instances
             WHERE workspace_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workspace_id], widget_instance_row)?;
        rows.collect()
    }

    pub fn list_widget_instances_for_workbench(
        &self,
        workbench_id: &str,
    ) -> Result<Vec<WidgetInstanceRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                id, workspace_id, workbench_id, definition_id, title, category,
                layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                popout_y, popout_width, popout_height, always_on_top,
                is_visible, config, state, created_at, updated_at
             FROM widget_instances
             WHERE workbench_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workbench_id], widget_instance_row)?;
        rows.collect()
    }

    pub fn insert_widget_run(&self, input: NewWidgetRun<'_>) -> Result<WidgetRunRow> {
        let started_at = input
            .started_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_runs (
                id, widget_instance_id, status, command_kind, command_payload,
                started_at, finished_at, summary
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.id,
                input.widget_instance_id,
                input.status,
                input.command_kind,
                input.command_payload,
                started_at,
                input.finished_at,
                input.summary,
            ],
        )?;

        self.get_widget_run(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_run(&self, id: &str) -> Result<Option<WidgetRunRow>> {
        self.connection
            .query_row(
                "SELECT
                    id, widget_instance_id, status, command_kind, command_payload,
                    started_at, finished_at, summary
                 FROM widget_runs
                 WHERE id = ?1",
                params![id],
                widget_run_row,
            )
            .optional()
    }

    pub fn append_widget_log(&self, input: NewWidgetLog<'_>) -> Result<WidgetLogRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_logs (
                id, widget_instance_id, run_id, level, message, created_at, details
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.id,
                input.widget_instance_id,
                input.run_id,
                input.level,
                input.message,
                created_at,
                input.details,
            ],
        )?;

        self.get_widget_log(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_log(&self, id: &str) -> Result<Option<WidgetLogRow>> {
        self.connection
            .query_row(
                "SELECT id, widget_instance_id, run_id, level, message, created_at, details
                 FROM widget_logs
                 WHERE id = ?1",
                params![id],
                widget_log_row,
            )
            .optional()
    }

    pub fn list_widget_logs(&self, run_id: &str) -> Result<Vec<WidgetLogRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, widget_instance_id, run_id, level, message, created_at, details
             FROM widget_logs
             WHERE run_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![run_id], widget_log_row)?;
        rows.collect()
    }

    pub fn list_widget_logs_for_widget(
        &self,
        widget_instance_id: &str,
    ) -> Result<Vec<WidgetLogRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, widget_instance_id, run_id, level, message, created_at, details
             FROM widget_logs
             WHERE widget_instance_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![widget_instance_id], widget_log_row)?;
        rows.collect()
    }

    pub fn insert_widget_result(&self, input: NewWidgetResult<'_>) -> Result<WidgetResultRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_results (
                id, run_id, status, result_type, summary, content, payload, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.id,
                input.run_id,
                input.status,
                input.result_type.unwrap_or("generic"),
                input.summary,
                input.content,
                input.payload,
                created_at,
            ],
        )?;

        self.get_widget_result(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_result(&self, id: &str) -> Result<Option<WidgetResultRow>> {
        self.connection
            .query_row(
                "SELECT id, run_id, status, result_type, summary, content, payload, created_at
                 FROM widget_results
                 WHERE id = ?1",
                params![id],
                widget_result_row,
            )
            .optional()
    }

    pub fn list_widget_results(&self, run_id: &str) -> Result<Vec<WidgetResultRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, run_id, status, result_type, summary, content, payload, created_at
             FROM widget_results
             WHERE run_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![run_id], widget_result_row)?;
        rows.collect()
    }

    pub fn insert_shared_state_object(
        &self,
        input: NewSharedStateObject<'_>,
    ) -> Result<SharedStateObjectRow> {
        let now = now_timestamp();
        self.connection.execute(
            "INSERT INTO shared_state_objects (
                id, workspace_id, \"key\", value, value_kind, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.id,
                input.workspace_id,
                input.key,
                input.value,
                input.value_kind,
                now,
                now,
            ],
        )?;

        self.get_shared_state_object(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_shared_state_object(&self, id: &str) -> Result<Option<SharedStateObjectRow>> {
        self.connection
            .query_row(
                "SELECT id, workspace_id, \"key\", value, value_kind, created_at, updated_at
                 FROM shared_state_objects
                 WHERE id = ?1",
                params![id],
                shared_state_object_row,
            )
            .optional()
    }

    pub fn list_shared_state_objects(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<SharedStateObjectRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, workspace_id, \"key\", value, value_kind, created_at, updated_at
             FROM shared_state_objects
             WHERE workspace_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workspace_id], shared_state_object_row)?;
        rows.collect()
    }

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

    fn enable_foreign_keys(&self) -> Result<()> {
        self.connection.pragma_update(None, "foreign_keys", "ON")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn initialized_store() -> SqliteStore {
        let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
        store.init_schema().expect("initialize schema");
        store
    }

    fn create_workspace_and_workbench(store: &SqliteStore) {
        store
            .create_workspace("workspace-1", "Incident", Some("Investigate"), "active")
            .expect("create workspace");
        store
            .create_workspace_workbench("workbench-1", "workspace-1", None)
            .expect("create workbench");
    }

    fn insert_widget(store: &SqliteStore) {
        store
            .insert_widget_instance(NewWidgetInstance {
                id: "widget-1",
                workspace_id: "workspace-1",
                workbench_id: "workbench-1",
                definition_id: "notes",
                title: "Notes",
                category: "notes",
                layout_mode: "popped_out",
                dock_x: Some(10),
                dock_y: Some(20),
                dock_width: Some(480),
                dock_height: Some(320),
                popout_x: Some(100),
                popout_y: Some(120),
                popout_width: Some(640),
                popout_height: Some(480),
                always_on_top: true,
                is_visible: true,
                config: Some("{scope:workspace}"),
                state: Some("{dirty:false}"),
            })
            .expect("insert widget");
    }

    fn insert_widget_run(store: &SqliteStore) -> WidgetRunRow {
        store
            .insert_widget_run(NewWidgetRun {
                id: "run-1",
                widget_instance_id: "widget-1",
                status: "completed",
                command_kind: Some("save_note"),
                command_payload: Some("{note:1}"),
                started_at: Some("1"),
                finished_at: Some("2"),
                summary: Some("Saved note"),
            })
            .expect("insert run")
    }

    #[test]
    fn init_schema_is_idempotent() {
        let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");

        store.init_schema().expect("first init");
        store.init_schema().expect("second init");

        let foreign_keys_enabled: i64 = store
            .connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign key pragma");

        assert_eq!(foreign_keys_enabled, 1);
    }

    #[test]
    fn transaction_rolls_back_when_operation_fails() {
        let store = initialized_store();

        let result = store.with_immediate_transaction(|store| {
            store.create_workspace("workspace-rollback", "Rollback", None, "active")?;
            store.create_workspace_workbench("workbench-rollback", "missing-workspace", None)?;
            Ok(())
        });

        assert!(result.is_err());
        assert!(store
            .get_workspace("workspace-rollback")
            .expect("get rolled back workspace")
            .is_none());
        assert!(store
            .get_workspace_workbench("workbench-rollback")
            .expect("get rolled back workbench")
            .is_none());
    }

    #[test]
    fn init_schema_upgrades_widget_log_and_result_columns() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);
        insert_widget_run(&store);

        store
            .connection
            .execute_batch(
                r#"
                DROP TABLE widget_logs;
                DROP TABLE widget_results;

                CREATE TABLE widget_logs (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES widget_runs(id),
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    details TEXT NULL
                );

                CREATE TABLE widget_results (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES widget_runs(id),
                    status TEXT NOT NULL,
                    summary TEXT NULL,
                    payload TEXT NULL,
                    created_at TEXT NOT NULL
                );

                INSERT INTO widget_logs (
                    id, run_id, level, message, created_at, details
                ) VALUES (
                    'legacy-log', 'run-1', 'info', 'Legacy log', '1', NULL
                );

                INSERT INTO widget_results (
                    id, run_id, status, summary, payload, created_at
                ) VALUES (
                    'legacy-result', 'run-1', 'completed', 'Legacy result', '{ok:true}', '1'
                );
                "#,
            )
            .expect("create legacy widget tables");

        store.init_schema().expect("upgrade schema");

        let legacy_log = store
            .get_widget_log("legacy-log")
            .expect("get legacy log")
            .expect("legacy log");
        let legacy_result = store
            .get_widget_result("legacy-result")
            .expect("get legacy result")
            .expect("legacy result");
        let widget_local_log = store
            .append_widget_log(NewWidgetLog {
                id: "widget-local-log",
                widget_instance_id: "widget-1",
                run_id: None,
                level: "info",
                message: "Widget-local log",
                created_at: Some("2"),
                details: None,
            })
            .expect("append widget-local log");

        assert_eq!(legacy_log.widget_instance_id, "widget-1");
        assert_eq!(legacy_log.run_id.as_deref(), Some("run-1"));
        assert_eq!(legacy_result.result_type, "generic");
        assert_eq!(legacy_result.content, None);
        assert_eq!(widget_local_log.run_id, None);
    }

    #[test]
    fn create_and_load_workspace() {
        let store = initialized_store();

        let created = store
            .create_workspace("workspace-1", "Incident", Some("Investigate"), "active")
            .expect("create workspace");
        let loaded = store
            .get_workspace("workspace-1")
            .expect("load workspace")
            .expect("workspace row");

        assert_eq!(created.id, loaded.id);
        assert_eq!(loaded.title, "Incident");
        assert_eq!(loaded.description.as_deref(), Some("Investigate"));
        assert_eq!(loaded.status, "active");
    }

    #[test]
    fn create_workspace_with_empty_workbench() {
        let store = initialized_store();

        store
            .create_workspace("workspace-1", "Empty", None, "active")
            .expect("create workspace");
        let workbench = store
            .create_workspace_workbench("workbench-1", "workspace-1", None)
            .expect("create workbench");
        let widgets = store
            .list_widget_instances("workspace-1")
            .expect("list widget instances");

        assert_eq!(workbench.workspace_id, "workspace-1");
        assert!(widgets.is_empty());
    }

    #[test]
    fn list_workspaces_returns_created_rows() {
        let store = initialized_store();

        store
            .create_workspace("workspace-1", "First", None, "active")
            .expect("create first workspace");
        store
            .create_workspace("workspace-2", "Second", None, "active")
            .expect("create second workspace");

        let workspaces = store.list_workspaces().expect("list workspaces");

        assert_eq!(workspaces.len(), 2);
        assert!(workspaces
            .iter()
            .any(|workspace| workspace.id == "workspace-1"));
        assert!(workspaces
            .iter()
            .any(|workspace| workspace.id == "workspace-2"));
    }

    #[test]
    fn list_workspace_summaries_with_workbench_returns_first_workbench_without_duplicates() {
        let store = initialized_store();

        store
            .create_workspace("workspace-older", "Older", None, "active")
            .expect("create older workspace");
        store
            .create_workspace_workbench("workbench-later", "workspace-older", None)
            .expect("create later workbench");
        store
            .create_workspace_workbench("workbench-first", "workspace-older", None)
            .expect("create first workbench");
        store
            .create_workspace("workspace-newer", "Newer", None, "active")
            .expect("create newer workspace");

        for (workbench_id, created_at) in [("workbench-later", "2"), ("workbench-first", "1")] {
            store
                .connection
                .execute(
                    "UPDATE workspace_workbenches SET created_at = ?1 WHERE id = ?2",
                    rusqlite::params![created_at, workbench_id],
                )
                .expect("set workbench created_at");
        }
        for (workspace_id, updated_at) in [("workspace-older", "1"), ("workspace-newer", "2")] {
            store
                .connection
                .execute(
                    "UPDATE workspaces SET updated_at = ?1 WHERE id = ?2",
                    rusqlite::params![updated_at, workspace_id],
                )
                .expect("set workspace updated_at");
        }

        let summaries = store
            .list_workspace_summaries_with_workbench()
            .expect("list workspace summaries");

        assert_eq!(summaries.len(), 2);
        assert_eq!(
            summaries
                .iter()
                .map(|workspace| workspace.id.as_str())
                .collect::<Vec<_>>(),
            vec!["workspace-newer", "workspace-older"]
        );
        assert_eq!(summaries[0].workbench_id, None);
        assert_eq!(
            summaries[1].workbench_id.as_deref(),
            Some("workbench-first")
        );
    }

    #[test]
    fn touch_workspace_updates_updated_at() {
        let store = initialized_store();
        store
            .create_workspace("workspace-1", "Incident", None, "active")
            .expect("create workspace");
        store
            .connection
            .execute(
                "UPDATE workspaces SET updated_at = ?1 WHERE id = ?2",
                rusqlite::params!["1", "workspace-1"],
            )
            .expect("set stale updated_at");

        store
            .touch_workspace("workspace-1")
            .expect("touch workspace");

        let touched = store
            .get_workspace("workspace-1")
            .expect("get workspace")
            .expect("workspace row");

        assert_ne!(touched.updated_at, "1");
        assert!(touched.updated_at.as_str() > "1");
    }

    #[test]
    fn create_and_load_workspace_session() {
        let store = initialized_store();
        store
            .create_workspace("workspace-1", "Incident", None, "active")
            .expect("create workspace");

        let session = store
            .create_workspace_session(NewWorkspaceSession {
                id: "session-1",
                workspace_id: "workspace-1",
                status: "open",
                opened_at: Some("1"),
                closed_at: None,
                active_widget_id: None,
                current_focus_kind: None,
                current_focus_ref: None,
            })
            .expect("create session");
        let loaded = store
            .get_workspace_session("session-1")
            .expect("load session")
            .expect("session row");

        assert_eq!(session, loaded);
        assert_eq!(loaded.workspace_id, "workspace-1");
        assert_eq!(loaded.status, "open");
    }

    #[test]
    fn list_workspace_workbenches_for_workspace() {
        let store = initialized_store();
        store
            .create_workspace("workspace-1", "Incident", None, "active")
            .expect("create workspace");
        store
            .create_workspace_workbench("workbench-1", "workspace-1", None)
            .expect("create first workbench");
        store
            .create_workspace_workbench("workbench-2", "workspace-1", None)
            .expect("create second workbench");

        let workbenches = store
            .list_workspace_workbenches("workspace-1")
            .expect("list workbenches");

        assert_eq!(workbenches.len(), 2);
        assert!(workbenches
            .iter()
            .any(|workbench| workbench.id == "workbench-1"));
        assert!(workbenches
            .iter()
            .any(|workbench| workbench.id == "workbench-2"));
    }

    #[test]
    fn insert_and_list_widget_instance_layout() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);

        let widgets = store
            .list_widget_instances("workspace-1")
            .expect("list widget instances");

        assert_eq!(widgets.len(), 1);
        assert_eq!(widgets[0].layout_mode, "popped_out");
        assert_eq!(widgets[0].dock_width, Some(480));
        assert_eq!(widgets[0].popout_width, Some(640));
        assert!(widgets[0].always_on_top);
    }

    #[test]
    fn update_widget_instance_state_persists_state() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);
        let before_update = store
            .get_widget_instance("widget-1")
            .expect("get widget before update")
            .expect("widget row");

        store
            .update_widget_instance_state("widget-1", "{\"body\":\"Draft\"}")
            .expect("update widget state");

        let after_update = store
            .get_widget_instance("widget-1")
            .expect("get widget after update")
            .expect("widget row");

        assert_eq!(after_update.state.as_deref(), Some("{\"body\":\"Draft\"}"));
        assert_ne!(after_update.updated_at, before_update.updated_at);
    }

    #[test]
    fn update_widget_instance_layout_persists_layout_fields() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);
        let before_update = store
            .get_widget_instance("widget-1")
            .expect("get widget before update")
            .expect("widget row");

        store
            .update_widget_instance_layout(
                "widget-1",
                WidgetInstanceLayoutUpdate {
                    layout_mode: "docked",
                    dock_x: Some(30),
                    dock_y: Some(40),
                    dock_width: Some(720),
                    dock_height: Some(360),
                    popout_x: None,
                    popout_y: None,
                    popout_width: None,
                    popout_height: None,
                    always_on_top: false,
                    is_visible: false,
                },
            )
            .expect("update widget layout");

        let after_update = store
            .get_widget_instance("widget-1")
            .expect("get widget after update")
            .expect("widget row");

        assert_eq!(after_update.layout_mode, "docked");
        assert_eq!(after_update.dock_x, Some(30));
        assert_eq!(after_update.dock_y, Some(40));
        assert_eq!(after_update.dock_width, Some(720));
        assert_eq!(after_update.dock_height, Some(360));
        assert_eq!(after_update.popout_x, None);
        assert_eq!(after_update.popout_y, None);
        assert_eq!(after_update.popout_width, None);
        assert_eq!(after_update.popout_height, None);
        assert!(!after_update.always_on_top);
        assert!(!after_update.is_visible);
        assert_ne!(after_update.updated_at, before_update.updated_at);
    }

    #[test]
    fn list_widget_instances_for_workbench_returns_only_that_workbench() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        store
            .create_workspace_workbench("workbench-2", "workspace-1", None)
            .expect("create second workbench");

        insert_widget(&store);
        store
            .insert_widget_instance(NewWidgetInstance {
                id: "widget-2",
                workspace_id: "workspace-1",
                workbench_id: "workbench-2",
                definition_id: "notes",
                title: "Other Notes",
                category: "notes",
                layout_mode: "docked",
                dock_x: Some(0),
                dock_y: Some(0),
                dock_width: Some(320),
                dock_height: Some(240),
                popout_x: None,
                popout_y: None,
                popout_width: None,
                popout_height: None,
                always_on_top: false,
                is_visible: true,
                config: None,
                state: None,
            })
            .expect("insert second widget");

        let widgets = store
            .list_widget_instances_for_workbench("workbench-1")
            .expect("list workbench widgets");

        assert_eq!(widgets.len(), 1);
        assert_eq!(widgets[0].id, "widget-1");
        assert_eq!(widgets[0].workbench_id, "workbench-1");
    }

    #[test]
    fn append_and_list_workbench_events() {
        let store = initialized_store();
        store
            .create_workspace("workspace-1", "Incident", None, "active")
            .expect("create workspace");

        store
            .append_workbench_event(
                "event-1",
                "workspace-1",
                "workspace_opened",
                "Workspace opened",
                Some("{source:test}"),
            )
            .expect("append event");
        let events = store
            .list_workbench_events("workspace-1")
            .expect("list events");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, "workspace_opened");
        assert_eq!(events[0].payload.as_deref(), Some("{source:test}"));
    }

    #[test]
    fn list_recent_workspace_events_respects_limit_and_order() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        store
            .create_workspace("workspace-2", "Other", None, "active")
            .expect("create other workspace");
        store
            .create_workspace_workbench("workbench-2", "workspace-2", None)
            .expect("create other workbench");

        for event_id in ["event-1", "event-2", "event-3"] {
            store
                .append_workbench_event(
                    event_id,
                    "workspace-1",
                    "workspace_changed",
                    "Workspace changed",
                    None,
                )
                .expect("append event");
        }
        store
            .append_workbench_event(
                "other-event",
                "workspace-2",
                "workspace_changed",
                "Other workspace changed",
                None,
            )
            .expect("append other event");

        for (event_id, created_at) in [
            ("event-1", "1"),
            ("event-2", "2"),
            ("event-3", "3"),
            ("other-event", "4"),
        ] {
            store
                .connection
                .execute(
                    "UPDATE workbench_events SET created_at = ?1 WHERE id = ?2",
                    rusqlite::params![created_at, event_id],
                )
                .expect("set event timestamp");
        }

        let events = store
            .list_recent_workspace_events("workspace-1", 2)
            .expect("list recent events");

        assert_eq!(event_ids(&events), vec!["event-2", "event-3"]);
    }

    #[test]
    fn insert_widget_run_log_and_result() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);

        let run = insert_widget_run(&store);
        let log = store
            .append_widget_log(NewWidgetLog {
                id: "log-1",
                widget_instance_id: "widget-1",
                run_id: Some("run-1"),
                level: "info",
                message: "Saved note",
                created_at: Some("2"),
                details: None,
            })
            .expect("append log");
        let result = store
            .insert_widget_result(NewWidgetResult {
                id: "result-1",
                run_id: "run-1",
                status: "completed",
                result_type: Some("note"),
                summary: Some("Note persisted"),
                content: Some("Saved note content"),
                payload: Some("{ok:true}"),
                created_at: Some("2"),
            })
            .expect("insert result");

        assert_eq!(run.widget_instance_id, "widget-1");
        assert_eq!(log.widget_instance_id, "widget-1");
        assert_eq!(log.run_id.as_deref(), Some("run-1"));
        assert_eq!(result.result_type, "note");
        assert_eq!(result.summary.as_deref(), Some("Note persisted"));
        assert_eq!(result.content.as_deref(), Some("Saved note content"));
        assert_eq!(store.list_widget_logs("run-1").expect("list logs").len(), 1);
        assert_eq!(
            store
                .list_widget_logs_for_widget("widget-1")
                .expect("list widget logs")
                .len(),
            1
        );
        assert_eq!(
            store
                .list_widget_results("run-1")
                .expect("list results")
                .len(),
            1
        );
    }

    #[test]
    fn append_widget_local_log_without_run_id() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);

        let log = store
            .append_widget_log(NewWidgetLog {
                id: "log-1",
                widget_instance_id: "widget-1",
                run_id: None,
                level: "info",
                message: "Workspace context loaded",
                created_at: Some("1"),
                details: Some("{source:widget}"),
            })
            .expect("append widget-local log");
        let widget_logs = store
            .list_widget_logs_for_widget("widget-1")
            .expect("list widget-local logs");

        assert_eq!(log.widget_instance_id, "widget-1");
        assert_eq!(log.run_id, None);
        assert_eq!(widget_logs.len(), 1);
        assert_eq!(widget_logs[0].id, "log-1");
    }

    fn event_ids(events: &[WorkbenchEventRow]) -> Vec<&str> {
        events.iter().map(|event| event.id.as_str()).collect()
    }
}
