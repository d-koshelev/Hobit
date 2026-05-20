use super::*;

use std::cell::RefCell;
use std::rc::Rc;

use hobit_app::{
    CoordinatorProviderMessage, GenerateCoordinatorProviderResponseInput, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;
use serde_json::json;

#[test]
fn http_json_provider_builds_visible_context_request_with_tools_disabled() {
    let captured = Rc::new(RefCell::new(None));
    let provider = provider_with_response(
        "sk-test-secret-value",
        json!({
            "assistant_text": "Provider text only."
        })
        .to_string(),
        captured.clone(),
    );

    let outcome = provider
        .request_coordinator_response(&coordinator_request("Create a note from visible chat."));
    let captured_body = captured_body(captured);

    assert!(matches!(
        outcome,
        CoordinatorProviderOutcome::Response { assistant_text }
            if assistant_text == "Provider text only."
    ));
    assert_eq!(captured_body["allowed_tools"], json!([]));
    assert_eq!(
        captured_body["operator_message"],
        json!("Create a note from visible chat.")
    );

    let serialized = captured_body.to_string();
    assert!(!serialized.contains("sk-test-secret-value"));
    assert!(!serialized.contains("workspace_id"));
    assert!(!serialized.contains("workbench_id"));
    assert!(!serialized.contains("widget_instance_id"));
    assert!(!serialized.contains("terminal_output"));
    assert!(!serialized.contains("agent_executor_logs"));
    assert!(!serialized.contains("git_status"));
    assert!(!serialized.contains("jdbc_metadata"));
    assert!(!serialized.contains("notes_body"));
    assert!(!serialized.contains("filesystem"));
    assert!(!serialized.contains("environment_variables"));
    assert!(!serialized.contains("provider_api_key"));
}

#[test]
fn http_json_provider_response_text_is_mapped_and_provider_secret_is_redacted() {
    let secret = "sk-live-provider-secret";
    let provider = provider_with_response(
        secret,
        json!({
            "assistant_text": format!("Provider response without tools. Credential echo: {secret}.")
        })
        .to_string(),
        Rc::new(RefCell::new(None)),
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let serialized = json!({
        "assistant_text": response.assistant_text,
        "provider_error": response.provider_error,
    })
    .to_string();

    assert_eq!(response.provider_status, "completed");
    assert_eq!(response.provider_kind, COORDINATOR_HTTP_JSON_PROVIDER_KIND);
    assert!(response.allowed_tools.is_empty());
    assert!(response.assistant_text.contains(REDACTED_PROVIDER_SECRET));
    assert!(!serialized.contains(secret));
    assert!(!serialized.contains("provider_api_key"));
}

#[test]
fn http_json_provider_safe_drafts_pass_existing_validation_without_execution() {
    let provider = provider_with_response(
        "sk-valid-draft-secret",
        json!({
            "assistant_text": "Drafted safe review cards only.",
            "proposal_drafts": [
                {
                    "proposal_type": "create-agent-queue-task",
                    "title": "Review incident",
                    "target_widget": "Agent Queue",
                    "target_capability": "create Queue task",
                    "intent": "Create a draft task from visible text.",
                    "visible_inputs": [
                        { "label": "Title", "value": "Review incident" },
                        { "label": "Description", "value": "Visible task description" },
                        { "label": "Prompt", "value": "Use only the visible prompt." },
                        { "label": "Priority", "value": "99" }
                    ],
                    "risk_notes": [],
                    "expected_result": "Draft Queue task only."
                },
                {
                    "type_id": "create-note",
                    "title": "Visible note",
                    "target_widget": "Notes",
                    "target_capability": "create Note",
                    "intent": "Create a workspace-local Note.",
                    "visible_inputs": [
                        { "label": "Title", "value": "Visible note" },
                        { "label": "Body", "value": "Only visible text." },
                        { "label": "Pinned", "value": "yes" }
                    ],
                    "risk_notes": [],
                    "expected_result": "Note can be created after explicit action."
                },
                {
                    "type_id": "prepare-jdbc-query-suggestion",
                    "title": "JDBC query suggestion",
                    "target_widget": "Database / JDBC",
                    "target_capability": "prepare query suggestion",
                    "intent": "Prepare a non-executing SQL suggestion.",
                    "visible_inputs": [
                        { "label": "Question", "value": "Count rows." },
                        { "label": "Suggested SQL text", "value": "select count(*) from visible_table" }
                    ],
                    "risk_notes": [],
                    "expected_result": "Copy-only SQL suggestion."
                }
            ]
        })
        .to_string(),
        Rc::new(RefCell::new(None)),
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");

    assert_eq!(response.provider_status, "completed");
    assert_eq!(response.proposal_drafts.len(), 3);
    assert_eq!(
        response.proposal_drafts[0].type_id,
        "create-agent-queue-task"
    );
    assert_eq!(
        input_value(&response.proposal_drafts[0], "Priority").as_deref(),
        Some("5")
    );
    assert_eq!(response.proposal_drafts[1].type_id, "create-note");
    assert_eq!(
        input_value(&response.proposal_drafts[1], "Pinned").as_deref(),
        Some("true")
    );
    assert_eq!(
        response.proposal_drafts[2].type_id,
        "prepare-jdbc-query-suggestion"
    );
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
fn http_json_provider_unsafe_drafts_are_rejected_before_rendering() {
    let provider = provider_with_response(
        "sk-unsafe-draft-secret",
        json!({
            "assistant_text": "Attempted unsafe draft.",
            "proposal_drafts": [
                {
                    "type_id": "run-terminal-command",
                    "title": "Run command",
                    "target_widget": "Terminal",
                    "target_capability": "run command",
                    "intent": "Run a shell command.",
                    "visible_inputs": [
                        { "label": "Command", "value": "echo unsafe" }
                    ],
                    "risk_notes": ["Would execute Terminal."],
                    "expected_result": "Command output."
                }
            ]
        })
        .to_string(),
        Rc::new(RefCell::new(None)),
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

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
fn http_json_provider_failure_surfaces_without_serializing_secret() {
    let secret = "sk-failed-provider-secret";
    let provider = CoordinatorHttpJsonProviderAdapter::new_with_transport(
        CoordinatorHttpJsonProviderConfig::new(
            COORDINATOR_HTTP_JSON_PROVIDER_KIND,
            "http://127.0.0.1/provider",
            secret,
        ),
        RecordingTransport {
            captured: Rc::new(RefCell::new(None)),
            response: Err(CoordinatorHttpJsonProviderError::provider_error(
                "Coordinator provider returned HTTP status 500.",
            )),
        },
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let serialized = json!({
        "assistant_text": response.assistant_text,
        "provider_error": response.provider_error,
    })
    .to_string();

    assert_eq!(response.provider_status, "provider_error");
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("HTTP status 500"));
    assert!(!serialized.contains(secret));
}

#[test]
fn http_json_provider_timeout_surfaces_as_visible_provider_error() {
    let secret = "sk-timeout-provider-secret";
    let captured = Rc::new(RefCell::new(None));
    let provider = CoordinatorHttpJsonProviderAdapter::new_with_transport(
        CoordinatorHttpJsonProviderConfig::new(
            COORDINATOR_HTTP_JSON_PROVIDER_KIND,
            "http://127.0.0.1/provider",
            secret,
        )
        .with_timeout_millis(2_500),
        RecordingTransport {
            captured: captured.clone(),
            response: Err(CoordinatorHttpJsonProviderError::timeout(
                "Coordinator provider request timed out.",
            )),
        },
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let serialized = json!({
        "assistant_text": response.assistant_text,
        "provider_error": response.provider_error,
    })
    .to_string();

    assert_eq!(response.provider_status, "timeout");
    assert_eq!(
        captured.borrow().as_ref().expect("captured").timeout,
        std::time::Duration::from_millis(2_500)
    );
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("timed out"));
    assert!(!serialized.contains(secret));
}

#[test]
fn http_json_provider_network_failure_surfaces_without_request_details() {
    let secret = "sk-network-provider-secret";
    let provider = CoordinatorHttpJsonProviderAdapter::new_with_transport(
        CoordinatorHttpJsonProviderConfig::new(
            COORDINATOR_HTTP_JSON_PROVIDER_KIND,
            "http://127.0.0.1/provider",
            secret,
        ),
        RecordingTransport {
            captured: Rc::new(RefCell::new(None)),
            response: Err(CoordinatorHttpJsonProviderError::network_failure(
                "Coordinator provider connection failed.",
            )),
        },
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let serialized = json!({
        "assistant_text": response.assistant_text,
        "provider_error": response.provider_error,
    })
    .to_string();

    assert_eq!(response.provider_status, "network_failure");
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("connection failed"));
    assert!(!serialized.contains(secret));
    assert!(!serialized.contains("operator_message"));
    assert!(!serialized.contains("visible_conversation"));
}

#[test]
fn http_json_provider_invalid_json_maps_to_invalid_response() {
    let provider = provider_with_response(
        "sk-invalid-json-secret",
        "not json".to_owned(),
        Rc::new(RefCell::new(None)),
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");

    assert_eq!(response.provider_status, "invalid_response");
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("not valid JSON"));
    assert!(response.allowed_tools.is_empty());
}

#[test]
fn http_json_provider_oversized_response_is_rejected_safely() {
    let secret = "sk-oversized-provider-secret";
    let provider = provider_with_response(
        secret,
        "x".repeat(MAX_RESPONSE_BODY_BYTES + 1),
        Rc::new(RefCell::new(None)),
    );
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);

    let response = service
        .generate_coordinator_provider_response(
            provider_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("provider response")
        .expect("response");
    let serialized = json!({
        "assistant_text": response.assistant_text,
        "provider_error": response.provider_error,
    })
    .to_string();

    assert_eq!(response.provider_status, "invalid_response");
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("size limit"));
    assert!(!serialized.contains(secret));
}

#[test]
fn http_json_provider_oversized_request_is_rejected_before_transport() {
    let captured = Rc::new(RefCell::new(None));
    let provider = CoordinatorHttpJsonProviderAdapter::new_with_transport(
        CoordinatorHttpJsonProviderConfig::new(
            COORDINATOR_HTTP_JSON_PROVIDER_KIND,
            "http://127.0.0.1/provider",
            "sk-request-too-large-secret",
        ),
        RecordingTransport {
            captured: captured.clone(),
            response: Ok(json!({ "assistant_text": "Should not be called." }).to_string()),
        },
    );
    let mut request = coordinator_request("Visible message.");
    request.operator_message = "x".repeat(MAX_REQUEST_BODY_BYTES);

    let outcome = provider.request_coordinator_response(&request);

    assert!(captured.borrow().is_none());
    assert!(matches!(
        outcome,
        CoordinatorProviderOutcome::RequestTooLarge { message }
            if message.contains("size limit")
    ));
}

#[test]
fn chat_completion_content_json_is_accepted_as_hobit_payload() {
    let provider = provider_with_response(
        "sk-chat-compatible-secret",
        json!({
            "choices": [
                {
                    "message": {
                        "content": json!({
                            "assistant_text": "Chat-compatible content parsed."
                        }).to_string()
                    }
                }
            ]
        })
        .to_string(),
        Rc::new(RefCell::new(None)),
    );

    let outcome = provider.request_coordinator_response(&coordinator_request("Visible message."));

    assert!(matches!(
        outcome,
        CoordinatorProviderOutcome::Response { assistant_text }
            if assistant_text == "Chat-compatible content parsed."
    ));
}

#[derive(Clone, Debug)]
struct CapturedRequest {
    body: String,
    timeout: std::time::Duration,
}

struct RecordingTransport {
    captured: Rc<RefCell<Option<CapturedRequest>>>,
    response: Result<String, CoordinatorHttpJsonProviderError>,
}

impl CoordinatorHttpJsonTransport for RecordingTransport {
    fn post_json(
        &self,
        _endpoint: &str,
        _api_key: &str,
        body: &str,
        _timeout: std::time::Duration,
        _max_response_body_bytes: usize,
    ) -> Result<String, CoordinatorHttpJsonProviderError> {
        *self.captured.borrow_mut() = Some(CapturedRequest {
            body: body.to_owned(),
            timeout: _timeout,
        });
        self.response.clone()
    }
}

fn provider_with_response(
    api_key: &str,
    response: String,
    captured: Rc<RefCell<Option<CapturedRequest>>>,
) -> CoordinatorHttpJsonProviderAdapter<RecordingTransport> {
    CoordinatorHttpJsonProviderAdapter::new_with_transport(
        CoordinatorHttpJsonProviderConfig::new(
            COORDINATOR_HTTP_JSON_PROVIDER_KIND,
            "http://127.0.0.1/provider",
            api_key,
        ),
        RecordingTransport {
            captured,
            response: Ok(response),
        },
    )
}

fn coordinator_request(operator_message: &str) -> CoordinatorProviderRequest {
    CoordinatorProviderRequest {
        request_id: "coord-p-1".to_owned(),
        operator_message: operator_message.to_owned(),
        visible_conversation: vec![CoordinatorProviderMessage {
            id: "message-1".to_owned(),
            role: "operator".to_owned(),
            body: operator_message.to_owned(),
        }],
        visible_proposal_drafts: Vec::new(),
        system_instructions: vec!["Use visible context only.".to_owned()],
        allowed_tools: Vec::new(),
        created_at: "2026-05-20T00:00:00Z".to_owned(),
    }
}

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn add_coordinator_widget(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Coordinator provider HTTP test", None)
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
            "interactive-agent",
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
        operator_message: "Create a note from visible provider text.".to_owned(),
        visible_conversation: vec![CoordinatorProviderMessage {
            id: "message-1".to_owned(),
            role: "operator".to_owned(),
            body: "Create a note from visible provider text.".to_owned(),
        }],
        visible_proposal_drafts: Vec::new(),
    }
}

fn input_value(proposal: &CoordinatorProviderProposalDraftContext, label: &str) -> Option<String> {
    proposal
        .visible_inputs
        .iter()
        .find(|input| input.label.eq_ignore_ascii_case(label))
        .map(|input| input.value.clone())
}

fn captured_body(captured: Rc<RefCell<Option<CapturedRequest>>>) -> Value {
    serde_json::from_str(&captured.borrow().as_ref().expect("captured request").body)
        .expect("captured request body json")
}
