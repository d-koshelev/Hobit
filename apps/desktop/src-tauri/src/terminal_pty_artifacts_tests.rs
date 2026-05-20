use std::path::PathBuf;

use hobit_app::{
    RuntimeArtifactClass, RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind,
    RuntimeRedactionStatus,
};

use crate::terminal_pty_artifacts::{
    command_payload_artifact, local_path_artifact, pty_output_artifact, runtime_error_artifact,
    TerminalPtyCommandRuntimeArtifacts, TerminalPtyRuntimeBoundarySummary,
};

#[test]
fn pty_output_is_raw_tool_output() {
    let artifact = pty_output_artifact("pty output password=secret".len(), true);

    assert_eq!(RuntimeArtifactClass::RawToolOutput, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
    assert!(artifact.capped);
    assert!(!artifact.ai_context_eligible);
    assert!(!artifact.evidence_eligible);
}

#[test]
fn pty_shell_program_and_args_are_command_payload() {
    let artifact = command_payload_artifact(
        "powershell.exe",
        &["-NoProfile".to_owned(), "token=secret".to_owned()],
    );

    assert_eq!(
        RuntimeArtifactClass::CommandPayload,
        artifact.artifact_class
    );
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn pty_working_directory_is_local_path() {
    let artifact = local_path_artifact(&PathBuf::from("C:/Users/Private/project"));

    assert_eq!(RuntimeArtifactClass::LocalPath, artifact.artifact_class);
    assert_ne!(RuntimeArtifactClass::SafeMetadata, artifact.artifact_class);
}

#[test]
fn pty_runtime_session_errors_are_runtime_error_artifacts() {
    let artifact = runtime_error_artifact("could not start token=secret");
    let boundary = TerminalPtyRuntimeBoundarySummary::from_error("could not start token=secret");

    assert_eq!(RuntimeArtifactClass::RuntimeError, artifact.artifact_class);
    assert_eq!(RuntimeRedactionStatus::Redacted, artifact.redaction_status);
    assert_eq!(RuntimeKind::Terminal, boundary.runtime_kind);
    assert_eq!(RuntimeExecutionStatus::Failed, boundary.execution_status);
    assert_eq!(Some(RuntimeErrorKind::ExecutionFailed), boundary.error_kind);
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        boundary.artifact.artifact_class
    );
}

#[test]
fn pty_running_unsupported_stop_and_kill_statuses_map_to_runtime_vocabulary() {
    let running = TerminalPtyRuntimeBoundarySummary::from_status("running", None, false);
    let unsupported = TerminalPtyRuntimeBoundarySummary::from_error(
        "Terminal PTY sessions are currently supported only on Windows desktop",
    );
    let stopping = TerminalPtyRuntimeBoundarySummary::from_status("stopping", None, false);
    let killed = TerminalPtyRuntimeBoundarySummary::from_status("killed", None, false);

    assert_eq!(RuntimeExecutionStatus::Running, running.execution_status);
    assert_eq!(None, running.error_kind);
    assert_eq!(
        RuntimeExecutionStatus::Unsupported,
        unsupported.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::Unsupported), unsupported.error_kind);
    assert_eq!(
        RuntimeExecutionStatus::CancelRequested,
        stopping.execution_status
    );
    assert_eq!(Some(RuntimeErrorKind::Cancelled), stopping.error_kind);
    assert_eq!(RuntimeExecutionStatus::ForceKilled, killed.execution_status);
    assert_eq!(Some(RuntimeErrorKind::ForceKilled), killed.error_kind);
}

#[test]
fn pty_safe_status_metadata_is_safe_only_without_error() {
    let running = TerminalPtyRuntimeBoundarySummary::from_status("running", None, false);
    let failed = TerminalPtyRuntimeBoundarySummary::from_status(
        "running",
        Some("inspect failed env:SECRET=value"),
        false,
    );

    assert_eq!(
        RuntimeArtifactClass::SafeMetadata,
        running.artifact.artifact_class
    );
    assert_eq!(
        RuntimeArtifactClass::RuntimeError,
        failed.artifact.artifact_class
    );
}

#[test]
fn pty_ai_context_and_evidence_default_to_false() {
    let artifacts = TerminalPtyCommandRuntimeArtifacts::from_shell(
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
fn pty_caps_remain_separate_from_redaction_status() {
    let output = pty_output_artifact("pty output".len(), true);
    let status = TerminalPtyRuntimeBoundarySummary::from_status("running", None, true);

    assert!(output.capped);
    assert_eq!(RuntimeRedactionStatus::NotRedacted, output.redaction_status);
    assert!(status.artifact.capped);
    assert_eq!(
        RuntimeRedactionStatus::NotNeeded,
        status.artifact.redaction_status
    );
}

#[test]
fn pty_debug_output_omits_output_command_path_env_and_secret_values() {
    let command_artifacts = TerminalPtyCommandRuntimeArtifacts::from_shell(
        "powershell.exe",
        &[
            "-NoProfile".to_owned(),
            "Write-Output sk-secret-pty-debug".to_owned(),
        ],
        &PathBuf::from("C:/Users/Private/project"),
    );
    let output = pty_output_artifact("pty output token=secret".len(), true);
    let error =
        TerminalPtyRuntimeBoundarySummary::from_error("failed C:/Users/Private env:SECRET=value");
    let debug = format!("{command_artifacts:?} {output:?} {error:?}");

    assert!(debug.contains("CommandPayload"));
    assert!(debug.contains("RawToolOutput"));
    assert!(debug.contains("RuntimeError"));
    assert!(!debug.contains("powershell.exe"));
    assert!(!debug.contains("-NoProfile"));
    assert!(!debug.contains("Write-Output"));
    assert!(!debug.contains("pty output"));
    assert!(!debug.contains("C:/Users/Private"));
    assert!(!debug.contains("env:SECRET"));
    assert!(!debug.contains("token=secret"));
    assert!(!debug.contains("sk-secret-pty-debug"));
}
