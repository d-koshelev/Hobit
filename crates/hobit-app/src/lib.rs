//! Application orchestration layer for Hobit.
//!
//! This crate composes lower-level storage primitives into product-level use
//! cases. It does not expose frontend integration directly; desktop/Tauri
//! exposure is added in the desktop shell crate.

#![forbid(unsafe_code)]

mod error;
mod workspace_service;

pub use error::WorkspaceServiceError;
pub use hobit_core::widgets::WidgetRunStatus;
pub use workspace_service::{
    AgentChatAiProposalProvider, AgentChatAiProposalRunSummary, AgentChatAiProviderOutcome,
    AgentChatAiRequestArtifact, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, AgentMonitoringProposalActionSummary,
    AgentMonitoringProposalResultSummary, AgentMonitoringSnapshot, AgentQueueItemSummary,
    AgentQueueProposalActionSummary, AgentQueueSnapshot, CodexDirectWorkRunSummary,
    CreateAgentQueueItemFromProposalInput, GenerateAgentChatAiProposalInput,
    GitBranchStatusSummary, GitFileChangeSummary, GitLastCommitSummary, GitRepositoryStatusSummary,
    GitWorkingTreeStatusSummary, PersistAgentChatProposalInput, RunCodexDirectWorkInput,
    RunTerminalCommandInput, SharedStateObjectSummary, TerminalCommandRunSummary,
    WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary, WidgetResultSummary,
    WidgetRunCommandInput, WidgetRunResultInput, WidgetRunSummary, WidgetRunWithResultsSummary,
    WorkbenchEventSummary, WorkbenchSummary, WorkspaceService, WorkspaceSessionSummary,
    WorkspaceSummary, WorkspaceWorkbenchState,
};
