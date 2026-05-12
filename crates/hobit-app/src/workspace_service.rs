use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::SqliteStore;

mod agent_ai_proposals;
mod agent_monitoring;
mod agent_proposals;
mod agent_queue;
mod direct_work;
mod direct_work_cancellation;
mod direct_work_stream;
mod direct_work_validation;
mod git;
mod logs;
mod mapping;
mod runs;
mod terminal;
mod types;
mod validation;
mod widgets;
mod workbenches;
mod workspaces;

#[cfg(test)]
mod agent_ai_proposal_tests;
#[cfg(test)]
mod agent_monitoring_tests;
#[cfg(test)]
mod agent_proposal_tests;
#[cfg(test)]
mod agent_queue_tests;
#[cfg(test)]
mod direct_work_cancellation_tests;
#[cfg(test)]
mod direct_work_stream_tests;
#[cfg(test)]
mod direct_work_tests;
#[cfg(test)]
mod direct_work_validation_tests;
#[cfg(test)]
mod terminal_tests;
#[cfg(test)]
mod tests;

pub use types::{
    AgentChatAiProposalProvider, AgentChatAiProposalRunSummary, AgentChatAiProviderOutcome,
    AgentChatAiRequestArtifact, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, AgentMonitoringProposalActionSummary,
    AgentMonitoringProposalResultSummary, AgentMonitoringSnapshot, AgentQueueItemSummary,
    AgentQueueProposalActionSummary, AgentQueueSnapshot, CancelCodexDirectWorkRunInput,
    CodexDirectWorkCancellationSummary, CodexDirectWorkRunSummary,
    CodexDirectWorkStreamEventSummary, CodexDirectWorkStreamStartSummary,
    CreateAgentQueueItemFromProposalInput, DirectWorkValidationRunSummary,
    GenerateAgentChatAiProposalInput, GitBranchStatusSummary, GitFileChangeSummary,
    GitLastCommitSummary, GitRepositoryStatusSummary, GitWorkingTreeStatusSummary,
    PersistAgentChatProposalInput, RunCodexDirectWorkInput, RunDirectWorkValidationInput,
    RunTerminalCommandInput, SharedStateObjectSummary, TerminalCommandRunSummary,
    WidgetInstanceLayout, WidgetInstanceSummary, WidgetLogSummary, WidgetResultSummary,
    WidgetRunCommandInput, WidgetRunResultInput, WidgetRunSummary, WidgetRunWithResultsSummary,
    WorkbenchEventSummary, WorkbenchSummary, WorkspaceSessionSummary, WorkspaceSummary,
    WorkspaceWorkbenchState,
};

static NEXT_ID_SUFFIX: AtomicU64 = AtomicU64::new(1);
const WORKBENCH_STATE_RECENT_EVENT_LIMIT: usize = 100;
const PLACEHOLDER_WIDGET_LAYOUT_MODE: &str = "docked";
const PLACEHOLDER_WIDGET_DOCK_X: i64 = 0;
const PLACEHOLDER_WIDGET_DOCK_WIDTH: i64 = 360;
const PLACEHOLDER_WIDGET_DOCK_HEIGHT: i64 = 240;
const PLACEHOLDER_WIDGET_DOCK_GAP: i64 = 16;
const PLACEHOLDER_WIDGET_CONFIG: &str = "{}";
const PLACEHOLDER_WIDGET_STATE: &str = "{}";
const WIDGET_LAYOUT_MODE_DOCKED: &str = "docked";
const WIDGET_LAYOUT_MODE_POPPED_OUT: &str = "popped_out";
const WIDGET_LAYOUT_MODE_MINIMIZED: &str = "minimized";
const MAX_WIDGET_LAYOUT_DIMENSION: i64 = 16_384;
const MAX_WIDGET_LOG_LIMIT: usize = 200;
const WIDGET_LOG_INFO_LEVEL: &str = "info";
const WIDGET_LOG_WIDGET_ADDED: &str = "Widget added";
const WIDGET_LOG_STATE_SAVED: &str = "Widget state saved";
const WIDGET_LOG_LAYOUT_UPDATED: &str = "Widget layout updated";
const WIDGET_RUN_STARTED_STATUS: WidgetRunStatus = WidgetRunStatus::Running;
const AGENT_CHAT_WIDGET_DEFINITION_ID: &str = "agent-chat";
const AGENT_CHAT_AI_PROPOSAL_COMMAND_KIND: &str = "agent_chat_ai_proposal";
const AGENT_CHAT_AI_PROPOSAL_RESULT_TYPE: &str = "agent_chat_ai_proposal_result";
const AGENT_CHAT_PROPOSAL_COMMAND_KIND: &str = "agent_chat_mock_proposal";
const AGENT_CHAT_PROPOSAL_RESULT_TYPE: &str = "agent_chat_mock_proposal_result";
const AGENT_CHAT_PROPOSAL_RUNTIME_STATUS: &str = "proposal_only_mock";
const AGENT_QUEUE_PROPOSAL_REVIEW_ITEM_KIND: &str = "agent_queue_proposal_review";
const AGENT_QUEUE_STATUS_NEEDS_REVIEW: &str = "needs_review";
const AGENT_QUEUE_DECISION_PENDING_REVIEW: &str = "pending_review";
// Direct Work has no dedicated widget yet; Agent Monitoring is the existing
// run artifact owner until a future Direct Work launch surface is added.
const AGENT_RUN_WIDGET_DEFINITION_ID: &str = "agent-run";
const GIT_WIDGET_DEFINITION_ID: &str = "git";
const TERMINAL_WIDGET_DEFINITION_ID: &str = "terminal";

pub struct WorkspaceService {
    store: SqliteStore,
}

impl WorkspaceService {
    pub fn new(store: SqliteStore) -> Self {
        Self { store }
    }
}

// Placeholder ID and timestamp strategy until Hobit selects a durable ID policy.
fn placeholder_id(prefix: &str) -> String {
    let suffix = NEXT_ID_SUFFIX.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}{}_{}", unix_nanos(), suffix)
}

fn placeholder_timestamp() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("{}.{:09}", duration.as_secs(), duration.subsec_nanos()),
        Err(_) => "0.000000000".to_owned(),
    }
}

fn unix_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}
