use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{NewAgentQueuePromptPackMaterialization, NewAgentQueuePromptPackTaskMapping};
use crate::mappers::{
    agent_queue_prompt_pack_materialization_row, agent_queue_prompt_pack_task_mapping_row,
};
use crate::rows::{AgentQueuePromptPackMaterializationRow, AgentQueuePromptPackTaskMappingRow};
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_agent_queue_prompt_pack_materialization(
        &self,
        input: NewAgentQueuePromptPackMaterialization<'_>,
    ) -> Result<AgentQueuePromptPackMaterializationRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_prompt_pack_materializations (
                workspace_id, pack_id, title, description, pack_spec_hash,
                run_settings_hash, dependency_spec_hash, full_preview_hash,
                task_count, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                input.workspace_id,
                input.pack_id,
                input.title,
                input.description,
                input.pack_spec_hash,
                input.run_settings_hash,
                input.dependency_spec_hash,
                input.full_preview_hash,
                input.task_count,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_prompt_pack_materialization(input.workspace_id, input.pack_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_prompt_pack_materialization(
        &self,
        workspace_id: &str,
        pack_id: &str,
    ) -> Result<Option<AgentQueuePromptPackMaterializationRow>> {
        let sql =
            prompt_pack_materialization_select_sql("WHERE workspace_id = ?1 AND pack_id = ?2");
        self.connection
            .query_row(
                &sql,
                params![workspace_id, pack_id],
                agent_queue_prompt_pack_materialization_row,
            )
            .optional()
    }

    pub fn insert_agent_queue_prompt_pack_task_mapping(
        &self,
        input: NewAgentQueuePromptPackTaskMapping<'_>,
    ) -> Result<AgentQueuePromptPackTaskMappingRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO agent_queue_prompt_pack_task_mappings (
                workspace_id, pack_id, pack_task_id, queue_task_id,
                task_spec_hash, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.workspace_id,
                input.pack_id,
                input.pack_task_id,
                input.queue_task_id,
                input.task_spec_hash,
                created_at,
                updated_at,
            ],
        )?;

        self.get_agent_queue_prompt_pack_task_mapping(
            input.workspace_id,
            input.pack_id,
            input.pack_task_id,
        )?
        .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_agent_queue_prompt_pack_task_mapping(
        &self,
        workspace_id: &str,
        pack_id: &str,
        pack_task_id: &str,
    ) -> Result<Option<AgentQueuePromptPackTaskMappingRow>> {
        let sql = prompt_pack_task_mapping_select_sql(
            "WHERE workspace_id = ?1 AND pack_id = ?2 AND pack_task_id = ?3",
            "",
        );
        self.connection
            .query_row(
                &sql,
                params![workspace_id, pack_id, pack_task_id],
                agent_queue_prompt_pack_task_mapping_row,
            )
            .optional()
    }

    pub fn list_agent_queue_prompt_pack_task_mappings(
        &self,
        workspace_id: &str,
        pack_id: &str,
    ) -> Result<Vec<AgentQueuePromptPackTaskMappingRow>> {
        let sql = prompt_pack_task_mapping_select_sql(
            "WHERE workspace_id = ?1 AND pack_id = ?2",
            "ORDER BY pack_task_id ASC",
        );
        let mut statement = self.connection.prepare(&sql)?;
        let rows = statement.query_map(
            params![workspace_id, pack_id],
            agent_queue_prompt_pack_task_mapping_row,
        )?;
        rows.collect()
    }
}

fn prompt_pack_materialization_select_sql(where_clause: &str) -> String {
    format!(
        "SELECT workspace_id, pack_id, title, description, pack_spec_hash,
            run_settings_hash, dependency_spec_hash, full_preview_hash,
            task_count, created_at, updated_at
         FROM agent_queue_prompt_pack_materializations
         {where_clause}"
    )
}

fn prompt_pack_task_mapping_select_sql(where_clause: &str, order_clause: &str) -> String {
    format!(
        "SELECT workspace_id, pack_id, pack_task_id, queue_task_id,
            task_spec_hash, created_at, updated_at
         FROM agent_queue_prompt_pack_task_mappings
         {where_clause}
         {order_clause}"
    )
}
