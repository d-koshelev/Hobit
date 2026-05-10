use std::error::Error;
use std::fmt;

use hobit_storage_sqlite::StorageError;
use hobit_tools::git::GitStatusError;

#[derive(Debug)]
pub enum WorkspaceServiceError {
    Storage(StorageError),
    GitStatus(GitStatusError),
    InvalidInput(String),
}

impl fmt::Display for WorkspaceServiceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Storage(error) => write!(formatter, "storage error: {error}"),
            Self::GitStatus(error) => write!(formatter, "Git status error: {error}"),
            Self::InvalidInput(message) => write!(formatter, "invalid input: {message}"),
        }
    }
}

impl Error for WorkspaceServiceError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Storage(error) => Some(error),
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

impl From<GitStatusError> for WorkspaceServiceError {
    fn from(error: GitStatusError) -> Self {
        Self::GitStatus(error)
    }
}
