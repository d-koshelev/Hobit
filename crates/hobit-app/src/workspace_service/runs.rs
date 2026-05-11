use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{NewWidgetLog, NewWidgetResult, NewWidgetRun, WidgetRunFinishUpdate};

use crate::WorkspaceServiceError;

use super::{
    mapping::{widget_log_summary, widget_result_summary, widget_run_summary},
    placeholder_id,
    validation::{required_input, validate_widget_ownership, validate_widget_run_ownership},
    WidgetLogSummary, WidgetRunCommandInput, WidgetRunResultInput, WidgetRunSummary,
    WidgetRunWithResultsSummary, WorkspaceService, WIDGET_RUN_STARTED_STATUS,
};

impl WorkspaceService {
    pub fn create_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        command: WidgetRunCommandInput,
    ) -> Result<Option<WidgetRunSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let command_kind = optional_trimmed(command.command_kind);
        let command_payload = optional_trimmed(command.command_payload);
        let summary = optional_trimmed(command.summary);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget)) = validate_widget_ownership(
                    store,
                    workspace_id,
                    workbench_id,
                    widget_instance_id,
                )?
                else {
                    return Ok(None);
                };

                let run_id = placeholder_id("wrun_");
                let run = store.insert_widget_run(NewWidgetRun {
                    id: &run_id,
                    widget_instance_id: &widget.id,
                    status: widget_run_status_value(&WIDGET_RUN_STARTED_STATUS),
                    command_kind: command_kind.as_deref(),
                    command_payload: command_payload.as_deref(),
                    started_at: None,
                    finished_at: None,
                    summary: summary.as_deref(),
                })?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(widget_run_summary(run)))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn append_widget_run_log(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
        level: &str,
        message: &str,
        details: Option<String>,
    ) -> Result<Option<WidgetLogSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "widget run id")?;
        let level = required_input(level, "widget log level")?;
        let message = required_input(message, "widget log message")?;
        let details = optional_trimmed(details);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget, run)) = validate_widget_run_ownership(
                    store,
                    workspace_id,
                    workbench_id,
                    widget_instance_id,
                    run_id,
                )?
                else {
                    return Ok(None);
                };

                let log_id = placeholder_id("wlog_");
                let log = store.append_widget_log(NewWidgetLog {
                    id: &log_id,
                    widget_instance_id: &widget.id,
                    run_id: Some(&run.id),
                    level,
                    message,
                    created_at: None,
                    details: details.as_deref(),
                })?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(widget_log_summary(log)))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn finish_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
        final_status: WidgetRunStatus,
        summary: Option<String>,
        result: Option<WidgetRunResultInput>,
    ) -> Result<Option<WidgetRunWithResultsSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "widget run id")?;
        validate_final_widget_run_status(&final_status)?;
        let final_status = widget_run_status_value(&final_status);
        let summary = optional_trimmed(summary);
        let result = result.map(trim_widget_run_result_input);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, _widget, run)) = validate_widget_run_ownership(
                    store,
                    workspace_id,
                    workbench_id,
                    widget_instance_id,
                    run_id,
                )?
                else {
                    return Ok(None);
                };

                let run = store.finish_widget_run(
                    &run.id,
                    WidgetRunFinishUpdate {
                        status: final_status,
                        finished_at: None,
                        summary: summary.as_deref(),
                    },
                )?;

                if let Some(result) = result {
                    let result_id = placeholder_id("wres_");
                    store.insert_widget_result(NewWidgetResult {
                        id: &result_id,
                        run_id: &run.id,
                        status: final_status,
                        result_type: result.result_type.as_deref(),
                        summary: result.summary.as_deref(),
                        content: result.content.as_deref(),
                        payload: result.payload.as_deref(),
                        created_at: None,
                    })?;
                }

                let results = store
                    .list_widget_results(&run.id)?
                    .into_iter()
                    .map(widget_result_summary)
                    .collect();
                store.touch_workspace(&workspace.id)?;

                Ok(Some(WidgetRunWithResultsSummary {
                    run: widget_run_summary(run),
                    results,
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn get_widget_run(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
    ) -> Result<Option<WidgetRunWithResultsSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "widget run id")?;

        let Some((_workspace, _workbench, _widget, run)) = validate_widget_run_ownership(
            &self.store,
            workspace_id,
            workbench_id,
            widget_instance_id,
            run_id,
        )?
        else {
            return Ok(None);
        };

        let results = self
            .store
            .list_widget_results(&run.id)?
            .into_iter()
            .map(widget_result_summary)
            .collect();

        Ok(Some(WidgetRunWithResultsSummary {
            run: widget_run_summary(run),
            results,
        }))
    }
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn trim_widget_run_result_input(mut input: WidgetRunResultInput) -> WidgetRunResultInput {
    input.result_type = optional_trimmed(input.result_type);
    input.summary = optional_trimmed(input.summary);
    input.content = optional_trimmed(input.content);
    input.payload = optional_trimmed(input.payload);
    input
}

fn validate_final_widget_run_status(status: &WidgetRunStatus) -> Result<(), WorkspaceServiceError> {
    match status {
        WidgetRunStatus::Completed
        | WidgetRunStatus::Failed
        | WidgetRunStatus::TimedOut
        | WidgetRunStatus::Cancelled => Ok(()),
        _ => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported final widget run status: {}",
            widget_run_status_value(status)
        ))),
    }
}

fn widget_run_status_value(status: &WidgetRunStatus) -> &'static str {
    match status {
        WidgetRunStatus::Idle => "idle",
        WidgetRunStatus::InputReady => "input_ready",
        WidgetRunStatus::WaitingForApproval => "waiting_for_approval",
        WidgetRunStatus::Running => "running",
        WidgetRunStatus::ResultReady => "result_ready",
        WidgetRunStatus::Completed => "completed",
        WidgetRunStatus::Failed => "failed",
        WidgetRunStatus::TimedOut => "timed_out",
        WidgetRunStatus::Cancelled => "cancelled",
    }
}
