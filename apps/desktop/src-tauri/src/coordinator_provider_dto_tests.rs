use super::coordinator_provider_dto::{
    CoordinatorProviderMessageDto, CoordinatorProviderProposalDraftContextDto,
    CoordinatorProviderVisibleInputDto, GenerateCoordinatorProviderResponseDto,
    GenerateCoordinatorProviderResponseRequest,
};
use hobit_app::{
    CoordinatorProviderProposalDraftContext, CoordinatorProviderResponse,
    CoordinatorProviderVisibleInput, GenerateCoordinatorProviderResponseInput,
};

#[test]
fn maps_coordinator_provider_request_to_app_input() {
    let input = GenerateCoordinatorProviderResponseInput::from(
        GenerateCoordinatorProviderResponseRequest {
            workspace_id: "ws_1".to_owned(),
            workbench_id: "wb_1".to_owned(),
            widget_instance_id: "wid_1".to_owned(),
            operator_message: "Create note".to_owned(),
            visible_conversation: vec![CoordinatorProviderMessageDto {
                id: "message-1".to_owned(),
                role: "operator".to_owned(),
                body: "Create note".to_owned(),
            }],
            visible_proposal_drafts: vec![proposal_dto()],
        },
    );

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.visible_conversation[0].role, "operator");
    assert_eq!(input.visible_proposal_drafts[0].type_id, "create-note");
    assert_eq!(
        input.visible_proposal_drafts[0].visible_inputs[0].label,
        "Title"
    );
}

#[test]
fn maps_coordinator_provider_response_to_dto() {
    let dto = GenerateCoordinatorProviderResponseDto::from(CoordinatorProviderResponse {
        request_id: "coord_preq_1".to_owned(),
        assistant_text: "Mock response".to_owned(),
        provider_kind: "mock-local".to_owned(),
        provider_status: "completed".to_owned(),
        provider_error: None,
        allowed_tools: Vec::new(),
        visible_context_message_count: 2,
        visible_proposal_draft_count: 1,
        proposal_drafts: vec![CoordinatorProviderProposalDraftContext {
            id: "proposal-1".to_owned(),
            type_id: "create-note".to_owned(),
            title: "Create Note".to_owned(),
            target_widget: "Notes".to_owned(),
            target_capability: "create note".to_owned(),
            intent: "Save visible text.".to_owned(),
            visible_inputs: vec![CoordinatorProviderVisibleInput {
                label: "Title".to_owned(),
                value: "Visible note".to_owned(),
            }],
            risk_notes: vec!["Local write after approval.".to_owned()],
            expected_result: "Review card.".to_owned(),
        }],
        no_tools_executed: true,
        no_mutations_performed: true,
        no_hidden_context_used: true,
    });

    assert_eq!(dto.provider_kind, "mock-local");
    assert!(dto.allowed_tools.is_empty());
    assert_eq!(
        dto.proposal_drafts[0].visible_inputs[0].value,
        "Visible note"
    );
    assert!(dto.no_tools_executed);
    assert!(dto.no_hidden_context_used);
}

fn proposal_dto() -> CoordinatorProviderProposalDraftContextDto {
    CoordinatorProviderProposalDraftContextDto {
        id: "proposal-1".to_owned(),
        type_id: "create-note".to_owned(),
        title: "Create Note".to_owned(),
        target_widget: "Notes".to_owned(),
        target_capability: "create note".to_owned(),
        intent: "Save visible text.".to_owned(),
        visible_inputs: vec![CoordinatorProviderVisibleInputDto {
            label: "Title".to_owned(),
            value: "Visible note".to_owned(),
        }],
        risk_notes: vec!["Local write after approval.".to_owned()],
        expected_result: "Review card.".to_owned(),
    }
}
