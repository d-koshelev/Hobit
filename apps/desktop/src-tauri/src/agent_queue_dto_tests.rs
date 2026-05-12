use hobit_app::{
    AgentQueueItemSummary, AgentQueueProposalActionSummary, AgentQueueSnapshot,
    CreateAgentQueueItemFromProposalInput,
};

use crate::agent_queue_dto::{
    AgentQueueItemDto, AgentQueueSnapshotDto, CreateAgentQueueItemFromProposalRequest,
    GetAgentQueueSnapshotRequest,
};

#[test]
fn maps_agent_queue_create_request_to_app_input() {
    let request = CreateAgentQueueItemFromProposalRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        source_run_id: "run_1".to_owned(),
        source_result_id: "result_1".to_owned(),
    };

    let input = CreateAgentQueueItemFromProposalInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.source_run_id, "run_1");
    assert_eq!(input.source_result_id, "result_1");
}

#[test]
fn maps_agent_queue_snapshot_to_dto() {
    let snapshot = AgentQueueSnapshot {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        items: vec![queue_item_summary()],
    };

    let dto = AgentQueueSnapshotDto::from(snapshot);

    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.items.len(), 1);
    assert_eq!(dto.items[0].id, "queue_1");
    assert_eq!(dto.items[0].status, "needs_review");
    assert_eq!(dto.items[0].decision_status, "pending_review");
    assert_eq!(dto.items[0].proposed_actions[0].status, "not_executed");
    assert!(!dto.items[0].proposed_actions[0].executed);
    assert!(dto.items[0].no_tools_executed);
}

#[test]
fn maps_agent_queue_item_to_dto() {
    let dto = AgentQueueItemDto::from(queue_item_summary());

    assert_eq!(dto.id, "queue_1");
    assert_eq!(dto.source_run_id, "run_1");
    assert_eq!(dto.source_result_id, "result_1");
    assert_eq!(dto.source_widget_title, "Agent Chat");
    assert_eq!(dto.title, "Review proposal");
    assert!(dto.proposal_only_mock);
    assert!(dto.no_llm_called);
    assert!(dto.no_tools_executed);
    assert!(dto.no_mutations_performed);
}

#[test]
fn accepts_agent_queue_snapshot_request_shape() {
    let request = GetAgentQueueSnapshotRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
    };

    assert_eq!(request.workspace_id, "ws_1");
    assert_eq!(request.workbench_id, "wb_1");
}

fn queue_item_summary() -> AgentQueueItemSummary {
    AgentQueueItemSummary {
        id: "queue_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        source_run_id: "run_1".to_owned(),
        source_result_id: "result_1".to_owned(),
        source_widget_instance_id: "widget_1".to_owned(),
        source_widget_title: "Agent Chat".to_owned(),
        title: "Review proposal".to_owned(),
        status: "needs_review".to_owned(),
        decision_status: "pending_review".to_owned(),
        prompt_summary: "Plan".to_owned(),
        proposal_summary: "Proposal summary".to_owned(),
        approved_context_summary: "Prompt only".to_owned(),
        proposed_plan: vec!["Step".to_owned()],
        proposed_actions: vec![AgentQueueProposalActionSummary {
            title: "No tool action executed".to_owned(),
            description: "No tool was executed.".to_owned(),
            status: "not_executed".to_owned(),
            executed: false,
        }],
        proposal_only_mock: true,
        no_llm_called: true,
        no_tools_executed: true,
        no_mutations_performed: true,
        created_at: "1".to_owned(),
        updated_at: "1".to_owned(),
        payload_json: "{\"item_kind\":\"agent_queue_proposal_review\"}".to_owned(),
    }
}
