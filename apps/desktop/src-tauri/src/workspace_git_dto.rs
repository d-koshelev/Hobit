use std::path::PathBuf;

use hobit_app::CreateWorkspaceGitCommitInput;
use serde::Deserialize;

use crate::agent_executor_diff_dto::AgentExecutorDiffSummaryDto;
use crate::git_commit_dto::GitCommitResponseDto;
use crate::git_review_dto::GitFileDiffDto;
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
pub(crate) struct CreateWorkspaceGitCommitRequest {
    pub repo_root: String,
    pub commit_message: String,
    pub included_files: Vec<String>,
}

pub(crate) type WorkspaceGitStatusDto = GitRepositoryStatusDto;
pub(crate) type WorkspaceGitDiffSummaryDto = AgentExecutorDiffSummaryDto;
pub(crate) type WorkspaceGitFileDiffDto = GitFileDiffDto;
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
