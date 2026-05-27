//! Read-only Git diff summary adapter.
//!
//! This module runs only fixed read-only Git commands against an explicit
//! repository root. It does not stage, commit, push, reset, clean, checkout,
//! restore, apply patches, discover repositories, or invoke a shell.

use std::collections::BTreeMap;
use std::error::Error;
use std::fmt;
use std::io;
use std::path::{Path, PathBuf};

use crate::git::{parse_git_status_porcelain_v1_branch, GitFileChangeArea, GitFileChangeKind};

mod command;
use command::{run_git_command, GitCommandOutput};

const DEFAULT_MAX_FILES: usize = 100;
const MAX_FILES_CAP: usize = 500;
const DEFAULT_PATCH_PREVIEW_CAP_BYTES: usize = 16 * 1024;
const MAX_PATCH_PREVIEW_CAP_BYTES: usize = 128 * 1024;
const GIT_DIFF_STDOUT_CAP_BYTES: usize = 512 * 1024;
const GIT_DIFF_STDERR_CAP_BYTES: usize = 64 * 1024;
const DEFAULT_GIT_LOG_LIMIT: usize = 30;
const MAX_GIT_LOG_LIMIT: usize = 100;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitDiffSummaryRequest {
    pub repo_root: PathBuf,
    pub max_files: Option<usize>,
    pub max_patch_bytes_per_file: Option<usize>,
    pub include_patch_preview: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitDiffSummary {
    pub repo_root: String,
    pub status: GitDiffSummaryStatus,
    pub files: Vec<GitDiffFileSummary>,
    pub summary: GitDiffTotals,
    pub error_message: Option<String>,
    pub command_summary: Vec<GitDiffCommandSummary>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitDiffSummaryStatus {
    Clean,
    Dirty,
    Unavailable,
    Failed,
}

impl GitDiffSummaryStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Clean => "clean",
            Self::Dirty => "dirty",
            Self::Unavailable => "unavailable",
            Self::Failed => "failed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitDiffFileSummary {
    pub path: String,
    pub status: GitDiffFileStatus,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
    pub conflicted: bool,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub patch_preview: Option<String>,
    pub patch_truncated: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitDiffFileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Conflicted,
    Unknown,
}

impl GitDiffFileStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Added => "added",
            Self::Modified => "modified",
            Self::Deleted => "deleted",
            Self::Renamed => "renamed",
            Self::Copied => "copied",
            Self::Untracked => "untracked",
            Self::Conflicted => "conflicted",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct GitDiffTotals {
    pub total_files: usize,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
    pub conflicted_count: usize,
    pub total_additions: Option<u64>,
    pub total_deletions: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitDiffCommandSummary {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitFileDiffRequest {
    pub repo_root: PathBuf,
    pub path: String,
    pub max_patch_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitFileDiffResult {
    pub repo_root: String,
    pub path: String,
    pub status: GitFileDiffStatus,
    pub patch: Option<String>,
    pub patch_truncated: bool,
    pub error_message: Option<String>,
    pub command_summary: Vec<GitDiffCommandSummary>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitFileDiffStatus {
    Available,
    Empty,
    Untracked,
    Binary,
    TooLarge,
    Failed,
}

impl GitFileDiffStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::Empty => "empty",
            Self::Untracked => "untracked",
            Self::Binary => "binary",
            Self::TooLarge => "too_large",
            Self::Failed => "failed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitLogRequest {
    pub repo_root: PathBuf,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitLogResult {
    pub repo_root: String,
    pub entries: Vec<GitLogEntry>,
    pub command_summary: Vec<GitDiffCommandSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GitDiffError {
    RepositoryNotConfigured,
    PathNotFound,
    NotDirectory,
    PermissionDenied,
    GitUnavailable,
    TimedOut,
    NonUtf8Output,
    Unknown(String),
}

impl fmt::Display for GitDiffError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RepositoryNotConfigured => write!(formatter, "repository is not configured"),
            Self::PathNotFound => write!(formatter, "repository path was not found"),
            Self::NotDirectory => write!(formatter, "repository path is not a directory"),
            Self::PermissionDenied => write!(formatter, "permission denied while reading Git diff"),
            Self::GitUnavailable => write!(formatter, "Git is not available"),
            Self::TimedOut => write!(formatter, "Git diff read timed out"),
            Self::NonUtf8Output => write!(formatter, "Git diff output was not valid UTF-8"),
            Self::Unknown(message) => write!(formatter, "unknown Git diff error: {message}"),
        }
    }
}

impl Error for GitDiffError {}

pub fn read_git_diff_summary(
    request: GitDiffSummaryRequest,
) -> Result<GitDiffSummary, GitDiffError> {
    ensure_explicit_repo_root(&request.repo_root)?;

    let repo_root = request.repo_root.clone();
    let repo_root_label = repo_root.display().to_string();
    let mut command_summary = Vec::new();
    let status_output = match run_git_command(
        &repo_root,
        ["status", "--porcelain=v1", "--untracked-files=all"],
        GIT_DIFF_STDOUT_CAP_BYTES,
        GIT_DIFF_STDERR_CAP_BYTES,
        &mut command_summary,
    ) {
        Ok(output) => output,
        Err(GitDiffError::GitUnavailable) => {
            return Ok(failed_summary(
                repo_root_label,
                GitDiffSummaryStatus::Unavailable,
                "Git is not available.",
                command_summary,
            ));
        }
        Err(error) => return Err(error),
    };

    if !status_output.exit_success {
        return Ok(status_failure_summary(
            repo_root_label,
            &status_output,
            command_summary,
        ));
    }

    let status_text =
        String::from_utf8(status_output.stdout).map_err(|_| GitDiffError::NonUtf8Output)?;
    let mut files = aggregate_status_files(&status_text);
    let total_file_count = files.len();

    if files.is_empty() {
        return Ok(GitDiffSummary {
            repo_root: repo_root_label,
            status: GitDiffSummaryStatus::Clean,
            files: Vec::new(),
            summary: GitDiffTotals::default(),
            error_message: None,
            command_summary,
        });
    }

    let unstaged_numstat = run_numstat_command(&repo_root, false, &mut command_summary)?;
    let staged_numstat = run_numstat_command(&repo_root, true, &mut command_summary)?;
    apply_line_deltas(&mut files, unstaged_numstat);
    apply_line_deltas(&mut files, staged_numstat);

    if request.include_patch_preview {
        add_patch_previews(&repo_root, &request, &mut files, &mut command_summary)?;
    }

    let summary = summarize_files(&files, total_file_count);
    let max_files = normalize_max_files(request.max_files);

    Ok(GitDiffSummary {
        repo_root: repo_root_label,
        status: GitDiffSummaryStatus::Dirty,
        files: files.into_values().take(max_files).collect(),
        summary,
        error_message: None,
        command_summary,
    })
}

pub fn read_git_file_diff(request: GitFileDiffRequest) -> Result<GitFileDiffResult, GitDiffError> {
    ensure_explicit_repo_root(&request.repo_root)?;
    let path = validate_repo_relative_path(&request.path)?;
    let repo_root = request.repo_root.clone();
    let repo_root_label = repo_root.display().to_string();
    let cap = normalize_patch_cap(request.max_patch_bytes);
    let mut command_summary = Vec::new();

    let status_output = run_git_command(
        &repo_root,
        ["status", "--porcelain=v1", "--", path.as_str()],
        GIT_DIFF_STDOUT_CAP_BYTES,
        GIT_DIFF_STDERR_CAP_BYTES,
        &mut command_summary,
    )?;

    if !status_output.exit_success {
        return Ok(file_diff_failure(
            repo_root_label,
            path,
            "Git status command failed while preparing selected-file diff.",
            command_summary,
        ));
    }

    let status_text =
        String::from_utf8(status_output.stdout).map_err(|_| GitDiffError::NonUtf8Output)?;
    let is_untracked = status_text.lines().any(|line| line.starts_with("?? "));

    let mut chunks = Vec::new();
    let mut truncated = false;

    let staged_output = run_file_diff_command(&repo_root, &path, true, cap, &mut command_summary)?;
    append_patch_chunk("staged diff", staged_output, &mut chunks, &mut truncated)?;

    let unstaged_output =
        run_file_diff_command(&repo_root, &path, false, cap, &mut command_summary)?;
    append_patch_chunk(
        "unstaged diff",
        unstaged_output,
        &mut chunks,
        &mut truncated,
    )?;

    if chunks.is_empty() && is_untracked {
        return Ok(GitFileDiffResult {
            repo_root: repo_root_label,
            path,
            status: GitFileDiffStatus::Untracked,
            patch: None,
            patch_truncated: false,
            error_message: Some(
                "Untracked file patch preview is not available in this read-only diff view."
                    .to_owned(),
            ),
            command_summary,
        });
    }

    if chunks.is_empty() {
        return Ok(GitFileDiffResult {
            repo_root: repo_root_label,
            path,
            status: GitFileDiffStatus::Empty,
            patch: None,
            patch_truncated: false,
            error_message: None,
            command_summary,
        });
    }

    let combined = chunks.join("\n");
    let (patch, cap_truncated) = cap_text(&combined, cap);
    let patch_truncated = truncated || cap_truncated;
    let status = if patch_truncated {
        GitFileDiffStatus::TooLarge
    } else if looks_like_binary_diff(&patch) {
        GitFileDiffStatus::Binary
    } else {
        GitFileDiffStatus::Available
    };

    Ok(GitFileDiffResult {
        repo_root: repo_root_label,
        path,
        status,
        patch: Some(patch),
        patch_truncated,
        error_message: if patch_truncated {
            Some("Diff output was capped for this selected file.".to_owned())
        } else if status == GitFileDiffStatus::Binary {
            Some("Git reported a binary diff for this selected file.".to_owned())
        } else {
            None
        },
        command_summary,
    })
}

pub fn read_git_log(request: GitLogRequest) -> Result<GitLogResult, GitDiffError> {
    ensure_explicit_repo_root(&request.repo_root)?;
    let repo_root = request.repo_root.clone();
    let repo_root_label = repo_root.display().to_string();
    let limit = normalize_log_limit(request.limit);
    let mut command_summary = Vec::new();
    let pretty_format = "%H%x1f%h%x1f%an%x1f%ad%x1f%s";

    let output = run_git_command(
        &repo_root,
        vec![
            "log".to_owned(),
            "-n".to_owned(),
            limit.to_string(),
            "--date=iso-strict".to_owned(),
            format!("--pretty=format:{pretty_format}"),
        ],
        GIT_DIFF_STDOUT_CAP_BYTES,
        GIT_DIFF_STDERR_CAP_BYTES,
        &mut command_summary,
    )?;

    if !output.exit_success {
        return Err(GitDiffError::Unknown(format!(
            "Git log failed: {}",
            compact_error_message(&output.stderr)
        )));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|_| GitDiffError::NonUtf8Output)?;

    Ok(GitLogResult {
        repo_root: repo_root_label,
        entries: parse_log_entries(&stdout),
        command_summary,
    })
}

fn run_numstat_command(
    repo_root: &Path,
    staged: bool,
    command_summary: &mut Vec<GitDiffCommandSummary>,
) -> Result<Vec<LineDelta>, GitDiffError> {
    let args = if staged {
        vec!["diff", "--cached", "--numstat"]
    } else {
        vec!["diff", "--numstat"]
    };
    let output = run_git_command(
        repo_root,
        args,
        GIT_DIFF_STDOUT_CAP_BYTES,
        GIT_DIFF_STDERR_CAP_BYTES,
        command_summary,
    )?;

    if !output.exit_success {
        return Err(GitDiffError::Unknown(format!(
            "Git diff --numstat failed: {}",
            compact_error_message(&output.stderr)
        )));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|_| GitDiffError::NonUtf8Output)?;
    Ok(parse_numstat(&stdout))
}

fn add_patch_previews(
    repo_root: &Path,
    request: &GitDiffSummaryRequest,
    files: &mut BTreeMap<String, GitDiffFileSummary>,
    command_summary: &mut Vec<GitDiffCommandSummary>,
) -> Result<(), GitDiffError> {
    let cap = normalize_patch_cap(request.max_patch_bytes_per_file);

    for file in files.values_mut() {
        if file.untracked || file.conflicted {
            continue;
        }

        let mut chunks = Vec::new();
        let mut truncated = false;

        if file.staged {
            let output = run_file_diff_command(repo_root, &file.path, true, cap, command_summary)?;
            append_patch_chunk("staged diff", output, &mut chunks, &mut truncated)?;
        }

        if file.unstaged {
            let output = run_file_diff_command(repo_root, &file.path, false, cap, command_summary)?;
            append_patch_chunk("unstaged diff", output, &mut chunks, &mut truncated)?;
        }

        if chunks.is_empty() {
            continue;
        }

        let combined = chunks.join("\n");
        let (preview, cap_truncated) = cap_text(&combined, cap);
        file.patch_preview = Some(preview);
        file.patch_truncated = truncated || cap_truncated;
    }

    Ok(())
}

fn run_file_diff_command(
    repo_root: &Path,
    path: &str,
    staged: bool,
    cap: usize,
    command_summary: &mut Vec<GitDiffCommandSummary>,
) -> Result<GitCommandOutput, GitDiffError> {
    let args = if staged {
        vec!["diff", "--cached", "--", path]
    } else {
        vec!["diff", "--", path]
    };

    run_git_command(
        repo_root,
        args,
        cap.saturating_add(1),
        GIT_DIFF_STDERR_CAP_BYTES,
        command_summary,
    )
}

fn append_patch_chunk(
    label: &str,
    output: GitCommandOutput,
    chunks: &mut Vec<String>,
    truncated: &mut bool,
) -> Result<(), GitDiffError> {
    if !output.exit_success {
        return Ok(());
    }

    *truncated |= output.stdout_truncated;
    let stdout = String::from_utf8(output.stdout).map_err(|_| GitDiffError::NonUtf8Output)?;

    if stdout.trim().is_empty() {
        return Ok(());
    }

    chunks.push(format!("--- {label} ---\n{stdout}"));
    Ok(())
}

fn file_diff_failure(
    repo_root: String,
    path: String,
    message: impl Into<String>,
    command_summary: Vec<GitDiffCommandSummary>,
) -> GitFileDiffResult {
    GitFileDiffResult {
        repo_root,
        path,
        status: GitFileDiffStatus::Failed,
        patch: None,
        patch_truncated: false,
        error_message: Some(message.into()),
        command_summary,
    }
}

fn aggregate_status_files(output: &str) -> BTreeMap<String, GitDiffFileSummary> {
    let status = parse_git_status_porcelain_v1_branch(output);
    let mut files = BTreeMap::new();

    for change in status.changed_files {
        let path = change.path;
        let entry = files
            .entry(path.clone())
            .or_insert_with(|| GitDiffFileSummary {
                path,
                status: GitDiffFileStatus::Unknown,
                staged: false,
                unstaged: false,
                untracked: false,
                conflicted: false,
                additions: None,
                deletions: None,
                patch_preview: None,
                patch_truncated: false,
            });

        entry.status = merged_status(entry.status, change.kind);
        match change.area {
            GitFileChangeArea::Staged => entry.staged = true,
            GitFileChangeArea::Unstaged => entry.unstaged = true,
            GitFileChangeArea::Untracked => entry.untracked = true,
        }
        if change.kind == GitFileChangeKind::Conflicted {
            entry.conflicted = true;
        }
    }

    files
}

fn merged_status(current: GitDiffFileStatus, next: GitFileChangeKind) -> GitDiffFileStatus {
    let next = diff_file_status(next);

    if next == GitDiffFileStatus::Conflicted || current == GitDiffFileStatus::Conflicted {
        return GitDiffFileStatus::Conflicted;
    }

    if current == GitDiffFileStatus::Unknown {
        return next;
    }

    if current == next {
        return current;
    }

    GitDiffFileStatus::Modified
}

fn diff_file_status(kind: GitFileChangeKind) -> GitDiffFileStatus {
    match kind {
        GitFileChangeKind::Added => GitDiffFileStatus::Added,
        GitFileChangeKind::Modified => GitDiffFileStatus::Modified,
        GitFileChangeKind::Deleted => GitDiffFileStatus::Deleted,
        GitFileChangeKind::Renamed => GitDiffFileStatus::Renamed,
        GitFileChangeKind::Copied => GitDiffFileStatus::Copied,
        GitFileChangeKind::Untracked => GitDiffFileStatus::Untracked,
        GitFileChangeKind::Conflicted => GitDiffFileStatus::Conflicted,
        GitFileChangeKind::Unknown => GitDiffFileStatus::Unknown,
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct LineDelta {
    additions: Option<u64>,
    deletions: Option<u64>,
    path: String,
}

fn parse_numstat(output: &str) -> Vec<LineDelta> {
    output
        .lines()
        .filter_map(|line| {
            let mut fields = line.splitn(3, '\t');
            let additions = parse_numstat_count(fields.next()?);
            let deletions = parse_numstat_count(fields.next()?);
            let path = fields.next()?.trim().to_owned();

            Some(LineDelta {
                additions,
                deletions,
                path,
            })
        })
        .collect()
}

fn parse_numstat_count(value: &str) -> Option<u64> {
    value.parse::<u64>().ok()
}

fn apply_line_deltas(files: &mut BTreeMap<String, GitDiffFileSummary>, deltas: Vec<LineDelta>) {
    for delta in deltas {
        if let Some(file) = files.get_mut(&delta.path) {
            file.additions = sum_optional(file.additions, delta.additions);
            file.deletions = sum_optional(file.deletions, delta.deletions);
        }
    }
}

fn summarize_files(
    files: &BTreeMap<String, GitDiffFileSummary>,
    total_file_count: usize,
) -> GitDiffTotals {
    let mut totals = GitDiffTotals {
        total_files: total_file_count,
        ..GitDiffTotals::default()
    };

    for file in files.values() {
        if file.staged {
            totals.staged_count += 1;
        }
        if file.unstaged {
            totals.unstaged_count += 1;
        }
        if file.untracked {
            totals.untracked_count += 1;
        }
        if file.conflicted {
            totals.conflicted_count += 1;
        }
        totals.total_additions = sum_optional(totals.total_additions, file.additions);
        totals.total_deletions = sum_optional(totals.total_deletions, file.deletions);
    }

    totals
}

fn sum_optional(left: Option<u64>, right: Option<u64>) -> Option<u64> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left + right),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

fn failed_summary(
    repo_root: String,
    status: GitDiffSummaryStatus,
    message: impl Into<String>,
    command_summary: Vec<GitDiffCommandSummary>,
) -> GitDiffSummary {
    GitDiffSummary {
        repo_root,
        status,
        files: Vec::new(),
        summary: GitDiffTotals::default(),
        error_message: Some(message.into()),
        command_summary,
    }
}

fn status_failure_summary(
    repo_root: String,
    output: &GitCommandOutput,
    command_summary: Vec<GitDiffCommandSummary>,
) -> GitDiffSummary {
    let stderr = compact_error_message(&output.stderr);
    let lower_stderr = stderr.to_ascii_lowercase();
    let status = if lower_stderr.contains("not a git repository")
        || lower_stderr.contains("not in a git directory")
    {
        GitDiffSummaryStatus::Unavailable
    } else {
        GitDiffSummaryStatus::Failed
    };
    let message = if stderr.is_empty() {
        format!(
            "Git status command failed with exit code {:?}.",
            output.exit_code
        )
    } else {
        stderr
    };

    failed_summary(repo_root, status, message, command_summary)
}

fn ensure_explicit_repo_root(repo_root: &Path) -> Result<(), GitDiffError> {
    if repo_root.as_os_str().is_empty() {
        return Err(GitDiffError::RepositoryNotConfigured);
    }

    match repo_root.try_exists() {
        Ok(true) if repo_root.is_dir() => Ok(()),
        Ok(true) => Err(GitDiffError::NotDirectory),
        Ok(false) => Err(GitDiffError::PathNotFound),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            Err(GitDiffError::PermissionDenied)
        }
        Err(error) => Err(GitDiffError::Unknown(format!(
            "could not inspect repository path: {error}"
        ))),
    }
}

fn validate_repo_relative_path(path: &str) -> Result<String, GitDiffError> {
    let normalized = path.split('\\').collect::<Vec<_>>().join("/");

    if path.trim() != path || path.is_empty() || path.contains('\0') {
        return Err(GitDiffError::Unknown(
            "selected path must be a non-empty repo-relative path".to_owned(),
        ));
    }

    if path.starts_with('-')
        || path.starts_with(':')
        || path.starts_with('/')
        || path.starts_with("\\\\")
        || path.contains('*')
        || path.contains('?')
        || path.contains('[')
        || path.contains(']')
        || looks_like_windows_absolute_path(path)
        || normalized == "."
        || normalized == ".."
        || normalized.ends_with('/')
        || normalized.starts_with("../")
        || normalized.contains("/../")
        || normalized.contains("/./")
    {
        return Err(GitDiffError::Unknown(
            "selected path must stay inside the repository".to_owned(),
        ));
    }

    Ok(path.to_owned())
}

fn looks_like_windows_absolute_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
        && bytes[0].is_ascii_alphabetic()
}

fn looks_like_binary_diff(patch: &str) -> bool {
    patch.contains("Binary files ") || patch.contains("GIT binary patch")
}

fn parse_log_entries(output: &str) -> Vec<GitLogEntry> {
    output
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(5, '\u{1f}');
            Some(GitLogEntry {
                hash: parts.next()?.to_owned(),
                short_hash: parts.next()?.to_owned(),
                author: parts.next()?.to_owned(),
                date: parts.next()?.to_owned(),
                subject: parts.next()?.to_owned(),
            })
        })
        .collect()
}

fn compact_error_message(message: &[u8]) -> String {
    String::from_utf8_lossy(message)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
}

fn cap_text(value: &str, cap: usize) -> (String, bool) {
    if value.len() <= cap {
        return (value.to_owned(), false);
    }

    let mut end = 0;
    for (index, character) in value.char_indices() {
        let next = index + character.len_utf8();
        if next > cap {
            break;
        }
        end = next;
    }

    (value[..end].to_owned(), true)
}

fn normalize_max_files(value: Option<usize>) -> usize {
    value.unwrap_or(DEFAULT_MAX_FILES).min(MAX_FILES_CAP)
}

fn normalize_patch_cap(value: Option<usize>) -> usize {
    value
        .unwrap_or(DEFAULT_PATCH_PREVIEW_CAP_BYTES)
        .min(MAX_PATCH_PREVIEW_CAP_BYTES)
}

fn normalize_log_limit(value: Option<usize>) -> usize {
    value
        .unwrap_or(DEFAULT_GIT_LOG_LIMIT)
        .clamp(1, MAX_GIT_LOG_LIMIT)
}

#[cfg(test)]
mod tests;
