//! Read-only Git status model and parser foundation.
//!
//! This module intentionally does not execute Git, read the filesystem, resolve
//! repository roots, or normalize paths. It converts already-captured
//! `git status --porcelain=v1 -b` text into typed review data for future
//! Workbench surfaces.

use std::error::Error;
use std::fmt;

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
    NotGitRepository,
    GitUnavailable,
    PermissionDenied,
    TimedOut,
    OutputTooLarge,
    Parse(String),
    Unknown(String),
}

impl fmt::Display for GitStatusError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RepositoryNotConfigured => write!(formatter, "repository is not configured"),
            Self::UnsupportedRuntime => write!(formatter, "Git status is not supported here"),
            Self::NotGitRepository => write!(formatter, "path is not a Git repository"),
            Self::GitUnavailable => write!(formatter, "Git is not available"),
            Self::PermissionDenied => {
                write!(formatter, "permission denied while reading Git status")
            }
            Self::TimedOut => write!(formatter, "Git status read timed out"),
            Self::OutputTooLarge => write!(formatter, "Git status output is too large"),
            Self::Parse(message) => write!(formatter, "could not parse Git status: {message}"),
            Self::Unknown(message) => write!(formatter, "unknown Git status error: {message}"),
        }
    }
}

impl Error for GitStatusError {}

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
