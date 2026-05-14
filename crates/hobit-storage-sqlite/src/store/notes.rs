use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{NewWorkspaceNote, WorkspaceNoteUpdate};
use crate::mappers::{bool_to_i64, workspace_note_row};
use crate::rows::WorkspaceNoteRow;
use crate::time::now_precise_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn create_note(&self, input: NewWorkspaceNote<'_>) -> Result<WorkspaceNoteRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let updated_at = input
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(|| created_at.clone());

        self.connection.execute(
            "INSERT INTO notes (
                note_id, workspace_id, title, body, pinned, archived, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.note_id,
                input.workspace_id,
                input.title,
                input.body,
                bool_to_i64(input.pinned),
                bool_to_i64(input.archived),
                created_at,
                updated_at,
            ],
        )?;

        self.get_note(input.workspace_id, input.note_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn list_notes_for_workspace(&self, workspace_id: &str) -> Result<Vec<WorkspaceNoteRow>> {
        let mut statement = self.connection.prepare(
            "SELECT note_id, workspace_id, title, body, pinned, archived, created_at, updated_at
             FROM notes
             WHERE workspace_id = ?1 AND archived = 0
             ORDER BY pinned DESC, updated_at DESC, created_at DESC, note_id DESC",
        )?;

        let rows = statement.query_map(params![workspace_id], workspace_note_row)?;
        rows.collect()
    }

    pub fn get_note(&self, workspace_id: &str, note_id: &str) -> Result<Option<WorkspaceNoteRow>> {
        self.connection
            .query_row(
                "SELECT note_id, workspace_id, title, body, pinned, archived, created_at, updated_at
                 FROM notes
                 WHERE workspace_id = ?1 AND note_id = ?2",
                params![workspace_id, note_id],
                workspace_note_row,
            )
            .optional()
    }

    pub fn get_note_by_id(&self, note_id: &str) -> Result<Option<WorkspaceNoteRow>> {
        self.connection
            .query_row(
                "SELECT note_id, workspace_id, title, body, pinned, archived, created_at, updated_at
                 FROM notes
                 WHERE note_id = ?1",
                params![note_id],
                workspace_note_row,
            )
            .optional()
    }

    pub fn update_note(
        &self,
        workspace_id: &str,
        note_id: &str,
        update: WorkspaceNoteUpdate<'_>,
    ) -> Result<Option<WorkspaceNoteRow>> {
        let updated_at = update
            .updated_at
            .map(str::to_owned)
            .unwrap_or_else(now_precise_timestamp);
        let affected_rows = self.connection.execute(
            "UPDATE notes
             SET title = ?1, body = ?2, pinned = ?3, updated_at = ?4
             WHERE workspace_id = ?5 AND note_id = ?6",
            params![
                update.title,
                update.body,
                bool_to_i64(update.pinned),
                updated_at,
                workspace_id,
                note_id,
            ],
        )?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_note(workspace_id, note_id)
    }
}
