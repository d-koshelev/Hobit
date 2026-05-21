use std::path::Path;

use hobit_tools::{
    git::{GitRepositoryStatus, GitStatusError},
    git_commit::{GitCommitError, GitCommitResult, GitCommitStatus},
    git_diff::{GitDiffError, GitDiffSummary, GitDiffSummaryStatus},
};

use crate::{
    RuntimeArtifactClass, RuntimeArtifactSummary, RuntimeErrorKind, RuntimeExecutionStatus,
    RuntimeKind, RuntimeRedactionStatus,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GitStatusRuntimeArtifacts {
    pub(crate) repo_root: RuntimeArtifactSummary,
    pub(crate) changed_file_paths: RuntimeArtifactSummary,
    pub(crate) status_metadata: RuntimeArtifactSummary,
    pub(crate) runtime_error: Option<RuntimeArtifactSummary>,
    pub(crate) status: GitRuntimeBoundarySummary,
}

impl GitStatusRuntimeArtifacts {
    pub(crate) fn from_request(repo_root: &Path) -> Self {
        Self {
            repo_root: local_path_artifact(repo_root),
            changed_file_paths: file_paths_artifact(std::iter::empty::<&str>()),
            status_metadata: safe_status_metadata_artifact(&["status_requested"]),
            runtime_error: None,
            status: GitRuntimeBoundarySummary::from_status(RuntimeExecutionStatus::Running, None),
        }
    }

    pub(crate) fn from_status(repo_root: &Path, status: &GitRepositoryStatus) -> Self {
        let changed_paths = status.changed_files.iter().flat_map(|file| {
            std::iter::once(file.path.as_str()).chain(file.original_path.as_deref())
        });
        let mut metadata_parts = vec![if status.working_tree.is_clean {
            "clean"
        } else {
            "dirty"
        }];
        if let Some(branch) = &status.branch {
            if let Some(name) = branch.name.as_deref() {
                metadata_parts.push(name);
            }
            if let Some(upstream) = branch.upstream.as_deref() {
                metadata_parts.push(upstream);
            }
        }
        if let Some(last_commit) = &status.last_commit {
            metadata_parts.push(last_commit.hash.as_str());
        }

        Self {
            repo_root: local_path_artifact(repo_root),
            changed_file_paths: file_paths_artifact(changed_paths),
            status_metadata: safe_status_metadata_artifact(&metadata_parts),
            runtime_error: None,
            status: GitRuntimeBoundarySummary::from_status(RuntimeExecutionStatus::Succeeded, None),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GitDiffRuntimeArtifacts {
    pub(crate) repo_root: RuntimeArtifactSummary,
    pub(crate) changed_file_paths: RuntimeArtifactSummary,
    pub(crate) command_payload: RuntimeArtifactSummary,
    pub(crate) raw_diff: RuntimeArtifactSummary,
    pub(crate) runtime_error: Option<RuntimeArtifactSummary>,
    pub(crate) status: GitRuntimeBoundarySummary,
}

impl GitDiffRuntimeArtifacts {
    pub(crate) fn from_request(repo_root: &Path) -> Self {
        Self {
            repo_root: local_path_artifact(repo_root),
            changed_file_paths: file_paths_artifact(std::iter::empty::<&str>()),
            command_payload: command_payload_artifact(std::iter::empty::<(&str, &[String])>()),
            raw_diff: raw_diff_artifact(0, false),
            runtime_error: None,
            status: GitRuntimeBoundarySummary::from_status(RuntimeExecutionStatus::Running, None),
        }
    }

    pub(crate) fn from_summary(summary: &GitDiffSummary) -> Self {
        let paths = summary.files.iter().map(|file| file.path.as_str());
        let command_parts = summary
            .command_summary
            .iter()
            .map(|command| (command.program.as_str(), command.args.as_slice()));
        let diff_bytes = summary
            .files
            .iter()
            .filter_map(|file| file.patch_preview.as_deref())
            .map(str::len)
            .sum();
        let diff_capped = summary.files.iter().any(|file| file.patch_truncated);
        let execution_status = match summary.status {
            GitDiffSummaryStatus::Clean | GitDiffSummaryStatus::Dirty => {
                RuntimeExecutionStatus::Succeeded
            }
            GitDiffSummaryStatus::Unavailable => RuntimeExecutionStatus::Unsupported,
            GitDiffSummaryStatus::Failed => RuntimeExecutionStatus::Failed,
        };
        let runtime_error = summary.error_message.as_deref().map(runtime_error_artifact);

        Self {
            repo_root: local_path_text_artifact(&summary.repo_root),
            changed_file_paths: file_paths_artifact(paths),
            command_payload: command_payload_artifact(command_parts),
            raw_diff: raw_diff_artifact(diff_bytes, diff_capped),
            runtime_error,
            status: GitRuntimeBoundarySummary::from_status(
                execution_status,
                summary.error_message.as_deref(),
            ),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GitCommitRuntimeArtifacts {
    pub(crate) repo_root: RuntimeArtifactSummary,
    pub(crate) selected_file_paths: RuntimeArtifactSummary,
    pub(crate) commit_message: RuntimeArtifactSummary,
    pub(crate) command_payload: RuntimeArtifactSummary,
    pub(crate) stdout: RuntimeArtifactSummary,
    pub(crate) stderr: RuntimeArtifactSummary,
    pub(crate) commit_hash: Option<RuntimeArtifactSummary>,
    pub(crate) runtime_error: Option<RuntimeArtifactSummary>,
    pub(crate) status: GitRuntimeBoundarySummary,
}

impl GitCommitRuntimeArtifacts {
    pub(crate) fn from_input(
        repo_root: &Path,
        commit_message: &str,
        included_files: &[String],
    ) -> Self {
        Self {
            repo_root: local_path_artifact(repo_root),
            selected_file_paths: file_paths_artifact(included_files.iter().map(String::as_str)),
            commit_message: commit_message_artifact(commit_message),
            command_payload: command_payload_artifact(std::iter::empty::<(&str, &[String])>()),
            stdout: raw_tool_output_artifact(0, false),
            stderr: raw_tool_output_artifact(0, false),
            commit_hash: None,
            runtime_error: None,
            status: GitRuntimeBoundarySummary::from_status(RuntimeExecutionStatus::Running, None),
        }
    }

    pub(crate) fn from_result(result: &GitCommitResult) -> Self {
        let command_parts = result
            .command_summary
            .iter()
            .map(|command| (command.program.as_str(), command.args.as_slice()));
        let execution_status = match result.status {
            GitCommitStatus::Committed => RuntimeExecutionStatus::Succeeded,
            GitCommitStatus::Failed => RuntimeExecutionStatus::Failed,
        };

        Self {
            repo_root: local_path_text_artifact(&result.repo_root),
            selected_file_paths: file_paths_artifact(
                result.included_files.iter().map(String::as_str),
            ),
            commit_message: commit_message_artifact(&result.commit_message),
            command_payload: command_payload_artifact(command_parts),
            stdout: stdout_artifact(&result.stdout, false),
            stderr: stderr_artifact(&result.stderr, false),
            commit_hash: result.commit_hash.as_deref().map(commit_hash_artifact),
            runtime_error: result.error_message.as_deref().map(runtime_error_artifact),
            status: GitRuntimeBoundarySummary::from_status(
                execution_status,
                result.error_message.as_deref(),
            ),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GitRuntimeBoundarySummary {
    pub(crate) runtime_kind: RuntimeKind,
    pub(crate) execution_status: RuntimeExecutionStatus,
    pub(crate) error_kind: Option<RuntimeErrorKind>,
    pub(crate) artifact: RuntimeArtifactSummary,
}

impl GitRuntimeBoundarySummary {
    pub(crate) fn from_status(
        execution_status: RuntimeExecutionStatus,
        error_message: Option<&str>,
    ) -> Self {
        let error_kind = error_message.map(|_| error_kind_for_execution_status(execution_status));
        let artifact = match error_message {
            Some(error_message) => runtime_error_artifact(error_message),
            None => safe_status_metadata_artifact(&[status_label(execution_status)]),
        };

        Self {
            runtime_kind: RuntimeKind::Git,
            execution_status,
            error_kind,
            artifact,
        }
    }

    pub(crate) fn from_git_status_error(error: &GitStatusError) -> Self {
        let (execution_status, error_kind) = git_status_error_kind(error);
        Self::from_error_parts(execution_status, error_kind, &error.to_string())
    }

    pub(crate) fn from_git_diff_error(error: &GitDiffError) -> Self {
        let (execution_status, error_kind) = git_diff_error_kind(error);
        Self::from_error_parts(execution_status, error_kind, &error.to_string())
    }

    pub(crate) fn from_git_commit_error(error: &GitCommitError) -> Self {
        let (execution_status, error_kind) = git_commit_error_kind(error);
        Self::from_error_parts(execution_status, error_kind, &error.to_string())
    }

    fn from_error_parts(
        execution_status: RuntimeExecutionStatus,
        error_kind: RuntimeErrorKind,
        error_message: &str,
    ) -> Self {
        Self {
            runtime_kind: RuntimeKind::Git,
            execution_status,
            error_kind: Some(error_kind),
            artifact: runtime_error_artifact(error_message),
        }
    }
}

pub(crate) fn classify_git_status_error_passthrough(error: GitStatusError) -> GitStatusError {
    let _runtime_boundary = GitRuntimeBoundarySummary::from_git_status_error(&error);
    error
}

pub(crate) fn classify_git_diff_error_passthrough(error: GitDiffError) -> GitDiffError {
    let _runtime_boundary = GitRuntimeBoundarySummary::from_git_diff_error(&error);
    error
}

pub(crate) fn classify_git_commit_error_passthrough(error: GitCommitError) -> GitCommitError {
    let _runtime_boundary = GitRuntimeBoundarySummary::from_git_commit_error(&error);
    error
}

pub(crate) fn local_path_artifact(path: &Path) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(path.as_os_str().to_string_lossy().len())
}

pub(crate) fn local_path_text_artifact(path: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(path.len())
}

pub(crate) fn file_paths_artifact<'a>(
    paths: impl IntoIterator<Item = &'a str>,
) -> RuntimeArtifactSummary {
    let paths = paths.into_iter().collect::<Vec<_>>();

    RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(paths.iter().map(|path| path.len()).sum())
        .with_item_count(paths.len())
}

pub(crate) fn command_payload_artifact<'a>(
    commands: impl IntoIterator<Item = (&'a str, &'a [String])>,
) -> RuntimeArtifactSummary {
    let commands = commands.into_iter().collect::<Vec<_>>();
    let byte_count = commands
        .iter()
        .map(|(program, args)| program.len() + args.iter().map(String::len).sum::<usize>())
        .sum();
    let item_count = commands
        .iter()
        .map(|(_, args)| args.len() + 1)
        .sum::<usize>();
    let redaction_status = if commands.iter().any(|(program, args)| {
        contains_secret_like(program) || args.iter().any(|arg| contains_secret_like(arg))
    }) {
        RuntimeRedactionStatus::ContainsSecretCandidate
    } else {
        RuntimeRedactionStatus::NotRedacted
    };

    RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
        .with_redaction_status(redaction_status)
        .with_byte_count(byte_count)
        .with_item_count(item_count)
}

pub(crate) fn commit_message_artifact(message: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::OperatorText)
        .with_redaction_status(redaction_status_for_text(message))
        .with_byte_count(message.len())
}

pub(crate) fn raw_diff_artifact(byte_count: usize, capped: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(byte_count, capped)
}

pub(crate) fn stdout_artifact(stdout: &str, capped: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(stdout.len(), capped)
}

pub(crate) fn stderr_artifact(stderr: &str, capped: bool) -> RuntimeArtifactSummary {
    raw_tool_output_artifact(stderr.len(), capped)
}

pub(crate) fn runtime_error_artifact(error: &str) -> RuntimeArtifactSummary {
    RuntimeArtifactSummary::new(RuntimeArtifactClass::RuntimeError)
        .with_redaction_status(RuntimeRedactionStatus::Redacted)
        .with_byte_count(error.len())
}

pub(crate) fn safe_status_metadata_artifact(parts: &[&str]) -> RuntimeArtifactSummary {
    let byte_count = parts.iter().map(|part| part.len()).sum();

    if parts.iter().any(|part| contains_secret_like(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::SecretCandidate)
            .with_redaction_status(RuntimeRedactionStatus::ContainsSecretCandidate)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_local_path(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::LocalPath)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_raw_output(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_command_payload(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::CommandPayload)
            .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else if parts.iter().any(|part| looks_like_commit_message(part)) {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::OperatorText)
            .with_redaction_status(redaction_status_for_parts(parts))
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    } else {
        RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
            .with_summary("git runtime metadata")
            .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
            .with_byte_count(byte_count)
            .with_item_count(parts.len())
    }
}

pub(crate) fn commit_hash_artifact(hash: &str) -> RuntimeArtifactSummary {
    if contains_secret_like(hash) || looks_like_raw_output(hash) {
        return RuntimeArtifactSummary::new(RuntimeArtifactClass::SecretCandidate)
            .with_redaction_status(RuntimeRedactionStatus::ContainsSecretCandidate)
            .with_byte_count(hash.len());
    }

    RuntimeArtifactSummary::new(RuntimeArtifactClass::SafeMetadata)
        .with_summary("git commit hash")
        .with_redaction_status(RuntimeRedactionStatus::NotNeeded)
        .with_byte_count(hash.len())
}

fn raw_tool_output_artifact(byte_count: usize, capped: bool) -> RuntimeArtifactSummary {
    let mut artifact = RuntimeArtifactSummary::new(RuntimeArtifactClass::RawToolOutput)
        .with_redaction_status(RuntimeRedactionStatus::NotRedacted)
        .with_byte_count(byte_count);
    if capped {
        artifact = artifact.capped();
    }
    artifact
}

fn redaction_status_for_parts(parts: &[&str]) -> RuntimeRedactionStatus {
    if parts.iter().any(|part| contains_secret_like(part)) {
        RuntimeRedactionStatus::ContainsSecretCandidate
    } else {
        RuntimeRedactionStatus::NotRedacted
    }
}

fn redaction_status_for_text(text: &str) -> RuntimeRedactionStatus {
    if contains_secret_like(text) {
        RuntimeRedactionStatus::ContainsSecretCandidate
    } else {
        RuntimeRedactionStatus::NotRedacted
    }
}

fn git_status_error_kind(error: &GitStatusError) -> (RuntimeExecutionStatus, RuntimeErrorKind) {
    match error {
        GitStatusError::RepositoryNotConfigured => (
            RuntimeExecutionStatus::NotConfigured,
            RuntimeErrorKind::NotConfigured,
        ),
        GitStatusError::UnsupportedRuntime => (
            RuntimeExecutionStatus::Unsupported,
            RuntimeErrorKind::Unsupported,
        ),
        GitStatusError::GitUnavailable => (
            RuntimeExecutionStatus::Unsupported,
            RuntimeErrorKind::Unsupported,
        ),
        GitStatusError::TimedOut => (RuntimeExecutionStatus::TimedOut, RuntimeErrorKind::TimedOut),
        GitStatusError::PermissionDenied => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::PermissionDenied,
        ),
        GitStatusError::OutputTooLarge => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::OutputCapped,
        ),
        GitStatusError::PathNotFound | GitStatusError::NotGitRepository => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::ValidationFailed,
        ),
        GitStatusError::CommandFailed { .. } => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::ExecutionFailed,
        ),
        GitStatusError::NonUtf8Output | GitStatusError::Parse(_) | GitStatusError::Unknown(_) => {
            (RuntimeExecutionStatus::Failed, RuntimeErrorKind::Unknown)
        }
    }
}

fn git_diff_error_kind(error: &GitDiffError) -> (RuntimeExecutionStatus, RuntimeErrorKind) {
    match error {
        GitDiffError::RepositoryNotConfigured => (
            RuntimeExecutionStatus::NotConfigured,
            RuntimeErrorKind::NotConfigured,
        ),
        GitDiffError::GitUnavailable => (
            RuntimeExecutionStatus::Unsupported,
            RuntimeErrorKind::Unsupported,
        ),
        GitDiffError::TimedOut => (RuntimeExecutionStatus::TimedOut, RuntimeErrorKind::TimedOut),
        GitDiffError::PermissionDenied => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::PermissionDenied,
        ),
        GitDiffError::PathNotFound | GitDiffError::NotDirectory => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::ValidationFailed,
        ),
        GitDiffError::NonUtf8Output | GitDiffError::Unknown(_) => {
            (RuntimeExecutionStatus::Failed, RuntimeErrorKind::Unknown)
        }
    }
}

fn git_commit_error_kind(error: &GitCommitError) -> (RuntimeExecutionStatus, RuntimeErrorKind) {
    match error {
        GitCommitError::RepositoryNotConfigured => (
            RuntimeExecutionStatus::NotConfigured,
            RuntimeErrorKind::NotConfigured,
        ),
        GitCommitError::GitUnavailable => (
            RuntimeExecutionStatus::Unsupported,
            RuntimeErrorKind::Unsupported,
        ),
        GitCommitError::TimedOut => (RuntimeExecutionStatus::TimedOut, RuntimeErrorKind::TimedOut),
        GitCommitError::PermissionDenied => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::PermissionDenied,
        ),
        GitCommitError::PathNotFound
        | GitCommitError::NotDirectory
        | GitCommitError::NotGitRepository
        | GitCommitError::EmptyCommitMessage
        | GitCommitError::EmptyIncludedFiles
        | GitCommitError::InvalidIncludedFile { .. }
        | GitCommitError::StagedFilesOutsideSelection { .. } => (
            RuntimeExecutionStatus::Failed,
            RuntimeErrorKind::ValidationFailed,
        ),
        GitCommitError::NonUtf8Output | GitCommitError::Unknown(_) => {
            (RuntimeExecutionStatus::Failed, RuntimeErrorKind::Unknown)
        }
    }
}

fn error_kind_for_execution_status(status: RuntimeExecutionStatus) -> RuntimeErrorKind {
    match status {
        RuntimeExecutionStatus::TimedOut => RuntimeErrorKind::TimedOut,
        RuntimeExecutionStatus::Unsupported => RuntimeErrorKind::Unsupported,
        RuntimeExecutionStatus::NotConfigured => RuntimeErrorKind::NotConfigured,
        _ => RuntimeErrorKind::ExecutionFailed,
    }
}

fn status_label(status: RuntimeExecutionStatus) -> &'static str {
    match status {
        RuntimeExecutionStatus::Pending => "pending",
        RuntimeExecutionStatus::Starting => "starting",
        RuntimeExecutionStatus::Running => "running",
        RuntimeExecutionStatus::Succeeded => "succeeded",
        RuntimeExecutionStatus::Failed => "failed",
        RuntimeExecutionStatus::TimedOut => "timed_out",
        RuntimeExecutionStatus::CancelRequested => "cancel_requested",
        RuntimeExecutionStatus::Cancelled => "cancelled",
        RuntimeExecutionStatus::ForceKillRequested => "force_kill_requested",
        RuntimeExecutionStatus::ForceKilled => "force_killed",
        RuntimeExecutionStatus::Unsupported => "unsupported",
        RuntimeExecutionStatus::NotConfigured => "not_configured",
    }
}

fn contains_secret_like(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("password=")
        || lower.contains("token=")
        || lower.contains("secret=")
        || lower.contains("api_key=")
        || lower.contains("apikey=")
        || lower.contains("authorization:")
        || lower.contains("bearer ")
        || value.contains("sk-")
}

fn looks_like_local_path(value: &str) -> bool {
    let normalized = value.replace('\\', "/");
    normalized.starts_with('/')
        || normalized.starts_with("~/")
        || normalized.contains(":/")
        || normalized.contains("/Users/")
        || normalized.contains("/home/")
        || normalized.starts_with("./")
        || normalized.starts_with("../")
}

fn looks_like_command_payload(value: &str) -> bool {
    let trimmed = value.trim_start();
    trimmed.starts_with("git ")
        || trimmed.starts_with("cargo ")
        || trimmed.starts_with("npm ")
        || trimmed.starts_with("powershell ")
        || trimmed.starts_with("bash ")
        || trimmed.contains(" --")
}

fn looks_like_raw_output(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("stdout")
        || lower.contains("stderr")
        || lower.contains("diff --git")
        || lower.contains("@@")
        || lower.contains("\n+")
        || lower.contains("\n-")
}

fn looks_like_commit_message(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.starts_with("commit message:")
        || lower.starts_with("message:")
        || lower.contains("operator commit message")
}
