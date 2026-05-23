use std::collections::HashMap;

use rusqlite::{params, params_from_iter, OptionalExtension, Result, ToSql};

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

    pub fn count_widget_logs_for_run(
        &self,
        run_id: &str,
        widget_instance_id: &str,
    ) -> Result<usize> {
        let count = self.connection.query_row(
            "SELECT COUNT(*)
             FROM widget_logs
             WHERE run_id = ?1 AND widget_instance_id = ?2",
            params![run_id, widget_instance_id],
            |row| row.get::<_, i64>(0),
        )?;

        Ok(count as usize)
    }

    pub fn count_widget_logs_for_runs_by_widget(
        &self,
        run_ids: &[String],
        widget_instance_id: &str,
    ) -> Result<HashMap<String, usize>> {
        if run_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let placeholders = std::iter::repeat("?")
            .take(run_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT run_id, COUNT(*)
             FROM widget_logs
             WHERE widget_instance_id = ? AND run_id IN ({placeholders})
             GROUP BY run_id"
        );
        let mut statement = self.connection.prepare(&sql)?;
        let mut query_params: Vec<&dyn ToSql> = Vec::with_capacity(run_ids.len() + 1);
        query_params.push(&widget_instance_id);
        for run_id in run_ids {
            query_params.push(run_id);
        }

        let rows = statement.query_map(params_from_iter(query_params), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as usize))
        })?;

        rows.collect()
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
