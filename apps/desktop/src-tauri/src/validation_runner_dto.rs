use std::path::PathBuf;

use hobit_app::{
    AgentQueueValidationCommandEvidenceSummary, AgentQueueValidationCommandRunSummary,
    AgentQueueValidationCommandSpecInput, AgentQueueValidationSuiteRunSummary,
    RunAgentQueueValidationSuiteInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct RunQueueValidationSuiteRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub requested_by_surface: String,
    pub cwd: String,
    #[serde(default)]
    pub stop_on_first_failure: bool,
    pub commands: Vec<QueueValidationCommandSpecRequest>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct QueueValidationCommandSpecRequest {
    pub command_id: String,
    pub title: String,
    pub program: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub cwd: String,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub stdout_cap_bytes: Option<usize>,
    #[serde(default)]
    pub stderr_cap_bytes: Option<usize>,
    #[serde(default)]
    pub allowed_exit_codes: Vec<i32>,
    pub safety_category: String,
    pub source: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueValidationSuiteRunDto {
    pub validation_run_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub requested_by_surface: String,
    pub status: String,
    pub task_validation_status: String,
    pub command_results: Vec<QueueValidationCommandRunDto>,
    pub evidence: Vec<QueueValidationCommandEvidenceDto>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub duration_ms: u128,
    pub no_git_mutations: bool,
    pub no_commit_push: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueValidationCommandRunDto {
    pub command_id: String,
    pub title: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub allowed_exit_codes: Vec<i32>,
    pub cwd: String,
    pub stdout_preview: String,
    pub stderr_preview: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueValidationCommandEvidenceDto {
    pub evidence_id: String,
    pub validation_run_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub command_id: String,
    pub command_label: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout_preview: String,
    pub stderr_preview: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub source: String,
    pub no_git_mutations: bool,
    pub no_commit_push: bool,
    pub ai_context_status: String,
}

impl From<RunQueueValidationSuiteRequest> for RunAgentQueueValidationSuiteInput {
    fn from(request: RunQueueValidationSuiteRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
            requested_by_surface: request.requested_by_surface,
            cwd: PathBuf::from(request.cwd),
            commands: request.commands.into_iter().map(Into::into).collect(),
            stop_on_first_failure: request.stop_on_first_failure,
        }
    }
}

impl From<QueueValidationCommandSpecRequest> for AgentQueueValidationCommandSpecInput {
    fn from(request: QueueValidationCommandSpecRequest) -> Self {
        Self {
            command_id: request.command_id,
            title: request.title,
            program: request.program,
            args: request.args,
            cwd: PathBuf::from(request.cwd),
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
            allowed_exit_codes: request.allowed_exit_codes,
            safety_category: request.safety_category,
            source: request.source,
        }
    }
}

impl From<AgentQueueValidationSuiteRunSummary> for QueueValidationSuiteRunDto {
    fn from(summary: AgentQueueValidationSuiteRunSummary) -> Self {
        Self {
            validation_run_id: summary.validation_run_id,
            workspace_id: summary.workspace_id,
            queue_item_id: summary.queue_item_id,
            requested_by_surface: summary.requested_by_surface,
            status: summary.status,
            task_validation_status: summary.task_validation_status,
            command_results: summary
                .command_results
                .into_iter()
                .map(Into::into)
                .collect(),
            evidence: summary.evidence.into_iter().map(Into::into).collect(),
            warnings: summary.warnings,
            errors: summary.errors,
            duration_ms: summary.duration_ms,
            no_git_mutations: summary.no_git_mutations,
            no_commit_push: summary.no_commit_push,
        }
    }
}

impl From<AgentQueueValidationCommandRunSummary> for QueueValidationCommandRunDto {
    fn from(summary: AgentQueueValidationCommandRunSummary) -> Self {
        Self {
            command_id: summary.command_id,
            title: summary.title,
            status: summary.status,
            exit_code: summary.exit_code,
            allowed_exit_codes: summary.allowed_exit_codes,
            cwd: summary.cwd,
            stdout_preview: summary.stdout_preview,
            stderr_preview: summary.stderr_preview,
            stdout_truncated: summary.stdout_truncated,
            stderr_truncated: summary.stderr_truncated,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
            command_summary: summary.command_summary,
            warnings: summary.warnings,
            errors: summary.errors,
        }
    }
}

impl From<AgentQueueValidationCommandEvidenceSummary> for QueueValidationCommandEvidenceDto {
    fn from(summary: AgentQueueValidationCommandEvidenceSummary) -> Self {
        Self {
            evidence_id: summary.evidence_id,
            validation_run_id: summary.validation_run_id,
            workspace_id: summary.workspace_id,
            queue_item_id: summary.queue_item_id,
            command_id: summary.command_id,
            command_label: summary.command_label,
            program: summary.program,
            args: summary.args,
            cwd: summary.cwd,
            status: summary.status,
            exit_code: summary.exit_code,
            stdout_preview: summary.stdout_preview,
            stderr_preview: summary.stderr_preview,
            stdout_truncated: summary.stdout_truncated,
            stderr_truncated: summary.stderr_truncated,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
            command_summary: summary.command_summary,
            source: summary.source,
            no_git_mutations: summary.no_git_mutations,
            no_commit_push: summary.no_commit_push,
            ai_context_status: summary.ai_context_status,
        }
    }
}
