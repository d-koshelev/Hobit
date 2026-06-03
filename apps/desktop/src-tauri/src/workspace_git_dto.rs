use std::path::PathBuf;

use hobit_app::{
    CreateWorkspaceGitCommitInput, CreateWorkspaceGitPushInput, GitPushCommandSummary,
    GitPushRunSummary,
};
use serde::{Deserialize, Serialize};

use crate::agent_executor_diff_dto::AgentExecutorDiffSummaryDto;
use crate::git_commit_dto::GitCommitResponseDto;
use crate::git_review_dto::{GitFileDiffDto, GitLogDto};
use crate::workspace_dto::GitRepositoryStatusDto;

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetWorkspaceGitStatusRequest {
    pub repo_root: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetWorkspaceGitDiffSummaryRequest {
    pub repo_root: String,
    pub max_files: Option<usize>,
    pub max_patch_bytes_per_file: Option<usize>,
    pub include_patch_preview: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetWorkspaceGitFileDiffRequest {
    pub repo_root: String,
    pub path: String,
    pub max_patch_bytes: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetWorkspaceGitLogRequest {
    pub repo_root: String,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateWorkspaceGitCommitRequest {
    pub repo_root: String,
    pub commit_message: String,
    pub included_files: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct PushWorkspaceGitRequest {
    pub repo_root: String,
    pub expected_branch: String,
    pub expected_upstream: String,
    pub expected_ahead: Option<u32>,
    pub expected_behind: Option<u32>,
    pub operator_confirmed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceGitPushResponseDto {
    pub status: String,
    pub branch: String,
    pub upstream: String,
    pub remote: String,
    pub remote_branch: String,
    pub repo_root: String,
    pub ahead: u32,
    pub behind: u32,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
    pub command_summary: Vec<WorkspaceGitPushCommandSummaryDto>,
    pub force_push_performed: bool,
    pub operator_confirmed_required: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceGitPushCommandSummaryDto {
    pub program: String,
    pub args: Vec<String>,
}

pub(crate) type WorkspaceGitStatusDto = GitRepositoryStatusDto;
pub(crate) type WorkspaceGitDiffSummaryDto = AgentExecutorDiffSummaryDto;
pub(crate) type WorkspaceGitFileDiffDto = GitFileDiffDto;
pub(crate) type WorkspaceGitLogDto = GitLogDto;
pub(crate) type WorkspaceGitCommitResponseDto = GitCommitResponseDto;

impl From<CreateWorkspaceGitCommitRequest> for CreateWorkspaceGitCommitInput {
    fn from(request: CreateWorkspaceGitCommitRequest) -> Self {
        Self {
            repo_root: PathBuf::from(request.repo_root),
            commit_message: request.commit_message,
            included_files: request.included_files,
        }
    }
}

impl From<PushWorkspaceGitRequest> for CreateWorkspaceGitPushInput {
    fn from(request: PushWorkspaceGitRequest) -> Self {
        Self {
            repo_root: PathBuf::from(request.repo_root),
            expected_branch: request.expected_branch,
            expected_upstream: request.expected_upstream,
            expected_ahead: request.expected_ahead,
            expected_behind: request.expected_behind,
            operator_confirmed: request.operator_confirmed,
        }
    }
}

impl From<GitPushRunSummary> for WorkspaceGitPushResponseDto {
    fn from(summary: GitPushRunSummary) -> Self {
        Self {
            status: summary.status,
            branch: summary.branch,
            upstream: summary.upstream,
            remote: summary.remote,
            remote_branch: summary.remote_branch,
            repo_root: summary.repo_root,
            ahead: summary.ahead,
            behind: summary.behind,
            exit_code: summary.exit_code,
            stdout: summary.stdout,
            stderr: summary.stderr,
            duration_ms: summary.duration_ms,
            command_summary: summary
                .command_summary
                .into_iter()
                .map(WorkspaceGitPushCommandSummaryDto::from)
                .collect(),
            force_push_performed: summary.force_push_performed,
            operator_confirmed_required: summary.operator_confirmed_required,
        }
    }
}

impl From<GitPushCommandSummary> for WorkspaceGitPushCommandSummaryDto {
    fn from(command: GitPushCommandSummary) -> Self {
        Self {
            program: command.program,
            args: command.args,
        }
    }
}
