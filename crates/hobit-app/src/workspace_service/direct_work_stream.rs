use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{NewWidgetResult, NewWidgetRun, SqliteStore, WidgetRunFinishUpdate};
use hobit_tools::codex_cli::{
    run_codex_direct_work_streaming, run_codex_direct_work_streaming_with_cancellation,
    CodexDirectStreamCancellationToken, CodexDirectStreamEvent, CodexDirectStreamEventKind,
    CodexDirectStreamOutput, CodexDirectStreamRequest, CodexDirectStreamStatus,
};
use serde_json::{json, Value};

use crate::WorkspaceServiceError;

use super::{
    direct_work::{
        append_direct_work_log, can_initiate_direct_work, capped_duration_ms,
        direct_work_approval_policy_value, direct_work_input_runtime_artifacts,
        direct_work_no_git_mutation_log_payload, direct_work_requested_log_payload,
        direct_work_sandbox_value, direct_work_started_log_payload, normalize_direct_work_input,
        NormalizedDirectWorkInput, CODEX_DIRECT_WORK_COMMAND_KIND, CODEX_DIRECT_WORK_EXECUTOR_KIND,
        CODEX_DIRECT_WORK_MODE, CODEX_DIRECT_WORK_RESULT_TYPE, WIDGET_LOG_ERROR_LEVEL,
    },
    direct_work_artifacts::{
        DirectWorkOutputRuntimeArtifacts, DirectWorkStreamEventRuntimeArtifact,
    },
    placeholder_id,
    runs::widget_run_status_value,
    validation::{validate_widget_ownership, validate_widget_run_ownership},
    CodexDirectWorkRunSummary, CodexDirectWorkStreamEventSummary,
    CodexDirectWorkStreamStartSummary, RunCodexDirectWorkInput, WorkspaceService,
    WIDGET_LOG_INFO_LEVEL, WIDGET_RUN_STARTED_STATUS,
};

impl WorkspaceService {
    pub fn start_codex_direct_work_stream(
        &self,
        input: RunCodexDirectWorkInput,
    ) -> Result<Option<CodexDirectWorkStreamStartSummary>, WorkspaceServiceError> {
        let input = normalize_direct_work_input(input)?;

        self.store
            .with_immediate_transaction(|store| {
                insert_codex_direct_work_stream_start(store, &input)
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn run_codex_direct_work_stream<E>(
        &self,
        input: RunCodexDirectWorkInput,
        run_id: &str,
        emit_event: E,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError>
    where
        E: FnMut(CodexDirectWorkStreamEventSummary),
    {
        self.run_codex_direct_work_stream_with_runner(
            input,
            run_id,
            |request, on_event| run_codex_direct_work_streaming(request, on_event),
            emit_event,
        )
    }

    pub fn run_codex_direct_work_stream_with_cancellation<E>(
        &self,
        input: RunCodexDirectWorkInput,
        run_id: &str,
        cancellation_token: CodexDirectStreamCancellationToken,
        emit_event: E,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError>
    where
        E: FnMut(CodexDirectWorkStreamEventSummary),
    {
        self.run_codex_direct_work_stream_with_runner(
            input,
            run_id,
            |request, on_event| {
                run_codex_direct_work_streaming_with_cancellation(
                    request,
                    cancellation_token,
                    on_event,
                )
            },
            emit_event,
        )
    }

    pub(super) fn run_codex_direct_work_stream_with_runner<F, E>(
        &self,
        input: RunCodexDirectWorkInput,
        run_id: &str,
        runner: F,
        mut emit_event: E,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError>
    where
        F: FnOnce(
            CodexDirectStreamRequest,
            &mut dyn FnMut(CodexDirectStreamEvent),
        ) -> CodexDirectStreamOutput,
        E: FnMut(CodexDirectWorkStreamEventSummary),
    {
        let input = normalize_direct_work_input(input)?;
        let request = CodexDirectStreamRequest {
            program: Some(input.codex_executable.clone()),
            repo_root: input.repo_root.clone(),
            prompt: input.operator_prompt.clone(),
            resume_thread_id: input.codex_thread_id.clone(),
            sandbox: input.sandbox,
            approval_policy: input.approval_policy,
            skip_git_repo_check: input.skip_git_repo_check,
            timeout_ms: Some(input.timeout_ms),
            stdout_cap_bytes: Some(input.stdout_cap_bytes),
            stderr_cap_bytes: Some(input.stderr_cap_bytes),
            output_last_message_path: None,
        };
        let mut persistence_error = None;
        let mut on_stream_event = |event: CodexDirectStreamEvent| {
            if persistence_error.is_none() {
                if let Err(error) = self.persist_direct_work_stream_event(&input, run_id, &event) {
                    persistence_error = Some(error);
                }
            }

            emit_event(direct_work_stream_event_summary(&input, run_id, &event));
        };

        let output = runner(request, &mut on_stream_event);

        if let Some(error) = persistence_error {
            return Err(error);
        }

        self.finish_direct_work_stream(&input, run_id, &output)
    }

    fn persist_direct_work_stream_event(
        &self,
        input: &NormalizedDirectWorkInput,
        run_id: &str,
        event: &CodexDirectStreamEvent,
    ) -> Result<(), WorkspaceServiceError> {
        let Some((level, message, payload)) = direct_work_stream_log_record(event) else {
            return Ok(());
        };

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget, _run)) = validate_widget_run_ownership(
                    store,
                    &input.workspace_id,
                    &input.workbench_id,
                    &input.widget_instance_id,
                    run_id,
                )?
                else {
                    return Ok(());
                };

                if !can_initiate_direct_work(&widget.definition_id) {
                    return Ok(());
                }

                append_direct_work_log(
                    store,
                    &widget.id,
                    Some(run_id),
                    level,
                    message,
                    Some(&payload),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(())
            })
            .map_err(WorkspaceServiceError::from)
    }

    fn finish_direct_work_stream(
        &self,
        input: &NormalizedDirectWorkInput,
        run_id: &str,
        output: &CodexDirectStreamOutput,
    ) -> Result<Option<CodexDirectWorkRunSummary>, WorkspaceServiceError> {
        let final_status = direct_work_stream_final_status(output.status);
        let final_status_value = widget_run_status_value(&final_status);
        let result_summary = direct_work_stream_result_summary(output);
        let result_payload = direct_work_stream_result_payload(input, output, final_status_value);
        let completion_message = if output.force_killed {
            "Codex process force-killed"
        } else {
            direct_work_stream_completion_log_message(output.status)
        };
        let completion_log_level = direct_work_stream_completion_log_level(output.status);
        let completion_payload =
            direct_work_stream_completion_log_payload(output, final_status_value);

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
                    stdout: output.stdout_collected.clone(),
                    stderr: output.stderr_collected.clone(),
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

pub(super) fn insert_codex_direct_work_stream_start(
    store: &SqliteStore,
    input: &NormalizedDirectWorkInput,
) -> Result<Option<CodexDirectWorkStreamStartSummary>, hobit_storage_sqlite::StorageError> {
    let _input_artifacts = direct_work_input_runtime_artifacts(input);
    let command_payload = direct_work_stream_command_payload(input);
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
        command_payload: Some(&command_payload),
        started_at: None,
        finished_at: None,
        summary: Some("Codex Direct Work stream running"),
    })?;

    append_direct_work_log(
        store,
        &widget.id,
        Some(&run.id),
        WIDGET_LOG_INFO_LEVEL,
        "Direct Work stream requested",
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

    Ok(Some(CodexDirectWorkStreamStartSummary {
        run_id: run.id,
        status: "started".to_owned(),
    }))
}

fn direct_work_stream_event_summary(
    input: &NormalizedDirectWorkInput,
    run_id: &str,
    event: &CodexDirectStreamEvent,
) -> CodexDirectWorkStreamEventSummary {
    let _event_artifact = DirectWorkStreamEventRuntimeArtifact::from_event(event);

    CodexDirectWorkStreamEventSummary {
        workspace_id: input.workspace_id.clone(),
        workbench_id: input.workbench_id.clone(),
        widget_instance_id: input.widget_instance_id.clone(),
        run_id: run_id.to_owned(),
        event_kind: event.kind.as_str().to_owned(),
        line: event.line.clone(),
        text: event.text.clone(),
        parsed_codex_event_type: parsed_codex_event_type(event.parsed_json.as_deref()),
        codex_thread_id: parsed_codex_thread_id(event.parsed_json.as_deref()),
        status: stream_event_status(event.kind).map(ToOwned::to_owned),
        elapsed_ms: event.elapsed_ms,
        is_final: is_final_stream_event(event.kind),
        error_message: event.error_message.clone(),
        stderr_preview: event.stderr_preview.clone(),
        exit_code: event.exit_code,
        final_status: event.final_status.clone(),
        failed_stage: event.failed_stage.clone(),
    }
}

fn direct_work_stream_log_record(
    event: &CodexDirectStreamEvent,
) -> Option<(&'static str, &'static str, String)> {
    let (level, message) = match event.kind {
        CodexDirectStreamEventKind::Started => (WIDGET_LOG_INFO_LEVEL, "Codex stream started"),
        CodexDirectStreamEventKind::StdoutLine => (WIDGET_LOG_INFO_LEVEL, "Codex stdout"),
        CodexDirectStreamEventKind::StderrLine => (WIDGET_LOG_INFO_LEVEL, "Codex stderr"),
        CodexDirectStreamEventKind::CodexJsonEvent => (WIDGET_LOG_INFO_LEVEL, "Codex JSON event"),
        CodexDirectStreamEventKind::FinalMessage => {
            (WIDGET_LOG_INFO_LEVEL, "Codex final message received")
        }
        CodexDirectStreamEventKind::Completed => (WIDGET_LOG_INFO_LEVEL, "Codex stream completed"),
        CodexDirectStreamEventKind::Failed => (WIDGET_LOG_ERROR_LEVEL, "Codex stream failed"),
        CodexDirectStreamEventKind::TimedOut => (WIDGET_LOG_ERROR_LEVEL, "Codex stream timed_out"),
        CodexDirectStreamEventKind::Cancelled => (WIDGET_LOG_INFO_LEVEL, "Codex stream cancelled"),
    };

    Some((
        level,
        message,
        json!({
            "event_kind": event.kind.as_str(),
            "elapsed_ms": capped_duration_ms(event.elapsed_ms),
            "line": &event.line,
            "text": &event.text,
            "parsed_codex_event_type": parsed_codex_event_type(event.parsed_json.as_deref()),
            "codex_thread_id": parsed_codex_thread_id(event.parsed_json.as_deref()),
            "error_message": &event.error_message,
            "stderr_preview": &event.stderr_preview,
            "exit_code": event.exit_code,
            "final_status": &event.final_status,
            "failed_stage": &event.failed_stage,
            "is_final": is_final_stream_event(event.kind),
        })
        .to_string(),
    ))
}

fn direct_work_stream_final_status(status: CodexDirectStreamStatus) -> WidgetRunStatus {
    match status {
        CodexDirectStreamStatus::Completed => WidgetRunStatus::Completed,
        CodexDirectStreamStatus::Failed | CodexDirectStreamStatus::FailedToStart => {
            WidgetRunStatus::Failed
        }
        CodexDirectStreamStatus::TimedOut => WidgetRunStatus::TimedOut,
        CodexDirectStreamStatus::Cancelled => WidgetRunStatus::Cancelled,
    }
}

fn direct_work_stream_result_summary(output: &CodexDirectStreamOutput) -> String {
    if output.force_killed {
        return "Codex Direct Work stream force-killed".to_owned();
    }

    match output.status {
        CodexDirectStreamStatus::Completed => "Codex Direct Work stream completed".to_owned(),
        CodexDirectStreamStatus::Failed => "Codex Direct Work stream failed".to_owned(),
        CodexDirectStreamStatus::FailedToStart => {
            "Codex Direct Work stream failed to start".to_owned()
        }
        CodexDirectStreamStatus::TimedOut => "Codex Direct Work stream timed out".to_owned(),
        CodexDirectStreamStatus::Cancelled => "Codex Direct Work stream cancelled".to_owned(),
    }
}

fn direct_work_stream_completion_log_message(status: CodexDirectStreamStatus) -> &'static str {
    match status {
        CodexDirectStreamStatus::Completed => "Codex process completed",
        CodexDirectStreamStatus::Failed | CodexDirectStreamStatus::FailedToStart => {
            "Codex process failed"
        }
        CodexDirectStreamStatus::TimedOut => "Codex process timed_out",
        CodexDirectStreamStatus::Cancelled => "Codex process cancelled",
    }
}

fn direct_work_stream_completion_log_level(status: CodexDirectStreamStatus) -> &'static str {
    match status {
        CodexDirectStreamStatus::Completed => WIDGET_LOG_INFO_LEVEL,
        CodexDirectStreamStatus::Failed
        | CodexDirectStreamStatus::FailedToStart
        | CodexDirectStreamStatus::TimedOut => WIDGET_LOG_ERROR_LEVEL,
        CodexDirectStreamStatus::Cancelled => WIDGET_LOG_INFO_LEVEL,
    }
}

fn direct_work_stream_completion_log_payload(
    output: &CodexDirectStreamOutput,
    final_status: &str,
) -> String {
    json!({
        "streaming": true,
        "codex_status": output.status.as_str(),
        "status": final_status,
        "exit_code": output.exit_code,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "final_message_present": output.final_message.is_some(),
        "event_count": output.event_count,
        "error_message": &output.error_message,
        "failed_stage": direct_work_stream_failed_stage(output.status),
        "cancellation_requested": output.status == CodexDirectStreamStatus::Cancelled,
        "force_killed": output.force_killed,
    })
    .to_string()
}

fn direct_work_stream_command_payload(input: &NormalizedDirectWorkInput) -> String {
    json!({
        "executor_kind": CODEX_DIRECT_WORK_EXECUTOR_KIND,
        "mode": CODEX_DIRECT_WORK_MODE,
        "streaming": true,
        "repo_root": input.repo_root.display().to_string(),
        "codex_executable": &input.codex_executable,
        "operator_prompt": &input.operator_prompt,
        "codex_thread_id": &input.codex_thread_id,
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

fn direct_work_stream_result_payload(
    input: &NormalizedDirectWorkInput,
    output: &CodexDirectStreamOutput,
    final_status: &str,
) -> String {
    let _output_artifacts = DirectWorkOutputRuntimeArtifacts::from_stream_output(output);

    json!({
        "executor_kind": CODEX_DIRECT_WORK_EXECUTOR_KIND,
        "mode": CODEX_DIRECT_WORK_MODE,
        "streaming": true,
        "repo_root": input.repo_root.display().to_string(),
        "codex_executable": &input.codex_executable,
        "sandbox": direct_work_sandbox_value(input.sandbox),
        "approval_policy": direct_work_approval_policy_value(input.approval_policy),
        "skip_git_repo_check": input.skip_git_repo_check,
        "operator_prompt": &input.operator_prompt,
        "codex_thread_id": &input.codex_thread_id,
        "command_summary": &output.command_summary,
        "status": final_status,
        "codex_status": output.status.as_str(),
        "exit_code": output.exit_code,
        "stdout": &output.stdout_collected,
        "stderr": &output.stderr_collected,
        "stdout_truncated": output.stdout_truncated,
        "stderr_truncated": output.stderr_truncated,
        "final_message": &output.final_message,
        "duration_ms": capped_duration_ms(output.duration_ms),
        "error_message": &output.error_message,
        "failed_stage": direct_work_stream_failed_stage(output.status),
        "cancellation_requested": output.status == CodexDirectStreamStatus::Cancelled,
        "force_killed": output.force_killed,
        "event_count": output.event_count,
        "no_auto_commit": true,
        "no_auto_push": true,
        "git_mutations_performed_by_hobit": false,
    })
    .to_string()
}

fn parsed_codex_event_type(parsed_json: Option<&str>) -> Option<String> {
    let value = serde_json::from_str::<Value>(parsed_json?).ok()?;
    value
        .get("type")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn parsed_codex_thread_id(parsed_json: Option<&str>) -> Option<String> {
    let value = serde_json::from_str::<Value>(parsed_json?).ok()?;
    if value.get("type").and_then(Value::as_str) != Some("thread.started") {
        return None;
    }

    value
        .get("thread_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|thread_id| !thread_id.is_empty())
        .map(ToOwned::to_owned)
}

fn stream_event_status(kind: CodexDirectStreamEventKind) -> Option<&'static str> {
    match kind {
        CodexDirectStreamEventKind::Completed => Some("completed"),
        CodexDirectStreamEventKind::Failed => Some("failed"),
        CodexDirectStreamEventKind::TimedOut => Some("timed_out"),
        CodexDirectStreamEventKind::Cancelled => Some("cancelled"),
        _ => None,
    }
}

fn is_final_stream_event(kind: CodexDirectStreamEventKind) -> bool {
    matches!(
        kind,
        CodexDirectStreamEventKind::Completed
            | CodexDirectStreamEventKind::Failed
            | CodexDirectStreamEventKind::TimedOut
            | CodexDirectStreamEventKind::Cancelled
    )
}

fn direct_work_stream_failed_stage(status: CodexDirectStreamStatus) -> Option<&'static str> {
    match status {
        CodexDirectStreamStatus::Completed => None,
        CodexDirectStreamStatus::FailedToStart => Some("process_start"),
        CodexDirectStreamStatus::TimedOut => Some("codex_stream"),
        CodexDirectStreamStatus::Failed => Some("codex_exit"),
        CodexDirectStreamStatus::Cancelled => None,
    }
}
