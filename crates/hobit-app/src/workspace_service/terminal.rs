use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{
    NewWidgetLog, NewWidgetResult, NewWidgetRun, SqliteStore, StorageError, WidgetRunFinishUpdate,
};
use hobit_tools::process::{
    run_process_once, ProcessRunOutput, ProcessRunRequest, ProcessRunStatus,
    DEFAULT_PROCESS_TIMEOUT_MS, DEFAULT_STDERR_CAP_BYTES, DEFAULT_STDOUT_CAP_BYTES,
};
use serde_json::json;

use crate::WorkspaceServiceError;

use super::{
    placeholder_id,
    runs::widget_run_status_value,
    validation::{required_input, validate_widget_ownership, validate_widget_run_ownership},
    RunTerminalCommandInput, TerminalCommandRunSummary, WorkspaceService,
    TERMINAL_WIDGET_DEFINITION_ID, WIDGET_LOG_INFO_LEVEL, WIDGET_RUN_STARTED_STATUS,
};

const TERMINAL_COMMAND_KIND: &str = "terminal_command";
const TERMINAL_RESULT_TYPE: &str = "terminal_command_result";
const WIDGET_LOG_ERROR_LEVEL: &str = "error";

impl WorkspaceService {
    pub fn run_terminal_command(
        &self,
        input: RunTerminalCommandInput,
    ) -> Result<Option<TerminalCommandRunSummary>, WorkspaceServiceError> {
        self.run_terminal_command_with_runner(input, run_process_once)
    }

    pub(super) fn run_terminal_command_with_runner<F>(
        &self,
        input: RunTerminalCommandInput,
        runner: F,
    ) -> Result<Option<TerminalCommandRunSummary>, WorkspaceServiceError>
    where
        F: FnOnce(ProcessRunRequest) -> ProcessRunOutput,
    {
        let input = normalize_terminal_command_input(input)?;
        let command_payload = terminal_command_payload(&input);
        let Some(run_id) = self.start_terminal_run(&input, &command_payload)? else {
            return Ok(None);
        };

        let process_output = runner(ProcessRunRequest {
            program: input.program.clone(),
            args: input.args.clone(),
            stdin: None,
            working_directory: input.working_directory.clone(),
            timeout_ms: input.timeout_ms,
            stdout_cap_bytes: input.stdout_cap_bytes,
            stderr_cap_bytes: input.stderr_cap_bytes,
        });

        self.finish_terminal_run(&input, &run_id, &process_output)
    }

    fn start_terminal_run(
        &self,
        input: &NormalizedTerminalCommandInput,
        command_payload: &str,
    ) -> Result<Option<String>, WorkspaceServiceError> {
        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget)) = validate_widget_ownership(
                    store,
                    &input.workspace_id,
                    &input.workbench_id,
                    &input.widget_instance_id,
                )?
                else {
                    return Ok(None);
                };

                if widget.definition_id != TERMINAL_WIDGET_DEFINITION_ID {
                    return Ok(None);
                }

                let run_id = placeholder_id("wrun_");
                let run = store.insert_widget_run(NewWidgetRun {
                    id: &run_id,
                    widget_instance_id: &widget.id,
                    status: widget_run_status_value(&WIDGET_RUN_STARTED_STATUS),
                    command_kind: Some(TERMINAL_COMMAND_KIND),
                    command_payload: Some(command_payload),
                    started_at: None,
                    finished_at: None,
                    summary: Some("Terminal command running"),
                })?;

                append_terminal_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Terminal command received",
                    Some(&terminal_received_log_payload(input)),
                )?;
                append_terminal_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Terminal process started",
                    Some(&terminal_started_log_payload(&run.id)),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(run.id))
            })
            .map_err(WorkspaceServiceError::from)
    }

    fn finish_terminal_run(
        &self,
        input: &NormalizedTerminalCommandInput,
        run_id: &str,
        process_output: &ProcessRunOutput,
    ) -> Result<Option<TerminalCommandRunSummary>, WorkspaceServiceError> {
        let final_status = terminal_final_status(process_output.status);
        let final_status_value = widget_run_status_value(&final_status);
        let result_summary = terminal_result_summary(process_output);
        let result_payload = terminal_result_payload(input, process_output);
        let completion_message = terminal_completion_log_message(process_output.status);
        let completion_log_level = terminal_completion_log_level(process_output.status);
        let completion_payload = terminal_completion_log_payload(process_output);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget, run)) = validate_widget_run_ownership(
                    store,
                    &input.workspace_id,
                    &input.workbench_id,
                    &input.widget_instance_id,
                    run_id,
                )?
                else {
                    return Ok(None);
                };

                if widget.definition_id != TERMINAL_WIDGET_DEFINITION_ID {
                    return Ok(None);
                }

                let run = store.finish_widget_run(
                    &run.id,
                    WidgetRunFinishUpdate {
                        status: final_status_value,
                        finished_at: None,
                        summary: Some(&result_summary),
                    },
                )?;
                let result_id = placeholder_id("wres_");
                store.insert_widget_result(NewWidgetResult {
                    id: &result_id,
                    run_id: &run.id,
                    status: final_status_value,
                    result_type: Some(TERMINAL_RESULT_TYPE),
                    summary: Some(&result_summary),
                    content: None,
                    payload: Some(&result_payload),
                    created_at: None,
                })?;
                append_terminal_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    completion_log_level,
                    completion_message,
                    Some(&completion_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(TerminalCommandRunSummary {
                    run_id: run.id,
                    status: final_status_value.to_owned(),
                    exit_code: process_output.exit_code,
                    stdout: process_output.stdout.clone(),
                    stderr: process_output.stderr.clone(),
                    stdout_truncated: process_output.stdout_truncated,
                    stderr_truncated: process_output.stderr_truncated,
                    duration_ms: process_output.duration_ms,
                    error_message: process_output.error_message.clone(),
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedTerminalCommandInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    program: String,
    args: Vec<String>,
    working_directory: std::path::PathBuf,
    timeout_ms: u64,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
}

fn normalize_terminal_command_input(
    input: RunTerminalCommandInput,
) -> Result<NormalizedTerminalCommandInput, WorkspaceServiceError> {
    Ok(NormalizedTerminalCommandInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        program: input.program,
        args: input.args,
        working_directory: input.working_directory,
        timeout_ms: input.timeout_ms.unwrap_or(DEFAULT_PROCESS_TIMEOUT_MS),
        stdout_cap_bytes: input.stdout_cap_bytes.unwrap_or(DEFAULT_STDOUT_CAP_BYTES),
        stderr_cap_bytes: input.stderr_cap_bytes.unwrap_or(DEFAULT_STDERR_CAP_BYTES),
    })
}

fn append_terminal_log(
    store: &SqliteStore,
    widget_instance_id: &str,
    run_id: Option<&str>,
    level: &str,
    message: &str,
    details: Option<&str>,
) -> Result<(), StorageError> {
    let log_id = placeholder_id("wlog_");
    store.append_widget_log(NewWidgetLog {
        id: &log_id,
        widget_instance_id,
        run_id,
        level,
        message,
        created_at: None,
        details,
    })?;
    Ok(())
}

fn terminal_final_status(process_status: ProcessRunStatus) -> WidgetRunStatus {
    match process_status {
        ProcessRunStatus::Completed => WidgetRunStatus::Completed,
        ProcessRunStatus::FailedToStart => WidgetRunStatus::Failed,
        ProcessRunStatus::TimedOut => WidgetRunStatus::TimedOut,
    }
}

fn terminal_result_summary(output: &ProcessRunOutput) -> String {
    match output.status {
        ProcessRunStatus::Completed => match output.exit_code {
            Some(0) => "Terminal command completed".to_owned(),
            Some(exit_code) => format!("Terminal command completed with exit code {exit_code}"),
            None => "Terminal command completed without an exit code".to_owned(),
        },
        ProcessRunStatus::FailedToStart => "Terminal command failed to start".to_owned(),
        ProcessRunStatus::TimedOut => "Terminal command timed out".to_owned(),
    }
}

fn terminal_completion_log_message(status: ProcessRunStatus) -> &'static str {
    match status {
        ProcessRunStatus::Completed => "Terminal process completed",
        ProcessRunStatus::FailedToStart => "Terminal process failed_to_start",
        ProcessRunStatus::TimedOut => "Terminal process timed_out",
    }
}

fn terminal_completion_log_level(status: ProcessRunStatus) -> &'static str {
    match status {
        ProcessRunStatus::Completed => WIDGET_LOG_INFO_LEVEL,
        ProcessRunStatus::FailedToStart | ProcessRunStatus::TimedOut => WIDGET_LOG_ERROR_LEVEL,
    }
}

fn terminal_command_payload(input: &NormalizedTerminalCommandInput) -> String {
    json!({
        "program": &input.program,
        "args": &input.args,
        "working_directory": input.working_directory.display().to_string(),
        "timeout_ms": input.timeout_ms,
        "stdout_cap_bytes": input.stdout_cap_bytes,
        "stderr_cap_bytes": input.stderr_cap_bytes,
    })
    .to_string()
}

fn terminal_received_log_payload(input: &NormalizedTerminalCommandInput) -> String {
    json!({
        "program": &input.program,
        "arg_count": input.args.len(),
        "working_directory": input.working_directory.display().to_string(),
        "timeout_ms": input.timeout_ms,
        "stdout_cap_bytes": input.stdout_cap_bytes,
        "stderr_cap_bytes": input.stderr_cap_bytes,
    })
    .to_string()
}

fn terminal_started_log_payload(run_id: &str) -> String {
    json!({
        "run_id": run_id,
    })
    .to_string()
}

fn terminal_completion_log_payload(output: &ProcessRunOutput) -> String {
    json!({
        "process_status": output.status.as_str(),
        "exit_code": output.exit_code,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "error_message": &output.error_message,
    })
    .to_string()
}

fn terminal_result_payload(
    input: &NormalizedTerminalCommandInput,
    output: &ProcessRunOutput,
) -> String {
    json!({
        "program": &input.program,
        "args": &input.args,
        "working_directory": input.working_directory.display().to_string(),
        "process_status": output.status.as_str(),
        "exit_code": output.exit_code,
        "stdout": &output.stdout,
        "stderr": &output.stderr,
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "error_message": &output.error_message,
    })
    .to_string()
}

fn capped_duration_ms(duration_ms: u128) -> u64 {
    duration_ms.min(u64::MAX as u128) as u64
}
