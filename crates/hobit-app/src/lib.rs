//! Application orchestration layer for Hobit.
//!
//! This crate composes lower-level storage primitives into product-level use
//! cases. It does not expose frontend integration or agent calls; desktop/Tauri
//! exposure is added in the desktop shell crate.

#![forbid(unsafe_code)]

mod error;
mod workspace_service;

pub use error::WorkspaceServiceError;
pub use hobit_core::widgets::WidgetRunStatus;
pub use workspace_service::{
    AgentChatProposalActionInput, AgentChatProposalInput, AgentChatProposalRunSummary,
    AgentMonitoringProposalActionSummary, AgentMonitoringProposalResultSummary,
    AgentMonitoringSnapshot, GitBranchStatusSummary, GitFileChangeSummary, GitLastCommitSummary,
    GitRepositoryStatusSummary, GitWorkingTreeStatusSummary, PersistAgentChatProposalInput,
    RunTerminalCommandInput, SharedStateObjectSummary, TerminalCommandRunSummary,
    WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary, WidgetResultSummary,
    WidgetRunCommandInput, WidgetRunResultInput, WidgetRunSummary, WidgetRunWithResultsSummary,
    WorkbenchEventSummary, WorkbenchSummary, WorkspaceService, WorkspaceSessionSummary,
    WorkspaceSummary, WorkspaceWorkbenchState,
};
