//! Small row-level SQLite storage primitives.
//!
//! This module intentionally stores simple rows and text payloads. It does not
//! provide a repository abstraction, migrations framework, or full domain model
//! mapping yet.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension, Result};

use crate::schema;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceRow {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceWorkbenchRow {
    pub id: String,
    pub workspace_id: String,
    pub preset_origin_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSessionRow {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub active_widget_id: Option<String>,
    pub current_focus_kind: Option<String>,
    pub current_focus_ref: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWorkspaceSession<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub status: &'a str,
    pub opened_at: Option<&'a str>,
    pub closed_at: Option<&'a str>,
    pub active_widget_id: Option<&'a str>,
    pub current_focus_kind: Option<&'a str>,
    pub current_focus_ref: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstanceRow {
    pub id: String,
    pub workspace_id: String,
    pub workbench_id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
    pub config: Option<String>,
    pub state: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetInstance<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub workbench_id: &'a str,
    pub definition_id: &'a str,
    pub title: &'a str,
    pub category: &'a str,
    pub layout_mode: &'a str,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
    pub config: Option<&'a str>,
    pub state: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunRow {
    pub id: String,
    pub widget_instance_id: String,
    pub status: String,
    pub command_kind: Option<String>,
    pub command_payload: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetRun<'a> {
    pub id: &'a str,
    pub widget_instance_id: &'a str,
    pub status: &'a str,
    pub command_kind: Option<&'a str>,
    pub command_payload: Option<&'a str>,
    pub started_at: Option<&'a str>,
    pub finished_at: Option<&'a str>,
    pub summary: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLogRow {
    pub id: String,
    pub run_id: String,
    pub level: String,
    pub message: String,
    pub created_at: String,
    pub details: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetLog<'a> {
    pub id: &'a str,
    pub run_id: &'a str,
    pub level: &'a str,
    pub message: &'a str,
    pub created_at: Option<&'a str>,
    pub details: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetResultRow {
    pub id: String,
    pub run_id: String,
    pub status: String,
    pub summary: Option<String>,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetResult<'a> {
    pub id: &'a str,
    pub run_id: &'a str,
    pub status: &'a str,
    pub summary: Option<&'a str>,
    pub payload: Option<&'a str>,
    pub created_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedStateObjectRow {
    pub id: String,
    pub workspace_id: String,
    pub key: String,
    pub value: String,
    pub value_kind: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewSharedStateObject<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub key: &'a str,
    pub value: &'a str,
    pub value_kind: &'a str,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchEventRow {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    pub summary: String,
    pub payload: Option<String>,
    pub created_at: String,
}

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
        Ok(())
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
                id, run_id, level, message, created_at, details
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                input.id,
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
                "SELECT id, run_id, level, message, created_at, details
                 FROM widget_logs
                 WHERE id = ?1",
                params![id],
                widget_log_row,
            )
            .optional()
    }

    pub fn list_widget_logs(&self, run_id: &str) -> Result<Vec<WidgetLogRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, run_id, level, message, created_at, details
             FROM widget_logs
             WHERE run_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![run_id], widget_log_row)?;
        rows.collect()
    }

    pub fn insert_widget_result(&self, input: NewWidgetResult<'_>) -> Result<WidgetResultRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_results (
                id, run_id, status, summary, payload, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                input.id,
                input.run_id,
                input.status,
                input.summary,
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
                "SELECT id, run_id, status, summary, payload, created_at
                 FROM widget_results
                 WHERE id = ?1",
                params![id],
                widget_result_row,
            )
            .optional()
    }

    pub fn list_widget_results(&self, run_id: &str) -> Result<Vec<WidgetResultRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, run_id, status, summary, payload, created_at
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

    fn enable_foreign_keys(&self) -> Result<()> {
        self.connection.pragma_update(None, "foreign_keys", "ON")?;
        Ok(())
    }
}

fn workspace_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceRow> {
    Ok(WorkspaceRow {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn workspace_workbench_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceWorkbenchRow> {
    Ok(WorkspaceWorkbenchRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        preset_origin_id: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn workspace_session_row(row: &rusqlite::Row<'_>) -> Result<WorkspaceSessionRow> {
    Ok(WorkspaceSessionRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        status: row.get(2)?,
        opened_at: row.get(3)?,
        closed_at: row.get(4)?,
        active_widget_id: row.get(5)?,
        current_focus_kind: row.get(6)?,
        current_focus_ref: row.get(7)?,
    })
}

fn widget_instance_row(row: &rusqlite::Row<'_>) -> Result<WidgetInstanceRow> {
    Ok(WidgetInstanceRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        workbench_id: row.get(2)?,
        definition_id: row.get(3)?,
        title: row.get(4)?,
        category: row.get(5)?,
        layout_mode: row.get(6)?,
        dock_x: row.get(7)?,
        dock_y: row.get(8)?,
        dock_width: row.get(9)?,
        dock_height: row.get(10)?,
        popout_x: row.get(11)?,
        popout_y: row.get(12)?,
        popout_width: row.get(13)?,
        popout_height: row.get(14)?,
        always_on_top: i64_to_bool(row.get(15)?),
        is_visible: i64_to_bool(row.get(16)?),
        config: row.get(17)?,
        state: row.get(18)?,
        created_at: row.get(19)?,
        updated_at: row.get(20)?,
    })
}

fn widget_run_row(row: &rusqlite::Row<'_>) -> Result<WidgetRunRow> {
    Ok(WidgetRunRow {
        id: row.get(0)?,
        widget_instance_id: row.get(1)?,
        status: row.get(2)?,
        command_kind: row.get(3)?,
        command_payload: row.get(4)?,
        started_at: row.get(5)?,
        finished_at: row.get(6)?,
        summary: row.get(7)?,
    })
}

fn widget_log_row(row: &rusqlite::Row<'_>) -> Result<WidgetLogRow> {
    Ok(WidgetLogRow {
        id: row.get(0)?,
        run_id: row.get(1)?,
        level: row.get(2)?,
        message: row.get(3)?,
        created_at: row.get(4)?,
        details: row.get(5)?,
    })
}

fn widget_result_row(row: &rusqlite::Row<'_>) -> Result<WidgetResultRow> {
    Ok(WidgetResultRow {
        id: row.get(0)?,
        run_id: row.get(1)?,
        status: row.get(2)?,
        summary: row.get(3)?,
        payload: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn shared_state_object_row(row: &rusqlite::Row<'_>) -> Result<SharedStateObjectRow> {
    Ok(SharedStateObjectRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        key: row.get(2)?,
        value: row.get(3)?,
        value_kind: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn workbench_event_row(row: &rusqlite::Row<'_>) -> Result<WorkbenchEventRow> {
    Ok(WorkbenchEventRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        kind: row.get(2)?,
        summary: row.get(3)?,
        payload: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn i64_to_bool(value: i64) -> bool {
    value != 0
}

fn now_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_owned())
}

fn now_precise_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| format!("{}.{:09}", duration.as_secs(), duration.subsec_nanos()))
        .unwrap_or_else(|_| "0.000000000".to_owned())
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
    fn insert_widget_run_log_and_result() {
        let store = initialized_store();
        create_workspace_and_workbench(&store);
        insert_widget(&store);

        let run = store
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
            .expect("insert run");
        let log = store
            .append_widget_log(NewWidgetLog {
                id: "log-1",
                run_id: "run-1",
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
                summary: Some("Note persisted"),
                payload: Some("{ok:true}"),
                created_at: Some("2"),
            })
            .expect("insert result");

        assert_eq!(run.widget_instance_id, "widget-1");
        assert_eq!(log.run_id, "run-1");
        assert_eq!(result.summary.as_deref(), Some("Note persisted"));
        assert_eq!(store.list_widget_logs("run-1").expect("list logs").len(), 1);
        assert_eq!(
            store
                .list_widget_results("run-1")
                .expect("list results")
                .len(),
            1
        );
    }
}
