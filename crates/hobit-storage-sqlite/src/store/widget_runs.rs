use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{NewWidgetRun, WidgetRunFinishUpdate};
use crate::mappers::widget_run_row;
use crate::rows::WidgetRunRow;
use crate::time::now_timestamp;

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_widget_run(&self, input: NewWidgetRun<'_>) -> Result<WidgetRunRow> {
        let started_at = input
            .started_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        self.connection.execute(
            "INSERT INTO widget_runs (
                id, widget_instance_id, status, command_kind, command_payload,
                started_at, finished_at, summary
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.id,
                input.widget_instance_id,
                input.status,
                input.command_kind,
                input.command_payload,
                started_at,
                input.finished_at,
                input.summary,
            ],
        )?;

        self.get_widget_run(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_run(&self, id: &str) -> Result<Option<WidgetRunRow>> {
        self.connection
            .query_row(
                "SELECT
                    id, widget_instance_id, status, command_kind, command_payload,
                    started_at, finished_at, summary
                 FROM widget_runs
                 WHERE id = ?1",
                params![id],
                widget_run_row,
            )
            .optional()
    }

    pub fn list_widget_runs_for_widget(
        &self,
        widget_instance_id: &str,
    ) -> Result<Vec<WidgetRunRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                id, widget_instance_id, status, command_kind, command_payload,
                started_at, finished_at, summary
             FROM widget_runs
             WHERE widget_instance_id = ?1
             ORDER BY started_at, id",
        )?;

        let rows = statement.query_map(params![widget_instance_id], widget_run_row)?;
        rows.collect()
    }

    pub fn finish_widget_run(
        &self,
        run_id: &str,
        update: WidgetRunFinishUpdate<'_>,
    ) -> Result<WidgetRunRow> {
        let finished_at = update
            .finished_at
            .map(str::to_owned)
            .unwrap_or_else(now_timestamp);

        let affected_rows = self.connection.execute(
            "UPDATE widget_runs
             SET status = ?1,
                 finished_at = ?2,
                 summary = COALESCE(?3, summary)
             WHERE id = ?4",
            params![update.status, finished_at, update.summary, run_id],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        self.get_widget_run(run_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }
}
