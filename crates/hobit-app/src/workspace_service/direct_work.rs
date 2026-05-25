use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{
    NewWidgetLog, NewWidgetResult, NewWidgetRun, SqliteStore, StorageError, WidgetRunFinishUpdate,
};
use hobit_tools::codex_cli::{
    run_codex_direct_work, CodexApprovalPolicy, CodexDirectRunOutput, CodexDirectRunRequest,
    CodexDirectRunStatus, CodexSandboxMode, DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES,
    DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES, DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS,
};
use serde_json::json;

use crate::WorkspaceServiceError;

use super::{
    direct_work_artifacts::{DirectWorkInputRuntimeArtifacts, DirectWorkOutputRuntimeArtifacts},
    placeholder_id,
    runs::widget_run_status_value,
    validation::{required_input, validate_widget_ownership, validate_widget_run_ownership},
    CodexDirectWorkRunSummary, RunCodexDirectWorkInput, WorkspaceService,
    AGENT_RUN_WIDGET_DEFINITION_ID, COORDINATOR_CHAT_WIDGET_DEFINITION_ID, WIDGET_LOG_INFO_LEVEL,
    WIDGET_RUN_STARTED_STATUS,
};

pub(super) const CODEX_DIRECT_WORK_COMMAND_KIND: &str = "codex_direct_work";
pub(super) const CODEX_DIRECT_WORK_RESULT_TYPE: &str = "codex_direct_work_result";
pub(super) const CODEX_DIRECT_WORK_EXECUTOR_KIND: &str = "codex_cli";
pub(super) const CODEX_DIRECT_WORK_MODE: &str = "direct_work";
pub(super) const WIDGET_LOG_ERROR_LEVEL: &str = "error";

impl WorkspaceService {
    pub fn run_codex_direct_work(
        &self,
        input: RunCodexDirectWorkInput,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError> {
        self.run_codex_direct_work_with_runner(input, run_codex_direct_work)
    }

    pub(super) fn run_codex_direct_work_with_runner<F>(
        &self,
        input: RunCodexDirectWorkInput,
        runner: F,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError>
    where
        F: FnOnce(CodexDirectRunRequest) -> CodexDirectRunOutput,
    {
        let input = normalize_direct_work_input(input)?;
        let _input_artifacts = direct_work_input_runtime_artifacts(&input);
        let command_payload = direct_work_command_payload(&input);
        let Some(run_id) = self.start_direct_work_run(&input, &command_payload)? else {
            return Ok(None);
        };

        let output = runner(CodexDirectRunRequest {
            program: Some(input.codex_executable.clone()),
            repo_root: input.repo_root.clone(),
            prompt: input.operator_prompt.clone(),
            sandbox: input.sandbox,
            approval_policy: input.approval_policy,
            skip_git_repo_check: input.skip_git_repo_check,
            timeout_ms: Some(input.timeout_ms),
            stdout_cap_bytes: Some(input.stdout_cap_bytes),
            stderr_cap_bytes: Some(input.stderr_cap_bytes),
            output_last_message_path: None,
        });

        self.finish_direct_work_run(&input, &run_id, &output)
    }

    fn start_direct_work_run(
        &self,
        input: &NormalizedDirectWorkInput,
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
                    command_kind: Some(CODEX_DIRECT_WORK_COMMAND_KIND),
                    command_payload: Some(command_payload),
                    started_at: None,
                    finished_at: None,
                    summary: Some("Codex Direct Work running"),
                })?;

                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Direct Work requested",
                    Some(&direct_work_requested_log_payload(input)),
                )?;
                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "Codex process starting",
                    Some(&direct_work_started_log_payload(&run.id)),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(run.id))
            })
            .map_err(WorkspaceServiceError::from)
    }

    fn finish_direct_work_run(
        &self,
        input: &NormalizedDirectWorkInput,
        run_id: &str,
        output: &CodexDirectRunOutput,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError> {
        let _output_artifacts = DirectWorkOutputRuntimeArtifacts::from_run_output(output);
        let final_status = direct_work_final_status(output.status);
        let final_status_value = widget_run_status_value(&final_status);
        let result_summary = direct_work_result_summary(output);
        let result_payload = direct_work_result_payload(input, output, final_status_value);
        let completion_message = direct_work_completion_log_message(output.status);
        let completion_log_level = direct_work_completion_log_level(output.status);
        let completion_payload = direct_work_completion_log_payload(output, final_status_value);

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
                    result_type: Some(CODEX_DIRECT_WORK_RESULT_TYPE),
                    summary: Some(&result_summary),
                    content: output.final_message.as_deref(),
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
                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(&run.id),
                    WIDGET_LOG_INFO_LEVEL,
                    "No commit/push performed",
                    Some(&direct_work_no_git_mutation_log_payload()),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(CodexDirectWorkRunSummary {
                    run_id: run.id,
                    result_id,
                    result_type: CODEX_DIRECT_WORK_RESULT_TYPE.to_owned(),
                    executor_kind: CODEX_DIRECT_WORK_EXECUTOR_KIND.to_owned(),
                    mode: CODEX_DIRECT_WORK_MODE.to_owned(),
                    repo_root: input.repo_root.display().to_string(),
                    sandbox: direct_work_sandbox_value(input.sandbox).to_owned(),
                    approval_policy: direct_work_approval_policy_value(input.approval_policy)
                        .to_owned(),
                    command_summary: output.command_summary.clone(),
                    status: final_status_value.to_owned(),
                    exit_code: output.exit_code,
                    stdout: output.stdout.clone(),
                    stderr: output.stderr.clone(),
                    stdout_truncated: output.stdout_truncated,
                    stderr_truncated: output.stderr_truncated,
                    final_message: output.final_message.clone(),
                    duration_ms: output.duration_ms,
                    error_message: output.error_message.clone(),
                    no_auto_commit: true,
                    no_auto_push: true,
                    git_mutations_performed_by_hobit: false,
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct NormalizedDirectWorkInput {
    pub(super) workspace_id: String,
    pub(super) workbench_id: String,
    pub(super) widget_instance_id: String,
    pub(super) codex_executable: String,
    pub(super) repo_root: std::path::PathBuf,
    pub(super) operator_prompt: String,
    pub(super) sandbox: CodexSandboxMode,
    pub(super) approval_policy: CodexApprovalPolicy,
    pub(super) skip_git_repo_check: bool,
    pub(super) timeout_ms: u64,
    pub(super) stdout_cap_bytes: usize,
    pub(super) stderr_cap_bytes: usize,
}

pub(super) fn normalize_direct_work_input(
    input: RunCodexDirectWorkInput,
) -> Result<NormalizedDirectWorkInput, WorkspaceServiceError> {
    if input.repo_root.as_os_str().is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(
            "repo root must not be empty".to_owned(),
        ));
    }

    Ok(NormalizedDirectWorkInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        workbench_id: required_input(&input.workbench_id, "workbench id")?.to_owned(),
        widget_instance_id: required_input(&input.widget_instance_id, "widget instance id")?
            .to_owned(),
        codex_executable: required_input(&input.codex_executable, "codex executable")?.to_owned(),
        repo_root: input.repo_root,
        operator_prompt: required_input(&input.operator_prompt, "operator prompt")?.to_owned(),
        sandbox: parse_direct_work_sandbox(&input.sandbox)?,
        approval_policy: parse_direct_work_approval_policy(&input.approval_policy)?,
        skip_git_repo_check: input.skip_git_repo_check,
        timeout_ms: input
            .timeout_ms
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_TIMEOUT_MS),
        stdout_cap_bytes: input
            .stdout_cap_bytes
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_STDOUT_CAP_BYTES),
        stderr_cap_bytes: input
            .stderr_cap_bytes
            .unwrap_or(DEFAULT_CODEX_DIRECT_RUN_STDERR_CAP_BYTES),
    })
}

fn parse_direct_work_sandbox(value: &str) -> Result<CodexSandboxMode, WorkspaceServiceError> {
    match required_input(value, "direct work sandbox")? {
        "read_only" => Ok(CodexSandboxMode::ReadOnly),
        "workspace_write" => Ok(CodexSandboxMode::WorkspaceWrite),
        value => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported direct work sandbox: {value}"
        ))),
    }
}

fn parse_direct_work_approval_policy(
    value: &str,
) -> Result<CodexApprovalPolicy, WorkspaceServiceError> {
    match required_input(value, "direct work approval policy")? {
        "never" => Ok(CodexApprovalPolicy::Never),
        "on_request" => Ok(CodexApprovalPolicy::OnRequest),
        "untrusted" => Ok(CodexApprovalPolicy::Untrusted),
        value => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported direct work approval policy: {value}"
        ))),
    }
}

pub(super) fn can_initiate_direct_work(definition_id: &str) -> bool {
    definition_id == AGENT_RUN_WIDGET_DEFINITION_ID
        || definition_id == COORDINATOR_CHAT_WIDGET_DEFINITION_ID
}

pub(super) fn append_direct_work_log(
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

pub(super) fn direct_work_final_status(status: CodexDirectRunStatus) -> WidgetRunStatus {
    match status {
        CodexDirectRunStatus::Completed => WidgetRunStatus::Completed,
        CodexDirectRunStatus::Failed | CodexDirectRunStatus::FailedToStart => {
            WidgetRunStatus::Failed
        }
        CodexDirectRunStatus::TimedOut => WidgetRunStatus::TimedOut,
    }
}

fn direct_work_result_summary(output: &CodexDirectRunOutput) -> String {
    match output.status {
        CodexDirectRunStatus::Completed => "Codex Direct Work completed".to_owned(),
        CodexDirectRunStatus::Failed => "Codex Direct Work failed".to_owned(),
        CodexDirectRunStatus::FailedToStart => "Codex Direct Work failed to start".to_owned(),
        CodexDirectRunStatus::TimedOut => "Codex Direct Work timed out".to_owned(),
    }
}

fn direct_work_completion_log_message(status: CodexDirectRunStatus) -> &'static str {
    match status {
        CodexDirectRunStatus::Completed => "Codex process completed",
        CodexDirectRunStatus::Failed | CodexDirectRunStatus::FailedToStart => {
            "Codex process failed"
        }
        CodexDirectRunStatus::TimedOut => "Codex process timed_out",
    }
}

fn direct_work_completion_log_level(status: CodexDirectRunStatus) -> &'static str {
    match status {
        CodexDirectRunStatus::Completed => WIDGET_LOG_INFO_LEVEL,
        CodexDirectRunStatus::Failed
        | CodexDirectRunStatus::FailedToStart
        | CodexDirectRunStatus::TimedOut => WIDGET_LOG_ERROR_LEVEL,
    }
}

pub(super) fn direct_work_sandbox_value(sandbox: CodexSandboxMode) -> &'static str {
    match sandbox {
        CodexSandboxMode::ReadOnly => "read_only",
        CodexSandboxMode::WorkspaceWrite => "workspace_write",
    }
}

pub(super) fn direct_work_approval_policy_value(
    approval_policy: CodexApprovalPolicy,
) -> &'static str {
    match approval_policy {
        CodexApprovalPolicy::Never => "never",
        CodexApprovalPolicy::OnRequest => "on_request",
        CodexApprovalPolicy::Untrusted => "untrusted",
    }
}

fn direct_work_command_payload(input: &NormalizedDirectWorkInput) -> String {
    json!({
        "executor_kind": CODEX_DIRECT_WORK_EXECUTOR_KIND,
        "mode": CODEX_DIRECT_WORK_MODE,
        "repo_root": input.repo_root.display().to_string(),
        "codex_executable": &input.codex_executable,
        "operator_prompt": &input.operator_prompt,
        "sandbox": direct_work_sandbox_value(input.sandbox),
        "approval_policy": direct_work_approval_policy_value(input.approval_policy),
        "skip_git_repo_check": input.skip_git_repo_check,
        "timeout_ms": input.timeout_ms,
        "stdout_cap_bytes": input.stdout_cap_bytes,
        "stderr_cap_bytes": input.stderr_cap_bytes,
        "no_auto_commit": true,
        "no_auto_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}

pub(super) fn direct_work_input_runtime_artifacts(
    input: &NormalizedDirectWorkInput,
) -> DirectWorkInputRuntimeArtifacts {
    let repo_root = input.repo_root.to_string_lossy().into_owned();
    let mut command_parts = vec![
        input.codex_executable.as_str(),
        "exec",
        "--cd",
        repo_root.as_str(),
        "--sandbox",
        direct_work_sandbox_value(input.sandbox),
        "--ask-for-approval",
        direct_work_approval_policy_value(input.approval_policy),
    ];
    if input.skip_git_repo_check {
        command_parts.push("--skip-git-repo-check");
    }
    command_parts.push("<operator-prompt-stdin>");

    DirectWorkInputRuntimeArtifacts::from_input(
        &input.operator_prompt,
        &input.repo_root,
        &command_parts,
        false,
    )
}

pub(super) fn direct_work_requested_log_payload(input: &NormalizedDirectWorkInput) -> String {
    json!({
        "executor_kind": CODEX_DIRECT_WORK_EXECUTOR_KIND,
        "mode": CODEX_DIRECT_WORK_MODE,
        "repo_root": input.repo_root.display().to_string(),
        "codex_executable": &input.codex_executable,
        "sandbox": direct_work_sandbox_value(input.sandbox),
        "approval_policy": direct_work_approval_policy_value(input.approval_policy),
        "skip_git_repo_check": input.skip_git_repo_check,
        "timeout_ms": input.timeout_ms,
        "stdout_cap_bytes": input.stdout_cap_bytes,
        "stderr_cap_bytes": input.stderr_cap_bytes,
    })
    .to_string()
}

pub(super) fn direct_work_started_log_payload(run_id: &str) -> String {
    json!({
        "run_id": run_id,
        "executor_kind": CODEX_DIRECT_WORK_EXECUTOR_KIND,
        "mode": CODEX_DIRECT_WORK_MODE,
    })
    .to_string()
}

fn direct_work_completion_log_payload(output: &CodexDirectRunOutput, final_status: &str) -> String {
    json!({
        "codex_status": output.status.as_str(),
        "status": final_status,
        "exit_code": output.exit_code,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "final_message_present": output.final_message.is_some(),
        "error_message": &output.error_message,
    })
    .to_string()
}

pub(super) fn direct_work_no_git_mutation_log_payload() -> String {
    json!({
        "no_auto_commit": true,
        "no_auto_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}

fn direct_work_result_payload(
    input: &NormalizedDirectWorkInput,
    output: &CodexDirectRunOutput,
    final_status: &str,
) -> String {
    json!({
        "executor_kind": CODEX_DIRECT_WORK_EXECUTOR_KIND,
        "mode": CODEX_DIRECT_WORK_MODE,
        "repo_root": input.repo_root.display().to_string(),
        "codex_executable": &input.codex_executable,
        "sandbox": direct_work_sandbox_value(input.sandbox),
        "approval_policy": direct_work_approval_policy_value(input.approval_policy),
        "skip_git_repo_check": input.skip_git_repo_check,
        "operator_prompt": &input.operator_prompt,
        "command_summary": &output.command_summary,
        "status": final_status,
        "codex_status": output.status.as_str(),
        "exit_code": output.exit_code,
        "stdout": &output.stdout,
        "stderr": &output.stderr,
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "final_message": &output.final_message,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "error_message": &output.error_message,
        "no_auto_commit": true,
        "no_auto_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}

pub(super) fn capped_duration_ms(duration_ms: u128) -> u64 {
    duration_ms.min(u64::MAX as u128) as u64
}
