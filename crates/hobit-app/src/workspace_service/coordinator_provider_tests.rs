use super::*;

use std::cell::RefCell;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use serde_json::json;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn coordinator_provider_request_uses_empty_allowed_tools_and_visible_context_only() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = CapturingProvider::new(CoordinatorProviderOutcome::Response {
        assistant_text: "Mock response".to_owned(),
    });

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let request = provider.request();
    let serialized = request_payload(&request).to_string();

    assert_eq!(
        request.operator_message,
        "Create a note for this visible text."
    );
    assert!(request.allowed_tools.is_empty());
    assert!(response.allowed_tools.is_empty());
    assert_eq!(response.provider_status, "completed");
    assert!(response.no_tools_executed);
    assert!(response.no_mutations_performed);
    assert!(response.no_hidden_context_used);
    assert!(!serialized.contains("workspace_id"));
    assert!(!serialized.contains("workbench_id"));
    assert!(!serialized.contains("source_widget_instance_id"));
    assert!(!serialized.contains("terminal_output"));
    assert!(!serialized.contains("agent_executor_logs"));
    assert!(!serialized.contains("git_status"));
    assert!(!serialized.contains("jdbc_metadata"));
    assert!(!serialized.contains("notes_body"));
    assert!(!serialized.contains("filesystem"));
    assert!(!serialized.contains("environment_variables"));
    assert!(!serialized.contains("raw_secret_value"));
    assert!(!serialized.contains("provider_api_key"));
}

#[test]
fn mock_coordinator_provider_returns_text_only_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = MockCoordinatorProviderAdapter;

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");

    assert_eq!(response.provider_kind, "mock-local");
    assert_eq!(response.provider_status, "completed");
    assert!(response
        .assistant_text
        .contains("Mock Coordinator provider response"));
    assert!(response.assistant_text.contains("allowed_tools: []"));
    assert!(response.proposal_drafts.is_empty());
    assert!(response.provider_error.is_none());
}

#[test]
fn coordinator_provider_failure_is_visible_in_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = StaticProvider::new(CoordinatorProviderOutcome::RequestFailed {
        message: "provider failed".to_owned(),
    });

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");

    assert_eq!(response.provider_status, "request_failed");
    assert_eq!(response.provider_error.as_deref(), Some("provider failed"));
    assert!(response.assistant_text.contains("failed"));
    assert!(response.no_tools_executed);
}

#[test]
fn coordinator_provider_rejects_non_coordinator_widget() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes widget")
        .expect("state");
    let widget_id = state.widget_instances[0].id.clone();
    let provider = MockCoordinatorProviderAdapter;

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace.id, workbench_id, &widget_id),
            &provider,
        )
        .expect("reject widget");

    assert!(response.is_none());
}

#[test]
fn coordinator_provider_rejects_cross_scope_widget() {
    let service = initialized_service();
    let first_workspace = service
        .create_empty_workspace("First", None)
        .expect("create first");
    let first_workbench = first_workspace
        .workbench_id
        .as_deref()
        .expect("first workbench");
    let (second_workspace, second_workbench, second_widget) = add_coordinator_widget(&service);
    let provider = MockCoordinatorProviderAdapter;

    let cross_workspace = service
        .generate_coordinator_provider_response(
            provider_input(&first_workspace.id, first_workbench, &second_widget),
            &provider,
        )
        .expect("reject cross workspace");
    service
        .store
        .create_workspace_workbench("other-workbench", &second_workspace, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-coordinator-chat",
            workspace_id: &second_workspace,
            workbench_id: "other-workbench",
            definition_id: COORDINATOR_CHAT_WIDGET_DEFINITION_ID,
            title: "Other Coordinator Chat",
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
        .expect("insert other widget");
    let cross_workbench = service
        .generate_coordinator_provider_response(
            provider_input(
                &second_workspace,
                &second_workbench,
                "other-coordinator-chat",
            ),
            &provider,
        )
        .expect("reject cross workbench");

    assert!(cross_workspace.is_none());
    assert!(cross_workbench.is_none());
}

#[test]
fn coordinator_provider_rejects_unsupported_message_roles() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = MockCoordinatorProviderAdapter;
    let mut input = provider_input(&workspace_id, &workbench_id, &widget_id);
    input.visible_conversation.push(CoordinatorProviderMessage {
        id: "system-message".to_owned(),
        role: "system".to_owned(),
        body: "Hidden instruction".to_owned(),
    });

    let error = service
        .generate_coordinator_provider_response(input, &provider)
        .expect_err("unsupported role rejected");

    assert!(error
        .to_string()
        .contains("unsupported Coordinator message role"));
}

struct StaticProvider {
    outcome: CoordinatorProviderOutcome,
}

impl StaticProvider {
    fn new(outcome: CoordinatorProviderOutcome) -> Self {
        Self { outcome }
    }
}

impl CoordinatorProviderAdapter for StaticProvider {
    fn request_coordinator_response(
        &self,
        _request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome {
        self.outcome.clone()
    }
}

struct CapturingProvider {
    request: RefCell<Option<CoordinatorProviderRequest>>,
    outcome: CoordinatorProviderOutcome,
}

impl CapturingProvider {
    fn new(outcome: CoordinatorProviderOutcome) -> Self {
        Self {
            request: RefCell::new(None),
            outcome,
        }
    }

    fn request(&self) -> CoordinatorProviderRequest {
        self.request
            .borrow()
            .clone()
            .expect("captured provider request")
    }
}

impl CoordinatorProviderAdapter for CapturingProvider {
    fn request_coordinator_response(
        &self,
        request: &CoordinatorProviderRequest,
    ) -> CoordinatorProviderOutcome {
        *self.request.borrow_mut() = Some(request.clone());
        self.outcome.clone()
    }
}

fn add_coordinator_widget(service: &WorkspaceService) -> (String, String, String) {
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
            COORDINATOR_CHAT_WIDGET_DEFINITION_ID,
            "Coordinator Chat",
            "core",
        )
        .expect("add coordinator widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn provider_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> GenerateCoordinatorProviderResponseInput {
    GenerateCoordinatorProviderResponseInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        operator_message: "Create a note for this visible text.".to_owned(),
        visible_conversation: vec![
            CoordinatorProviderMessage {
                id: "message-1".to_owned(),
                role: "assistant".to_owned(),
                body: "Coordinator Chat is ready.".to_owned(),
            },
            CoordinatorProviderMessage {
                id: "message-2".to_owned(),
                role: "operator".to_owned(),
                body: "Create a note for this visible text.".to_owned(),
            },
        ],
        visible_proposal_drafts: vec![CoordinatorProviderProposalDraftContext {
            id: "proposal-1".to_owned(),
            type_id: "create-note".to_owned(),
            title: "Create Note".to_owned(),
            target_widget: "Notes".to_owned(),
            target_capability: "create note".to_owned(),
            intent: "Save a note from visible text.".to_owned(),
            visible_inputs: vec![CoordinatorProviderVisibleInput {
                label: "Title".to_owned(),
                value: "Visible note".to_owned(),
            }],
            risk_notes: vec!["Creates a workspace-local note only after approval.".to_owned()],
            expected_result: "A draft note can be created after explicit action.".to_owned(),
        }],
    }
}

fn request_payload(request: &CoordinatorProviderRequest) -> serde_json::Value {
    json!({
        "request_id": &request.request_id,
        "operator_message": &request.operator_message,
        "visible_conversation": request.visible_conversation.iter().map(|message| {
            json!({
                "id": &message.id,
                "role": &message.role,
                "body": &message.body,
            })
        }).collect::<Vec<_>>(),
        "visible_proposal_drafts": request.visible_proposal_drafts.iter().map(|proposal| {
            json!({
                "id": &proposal.id,
                "type_id": &proposal.type_id,
                "title": &proposal.title,
                "target_widget": &proposal.target_widget,
                "target_capability": &proposal.target_capability,
                "intent": &proposal.intent,
                "visible_inputs": proposal.visible_inputs.iter().map(|input| {
                    json!({
                        "label": &input.label,
                        "value": &input.value,
                    })
                }).collect::<Vec<_>>(),
                "risk_notes": &proposal.risk_notes,
                "expected_result": &proposal.expected_result,
            })
        }).collect::<Vec<_>>(),
        "system_instructions": &request.system_instructions,
        "allowed_tools": &request.allowed_tools,
        "created_at": &request.created_at,
    })
}
