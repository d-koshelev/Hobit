use hobit_app::{
    AgentChatAiProposalRunSummary, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary,
};

use super::agent_chat_ai_dto::{
    GenerateAgentChatAiProposalRequest, GenerateAgentChatAiProposalResponseDto,
};

#[test]
fn maps_generate_agent_chat_ai_request_to_app_input() {
    let request = GenerateAgentChatAiProposalRequest {
        workspace_id: "ws-1".to_owned(),
        workbench_id: "wb-1".to_owned(),
        widget_instance_id: "wid-1".to_owned(),
        operator_prompt: "Plan".to_owned(),
        approved_context_snapshot_json: "{\"status\":\"approved\"}".to_owned(),
    };

    let input = hobit_app::GenerateAgentChatAiProposalInput::from(request);

    assert_eq!(input.workspace_id, "ws-1");
    assert_eq!(input.workbench_id, "wb-1");
    assert_eq!(input.widget_instance_id, "wid-1");
    assert_eq!(input.operator_prompt, "Plan");
    assert_eq!(
        input.approved_context_snapshot_json,
        "{\"status\":\"approved\"}"
    );
}

#[test]
fn maps_generate_agent_chat_ai_response_to_dto() {
    let summary = AgentChatAiProposalRunSummary {
        run: AgentChatProposalRunSummary {
            run_id: "run-1".to_owned(),
            status: "completed".to_owned(),
            result_id: "result-1".to_owned(),
            result_type: "agent_chat_ai_proposal_result".to_owned(),
            summary: "AI proposal persisted".to_owned(),
        },
        proposal: AgentChatProposalInput {
            id: "proposal-1".to_owned(),
            request_summary: "Summary".to_owned(),
            proposed_plan: vec!["Step".to_owned()],
            context_needed: vec!["Context".to_owned()],
            action_proposals: vec![AgentChatProposalActionInput {
                title: "Action".to_owned(),
                description: "Proposal only".to_owned(),
            }],
            safety_notes: vec!["Safe".to_owned()],
            runtime_notes: vec!["Runtime".to_owned()],
        },
        runtime_status: "ai_proposal_only".to_owned(),
        provider_status: "completed".to_owned(),
        provider_used: true,
        provider_response_received: true,
        no_tools_executed: true,
        no_mutations_performed: true,
        context_was_approved: true,
        normalization_warnings: vec!["warning".to_owned()],
    };

    let dto = GenerateAgentChatAiProposalResponseDto::from(summary);

    assert_eq!(dto.run.run_id, "run-1");
    assert_eq!(dto.proposal.id, "proposal-1");
    assert_eq!(dto.proposal.action_proposals[0].title, "Action");
    assert_eq!(dto.runtime_status, "ai_proposal_only");
    assert_eq!(dto.provider_status, "completed");
    assert!(dto.provider_used);
    assert!(dto.no_tools_executed);
    assert!(dto.no_mutations_performed);
    assert!(dto.context_was_approved);
}
