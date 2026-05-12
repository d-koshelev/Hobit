use hobit_app::{
    AgentChatAiProposalRunSummary, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, GenerateAgentChatAiProposalInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GenerateAgentChatAiProposalRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub operator_prompt: String,
    pub approved_context_snapshot_json: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GenerateAgentChatAiProposalResponseDto {
    pub run: AgentChatProposalRunDto,
    pub proposal: AgentChatProposalDto,
    pub runtime_status: String,
    pub provider_status: String,
    pub provider_used: bool,
    pub provider_response_received: bool,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub context_was_approved: bool,
    pub normalization_warnings: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentChatProposalRunDto {
    pub run_id: String,
    pub status: String,
    pub result_id: String,
    pub result_type: String,
    pub summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentChatProposalDto {
    pub id: String,
    pub request_summary: String,
    pub proposed_plan: Vec<String>,
    pub context_needed: Vec<String>,
    pub action_proposals: Vec<AgentChatProposalActionDto>,
    pub safety_notes: Vec<String>,
    pub runtime_notes: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentChatProposalActionDto {
    pub title: String,
    pub description: String,
}

impl From<GenerateAgentChatAiProposalRequest> for GenerateAgentChatAiProposalInput {
    fn from(request: GenerateAgentChatAiProposalRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            operator_prompt: request.operator_prompt,
            approved_context_snapshot_json: request.approved_context_snapshot_json,
        }
    }
}

impl From<AgentChatAiProposalRunSummary> for GenerateAgentChatAiProposalResponseDto {
    fn from(summary: AgentChatAiProposalRunSummary) -> Self {
        Self {
            run: AgentChatProposalRunDto::from(summary.run),
            proposal: AgentChatProposalDto::from(summary.proposal),
            runtime_status: summary.runtime_status,
            provider_status: summary.provider_status,
            provider_used: summary.provider_used,
            provider_response_received: summary.provider_response_received,
            no_tools_executed: summary.no_tools_executed,
            no_mutations_performed: summary.no_mutations_performed,
            context_was_approved: summary.context_was_approved,
            normalization_warnings: summary.normalization_warnings,
        }
    }
}

impl From<AgentChatProposalRunSummary> for AgentChatProposalRunDto {
    fn from(run: AgentChatProposalRunSummary) -> Self {
        Self {
            run_id: run.run_id,
            status: run.status,
            result_id: run.result_id,
            result_type: run.result_type,
            summary: run.summary,
        }
    }
}

impl From<AgentChatProposalInput> for AgentChatProposalDto {
    fn from(proposal: AgentChatProposalInput) -> Self {
        Self {
            id: proposal.id,
            request_summary: proposal.request_summary,
            proposed_plan: proposal.proposed_plan,
            context_needed: proposal.context_needed,
            action_proposals: proposal
                .action_proposals
                .into_iter()
                .map(AgentChatProposalActionDto::from)
                .collect(),
            safety_notes: proposal.safety_notes,
            runtime_notes: proposal.runtime_notes,
        }
    }
}

impl From<AgentChatProposalActionInput> for AgentChatProposalActionDto {
    fn from(action: AgentChatProposalActionInput) -> Self {
        Self {
            title: action.title,
            description: action.description,
        }
    }
}
