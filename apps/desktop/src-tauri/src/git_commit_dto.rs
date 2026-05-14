use hobit_app::{CreateGitCommitInput, GitCommitCommandSummary, GitCommitRunSummary};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateGitCommitRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub repo_root: String,
    pub commit_message: String,
    pub included_files: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitCommitResponseDto {
    pub status: String,
    pub commit_hash: Option<String>,
    pub branch: Option<String>,
    pub repo_root: String,
    pub included_files: Vec<String>,
    pub commit_message: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<GitCommitCommandSummaryDto>,
    pub push_performed: bool,
    pub force_push_performed: bool,
    pub reset_performed: bool,
    pub clean_performed: bool,
    pub auto_commit: bool,
    pub operator_confirmed_required: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitCommitCommandSummaryDto {
    pub program: String,
    pub args: Vec<String>,
}

impl From<CreateGitCommitRequest> for CreateGitCommitInput {
    fn from(request: CreateGitCommitRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            repo_root: PathBuf::from(request.repo_root),
            commit_message: request.commit_message,
            included_files: request.included_files,
        }
    }
}

impl From<GitCommitRunSummary> for GitCommitResponseDto {
    fn from(summary: GitCommitRunSummary) -> Self {
        Self {
            status: summary.status,
            commit_hash: summary.commit_hash,
            branch: summary.branch,
            repo_root: summary.repo_root,
            included_files: summary.included_files,
            commit_message: summary.commit_message,
            exit_code: summary.exit_code,
            stdout: summary.stdout,
            stderr: summary.stderr,
            duration_ms: summary.duration_ms,
            error_message: summary.error_message,
            command_summary: summary
                .command_summary
                .into_iter()
                .map(GitCommitCommandSummaryDto::from)
                .collect(),
            push_performed: summary.push_performed,
            force_push_performed: summary.force_push_performed,
            reset_performed: summary.reset_performed,
            clean_performed: summary.clean_performed,
            auto_commit: summary.auto_commit,
            operator_confirmed_required: summary.operator_confirmed_required,
        }
    }
}

impl From<GitCommitCommandSummary> for GitCommitCommandSummaryDto {
    fn from(command: GitCommitCommandSummary) -> Self {
        Self {
            program: command.program,
            args: command.args,
        }
    }
}
