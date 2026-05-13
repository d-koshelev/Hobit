use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::NewWidgetLog;
use crate::mappers::widget_log_row;
use crate::rows::WidgetLogRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn append_widget_log(&self, input: NewWidgetLog<'_>) -> Result<WidgetLogRow> {
        let created_at = input
            .created_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_logs (
                id, widget_instance_id, run_id, level, message, created_at, details
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                input.id,
                input.widget_instance_id,
                input.run_id,
                input.level,
                input.message,
                created_at,
                input.details,
            ],
        )?;

        self.get_widget_log(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_log(&self, id: &str) -> Result<Option<WidgetLogRow>> {
        self.connection
            .query_row(
                "SELECT id, widget_instance_id, run_id, level, message, created_at, details
                 FROM widget_logs
                 WHERE id = ?1",
                params![id],
                widget_log_row,
            )
            .optional()
    }

    pub fn list_widget_logs(&self, run_id: &str) -> Result<Vec<WidgetLogRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, widget_instance_id, run_id, level, message, created_at, details
             FROM widget_logs
             WHERE run_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![run_id], widget_log_row)?;
        rows.collect()
    }

    pub fn list_recent_widget_logs_for_run(
        &self,
        run_id: &str,
        limit: usize,
    ) -> Result<Vec<WidgetLogRow>> {
        let limit = limit.min(i64::MAX as usize) as i64;
        let mut statement = self.connection.prepare(
            "SELECT id, widget_instance_id, run_id, level, message, created_at, details
             FROM widget_logs
             WHERE run_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT ?2",
        )?;

        let rows = statement.query_map(params![run_id, limit], widget_log_row)?;
        let mut logs: Vec<_> = rows.collect::<Result<Vec<_>>>()?;
        logs.reverse();
        Ok(logs)
    }

    pub fn list_widget_logs_for_widget(
        &self,
        widget_instance_id: &str,
        limit: usize,
    ) -> Result<Vec<WidgetLogRow>> {
        let limit = limit.min(i64::MAX as usize) as i64;
        let mut statement = self.connection.prepare(
            "SELECT id, widget_instance_id, run_id, level, message, created_at, details
             FROM widget_logs
             WHERE widget_instance_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT ?2",
        )?;

        let rows = statement.query_map(params![widget_instance_id, limit], widget_log_row)?;
        let mut logs: Vec<_> = rows.collect::<Result<Vec<_>>>()?;
        logs.reverse();
        Ok(logs)
    }
}
