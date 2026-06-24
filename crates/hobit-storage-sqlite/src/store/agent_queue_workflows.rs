use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{
    AgentQueueWorkflowActionUpdate, AgentQueueWorkflowRunReportUpdate,
    AgentQueueWorkflowRunStatusUpdate, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun,
};
use crate::mappers::{agent_queue_workflow_action_row, agent_queue_workflow_run_row};
use crate::rows::{AgentQueueWorkflowActionRow, AgentQueueWorkflowRunRow};
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_workflow_run(
        &self,
        input: NewAgentQueueWorkflowRun<'_>,
    ) -> Result<AgentQueueWorkflowRunRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_workflow_runs (
                workflow_run_id, workspace_id, workflow_id, request_id, request_hash,
                status, phase, current_step, pause_reason, blocker_reason, actor_id,
                inputs_snapshot_json, grant_summary_json, variables_json, slot_bindings_json,
                mutation_refs_json, idempotency_keys_json, action_log_summary_json,
                version, schema_version, created_at, updated_at, completed_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23
            )",
            params![
                input.workflow_run_id,
                input.workspace_id,
                input.workflow_id,
                input.request_id,
                input.request_hash,
                input.status,
                input.phase,
                input.current_step,
                input.pause_reason,
                input.blocker_reason,
                input.actor_id,
                input.inputs_snapshot_json,
                input.grant_summary_json,
                input.variables_json,
                input.slot_bindings_json,
                input.mutation_refs_json,
                input.idempotency_keys_json,
                input.action_log_summary_json,
                input.version,
                input.schema_version,
                created_at,
                updated_at,
                input.completed_at,
            ],
        )?;

        self.get_agent_queue_workflow_run(input.workspace_id, input.workflow_run_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_workflow_run(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
    ) -> Result<Option<AgentQueueWorkflowRunRow>> {
        self.connection
            .query_row(
                workflow_run_select_sql("WHERE workspace_id = ?1 AND workflow_run_id = ?2", ""),
                params![workspace_id, workflow_run_id],
                agent_queue_workflow_run_row,
            )
            .optional()
    }

    pub fn get_agent_queue_workflow_run_by_request(
        &self,
        workspace_id: &str,
        request_id: &str,
    ) -> Result<Option<AgentQueueWorkflowRunRow>> {
        self.connection
            .query_row(
                workflow_run_select_sql("WHERE workspace_id = ?1 AND request_id = ?2", ""),
                params![workspace_id, request_id],
                agent_queue_workflow_run_row,
            )
            .optional()
    }

    pub fn list_agent_queue_workflow_runs(
        &self,
        workspace_id: &str,
        status: Option<&str>,
        workflow_id: Option<&str>,
    ) -> Result<Vec<AgentQueueWorkflowRunRow>> {
        let mut statement = self.connection.prepare(workflow_run_select_sql(
            "WHERE workspace_id = ?1
             AND (?2 IS NULL OR status = ?2)
             AND (?3 IS NULL OR workflow_id = ?3)",
            "ORDER BY updated_at DESC, created_at DESC, workflow_run_id DESC",
        ))?;
        let rows = statement.query_map(
            params![workspace_id, status, workflow_id],
            agent_queue_workflow_run_row,
        )?;
        rows.collect()
    }

    pub fn update_agent_queue_workflow_run_status(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
        update: AgentQueueWorkflowRunStatusUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkflowRunRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_workflow_runs
             SET status = ?1,
                 phase = COALESCE(?2, phase),
                 current_step = COALESCE(?3, current_step),
                 pause_reason = COALESCE(?4, pause_reason),
                 blocker_reason = COALESCE(?5, blocker_reason),
                 completed_at = COALESCE(?6, completed_at),
                 updated_at = ?7,
                 version = version + 1
             WHERE workspace_id = ?8 AND workflow_run_id = ?9",
            params![
                update.status,
                update.phase,
                update.current_step,
                update.pause_reason,
                update.blocker_reason,
                update.completed_at,
                updated_at,
                workspace_id,
                workflow_run_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_workflow_run(workspace_id, workflow_run_id)
    }

    pub fn update_agent_queue_workflow_run_report(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
        update: AgentQueueWorkflowRunReportUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkflowRunRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_workflow_runs
             SET status = ?1,
                 phase = COALESCE(?2, phase),
                 current_step = COALESCE(?3, current_step),
                 pause_reason = COALESCE(?4, pause_reason),
                 blocker_reason = COALESCE(?5, blocker_reason),
                 variables_json = COALESCE(?6, variables_json),
                 slot_bindings_json = COALESCE(?7, slot_bindings_json),
                 mutation_refs_json = COALESCE(?8, mutation_refs_json),
                 idempotency_keys_json = COALESCE(?9, idempotency_keys_json),
                 action_log_summary_json = COALESCE(?10, action_log_summary_json),
                 completed_at = COALESCE(?11, completed_at),
                 updated_at = ?12,
                 version = version + 1
             WHERE workspace_id = ?13 AND workflow_run_id = ?14",
            params![
                update.status,
                update.phase,
                update.current_step,
                update.pause_reason,
                update.blocker_reason,
                update.variables_json,
                update.slot_bindings_json,
                update.mutation_refs_json,
                update.idempotency_keys_json,
                update.action_log_summary_json,
                update.completed_at,
                updated_at,
                workspace_id,
                workflow_run_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_workflow_run(workspace_id, workflow_run_id)
    }

    pub fn update_agent_queue_workflow_run_report_reopened(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
        update: AgentQueueWorkflowRunReportUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkflowRunRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_workflow_runs
             SET status = ?1,
                 phase = ?2,
                 current_step = ?3,
                 pause_reason = ?4,
                 blocker_reason = NULL,
                 variables_json = COALESCE(?5, variables_json),
                 slot_bindings_json = COALESCE(?6, slot_bindings_json),
                 mutation_refs_json = COALESCE(?7, mutation_refs_json),
                 idempotency_keys_json = COALESCE(?8, idempotency_keys_json),
                 action_log_summary_json = COALESCE(?9, action_log_summary_json),
                 completed_at = NULL,
                 updated_at = ?10,
                 version = version + 1
             WHERE workspace_id = ?11 AND workflow_run_id = ?12",
            params![
                update.status,
                update.phase,
                update.current_step,
                update.pause_reason,
                update.variables_json,
                update.slot_bindings_json,
                update.mutation_refs_json,
                update.idempotency_keys_json,
                update.action_log_summary_json,
                updated_at,
                workspace_id,
                workflow_run_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_workflow_run(workspace_id, workflow_run_id)
    }

    pub fn insert_agent_queue_workflow_action(
        &self,
        input: NewAgentQueueWorkflowAction<'_>,
    ) -> Result<AgentQueueWorkflowActionRow> {
        let parent = self
            .get_agent_queue_workflow_run_by_id(input.workflow_run_id)?
            .ok_or_else(|| {
                rusqlite::Error::InvalidParameterName(format!(
                    "workflow run not found: {}",
                    input.workflow_run_id
                ))
            })?;
        if parent.workspace_id != input.workspace_id {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "workflow action workspace_id does not match parent run: {}",
                input.workflow_run_id
            )));
        }

        if let Some(existing) = self.get_agent_queue_workflow_action_by_idempotency_key(
            input.workflow_run_id,
            input.idempotency_key,
        )? {
            if workflow_action_matches_input(&existing, &input) {
                return Ok(existing);
            }

            return Err(rusqlite::Error::InvalidParameterName(format!(
                "conflicting workflow action idempotency key: {}",
                input.idempotency_key
            )));
        }

        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_workflow_actions (
                action_id, workflow_run_id, workspace_id, step_id, action_type,
                idempotency_key, status, target_refs_json, result_refs_json,
                blocker_code, blocker_message, attempt_count, started_at, completed_at,
                created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16
            )",
            params![
                input.action_id,
                input.workflow_run_id,
                input.workspace_id,
                input.step_id,
                input.action_type,
                input.idempotency_key,
                input.status,
                input.target_refs_json,
                input.result_refs_json,
                input.blocker_code,
                input.blocker_message,
                input.attempt_count,
                input.started_at,
                input.completed_at,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_workflow_action(input.workspace_id, input.action_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_workflow_action(
        &self,
        workspace_id: &str,
        action_id: &str,
    ) -> Result<Option<AgentQueueWorkflowActionRow>> {
        self.connection
            .query_row(
                workflow_action_select_sql("WHERE workspace_id = ?1 AND action_id = ?2", ""),
                params![workspace_id, action_id],
                agent_queue_workflow_action_row,
            )
            .optional()
    }

    pub fn get_agent_queue_workflow_action_by_idempotency_key(
        &self,
        workflow_run_id: &str,
        idempotency_key: &str,
    ) -> Result<Option<AgentQueueWorkflowActionRow>> {
        self.connection
            .query_row(
                workflow_action_select_sql(
                    "WHERE workflow_run_id = ?1 AND idempotency_key = ?2",
                    "",
                ),
                params![workflow_run_id, idempotency_key],
                agent_queue_workflow_action_row,
            )
            .optional()
    }

    pub fn list_agent_queue_workflow_actions(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
    ) -> Result<Vec<AgentQueueWorkflowActionRow>> {
        let mut statement = self.connection.prepare(workflow_action_select_sql(
            "WHERE workspace_id = ?1 AND workflow_run_id = ?2",
            "ORDER BY created_at ASC, action_id ASC",
        ))?;
        let rows = statement.query_map(
            params![workspace_id, workflow_run_id],
            agent_queue_workflow_action_row,
        )?;
        rows.collect()
    }

    pub fn update_agent_queue_workflow_action(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
        idempotency_key: &str,
        update: AgentQueueWorkflowActionUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkflowActionRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_workflow_actions
             SET status = ?1,
                 result_refs_json = COALESCE(?2, result_refs_json),
                 blocker_code = COALESCE(?3, blocker_code),
                 blocker_message = COALESCE(?4, blocker_message),
                 attempt_count = COALESCE(?5, attempt_count),
                 started_at = COALESCE(?6, started_at),
                 completed_at = COALESCE(?7, completed_at),
                 updated_at = ?8
             WHERE workspace_id = ?9
               AND workflow_run_id = ?10
               AND idempotency_key = ?11",
            params![
                update.status,
                update.result_refs_json,
                update.blocker_code,
                update.blocker_message,
                update.attempt_count,
                update.started_at,
                update.completed_at,
                updated_at,
                workspace_id,
                workflow_run_id,
                idempotency_key,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_workflow_action_by_idempotency_key(workflow_run_id, idempotency_key)
    }

    pub fn replace_agent_queue_workflow_action_resolution(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
        idempotency_key: &str,
        update: AgentQueueWorkflowActionUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkflowActionRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_workflow_actions
             SET status = ?1,
                 result_refs_json = ?2,
                 blocker_code = ?3,
                 blocker_message = ?4,
                 attempt_count = COALESCE(?5, attempt_count),
                 started_at = COALESCE(?6, started_at),
                 completed_at = COALESCE(?7, completed_at),
                 updated_at = ?8
             WHERE workspace_id = ?9
               AND workflow_run_id = ?10
               AND idempotency_key = ?11",
            params![
                update.status,
                update.result_refs_json,
                update.blocker_code,
                update.blocker_message,
                update.attempt_count,
                update.started_at,
                update.completed_at,
                updated_at,
                workspace_id,
                workflow_run_id,
                idempotency_key,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_workflow_action_by_idempotency_key(workflow_run_id, idempotency_key)
    }

    pub fn replace_agent_queue_workflow_action_refs_and_resolution(
        &self,
        workspace_id: &str,
        workflow_run_id: &str,
        idempotency_key: &str,
        target_refs_json: Option<&str>,
        update: AgentQueueWorkflowActionUpdate<'_>,
    ) -> Result<Option<AgentQueueWorkflowActionRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE agent_queue_workflow_actions
             SET target_refs_json = ?1,
                 status = ?2,
                 result_refs_json = ?3,
                 blocker_code = ?4,
                 blocker_message = ?5,
                 attempt_count = COALESCE(?6, attempt_count),
                 started_at = COALESCE(?7, started_at),
                 completed_at = COALESCE(?8, completed_at),
                 updated_at = ?9
              WHERE workspace_id = ?10
                AND workflow_run_id = ?11
                AND idempotency_key = ?12",
            params![
                target_refs_json,
                update.status,
                update.result_refs_json,
                update.blocker_code,
                update.blocker_message,
                update.attempt_count,
                update.started_at,
                update.completed_at,
                updated_at,
                workspace_id,
                workflow_run_id,
                idempotency_key,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_agent_queue_workflow_action_by_idempotency_key(workflow_run_id, idempotency_key)
    }

    fn get_agent_queue_workflow_run_by_id(
        &self,
        workflow_run_id: &str,
    ) -> Result<Option<AgentQueueWorkflowRunRow>> {
        self.connection
            .query_row(
                workflow_run_select_sql("WHERE workflow_run_id = ?1", ""),
                params![workflow_run_id],
                agent_queue_workflow_run_row,
            )
            .optional()
    }
}

fn workflow_run_select_sql(where_clause: &'static str, order_clause: &'static str) -> &'static str {
    match (where_clause, order_clause) {
        ("WHERE workspace_id = ?1 AND workflow_run_id = ?2", "") => {
            "SELECT
                workflow_run_id, workspace_id, workflow_id, request_id, request_hash,
                status, phase, current_step, pause_reason, blocker_reason, actor_id,
                inputs_snapshot_json, grant_summary_json, variables_json, slot_bindings_json,
                mutation_refs_json, idempotency_keys_json, action_log_summary_json,
                version, schema_version, created_at, updated_at, completed_at
             FROM agent_queue_workflow_runs
             WHERE workspace_id = ?1 AND workflow_run_id = ?2"
        }
        ("WHERE workspace_id = ?1 AND request_id = ?2", "") => {
            "SELECT
                workflow_run_id, workspace_id, workflow_id, request_id, request_hash,
                status, phase, current_step, pause_reason, blocker_reason, actor_id,
                inputs_snapshot_json, grant_summary_json, variables_json, slot_bindings_json,
                mutation_refs_json, idempotency_keys_json, action_log_summary_json,
                version, schema_version, created_at, updated_at, completed_at
             FROM agent_queue_workflow_runs
             WHERE workspace_id = ?1 AND request_id = ?2"
        }
        ("WHERE workspace_id = ?1\n             AND (?2 IS NULL OR status = ?2)\n             AND (?3 IS NULL OR workflow_id = ?3)", "ORDER BY updated_at DESC, created_at DESC, workflow_run_id DESC") => {
            "SELECT
                workflow_run_id, workspace_id, workflow_id, request_id, request_hash,
                status, phase, current_step, pause_reason, blocker_reason, actor_id,
                inputs_snapshot_json, grant_summary_json, variables_json, slot_bindings_json,
                mutation_refs_json, idempotency_keys_json, action_log_summary_json,
                version, schema_version, created_at, updated_at, completed_at
             FROM agent_queue_workflow_runs
             WHERE workspace_id = ?1
               AND (?2 IS NULL OR status = ?2)
               AND (?3 IS NULL OR workflow_id = ?3)
             ORDER BY updated_at DESC, created_at DESC, workflow_run_id DESC"
        }
        ("WHERE workflow_run_id = ?1", "") => {
            "SELECT
                workflow_run_id, workspace_id, workflow_id, request_id, request_hash,
                status, phase, current_step, pause_reason, blocker_reason, actor_id,
                inputs_snapshot_json, grant_summary_json, variables_json, slot_bindings_json,
                mutation_refs_json, idempotency_keys_json, action_log_summary_json,
                version, schema_version, created_at, updated_at, completed_at
             FROM agent_queue_workflow_runs
             WHERE workflow_run_id = ?1"
        }
        _ => unreachable!("unsupported workflow run query shape"),
    }
}

fn workflow_action_select_sql(
    where_clause: &'static str,
    order_clause: &'static str,
) -> &'static str {
    match (where_clause, order_clause) {
        ("WHERE workspace_id = ?1 AND action_id = ?2", "") => {
            "SELECT
                action_id, workflow_run_id, workspace_id, step_id, action_type,
                idempotency_key, status, target_refs_json, result_refs_json,
                blocker_code, blocker_message, attempt_count, started_at, completed_at,
                created_at, updated_at
             FROM agent_queue_workflow_actions
             WHERE workspace_id = ?1 AND action_id = ?2"
        }
        ("WHERE workflow_run_id = ?1 AND idempotency_key = ?2", "") => {
            "SELECT
                action_id, workflow_run_id, workspace_id, step_id, action_type,
                idempotency_key, status, target_refs_json, result_refs_json,
                blocker_code, blocker_message, attempt_count, started_at, completed_at,
                created_at, updated_at
             FROM agent_queue_workflow_actions
             WHERE workflow_run_id = ?1 AND idempotency_key = ?2"
        }
        (
            "WHERE workspace_id = ?1 AND workflow_run_id = ?2",
            "ORDER BY created_at ASC, action_id ASC",
        ) => {
            "SELECT
                action_id, workflow_run_id, workspace_id, step_id, action_type,
                idempotency_key, status, target_refs_json, result_refs_json,
                blocker_code, blocker_message, attempt_count, started_at, completed_at,
                created_at, updated_at
             FROM agent_queue_workflow_actions
             WHERE workspace_id = ?1 AND workflow_run_id = ?2
             ORDER BY created_at ASC, action_id ASC"
        }
        _ => unreachable!("unsupported workflow action query shape"),
    }
}

fn workflow_action_matches_input(
    existing: &AgentQueueWorkflowActionRow,
    input: &NewAgentQueueWorkflowAction<'_>,
) -> bool {
    existing.workspace_id == input.workspace_id
        && existing.workflow_run_id == input.workflow_run_id
        && existing.step_id == input.step_id
        && existing.action_type == input.action_type
        && existing.target_refs_json.as_deref() == input.target_refs_json
        && existing.result_refs_json.as_deref() == input.result_refs_json
}
