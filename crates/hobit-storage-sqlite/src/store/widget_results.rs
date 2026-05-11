use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewWidgetResult;
use crate::mappers::widget_result_row;
use crate::rows::WidgetResultRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_widget_result(&self, input: NewWidgetResult<'_>) -> Result<WidgetResultRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_results (
                id, run_id, status, result_type, summary, content, payload, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.id,
                input.run_id,
                input.status,
                input.result_type.unwrap_or("generic"),
                input.summary,
                input.content,
                input.payload,
                created_at,
            ],
        )?;

        self.get_widget_result(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_result(&self, id: &str) -> Result<Option<WidgetResultRow>> {
        self.connection
            .query_row(
                "SELECT id, run_id, status, result_type, summary, content, payload, created_at
                 FROM widget_results
                 WHERE id = ?1",
                params![id],
                widget_result_row,
            )
            .optional()
    }

    pub fn list_widget_results(&self, run_id: &str) -> Result<Vec<WidgetResultRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, run_id, status, result_type, summary, content, payload, created_at
             FROM widget_results
             WHERE run_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![run_id], widget_result_row)?;
        rows.collect()
    }
}
