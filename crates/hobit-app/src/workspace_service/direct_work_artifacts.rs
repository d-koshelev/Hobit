use std::path::Path;

use hobit_tools::{
    codex_cli::{
        CodexDirectRunOutput, CodexDirectRunStatus, CodexDirectStreamEvent,
        CodexDirectStreamEventKind, CodexDirectStreamOutput, CodexDirectStreamStatus,
    },
    toolbelt::{ToolbeltValidationOutput, ToolbeltValidationStatus},
};

use crate::{
    RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeErrorKind, RuntimeExecutionStatus,
    RuntimeKind, RuntimeRedactionStatus,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkInputRuntimeArtifacts {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) operator_prompt: RuntimeArtifactSummary,
    pub(crate) repo_root: RuntimeArtifactSummary,
    pub(crate) command_payload: RuntimeArtifactSummary,
    pub(crate) status: DirectWorkRuntimeBoundarySummary,
}

impl DirectWorkInputRuntimeArtifacts {
    pub(crate) fn from_input(
        operator_prompt: &str,
        repo_root: &Path,
        command_parts: &[&str],
        command_capped: bool,
    ) -> Self {
        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            operator_prompt: operator_prompt_artifact(operator_prompt),
            repo_root: local_path_artifact(repo_root),
            command_payload: command_payload_artifact(command_parts, command_capped),
            status: DirectWorkRuntimeBoundarySummary::from_status_metadata("starting", false),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkOutputRuntimeArtifacts {
    pub(crate) stdout: RuntimeArtifactSummary,
    pub(crate) stderr: RuntimeArtifactSummary,
    pub(crate) final_response: Option<RuntimeArtifactSummary>,
    pub(crate) runtime_error: Option<RuntimeArtifactSummary>,
    pub(crate) status: DirectWorkRuntimeBoundarySummary,
}

impl DirectWorkOutputRuntimeArtifacts {
    pub(crate) fn from_run_output(output: &CodexDirectRunOutput) -> Self {
        let output_capped = output.stdout_truncated || output.stderr_truncated;

        Self {
            stdout: stdout_artifact(&output.stdout, output.stdout_truncated),
            stderr: stderr_artifact(&output.stderr, output.stderr_truncated),
            final_response: output
                .final_message
                .as_deref()
                .map(generated_response_artifact),
            runtime_error: output.error_message.as_deref().map(runtime_error_artifact),
            status: DirectWorkRuntimeBoundarySummary::from_run_status(
                output.status,
                output.error_message.as_deref(),
                output_capped,
            ),
        }
    }

    pub(crate) fn from_stream_output(output: &CodexDirectStreamOutput) -> Self {
        let output_capped = output.stdout_truncated || output.stderr_truncated;

        Self {
            stdout: stdout_artifact(&output.stdout_collected, output.stdout_truncated),
            stderr: stderr_artifact(&output.stderr_collected, output.stderr_truncated),
            final_response: output
                .final_message
                .as_deref()
                .map(generated_response_artifact),
            runtime_error: output.error_message.as_deref().map(runtime_error_artifact),
            status: DirectWorkRuntimeBoundarySummary::from_stream_status(
                output.status,
                output.force_killed,
                output.error_message.as_deref(),
                output_capped,
            ),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkValidationRuntimeArtifacts {
    pub(crate) repo_root: RuntimeArtifactSummary,
    pub(crate) command_payload: RuntimeArtifactSummary,
    pub(crate) stdout: RuntimeArtifactSummary,
    pub(crate) stderr: RuntimeArtifactSummary,
    pub(crate) runtime_error: Option<RuntimeArtifactSummary>,
    pub(crate) status: DirectWorkRuntimeBoundarySummary,
}

impl DirectWorkValidationRuntimeArtifacts {
    pub(crate) fn from_output(output: &ToolbeltValidationOutput) -> Self {
        let output_capped = output.stdout_truncated || output.stderr_truncated;
        let command_parts = output
            .command_summary
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();

        Self {
            repo_root: local_path_artifact(&output.repo_root),
            command_payload: command_payload_artifact(&command_parts, false),
            stdout: stdout_artifact(&output.stdout, output.stdout_truncated),
            stderr: stderr_artifact(&output.stderr, output.stderr_truncated),
            runtime_error: validation_runtime_error(output),
            status: DirectWorkRuntimeBoundarySummary::from_validation_status(
                output.status,
                output.error_message.as_deref(),
                output_capped,
            ),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkStreamEventRuntimeArtifact {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) execution_status: RuntimeExecutionStatus,
    pub(crate) error_kind: Option<RuntimeErrorKind>,
    pub(crate) artifact: RuntimeArtifactSummary,
}

impl DirectWorkStreamEventRuntimeArtifact {
    pub(crate) fn from_event(event: &CodexDirectStreamEvent) -> Self {
        let (execution_status, error_kind, artifact) = match event.kind {
            CodexDirectStreamEventKind::Started => (
                RuntimeExecutionStatus::Starting,
                None,
                status_metadata_artifact("started", false),
            ),
            CodexDirectStreamEventKind::StdoutLine
            | CodexDirectStreamEventKind::StderrLine
            | CodexDirectStreamEventKind::CodexJsonEvent => {
                let text = event
                    .line
                    .as_deref()
                    .or(event.text.as_deref())
                    .or(event.parsed_json.as_deref())
                    .unwrap_or_default();
                (
                    RuntimeExecutionStatus::Running,
                    None,
                    raw_tool_output_artifact(text.len(), false),
                )
            }
            CodexDirectStreamEventKind::FinalMessage => {
                let text = event.text.as_deref().unwrap_or_default();
                (
                    RuntimeExecutionStatus::Running,
                    None,
                    generated_response_artifact(text),
                )
            }
            CodexDirectStreamEventKind::Completed => (
                RuntimeExecutionStatus::Succeeded,
                None,
                status_metadata_artifact("completed", false),
            ),
            CodexDirectStreamEventKind::Failed => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::ExecutionFailed),
                stream_event_error_artifact(event),
            ),
            CodexDirectStreamEventKind::TimedOut => (
                RuntimeExecutionStatus::TimedOut,
                Some(RuntimeErrorKind::TimedOut),
                stream_event_error_artifact(event),
            ),
            CodexDirectStreamEventKind::Cancelled => (
                RuntimeExecutionStatus::Cancelled,
                Some(RuntimeErrorKind::Cancelled),
                stream_event_error_artifact(event),
            ),
        };

        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            execution_status,
            error_kind,
            artifact,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkRuntimeBoundarySummary {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) execution_status: RuntimeExecutionStatus,
    pub(crate) error_kind: Option<RuntimeErrorKind>,
    pub(crate) artifact: RuntimeArtifactSummary,
}

impl DirectWorkRuntimeBoundarySummary {
    pub(crate) fn from_run_status(
        status: CodexDirectRunStatus,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let (execution_status, error_kind) = match status {
            CodexDirectRunStatus::Completed => (RuntimeExecutionStatus::Succeeded, None),
            CodexDirectRunStatus::FailedToStart => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::FailedToStart),
            ),
            CodexDirectRunStatus::TimedOut => (
                RuntimeExecutionStatus::TimedOut,
                Some(RuntimeErrorKind::TimedOut),
            ),
            CodexDirectRunStatus::Failed => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::ExecutionFailed),
            ),
        };

        Self::from_parts(execution_status, error_kind, error_message, capped)
    }

    pub(crate) fn from_stream_status(
        status: CodexDirectStreamStatus,
        force_killed: bool,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let (execution_status, error_kind) = if force_killed {
            (
                RuntimeExecutionStatus::ForceKilled,
                Some(RuntimeErrorKind::ForceKilled),
            )
        } else {
            match status {
                CodexDirectStreamStatus::Completed => (RuntimeExecutionStatus::Succeeded, None),
                CodexDirectStreamStatus::FailedToStart => (
                    RuntimeExecutionStatus::Failed,
                    Some(RuntimeErrorKind::FailedToStart),
                ),
                CodexDirectStreamStatus::TimedOut => (
                    RuntimeExecutionStatus::TimedOut,
                    Some(RuntimeErrorKind::TimedOut),
                ),
                CodexDirectStreamStatus::Failed => (
                    RuntimeExecutionStatus::Failed,
                    Some(RuntimeErrorKind::ExecutionFailed),
                ),
                CodexDirectStreamStatus::Cancelled => (
                    RuntimeExecutionStatus::Cancelled,
                    Some(RuntimeErrorKind::Cancelled),
                ),
            }
        };

        Self::from_parts(execution_status, error_kind, error_message, capped)
    }

    pub(crate) fn from_validation_status(
        status: ToolbeltValidationStatus,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let (execution_status, error_kind) = match status {
            ToolbeltValidationStatus::Passed => (RuntimeExecutionStatus::Succeeded, None),
            ToolbeltValidationStatus::Failed => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::ValidationFailed),
            ),
            ToolbeltValidationStatus::FailedToStart => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::FailedToStart),
            ),
            ToolbeltValidationStatus::TimedOut => (
                RuntimeExecutionStatus::TimedOut,
                Some(RuntimeErrorKind::TimedOut),
            ),
        };

        Self::from_parts(execution_status, error_kind, error_message, capped)
    }

    pub(crate) fn from_status_metadata(status: &str, capped: bool) -> Self {
        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            execution_status: RuntimeExecutionStatus::Starting,
            error_kind: None,
            artifact: status_metadata_artifact(status, capped),
        }
    }

    pub(crate) fn from_cancellation_request(force_kill: bool) -> Self {
        if force_kill {
            return Self {
                runtime_kind: RuntimeKind::AgentExecutor,
                execution_status: RuntimeExecutionStatus::ForceKillRequested,
                error_kind: Some(RuntimeErrorKind::ForceKilled),
                artifact: status_metadata_artifact("force_kill_requested", false),
            };
        }

        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            execution_status: RuntimeExecutionStatus::CancelRequested,
            error_kind: Some(RuntimeErrorKind::Cancelled),
            artifact: status_metadata_artifact("cancel_requested", false),
        }
    }

    fn from_parts(
        execution_status: RuntimeExecutionStatus,
        error_kind: Option<RuntimeErrorKind>,
        error_message: Option<&str>,
        capped: bool,
    ) -> Self {
        let mut artifact = match error_kind {
            Some(_) => {
                runtime_error_artifact(error_message.unwrap_or("agent executor runtime error"))
            }
            None => status_metadata_artifact(status_label(execution_status), capped),
        };
        if capped {
            artifact = artifact.capped();
        }

        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            execution_status,
            error_kind,
            artifact,
        }
    }
}

pub(crate) fn operator_prompt_artifact(prompt: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::OperatorText)
        .with_redaction_status(redaction_status_for_raw_text(prompt))
        .with_byte_count(prompt.len())
}

pub(crate) fn local_path_artifact(path: &Path) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(path.as_os_str().to_string_lossy().len())
}

pub(crate) fn command_payload_artifact(
    command_parts: &[&str],
    capped: bool,
) -> RuntimeArtifactSummary {
    let byte_count = command_parts.iter().map(|part| part.len()).sum();
    let mut artifact = RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
        .with_redaction_status(redaction_status_for_parts(command_parts))
        .with_byte_count(byte_count)
        .with_item_count(command_parts.len());
    if capped {
        artifact = artifact.capped();
    }
    artifact
}

pub(crate) fn stdout_artifact(stdout: &str, truncated: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(stdout.len(), truncated)
}

pub(crate) fn stderr_artifact(stderr: &str, truncated: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(stderr.len(), truncated)
}

pub(crate) fn generated_response_artifact(response: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::GeneratedResponse)
        .with_redaction_status(redaction_status_for_raw_text(response))
        .with_byte_count(response.len())
}

pub(crate) fn runtime_error_artifact(error: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(error.len())
}

pub(crate) fn status_metadata_artifact(status: &str, capped: bool) -> RuntimeArtifactSummary {
    let mut artifact = if contains_secret_like(status) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::SecretCandidate)
            .with_redaction_status(RuntimeRedactionStatus::ContainsSecretCandidate)
            .with_byte_count(status.len())
    } else if looks_like_local_path(status) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(status.len())
    } else if looks_like_command_payload(status) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(status.len())
    } else if looks_like_raw_output(status) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(status.len())
    } else {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
            .with_summary(status)
            .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
            .with_byte_count(status.len())
    };

    if capped {
        artifact = artifact.capped();
    }
    artifact
}

fn validation_runtime_error(output: &ToolbeltValidationOutput) -> Option<RuntimeArtifactSummary> {
    match output.status {
        ToolbeltValidationStatus::Passed => None,
        ToolbeltValidationStatus::Failed
        | ToolbeltValidationStatus::FailedToStart
        | ToolbeltValidationStatus::TimedOut => output
            .error_message
            .as_deref()
            .or_else(|| validation_error_default(output.status))
            .map(runtime_error_artifact),
    }
}

fn validation_error_default(status: ToolbeltValidationStatus) -> Option<&'static str> {
    match status {
        ToolbeltValidationStatus::Passed => None,
        ToolbeltValidationStatus::Failed => Some("validation failed"),
        ToolbeltValidationStatus::FailedToStart => Some("validation failed to start"),
        ToolbeltValidationStatus::TimedOut => Some("validation timed out"),
    }
}

fn stream_event_error_artifact(event: &CodexDirectStreamEvent) -> RuntimeArtifactSummary {
    let byte_count = event
        .error_message
        .as_deref()
        .or(event.stderr_preview.as_deref())
        .or(event.final_status.as_deref())
        .unwrap_or_default()
        .len();

    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(byte_count)
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

fn status_label(status: RuntimeExecutionStatus) -> &'static str {
    match status {
        RuntimeExecutionStatus::Pending => "pending",
        RuntimeExecutionStatus::Starting => "starting",
        RuntimeExecutionStatus::Running => "running",
        RuntimeExecutionStatus::Succeeded => "succeeded",
        RuntimeExecutionStatus::Failed => "failed",
        RuntimeExecutionStatus::TimedOut => "timed_out",
        RuntimeExecutionStatus::CancelRequested => "cancel_requested",
        RuntimeExecutionStatus::Cancelled => "cancelled",
        RuntimeExecutionStatus::ForceKillRequested => "force_kill_requested",
        RuntimeExecutionStatus::ForceKilled => "force_killed",
        RuntimeExecutionStatus::Unsupported => "unsupported",
        RuntimeExecutionStatus::NotConfigured => "not_configured",
    }
}

fn redaction_status_for_parts(parts: &[&str]) -> RuntimeRedactionStatus {
    if parts.iter().any(|part| contains_secret_like(part)) {
        RuntimeRedactionStatus::ContainsSecretCandidate
    } else {
        RuntimeRedactionStatus::NotRedacted
    }
}

fn redaction_status_for_raw_text(text: &str) -> RuntimeRedactionStatus {
    if contains_secret_like(text) {
        RuntimeRedactionStatus::ContainsSecretCandidate
    } else {
        RuntimeRedactionStatus::NotRedacted
    }
}

fn contains_secret_like(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("password=")
        || lower.contains("token=")
        || lower.contains("secret=")
        || lower.contains("api_key=")
        || lower.contains("apikey=")
        || lower.contains("authorization:")
        || lower.contains("bearer ")
        || value.contains("sk-")
}

fn looks_like_local_path(value: &str) -> bool {
    let normalized = value.replace('\\', "/");
    normalized.contains(":/")
        || normalized.starts_with('/')
        || normalized.starts_with("~/")
        || normalized.contains("/Users/")
        || normalized.contains("/home/")
}

fn looks_like_command_payload(value: &str) -> bool {
    let trimmed = value.trim_start();
    trimmed.starts_with("codex ")
        || trimmed.starts_with("cargo ")
        || trimmed.starts_with("npm ")
        || trimmed.starts_with("powershell ")
        || trimmed.starts_with("bash ")
        || trimmed.contains(" --")
}

fn looks_like_raw_output(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("stdout")
        || lower.contains("stderr")
        || lower.contains("final response")
        || lower.contains("validation output")
}
