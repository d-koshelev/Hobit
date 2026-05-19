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
fn mock_coordinator_provider_returns_text_and_note_draft_response() {
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
    assert_eq!(response.proposal_drafts.len(), 1);
    assert_eq!(response.proposal_drafts[0].type_id, "create-note");
    assert_eq!(response.proposal_drafts[0].target_widget, "Notes");
    assert_eq!(
        input_value(&response.proposal_drafts[0], "Pinned").as_deref(),
        Some("false")
    );
    assert!(response.provider_error.is_none());
}

#[test]
fn external_coordinator_provider_missing_config_surfaces_not_configured() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = ExternalCoordinatorProviderAdapter::new(ExternalCoordinatorProviderConfig::new(
        "external-test",
        false,
        false,
    ));

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");

    assert_eq!(response.provider_kind, "external-test");
    assert_eq!(response.provider_status, "not_configured");
    assert!(response.allowed_tools.is_empty());
    assert!(response.assistant_text.contains("not configured"));
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("Configure backend endpoint and credential"));
    assert!(response.no_tools_executed);
    assert!(response.no_mutations_performed);
    assert!(response.no_hidden_context_used);
}

#[test]
fn external_coordinator_provider_configured_placeholder_keeps_secret_values_out() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let credential_value_that_must_not_surface = "sk-provider-secret";
    let provider = ExternalCoordinatorProviderAdapter::new(ExternalCoordinatorProviderConfig::new(
        "external-test",
        true,
        !credential_value_that_must_not_surface.is_empty(),
    ));

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let serialized = serde_json::to_string(&json!({
        "assistant_text": response.assistant_text,
        "provider_kind": response.provider_kind,
        "provider_status": response.provider_status,
        "provider_error": response.provider_error,
    }))
    .expect("serialize response");

    assert_eq!(response.provider_status, "unsupported");
    assert!(response.allowed_tools.is_empty());
    assert!(!serialized.contains(credential_value_that_must_not_surface));
    assert!(!serialized.contains("token"));
    assert!(!serialized.contains("secret"));
    assert!(!serialized.contains("provider_api_key"));
}

#[test]
fn mock_coordinator_provider_returns_valid_queue_draft_without_creating_task() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = MockCoordinatorProviderAdapter;
    let mut input = provider_input(&workspace_id, &workbench_id, &widget_id);
    input.operator_message =
        "create queue task title: Review sync; prompt: inspect visible notes; priority: 99"
            .to_owned();

    let response = service
        .generate_coordinator_provider_response(input, &provider)
        .expect("provider response")
        .expect("response");

    assert!(response.allowed_tools.is_empty());
    assert_eq!(response.proposal_drafts.len(), 1);
    let draft = &response.proposal_drafts[0];
    assert_eq!(draft.type_id, "create-agent-queue-task");
    assert_eq!(draft.target_widget, "Agent Queue");
    assert_eq!(draft.target_capability, "create Queue task");
    assert_eq!(input_value(draft, "Title").as_deref(), Some("Review sync"));
    assert_eq!(input_value(draft, "Priority").as_deref(), Some("5"));
    assert!(service
        .list_agent_queue_tasks(&workspace_id)
        .expect("list queue tasks")
        .is_empty());
}

#[test]
fn mock_coordinator_provider_returns_valid_note_draft_without_creating_note() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = MockCoordinatorProviderAdapter;
    let mut input = provider_input(&workspace_id, &workbench_id, &widget_id);
    input.operator_message =
        "create note title: Visible summary; body: save only this visible text".to_owned();

    let response = service
        .generate_coordinator_provider_response(input, &provider)
        .expect("provider response")
        .expect("response");

    assert_eq!(response.proposal_drafts.len(), 1);
    let draft = &response.proposal_drafts[0];
    assert_eq!(draft.type_id, "create-note");
    assert_eq!(draft.target_capability, "create Note");
    assert_eq!(
        input_value(draft, "Body").as_deref(),
        Some("save only this visible text")
    );
    assert!(service
        .list_workspace_notes(&workspace_id)
        .expect("list notes")
        .is_empty());
}

#[test]
fn mock_coordinator_provider_returns_valid_jdbc_suggestion_draft() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = MockCoordinatorProviderAdapter;
    let mut input = provider_input(&workspace_id, &workbench_id, &widget_id);
    input.operator_message =
        "prepare sql question: count recent errors; sql: select count(*) from app_errors"
            .to_owned();

    let response = service
        .generate_coordinator_provider_response(input, &provider)
        .expect("provider response")
        .expect("response");

    assert_eq!(response.proposal_drafts.len(), 1);
    let draft = &response.proposal_drafts[0];
    assert_eq!(draft.type_id, "prepare-jdbc-query-suggestion");
    assert_eq!(draft.target_widget, "Database / JDBC");
    assert_eq!(draft.target_capability, "prepare query suggestion");
    assert_eq!(
        input_value(draft, "Suggested SQL text").as_deref(),
        Some("select count(*) from app_errors")
    );
    assert!(draft
        .risk_notes
        .iter()
        .any(|note| note.contains("No connector is accessed")));
}

#[test]
fn coordinator_provider_rejects_unsafe_provider_drafts_before_rendering() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let provider = StaticProvider::new(CoordinatorProviderOutcome::ResponseWithDrafts {
        assistant_text: "Provider attempted an unsafe draft.".to_owned(),
        proposal_drafts: vec![CoordinatorProviderProposalDraftContext {
            id: "unsafe-draft".to_owned(),
            type_id: "run-terminal-command".to_owned(),
            title: "Run Terminal command".to_owned(),
            target_widget: "Terminal".to_owned(),
            target_capability: "run command".to_owned(),
            intent: "Execute a shell command.".to_owned(),
            visible_inputs: vec![CoordinatorProviderVisibleInput {
                label: "Command".to_owned(),
                value: "echo unsafe".to_owned(),
            }],
            risk_notes: vec!["Would execute Terminal.".to_owned()],
            expected_result: "Command output.".to_owned(),
        }],
    });

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");

    assert!(response.proposal_drafts.is_empty());
    assert!(response
        .assistant_text
        .contains("rejected before rendering"));
    assert!(response.allowed_tools.is_empty());
    assert!(service
        .list_agent_queue_tasks(&workspace_id)
        .expect("list queue tasks")
        .is_empty());
    assert!(service
        .list_workspace_notes(&workspace_id)
        .expect("list notes")
        .is_empty());
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
    fn provider_kind(&self) -> &str {
        "static-test"
    }

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
    fn provider_kind(&self) -> &str {
        "capturing-test"
    }

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

fn input_value(proposal: &CoordinatorProviderProposalDraftContext, label: &str) -> Option<String> {
    proposal
        .visible_inputs
        .iter()
        .find(|input| input.label.eq_ignore_ascii_case(label))
        .map(|input| input.value.clone())
}
