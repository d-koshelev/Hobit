use super::*;

use hobit_storage_sqlite::{NewWidgetResult, NewWidgetRun, SqliteStore};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn agent_queue_item_from_valid_proposal_creates_review_item_and_snapshot() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_widget(
        &service,
        AGENT_CHAT_WIDGET_DEFINITION_ID,
        "Agent Chat",
        "core",
    );
    let proposal = persist_proposal(&service, &workspace_id, &workbench_id, &widget_id);

    let item = service
        .create_agent_queue_item_from_proposal(queue_input(
            &workspace_id,
            &workbench_id,
            &proposal.run_id,
            &proposal.result_id,
        ))
        .expect("create queue item")
        .expect("queue item");
    let snapshot = service
        .get_agent_queue_snapshot(&workspace_id, &workbench_id)
        .expect("read queue snapshot")
        .expect("valid queue snapshot");
    let events = service
        .store
        .list_workbench_events(&workspace_id)
        .expect("list workspace events");

    assert_eq!(item.status, AGENT_QUEUE_STATUS_NEEDS_REVIEW);
    assert_eq!(item.decision_status, AGENT_QUEUE_DECISION_PENDING_REVIEW);
    assert_eq!(item.source_run_id, proposal.run_id);
    assert_eq!(item.source_result_id, proposal.result_id);
    assert_eq!(item.source_widget_instance_id, widget_id);
    assert_eq!(item.source_widget_title, "Agent Chat");
    assert_eq!(
        item.proposal_summary,
        "Local mock interpreted request: \"Plan the next Hobit block.\""
    );
    assert_eq!(item.prompt_summary, "Plan the next Hobit block.");
    assert_eq!(
        item.approved_context_summary,
        "Approved current-view context: Workspace identity."
    );
    assert_eq!(
        item.proposed_plan,
        vec![
            "Review approved workspace metadata.".to_owned(),
            "Prepare an operator-reviewed action preview.".to_owned()
        ]
    );
    assert_eq!(item.proposed_actions[0].status, "not_executed");
    assert!(!item.proposed_actions[0].executed);
    assert!(item.proposal_only_mock);
    assert!(item.no_llm_called);
    assert!(item.no_tools_executed);
    assert!(item.no_mutations_performed);
    assert!(item.payload_json.contains("\"item_kind\""));
    assert_eq!(snapshot.items, vec![item]);
    assert!(events
        .iter()
        .any(|event| event.kind == "agent_queue_item_created"));
}

#[test]
fn agent_queue_create_rejects_cross_workspace_or_workbench_source_without_leak() {
    let service = initialized_service();
    let first_workspace = service
        .create_empty_workspace("First", None)
        .expect("create first workspace");
    let first_workbench_id = first_workspace
        .workbench_id
        .as_deref()
        .expect("first workbench id");
    let (second_workspace_id, second_workbench_id, second_widget_id) = add_widget(
        &service,
        AGENT_CHAT_WIDGET_DEFINITION_ID,
        "Agent Chat",
        "core",
    );
    let proposal = persist_proposal(
        &service,
        &second_workspace_id,
        &second_workbench_id,
        &second_widget_id,
    );

    let cross_workspace_item = service
        .create_agent_queue_item_from_proposal(queue_input(
            &first_workspace.id,
            first_workbench_id,
            &proposal.run_id,
            &proposal.result_id,
        ))
        .expect("cross-workspace create is safe");

    service
        .store
        .create_workspace_workbench("second-workbench-in-first", &first_workspace.id, None)
        .expect("create second first-workspace workbench");
    let cross_workbench_item = service
        .create_agent_queue_item_from_proposal(queue_input(
            &first_workspace.id,
            "second-workbench-in-first",
            &proposal.run_id,
            &proposal.result_id,
        ))
        .expect("cross-workbench create is safe");
    let first_snapshot = service
        .get_agent_queue_snapshot(&first_workspace.id, first_workbench_id)
        .expect("read first queue snapshot")
        .expect("valid first snapshot");

    assert!(cross_workspace_item.is_none());
    assert!(cross_workbench_item.is_none());
    assert!(first_snapshot.items.is_empty());
}

#[test]
fn agent_queue_create_rejects_terminal_result_without_leak() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) =
        add_widget(&service, TERMINAL_WIDGET_DEFINITION_ID, "Terminal", "tool");

    insert_result(
        &service,
        "terminal-run",
        "terminal-result",
        &widget_id,
        "terminal_command_result",
        r#"{"runtime_status":"terminal_command","stdout":"not queueable"}"#,
    );

    let item = service
        .create_agent_queue_item_from_proposal(queue_input(
            &workspace_id,
            &workbench_id,
            "terminal-run",
            "terminal-result",
        ))
        .expect("terminal result rejection is safe");
    let snapshot = service
        .get_agent_queue_snapshot(&workspace_id, &workbench_id)
        .expect("read queue snapshot")
        .expect("valid queue snapshot");

    assert!(item.is_none());
    assert!(snapshot.items.is_empty());
}

#[test]
fn agent_queue_create_rejects_malformed_nonproposal_and_missing_result_without_leak() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_widget(
        &service,
        AGENT_CHAT_WIDGET_DEFINITION_ID,
        "Agent Chat",
        "core",
    );

    insert_result(
        &service,
        "malformed-run",
        "malformed-result",
        &widget_id,
        AGENT_CHAT_PROPOSAL_RESULT_TYPE,
        "{not-json",
    );
    insert_result(
        &service,
        "nonproposal-run",
        "nonproposal-result",
        &widget_id,
        AGENT_CHAT_PROPOSAL_RESULT_TYPE,
        r#"{"runtime_status":"other","no_llm_called":true,"no_tools_executed":true,"no_mutations_performed":true}"#,
    );
    insert_result(
        &service,
        "executed-action-run",
        "executed-action-result",
        &widget_id,
        AGENT_CHAT_PROPOSAL_RESULT_TYPE,
        unsafe_executed_action_payload(),
    );

    for (run_id, result_id) in [
        ("malformed-run", "malformed-result"),
        ("nonproposal-run", "nonproposal-result"),
        ("executed-action-run", "executed-action-result"),
        ("missing-run", "missing-result"),
    ] {
        let item = service
            .create_agent_queue_item_from_proposal(queue_input(
                &workspace_id,
                &workbench_id,
                run_id,
                result_id,
            ))
            .expect("rejection is safe");
        assert!(item.is_none());
    }

    let snapshot = service
        .get_agent_queue_snapshot(&workspace_id, &workbench_id)
        .expect("read queue snapshot")
        .expect("valid queue snapshot");

    assert!(snapshot.items.is_empty());
}

#[test]
fn agent_queue_snapshot_is_workspace_workbench_scoped() {
    let service = initialized_service();
    let (first_workspace_id, first_workbench_id, first_widget_id) = add_widget(
        &service,
        AGENT_CHAT_WIDGET_DEFINITION_ID,
        "Agent Chat",
        "core",
    );
    let (second_workspace_id, second_workbench_id, second_widget_id) = add_widget(
        &service,
        AGENT_CHAT_WIDGET_DEFINITION_ID,
        "Second Agent Chat",
        "core",
    );
    let first_proposal = persist_proposal(
        &service,
        &first_workspace_id,
        &first_workbench_id,
        &first_widget_id,
    );
    let second_proposal = persist_proposal(
        &service,
        &second_workspace_id,
        &second_workbench_id,
        &second_widget_id,
    );

    service
        .create_agent_queue_item_from_proposal(queue_input(
            &first_workspace_id,
            &first_workbench_id,
            &first_proposal.run_id,
            &first_proposal.result_id,
        ))
        .expect("create first item")
        .expect("first item");
    service
        .create_agent_queue_item_from_proposal(queue_input(
            &second_workspace_id,
            &second_workbench_id,
            &second_proposal.run_id,
            &second_proposal.result_id,
        ))
        .expect("create second item")
        .expect("second item");

    let first_snapshot = service
        .get_agent_queue_snapshot(&first_workspace_id, &first_workbench_id)
        .expect("read first snapshot")
        .expect("first snapshot");
    let second_snapshot = service
        .get_agent_queue_snapshot(&second_workspace_id, &second_workbench_id)
        .expect("read second snapshot")
        .expect("second snapshot");

    assert_eq!(first_snapshot.items.len(), 1);
    assert_eq!(second_snapshot.items.len(), 1);
    assert_eq!(
        first_snapshot.items[0].source_result_id,
        first_proposal.result_id
    );
    assert_eq!(
        second_snapshot.items[0].source_result_id,
        second_proposal.result_id
    );
}

fn add_widget(
    service: &WorkspaceService,
    definition_id: &str,
    title: &str,
    category: &str,
) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id")
        .to_owned();
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            definition_id,
            title,
            category,
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn persist_proposal(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> AgentChatProposalRunSummary {
    service
        .persist_agent_chat_proposal(PersistAgentChatProposalInput {
            workspace_id: workspace_id.to_owned(),
            workbench_id: workbench_id.to_owned(),
            widget_instance_id: widget_id.to_owned(),
            operator_prompt: "Plan the next Hobit block.".to_owned(),
            approved_context_snapshot_json: r#"{
                "items": [],
                "sourceLabels": ["Workspace identity"],
                "status": "approved",
                "summary": "Approved current-view context: Workspace identity."
            }"#
            .to_owned(),
            proposal: AgentChatProposalInput {
                id: "agent-chat-mock-proposal-1".to_owned(),
                request_summary: "Local mock interpreted request: \"Plan the next Hobit block.\""
                    .to_owned(),
                proposed_plan: vec![
                    "Review approved workspace metadata.".to_owned(),
                    "Prepare an operator-reviewed action preview.".to_owned(),
                ],
                context_needed: vec![
                    "No additional context is required for this mock preview.".to_owned()
                ],
                action_proposals: vec![AgentChatProposalActionInput {
                    title: "No tool action executed".to_owned(),
                    description: "The mock runtime did not call tools.".to_owned(),
                }],
                safety_notes: vec!["Proposal only.".to_owned()],
                runtime_notes: vec![
                    "No LLM connected.".to_owned(),
                    "No tools executed.".to_owned(),
                ],
            },
        })
        .expect("persist proposal")
        .expect("proposal run summary")
}

fn queue_input(
    workspace_id: &str,
    workbench_id: &str,
    source_run_id: &str,
    source_result_id: &str,
) -> CreateAgentQueueItemFromProposalInput {
    CreateAgentQueueItemFromProposalInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        source_run_id: source_run_id.to_owned(),
        source_result_id: source_result_id.to_owned(),
    }
}

fn insert_result(
    service: &WorkspaceService,
    run_id: &str,
    result_id: &str,
    widget_id: &str,
    result_type: &str,
    payload: &str,
) {
    service
        .store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: widget_id,
            status: "completed",
            command_kind: Some("test_command"),
            command_payload: None,
            started_at: Some("1.000000000"),
            finished_at: Some("2.000000000"),
            summary: Some("Test run"),
        })
        .expect("insert test run");
    service
        .store
        .insert_widget_result(NewWidgetResult {
            id: result_id,
            run_id,
            status: "completed",
            result_type: Some(result_type),
            summary: Some("Test result"),
            content: Some("Read-only test result"),
            payload: Some(payload),
            created_at: Some("3.000000000"),
        })
        .expect("insert test result");
}

fn unsafe_executed_action_payload() -> &'static str {
    r#"{
        "runtime_status": "proposal_only_mock",
        "no_llm_called": true,
        "no_tools_executed": true,
        "no_mutations_performed": true,
        "operator_prompt": "Unsafe action marker",
        "approved_context_snapshot": {
            "summary": "No approved context.",
            "status": "none",
            "sourceLabels": []
        },
        "proposal": {
            "request_summary": "Unsafe action marker",
            "proposed_plan": ["Review only."],
            "context_needed": ["None."],
            "proposed_tool_actions": [{
                "title": "Executed action should be rejected",
                "description": "Malformed payload claims an action executed.",
                "status": "executed",
                "executed": true
            }],
            "safety_notes": ["Reject this payload."]
        }
    }"#
}
