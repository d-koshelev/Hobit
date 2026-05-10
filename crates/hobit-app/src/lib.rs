//! Application orchestration layer for Hobit.
//!
//! This crate composes lower-level storage primitives into product-level use
//! cases. It does not expose Tauri commands, frontend integration, runtime
//! execution, agent calls, terminal execution, or concrete widget behavior yet.

#![forbid(unsafe_code)]

mod error;
mod workspace_service;

pub use error::WorkspaceServiceError;
pub use workspace_service::{
    SharedStateObjectSummary, WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary,
    WorkbenchEventSummary, WorkbenchSummary, WorkspaceService, WorkspaceSessionSummary,
    WorkspaceSummary, WorkspaceWorkbenchState,
};
