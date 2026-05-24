use std::collections::HashMap;

use rusqlite::{params, params_from_iter, OptionalExtension, Result, ToSql};

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

    pub fn list_latest_widget_results_for_runs_by_type(
        &self,
        run_ids: &[String],
        result_types: &[&str],
    ) -> Result<HashMap<String, WidgetResultRow>> {
        if run_ids.is_empty() || result_types.is_empty() {
            return Ok(HashMap::new());
        }

        let mut latest_results = HashMap::new();
        for run_chunk in run_ids.chunks(500) {
            let run_placeholders = std::iter::repeat("?")
                .take(run_chunk.len())
                .collect::<Vec<_>>()
                .join(", ");
            let type_placeholders = std::iter::repeat("?")
                .take(result_types.len())
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!(
                "SELECT id, run_id, status, result_type, summary, content, payload, created_at
                 FROM widget_results
                 WHERE run_id IN ({run_placeholders})
                   AND result_type IN ({type_placeholders})
                 ORDER BY run_id, created_at, id"
            );
            let mut statement = self.connection.prepare(&sql)?;
            let mut query_params: Vec<&dyn ToSql> =
                Vec::with_capacity(run_chunk.len() + result_types.len());
            for run_id in run_chunk {
                query_params.push(run_id);
            }
            for result_type in result_types {
                query_params.push(result_type);
            }

            let rows = statement.query_map(params_from_iter(query_params), widget_result_row)?;
            for row in rows {
                let result = row?;
                latest_results.insert(result.run_id.clone(), result);
            }
        }

        Ok(latest_results)
    }
}
