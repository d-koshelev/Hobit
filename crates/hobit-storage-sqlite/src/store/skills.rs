use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{NewSkill, SkillUpdate};
use crate::mappers::skill_row;
use crate::rows::SkillRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn create_skill(&self, input: NewSkill<'_>) -> Result<SkillRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO skills (
                skill_id, workspace_id, title, when_to_use, prerequisites, steps,
                validation, risks, tags, review_status, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                input.skill_id,
                input.workspace_id,
                input.title,
                input.when_to_use,
                input.prerequisites,
                input.steps,
                input.validation,
                input.risks,
                input.tags,
                input.review_status,
                created_at,
                updated_at,
            ],
        )?;

        self.get_skill(input.workspace_id, input.skill_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_skills_for_workspace(&self, workspace_id: &str) -> Result<Vec<SkillRow>> {
        let mut statement = self.connection.prepare(
            "SELECT skill_id, workspace_id, title, when_to_use, prerequisites, steps,
                    validation, risks, tags, review_status, created_at, updated_at
             FROM skills
             WHERE workspace_id = ?1
             ORDER BY updated_at DESC, created_at DESC, skill_id DESC",
        )?;

        let rows = statement.query_map(params![workspace_id], skill_row)?;
        rows.collect()
    }

    pub fn get_skill(&self, workspace_id: &str, skill_id: &str) -> Result<Option<SkillRow>> {
        self.connection
            .query_row(
                "SELECT skill_id, workspace_id, title, when_to_use, prerequisites, steps,
                        validation, risks, tags, review_status, created_at, updated_at
                 FROM skills
                 WHERE workspace_id = ?1 AND skill_id = ?2",
                params![workspace_id, skill_id],
                skill_row,
            )
            .optional()
    }

    pub fn get_skill_by_id(&self, skill_id: &str) -> Result<Option<SkillRow>> {
        self.connection
            .query_row(
                "SELECT skill_id, workspace_id, title, when_to_use, prerequisites, steps,
                        validation, risks, tags, review_status, created_at, updated_at
                 FROM skills
                 WHERE skill_id = ?1",
                params![skill_id],
                skill_row,
            )
            .optional()
    }

    pub fn update_skill(
        &self,
        workspace_id: &str,
        skill_id: &str,
        update: SkillUpdate<'_>,
    ) -> Result<Option<SkillRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE skills
             SET title = ?1,
                 when_to_use = ?2,
                 prerequisites = ?3,
                 steps = ?4,
                 validation = ?5,
                 risks = ?6,
                 tags = ?7,
                 review_status = ?8,
                 updated_at = ?9
             WHERE workspace_id = ?10 AND skill_id = ?11",
            params![
                update.title,
                update.when_to_use,
                update.prerequisites,
                update.steps,
                update.validation,
                update.risks,
                update.tags,
                update.review_status,
                updated_at,
                workspace_id,
                skill_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_skill(workspace_id, skill_id)
    }

    pub fn delete_skill(&self, workspace_id: &str, skill_id: &str) -> Result<bool> {
        let affected_rows = self.connection.execute(
            "DELETE FROM skills
             WHERE workspace_id = ?1 AND skill_id = ?2",
            params![workspace_id, skill_id],
        )?;

        Ok(affected_rows > 0)
    }
}
