use hobit_app::{
    AgentQueueItemSummary, AgentQueueProposalActionSummary, AgentQueueSnapshot,
    CreateAgentQueueItemFromProposalInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct CreateAgentQueueItemFromProposalRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub source_run_id: String,
    pub source_result_id: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetAgentQueueSnapshotRequest {
    pub workspace_id: String,
    pub workbench_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueSnapshotDto {
    pub workspace_id: String,
    pub workbench_id: String,
    pub items: Vec<AgentQueueItemDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueItemDto {
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
    pub proposed_actions: Vec<AgentQueueProposalActionDto>,
    pub proposal_only_mock: bool,
    pub no_llm_called: bool,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub payload_json: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueProposalActionDto {
    pub title: String,
    pub description: String,
    pub status: String,
    pub executed: bool,
}

impl From<CreateAgentQueueItemFromProposalRequest> for CreateAgentQueueItemFromProposalInput {
    fn from(request: CreateAgentQueueItemFromProposalRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            source_run_id: request.source_run_id,
            source_result_id: request.source_result_id,
        }
    }
}

impl From<AgentQueueSnapshot> for AgentQueueSnapshotDto {
    fn from(snapshot: AgentQueueSnapshot) -> Self {
        Self {
            workspace_id: snapshot.workspace_id,
            workbench_id: snapshot.workbench_id,
            items: snapshot
                .items
                .into_iter()
                .map(AgentQueueItemDto::from)
                .collect(),
        }
    }
}

impl From<AgentQueueItemSummary> for AgentQueueItemDto {
    fn from(summary: AgentQueueItemSummary) -> Self {
        Self {
            id: summary.id,
            workspace_id: summary.workspace_id,
            workbench_id: summary.workbench_id,
            source_run_id: summary.source_run_id,
            source_result_id: summary.source_result_id,
            source_widget_instance_id: summary.source_widget_instance_id,
            source_widget_title: summary.source_widget_title,
            title: summary.title,
            status: summary.status,
            decision_status: summary.decision_status,
            prompt_summary: summary.prompt_summary,
            proposal_summary: summary.proposal_summary,
            approved_context_summary: summary.approved_context_summary,
            proposed_plan: summary.proposed_plan,
            proposed_actions: summary
                .proposed_actions
                .into_iter()
                .map(AgentQueueProposalActionDto::from)
                .collect(),
            proposal_only_mock: summary.proposal_only_mock,
            no_llm_called: summary.no_llm_called,
            no_tools_executed: summary.no_tools_executed,
            no_mutations_performed: summary.no_mutations_performed,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
            payload_json: summary.payload_json,
        }
    }
}

impl From<AgentQueueProposalActionSummary> for AgentQueueProposalActionDto {
    fn from(action: AgentQueueProposalActionSummary) -> Self {
        Self {
            title: action.title,
            description: action.description,
            status: action.status,
            executed: action.executed,
        }
    }
}
