use rusqlite::{params, OptionalExtension, Result};

use crate::inputs::{NewWidgetInstance, WidgetInstanceLayoutUpdate};
use crate::mappers::{bool_to_i64, widget_instance_row};
use crate::rows::WidgetInstanceRow;
use crate::time::{now_precise_timestamp, now_timestamp};

use super::SqliteStore;

impl SqliteStore {
    pub fn insert_widget_instance(
        &self,
        input: NewWidgetInstance<'_>,
    ) -> Result<WidgetInstanceRow> {
        let now = now_timestamp();
        self.connection.execute(
            "INSERT INTO widget_instances (
                id, workspace_id, workbench_id, definition_id, title, category,
                layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                popout_y, popout_width, popout_height, always_on_top,
                is_visible, config, state, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                ?15, ?16, ?17, ?18, ?19, ?20, ?21
            )",
            params![
                input.id,
                input.workspace_id,
                input.workbench_id,
                input.definition_id,
                input.title,
                input.category,
                input.layout_mode,
                input.dock_x,
                input.dock_y,
                input.dock_width,
                input.dock_height,
                input.popout_x,
                input.popout_y,
                input.popout_width,
                input.popout_height,
                bool_to_i64(input.always_on_top),
                bool_to_i64(input.is_visible),
                input.config,
                input.state,
                now,
                now,
            ],
        )?;

        self.get_widget_instance(input.id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_widget_instance(&self, id: &str) -> Result<Option<WidgetInstanceRow>> {
        self.connection
            .query_row(
                "SELECT
                    id, workspace_id, workbench_id, definition_id, title, category,
                    layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                    popout_y, popout_width, popout_height, always_on_top,
                    is_visible, config, state, created_at, updated_at
                 FROM widget_instances
                 WHERE id = ?1",
                params![id],
                widget_instance_row,
            )
            .optional()
    }

    pub fn update_widget_instance_state(
        &self,
        widget_instance_id: &str,
        state: &str,
    ) -> Result<()> {
        let updated_at = now_precise_timestamp();
        let affected_rows = self.connection.execute(
            "UPDATE widget_instances
             SET state = ?1, updated_at = ?2
             WHERE id = ?3",
            params![state, updated_at, widget_instance_id],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok(())
    }

    pub fn update_widget_instance_layout(
        &self,
        widget_instance_id: &str,
        layout: WidgetInstanceLayoutUpdate<'_>,
    ) -> Result<()> {
        let updated_at = now_precise_timestamp();
        let affected_rows = self.connection.execute(
            "UPDATE widget_instances
             SET
                layout_mode = ?1,
                dock_x = ?2,
                dock_y = ?3,
                dock_width = ?4,
                dock_height = ?5,
                popout_x = ?6,
                popout_y = ?7,
                popout_width = ?8,
                popout_height = ?9,
                always_on_top = ?10,
                is_visible = ?11,
                updated_at = ?12
             WHERE id = ?13",
            params![
                layout.layout_mode,
                layout.dock_x,
                layout.dock_y,
                layout.dock_width,
                layout.dock_height,
                layout.popout_x,
                layout.popout_y,
                layout.popout_width,
                layout.popout_height,
                bool_to_i64(layout.always_on_top),
                bool_to_i64(layout.is_visible),
                updated_at,
                widget_instance_id,
            ],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok(())
    }

    pub fn delete_widget_instance_and_local_artifacts(
        &self,
        widget_instance_id: &str,
    ) -> Result<()> {
        self.connection.execute(
            "DELETE FROM widget_results
             WHERE run_id IN (
                SELECT id
                FROM widget_runs
                WHERE widget_instance_id = ?1
             )",
            params![widget_instance_id],
        )?;
        self.connection.execute(
            "DELETE FROM widget_logs
             WHERE widget_instance_id = ?1",
            params![widget_instance_id],
        )?;
        self.connection.execute(
            "DELETE FROM widget_runs
             WHERE widget_instance_id = ?1",
            params![widget_instance_id],
        )?;
        let affected_rows = self.connection.execute(
            "DELETE FROM widget_instances
             WHERE id = ?1",
            params![widget_instance_id],
        )?;

        if affected_rows == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        Ok(())
    }

    pub fn list_widget_instances(&self, workspace_id: &str) -> Result<Vec<WidgetInstanceRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                id, workspace_id, workbench_id, definition_id, title, category,
                layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                popout_y, popout_width, popout_height, always_on_top,
                is_visible, config, state, created_at, updated_at
             FROM widget_instances
             WHERE workspace_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workspace_id], widget_instance_row)?;
        rows.collect()
    }

    pub fn list_widget_instances_for_workbench(
        &self,
        workbench_id: &str,
    ) -> Result<Vec<WidgetInstanceRow>> {
        let mut statement = self.connection.prepare(
            "SELECT
                id, workspace_id, workbench_id, definition_id, title, category,
                layout_mode, dock_x, dock_y, dock_width, dock_height, popout_x,
                popout_y, popout_width, popout_height, always_on_top,
                is_visible, config, state, created_at, updated_at
             FROM widget_instances
             WHERE workbench_id = ?1
             ORDER BY created_at, id",
        )?;

        let rows = statement.query_map(params![workbench_id], widget_instance_row)?;
        rows.collect()
    }
}
