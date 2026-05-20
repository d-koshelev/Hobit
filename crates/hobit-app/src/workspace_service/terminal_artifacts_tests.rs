use std::path::PathBuf;

use hobit_tools::process::{ProcessRunOutput, ProcessRunStatus};

use crate::{
    RuntimeArtifactClass, RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind,
    RuntimeRedactionStatus,
};

use super::terminal_artifacts::{
    command_payload_artifact, local_path_artifact, pty_output_artifact, runtime_error_artifact,
    stderr_artifact, stdout_artifact, TerminalCommandRuntimeArtifacts,
    TerminalOutputRuntimeArtifacts, TerminalRuntimeBoundarySummary,
};

#[test]
fn terminal_command_program_and_args_are_command_payload_not_safe_metadata() {
    let artifact = command_payload_artifact(
        "powershell.exe",
        &["-NoProfile".to_owned(), "password=secret".to_owned()],
    );

    assert_eq!(
        RuntimeArtifactClass::CommandPayload,
        artifact.artifact_class
    );
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
    assert!(!artifact.ai_context_eligible);
    assert!(!artifact.evidence_eligible);
}

#[test]
fn terminal_working_directory_is_local_path_not_safe_metadata() {
    let artifact = local_path_artifact(&PathBuf::from("C:/Users/Private/project"));

    assert_eq!(RuntimeArtifactClass::LocalPath, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn terminal_stdout_and_stderr_are_raw_tool_output() {
    let stdout = stdout_artifact("stdout password=secret", false);
    let stderr = stderr_artifact("stderr token=secret", true);

    assert_eq!(RuntimeArtifactClass::RawToolOutput, stdout.artifact_class);
    assert_eq!(RuntimeArtifactClass::RawToolOutput, stderr.artifact_class);
    assert!(!stdout.capped);
    assert!(stderr.capped);
}

#[test]
fn terminal_caps_remain_separate_from_redaction_status() {
    let stderr = stderr_artifact("stderr token=secret", true);
    let status = TerminalRuntimeBoundarySummary::from_process_status(
        ProcessRunStatus::Completed,
        None,
        true,
    );

    assert!(stderr.capped);
    assert_eq!(RuntimeRedactionStatus::NotRedacted, stderr.redaction_status);
    assert!(status.artifact.capped);
    assert_eq!(
        RuntimeRedactionStatus::NotNeeded,
        status.artifact.redaction_status
    );
}

#[test]
fn terminal_pty_output_is_raw_tool_output() {
    let artifact = pty_output_artifact("pty output with token=secret", true);

    assert_eq!(RuntimeArtifactClass::RawToolOutput, artifact.artifact_class);
    assert!(artifact.capped);
    assert!(!artifact.ai_context_eligible);
    assert!(!artifact.evidence_eligible);
}

#[test]
fn terminal_runtime_errors_are_runtime_error_artifacts() {
    let artifact = runtime_error_artifact("could not start password=secret");

    assert_eq!(RuntimeArtifactClass::RuntimeError, artifact.artifact_class);
    assert_eq!(RuntimeRedactionStatus::Redacted, artifact.redaction_status);
}

#[test]
fn terminal_safe_status_metadata_is_safe_only_for_status_boundary() {
    let success = TerminalRuntimeBoundarySummary::from_process_status(
        ProcessRunStatus::Completed,
        None,
        false,
    );
    let failed = TerminalRuntimeBoundarySummary::from_process_status(
        ProcessRunStatus::FailedToStart,
        Some("could not start command"),
        false,
    );

    assert_eq!(RuntimeKind::Terminal, success.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Succeeded, success.execution_status);
    assert_eq!(None, success.error_kind);
    assert_eq!(
        RuntimeArtifactClass::SafeMetadata,
        success.artifact.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        failed.artifact.artifact_class
    );
}

#[test]
fn terminal_timeout_maps_to_timed_out_runtime_status_and_error() {
    let boundary = TerminalRuntimeBoundarySummary::from_process_status(
        ProcessRunStatus::TimedOut,
        Some("process timed out"),
        false,
    );

    assert_eq!(RuntimeExecutionStatus::TimedOut, boundary.execution_status);
    assert_eq!(Some(RuntimeErrorKind::TimedOut), boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        boundary.artifact.artifact_class
    );
}

#[test]
fn terminal_pty_statuses_map_to_runtime_status_vocabulary() {
    let running = TerminalRuntimeBoundarySummary::from_pty_status("running", None, false);
    let unsupported = TerminalRuntimeBoundarySummary::from_pty_status(
        "unsupported",
        Some("Terminal PTY sessions are currently supported only on Windows desktop"),
        false,
    );
    let killed = TerminalRuntimeBoundarySummary::from_pty_status("killed", None, false);

    assert_eq!(RuntimeExecutionStatus::Running, running.execution_status);
    assert_eq!(None, running.error_kind);
    assert_eq!(
        RuntimeExecutionStatus::Unsupported,
        unsupported.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::Unsupported), unsupported.error_kind);
    assert_eq!(RuntimeExecutionStatus::ForceKilled, killed.execution_status);
    assert_eq!(Some(RuntimeErrorKind::ForceKilled), killed.error_kind);
}

#[test]
fn terminal_artifact_ai_context_and_evidence_default_to_false() {
    let artifacts = TerminalCommandRuntimeArtifacts::from_command(
        "cmd.exe",
        &["/C".to_owned(), "echo secret".to_owned()],
        &PathBuf::from("C:/Users/Private/project"),
    );

    assert!(!artifacts.command_payload.ai_context_eligible);
    assert!(!artifacts.command_payload.evidence_eligible);
    assert!(!artifacts.working_directory.ai_context_eligible);
    assert!(!artifacts.working_directory.evidence_eligible);
}

#[test]
fn terminal_debug_output_omits_command_output_paths_and_secret_values() {
    let command_artifacts = TerminalCommandRuntimeArtifacts::from_command(
        "powershell.exe",
        &[
            "-NoProfile".to_owned(),
            "Write-Output sk-secret-terminal-debug".to_owned(),
        ],
        &PathBuf::from("C:/Users/Private/project"),
    );
    let output_artifacts = TerminalOutputRuntimeArtifacts::from_process_output(&ProcessRunOutput {
        status: ProcessRunStatus::FailedToStart,
        exit_code: None,
        stdout: "stdout sk-secret-terminal-debug".to_owned(),
        stderr: "stderr password=secret".to_owned(),
        stdout_truncated: true,
        stderr_truncated: false,
        duration_ms: 12,
        error_message: Some("could not start C:/Users/Private/project env:SECRET=value".to_owned()),
    });
    let pty_output = pty_output_artifact("pty output C:/Users/Private/project token=secret", true);
    let debug = format!("{command_artifacts:?} {output_artifacts:?} {pty_output:?}");

    assert!(debug.contains("CommandPayload"));
    assert!(debug.contains("RawToolOutput"));
    assert!(debug.contains("RuntimeError"));
    assert!(!debug.contains("powershell.exe"));
    assert!(!debug.contains("-NoProfile"));
    assert!(!debug.contains("Write-Output"));
    assert!(!debug.contains("stdout sk-secret-terminal-debug"));
    assert!(!debug.contains("stderr password=secret"));
    assert!(!debug.contains("pty output"));
    assert!(!debug.contains("C:/Users/Private/project"));
    assert!(!debug.contains("env:SECRET"));
    assert!(!debug.contains("token=secret"));
}
