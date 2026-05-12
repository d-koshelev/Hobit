use super::*;

use std::cell::RefCell;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use serde_json::{json, Value};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn agent_chat_ai_proposal_without_provider_config_persists_fallback_artifact() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);
    let provider = StaticProvider::new(AgentChatAiProviderOutcome::NotConfigured {
        message: "Set HOBIT_AI_PROVIDER_ENDPOINT and HOBIT_AI_PROVIDER_MODEL.".to_owned(),
    });

    let summary = service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("generate proposal")
        .expect("proposal summary");
    let payload = result_payload(&service, &summary.run.run_id);

    assert_eq!(summary.run.result_type, "agent_chat_ai_proposal_result");
    assert_eq!(summary.runtime_status, "provider_unavailable_fallback");
    assert_eq!(summary.provider_status, "not_configured");
    assert!(!summary.provider_used);
    assert_eq!(payload["provider_status"], "not_configured");
    assert_eq!(payload["provider_used"], false);
    assert_eq!(payload["no_llm_called"], true);
    assert_eq!(payload["no_tools_executed"], true);
    assert_eq!(payload["no_mutations_performed"], true);
    assert_eq!(payload["context_was_approved"], true);
    assert!(payload["request_artifact"]["allowed_tools"]
        .as_array()
        .expect("allowed tools")
        .is_empty());
}

#[test]
fn agent_chat_ai_request_artifact_contains_approved_context_and_safety_constraints() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);
    let provider = CapturingProvider::new(AgentChatAiProviderOutcome::NotConfigured {
        message: "not configured".to_owned(),
    });

    service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("generate proposal")
        .expect("proposal summary");
    let artifact = provider.artifact();
    let serialized = json!({
        "operator_prompt": artifact.operator_prompt,
        "approved_context_snapshot": artifact.approved_context_snapshot,
        "contract_pack_summary": artifact.contract_pack_summary,
        "allowed_tools": artifact.allowed_tools,
        "safety_constraints": artifact.safety_constraints,
        "expected_response_format": artifact.expected_response_format,
        "validation_plan": artifact.validation_plan,
    })
    .to_string();

    assert_eq!(artifact.operator_prompt, "Plan the next Hobit block.");
    assert_eq!(
        artifact.approved_context_snapshot["summary"],
        "Approved context: Current workspace."
    );
    assert!(artifact.allowed_tools.is_empty());
    assert!(artifact
        .safety_constraints
        .iter()
        .any(|constraint| constraint.contains("Do not use hidden context")));
    assert!(!serialized.contains("Notes body"));
    assert!(!serialized.contains("Terminal output preview"));
    assert!(!serialized.contains("git status output fixture"));
    assert!(!serialized.contains("environment variable value"));
}

#[test]
fn agent_chat_ai_proposal_rejects_non_agent_chat_widget() {
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
    let provider = StaticProvider::new(valid_provider_response());

    let summary = service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&workspace.id, workbench_id, &widget_id),
            &provider,
        )
        .expect("reject widget");

    assert!(summary.is_none());
    assert!(service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("runs")
        .is_empty());
}

#[test]
fn agent_chat_ai_proposal_rejects_cross_workspace_and_workbench_widgets() {
    let service = initialized_service();
    let first_workspace = service
        .create_empty_workspace("First", None)
        .expect("create first");
    let first_workbench = first_workspace
        .workbench_id
        .as_deref()
        .expect("first workbench");
    let (second_workspace, second_workbench, second_widget) = add_agent_chat_widget(&service);
    let provider = StaticProvider::new(valid_provider_response());

    let cross_workspace = service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&first_workspace.id, first_workbench, &second_widget),
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
            id: "other-agent-chat",
            workspace_id: &second_workspace,
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
        .expect("insert other widget");
    let cross_workbench = service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&second_workspace, &second_workbench, "other-agent-chat"),
            &provider,
        )
        .expect("reject cross workbench");

    assert!(cross_workspace.is_none());
    assert!(cross_workbench.is_none());
    assert!(service
        .store
        .list_widget_runs_for_widget(&second_widget)
        .expect("runs")
        .is_empty());
    assert!(service
        .store
        .list_widget_runs_for_widget("other-agent-chat")
        .expect("runs")
        .is_empty());
}

#[test]
fn provider_response_normalization_marks_actions_not_executed() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);
    let provider = StaticProvider::new(valid_provider_response());

    let summary = service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("generate proposal")
        .expect("proposal summary");
    let payload = result_payload(&service, &summary.run.run_id);
    let action = &payload["proposal"]["proposed_tool_actions"][0];

    assert_eq!(summary.provider_status, "completed");
    assert!(summary.provider_used);
    assert_eq!(payload["runtime_status"], "ai_proposal_only");
    assert_eq!(action["status"], "not_executed");
    assert_eq!(action["executed"], false);
    assert_eq!(payload["no_tools_executed"], true);
    assert_eq!(payload["no_mutations_performed"], true);
}

#[test]
fn provider_parse_failure_creates_safe_fallback_and_preserves_raw_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_chat_widget(&service);
    let provider = StaticProvider::new(AgentChatAiProviderOutcome::Response {
        raw_response: "not json".to_owned(),
    });

    let summary = service
        .generate_agent_chat_ai_proposal(
            generate_ai_input(&workspace_id, &workbench_id, &widget_id),
            &provider,
        )
        .expect("generate proposal")
        .expect("proposal summary");
    let payload = result_payload(&service, &summary.run.run_id);

    assert_eq!(summary.provider_status, "parse_failed");
    assert_eq!(summary.runtime_status, "provider_parse_fallback");
    assert!(summary.provider_used);
    assert_eq!(payload["raw_provider_response"], "not json");
    assert_eq!(
        payload["proposal"]["proposed_tool_actions"][0]["status"],
        "not_executed"
    );
    assert_eq!(payload["no_tools_executed"], true);
    assert_eq!(payload["no_mutations_performed"], true);
}

fn valid_provider_response() -> AgentChatAiProviderOutcome {
    AgentChatAiProviderOutcome::Response {
        raw_response: r#"{
            "summary": "AI proposal summary",
            "proposed_next_steps": ["Review the approved context."],
            "context_needed": ["No additional context."],
            "tool_action_proposals": [
                {
                    "title": "Prepare next block",
                    "description": "Proposal only.",
                    "execution_status": "executed"
                }
            ],
            "risks_and_approval_notes": ["Operator approval required."],
            "runtime_status": "ai_proposal_only",
            "safety_flags": ["no_tools_executed"]
        }"#
        .to_owned(),
    }
}

struct StaticProvider {
    outcome: AgentChatAiProviderOutcome,
}

impl StaticProvider {
    fn new(outcome: AgentChatAiProviderOutcome) -> Self {
        Self { outcome }
    }
}

impl AgentChatAiProposalProvider for StaticProvider {
    fn request_agent_chat_ai_proposal(
        &self,
        _artifact: &AgentChatAiRequestArtifact,
    ) -> AgentChatAiProviderOutcome {
        self.outcome.clone()
    }
}

struct CapturingProvider {
    artifact: RefCell<Option<AgentChatAiRequestArtifact>>,
    outcome: AgentChatAiProviderOutcome,
}

impl CapturingProvider {
    fn new(outcome: AgentChatAiProviderOutcome) -> Self {
        Self {
            artifact: RefCell::new(None),
            outcome,
        }
    }

    fn artifact(&self) -> AgentChatAiRequestArtifact {
        self.artifact
            .borrow()
            .clone()
            .expect("captured request artifact")
    }
}

impl AgentChatAiProposalProvider for CapturingProvider {
    fn request_agent_chat_ai_proposal(
        &self,
        artifact: &AgentChatAiRequestArtifact,
    ) -> AgentChatAiProviderOutcome {
        *self.artifact.borrow_mut() = Some(artifact.clone());
        self.outcome.clone()
    }
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

fn generate_ai_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> GenerateAgentChatAiProposalInput {
    GenerateAgentChatAiProposalInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        operator_prompt: "Plan the next Hobit block.".to_owned(),
        approved_context_snapshot_json: r#"{
            "items": [
                {
                    "lines": ["Workspace: Incident"],
                    "sourceId": "workspaceIdentity",
                    "title": "Current workspace"
                }
            ],
            "sourceLabels": ["Current workspace"],
            "status": "approved",
            "summary": "Approved context: Current workspace."
        }"#
        .to_owned(),
    }
}

fn result_payload(service: &WorkspaceService, run_id: &str) -> Value {
    let results = service
        .store
        .list_widget_results(run_id)
        .expect("list widget results");

    assert_eq!(results.len(), 1);
    serde_json::from_str(results[0].payload.as_deref().expect("payload json"))
        .expect("result payload")
}
