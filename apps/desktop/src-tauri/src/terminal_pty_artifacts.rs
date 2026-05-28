use std::path::Path;

use hobit_app::{
    RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeErrorKind, RuntimeExecutionStatus,
    RuntimeKind, RuntimeRedactionStatus,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtyCommandRuntimeArtifacts {
    pub(crate) command_payload: RuntimeArtifactSummary,
    pub(crate) working_directory: RuntimeArtifactSummary,
}

impl TerminalPtyCommandRuntimeArtifacts {
    pub(crate) fn from_shell(shell: &str, shell_args: &[String], working_directory: &Path) -> Self {
        Self {
            command_payload: command_payload_artifact(shell, shell_args),
            working_directory: local_path_artifact(working_directory),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TerminalPtyRuntimeBoundarySummary {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) execution_status: RuntimeExecutionStatus,
    pub(crate) error_kind: Option<RuntimeErrorKind>,
    pub(crate) artifact: RuntimeArtifactSummary,
}

impl TerminalPtyRuntimeBoundarySummary {
    pub(crate) fn from_status(status: &str, error_message: Option<&str>, capped: bool) -> Self {
        let (execution_status, error_kind) = pty_status_kind(status, error_message);
        Self::from_parts(execution_status, error_kind, error_message, capped)
    }

    pub(crate) fn from_error(error_message: &str) -> Self {
        if is_unsupported_pty_error(error_message) {
            return Self::from_parts(
                RuntimeExecutionStatus::Unsupported,
                Some(RuntimeErrorKind::Unsupported),
                Some(error_message),
                false,
            );
        }

        Self::from_parts(
            RuntimeExecutionStatus::Failed,
            Some(RuntimeErrorKind::ExecutionFailed),
            Some(error_message),
            false,
        )
    }

    fn from_parts(
        execution_status: RuntimeExecutionStatus,
        error_kind: Option<RuntimeErrorKind>,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let mut artifact = match error_kind {
            Some(_) => {
                runtime_error_artifact(error_message.unwrap_or("terminal PTY runtime error"))
            }
            None => safe_status_metadata_artifact(capped),
        };
        if capped {
            artifact = artifact.capped();
        }

        Self {
            runtime_kind: RuntimeKind::Terminal,
            execution_status,
            error_kind,
            artifact,
        }
    }
}

pub(crate) fn command_payload_artifact(
    shell: &str,
    shell_args: &[String],
) -> RuntimeArtifactSummary {
    let byte_count = std::iter::once(shell)
        .chain(shell_args.iter().map(String::as_str))
        .map(str::len)
        .sum();

    RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(byte_count)
        .with_item_count(shell_args.len() + 1)
}

pub(crate) fn local_path_artifact(path: &Path) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(path.as_os_str().to_string_lossy().len())
}

#[cfg(any(windows, target_os = "linux", test))]
pub(crate) fn pty_output_artifact(
    byte_count: usize,
    dropped_or_capped: bool,
) -> RuntimeArtifactSummary {
    let mut artifact = RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(byte_count);
    if dropped_or_capped {
        artifact = artifact.capped();
    }
    artifact
}

pub(crate) fn runtime_error_artifact(error: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(error.len())
}

pub(crate) fn classify_runtime_error_passthrough(error: String) -> String {
    let _runtime_boundary = TerminalPtyRuntimeBoundarySummary::from_error(&error);
    error
}

fn safe_status_metadata_artifact(capped: bool) -> RuntimeArtifactSummary {
    let mut artifact = RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
        .with_redaction_status(RuntimeRedactionStatus::NotNeeded);
    if capped {
        artifact = artifact.capped();
    }
    artifact
}

fn pty_status_kind(
    status: &str,
    error_message: Option<&str>,
) -> (RuntimeExecutionStatus, Option<RuntimeErrorKind>) {
    if error_message.is_some() {
        return (
            RuntimeExecutionStatus::Failed,
            Some(RuntimeErrorKind::ExecutionFailed),
        );
    }

    match status {
        "running" => (RuntimeExecutionStatus::Running, None),
        "stopping" => (
            RuntimeExecutionStatus::CancelRequested,
            Some(RuntimeErrorKind::Cancelled),
        ),
        "exited" => (RuntimeExecutionStatus::Succeeded, None),
        "stopped" => (
            RuntimeExecutionStatus::Cancelled,
            Some(RuntimeErrorKind::Cancelled),
        ),
        "killed" => (
            RuntimeExecutionStatus::ForceKilled,
            Some(RuntimeErrorKind::ForceKilled),
        ),
        "closed" => (RuntimeExecutionStatus::Cancelled, None),
        _ => (
            RuntimeExecutionStatus::Failed,
            Some(RuntimeErrorKind::Unknown),
        ),
    }
}

fn is_unsupported_pty_error(error_message: &str) -> bool {
    error_message.contains("supported only on Windows desktop")
        || error_message.contains("supported only on Windows and Linux desktop")
        || error_message.contains("unsupported on this platform")
}
