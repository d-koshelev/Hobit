use std::path::PathBuf;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSummary {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub workbench_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSessionSummary {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub active_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceWorkbenchState {
    pub workspace: WorkspaceSummary,
    pub workbench: Option<WorkbenchSummary>,
    pub widget_instances: Vec<WidgetInstanceSummary>,
    pub shared_state_objects: Vec<SharedStateObjectSummary>,
    pub recent_events: Vec<WorkbenchEventSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchSummary {
    pub id: String,
    pub workspace_id: String,
    pub preset_origin_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstanceSummary {
    pub id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
    pub config: Option<String>,
    pub state: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstanceLayout {
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLogSummary {
    pub id: String,
    pub widget_instance_id: String,
    pub run_id: Option<String>,
    pub level: String,
    pub message: String,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunCommandInput {
    pub command_kind: Option<String>,
    pub command_payload: Option<String>,
    pub summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunResultInput {
    pub result_type: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub payload: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunSummary {
    pub id: String,
    pub widget_instance_id: String,
    pub status: String,
    pub command_kind: Option<String>,
    pub command_payload: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetResultSummary {
    pub id: String,
    pub run_id: String,
    pub status: String,
    pub result_type: String,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunWithResultsSummary {
    pub run: WidgetRunSummary,
    pub results: Vec<WidgetResultSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedStateObjectSummary {
    pub id: String,
    pub key: String,
    pub value: String,
    pub value_kind: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchEventSummary {
    pub id: String,
    pub kind: String,
    pub summary: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PersistAgentChatProposalInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub operator_prompt: String,
    pub approved_context_snapshot_json: String,
    pub proposal: AgentChatProposalInput,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenerateAgentChatAiProposalInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub operator_prompt: String,
    pub approved_context_snapshot_json: String,
}

pub trait AgentChatAiProposalProvider {
    fn request_agent_chat_ai_proposal(
        &self,
        artifact: &AgentChatAiRequestArtifact,
    ) -> AgentChatAiProviderOutcome;
}

#[derive(Clone, Debug, PartialEq)]
pub struct AgentChatAiRequestArtifact {
    pub request_id: String,
    pub workspace_id: String,
    pub workbench_id: String,
    pub source_widget_instance_id: String,
    pub operator_prompt: String,
    pub approved_context_snapshot: serde_json::Value,
    pub contract_pack_summary: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub safety_constraints: Vec<String>,
    pub expected_response_format: Vec<String>,
    pub validation_plan: Vec<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgentChatAiProviderOutcome {
    NotConfigured { message: String },
    RequestFailed { message: String },
    Response { raw_response: String },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentChatAiProposalRunSummary {
    pub run: AgentChatProposalRunSummary,
    pub proposal: AgentChatProposalInput,
    pub runtime_status: String,
    pub provider_status: String,
    pub provider_used: bool,
    pub provider_response_received: bool,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub context_was_approved: bool,
    pub normalization_warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentChatProposalInput {
    pub id: String,
    pub request_summary: String,
    pub proposed_plan: Vec<String>,
    pub context_needed: Vec<String>,
    pub action_proposals: Vec<AgentChatProposalActionInput>,
    pub safety_notes: Vec<String>,
    pub runtime_notes: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentChatProposalActionInput {
    pub title: String,
    pub description: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentChatProposalRunSummary {
    pub run_id: String,
    pub status: String,
    pub result_id: String,
    pub result_type: String,
    pub summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentMonitoringSnapshot {
    pub workspace_id: String,
    pub workbench_id: String,
    pub proposal_results: Vec<AgentMonitoringProposalResultSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentMonitoringProposalResultSummary {
    pub run_id: String,
    pub result_id: String,
    pub status: String,
    pub result_type: String,
    pub result_summary: Option<String>,
    pub result_content: Option<String>,
    pub run_started_at: String,
    pub run_finished_at: Option<String>,
    pub result_created_at: String,
    pub source_widget_id: String,
    pub source_widget_title: String,
    pub runtime_status: String,
    pub provider_status: String,
    pub provider_used: bool,
    pub provider_response_received: bool,
    pub no_llm_called: bool,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub context_was_approved: bool,
    pub operator_prompt: String,
    pub proposal_summary: String,
    pub proposed_plan: Vec<String>,
    pub context_needed: Vec<String>,
    pub approved_context_summary: String,
    pub approved_context_status: String,
    pub approved_context_source_labels: Vec<String>,
    pub proposed_actions: Vec<AgentMonitoringProposalActionSummary>,
    pub safety_notes: Vec<String>,
    pub raw_payload: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentMonitoringProposalActionSummary {
    pub title: String,
    pub description: String,
    pub status: String,
    pub executed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateAgentQueueItemFromProposalInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub source_run_id: String,
    pub source_result_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueSnapshot {
    pub workspace_id: String,
    pub workbench_id: String,
    pub items: Vec<AgentQueueItemSummary>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueItemSummary {
    pub id: String,
    pub workspace_id: String,
    pub workbench_id: String,
    pub source_run_id: String,
    pub source_result_id: String,
    pub source_widget_instance_id: String,
    pub source_widget_title: String,
    pub title: String,
    pub status: String,
    pub decision_status: String,
    pub prompt_summary: String,
    pub proposal_summary: String,
    pub approved_context_summary: String,
    pub proposed_plan: Vec<String>,
    pub proposed_actions: Vec<AgentQueueProposalActionSummary>,
    pub proposal_only_mock: bool,
    pub no_llm_called: bool,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub payload_json: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueProposalActionSummary {
    pub title: String,
    pub description: String,
    pub status: String,
    pub executed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitRepositoryStatusSummary {
    pub branch: Option<GitBranchStatusSummary>,
    pub working_tree: GitWorkingTreeStatusSummary,
    pub changed_files: Vec<GitFileChangeSummary>,
    pub last_commit: Option<GitLastCommitSummary>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitBranchStatusSummary {
    pub name: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub is_detached: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitWorkingTreeStatusSummary {
    pub is_clean: bool,
    pub is_dirty: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitFileChangeSummary {
    pub area: String,
    pub kind: String,
    pub path: String,
    pub original_path: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitLastCommitSummary {
    pub hash: String,
    pub title: String,
    pub author: Option<String>,
    pub committed_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunCodexDirectWorkInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub codex_executable: String,
    pub repo_root: PathBuf,
    pub operator_prompt: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectWorkRunSummary {
    pub run_id: String,
    pub result_id: String,
    pub result_type: String,
    pub executor_kind: String,
    pub mode: String,
    pub repo_root: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub command_summary: Vec<String>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub final_message: Option<String>,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub no_auto_commit: bool,
    pub no_auto_push: bool,
    pub git_mutations_performed_by_hobit: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectWorkStreamStartSummary {
    pub run_id: String,
    pub status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CodexDirectWorkStreamEventSummary {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub run_id: String,
    pub event_kind: String,
    pub line: Option<String>,
    pub text: Option<String>,
    pub parsed_codex_event_type: Option<String>,
    pub status: Option<String>,
    pub elapsed_ms: u128,
    pub is_final: bool,
    pub error_message: Option<String>,
    pub stderr_preview: Option<String>,
    pub exit_code: Option<i32>,
    pub final_status: Option<String>,
    pub failed_stage: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunTerminalCommandInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub program: String,
    pub args: Vec<String>,
    pub working_directory: PathBuf,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TerminalCommandRunSummary {
    pub run_id: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
}
