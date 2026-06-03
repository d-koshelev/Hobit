use std::path::Path;

use hobit_app::{
    CodexDirectWorkStreamEventSummary, RunCodexDirectWorkInput, RuntimeArtifactClass,
    RuntimeArtifactSummary, RuntimeErrorKind, RuntimeExecutionStatus, RuntimeKind,
    RuntimeRedactionStatus,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkHostStartRuntimeArtifacts {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) operator_prompt: RuntimeArtifactSummary,
    pub(crate) repo_root: RuntimeArtifactSummary,
    pub(crate) command_payload: RuntimeArtifactSummary,
    pub(crate) status: DirectWorkHostRuntimeBoundarySummary,
}

impl DirectWorkHostStartRuntimeArtifacts {
    pub(crate) fn from_input(input: &RunCodexDirectWorkInput) -> Self {
        let command_parts = direct_work_host_command_parts(input);

        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            operator_prompt: operator_prompt_artifact(&input.operator_prompt),
            repo_root: local_path_artifact(&input.repo_root),
            command_payload: command_payload_artifact(&command_parts),
            status: DirectWorkHostRuntimeBoundarySummary::from_status("starting", None),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkHostRuntimeBoundarySummary {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) execution_status: RuntimeExecutionStatus,
    pub(crate) error_kind: Option<RuntimeErrorKind>,
    pub(crate) artifact: RuntimeArtifactSummary,
}

impl DirectWorkHostRuntimeBoundarySummary {
    pub(crate) fn from_active_run_status(run_id: &str, status: &str) -> Self {
        let execution_status = status_execution_kind(status);

        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            execution_status,
            error_kind: None,
            artifact: safe_host_metadata_artifact(&[run_id, status]),
        }
    }

    pub(crate) fn from_status(status: &str, error_message: Option<&str>) -> Self {
        if let Some(error_message) = error_message {
            return Self::from_parts(
                status_execution_kind(status),
                Some(error_kind_for_status(status)),
                runtime_error_artifact(error_message),
            );
        }

        Self::from_parts(
            status_execution_kind(status),
            error_kind_for_non_error_status(status),
            safe_host_metadata_artifact(&[status]),
        )
    }

    pub(crate) fn from_host_error(error_message: &str) -> Self {
        Self::from_parts(
            RuntimeExecutionStatus::Failed,
            Some(RuntimeErrorKind::ExecutionFailed),
            runtime_error_artifact(error_message),
        )
    }

    pub(crate) fn from_event_emit_result(error_message: Option<&str>) -> Self {
        match error_message {
            Some(error_message) => Self::from_parts(
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::ExecutionFailed),
                runtime_error_artifact(error_message),
            ),
            None => Self::from_parts(
                RuntimeExecutionStatus::Running,
                None,
                transport_metadata_artifact("direct-work://event"),
            ),
        }
    }

    fn from_parts(
        execution_status: RuntimeExecutionStatus,
        error_kind: Option<RuntimeErrorKind>,
        artifact: RuntimeArtifactSummary,
    ) -> Self {
        Self {
            runtime_kind: RuntimeKind::AgentExecutor,
            execution_status,
            error_kind,
            artifact,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DirectWorkHostStreamEventRuntimeArtifact {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) execution_status: RuntimeExecutionStatus,
    pub(crate) error_kind: Option<RuntimeErrorKind>,
    pub(crate) artifact: RuntimeArtifactSummary,
}

impl DirectWorkHostStreamEventRuntimeArtifact {
    pub(crate) fn from_event(event: &CodexDirectWorkStreamEventSummary) -> Self {
        let (execution_status, error_kind, artifact) = match event.event_kind.as_str() {
            "started" => (
                RuntimeExecutionStatus::Starting,
                None,
                transport_metadata_artifact("started"),
            ),
            "stdout_line" | "stderr_line" | "codex_json_event" => (
                RuntimeExecutionStatus::Running,
                None,
                raw_tool_output_artifact(event_stream_content_len(event), false),
            ),
            "final_message" => (
                RuntimeExecutionStatus::Running,
                None,
                generated_response_artifact(event.text.as_deref().unwrap_or_default()),
            ),
            "completed" => (
                RuntimeExecutionStatus::Succeeded,
                None,
                transport_metadata_artifact("completed"),
            ),
            "timed_out" => (
                RuntimeExecutionStatus::TimedOut,
                Some(RuntimeErrorKind::TimedOut),
                stream_event_runtime_error_artifact(event),
            ),
            "cancelled" => (
                RuntimeExecutionStatus::Cancelled,
                Some(RuntimeErrorKind::Cancelled),
                stream_event_runtime_error_artifact(event),
            ),
            "failed" => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::ExecutionFailed),
                stream_event_runtime_error_artifact(event),
            ),
            _ => (
                RuntimeExecutionStatus::Failed,
                Some(RuntimeErrorKind::Unknown),
                stream_event_runtime_error_artifact(event),
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

pub(crate) fn operator_prompt_artifact(prompt: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::OperatorText)
        .with_redaction_status(redaction_status_for_text(prompt))
        .with_byte_count(prompt.len())
}

pub(crate) fn local_path_artifact(path: &Path) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(path.as_os_str().to_string_lossy().len())
}

pub(crate) fn command_payload_artifact(command_parts: &[String]) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
        .with_redaction_status(redaction_status_for_strings(command_parts))
        .with_byte_count(command_parts.iter().map(String::len).sum())
        .with_item_count(command_parts.len())
}

pub(crate) fn runtime_error_artifact(error_message: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(error_message.len())
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

fn generated_response_artifact(response: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::GeneratedResponse)
        .with_redaction_status(redaction_status_for_text(response))
        .with_byte_count(response.len())
}

fn safe_host_metadata_artifact(parts: &[&str]) -> RuntimeArtifactSummary {
    let byte_count = parts.iter().map(|part| part.len()).sum();

    if parts.iter().any(|part| contains_secret_like(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::SecretCandidate)
            .with_redaction_status(RuntimeRedactionStatus::ContainsSecretCandidate)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_local_path(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_command_payload(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_raw_output(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
            .with_summary("direct work host metadata")
            .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    }
}

fn transport_metadata_artifact(label: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
        .with_summary("direct work host transport metadata")
        .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
        .with_byte_count(label.len())
}

fn stream_event_runtime_error_artifact(
    event: &CodexDirectWorkStreamEventSummary,
) -> RuntimeArtifactSummary {
    let byte_count = event
        .error_message
        .as_deref()
        .or(event.stderr_preview.as_deref())
        .or(event.final_status.as_deref())
        .or(event.text.as_deref())
        .or(event.line.as_deref())
        .unwrap_or_default()
        .len();

    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(byte_count)
}

fn event_stream_content_len(event: &CodexDirectWorkStreamEventSummary) -> usize {
    event
        .line
        .as_deref()
        .or(event.text.as_deref())
        .or(event.parsed_codex_event_type.as_deref())
        .unwrap_or_default()
        .len()
}

fn status_execution_kind(status: &str) -> RuntimeExecutionStatus {
    match status {
        "queued" | "pending" => RuntimeExecutionStatus::Pending,
        "starting" | "started" => RuntimeExecutionStatus::Starting,
        "running" | "active" => RuntimeExecutionStatus::Running,
        "completed" | "succeeded" => RuntimeExecutionStatus::Succeeded,
        "failed" => RuntimeExecutionStatus::Failed,
        "timeout" | "timed_out" => RuntimeExecutionStatus::TimedOut,
        "cancel_requested" | "cancellation_requested" => RuntimeExecutionStatus::CancelRequested,
        "cancelled" => RuntimeExecutionStatus::Cancelled,
        "force_kill_requested" => RuntimeExecutionStatus::ForceKillRequested,
        "force_killed" => RuntimeExecutionStatus::ForceKilled,
        "unsupported" => RuntimeExecutionStatus::Unsupported,
        "not_configured" => RuntimeExecutionStatus::NotConfigured,
        _ => RuntimeExecutionStatus::Failed,
    }
}

fn error_kind_for_status(status: &str) -> RuntimeErrorKind {
    match status {
        "timeout" | "timed_out" => RuntimeErrorKind::TimedOut,
        "cancel_requested" | "cancellation_requested" | "cancelled" => RuntimeErrorKind::Cancelled,
        "force_kill_requested" | "force_killed" => RuntimeErrorKind::ForceKilled,
        "unsupported" => RuntimeErrorKind::Unsupported,
        "not_configured" => RuntimeErrorKind::NotConfigured,
        "starting" | "started" => RuntimeErrorKind::FailedToStart,
        _ => RuntimeErrorKind::ExecutionFailed,
    }
}

fn error_kind_for_non_error_status(status: &str) -> Option<RuntimeErrorKind> {
    match status {
        "cancel_requested" | "cancellation_requested" => Some(RuntimeErrorKind::Cancelled),
        "force_kill_requested" => Some(RuntimeErrorKind::ForceKilled),
        _ => None,
    }
}

fn direct_work_host_command_parts(input: &RunCodexDirectWorkInput) -> Vec<String> {
    let mut parts = vec![
        input.codex_executable.clone(),
        "--cd".to_owned(),
        input.repo_root.display().to_string(),
        "--sandbox".to_owned(),
        codex_sandbox_cli_arg(&input.sandbox).to_owned(),
        "--ask-for-approval".to_owned(),
        codex_approval_cli_arg(&input.approval_policy).to_owned(),
        "exec".to_owned(),
        "--json".to_owned(),
        "--output-last-message".to_owned(),
        "<temp-file>".to_owned(),
        "<operator-prompt-stdin>".to_owned(),
    ];

    if input.skip_git_repo_check {
        let insert_at = parts.len() - 3;
        parts.insert(insert_at, "--skip-git-repo-check".to_owned());
    }

    if let Some(timeout_ms) = input.timeout_ms {
        parts.push("--timeout-ms".to_owned());
        parts.push(timeout_ms.to_string());
    }
    if let Some(stdout_cap_bytes) = input.stdout_cap_bytes {
        parts.push("--stdout-cap-bytes".to_owned());
        parts.push(stdout_cap_bytes.to_string());
    }
    if let Some(stderr_cap_bytes) = input.stderr_cap_bytes {
        parts.push("--stderr-cap-bytes".to_owned());
        parts.push(stderr_cap_bytes.to_string());
    }

    parts
}

fn codex_sandbox_cli_arg(value: &str) -> &str {
    match value {
        "read_only" => "read-only",
        "workspace_write" => "workspace-write",
        "danger_full_access" => "danger-full-access",
        other => other,
    }
}

fn codex_approval_cli_arg(value: &str) -> &str {
    match value {
        "on_request" => "on-request",
        other => other,
    }
}

fn redaction_status_for_strings(parts: &[String]) -> RuntimeRedactionStatus {
    if parts.iter().any(|part| contains_secret_like(part)) {
        RuntimeRedactionStatus::ContainsSecretCandidate
    } else {
        RuntimeRedactionStatus::NotRedacted
    }
}

fn redaction_status_for_text(text: &str) -> RuntimeRedactionStatus {
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
    normalized.starts_with('/')
        || normalized.starts_with("~/")
        || normalized.contains(":/")
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
