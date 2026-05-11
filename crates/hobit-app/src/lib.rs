//! Application orchestration layer for Hobit.
//!
//! This crate composes lower-level storage primitives into product-level use
//! cases. It does not expose Tauri commands, frontend integration, runtime
//! execution, agent calls, terminal execution, or mutating tool behavior.

#![forbid(unsafe_code)]

mod error;
mod workspace_service;

pub use error::WorkspaceServiceError;
pub use hobit_core::widgets::WidgetRunStatus;
pub use workspace_service::{
    GitBranchStatusSummary, GitFileChangeSummary, GitLastCommitSummary, GitRepositoryStatusSummary,
    GitWorkingTreeStatusSummary, SharedStateObjectSummary, WidgetInstanceLayout,
    WidgetInstanceSummary, WidgetLogSummary, WidgetResultSummary, WidgetRunCommandInput,
    WidgetRunResultInput, WidgetRunSummary, WidgetRunWithResultsSummary, WorkbenchEventSummary,
    WorkbenchSummary, WorkspaceService, WorkspaceSessionSummary, WorkspaceSummary,
    WorkspaceWorkbenchState,
};
