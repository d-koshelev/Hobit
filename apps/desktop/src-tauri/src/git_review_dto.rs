use hobit_app::{GitDiffCommandSummary, GitFileDiffSummary, GitLogEntrySummary, GitLogSummary};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetGitFileDiffRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub repository_root: String,
    pub path: String,
    pub max_patch_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitFileDiffDto {
    pub repo_root: String,
    pub path: String,
    pub status: String,
    pub patch: Option<String>,
    pub patch_truncated: bool,
    pub error_message: Option<String>,
    pub command_summary: Vec<GitDiffCommandSummaryDto>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetGitLogRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub repository_root: String,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitLogDto {
    pub repo_root: String,
    pub entries: Vec<GitLogEntryDto>,
    pub command_summary: Vec<GitDiffCommandSummaryDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitLogEntryDto {
    pub hash: String,
    pub short_hash: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GitDiffCommandSummaryDto {
    pub program: String,
    pub args: Vec<String>,
}

impl From<GitFileDiffSummary> for GitFileDiffDto {
    fn from(summary: GitFileDiffSummary) -> Self {
        Self {
            repo_root: summary.repo_root,
            path: summary.path,
            status: summary.status,
            patch: summary.patch,
            patch_truncated: summary.patch_truncated,
            error_message: summary.error_message,
            command_summary: summary
                .command_summary
                .into_iter()
                .map(GitDiffCommandSummaryDto::from)
                .collect(),
        }
    }
}

impl From<GitLogSummary> for GitLogDto {
    fn from(summary: GitLogSummary) -> Self {
        Self {
            repo_root: summary.repo_root,
            entries: summary
                .entries
                .into_iter()
                .map(GitLogEntryDto::from)
                .collect(),
            command_summary: summary
                .command_summary
                .into_iter()
                .map(GitDiffCommandSummaryDto::from)
                .collect(),
        }
    }
}

impl From<GitLogEntrySummary> for GitLogEntryDto {
    fn from(entry: GitLogEntrySummary) -> Self {
        Self {
            hash: entry.hash,
            short_hash: entry.short_hash,
            subject: entry.subject,
            author: entry.author,
            date: entry.date,
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
