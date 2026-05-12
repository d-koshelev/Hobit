use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{NewWidgetResult, NewWidgetRun, WidgetRunFinishUpdate};
use hobit_tools::toolbelt::{
    run_toolbelt_validation, ToolbeltValidationOutput, ToolbeltValidationProfile,
    ToolbeltValidationRequest, ToolbeltValidationStatus,
};
use serde_json::json;

use crate::WorkspaceServiceError;

use super::{
    direct_work::{
        append_direct_work_log, can_initiate_direct_work, capped_duration_ms,
        WIDGET_LOG_ERROR_LEVEL,
    },
    placeholder_id,
    runs::widget_run_status_value,
    validation::{required_input, validate_widget_ownership, validate_widget_run_ownership},
    DirectWorkValidationRunSummary, RunDirectWorkValidationInput, WorkspaceService,
    WIDGET_LOG_INFO_LEVEL, WIDGET_RUN_STARTED_STATUS,
};

const DIRECT_WORK_VALIDATION_COMMAND_KIND: &str = "direct_work_validation";
const DIRECT_WORK_VALIDATION_RESULT_TYPE: &str = "direct_work_validation_result";
const DIRECT_WORK_VALIDATION_MODE: &str = "direct_work_validation";

impl WorkspaceService {
    pub fn run_direct_work_validation(
        &self,
        input: RunDirectWorkValidationInput,
    ) -> Result<Option<DirectWorkValidationRunSummary>, WorkspaceServiceError> {
        self.run_direct_work_validation_with_runner(input, run_toolbelt_validation)
    }

    pub(super) fn run_direct_work_validation_with_runner<F>(
        &self,
        input: RunDirectWorkValidationInput,
        runner: F,
    ) -> Result<Option<DirectWorkValidationRunSummary>, WorkspaceServiceError>
    where
        F: FnOnce(ToolbeltValidationRequest) -> ToolbeltValidationOutput,
    {
        let input = normalize_direct_work_validation_input(input)?;
        let command_payload = direct_work_validation_command_payload(&input);
        let Some(run_id) = self.start_direct_work_validation_run(&input, &command_payload)? else {
            return Ok(None);
        };

        let output = runner(ToolbeltValidationRequest {
            repo_root: input.repo_root.clone(),
            profile: input.profile,
            timeout_ms: input.timeout_ms,
            stdout_cap_bytes: input.stdout_cap_bytes,
            stderr_cap_bytes: input.stderr_cap_bytes,
            shell_kind: None,
        });

        self.finish_direct_work_validation_run(&input, &run_id, &output)
    }

    fn start_direct_work_validation_run(
        &self,
        input: &NormalizedDirectWorkValidationInput,
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

                if !can_initiate_direct_work(&widget.definition_id) {
                    return Ok(None);
                }

                let run_id = placeholder_id("wrun_");
                let run = store.insert_widget_run(NewWidgetRun {
                    id: &run_id,
                    widget_instance_id: &widget.id,
                    status: widget_run_status_value(&WIDGET_RUN_STARTED_STATUS),
                    command_kind: Some(DIRECT_WORK_VALIDATION_COMMAND_KIND),
                    command_payload: Some(command_payload),
                    started_at: None,
                    finished_at: None,
                    summary: Some("Direct Work validation running"),
                })?;

                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Direct Work validation requested",
                    Some(&direct_work_validation_requested_log_payload(input)),
                )?;
                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Toolbelt validation started",
                    Some(&direct_work_validation_started_log_payload(&run.id, input)),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(run.id))
            })
            .map_err(WorkspaceServiceError::from)
    }

    fn finish_direct_work_validation_run(
        &self,
        input: &NormalizedDirectWorkValidationInput,
        run_id: &str,
        output: &ToolbeltValidationOutput,
    ) -> Result<Option<DirectWorkValidationRunSummary>, WorkspaceServiceError> {
        let run_status = direct_work_validation_run_status(output.status);
        let run_status_value = widget_run_status_value(&run_status);
        let result_summary = direct_work_validation_result_summary(output.status);
        let result_payload = direct_work_validation_result_payload(input, output, run_status_value);
        let completion_message = direct_work_validation_completion_log_message(output.status);
        let completion_log_level = direct_work_validation_completion_log_level(output.status);
        let completion_payload =
            direct_work_validation_completion_log_payload(output, run_status_value);

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

                if !can_initiate_direct_work(&widget.definition_id) {
                    return Ok(None);
                }

                let run = store.finish_widget_run(
                    &run.id,
                    WidgetRunFinishUpdate {
                        status: run_status_value,
                        finished_at: None,
                        summary: Some(&result_summary),
                    },
                )?;
                let result_id = placeholder_id("wres_");
                store.insert_widget_result(NewWidgetResult {
                    id: &result_id,
                    run_id: &run.id,
                    status: run_status_value,
                    result_type: Some(DIRECT_WORK_VALIDATION_RESULT_TYPE),
                    summary: Some(&result_summary),
                    content: None,
                    payload: Some(&result_payload),
                    created_at: None,
                })?;
                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    completion_log_level,
                    completion_message,
                    Some(&completion_payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(DirectWorkValidationRunSummary {
                    run_id: run.id,
                    result_id,
                    result_type: DIRECT_WORK_VALIDATION_RESULT_TYPE.to_owned(),
                    profile: validation_profile_value(output.profile).to_owned(),
                    status: output.status.as_str().to_owned(),
                    run_status: run_status_value.to_owned(),
                    exit_code: output.exit_code,
                    stdout: output.stdout.clone(),
                    stderr: output.stderr.clone(),
                    stdout_truncated: output.stdout_truncated,
                    stderr_truncated: output.stderr_truncated,
                    duration_ms: output.duration_ms,
                    error_message: output.error_message.clone(),
                    command_summary: output.command_summary.clone(),
                    repo_root: output.repo_root.display().to_string(),
                    no_git_mutations: true,
                    no_commit_push: true,
                    git_mutations_performed_by_hobit: false,
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedDirectWorkValidationInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    repo_root: std::path::PathBuf,
    profile: ToolbeltValidationProfile,
    timeout_ms: Option<u64>,
    stdout_cap_bytes: Option<usize>,
    stderr_cap_bytes: Option<usize>,
}

fn normalize_direct_work_validation_input(
    input: RunDirectWorkValidationInput,
) -> Result<NormalizedDirectWorkValidationInput, WorkspaceServiceError> {
    if input.repo_root.as_os_str().is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(
            "repo root must not be empty".to_owned(),
        ));
    }

    Ok(NormalizedDirectWorkValidationInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        repo_root: input.repo_root,
        profile: parse_toolbelt_validation_profile(&input.validation_profile)?,
        timeout_ms: input.timeout_ms,
        stdout_cap_bytes: input.stdout_cap_bytes,
        stderr_cap_bytes: input.stderr_cap_bytes,
    })
}

fn parse_toolbelt_validation_profile(
    value: &str,
) -> Result<ToolbeltValidationProfile, WorkspaceServiceError> {
    match required_input(value, "validation profile")? {
        "fast" => Ok(ToolbeltValidationProfile::Fast),
        "changed" => Ok(ToolbeltValidationProfile::Changed),
        "full" => Ok(ToolbeltValidationProfile::Full),
        value => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported validation profile: {value}"
        ))),
    }
}

fn direct_work_validation_run_status(status: ToolbeltValidationStatus) -> WidgetRunStatus {
    match status {
        ToolbeltValidationStatus::Passed | ToolbeltValidationStatus::Failed => {
            WidgetRunStatus::Completed
        }
        ToolbeltValidationStatus::FailedToStart => WidgetRunStatus::Failed,
        ToolbeltValidationStatus::TimedOut => WidgetRunStatus::TimedOut,
    }
}

fn direct_work_validation_result_summary(status: ToolbeltValidationStatus) -> String {
    match status {
        ToolbeltValidationStatus::Passed => "Direct Work validation passed".to_owned(),
        ToolbeltValidationStatus::Failed => "Direct Work validation failed".to_owned(),
        ToolbeltValidationStatus::FailedToStart => {
            "Direct Work validation failed to start".to_owned()
        }
        ToolbeltValidationStatus::TimedOut => "Direct Work validation timed out".to_owned(),
    }
}

fn direct_work_validation_completion_log_message(status: ToolbeltValidationStatus) -> &'static str {
    match status {
        ToolbeltValidationStatus::Passed => "Toolbelt validation passed",
        ToolbeltValidationStatus::Failed => "Toolbelt validation failed",
        ToolbeltValidationStatus::FailedToStart => "Toolbelt validation failed_to_start",
        ToolbeltValidationStatus::TimedOut => "Toolbelt validation timed_out",
    }
}

fn direct_work_validation_completion_log_level(status: ToolbeltValidationStatus) -> &'static str {
    match status {
        ToolbeltValidationStatus::Passed => WIDGET_LOG_INFO_LEVEL,
        ToolbeltValidationStatus::Failed
        | ToolbeltValidationStatus::FailedToStart
        | ToolbeltValidationStatus::TimedOut => WIDGET_LOG_ERROR_LEVEL,
    }
}

fn validation_profile_value(profile: ToolbeltValidationProfile) -> &'static str {
    profile.as_cli_arg()
}

fn direct_work_validation_command_payload(input: &NormalizedDirectWorkValidationInput) -> String {
    json!({
        "mode": DIRECT_WORK_VALIDATION_MODE,
        "repo_root": input.repo_root.display().to_string(),
        "profile": validation_profile_value(input.profile),
        "timeout_ms": input.timeout_ms,
        "stdout_cap_bytes": input.stdout_cap_bytes,
        "stderr_cap_bytes": input.stderr_cap_bytes,
        "automatically_triggered": false,
        "no_git_mutations": true,
        "no_commit_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}

fn direct_work_validation_requested_log_payload(
    input: &NormalizedDirectWorkValidationInput,
) -> String {
    json!({
        "mode": DIRECT_WORK_VALIDATION_MODE,
        "repo_root": input.repo_root.display().to_string(),
        "profile": validation_profile_value(input.profile),
        "timeout_ms": input.timeout_ms,
        "stdout_cap_bytes": input.stdout_cap_bytes,
        "stderr_cap_bytes": input.stderr_cap_bytes,
        "automatically_triggered": false,
    })
    .to_string()
}

fn direct_work_validation_started_log_payload(
    run_id: &str,
    input: &NormalizedDirectWorkValidationInput,
) -> String {
    json!({
        "run_id": run_id,
        "mode": DIRECT_WORK_VALIDATION_MODE,
        "repo_root": input.repo_root.display().to_string(),
        "profile": validation_profile_value(input.profile),
    })
    .to_string()
}

fn direct_work_validation_completion_log_payload(
    output: &ToolbeltValidationOutput,
    run_status: &str,
) -> String {
    json!({
        "profile": validation_profile_value(output.profile),
        "status": output.status.as_str(),
        "run_status": run_status,
        "exit_code": output.exit_code,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "error_message": &output.error_message,
    })
    .to_string()
}

fn direct_work_validation_result_payload(
    input: &NormalizedDirectWorkValidationInput,
    output: &ToolbeltValidationOutput,
    run_status: &str,
) -> String {
    json!({
        "result_type": DIRECT_WORK_VALIDATION_RESULT_TYPE,
        "mode": DIRECT_WORK_VALIDATION_MODE,
        "repo_root": output.repo_root.display().to_string(),
        "requested_repo_root": input.repo_root.display().to_string(),
        "profile": validation_profile_value(output.profile),
        "status": output.status.as_str(),
        "run_status": run_status,
        "exit_code": output.exit_code,
        "stdout": &output.stdout,
        "stderr": &output.stderr,
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "error_message": &output.error_message,
        "command_summary": &output.command_summary,
        "automatically_triggered": false,
        "no_git_mutations": true,
        "no_commit_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}
