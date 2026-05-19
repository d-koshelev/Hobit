//! Read-only Git status model, parser, and CLI adapter foundation.
//!
//! The parser converts already-captured `git status --porcelain=v1 -b` text into
//! typed review data for future Workbench surfaces. The CLI adapter is
//! intentionally narrow: it runs only the fixed read-only status command against
//! an explicit repository root with `std::process::Command`, no shell, no
//! repository discovery, no fetch, no mutation, and no Tauri/frontend exposure.

mod command;
mod parsing;
mod types;

pub use command::read_git_repository_status;
pub use parsing::parse_git_status_porcelain_v1_branch;
pub use types::{
    GitBranchSummary, GitFileChange, GitFileChangeArea, GitFileChangeKind, GitLastCommitSummary,
    GitRepositoryStatus, GitStatusError, GitWorkingTreeSummary,
};
