use std::path::PathBuf;

use hobit_app::{CodexDirectWorkRunSummary, RunCodexDirectWorkInput};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RunCodexDirectWorkRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub codex_executable: String,
    pub repo_root: String,
    pub operator_prompt: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct RunCodexDirectWorkResponseDto {
    pub run_id: String,
    pub result_id: String,
    pub result_type: String,
    pub executor_kind: String,
    pub mode: String,
    pub repo_root: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub command_summary: Vec<String>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub final_message: Option<String>,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub no_auto_commit: bool,
    pub no_auto_push: bool,
    pub git_mutations_performed_by_hobit: bool,
}

impl From<RunCodexDirectWorkRequest> for RunCodexDirectWorkInput {
    fn from(request: RunCodexDirectWorkRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            codex_executable: request.codex_executable,
            repo_root: PathBuf::from(request.repo_root),
            operator_prompt: request.operator_prompt,
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
        }
    }
}

impl From<CodexDirectWorkRunSummary> for RunCodexDirectWorkResponseDto {
    fn from(summary: CodexDirectWorkRunSummary) -> Self {
        Self {
            run_id: summary.run_id,
            result_id: summary.result_id,
            result_type: summary.result_type,
            executor_kind: summary.executor_kind,
            mode: summary.mode,
            repo_root: summary.repo_root,
            sandbox: summary.sandbox,
            approval_policy: summary.approval_policy,
            command_summary: summary.command_summary,
            status: summary.status,
            exit_code: summary.exit_code,
            stdout: summary.stdout,
            stderr: summary.stderr,
            stdout_truncated: summary.stdout_truncated,
            stderr_truncated: summary.stderr_truncated,
            final_message: summary.final_message,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
            no_auto_commit: summary.no_auto_commit,
            no_auto_push: summary.no_auto_push,
            git_mutations_performed_by_hobit: summary.git_mutations_performed_by_hobit,
        }
    }
}
