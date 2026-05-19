#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenerateCoordinatorProviderResponseInput {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub operator_message: String,
    pub visible_conversation: Vec<CoordinatorProviderMessage>,
    pub visible_proposal_drafts: Vec<CoordinatorProviderProposalDraftContext>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoordinatorProviderMessage {
    pub id: String,
    pub role: String,
    pub body: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoordinatorProviderProposalDraftContext {
    pub id: String,
    pub type_id: String,
    pub title: String,
    pub target_widget: String,
    pub target_capability: String,
    pub intent: String,
    pub visible_inputs: Vec<CoordinatorProviderVisibleInput>,
    pub risk_notes: Vec<String>,
    pub expected_result: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoordinatorProviderVisibleInput {
    pub label: String,
    pub value: String,
}

pub trait CoordinatorProviderAdapter {
    fn request_coordinator_response(
        &self,
        request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoordinatorProviderRequest {
    pub request_id: String,
    pub operator_message: String,
    pub visible_conversation: Vec<CoordinatorProviderMessage>,
    pub visible_proposal_drafts: Vec<CoordinatorProviderProposalDraftContext>,
    pub system_instructions: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CoordinatorProviderOutcome {
    Response {
        assistant_text: String,
    },
    ResponseWithDrafts {
        assistant_text: String,
        proposal_drafts: Vec<CoordinatorProviderProposalDraftContext>,
    },
    RequestFailed {
        message: String,
    },
    Unsupported {
        message: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoordinatorProviderResponse {
    pub request_id: String,
    pub assistant_text: String,
    pub provider_kind: String,
    pub provider_status: String,
    pub provider_error: Option<String>,
    pub allowed_tools: Vec<String>,
    pub visible_context_message_count: usize,
    pub visible_proposal_draft_count: usize,
    pub proposal_drafts: Vec<CoordinatorProviderProposalDraftContext>,
    pub no_tools_executed: bool,
    pub no_mutations_performed: bool,
    pub no_hidden_context_used: bool,
}
