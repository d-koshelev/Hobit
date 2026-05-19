use hobit_app::{
    CoordinatorProviderMessage, CoordinatorProviderProposalDraftContext,
    CoordinatorProviderResponse, CoordinatorProviderVisibleInput,
    GenerateCoordinatorProviderResponseInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GenerateCoordinatorProviderResponseRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub operator_message: String,
    pub visible_conversation: Vec<CoordinatorProviderMessageDto>,
    pub visible_proposal_drafts: Vec<CoordinatorProviderProposalDraftContextDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub(crate) struct CoordinatorProviderMessageDto {
    pub id: String,
    pub role: String,
    pub body: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub(crate) struct CoordinatorProviderProposalDraftContextDto {
    pub id: String,
    pub type_id: String,
    pub title: String,
    pub target_widget: String,
    pub target_capability: String,
    pub intent: String,
    pub visible_inputs: Vec<CoordinatorProviderVisibleInputDto>,
    pub risk_notes: Vec<String>,
    pub expected_result: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub(crate) struct CoordinatorProviderVisibleInputDto {
    pub label: String,
    pub value: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct GenerateCoordinatorProviderResponseDto {
    pub request_id: String,
    pub assistant_text: String,
    pub provider_kind: String,
    pub provider_status: String,
    pub provider_error: Option<String>,
    pub allowed_tools: Vec<String>,
    pub visible_context_message_count: usize,
    pub visible_proposal_draft_count: usize,
    pub proposal_drafts: Vec<CoordinatorProviderProposalDraftContextDto>,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub no_hidden_context_used: bool,
}

impl From<GenerateCoordinatorProviderResponseRequest> for GenerateCoordinatorProviderResponseInput {
    fn from(request: GenerateCoordinatorProviderResponseRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workbench_id: request.workbench_id,
            widget_instance_id: request.widget_instance_id,
            operator_message: request.operator_message,
            visible_conversation: request
                .visible_conversation
                .into_iter()
                .map(CoordinatorProviderMessage::from)
                .collect(),
            visible_proposal_drafts: request
                .visible_proposal_drafts
                .into_iter()
                .map(CoordinatorProviderProposalDraftContext::from)
                .collect(),
        }
    }
}

impl From<CoordinatorProviderMessageDto> for CoordinatorProviderMessage {
    fn from(message: CoordinatorProviderMessageDto) -> Self {
        Self {
            id: message.id,
            role: message.role,
            body: message.body,
        }
    }
}

impl From<CoordinatorProviderProposalDraftContextDto> for CoordinatorProviderProposalDraftContext {
    fn from(proposal: CoordinatorProviderProposalDraftContextDto) -> Self {
        Self {
            id: proposal.id,
            type_id: proposal.type_id,
            title: proposal.title,
            target_widget: proposal.target_widget,
            target_capability: proposal.target_capability,
            intent: proposal.intent,
            visible_inputs: proposal
                .visible_inputs
                .into_iter()
                .map(CoordinatorProviderVisibleInput::from)
                .collect(),
            risk_notes: proposal.risk_notes,
            expected_result: proposal.expected_result,
        }
    }
}

impl From<CoordinatorProviderVisibleInputDto> for CoordinatorProviderVisibleInput {
    fn from(input: CoordinatorProviderVisibleInputDto) -> Self {
        Self {
            label: input.label,
            value: input.value,
        }
    }
}

impl From<CoordinatorProviderResponse> for GenerateCoordinatorProviderResponseDto {
    fn from(response: CoordinatorProviderResponse) -> Self {
        Self {
            request_id: response.request_id,
            assistant_text: response.assistant_text,
            provider_kind: response.provider_kind,
            provider_status: response.provider_status,
            provider_error: response.provider_error,
            allowed_tools: response.allowed_tools,
            visible_context_message_count: response.visible_context_message_count,
            visible_proposal_draft_count: response.visible_proposal_draft_count,
            proposal_drafts: response
                .proposal_drafts
                .into_iter()
                .map(CoordinatorProviderProposalDraftContextDto::from)
                .collect(),
            no_tools_executed: response.no_tools_executed,
            no_mutations_performed: response.no_mutations_performed,
            no_hidden_context_used: response.no_hidden_context_used,
        }
    }
}

impl From<CoordinatorProviderProposalDraftContext> for CoordinatorProviderProposalDraftContextDto {
    fn from(proposal: CoordinatorProviderProposalDraftContext) -> Self {
        Self {
            id: proposal.id,
            type_id: proposal.type_id,
            title: proposal.title,
            target_widget: proposal.target_widget,
            target_capability: proposal.target_capability,
            intent: proposal.intent,
            visible_inputs: proposal
                .visible_inputs
                .into_iter()
                .map(CoordinatorProviderVisibleInputDto::from)
                .collect(),
            risk_notes: proposal.risk_notes,
            expected_result: proposal.expected_result,
        }
    }
}

impl From<CoordinatorProviderVisibleInput> for CoordinatorProviderVisibleInputDto {
    fn from(input: CoordinatorProviderVisibleInput) -> Self {
        Self {
            label: input.label,
            value: input.value,
        }
    }
}
