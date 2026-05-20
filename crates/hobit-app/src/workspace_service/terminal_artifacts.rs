use std::path::Path;

use hobit_tools::process::{ProcessRunOutput, ProcessRunStatus};

use crate::{
    RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeErrorKind, RuntimeExecutionStatus,
    RuntimeKind, RuntimeRedactionStatus,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct TerminalCommandRuntimeArtifacts {
    pub(super) command_payload: RuntimeArtifactSummary,
    pub(super) working_directory: RuntimeArtifactSummary,
}

impl TerminalCommandRuntimeArtifacts {
    pub(super) fn from_command(program: &str, args: &[String], working_directory: &Path) -> Self {
        Self {
            command_payload: command_payload_artifact(program, args),
            working_directory: local_path_artifact(working_directory),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct TerminalOutputRuntimeArtifacts {
    pub(super) stdout: RuntimeArtifactSummary,
    pub(super) stderr: RuntimeArtifactSummary,
    pub(super) runtime_error: Option<RuntimeArtifactSummary>,
    pub(super) status: TerminalRuntimeBoundarySummary,
}

impl TerminalOutputRuntimeArtifacts {
    pub(super) fn from_process_output(output: &ProcessRunOutput) -> Self {
        Self {
            stdout: stdout_artifact(&output.stdout, output.stdout_truncated),
            stderr: stderr_artifact(&output.stderr, output.stderr_truncated),
            runtime_error: output.error_message.as_deref().map(runtime_error_artifact),
            status: TerminalRuntimeBoundarySummary::from_process_status(
                output.status,
                output.error_message.as_deref(),
                output.stdout_truncated || output.stderr_truncated,
            ),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct TerminalRuntimeBoundarySummary {
    pub(super) runtime_kind: RuntimeKind,
    pub(super) execution_status: RuntimeExecutionStatus,
    pub(super) error_kind: Option<RuntimeErrorKind>,
    pub(super) artifact: RuntimeArtifactSummary,
}

impl TerminalRuntimeBoundarySummary {
    pub(super) fn from_process_status(
        status: ProcessRunStatus,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let execution_status = match status {
            ProcessRunStatus::Completed => RuntimeExecutionStatus::Succeeded,
            ProcessRunStatus::FailedToStart => RuntimeExecutionStatus::Failed,
            ProcessRunStatus::TimedOut => RuntimeExecutionStatus::TimedOut,
        };
        let error_kind = match status {
            ProcessRunStatus::Completed => None,
            ProcessRunStatus::FailedToStart => Some(RuntimeErrorKind::FailedToStart),
            ProcessRunStatus::TimedOut => Some(RuntimeErrorKind::TimedOut),
        };

        Self::from_parts(execution_status, error_kind, error_message, capped)
    }

    #[cfg(test)]
    pub(super) fn from_pty_status(status: &str, error_message: Option<&str>, capped: bool) -> Self {
        let (execution_status, error_kind) = match status {
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
            "unsupported" => (
                RuntimeExecutionStatus::Unsupported,
                Some(RuntimeErrorKind::Unsupported),
            ),
            _ => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::Unknown),
            ),
        };

        Self::from_parts(execution_status, error_kind, error_message, capped)
    }

    fn from_parts(
        execution_status: RuntimeExecutionStatus,
        error_kind: Option<RuntimeErrorKind>,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let mut artifact = match error_kind {
            Some(_) => runtime_error_artifact(error_message.unwrap_or("terminal runtime error")),
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

pub(super) fn command_payload_artifact(program: &str, args: &[String]) -> RuntimeArtifactSummary {
    let byte_count = std::iter::once(program)
        .chain(args.iter().map(String::as_str))
        .map(str::len)
        .sum();

    RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(byte_count)
        .with_item_count(args.len() + 1)
}

pub(super) fn local_path_artifact(path: &Path) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(path.as_os_str().to_string_lossy().len())
}

pub(super) fn stdout_artifact(stdout: &str, truncated: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(stdout.as_bytes().len(), truncated)
}

pub(super) fn stderr_artifact(stderr: &str, truncated: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(stderr.as_bytes().len(), truncated)
}

#[cfg(test)]
pub(super) fn pty_output_artifact(output: &str, dropped_or_capped: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(output.as_bytes().len(), dropped_or_capped)
}

pub(super) fn runtime_error_artifact(error: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(error.len())
}

fn raw_tool_output_artifact(byte_count: usize, capped: bool) -> RuntimeArtifactSummary {
    let mut artifact = RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(byte_count);
    if capped {
        artifact = artifact.capped();
    }
    artifact
}

fn safe_status_metadata_artifact(capped: bool) -> RuntimeArtifactSummary {
    let mut artifact = RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
        .with_redaction_status(RuntimeRedactionStatus::NotNeeded);
    if capped {
        artifact = artifact.capped();
    }
    artifact
}
