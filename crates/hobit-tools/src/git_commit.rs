//! Explicit local Git commit adapter.
//!
//! This module is intentionally narrow. It creates only local commits from an
//! explicit repository root, operator-provided commit message, and explicit
//! repo-relative file list. It does not push, reset, clean, checkout, restore,
//! rebase, merge, apply patches, discover repositories, or invoke a shell.

use std::collections::BTreeSet;
use std::error::Error;
use std::fmt;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::Instant;

use crate::process::{run_process_once, ProcessRunRequest, ProcessRunStatus};

const GIT_COMMIT_TIMEOUT_MS: u64 = 30_000;
const GIT_COMMIT_STDOUT_CAP_BYTES: usize = 256 * 1024;
const GIT_COMMIT_STDERR_CAP_BYTES: usize = 256 * 1024;
const GIT_READ_STDOUT_CAP_BYTES: usize = 512 * 1024;
const GIT_READ_STDERR_CAP_BYTES: usize = 64 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitCommitRequest {
    pub repo_root: PathBuf,
    pub commit_message: String,
    pub included_files: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitCommitResult {
    pub status: GitCommitStatus,
    pub commit_hash: Option<String>,
    pub branch: Option<String>,
    pub repo_root: String,
    pub included_files: Vec<String>,
    pub commit_message: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<GitCommitCommandSummary>,
    pub push_performed: bool,
    pub force_push_performed: bool,
    pub reset_performed: bool,
    pub clean_performed: bool,
    pub auto_commit: bool,
    pub operator_confirmed_required: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitCommitStatus {
    Committed,
    Failed,
}

impl GitCommitStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Committed => "committed",
            Self::Failed => "failed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitCommitCommandSummary {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GitCommitError {
    RepositoryNotConfigured,
    PathNotFound,
    NotDirectory,
    NotGitRepository,
    PermissionDenied,
    GitUnavailable,
    TimedOut,
    NonUtf8Output,
    EmptyCommitMessage,
    EmptyIncludedFiles,
    InvalidIncludedFile { path: String, reason: String },
    StagedFilesOutsideSelection { files: Vec<String> },
    Unknown(String),
}

impl fmt::Display for GitCommitError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RepositoryNotConfigured => write!(formatter, "repository root is not configured"),
            Self::PathNotFound => write!(formatter, "repository root was not found"),
            Self::NotDirectory => write!(formatter, "repository root is not a directory"),
            Self::NotGitRepository => write!(formatter, "repository root is not a Git repository"),
            Self::PermissionDenied => {
                write!(formatter, "permission denied while preparing Git commit")
            }
            Self::GitUnavailable => write!(formatter, "Git is not available"),
            Self::TimedOut => write!(formatter, "Git commit command timed out"),
            Self::NonUtf8Output => write!(formatter, "Git output was not valid UTF-8"),
            Self::EmptyCommitMessage => write!(formatter, "commit message must not be empty"),
            Self::EmptyIncludedFiles => write!(formatter, "included files must not be empty"),
            Self::InvalidIncludedFile { path, reason } => {
                write!(formatter, "invalid included file `{path}`: {reason}")
            }
            Self::StagedFilesOutsideSelection { files } => write!(
                formatter,
                "There are staged files outside the selected commit set. Unstage or include them before committing: {}",
                files.join(", ")
            ),
            Self::Unknown(message) => write!(formatter, "unknown Git commit error: {message}"),
        }
    }
}

impl Error for GitCommitError {}

pub fn create_git_commit(request: GitCommitRequest) -> Result<GitCommitResult, GitCommitError> {
    let started_at = Instant::now();
    let repo_root = request.repo_root;
    ensure_explicit_git_repo_root(&repo_root)?;

    let commit_message = validate_commit_message(&request.commit_message)?;
    let included_files = validate_included_files(&repo_root, request.included_files)?;
    let included_file_set = included_files.iter().cloned().collect::<BTreeSet<_>>();
    let repo_root_label = repo_root.display().to_string();
    let mut command_summary = Vec::new();

    let branch = read_branch(&repo_root, &mut command_summary)?;
    let staged_before = read_staged_files(&repo_root, &mut command_summary)?;
    reject_staged_files_outside_selection(&staged_before, &included_file_set)?;

    stage_included_files(&repo_root, &included_files, &mut command_summary)?;

    let staged_after = read_staged_files(&repo_root, &mut command_summary)?;
    reject_staged_files_outside_selection(&staged_after, &included_file_set)?;

    let commit_output = run_git(
        &repo_root,
        vec!["commit".to_owned(), "-m".to_owned(), commit_message.clone()],
        GIT_COMMIT_STDOUT_CAP_BYTES,
        GIT_COMMIT_STDERR_CAP_BYTES,
        &mut command_summary,
    )?;

    if !commit_output.exit_success() {
        let error_message = commit_failure_message(&commit_output);
        return Ok(GitCommitResult {
            status: GitCommitStatus::Failed,
            commit_hash: None,
            branch,
            repo_root: repo_root_label,
            included_files,
            commit_message,
            exit_code: commit_output.exit_code,
            stdout: commit_output.stdout,
            stderr: commit_output.stderr,
            duration_ms: started_at.elapsed().as_millis(),
            error_message: Some(error_message),
            command_summary,
            push_performed: false,
            force_push_performed: false,
            reset_performed: false,
            clean_performed: false,
            auto_commit: false,
            operator_confirmed_required: true,
        });
    }

    let commit_hash = read_commit_hash(&repo_root, &mut command_summary)?;

    Ok(GitCommitResult {
        status: GitCommitStatus::Committed,
        commit_hash: Some(commit_hash),
        branch,
        repo_root: repo_root_label,
        included_files,
        commit_message,
        exit_code: commit_output.exit_code,
        stdout: commit_output.stdout,
        stderr: commit_output.stderr,
        duration_ms: started_at.elapsed().as_millis(),
        error_message: None,
        command_summary,
        push_performed: false,
        force_push_performed: false,
        reset_performed: false,
        clean_performed: false,
        auto_commit: false,
        operator_confirmed_required: true,
    })
}

fn ensure_explicit_git_repo_root(repo_root: &Path) -> Result<(), GitCommitError> {
    if repo_root.as_os_str().is_empty() {
        return Err(GitCommitError::RepositoryNotConfigured);
    }

    match repo_root.try_exists() {
        Ok(true) if repo_root.is_dir() => {}
        Ok(true) => return Err(GitCommitError::NotDirectory),
        Ok(false) => return Err(GitCommitError::PathNotFound),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            return Err(GitCommitError::PermissionDenied)
        }
        Err(error) => {
            return Err(GitCommitError::Unknown(format!(
                "could not inspect repository root: {error}"
            )))
        }
    }

    match repo_root.join(".git").try_exists() {
        Ok(true) => Ok(()),
        Ok(false) => Err(GitCommitError::NotGitRepository),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            Err(GitCommitError::PermissionDenied)
        }
        Err(error) => Err(GitCommitError::Unknown(format!(
            "could not inspect repository metadata: {error}"
        ))),
    }
}

fn validate_commit_message(message: &str) -> Result<String, GitCommitError> {
    let message = message.trim();

    if message.is_empty() {
        return Err(GitCommitError::EmptyCommitMessage);
    }

    Ok(message.to_owned())
}

fn validate_included_files(
    repo_root: &Path,
    included_files: Vec<String>,
) -> Result<Vec<String>, GitCommitError> {
    if included_files.is_empty() {
        return Err(GitCommitError::EmptyIncludedFiles);
    }

    let mut validated = Vec::new();
    let mut seen = BTreeSet::new();

    for path in included_files {
        let normalized = validate_included_file(repo_root, &path)?;
        if seen.insert(normalized.clone()) {
            validated.push(normalized);
        }
    }

    if validated.is_empty() {
        return Err(GitCommitError::EmptyIncludedFiles);
    }

    Ok(validated)
}

fn validate_included_file(repo_root: &Path, path: &str) -> Result<String, GitCommitError> {
    let path = path.trim();

    if path.is_empty() {
        return Err(invalid_file(path, "path must not be empty"));
    }

    if path.contains('\0') {
        return Err(invalid_file(path, "path must not contain NUL bytes"));
    }

    if path.starts_with('-') {
        return Err(invalid_file(
            path,
            "path must not look like a command option",
        ));
    }

    if path.starts_with(":(") || path.contains(['*', '?', '[', ']']) {
        return Err(invalid_file(
            path,
            "pathspec expressions and wildcards are not supported",
        ));
    }

    if path.contains(':') {
        return Err(invalid_file(path, "path must be a repo-relative file path"));
    }

    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(invalid_file(path, "absolute paths are not allowed"));
    }

    for component in candidate.components() {
        match component {
            Component::Normal(_) => {}
            Component::ParentDir => {
                return Err(invalid_file(path, "path must not escape repo root"))
            }
            Component::CurDir => {
                return Err(invalid_file(path, "path must not contain . segments"))
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(invalid_file(path, "absolute paths are not allowed"))
            }
        }
    }

    let repo_path = repo_root.join(candidate);
    if repo_path.is_dir() {
        return Err(invalid_file(
            path,
            "directories are not accepted in included_files",
        ));
    }

    Ok(path.replace('\\', "/"))
}

fn invalid_file(path: &str, reason: &str) -> GitCommitError {
    GitCommitError::InvalidIncludedFile {
        path: path.to_owned(),
        reason: reason.to_owned(),
    }
}

fn read_branch(
    repo_root: &Path,
    command_summary: &mut Vec<GitCommitCommandSummary>,
) -> Result<Option<String>, GitCommitError> {
    let output = run_git(
        repo_root,
        vec![
            "rev-parse".to_owned(),
            "--abbrev-ref".to_owned(),
            "HEAD".to_owned(),
        ],
        GIT_READ_STDOUT_CAP_BYTES,
        GIT_READ_STDERR_CAP_BYTES,
        command_summary,
    )?;

    if !output.exit_success() {
        return Ok(None);
    }

    let branch = output.stdout.trim();

    if branch.is_empty() {
        Ok(None)
    } else {
        Ok(Some(branch.to_owned()))
    }
}

fn read_commit_hash(
    repo_root: &Path,
    command_summary: &mut Vec<GitCommitCommandSummary>,
) -> Result<String, GitCommitError> {
    let output = run_git(
        repo_root,
        vec!["rev-parse".to_owned(), "HEAD".to_owned()],
        GIT_READ_STDOUT_CAP_BYTES,
        GIT_READ_STDERR_CAP_BYTES,
        command_summary,
    )?;

    if !output.exit_success() {
        return Err(GitCommitError::Unknown(format!(
            "Git rev-parse HEAD failed: {}",
            compact_process_message(&output)
        )));
    }

    let hash = output.stdout.trim();

    if hash.is_empty() {
        return Err(GitCommitError::Unknown(
            "Git rev-parse HEAD returned an empty commit hash".to_owned(),
        ));
    }

    Ok(hash.to_owned())
}

fn read_staged_files(
    repo_root: &Path,
    command_summary: &mut Vec<GitCommitCommandSummary>,
) -> Result<BTreeSet<String>, GitCommitError> {
    let output = run_git(
        repo_root,
        vec![
            "diff".to_owned(),
            "--cached".to_owned(),
            "--name-only".to_owned(),
            "-z".to_owned(),
        ],
        GIT_READ_STDOUT_CAP_BYTES,
        GIT_READ_STDERR_CAP_BYTES,
        command_summary,
    )?;

    if !output.exit_success() {
        return Err(GitCommitError::Unknown(format!(
            "Git staged file read failed: {}",
            compact_process_message(&output)
        )));
    }

    Ok(output
        .stdout
        .split('\0')
        .filter(|path| !path.is_empty())
        .map(|path| path.replace('\\', "/"))
        .collect())
}

fn reject_staged_files_outside_selection(
    staged_files: &BTreeSet<String>,
    included_file_set: &BTreeSet<String>,
) -> Result<(), GitCommitError> {
    let outside_files = staged_files
        .difference(included_file_set)
        .cloned()
        .collect::<Vec<_>>();

    if outside_files.is_empty() {
        Ok(())
    } else {
        Err(GitCommitError::StagedFilesOutsideSelection {
            files: outside_files,
        })
    }
}

fn stage_included_files(
    repo_root: &Path,
    included_files: &[String],
    command_summary: &mut Vec<GitCommitCommandSummary>,
) -> Result<(), GitCommitError> {
    let mut args = vec!["add".to_owned(), "--".to_owned()];
    args.extend(included_files.iter().cloned());

    let output = run_git(
        repo_root,
        args,
        GIT_READ_STDOUT_CAP_BYTES,
        GIT_READ_STDERR_CAP_BYTES,
        command_summary,
    )?;

    if output.exit_success() {
        Ok(())
    } else {
        Err(GitCommitError::Unknown(format!(
            "Git add failed: {}",
            compact_process_message(&output)
        )))
    }
}

fn run_git(
    repo_root: &Path,
    args: Vec<String>,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
    command_summary: &mut Vec<GitCommitCommandSummary>,
) -> Result<GitProcessOutput, GitCommitError> {
    let mut summary_args = vec!["-C".to_owned(), repo_root.display().to_string()];
    summary_args.extend(args);
    command_summary.push(GitCommitCommandSummary {
        program: "git".to_owned(),
        args: summary_args.clone(),
    });

    let output = run_process_once(ProcessRunRequest {
        program: "git".to_owned(),
        args: summary_args,
        stdin: None,
        working_directory: repo_root.to_path_buf(),
        timeout_ms: GIT_COMMIT_TIMEOUT_MS,
        stdout_cap_bytes,
        stderr_cap_bytes,
    });

    match output.status {
        ProcessRunStatus::Completed => Ok(GitProcessOutput {
            exit_code: output.exit_code,
            stdout: output.stdout,
            stderr: output.stderr,
        }),
        ProcessRunStatus::TimedOut => Err(GitCommitError::TimedOut),
        ProcessRunStatus::FailedToStart => Err(map_failed_to_start(output.error_message)),
    }
}

fn map_failed_to_start(error_message: Option<String>) -> GitCommitError {
    let Some(message) = error_message else {
        return GitCommitError::Unknown("could not start Git command".to_owned());
    };

    let lower = message.to_ascii_lowercase();
    if lower.contains("could not start process `git`") {
        GitCommitError::GitUnavailable
    } else if lower.contains("permission denied") || lower.contains("access is denied") {
        GitCommitError::PermissionDenied
    } else {
        GitCommitError::Unknown(message)
    }
}

#[derive(Debug)]
struct GitProcessOutput {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

impl GitProcessOutput {
    fn exit_success(&self) -> bool {
        self.exit_code == Some(0)
    }
}

fn commit_failure_message(output: &GitProcessOutput) -> String {
    let detail = compact_process_message(output);

    if detail.is_empty() {
        format!("Git commit failed with exit code {:?}.", output.exit_code)
    } else {
        format!(
            "Git commit failed with exit code {:?}: {detail}",
            output.exit_code
        )
    }
}

fn compact_process_message(output: &GitProcessOutput) -> String {
    first_meaningful_lines(&output.stderr)
        .or_else(|| first_meaningful_lines(&output.stdout))
        .unwrap_or_default()
}

fn first_meaningful_lines(text: &str) -> Option<String> {
    let lines = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>();

    if lines.is_empty() {
        None
    } else {
        Some(lines.join(" "))
    }
}
