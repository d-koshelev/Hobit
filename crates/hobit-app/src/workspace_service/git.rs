use std::{path::Path, path::PathBuf};

use hobit_tools::git::{
    read_git_repository_status, GitBranchSummary as ToolsGitBranchSummary,
    GitFileChange as ToolsGitFileChange, GitFileChangeArea, GitFileChangeKind,
    GitLastCommitSummary as ToolsGitLastCommitSummary,
    GitRepositoryStatus as ToolsGitRepositoryStatus, GitStatusError,
    GitWorkingTreeSummary as ToolsGitWorkingTreeSummary,
};
use hobit_tools::git_diff::{
    read_git_file_diff, read_git_log, GitDiffError, GitFileDiffRequest,
    GitFileDiffResult as ToolsGitFileDiffResult, GitLogEntry as ToolsGitLogEntry, GitLogRequest,
    GitLogResult as ToolsGitLogResult,
};

use crate::WorkspaceServiceError;

use super::{
    git_artifacts::{classify_git_diff_error_passthrough, GitDiffRuntimeArtifacts},
    git_artifacts::{classify_git_status_error_passthrough, GitStatusRuntimeArtifacts},
    validation::{required_input, validate_widget_ownership},
    GitBranchStatusSummary, GitDiffCommandSummary, GitFileChangeSummary, GitFileDiffSummary,
    GitLastCommitSummary, GitLogEntrySummary, GitLogSummary, GitRepositoryStatusSummary,
    GitWorkingTreeStatusSummary, WorkspaceService, GIT_WIDGET_DEFINITION_ID,
};

impl WorkspaceService {
    pub fn get_git_repository_status(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
    ) -> Result<Option<GitRepositoryStatusSummary>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let repository_root = required_input(repository_root, "repository root")?;

        self.get_git_repository_status_with_reader(
            workspace_id,
            workbench_id,
            widget_instance_id,
            repository_root,
            read_git_repository_status,
        )
    }

    pub(super) fn get_git_repository_status_with_reader<F>(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
        read_status: F,
    ) -> Result<Option<GitRepositoryStatusSummary>, WorkspaceServiceError>
    where
        F: FnOnce(PathBuf) -> Result<ToolsGitRepositoryStatus, GitStatusError>,
    {
        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let Some(workbench) = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .find(|workbench| workbench.id == workbench_id)
        else {
            return Ok(None);
        };

        let Some(widget) = self.store.get_widget_instance(widget_instance_id)? else {
            return Ok(None);
        };

        if widget.workspace_id != workspace.id
            || widget.workbench_id != workbench.id
            || widget.definition_id != GIT_WIDGET_DEFINITION_ID
        {
            return Ok(None);
        }

        let repository_root_path = Path::new(repository_root).to_path_buf();
        let _request_artifacts = GitStatusRuntimeArtifacts::from_request(&repository_root_path);
        let status = read_status(repository_root_path.clone())
            .map_err(classify_git_status_error_passthrough)?;
        let _status_artifacts =
            GitStatusRuntimeArtifacts::from_status(&repository_root_path, &status);

        Ok(Some(GitRepositoryStatusSummary::from(status)))
    }

    pub fn get_git_file_diff(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
        path: &str,
        max_patch_bytes: Option<usize>,
    ) -> Result<Option<GitFileDiffSummary>, WorkspaceServiceError> {
        self.get_git_file_diff_with_reader(
            workspace_id,
            workbench_id,
            widget_instance_id,
            repository_root,
            path,
            max_patch_bytes,
            read_git_file_diff,
        )
    }

    pub(super) fn get_git_file_diff_with_reader<F>(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
        path: &str,
        max_patch_bytes: Option<usize>,
        read_diff: F,
    ) -> Result<Option<GitFileDiffSummary>, WorkspaceServiceError>
    where
        F: FnOnce(GitFileDiffRequest) -> Result<ToolsGitFileDiffResult, GitDiffError>,
    {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let repository_root = required_input(repository_root, "repository root")?;
        let path = required_input(path, "file path")?;

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(None);
        };

        if widget.definition_id != GIT_WIDGET_DEFINITION_ID {
            return Ok(None);
        }

        let repo_root = PathBuf::from(repository_root);
        let _request_artifacts = GitDiffRuntimeArtifacts::from_request(&repo_root);
        let diff = read_diff(GitFileDiffRequest {
            repo_root,
            path: path.to_owned(),
            max_patch_bytes,
        })
        .map_err(classify_git_diff_error_passthrough)?;

        Ok(Some(GitFileDiffSummary::from(diff)))
    }

    pub fn get_git_log(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
        limit: Option<usize>,
    ) -> Result<Option<GitLogSummary>, WorkspaceServiceError> {
        self.get_git_log_with_reader(
            workspace_id,
            workbench_id,
            widget_instance_id,
            repository_root,
            limit,
            read_git_log,
        )
    }

    pub(super) fn get_git_log_with_reader<F>(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repository_root: &str,
        limit: Option<usize>,
        read_log: F,
    ) -> Result<Option<GitLogSummary>, WorkspaceServiceError>
    where
        F: FnOnce(GitLogRequest) -> Result<ToolsGitLogResult, GitDiffError>,
    {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let repository_root = required_input(repository_root, "repository root")?;

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(None);
        };

        if widget.definition_id != GIT_WIDGET_DEFINITION_ID {
            return Ok(None);
        }

        let log = read_log(GitLogRequest {
            repo_root: PathBuf::from(repository_root),
            limit,
        })
        .map_err(classify_git_diff_error_passthrough)?;

        Ok(Some(GitLogSummary::from(log)))
    }
}

impl From<ToolsGitRepositoryStatus> for GitRepositoryStatusSummary {
    fn from(status: ToolsGitRepositoryStatus) -> Self {
        Self {
            branch: status.branch.map(GitBranchStatusSummary::from),
            working_tree: GitWorkingTreeStatusSummary::from(status.working_tree),
            changed_files: status
                .changed_files
                .into_iter()
                .map(GitFileChangeSummary::from)
                .collect(),
            last_commit: status.last_commit.map(GitLastCommitSummary::from),
            warnings: status.warnings,
        }
    }
}

impl From<ToolsGitBranchSummary> for GitBranchStatusSummary {
    fn from(summary: ToolsGitBranchSummary) -> Self {
        Self {
            name: summary.name,
            upstream: summary.upstream,
            ahead: summary.ahead,
            behind: summary.behind,
            is_detached: summary.is_detached,
        }
    }
}

impl From<ToolsGitWorkingTreeSummary> for GitWorkingTreeStatusSummary {
    fn from(summary: ToolsGitWorkingTreeSummary) -> Self {
        Self {
            is_clean: summary.is_clean,
            is_dirty: !summary.is_clean,
            staged_count: summary.staged_count,
            unstaged_count: summary.unstaged_count,
            untracked_count: summary.untracked_count,
        }
    }
}

impl From<ToolsGitFileChange> for GitFileChangeSummary {
    fn from(change: ToolsGitFileChange) -> Self {
        Self {
            area: git_file_change_area(change.area).to_owned(),
            kind: git_file_change_kind(change.kind).to_owned(),
            path: change.path,
            original_path: change.original_path,
        }
    }
}

impl From<ToolsGitLastCommitSummary> for GitLastCommitSummary {
    fn from(summary: ToolsGitLastCommitSummary) -> Self {
        Self {
            hash: summary.hash,
            title: summary.title,
            author: summary.author,
            committed_at: summary.committed_at,
        }
    }
}

impl From<ToolsGitFileDiffResult> for GitFileDiffSummary {
    fn from(diff: ToolsGitFileDiffResult) -> Self {
        Self {
            repo_root: diff.repo_root,
            path: diff.path,
            status: diff.status.as_str().to_owned(),
            patch: diff.patch,
            patch_truncated: diff.patch_truncated,
            error_message: diff.error_message,
            command_summary: diff
                .command_summary
                .into_iter()
                .map(GitDiffCommandSummary::from)
                .collect(),
        }
    }
}

impl From<ToolsGitLogResult> for GitLogSummary {
    fn from(log: ToolsGitLogResult) -> Self {
        Self {
            repo_root: log.repo_root,
            entries: log
                .entries
                .into_iter()
                .map(GitLogEntrySummary::from)
                .collect(),
            command_summary: log
                .command_summary
                .into_iter()
                .map(GitDiffCommandSummary::from)
                .collect(),
        }
    }
}

impl From<ToolsGitLogEntry> for GitLogEntrySummary {
    fn from(entry: ToolsGitLogEntry) -> Self {
        Self {
            hash: entry.hash,
            short_hash: entry.short_hash,
            subject: entry.subject,
            author: entry.author,
            date: entry.date,
        }
    }
}

fn git_file_change_area(area: GitFileChangeArea) -> &'static str {
    match area {
        GitFileChangeArea::Staged => "staged",
        GitFileChangeArea::Unstaged => "unstaged",
        GitFileChangeArea::Untracked => "untracked",
    }
}

fn git_file_change_kind(kind: GitFileChangeKind) -> &'static str {
    match kind {
        GitFileChangeKind::Added => "added",
        GitFileChangeKind::Modified => "modified",
        GitFileChangeKind::Deleted => "deleted",
        GitFileChangeKind::Renamed => "renamed",
        GitFileChangeKind::Copied => "copied",
        GitFileChangeKind::Untracked => "untracked",
        GitFileChangeKind::Conflicted => "conflicted",
        GitFileChangeKind::Unknown => "unknown",
    }
}
