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
