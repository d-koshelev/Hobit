use hobit_tools::git_commit::{
    create_git_commit, GitCommitCommandSummary as ToolsGitCommitCommandSummary, GitCommitError,
    GitCommitRequest, GitCommitResult as ToolsGitCommitResult,
};

use crate::WorkspaceServiceError;

use super::{
    git_artifacts::{classify_git_commit_error_passthrough, GitCommitRuntimeArtifacts},
    validation::{required_input, validate_widget_ownership},
    CreateGitCommitInput, CreateWorkspaceGitCommitInput, GitCommitCommandSummary,
    GitCommitRunSummary, WorkspaceService, GIT_WIDGET_DEFINITION_ID,
};

const GIT_COMMIT_WIDGET_ERROR: &str = "Git commit is only available for Git widgets.";

impl WorkspaceService {
    pub fn create_workspace_git_commit(
        &self,
        input: CreateWorkspaceGitCommitInput,
    ) -> Result<GitCommitRunSummary, WorkspaceServiceError> {
        self.create_workspace_git_commit_with_runner(input, create_git_commit)
    }

    pub(super) fn create_workspace_git_commit_with_runner<F>(
        &self,
        input: CreateWorkspaceGitCommitInput,
        create_commit: F,
    ) -> Result<GitCommitRunSummary, WorkspaceServiceError>
    where
        F: FnOnce(GitCommitRequest) -> Result<ToolsGitCommitResult, GitCommitError>,
    {
        let _input_artifacts = GitCommitRuntimeArtifacts::from_input(
            &input.repo_root,
            &input.commit_message,
            &input.included_files,
        );
        let result = create_commit(GitCommitRequest {
            repo_root: input.repo_root,
            commit_message: input.commit_message,
            included_files: input.included_files,
        })
        .map_err(classify_git_commit_error_passthrough)?;
        let _result_artifacts = GitCommitRuntimeArtifacts::from_result(&result);

        Ok(GitCommitRunSummary::from(result))
    }

    pub fn create_git_commit(
        &self,
        input: CreateGitCommitInput,
    ) -> Result<Option<GitCommitRunSummary>, WorkspaceServiceError> {
        self.create_git_commit_with_runner(input, create_git_commit)
    }

    pub(super) fn create_git_commit_with_runner<F>(
        &self,
        input: CreateGitCommitInput,
        create_commit: F,
    ) -> Result<Option<GitCommitRunSummary>, WorkspaceServiceError>
    where
        F: FnOnce(GitCommitRequest) -> Result<ToolsGitCommitResult, GitCommitError>,
    {
        let workspace_id = required_input(&input.workspace_id, "workspace id")?;
        let workbench_id = required_input(&input.workbench_id, "workbench id")?;
        let widget_instance_id = required_input(&input.widget_instance_id, "widget instance id")?;

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(None);
        };

        ensure_git_widget(&widget.definition_id)?;

        let _input_artifacts = GitCommitRuntimeArtifacts::from_input(
            &input.repo_root,
            &input.commit_message,
            &input.included_files,
        );
        let result = create_commit(GitCommitRequest {
            repo_root: input.repo_root,
            commit_message: input.commit_message,
            included_files: input.included_files,
        })
        .map_err(classify_git_commit_error_passthrough)?;
        let _result_artifacts = GitCommitRuntimeArtifacts::from_result(&result);

        Ok(Some(GitCommitRunSummary::from(result)))
    }
}

fn ensure_git_widget(definition_id: &str) -> Result<(), WorkspaceServiceError> {
    if definition_id != GIT_WIDGET_DEFINITION_ID {
        return Err(WorkspaceServiceError::InvalidInput(
            GIT_COMMIT_WIDGET_ERROR.to_owned(),
        ));
    }

    Ok(())
}

impl From<ToolsGitCommitResult> for GitCommitRunSummary {
    fn from(result: ToolsGitCommitResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            commit_hash: result.commit_hash,
            branch: result.branch,
            repo_root: result.repo_root,
            included_files: result.included_files,
            commit_message: result.commit_message,
            exit_code: result.exit_code,
            stdout: result.stdout,
            stderr: result.stderr,
            duration_ms: result.duration_ms,
            error_message: result.error_message,
            command_summary: result
                .command_summary
                .into_iter()
                .map(GitCommitCommandSummary::from)
                .collect(),
            push_performed: result.push_performed,
            force_push_performed: result.force_push_performed,
            reset_performed: result.reset_performed,
            clean_performed: result.clean_performed,
            auto_commit: result.auto_commit,
            operator_confirmed_required: result.operator_confirmed_required,
        }
    }
}

impl From<ToolsGitCommitCommandSummary> for GitCommitCommandSummary {
    fn from(command: ToolsGitCommitCommandSummary) -> Self {
        Self {
            program: command.program,
            args: command.args,
        }
    }
}
