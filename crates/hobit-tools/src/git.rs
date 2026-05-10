//! Read-only Git status model, parser, and CLI adapter foundation.
//!
//! The parser converts already-captured `git status --porcelain=v1 -b` text into
//! typed review data for future Workbench surfaces. The CLI adapter is
//! intentionally narrow: it runs only the fixed read-only status command against
//! an explicit repository root with `std::process::Command`, no shell, no
//! repository discovery, no fetch, no mutation, and no Tauri/frontend exposure.

use std::error::Error;
use std::fmt;
use std::io::{self, Read};
use std::path::Path;
use std::process::{Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const GIT_STATUS_TIMEOUT: Duration = Duration::from_secs(5);
const GIT_STATUS_STDOUT_CAP_BYTES: usize = 256 * 1024;
const GIT_STATUS_STDERR_CAP_BYTES: usize = 64 * 1024;
const GIT_STATUS_POLL_INTERVAL: Duration = Duration::from_millis(10);

/// Read-only repository state shaped for visual review surfaces.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitRepositoryStatus {
    pub branch: Option<GitBranchSummary>,
    pub working_tree: GitWorkingTreeSummary,
    pub changed_files: Vec<GitFileChange>,
    pub last_commit: Option<GitLastCommitSummary>,
    pub warnings: Vec<String>,
}

impl GitRepositoryStatus {
    pub fn from_changed_files(
        branch: Option<GitBranchSummary>,
        changed_files: Vec<GitFileChange>,
        warnings: Vec<String>,
    ) -> Self {
        Self {
            branch,
            working_tree: GitWorkingTreeSummary::from_changed_files(&changed_files),
            changed_files,
            last_commit: None,
            warnings,
        }
    }
}

/// Current branch and upstream relationship when reported by Git status.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitBranchSummary {
    pub name: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub is_detached: bool,
}

/// Count summary for the working tree.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitWorkingTreeSummary {
    pub is_clean: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
}

impl GitWorkingTreeSummary {
    pub fn from_changed_files(changed_files: &[GitFileChange]) -> Self {
        let staged_count = changed_files
            .iter()
            .filter(|change| change.area == GitFileChangeArea::Staged)
            .count();
        let unstaged_count = changed_files
            .iter()
            .filter(|change| change.area == GitFileChangeArea::Unstaged)
            .count();
        let untracked_count = changed_files
            .iter()
            .filter(|change| change.area == GitFileChangeArea::Untracked)
            .count();

        Self {
            is_clean: changed_files.is_empty(),
            staged_count,
            unstaged_count,
            untracked_count,
        }
    }
}

/// One file-level read-only change, grouped by status area.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitFileChange {
    pub area: GitFileChangeArea,
    pub kind: GitFileChangeKind,
    pub path: String,
    pub original_path: Option<String>,
}

/// Where Git reported a file change.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitFileChangeArea {
    Staged,
    Unstaged,
    Untracked,
}

/// Git file change kind normalized for review UI.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GitFileChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Conflicted,
    Unknown,
}

/// Last commit data for a future read-only adapter.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitLastCommitSummary {
    pub hash: String,
    pub title: String,
    pub author: Option<String>,
    pub committed_at: Option<String>,
}

/// Error shape reserved for later read-only adapter work.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GitStatusError {
    RepositoryNotConfigured,
    UnsupportedRuntime,
    PathNotFound,
    NotGitRepository,
    GitUnavailable,
    PermissionDenied,
    TimedOut,
    OutputTooLarge,
    CommandFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
    NonUtf8Output,
    Parse(String),
    Unknown(String),
}

impl fmt::Display for GitStatusError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RepositoryNotConfigured => write!(formatter, "repository is not configured"),
            Self::UnsupportedRuntime => write!(formatter, "Git status is not supported here"),
            Self::PathNotFound => write!(formatter, "repository path was not found"),
            Self::NotGitRepository => write!(formatter, "path is not a Git repository"),
            Self::GitUnavailable => write!(formatter, "Git is not available"),
            Self::PermissionDenied => {
                write!(formatter, "permission denied while reading Git status")
            }
            Self::TimedOut => write!(formatter, "Git status read timed out"),
            Self::OutputTooLarge => write!(formatter, "Git status output is too large"),
            Self::CommandFailed { exit_code, stderr } => {
                write!(formatter, "Git status command failed")?;
                if let Some(exit_code) = exit_code {
                    write!(formatter, " with exit code {exit_code}")?;
                }
                if !stderr.is_empty() {
                    write!(formatter, ": {stderr}")?;
                }
                Ok(())
            }
            Self::NonUtf8Output => write!(formatter, "Git status output was not valid UTF-8"),
            Self::Parse(message) => write!(formatter, "could not parse Git status: {message}"),
            Self::Unknown(message) => write!(formatter, "unknown Git status error: {message}"),
        }
    }
}

impl Error for GitStatusError {}

/// Run the fixed read-only Git status command against an explicit repository root.
///
/// This function does not discover repositories, scan parent directories, fetch,
/// mutate Git state, or expose raw command output as its primary contract. The
/// adapter also disables optional Git locks for the status read.
pub fn read_git_repository_status(
    repo_root: impl AsRef<Path>,
) -> Result<GitRepositoryStatus, GitStatusError> {
    read_git_repository_status_with_limits(repo_root.as_ref(), GitStatusCommandLimits::default())
}

/// Parse `git status --porcelain=v1 -b` output into typed read-only status.
pub fn parse_git_status_porcelain_v1_branch(output: &str) -> GitRepositoryStatus {
    let mut branch = None;
    let mut changed_files = Vec::new();
    let mut warnings = Vec::new();

    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }

        if let Some(branch_line) = line.strip_prefix("## ") {
            branch = Some(parse_branch_summary(branch_line));
            continue;
        }

        let parsed = parse_status_line(line);

        if parsed.has_unknown_status {
            warnings.push("Unknown Git status code parsed as unknown.".to_owned());
        }

        changed_files.extend(parsed.changes);
    }

    GitRepositoryStatus::from_changed_files(branch, changed_files, warnings)
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ParsedStatusLine {
    changes: Vec<GitFileChange>,
    has_unknown_status: bool,
}

fn parse_branch_summary(line: &str) -> GitBranchSummary {
    let (left, tracking) = split_tracking_details(line.trim());
    let (branch_name, upstream) = split_branch_and_upstream(left);
    let branch_name = normalize_branch_name(branch_name);
    let is_detached = branch_name
        .as_deref()
        .is_some_and(|name| name.starts_with("HEAD"))
        || left.contains("detached");
    let (ahead, behind) = parse_ahead_behind(tracking);

    GitBranchSummary {
        name: branch_name,
        upstream,
        ahead,
        behind,
        is_detached,
    }
}

fn split_tracking_details(line: &str) -> (&str, Option<&str>) {
    if let Some((left, right)) = line.split_once(" [") {
        return (left.trim(), Some(right.trim_end_matches(']').trim()));
    }

    (line.trim(), None)
}

fn split_branch_and_upstream(value: &str) -> (&str, Option<String>) {
    if let Some((branch_name, upstream)) = value.split_once("...") {
        return (
            branch_name.trim(),
            non_empty_string(upstream.trim().to_owned()),
        );
    }

    (value.trim(), None)
}

fn normalize_branch_name(value: &str) -> Option<String> {
    let value = value.trim();

    if let Some(branch_name) = value.strip_prefix("No commits yet on ") {
        return non_empty_string(branch_name.trim().to_owned());
    }

    non_empty_string(value.to_owned())
}

fn parse_ahead_behind(tracking: Option<&str>) -> (Option<u32>, Option<u32>) {
    let mut ahead = None;
    let mut behind = None;

    if let Some(tracking) = tracking {
        for part in tracking.split(',').map(str::trim) {
            if let Some(value) = part.strip_prefix("ahead ") {
                ahead = value.parse::<u32>().ok();
            } else if let Some(value) = part.strip_prefix("behind ") {
                behind = value.parse::<u32>().ok();
            }
        }
    }

    (ahead, behind)
}

fn parse_status_line(line: &str) -> ParsedStatusLine {
    let Some(status) = line.get(..2) else {
        return ParsedStatusLine {
            changes: Vec::new(),
            has_unknown_status: false,
        };
    };
    let mut status_chars = status.chars();
    let staged_code = status_chars.next().unwrap_or(' ');
    let unstaged_code = status_chars.next().unwrap_or(' ');
    let path_part = line.get(3..).unwrap_or("").trim_end();

    if staged_code == '?' && unstaged_code == '?' {
        return ParsedStatusLine {
            changes: vec![file_change(
                GitFileChangeArea::Untracked,
                GitFileChangeKind::Untracked,
                path_part,
            )],
            has_unknown_status: false,
        };
    }

    if is_conflicted_status(staged_code, unstaged_code) {
        return ParsedStatusLine {
            changes: vec![file_change(
                GitFileChangeArea::Unstaged,
                GitFileChangeKind::Conflicted,
                path_part,
            )],
            has_unknown_status: false,
        };
    }

    let mut changes = Vec::new();
    let mut has_unknown_status = false;

    if staged_code != ' ' {
        let kind = file_change_kind(staged_code);
        has_unknown_status |= kind == GitFileChangeKind::Unknown;
        changes.push(file_change(GitFileChangeArea::Staged, kind, path_part));
    }

    if unstaged_code != ' ' {
        let kind = file_change_kind(unstaged_code);
        has_unknown_status |= kind == GitFileChangeKind::Unknown;
        changes.push(file_change(GitFileChangeArea::Unstaged, kind, path_part));
    }

    ParsedStatusLine {
        changes,
        has_unknown_status,
    }
}

fn file_change(area: GitFileChangeArea, kind: GitFileChangeKind, path_part: &str) -> GitFileChange {
    let (original_path, path) = parse_path_pair(path_part);

    GitFileChange {
        area,
        kind,
        path,
        original_path,
    }
}

fn parse_path_pair(path_part: &str) -> (Option<String>, String) {
    if let Some((original_path, path)) = path_part.split_once(" -> ") {
        return (
            non_empty_string(original_path.trim().to_owned()),
            path.trim().to_owned(),
        );
    }

    (None, path_part.trim().to_owned())
}

fn file_change_kind(code: char) -> GitFileChangeKind {
    match code {
        'A' => GitFileChangeKind::Added,
        'M' => GitFileChangeKind::Modified,
        'D' => GitFileChangeKind::Deleted,
        'R' => GitFileChangeKind::Renamed,
        'C' => GitFileChangeKind::Copied,
        'U' => GitFileChangeKind::Conflicted,
        '?' => GitFileChangeKind::Untracked,
        _ => GitFileChangeKind::Unknown,
    }
}

fn is_conflicted_status(staged_code: char, unstaged_code: char) -> bool {
    matches!(
        (staged_code, unstaged_code),
        ('D', 'D') | ('A', 'U') | ('U', 'D') | ('U', 'A') | ('D', 'U') | ('A', 'A') | ('U', 'U')
    )
}

fn non_empty_string(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct GitStatusCommandLimits {
    timeout: Duration,
    stdout_cap_bytes: usize,
    stderr_cap_bytes: usize,
}

impl Default for GitStatusCommandLimits {
    fn default() -> Self {
        Self {
            timeout: GIT_STATUS_TIMEOUT,
            stdout_cap_bytes: GIT_STATUS_STDOUT_CAP_BYTES,
            stderr_cap_bytes: GIT_STATUS_STDERR_CAP_BYTES,
        }
    }
}

#[derive(Debug)]
struct GitCommandOutput {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

#[derive(Debug, Eq, PartialEq)]
struct CappedRead {
    bytes: Vec<u8>,
    exceeded_cap: bool,
}

fn read_git_repository_status_with_limits(
    repo_root: &Path,
    limits: GitStatusCommandLimits,
) -> Result<GitRepositoryStatus, GitStatusError> {
    ensure_explicit_repo_root(repo_root)?;

    let output = run_git_status_command(repo_root, limits)?;

    if !output.status.success() {
        return Err(classify_git_status_failure(
            output.status.code(),
            &output.stderr,
        ));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|_| GitStatusError::NonUtf8Output)?;

    Ok(parse_git_status_porcelain_v1_branch(&stdout))
}

fn run_git_status_command(
    repo_root: &Path,
    limits: GitStatusCommandLimits,
) -> Result<GitCommandOutput, GitStatusError> {
    let mut child = Command::new("git")
        .args(["status", "--porcelain=v1", "-b"])
        .current_dir(repo_root)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(map_process_start_error)?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| GitStatusError::Unknown("could not capture Git stdout".to_owned()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| GitStatusError::Unknown("could not capture Git stderr".to_owned()))?;

    let stdout_reader = spawn_capped_reader(stdout, limits.stdout_cap_bytes);
    let stderr_reader = spawn_capped_reader(stderr, limits.stderr_cap_bytes);
    let started_at = Instant::now();

    let status = loop {
        if let Some(status) = child.try_wait().map_err(map_io_error)? {
            break status;
        }

        if started_at.elapsed() >= limits.timeout {
            let _ = child.kill();
            let _ = child.wait();
            let _ = join_capped_reader(stdout_reader);
            let _ = join_capped_reader(stderr_reader);
            return Err(GitStatusError::TimedOut);
        }

        thread::sleep(GIT_STATUS_POLL_INTERVAL);
    };

    let stdout = join_capped_reader(stdout_reader)?;
    let stderr = join_capped_reader(stderr_reader)?;

    if stdout.exceeded_cap || stderr.exceeded_cap {
        return Err(GitStatusError::OutputTooLarge);
    }

    Ok(GitCommandOutput {
        status,
        stdout: stdout.bytes,
        stderr: stderr.bytes,
    })
}

fn ensure_explicit_repo_root(repo_root: &Path) -> Result<(), GitStatusError> {
    if repo_root.as_os_str().is_empty() {
        return Err(GitStatusError::RepositoryNotConfigured);
    }

    match repo_root.try_exists() {
        Ok(true) => Ok(()),
        Ok(false) => Err(GitStatusError::PathNotFound),
        Err(error) if error.kind() == io::ErrorKind::PermissionDenied => {
            Err(GitStatusError::PermissionDenied)
        }
        Err(error) => Err(GitStatusError::Unknown(format!(
            "could not inspect repository path: {error}"
        ))),
    }
}

fn spawn_capped_reader<R>(reader: R, cap_bytes: usize) -> thread::JoinHandle<io::Result<CappedRead>>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || read_capped(reader, cap_bytes))
}

fn read_capped(mut reader: impl Read, cap_bytes: usize) -> io::Result<CappedRead> {
    let mut bytes = Vec::new();
    let mut exceeded_cap = false;
    let mut buffer = [0_u8; 8192];

    loop {
        let read_count = reader.read(&mut buffer)?;

        if read_count == 0 {
            break;
        }

        let remaining = cap_bytes.saturating_sub(bytes.len());

        if remaining > 0 {
            let stored_count = remaining.min(read_count);
            bytes.extend_from_slice(&buffer[..stored_count]);
        }

        if read_count > remaining {
            exceeded_cap = true;
        }
    }

    Ok(CappedRead {
        bytes,
        exceeded_cap,
    })
}

fn join_capped_reader(
    reader: thread::JoinHandle<io::Result<CappedRead>>,
) -> Result<CappedRead, GitStatusError> {
    reader
        .join()
        .map_err(|_| GitStatusError::Unknown("Git status output reader failed".to_owned()))?
        .map_err(map_io_error)
}

fn map_process_start_error(error: io::Error) -> GitStatusError {
    match error.kind() {
        io::ErrorKind::NotFound => GitStatusError::GitUnavailable,
        io::ErrorKind::PermissionDenied => GitStatusError::PermissionDenied,
        _ => GitStatusError::Unknown(format!("could not start Git status command: {error}")),
    }
}

fn map_io_error(error: io::Error) -> GitStatusError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => GitStatusError::PermissionDenied,
        _ => GitStatusError::Unknown(format!("could not read Git status output: {error}")),
    }
}

fn classify_git_status_failure(exit_code: Option<i32>, stderr: &[u8]) -> GitStatusError {
    let stderr = compact_error_message(&String::from_utf8_lossy(stderr));
    let lower_stderr = stderr.to_ascii_lowercase();

    if lower_stderr.contains("not a git repository")
        || lower_stderr.contains("not in a git directory")
    {
        return GitStatusError::NotGitRepository;
    }

    if lower_stderr.contains("permission denied") {
        return GitStatusError::PermissionDenied;
    }

    if lower_stderr.contains("no such file or directory")
        || lower_stderr.contains("cannot change to")
        || lower_stderr.contains("cannot chdir")
    {
        return GitStatusError::PathNotFound;
    }

    GitStatusError::CommandFailed { exit_code, stderr }
}

fn compact_error_message(message: &str) -> String {
    message
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::path::Path;

    #[test]
    fn parses_clean_branch_output() {
        let status = parse_git_status_porcelain_v1_branch("## main\n");

        assert_eq!(
            status.branch,
            Some(GitBranchSummary {
                name: Some("main".to_owned()),
                upstream: None,
                ahead: None,
                behind: None,
                is_detached: false,
            })
        );
        assert!(status.working_tree.is_clean);
        assert!(status.changed_files.is_empty());
        assert!(status.warnings.is_empty());
    }

    #[test]
    fn parses_modified_unstaged_file() {
        let status = parse_git_status_porcelain_v1_branch("## main\n M src/lib.rs\n");

        assert_eq!(status.working_tree.unstaged_count, 1);
        assert_eq!(
            status.changed_files,
            vec![GitFileChange {
                area: GitFileChangeArea::Unstaged,
                kind: GitFileChangeKind::Modified,
                path: "src/lib.rs".to_owned(),
                original_path: None,
            }]
        );
    }

    #[test]
    fn parses_staged_added_file() {
        let status = parse_git_status_porcelain_v1_branch("## main\nA  src/git.rs\n");

        assert_eq!(status.working_tree.staged_count, 1);
        assert_eq!(status.working_tree.unstaged_count, 0);
        assert_eq!(status.changed_files[0].kind, GitFileChangeKind::Added);
        assert_eq!(status.changed_files[0].area, GitFileChangeArea::Staged);
    }

    #[test]
    fn parses_deleted_file() {
        let status = parse_git_status_porcelain_v1_branch("## main\n D old.txt\n");

        assert_eq!(status.working_tree.unstaged_count, 1);
        assert_eq!(status.changed_files[0].kind, GitFileChangeKind::Deleted);
        assert_eq!(status.changed_files[0].path, "old.txt");
    }

    #[test]
    fn parses_untracked_file() {
        let status = parse_git_status_porcelain_v1_branch("## main\n?? scratch.txt\n");

        assert_eq!(status.working_tree.untracked_count, 1);
        assert_eq!(
            status.changed_files[0],
            GitFileChange {
                area: GitFileChangeArea::Untracked,
                kind: GitFileChangeKind::Untracked,
                path: "scratch.txt".to_owned(),
                original_path: None,
            }
        );
    }

    #[test]
    fn parses_renamed_file() {
        let status =
            parse_git_status_porcelain_v1_branch("## main\nR  old/name.rs -> new/name.rs\n");

        assert_eq!(status.working_tree.staged_count, 1);
        assert_eq!(
            status.changed_files[0],
            GitFileChange {
                area: GitFileChangeArea::Staged,
                kind: GitFileChangeKind::Renamed,
                path: "new/name.rs".to_owned(),
                original_path: Some("old/name.rs".to_owned()),
            }
        );
    }

    #[test]
    fn parses_conflicted_file_conservatively() {
        let status = parse_git_status_porcelain_v1_branch("## main\nUU src/conflict.rs\n");

        assert_eq!(status.working_tree.unstaged_count, 1);
        assert_eq!(
            status.changed_files[0],
            GitFileChange {
                area: GitFileChangeArea::Unstaged,
                kind: GitFileChangeKind::Conflicted,
                path: "src/conflict.rs".to_owned(),
                original_path: None,
            }
        );
    }

    #[test]
    fn parses_branch_ahead_behind_line() {
        let status =
            parse_git_status_porcelain_v1_branch("## main...origin/main [ahead 2, behind 1]\n");

        assert_eq!(
            status.branch,
            Some(GitBranchSummary {
                name: Some("main".to_owned()),
                upstream: Some("origin/main".to_owned()),
                ahead: Some(2),
                behind: Some(1),
                is_detached: false,
            })
        );
    }

    #[test]
    fn unknown_status_code_does_not_panic() {
        let status = parse_git_status_porcelain_v1_branch("## main\nQ  strange.txt\n");

        assert_eq!(status.working_tree.staged_count, 1);
        assert_eq!(status.changed_files[0].kind, GitFileChangeKind::Unknown);
        assert_eq!(status.changed_files[0].path, "strange.txt");
        assert_eq!(
            status.warnings,
            vec!["Unknown Git status code parsed as unknown.".to_owned()]
        );
    }

    #[test]
    fn empty_repository_root_is_rejected_before_spawn() {
        let result = read_git_repository_status(Path::new(""));

        assert_eq!(result, Err(GitStatusError::RepositoryNotConfigured));
    }

    #[test]
    fn capped_reader_marks_output_that_exceeds_limit() {
        let output = read_capped(Cursor::new(b"abcdef".to_vec()), 3).unwrap();

        assert_eq!(
            output,
            CappedRead {
                bytes: b"abc".to_vec(),
                exceeded_cap: true,
            }
        );
    }

    #[test]
    fn capped_reader_allows_output_at_limit() {
        let output = read_capped(Cursor::new(b"abc".to_vec()), 3).unwrap();

        assert_eq!(
            output,
            CappedRead {
                bytes: b"abc".to_vec(),
                exceeded_cap: false,
            }
        );
    }

    #[test]
    fn classifies_not_git_repository_failure() {
        let error = classify_git_status_failure(
            Some(128),
            b"fatal: not a git repository (or any of the parent directories): .git\n",
        );

        assert_eq!(error, GitStatusError::NotGitRepository);
    }

    #[test]
    fn classifies_permission_denied_failure() {
        let error =
            classify_git_status_failure(Some(128), b"fatal: permission denied reading .git\n");

        assert_eq!(error, GitStatusError::PermissionDenied);
    }

    #[test]
    fn classifies_unknown_command_failure_with_compact_stderr() {
        let error = classify_git_status_failure(
            Some(128),
            b"\nfirst line\nsecond line\nthird line\nfourth line\n",
        );

        assert_eq!(
            error,
            GitStatusError::CommandFailed {
                exit_code: Some(128),
                stderr: "first line second line third line".to_owned(),
            }
        );
    }
}
