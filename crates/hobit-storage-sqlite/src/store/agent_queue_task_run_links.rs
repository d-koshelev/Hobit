use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{AgentQueueTaskRunLinkFinalUpdate, NewAgentQueueTaskRunLink};
use crate::mappers::agent_queue_task_run_link_row;
use crate::rows::AgentQueueTaskRunLinkRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_task_run_link(
        &self,
        input: NewAgentQueueTaskRunLink<'_>,
    ) -> Result<AgentQueueTaskRunLinkRow> {
        let started_at = input
            .started_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(|| started_at.clone());
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_task_run_links (
                link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                source, status, started_at, completed_at, validation_status, review_status,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                input.link_id,
                input.workspace_id,
                input.queue_task_id,
                input.executor_widget_id,
                input.direct_work_run_id,
                input.source,
                input.status,
                started_at,
                input.completed_at,
                input.validation_status,
                input.review_status,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_task_run_link(input.workspace_id, input.link_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_task_run_link(
        &self,
        workspace_id: &str,
        link_id: &str,
    ) -> Result<Option<AgentQueueTaskRunLinkRow>> {
        self.connection
            .query_row(
                "SELECT
                    link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                    source, status, started_at, completed_at, validation_status, review_status,
                    created_at, updated_at
                 FROM agent_queue_task_run_links
                 WHERE workspace_id = ?1 AND link_id = ?2",
                params![workspace_id, link_id],
                agent_queue_task_run_link_row,
            )
            .optional()
    }

    pub fn list_agent_queue_task_run_links(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Vec<AgentQueueTaskRunLinkRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                source, status, started_at, completed_at, validation_status, review_status,
                created_at, updated_at
             FROM agent_queue_task_run_links
             WHERE workspace_id = ?1 AND queue_task_id = ?2
             ORDER BY started_at DESC, created_at DESC, link_id DESC",
        )?;

        let rows = statement.query_map(
            params![workspace_id, queue_task_id],
            agent_queue_task_run_link_row,
        )?;
        rows.collect()
    }

    pub fn get_latest_agent_queue_task_run_link(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
    ) -> Result<Option<AgentQueueTaskRunLinkRow>> {
        self.connection
            .query_row(
                "SELECT
                    link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                    source, status, started_at, completed_at, validation_status, review_status,
                    created_at, updated_at
                 FROM agent_queue_task_run_links
                 WHERE workspace_id = ?1 AND queue_task_id = ?2
                 ORDER BY started_at DESC, created_at DESC, link_id DESC
                 LIMIT 1",
                params![workspace_id, queue_task_id],
                agent_queue_task_run_link_row,
            )
            .optional()
    }

    pub fn get_agent_queue_task_run_link_by_run_id(
        &self,
        workspace_id: &str,
        direct_work_run_id: &str,
    ) -> Result<Option<AgentQueueTaskRunLinkRow>> {
        self.connection
            .query_row(
                "SELECT
                    link_id, workspace_id, queue_task_id, executor_widget_id, direct_work_run_id,
                    source, status, started_at, completed_at, validation_status, review_status,
                    created_at, updated_at
                 FROM agent_queue_task_run_links
                 WHERE workspace_id = ?1 AND direct_work_run_id = ?2",
                params![workspace_id, direct_work_run_id],
                agent_queue_task_run_link_row,
            )
            .optional()
    }

    pub fn update_agent_queue_task_run_link_final_status(
        &self,
        workspace_id: &str,
        queue_task_id: &str,
        direct_work_run_id: &str,
        update: AgentQueueTaskRunLinkFinalUpdate<'_>,
    ) -> Result<Option<AgentQueueTaskRunLinkRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_task_run_links
             SET status = ?1,
                 completed_at = COALESCE(?2, completed_at),
                 validation_status = COALESCE(?3, validation_status),
                 review_status = COALESCE(?4, review_status),
                 updated_at = ?5
             WHERE workspace_id = ?6 AND queue_task_id = ?7 AND direct_work_run_id = ?8",
            params![
                update.status,
                update.completed_at,
                update.validation_status,
                update.review_status,
                updated_at,
                workspace_id,
                queue_task_id,
                direct_work_run_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_task_run_link_by_run_id(workspace_id, direct_work_run_id)
    }
}
