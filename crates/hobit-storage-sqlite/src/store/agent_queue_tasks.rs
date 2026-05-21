use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{AgentQueueTaskUpdate, NewAgentQueueTask};
use crate::mappers::agent_queue_task_row;
use crate::rows::AgentQueueTaskRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

const DEFAULT_AGENT_QUEUE_TASK_EXECUTION_POLICY: &str = "manual";

impl SqliteStore {
    pub fn create_agent_queue_task(
        &self,
        input: NewAgentQueueTask<'_>,
    ) -> Result<AgentQueueTaskRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        let execution_policy = input
            .execution_policy
            .unwrap_or(DEFAULT_AGENT_QUEUE_TASK_EXECUTION_POLICY);

        self.connection.execute(
            "INSERT INTO agent_queue_tasks (
                queue_item_id, workspace_id, title, description, prompt, status,
                priority, execution_policy, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                input.queue_item_id,
                input.workspace_id,
                input.title,
                input.description,
                input.prompt,
                input.status,
                input.priority,
                execution_policy,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_task(input.workspace_id, input.queue_item_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_agent_queue_tasks(&self, workspace_id: &str) -> Result<Vec<AgentQueueTaskRow>> {
        let mut statement = self.connection.prepare(
            "SELECT queue_item_id, workspace_id, title, description, prompt, status,
                priority, execution_policy, assigned_executor_widget_id, created_at, updated_at
             FROM agent_queue_tasks
             WHERE workspace_id = ?1
             ORDER BY priority DESC, updated_at DESC, created_at DESC, queue_item_id DESC",
        )?;

        let rows = statement.query_map(params![workspace_id], agent_queue_task_row)?;
        rows.collect()
    }

    pub fn get_agent_queue_task(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
    ) -> Result<Option<AgentQueueTaskRow>> {
        self.connection
            .query_row(
                "SELECT queue_item_id, workspace_id, title, description, prompt,
                    status, priority, execution_policy, assigned_executor_widget_id, created_at, updated_at
                 FROM agent_queue_tasks
                 WHERE workspace_id = ?1 AND queue_item_id = ?2",
                params![workspace_id, queue_item_id],
                agent_queue_task_row,
            )
            .optional()
    }

    pub fn get_agent_queue_task_by_id(
        &self,
        queue_item_id: &str,
    ) -> Result<Option<AgentQueueTaskRow>> {
        self.connection
            .query_row(
                "SELECT queue_item_id, workspace_id, title, description, prompt,
                    status, priority, execution_policy, assigned_executor_widget_id, created_at, updated_at
                 FROM agent_queue_tasks
                 WHERE queue_item_id = ?1",
                params![queue_item_id],
                agent_queue_task_row,
            )
            .optional()
    }

    pub fn update_agent_queue_task(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
        update: AgentQueueTaskUpdate<'_>,
    ) -> Result<Option<AgentQueueTaskRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_tasks
             SET title = ?1, description = ?2, prompt = ?3, status = ?4,
                priority = ?5, execution_policy = COALESCE(?6, execution_policy),
                updated_at = ?7
             WHERE workspace_id = ?8 AND queue_item_id = ?9",
            params![
                update.title,
                update.description,
                update.prompt,
                update.status,
                update.priority,
                update.execution_policy,
                updated_at,
                workspace_id,
                queue_item_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_task(workspace_id, queue_item_id)
    }

    pub fn update_agent_queue_task_status(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
        status: &str,
        updated_at: Option<&str>,
    ) -> Result<Option<AgentQueueTaskRow>> {
        let updated_at = updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_tasks
             SET status = ?1, updated_at = ?2
             WHERE workspace_id = ?3 AND queue_item_id = ?4",
            params![status, updated_at, workspace_id, queue_item_id],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_task(workspace_id, queue_item_id)
    }

    pub fn assign_agent_queue_task_to_executor(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
        executor_widget_instance_id: &str,
        updated_at: Option<&str>,
    ) -> Result<Option<AgentQueueTaskRow>> {
        let updated_at = updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_tasks
             SET assigned_executor_widget_id = ?1, updated_at = ?2
             WHERE workspace_id = ?3 AND queue_item_id = ?4",
            params![
                executor_widget_instance_id,
                updated_at,
                workspace_id,
                queue_item_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_task(workspace_id, queue_item_id)
    }

    pub fn clear_agent_queue_task_assignment(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
        updated_at: Option<&str>,
    ) -> Result<Option<AgentQueueTaskRow>> {
        let updated_at = updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_tasks
             SET assigned_executor_widget_id = NULL, updated_at = ?1
             WHERE workspace_id = ?2 AND queue_item_id = ?3",
            params![updated_at, workspace_id, queue_item_id],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_task(workspace_id, queue_item_id)
    }

    pub fn delete_agent_queue_task(&self, workspace_id: &str, queue_item_id: &str) -> Result<bool> {
        let affected_rows = self.connection.execute(
            "DELETE FROM agent_queue_tasks
             WHERE workspace_id = ?1 AND queue_item_id = ?2",
            params![workspace_id, queue_item_id],
        )?;

        Ok(affected_rows > 0)
    }
}
