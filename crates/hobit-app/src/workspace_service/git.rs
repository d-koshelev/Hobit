use std::{path::Path, path::PathBuf};

use hobit_tools::git::{
    read_git_repository_status, GitBranchSummary as ToolsGitBranchSummary,
    GitFileChange as ToolsGitFileChange, GitFileChangeArea, GitFileChangeKind,
    GitLastCommitSummary as ToolsGitLastCommitSummary,
    GitRepositoryStatus as ToolsGitRepositoryStatus, GitStatusError,
    GitWorkingTreeSummary as ToolsGitWorkingTreeSummary,
};

use crate::WorkspaceServiceError;

use super::{
    validation::required_input, GitBranchStatusSummary, GitFileChangeSummary, GitLastCommitSummary,
    GitRepositoryStatusSummary, GitWorkingTreeStatusSummary, WorkspaceService,
    GIT_WIDGET_DEFINITION_ID,
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

        let status = read_status(Path::new(repository_root).to_path_buf())?;

        Ok(Some(GitRepositoryStatusSummary::from(status)))
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
