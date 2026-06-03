use std::error::Error;
use std::fmt;

use hobit_storage_sqlite::StorageError;
use hobit_tools::git::GitStatusError;
use hobit_tools::git_commit::GitCommitError;
use hobit_tools::git_diff::GitDiffError;
use hobit_tools::git_push::GitPushError;

#[derive(Debug)]
pub enum WorkspaceServiceError {
    Storage(StorageError),
    GitCommit(GitCommitError),
    GitDiff(GitDiffError),
    GitPush(GitPushError),
    GitStatus(GitStatusError),
    InvalidInput(String),
}

impl fmt::Display for WorkspaceServiceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Storage(error) => write!(formatter, "storage error: {error}"),
            Self::GitCommit(error) => write!(formatter, "Git commit error: {error}"),
            Self::GitDiff(error) => write!(formatter, "Git diff error: {error}"),
            Self::GitPush(error) => write!(formatter, "Git push error: {error}"),
            Self::GitStatus(error) => write!(formatter, "Git status error: {error}"),
            Self::InvalidInput(message) => write!(formatter, "invalid input: {message}"),
        }
    }
}

impl Error for WorkspaceServiceError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Storage(error) => Some(error),
            Self::GitCommit(error) => Some(error),
            Self::GitDiff(error) => Some(error),
            Self::GitPush(error) => Some(error),
            Self::GitStatus(error) => Some(error),
            Self::InvalidInput(_) => None,
        }
    }
}

impl From<StorageError> for WorkspaceServiceError {
    fn from(error: StorageError) -> Self {
        Self::Storage(error)
    }
}

impl From<GitDiffError> for WorkspaceServiceError {
    fn from(error: GitDiffError) -> Self {
        Self::GitDiff(error)
    }
}

impl From<GitCommitError> for WorkspaceServiceError {
    fn from(error: GitCommitError) -> Self {
        Self::GitCommit(error)
    }
}

impl From<GitPushError> for WorkspaceServiceError {
    fn from(error: GitPushError) -> Self {
        Self::GitPush(error)
    }
}

impl From<GitStatusError> for WorkspaceServiceError {
    fn from(error: GitStatusError) -> Self {
        Self::GitStatus(error)
    }
}
