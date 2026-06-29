use rusqlite::{params, OptionalExtension, Result};

use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn get_dogfood_operator_workspace_binding(
        &self,
        canonical_root: &str,
    ) -> Result<Option<String>> {
        self.connection
            .query_row(
                "SELECT workspace_id
                 FROM dogfood_operator_workspace_bindings
                 WHERE canonical_root = ?1",
                params![canonical_root],
                |row| row.get(0),
            )
            .optional()
    }

    pub fn upsert_dogfood_operator_workspace_binding(
        &self,
        canonical_root: &str,
        workspace_id: &str,
    ) -> Result<()> {
        let now = now_precise_timestamp();
        self.connection.execute(
            "INSERT INTO dogfood_operator_workspace_bindings (
                canonical_root, workspace_id, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(canonical_root) DO UPDATE SET
                workspace_id = excluded.workspace_id,
                updated_at = excluded.updated_at",
            params![canonical_root, workspace_id, now, now],
        )?;
        Ok(())
    }
}
