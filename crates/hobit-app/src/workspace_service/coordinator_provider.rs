use crate::WorkspaceServiceError;

use super::{
    coordinator_provider_drafts::{
        mock_provider_proposal_drafts, validate_provider_proposal_drafts,
    },
    placeholder_id, placeholder_timestamp,
    validation::{required_input, validate_widget_ownership},
    CoordinatorProviderAdapter, CoordinatorProviderMessage, CoordinatorProviderOutcome,
    CoordinatorProviderProposalDraftContext, CoordinatorProviderRequest,
    CoordinatorProviderResponse, CoordinatorProviderVisibleInput,
    GenerateCoordinatorProviderResponseInput, WorkspaceService,
    COORDINATOR_CHAT_WIDGET_DEFINITION_ID,
};

const MOCK_COORDINATOR_PROVIDER_KIND: &str = "mock-local";
const PROVIDER_STATUS_COMPLETED: &str = "completed";
const PROVIDER_STATUS_NOT_CONFIGURED: &str = "not_configured";
const PROVIDER_STATUS_REQUEST_FAILED: &str = "request_failed";
const PROVIDER_STATUS_UNSUPPORTED: &str = "unsupported";
const MAX_OPERATOR_MESSAGE_CHARS: usize = 4_000;
const MAX_VISIBLE_CONVERSATION_MESSAGES: usize = 24;
const MAX_VISIBLE_MESSAGE_CHARS: usize = 2_000;
const MAX_VISIBLE_PROPOSAL_DRAFTS: usize = 8;
const MAX_VISIBLE_PROPOSAL_FIELD_CHARS: usize = 2_000;
const MAX_VISIBLE_INPUTS_PER_PROPOSAL: usize = 12;
const MAX_RISK_NOTES_PER_PROPOSAL: usize = 8;

pub struct MockCoordinatorProviderAdapter;

impl CoordinatorProviderAdapter for MockCoordinatorProviderAdapter {
    fn provider_kind(&self) -> &str {
        MOCK_COORDINATOR_PROVIDER_KIND
    }

    fn request_coordinator_response(
        &self,
        request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome {
        CoordinatorProviderOutcome::ResponseWithDrafts {
            assistant_text: mock_assistant_text(request),
            proposal_drafts: mock_provider_proposal_drafts(request),
        }
    }
}

impl WorkspaceService {
    pub fn generate_coordinator_provider_response(
        &self,
        input: GenerateCoordinatorProviderResponseInput,
        provider: &dyn CoordinatorProviderAdapter,
    ) -> Result<Option<CoordinatorProviderResponse>, WorkspaceServiceError> {
        let input = normalize_provider_input(input)?;

        let Some((_workspace, _workbench, widget)) = validate_widget_ownership(
            &self.store,
            &input.workspace_id,
            &input.workbench_id,
            &input.widget_instance_id,
        )?
        else {
            return Ok(None);
        };

        if widget.definition_id != COORDINATOR_CHAT_WIDGET_DEFINITION_ID {
            return Ok(None);
        }

        let request = provider_request(&input);
        let provider_kind = provider.provider_kind().to_owned();
        let outcome = provider.request_coordinator_response(&request);
        Ok(Some(provider_response(request, provider_kind, outcome)))
    }
}

fn normalize_provider_input(
    input: GenerateCoordinatorProviderResponseInput,
) -> Result<GenerateCoordinatorProviderResponseInput, WorkspaceServiceError> {
    let workspace_id = required_owned(input.workspace_id, "workspace id")?;
    let workbench_id = required_owned(input.workbench_id, "workbench id")?;
    let widget_instance_id = required_owned(input.widget_instance_id, "widget instance id")?;
    let operator_message = truncate_chars(
        required_owned(input.operator_message, "operator message")?,
        MAX_OPERATOR_MESSAGE_CHARS,
    );

    let visible_conversation = input
        .visible_conversation
        .into_iter()
        .take(MAX_VISIBLE_CONVERSATION_MESSAGES)
        .map(normalize_message)
        .collect::<Result<Vec<_>, _>>()?;
    let visible_proposal_drafts = input
        .visible_proposal_drafts
        .into_iter()
        .take(MAX_VISIBLE_PROPOSAL_DRAFTS)
        .map(normalize_proposal_draft)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(GenerateCoordinatorProviderResponseInput {
        workspace_id,
        workbench_id,
        widget_instance_id,
        operator_message,
        visible_conversation,
        visible_proposal_drafts,
    })
}

fn normalize_message(
    message: CoordinatorProviderMessage,
) -> Result<CoordinatorProviderMessage, WorkspaceServiceError> {
    let id = required_owned(message.id, "message id")?;
    let role = required_owned(message.role, "message role")?;
    if role != "operator" && role != "assistant" {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported Coordinator message role: {role}"
        )));
    }

    Ok(CoordinatorProviderMessage {
        id,
        role,
        body: truncate_chars(message.body.trim().to_owned(), MAX_VISIBLE_MESSAGE_CHARS),
    })
}

fn normalize_proposal_draft(
    proposal: CoordinatorProviderProposalDraftContext,
) -> Result<CoordinatorProviderProposalDraftContext, WorkspaceServiceError> {
    Ok(CoordinatorProviderProposalDraftContext {
        id: truncate_required(proposal.id, "proposal id")?,
        type_id: truncate_required(proposal.type_id, "proposal type id")?,
        title: truncate_required(proposal.title, "proposal title")?,
        target_widget: truncate_required(proposal.target_widget, "proposal target widget")?,
        target_capability: truncate_required(
            proposal.target_capability,
            "proposal target capability",
        )?,
        intent: truncate_required(proposal.intent, "proposal intent")?,
        visible_inputs: proposal
            .visible_inputs
            .into_iter()
            .take(MAX_VISIBLE_INPUTS_PER_PROPOSAL)
            .map(normalize_visible_input)
            .collect::<Result<Vec<_>, _>>()?,
        risk_notes: proposal
            .risk_notes
            .into_iter()
            .take(MAX_RISK_NOTES_PER_PROPOSAL)
            .map(|note| truncate_chars(note.trim().to_owned(), MAX_VISIBLE_PROPOSAL_FIELD_CHARS))
            .filter(|note| !note.is_empty())
            .collect(),
        expected_result: truncate_required(proposal.expected_result, "proposal expected result")?,
    })
}

fn normalize_visible_input(
    input: CoordinatorProviderVisibleInput,
) -> Result<CoordinatorProviderVisibleInput, WorkspaceServiceError> {
    Ok(CoordinatorProviderVisibleInput {
        label: truncate_required(input.label, "proposal input label")?,
        value: truncate_chars(
            input.value.trim().to_owned(),
            MAX_VISIBLE_PROPOSAL_FIELD_CHARS,
        ),
    })
}

fn provider_request(
    input: &GenerateCoordinatorProviderResponseInput,
) -> CoordinatorProviderRequest {
    CoordinatorProviderRequest {
        request_id: placeholder_id("coord_preq_"),
        operator_message: input.operator_message.clone(),
        visible_conversation: input.visible_conversation.clone(),
        visible_proposal_drafts: input.visible_proposal_drafts.clone(),
        system_instructions: vec![
            "Coordinator Chat may draft response text and safe structured proposal drafts only."
                .to_owned(),
            "Use only the explicit operator message and visible Coordinator Chat transcript."
                .to_owned(),
            "Do not use hidden widget state, Notes, Terminal output, Git data, JDBC metadata, files, environment values, or secrets.".to_owned(),
            "Do not execute tools or widget capabilities; proposal drafts must remain review-only."
                .to_owned(),
        ],
        allowed_tools: Vec::new(),
        created_at: placeholder_timestamp(),
    }
}

fn provider_response(
    request: CoordinatorProviderRequest,
    provider_kind: String,
    outcome: CoordinatorProviderOutcome,
) -> CoordinatorProviderResponse {
    let (assistant_text, provider_status, provider_error, proposal_drafts) = match outcome {
        CoordinatorProviderOutcome::Response { assistant_text } => {
            let drafts = validate_provider_proposal_drafts(Vec::new());
            (
                provider_assistant_text(assistant_text, drafts.rejected_count),
                PROVIDER_STATUS_COMPLETED.to_owned(),
                None,
                drafts.accepted,
            )
        }
        CoordinatorProviderOutcome::ResponseWithDrafts {
            assistant_text,
            proposal_drafts,
        } => {
            let drafts = validate_provider_proposal_drafts(proposal_drafts);
            (
                provider_assistant_text(assistant_text, drafts.rejected_count),
                PROVIDER_STATUS_COMPLETED.to_owned(),
                None,
                drafts.accepted,
            )
        }
        CoordinatorProviderOutcome::RequestFailed { message } => (
            "Coordinator provider failed before producing a response.".to_owned(),
            PROVIDER_STATUS_REQUEST_FAILED.to_owned(),
            Some(truncate_chars(message, MAX_VISIBLE_MESSAGE_CHARS)),
            Vec::new(),
        ),
        CoordinatorProviderOutcome::NotConfigured { message } => (
            "Coordinator provider is not configured. Mock/local fallback remains available."
                .to_owned(),
            PROVIDER_STATUS_NOT_CONFIGURED.to_owned(),
            Some(truncate_chars(message, MAX_VISIBLE_MESSAGE_CHARS)),
            Vec::new(),
        ),
        CoordinatorProviderOutcome::Unsupported { message } => (
            "Coordinator provider response is unsupported in this runtime.".to_owned(),
            PROVIDER_STATUS_UNSUPPORTED.to_owned(),
            Some(truncate_chars(message, MAX_VISIBLE_MESSAGE_CHARS)),
            Vec::new(),
        ),
    };

    CoordinatorProviderResponse {
        request_id: request.request_id,
        assistant_text,
        provider_kind,
        provider_status,
        provider_error,
        allowed_tools: request.allowed_tools,
        visible_context_message_count: request.visible_conversation.len(),
        visible_proposal_draft_count: request.visible_proposal_drafts.len(),
        proposal_drafts,
        no_tools_executed: true,
        no_mutations_performed: true,
        no_hidden_context_used: true,
    }
}

fn provider_assistant_text(assistant_text: String, rejected_draft_count: usize) -> String {
    let mut text = truncate_chars(assistant_text, MAX_OPERATOR_MESSAGE_CHARS);

    if rejected_draft_count > 0 {
        text.push_str(&format!(
            " {rejected_draft_count} provider proposal draft{} rejected before rendering because {} unsupported or unsafe.",
            if rejected_draft_count == 1 { " was" } else { "s were" },
            if rejected_draft_count == 1 { "it was" } else { "they were" },
        ));
    }

    text
}

fn mock_assistant_text(request: &CoordinatorProviderRequest) -> String {
    let proposal_text = match request.visible_proposal_drafts.len() {
        0 => "No proposal draft context was included.".to_owned(),
        1 => "One visible proposal draft was included for review context.".to_owned(),
        count => format!("{count} visible proposal drafts were included for review context."),
    };

    format!(
        "Mock Coordinator provider response. I received your explicit message: \"{}\". {proposal_text} Tools are disabled with allowed_tools: [], and no hidden Workspace, widget, file, Notes, Terminal, Git, JDBC, environment, or secret context was used.",
        request.operator_message
    )
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn truncate_required(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    Ok(truncate_chars(
        required_owned(value, label)?,
        MAX_VISIBLE_PROPOSAL_FIELD_CHARS,
    ))
}

fn truncate_chars(value: String, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value;
    }

    let mut truncated = value.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}
