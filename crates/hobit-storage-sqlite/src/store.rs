//! Small row-level SQLite storage primitives.
//!
//! This module intentionally stores simple rows and text payloads. It does not
//! provide a repository abstraction, migrations framework, or full domain model
//! mapping yet.

use std::path::Path;

use rusqlite::{Connection, Result};

pub use crate::inputs::{
    AgentQueueControlStateUpdate, AgentQueueReviewMessageAckUpdate,
    AgentQueueTaskRunLinkFinalUpdate, AgentQueueTaskUpdate, AgentQueueWorkerUpdate,
    AgentQueueWorkflowActionUpdate, AgentQueueWorkflowRunReportUpdate,
    AgentQueueWorkflowRunStatusUpdate, JdbcConnectionProfileUpdate, JdbcConnectorUpdate,
    KnowledgeDocumentUpdate, NewAgentQueueCompletionDecision, NewAgentQueueControlState,
    NewAgentQueueFailureDecision, NewAgentQueueItem, NewAgentQueueReviewMessage, NewAgentQueueTask,
    NewAgentQueueTaskRunLink, NewAgentQueueWorker, NewAgentQueueWorkerEvidenceBundle,
    NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun, NewJdbcConnectionProfile,
    NewJdbcConnector, NewKnowledgeDocument, NewKnowledgeDraftReviewRecord, NewSharedStateObject,
    NewSkill, NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun, NewWorkspaceNote,
    NewWorkspaceSession, SkillUpdate, WidgetInstanceLayoutUpdate, WidgetRunFinishUpdate,
    WorkspaceNoteUpdate,
};
use crate::rows::TableColumn;
pub use crate::rows::{
    AgentQueueCompletionDecisionRow, AgentQueueControlStateRow, AgentQueueFailureDecisionRow,
    AgentQueueItemRow, AgentQueueReviewMessageRow, AgentQueueTaskRow, AgentQueueTaskRunLinkRow,
    AgentQueueWorkerEvidenceBundleRow, AgentQueueWorkerRow, AgentQueueWorkflowActionRow,
    AgentQueueWorkflowRunRow, JdbcConnectionProfileRow, JdbcConnectorRow,
    KnowledgeDocumentChunkRow, KnowledgeDocumentRow, KnowledgeDocumentSearchResultRow,
    KnowledgeDraftReviewRecordRow, SharedStateObjectRow, SkillRow, WidgetInstanceRow, WidgetLogRow,
    WidgetResultRow, WidgetRunRow, WorkbenchEventRow, WorkspaceNoteRow, WorkspaceRow,
    WorkspaceSessionRow, WorkspaceSummaryRow, WorkspaceWorkbenchRow,
};
use crate::schema;

mod agent_queue_completion_decisions;
mod agent_queue_control_states;
mod agent_queue_failure_decisions;
mod agent_queue_items;
mod agent_queue_review_messages;
mod agent_queue_task_run_links;
mod agent_queue_tasks;
mod agent_queue_worker_evidence_bundles;
mod agent_queue_workers;
mod agent_queue_workflows;
mod events;
mod jdbc_connection_profiles;
mod jdbc_connectors;
mod knowledge_document_schema;
mod knowledge_documents;
mod knowledge_draft_review_ledger;
mod knowledge_search;
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
mod agent_queue_control_states_tests;
#[cfg(test)]
mod agent_queue_review_messages_tests;
#[cfg(test)]
mod agent_queue_task_run_links_tests;
#[cfg(test)]
mod agent_queue_tasks_tests;
#[cfg(test)]
mod agent_queue_workers_tests;
#[cfg(test)]
mod agent_queue_workflows_tests;
#[cfg(test)]
mod jdbc_connection_profiles_tests;
#[cfg(test)]
mod jdbc_connectors_tests;
#[cfg(test)]
mod knowledge_document_schema_tests;
#[cfg(test)]
mod knowledge_documents_production_tests;
#[cfg(test)]
mod knowledge_documents_tests;
#[cfg(test)]
mod knowledge_draft_review_ledger_tests;
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
        self.upgrade_agent_queue_task_run_links_backend_owned_schema()?;
        self.upgrade_agent_queue_worker_evidence_backend_owned_schema()?;
        self.upgrade_agent_queue_review_messages_backend_owned_schema()?;
        self.upgrade_knowledge_documents_schema()?;
        self.ensure_column("workspaces", "root_path", "root_path TEXT NULL")?;
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
        self.ensure_column(
            "agent_queue_tasks",
            "depends_on",
            "depends_on TEXT NOT NULL DEFAULT '[]'",
        )?;
        self.ensure_column(
            "agent_queue_tasks",
            "execution_workspace",
            "execution_workspace TEXT NULL",
        )?;
        self.ensure_column(
            "agent_queue_tasks",
            "codex_executable",
            "codex_executable TEXT NULL",
        )?;
        self.ensure_column("agent_queue_tasks", "sandbox", "sandbox TEXT NULL")?;
        self.ensure_column(
            "agent_queue_tasks",
            "approval_policy",
            "approval_policy TEXT NULL",
        )?;
        self.ensure_column(
            "agent_queue_tasks",
            "context_json",
            "context_json TEXT NULL",
        )?;
        self.connection.execute_batch(schema::POST_INIT_SCHEMA)?;
        Ok(())
    }

    fn upgrade_agent_queue_worker_evidence_backend_owned_schema(&self) -> Result<()> {
        let mut statement = self
            .connection
            .prepare("PRAGMA foreign_key_list(agent_queue_worker_evidence_bundles)")?;
        let has_widget_run_fk = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })?
            .collect::<Result<Vec<_>>>()?
            .iter()
            .any(|(table, from, to)| table == "widget_runs" && from == "run_id" && to == "id");
        if !has_widget_run_fk {
            return Ok(());
        }
        drop(statement);

        self.connection.pragma_update(None, "foreign_keys", "OFF")?;
        let migration = self.connection.execute_batch(
            r#"
            ALTER TABLE agent_queue_worker_evidence_bundles
                RENAME TO agent_queue_worker_evidence_bundles_legacy;

            CREATE TABLE agent_queue_worker_evidence_bundles (
                bundle_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                queue_task_id TEXT NOT NULL REFERENCES agent_queue_tasks(queue_item_id) ON DELETE CASCADE,
                run_id TEXT NOT NULL,
                run_link_id TEXT NULL REFERENCES agent_queue_task_run_links(link_id) ON DELETE SET NULL,
                executor_widget_id TEXT NULL REFERENCES widget_instances(id) ON DELETE SET NULL,
                worker_id TEXT NULL,
                source TEXT NOT NULL,
                outcome TEXT NOT NULL,
                summary TEXT NOT NULL,
                changed_files_json TEXT NOT NULL,
                changed_files_count INTEGER NOT NULL DEFAULT 0,
                changed_files_summary TEXT NULL,
                validation_summary TEXT NULL,
                error_summary TEXT NULL,
                metadata_json TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(workspace_id, queue_task_id, run_id)
            );

            INSERT INTO agent_queue_worker_evidence_bundles (
                bundle_id, workspace_id, queue_task_id, run_id, run_link_id,
                executor_widget_id, worker_id, source, outcome, summary,
                changed_files_json, changed_files_count, changed_files_summary,
                validation_summary, error_summary, metadata_json, created_at, updated_at
            )
            SELECT
                bundle_id, workspace_id, queue_task_id, run_id, run_link_id,
                executor_widget_id, worker_id, source, outcome, summary,
                changed_files_json, changed_files_count, changed_files_summary,
                validation_summary, error_summary, metadata_json, created_at, updated_at
            FROM agent_queue_worker_evidence_bundles_legacy;

            DROP TABLE agent_queue_worker_evidence_bundles_legacy;
            "#,
        );
        let restore = self.connection.pragma_update(None, "foreign_keys", "ON");
        migration?;
        restore?;
        Ok(())
    }

    fn upgrade_agent_queue_review_messages_backend_owned_schema(&self) -> Result<()> {
        let mut statement = self
            .connection
            .prepare("PRAGMA foreign_key_list(agent_queue_review_messages)")?;
        let has_widget_run_fk = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })?
            .collect::<Result<Vec<_>>>()?
            .iter()
            .any(|(table, from, to)| table == "widget_runs" && from == "run_id" && to == "id");
        if !has_widget_run_fk {
            return Ok(());
        }
        drop(statement);

        self.connection.pragma_update(None, "foreign_keys", "OFF")?;
        let migration = self.connection.execute_batch(
            r#"
            ALTER TABLE agent_queue_review_messages
                RENAME TO agent_queue_review_messages_legacy;

            CREATE TABLE agent_queue_review_messages (
                message_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                queue_task_id TEXT NOT NULL REFERENCES agent_queue_tasks(queue_item_id) ON DELETE CASCADE,
                run_id TEXT NULL,
                run_link_id TEXT NULL REFERENCES agent_queue_task_run_links(link_id) ON DELETE SET NULL,
                actor_id TEXT NOT NULL,
                message_body TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                acked_at TEXT NULL,
                ack_actor_id TEXT NULL,
                metadata_json TEXT NULL,
                updated_at TEXT NOT NULL
            );

            INSERT INTO agent_queue_review_messages (
                message_id, workspace_id, queue_task_id, run_id, run_link_id,
                actor_id, message_body, status, created_at, acked_at, ack_actor_id,
                metadata_json, updated_at
            )
            SELECT
                message_id, workspace_id, queue_task_id, run_id, run_link_id,
                actor_id, message_body, status, created_at, acked_at, ack_actor_id,
                metadata_json, updated_at
            FROM agent_queue_review_messages_legacy;

            DROP TABLE agent_queue_review_messages_legacy;
            "#,
        );
        let restore = self.connection.pragma_update(None, "foreign_keys", "ON");
        migration?;
        restore?;
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

    fn upgrade_agent_queue_task_run_links_backend_owned_schema(&self) -> Result<()> {
        let mut statement = self
            .connection
            .prepare("PRAGMA foreign_key_list(agent_queue_task_run_links)")?;
        let foreign_tables = statement
            .query_map([], |row| row.get::<_, String>(2))?
            .collect::<Result<Vec<_>>>()?;
        if !foreign_tables
            .iter()
            .any(|table| table == "widget_instances" || table == "widget_runs")
        {
            return Ok(());
        }
        drop(statement);

        self.connection.pragma_update(None, "foreign_keys", "OFF")?;
        let migration = self.connection.execute_batch(
            r#"
            ALTER TABLE agent_queue_task_run_links RENAME TO agent_queue_task_run_links_legacy;

            CREATE TABLE agent_queue_task_run_links (
                link_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id),
                queue_task_id TEXT NOT NULL REFERENCES agent_queue_tasks(queue_item_id) ON DELETE CASCADE,
                executor_widget_id TEXT NOT NULL,
                direct_work_run_id TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT NULL,
                validation_status TEXT NULL,
                review_status TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            INSERT INTO agent_queue_task_run_links (
                link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                source, status, started_at, completed_at, validation_status, review_status,
                created_at, updated_at
            )
            SELECT
                link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                source, status, started_at, completed_at, validation_status, review_status,
                created_at, updated_at
            FROM agent_queue_task_run_links_legacy;

            DROP TABLE agent_queue_task_run_links_legacy;
            "#,
        );
        let restore = self.connection.pragma_update(None, "foreign_keys", "ON");
        migration?;
        restore?;
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
