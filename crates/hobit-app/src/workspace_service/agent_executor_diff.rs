use std::path::PathBuf;

use hobit_tools::git_diff::{
    read_git_diff_summary, GitDiffCommandSummary as ToolsGitDiffCommandSummary, GitDiffError,
    GitDiffFileStatus, GitDiffFileSummary as ToolsGitDiffFileSummary,
    GitDiffSummary as ToolsGitDiffSummary, GitDiffSummaryRequest, GitDiffTotals,
};

use crate::WorkspaceServiceError;

use super::{
    validation::{required_input, validate_widget_ownership},
    AgentExecutorDiffFileSummary, AgentExecutorDiffSummary, AgentExecutorDiffTotals,
    GitDiffCommandSummary, WorkspaceService, AGENT_RUN_WIDGET_DEFINITION_ID,
};

const AGENT_EXECUTOR_DIFF_WIDGET_ERROR: &str =
    "Agent Executor diff summary is only available for Agent Executor widgets.";

impl WorkspaceService {
    pub fn get_agent_executor_diff_summary(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repo_root: &str,
        max_files: Option<usize>,
        max_patch_bytes_per_file: Option<usize>,
        include_patch_preview: Option<bool>,
    ) -> Result<Option<AgentExecutorDiffSummary>, WorkspaceServiceError> {
        self.get_agent_executor_diff_summary_with_reader(
            workspace_id,
            workbench_id,
            widget_instance_id,
            repo_root,
            max_files,
            max_patch_bytes_per_file,
            include_patch_preview,
            read_git_diff_summary,
        )
    }

    pub(super) fn get_agent_executor_diff_summary_with_reader<F>(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        repo_root: &str,
        max_files: Option<usize>,
        max_patch_bytes_per_file: Option<usize>,
        include_patch_preview: Option<bool>,
        read_diff_summary: F,
    ) -> Result<Option<AgentExecutorDiffSummary>, WorkspaceServiceError>
    where
        F: FnOnce(GitDiffSummaryRequest) -> Result<ToolsGitDiffSummary, GitDiffError>,
    {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let repo_root = required_input(repo_root, "repository root")?;

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(None);
        };

        ensure_agent_executor_widget(&widget.definition_id)?;

        let summary = read_diff_summary(GitDiffSummaryRequest {
            repo_root: PathBuf::from(repo_root),
            max_files,
            max_patch_bytes_per_file,
            include_patch_preview: include_patch_preview.unwrap_or(true),
        })?;

        Ok(Some(AgentExecutorDiffSummary::from(summary)))
    }
}

fn ensure_agent_executor_widget(definition_id: &str) -> Result<(), WorkspaceServiceError> {
    if definition_id != AGENT_RUN_WIDGET_DEFINITION_ID {
        return Err(WorkspaceServiceError::InvalidInput(
            AGENT_EXECUTOR_DIFF_WIDGET_ERROR.to_owned(),
        ));
    }

    Ok(())
}

impl From<ToolsGitDiffSummary> for AgentExecutorDiffSummary {
    fn from(summary: ToolsGitDiffSummary) -> Self {
        Self {
            repo_root: summary.repo_root,
            status: summary.status.as_str().to_owned(),
            files: summary
                .files
                .into_iter()
                .map(AgentExecutorDiffFileSummary::from)
                .collect(),
            summary: AgentExecutorDiffTotals::from(summary.summary),
            error_message: summary.error_message,
            command_summary: summary
                .command_summary
                .into_iter()
                .map(GitDiffCommandSummary::from)
                .collect(),
        }
    }
}

impl From<ToolsGitDiffFileSummary> for AgentExecutorDiffFileSummary {
    fn from(file: ToolsGitDiffFileSummary) -> Self {
        Self {
            path: file.path,
            status: git_diff_file_status(file.status).to_owned(),
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

impl From<GitDiffTotals> for AgentExecutorDiffTotals {
    fn from(totals: GitDiffTotals) -> Self {
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

impl From<ToolsGitDiffCommandSummary> for GitDiffCommandSummary {
    fn from(command: ToolsGitDiffCommandSummary) -> Self {
        Self {
            program: command.program,
            args: command.args,
        }
    }
}

fn git_diff_file_status(status: GitDiffFileStatus) -> &'static str {
    status.as_str()
}
