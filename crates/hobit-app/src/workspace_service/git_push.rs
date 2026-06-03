use hobit_tools::git_push::{
    push_git_upstream, GitPushCommandSummary as ToolsGitPushCommandSummary, GitPushError,
    GitPushRequest, GitPushResult as ToolsGitPushResult,
};

use crate::WorkspaceServiceError;

use super::{
    validation::required_input, CreateWorkspaceGitPushInput, GitPushCommandSummary,
    GitPushRunSummary, WorkspaceService,
};

impl WorkspaceService {
    pub fn push_workspace_git(
        &self,
        input: CreateWorkspaceGitPushInput,
    ) -> Result<GitPushRunSummary, WorkspaceServiceError> {
        self.push_workspace_git_with_runner(input, push_git_upstream)
    }

    pub(super) fn push_workspace_git_with_runner<F>(
        &self,
        input: CreateWorkspaceGitPushInput,
        push: F,
    ) -> Result<GitPushRunSummary, WorkspaceServiceError>
    where
        F: FnOnce(GitPushRequest) -> Result<ToolsGitPushResult, GitPushError>,
    {
        let expected_branch = required_input(&input.expected_branch, "expected branch")?;
        let expected_upstream = required_input(&input.expected_upstream, "expected upstream")?;

        let result = push(GitPushRequest {
            repo_root: input.repo_root,
            expected_branch: expected_branch.to_owned(),
            expected_upstream: expected_upstream.to_owned(),
            expected_ahead: input.expected_ahead,
            expected_behind: input.expected_behind,
            operator_confirmed: input.operator_confirmed,
        })?;

        Ok(GitPushRunSummary::from(result))
    }
}

impl From<ToolsGitPushResult> for GitPushRunSummary {
    fn from(result: ToolsGitPushResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            branch: result.branch,
            upstream: result.upstream,
            remote: result.remote,
            remote_branch: result.remote_branch,
            repo_root: result.repo_root,
            ahead: result.ahead,
            behind: result.behind,
            exit_code: result.exit_code,
            stdout: result.stdout,
            stderr: result.stderr,
            duration_ms: result.duration_ms,
            command_summary: result
                .command_summary
                .into_iter()
                .map(GitPushCommandSummary::from)
                .collect(),
            force_push_performed: result.force_push_performed,
            operator_confirmed_required: result.operator_confirmed_required,
        }
    }
}

impl From<ToolsGitPushCommandSummary> for GitPushCommandSummary {
    fn from(command: ToolsGitPushCommandSummary) -> Self {
        Self {
            program: command.program,
            args: command.args,
        }
    }
}
