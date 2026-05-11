use super::*;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use serde_json::Value;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn agent_chat_proposal_for_valid_widget_creates_run_logs_result_and_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);

    let summary = service
        .persist_agent_chat_proposal(agent_chat_proposal_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
        ))
        .expect("persist proposal")
        .expect("proposal run summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let result_payload = agent_chat_result_payload(&service, &summary.run_id);

    assert!(summary.run_id.starts_with("wrun_"));
    assert!(summary.result_id.starts_with("wres_"));
    assert_eq!(summary.status, "completed");
    assert_eq!(summary.result_type, "agent_chat_mock_proposal_result");
    assert_eq!(
        summary.summary,
        "Agent Chat proposal-only mock result persisted"
    );
    assert_eq!(run.status, "completed");
    assert_eq!(
        run.command_kind.as_deref(),
        Some("agent_chat_mock_proposal")
    );
    assert_eq!(
        widget_log_messages(&logs),
        vec![
            "Widget added",
            "Agent proposal prompt received",
            "Agent proposal approved context snapshot captured",
            "Agent proposal-only mock generated",
            "Agent proposal persisted",
            "Agent proposal no tools executed",
        ]
    );
    assert!(logs
        .iter()
        .skip(1)
        .all(|log| log.run_id.as_deref() == Some(summary.run_id.as_str())));
    assert_eq!(
        result_payload["operator_prompt"],
        "Plan the next Hobit block."
    );
    assert_eq!(result_payload["runtime_status"], "proposal_only_mock");
    assert_eq!(result_payload["no_llm_called"], true);
    assert_eq!(result_payload["no_tools_executed"], true);
    assert_eq!(result_payload["no_mutations_performed"], true);
}

#[test]
fn agent_chat_proposal_rejects_non_agent_chat_widget_without_leaked_records() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    let summary = service
        .persist_agent_chat_proposal(agent_chat_proposal_input(
            &workspace.id,
            workbench_id,
            &widget_id,
        ))
        .expect("reject non-agent-chat widget");
    let runs = service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("list runs");
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");

    assert!(summary.is_none());
    assert!(runs.is_empty());
    assert_eq!(widget_log_messages(&logs), vec!["Widget added"]);
}

#[test]
fn agent_chat_proposal_rejects_cross_workspace_widget_without_leaked_records() {
    let service = initialized_service();
    let first_workspace = service
        .create_empty_workspace("First", None)
        .expect("create first workspace");
    let first_workbench_id = first_workspace
        .workbench_id
        .as_deref()
        .expect("first workbench id");
    let (second_workspace_id, second_workbench_id, second_widget_id) =
        add_agent_chat_widget(&service);

    let summary = service
        .persist_agent_chat_proposal(agent_chat_proposal_input(
            &first_workspace.id,
            first_workbench_id,
            &second_widget_id,
        ))
        .expect("reject cross-workspace widget");
    let runs = service
        .store
        .list_widget_runs_for_widget(&second_widget_id)
        .expect("list runs");
    let second_logs = service
        .list_widget_logs(
            &second_workspace_id,
            &second_workbench_id,
            &second_widget_id,
            20,
        )
        .expect("list second logs")
        .expect("second widget logs");

    assert!(summary.is_none());
    assert!(runs.is_empty());
    assert_eq!(widget_log_messages(&second_logs), vec!["Widget added"]);
}

#[test]
fn agent_chat_proposal_rejects_cross_workbench_widget_without_leaked_records() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace.id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-agent-chat",
            workspace_id: &workspace.id,
            workbench_id: "other-workbench",
            definition_id: AGENT_CHAT_WIDGET_DEFINITION_ID,
            title: "Other Agent Chat",
            category: "core",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert other agent chat widget");

    let summary = service
        .persist_agent_chat_proposal(agent_chat_proposal_input(
            &workspace.id,
            workbench_id,
            "other-agent-chat",
        ))
        .expect("reject cross-workbench widget");
    let runs = service
        .store
        .list_widget_runs_for_widget("other-agent-chat")
        .expect("list runs");
    let logs = service
        .store
        .list_widget_logs_for_widget("other-agent-chat", 20)
        .expect("list logs");

    assert!(summary.is_none());
    assert!(runs.is_empty());
    assert!(logs.is_empty());
}

#[test]
fn agent_chat_proposal_result_json_contains_sections_and_safety_flags() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);

    let summary = service
        .persist_agent_chat_proposal(agent_chat_proposal_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
        ))
        .expect("persist proposal")
        .expect("proposal run summary");
    let payload = agent_chat_result_payload(&service, &summary.run_id);

    assert_eq!(payload["operator_prompt"], "Plan the next Hobit block.");
    assert_eq!(
        payload["approved_context_snapshot"]["summary"],
        "Approved current-view context: Workspace identity."
    );
    assert_eq!(payload["proposal"]["id"], "agent-chat-mock-proposal-1");
    assert_eq!(
        payload["proposal"]["request_summary"],
        "Local mock interpreted request: \"Plan the next Hobit block.\""
    );
    assert_eq!(
        payload["proposal"]["proposed_plan"][0],
        "Review approved workspace metadata."
    );
    assert_eq!(
        payload["proposal"]["context_needed"][0],
        "No additional context is required for this mock preview."
    );
    assert_eq!(
        payload["proposal"]["proposed_tool_actions"][0]["title"],
        "No tool action executed"
    );
    assert_eq!(
        payload["proposal"]["proposed_tool_actions"][0]["status"],
        "not_executed"
    );
    assert_eq!(
        payload["proposal"]["proposed_tool_actions"][0]["executed"],
        false
    );
    assert_eq!(payload["proposal"]["safety_notes"][0], "Proposal only.");
    assert_eq!(payload["proposal"]["runtime_notes"][0], "No LLM connected.");
    assert_eq!(payload["runtime_status"], "proposal_only_mock");
    assert_eq!(payload["no_llm_called"], true);
    assert_eq!(payload["no_tools_executed"], true);
    assert_eq!(payload["no_mutations_performed"], true);
}

#[test]
fn agent_chat_proposal_logs_include_no_tools_and_proposal_only_entries() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);

    service
        .persist_agent_chat_proposal(agent_chat_proposal_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
        ))
        .expect("persist proposal")
        .expect("proposal run summary");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");

    assert!(logs
        .iter()
        .any(|log| log.message == "Agent proposal-only mock generated"));
    assert!(logs
        .iter()
        .any(|log| log.message == "Agent proposal no tools executed"));
    assert!(logs.iter().any(|log| {
        log.payload
            .as_deref()
            .is_some_and(|payload| payload.contains("\"no_tools_executed\":true"))
    }));
}

fn add_agent_chat_widget(service: &WorkspaceService) -> (String, String, String) {
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
            AGENT_CHAT_WIDGET_DEFINITION_ID,
            "Agent Chat",
            "core",
        )
        .expect("add agent chat widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn agent_chat_proposal_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> PersistAgentChatProposalInput {
    PersistAgentChatProposalInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        operator_prompt: "Plan the next Hobit block.".to_owned(),
        approved_context_snapshot_json: r#"{
            "items": [
                {
                    "lines": [
                        "Workspace: Incident (ws-test)",
                        "Workbench: Empty Workbench (wb-test)"
                    ],
                    "sourceId": "workspaceIdentity",
                    "title": "Workspace identity"
                }
            ],
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
    }
}

fn agent_chat_result_payload(service: &WorkspaceService, run_id: &str) -> Value {
    let results = service
        .store
        .list_widget_results(run_id)
        .expect("list widget results");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].result_type, "agent_chat_mock_proposal_result");

    serde_json::from_str(results[0].payload.as_deref().expect("result payload"))
        .expect("result payload json")
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}
