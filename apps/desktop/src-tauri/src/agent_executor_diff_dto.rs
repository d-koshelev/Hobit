use hobit_app::{
    AgentExecutorDiffFileSummary, AgentExecutorDiffSummary, AgentExecutorDiffTotals,
    GitDiffCommandSummary,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetAgentExecutorDiffSummaryRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub repo_root: String,
    pub max_files: Option<usize>,
    pub max_patch_bytes_per_file: Option<usize>,
    pub include_patch_preview: Option<bool>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorDiffSummaryDto {
    pub repo_root: String,
    pub status: String,
    pub files: Vec<AgentExecutorDiffFileSummaryDto>,
    pub summary: AgentExecutorDiffTotalsDto,
    pub error_message: Option<String>,
    pub command_summary: Vec<GitDiffCommandSummaryDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorDiffFileSummaryDto {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
    pub conflicted: bool,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub patch_preview: Option<String>,
    pub patch_truncated: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorDiffTotalsDto {
    pub total_files: usize,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
    pub conflicted_count: usize,
    pub total_additions: Option<u64>,
    pub total_deletions: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitDiffCommandSummaryDto {
    pub program: String,
    pub args: Vec<String>,
}

impl From<AgentExecutorDiffSummary> for AgentExecutorDiffSummaryDto {
    fn from(summary: AgentExecutorDiffSummary) -> Self {
        Self {
            repo_root: summary.repo_root,
            status: summary.status,
            files: summary
                .files
                .into_iter()
                .map(AgentExecutorDiffFileSummaryDto::from)
                .collect(),
            summary: AgentExecutorDiffTotalsDto::from(summary.summary),
            error_message: summary.error_message,
            command_summary: summary
                .command_summary
                .into_iter()
                .map(GitDiffCommandSummaryDto::from)
                .collect(),
        }
    }
}

impl From<AgentExecutorDiffFileSummary> for AgentExecutorDiffFileSummaryDto {
    fn from(file: AgentExecutorDiffFileSummary) -> Self {
        Self {
            path: file.path,
            status: file.status,
            staged: file.staged,
            unstaged: file.unstaged,
            untracked: file.untracked,
            conflicted: file.conflicted,
            additions: file.additions,
            deletions: file.deletions,
            patch_preview: file.patch_preview,
            patch_truncated: file.patch_truncated,
        }
    }
}

impl From<AgentExecutorDiffTotals> for AgentExecutorDiffTotalsDto {
    fn from(totals: AgentExecutorDiffTotals) -> Self {
        Self {
            total_files: totals.total_files,
            staged_count: totals.staged_count,
            unstaged_count: totals.unstaged_count,
            untracked_count: totals.untracked_count,
            conflicted_count: totals.conflicted_count,
            total_additions: totals.total_additions,
            total_deletions: totals.total_deletions,
        }
    }
}

impl From<GitDiffCommandSummary> for GitDiffCommandSummaryDto {
    fn from(command: GitDiffCommandSummary) -> Self {
        Self {
            program: command.program,
            args: command.args,
        }
    }
}
