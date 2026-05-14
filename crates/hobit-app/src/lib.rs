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
pub use hobit_tools::codex_cli::CodexDirectStreamCancellationToken;
pub use workspace_service::{
    AgentChatAiProposalProvider, AgentChatAiProposalRunSummary, AgentChatAiProviderOutcome,
    AgentChatAiRequestArtifact, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, AgentExecutorDiffFileSummary, AgentExecutorDiffSummary,
    AgentExecutorDiffTotals, AgentExecutorRunDetail, AgentExecutorRunHistory,
    AgentExecutorRunSummary, AgentMonitoringProposalActionSummary,
    AgentMonitoringProposalResultSummary, AgentMonitoringSnapshot, AgentQueueItemSummary,
    AgentQueueProposalActionSummary, AgentQueueSnapshot, CancelCodexDirectWorkRunInput,
    CodexDirectWorkCancellationSummary, CodexDirectWorkRunSummary,
    CodexDirectWorkStreamEventSummary, CodexDirectWorkStreamStartSummary,
    CreateAgentQueueItemFromProposalInput, CreateGitCommitInput, CreateWorkspaceNoteInput,
    DirectWorkValidationRunSummary, GenerateAgentChatAiProposalInput, GitBranchStatusSummary,
    GitCommitCommandSummary, GitCommitRunSummary, GitDiffCommandSummary, GitFileChangeSummary,
    GitLastCommitSummary, GitRepositoryStatusSummary, GitWorkingTreeStatusSummary,
    PersistAgentChatProposalInput, RunCodexDirectWorkInput, RunDirectWorkValidationInput,
    RunTerminalCommandInput, SharedStateObjectSummary, TerminalCommandRunSummary,
    UpdateWorkspaceNoteInput, WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary,
    WidgetResultSummary, WidgetRunCommandInput, WidgetRunResultInput, WidgetRunSummary,
    WidgetRunWithResultsSummary, WorkbenchEventSummary, WorkbenchSummary, WorkspaceDeletionSummary,
    WorkspaceNoteSummary, WorkspaceService, WorkspaceSessionSummary, WorkspaceSummary,
    WorkspaceWorkbenchState,
};
