use super::direct_work_artifacts::{
    command_payload_artifact, generated_response_artifact, local_path_artifact,
    operator_prompt_artifact, runtime_error_artifact, status_metadata_artifact, stderr_artifact,
    stdout_artifact, DirectWorkInputRuntimeArtifacts, DirectWorkOutputRuntimeArtifacts,
    DirectWorkRuntimeBoundarySummary, DirectWorkStreamEventRuntimeArtifact,
    DirectWorkValidationRuntimeArtifacts,
};
use crate::{
    RuntimeArtifactClass, RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind,
    RuntimeRedactionStatus,
};
use hobit_tools::{
    codex_cli::{
        CodexApprovalPolicy, CodexDirectRunOutput, CodexDirectRunStatus, CodexDirectStreamEvent,
        CodexDirectStreamEventKind, CodexDirectStreamStatus, CodexSandboxMode,
    },
    toolbelt::{ToolbeltValidationOutput, ToolbeltValidationProfile, ToolbeltValidationStatus},
};
use std::path::PathBuf;

#[test]
fn direct_work_operator_prompt_is_operator_text() {
    let artifact = operator_prompt_artifact("Implement the focused block.");

    assert_eq!(RuntimeArtifactClass::OperatorText, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn direct_work_repo_root_is_local_path() {
    let artifact = local_path_artifact(&PathBuf::from("C:/Users/Private/project"));

    assert_eq!(RuntimeArtifactClass::LocalPath, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn direct_work_stdout_and_stderr_are_raw_tool_output() {
    let stdout = stdout_artifact("stdout password=secret", false);
    let stderr = stderr_artifact("stderr token=secret", true);

    assert_eq!(RuntimeArtifactClass::RawToolOutput, stdout.artifact_class);
    assert_eq!(RuntimeArtifactClass::RawToolOutput, stderr.artifact_class);
    assert!(!stdout.capped);
    assert!(stderr.capped);
}

#[test]
fn direct_work_final_response_is_generated_response() {
    let artifact = generated_response_artifact("Final response token=secret");

    assert_eq!(
        RuntimeArtifactClass::GeneratedResponse,
        artifact.artifact_class
    );
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn direct_work_runtime_and_validation_errors_are_runtime_error() {
    let runtime_error = runtime_error_artifact("codex exec failed password=secret");
    let validation = DirectWorkValidationRuntimeArtifacts::from_output(&validation_output(
        ToolbeltValidationStatus::Failed,
    ));

    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        runtime_error.artifact_class
    );
    assert_eq!(
        RuntimeRedactionStatus::Redacted,
        runtime_error.redaction_status
    );
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        validation
            .runtime_error
            .expect("validation error")
            .artifact_class
    );
    assert_eq!(
        RuntimeExecutionStatus::Failed,
        validation.status.execution_status
    );
    assert_eq!(
        Some(RuntimeErrorKind::ValidationFailed),
        validation.status.error_kind
    );
}

#[test]
fn direct_work_safe_status_metadata_is_safe_only_for_normalized_status() {
    let safe = status_metadata_artifact("completed", false);
    let path = status_metadata_artifact("C:/Users/Private/project", false);
    let command = status_metadata_artifact("codex exec --cd C:/Users/Private/project", false);
    let secret = status_metadata_artifact("token=secret", false);
    let output = status_metadata_artifact("stdout raw output", false);

    assert_eq!(RuntimeArtifactClass::SafeMetadata, safe.artifact_class);
    assert_eq!(RuntimeRedactionStatus::NotNeeded, safe.redaction_status);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, path.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, command.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, secret.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, output.artifact_class);
}

#[test]
fn direct_work_artifact_ai_context_and_evidence_default_to_false() {
    let artifacts = DirectWorkInputRuntimeArtifacts::from_input(
        "Prompt with password=secret",
        &PathBuf::from("C:/Users/Private/project"),
        &["codex", "exec", "--cd", "C:/Users/Private/project"],
        false,
    );

    assert!(!artifacts.operator_prompt.ai_context_eligible);
    assert!(!artifacts.operator_prompt.evidence_eligible);
    assert!(!artifacts.repo_root.ai_context_eligible);
    assert!(!artifacts.repo_root.evidence_eligible);
    assert!(!artifacts.command_payload.ai_context_eligible);
    assert!(!artifacts.command_payload.evidence_eligible);
}

#[test]
fn direct_work_statuses_map_to_runtime_status_vocabulary() {
    let run_failed = DirectWorkRuntimeBoundarySummary::from_run_status(
        CodexDirectRunStatus::Failed,
        Some("codex exec failed"),
        false,
    );
    let run_timeout = DirectWorkRuntimeBoundarySummary::from_run_status(
        CodexDirectRunStatus::TimedOut,
        Some("codex exec timed out"),
        false,
    );
    let stream_cancelled = DirectWorkRuntimeBoundarySummary::from_stream_status(
        CodexDirectStreamStatus::Cancelled,
        false,
        Some("codex exec cancelled"),
        false,
    );
    let stream_force_killed = DirectWorkRuntimeBoundarySummary::from_stream_status(
        CodexDirectStreamStatus::Cancelled,
        true,
        Some("codex exec force killed"),
        false,
    );
    let cancel_requested = DirectWorkRuntimeBoundarySummary::from_cancellation_request(false);
    let force_kill_requested = DirectWorkRuntimeBoundarySummary::from_cancellation_request(true);

    assert_eq!(RuntimeKind::AgentExecutor, run_failed.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Failed, run_failed.execution_status);
    assert_eq!(
        Some(RuntimeErrorKind::ExecutionFailed),
        run_failed.error_kind
    );
    assert_eq!(
        RuntimeExecutionStatus::TimedOut,
        run_timeout.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::TimedOut), run_timeout.error_kind);
    assert_eq!(
        RuntimeExecutionStatus::Cancelled,
        stream_cancelled.execution_status
    );
    assert_eq!(
        RuntimeExecutionStatus::ForceKilled,
        stream_force_killed.execution_status
    );
    assert_eq!(
        Some(RuntimeErrorKind::ForceKilled),
        stream_force_killed.error_kind
    );
    assert_eq!(
        RuntimeExecutionStatus::CancelRequested,
        cancel_requested.execution_status
    );
    assert_eq!(
        RuntimeExecutionStatus::ForceKillRequested,
        force_kill_requested.execution_status
    );
    assert_eq!(
        RuntimeArtifactClass::SafeMetadata,
        cancel_requested.artifact.artifact_class
    );
}

#[test]
fn direct_work_stream_events_classify_raw_and_generated_content() {
    let stdout = DirectWorkStreamEventRuntimeArtifact::from_event(&stream_event(
        CodexDirectStreamEventKind::StdoutLine,
        Some("stdout token=secret"),
        None,
        None,
    ));
    let final_message = DirectWorkStreamEventRuntimeArtifact::from_event(&stream_event(
        CodexDirectStreamEventKind::FinalMessage,
        None,
        Some("Final response"),
        None,
    ));
    let failed = DirectWorkStreamEventRuntimeArtifact::from_event(&stream_event(
        CodexDirectStreamEventKind::Failed,
        None,
        None,
        Some("stderr preview token=secret"),
    ));

    assert_eq!(
        RuntimeArtifactClass::RawToolOutput,
        stdout.artifact.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::GeneratedResponse,
        final_message.artifact.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        failed.artifact.artifact_class
    );
}

#[test]
fn direct_work_debug_output_omits_prompts_args_output_responses_paths_env_and_secrets() {
    let input_artifacts = DirectWorkInputRuntimeArtifacts::from_input(
        "Operator prompt sk-secret-direct-work",
        &PathBuf::from("C:/Users/Private/project"),
        &[
            "codex",
            "exec",
            "--cd",
            "C:/Users/Private/project",
            "--env",
            "SECRET=value",
        ],
        false,
    );
    let output_artifacts = DirectWorkOutputRuntimeArtifacts::from_run_output(&run_output(
        CodexDirectRunStatus::Failed,
    ));
    let validation_artifacts = DirectWorkValidationRuntimeArtifacts::from_output(
        &validation_output(ToolbeltValidationStatus::Failed),
    );
    let command = command_payload_artifact(
        &[
            "codex",
            "exec",
            "--secret",
            "password=secret",
            "C:/Users/Private/project",
        ],
        false,
    );

    let debug =
        format!("{input_artifacts:?} {output_artifacts:?} {validation_artifacts:?} {command:?}");

    assert!(debug.contains("AgentExecutor"));
    assert!(debug.contains("OperatorText"));
    assert!(debug.contains("LocalPath"));
    assert!(debug.contains("RawToolOutput"));
    assert!(debug.contains("GeneratedResponse") || debug.contains("RuntimeError"));
    assert!(!debug.contains("Operator prompt"));
    assert!(!debug.contains("codex exec"));
    assert!(!debug.contains("--secret"));
    assert!(!debug.contains("stdout sk-secret-direct-work"));
    assert!(!debug.contains("stderr password=secret"));
    assert!(!debug.contains("Final response sk-secret-direct-work"));
    assert!(!debug.contains("validation stdout"));
    assert!(!debug.contains("validation stderr"));
    assert!(!debug.contains("C:/Users/Private/project"));
    assert!(!debug.contains("SECRET=value"));
    assert!(!debug.contains("password=secret"));
    assert!(!debug.contains("sk-secret-direct-work"));
}

fn run_output(status: CodexDirectRunStatus) -> CodexDirectRunOutput {
    CodexDirectRunOutput {
        status,
        exit_code: if status == CodexDirectRunStatus::Completed {
            Some(0)
        } else {
            Some(1)
        },
        stdout: "stdout sk-secret-direct-work".to_owned(),
        stderr: "stderr password=secret".to_owned(),
        final_message: Some("Final response sk-secret-direct-work".to_owned()),
        stdout_truncated: false,
        stderr_truncated: true,
        duration_ms: 12,
        error_message: if status == CodexDirectRunStatus::Completed {
            None
        } else {
            Some("codex exec failed C:/Users/Private/project SECRET=value".to_owned())
        },
        command_summary: vec![
            "codex".to_owned(),
            "exec".to_owned(),
            "--cd".to_owned(),
            "C:/Users/Private/project".to_owned(),
        ],
        repo_root: PathBuf::from("C:/Users/Private/project"),
        sandbox: CodexSandboxMode::WorkspaceWrite,
        approval_policy: CodexApprovalPolicy::OnRequest,
    }
}

fn validation_output(status: ToolbeltValidationStatus) -> ToolbeltValidationOutput {
    ToolbeltValidationOutput {
        status,
        profile: ToolbeltValidationProfile::Fast,
        exit_code: if status == ToolbeltValidationStatus::Passed {
            Some(0)
        } else {
            Some(1)
        },
        stdout: "validation stdout sk-secret-direct-work".to_owned(),
        stderr: "validation stderr password=secret".to_owned(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 14,
        error_message: if status == ToolbeltValidationStatus::Passed {
            None
        } else {
            Some("validation failed C:/Users/Private/project token=secret".to_owned())
        },
        command_summary: vec![
            "powershell".to_owned(),
            "-File".to_owned(),
            "scripts/hobit/validate.ps1".to_owned(),
            "-Profile".to_owned(),
            "fast".to_owned(),
        ],
        repo_root: PathBuf::from("C:/Users/Private/project"),
    }
}

fn stream_event(
    kind: CodexDirectStreamEventKind,
    line: Option<&str>,
    text: Option<&str>,
    stderr_preview: Option<&str>,
) -> CodexDirectStreamEvent {
    CodexDirectStreamEvent {
        kind,
        elapsed_ms: 1,
        line: line.map(ToOwned::to_owned),
        text: text.map(ToOwned::to_owned),
        parsed_json: None,
        error_message: None,
        stderr_preview: stderr_preview.map(ToOwned::to_owned),
        exit_code: None,
        final_status: None,
        failed_stage: None,
    }
}
