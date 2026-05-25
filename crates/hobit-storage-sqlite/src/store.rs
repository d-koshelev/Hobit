//! Small row-level SQLite storage primitives.
//!
//! This module intentionally stores simple rows and text payloads. It does not
//! provide a repository abstraction, migrations framework, or full domain model
//! mapping yet.

use std::path::Path;

use rusqlite::{Connection, Result};

pub use crate::inputs::{
    AgentQueueTaskRunLinkFinalUpdate, AgentQueueTaskUpdate, JdbcConnectorUpdate,
    KnowledgeDocumentUpdate, NewAgentQueueItem, NewAgentQueueTask, NewAgentQueueTaskRunLink,
    NewJdbcConnector, NewKnowledgeDocument, NewSharedStateObject, NewSkill, NewWidgetInstance,
    NewWidgetLog, NewWidgetResult, NewWidgetRun, NewWorkspaceNote, NewWorkspaceSession,
    SkillUpdate, WidgetInstanceLayoutUpdate, WidgetRunFinishUpdate, WorkspaceNoteUpdate,
};
use crate::rows::TableColumn;
pub use crate::rows::{
    AgentQueueItemRow, AgentQueueTaskRow, AgentQueueTaskRunLinkRow, JdbcConnectorRow,
    KnowledgeDocumentChunkRow, KnowledgeDocumentRow, KnowledgeDocumentSearchResultRow,
    SharedStateObjectRow, SkillRow, WidgetInstanceRow, WidgetLogRow, WidgetResultRow, WidgetRunRow,
    WorkbenchEventRow, WorkspaceNoteRow, WorkspaceRow, WorkspaceSessionRow, WorkspaceSummaryRow,
    WorkspaceWorkbenchRow,
};
use crate::schema;

mod agent_queue_items;
mod agent_queue_task_run_links;
mod agent_queue_tasks;
mod events;
mod jdbc_connectors;
mod knowledge_documents;
mod notes;
mod sessions;
mod shared_state;
mod skills;
mod widget_instances;
mod widget_logs;
mod widget_results;
mod widget_runs;
mod workbenches;
mod workspaces;

#[cfg(test)]
mod agent_queue_task_run_links_tests;
#[cfg(test)]
mod agent_queue_tasks_tests;
#[cfg(test)]
mod jdbc_connectors_tests;
#[cfg(test)]
mod knowledge_documents_tests;
#[cfg(test)]
mod notes_tests;
#[cfg(test)]
mod skills_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod widget_delete_tests;
#[cfg(test)]
mod workspace_delete_tests;

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
        self.ensure_column(
            "agent_queue_tasks",
            "assigned_executor_widget_id",
            "assigned_executor_widget_id TEXT NULL REFERENCES widget_instances(id) ON DELETE SET NULL",
        )?;
        self.ensure_column(
            "agent_queue_tasks",
            "execution_policy",
            "execution_policy TEXT NOT NULL DEFAULT 'manual'",
        )?;
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

    fn enable_foreign_keys(&self) -> Result<()> {
        self.connection.pragma_update(None, "foreign_keys", "ON")?;
        Ok(())
    }
}
