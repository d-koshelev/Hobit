use hobit_storage_sqlite::{NewWidgetLog, SqliteStore, StorageError};

use crate::WorkspaceServiceError;

use super::{
    mapping::widget_log_summary, placeholder_id, validation::required_input, WidgetLogSummary,
    WorkspaceService, MAX_WIDGET_LOG_LIMIT, WIDGET_LOG_INFO_LEVEL,
};

impl WorkspaceService {
    pub fn list_widget_logs(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        limit: usize,
    ) -> Result<Option<Vec<WidgetLogSummary>>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let limit = clamp_widget_log_limit(limit);

        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let Some(workbench) = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .find(|workbench| workbench.id == workbench_id)
        else {
            return Ok(None);
        };

        let Some(widget) = self.store.get_widget_instance(widget_instance_id)? else {
            return Ok(None);
        };

        if widget.workspace_id != workspace.id || widget.workbench_id != workbench.id {
            return Ok(None);
        }

        Ok(Some(
            self.store
                .list_widget_logs_for_widget(&widget.id, limit)?
                .into_iter()
                .map(widget_log_summary)
                .collect(),
        ))
    }
}

pub(super) fn append_widget_info_log(
    store: &SqliteStore,
    widget_instance_id: &str,
    message: &str,
) -> Result<(), StorageError> {
    let log_id = placeholder_id("wlog_");
    store.append_widget_log(NewWidgetLog {
        id: &log_id,
        widget_instance_id,
        run_id: None,
        level: WIDGET_LOG_INFO_LEVEL,
        message,
        created_at: None,
        details: None,
    })?;
    Ok(())
}

fn clamp_widget_log_limit(limit: usize) -> usize {
    limit.min(MAX_WIDGET_LOG_LIMIT)
}
