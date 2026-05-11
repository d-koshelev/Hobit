use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewSharedStateObject;
use crate::mappers::shared_state_object_row;
use crate::rows::SharedStateObjectRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
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
}
