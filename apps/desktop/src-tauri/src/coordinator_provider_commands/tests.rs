use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

use crate::coordinator_provider_dto::{
    CoordinatorProviderMessageDto, CoordinatorProviderProposalDraftContextDto,
    CoordinatorProviderVisibleInputDto,
};

#[test]
fn coordinator_provider_command_returns_mock_text_with_tools_disabled() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) = create_coordinator_widget_in_test_db(&db_path);

    let response = generate_coordinator_provider_response_with_config(
        provider_request(&workspace_id, &workbench_id, &widget_id),
        db_path.clone(),
        CoordinatorProviderCommandConfig::MockLocal,
    )
    .expect("generate provider response")
    .expect("provider response");

    assert_eq!(response.provider_kind, "mock-local");
    assert_eq!(response.provider_status, "completed");
    assert!(response.allowed_tools.is_empty());
    assert!(response.no_tools_executed);
    assert!(response.no_mutations_performed);
    assert!(response.no_hidden_context_used);
    assert!(response.assistant_text.contains("allowed_tools: []"));
    assert_eq!(response.proposal_drafts.len(), 1);
    assert_eq!(response.proposal_drafts[0].type_id, "create-note");
    remove_test_db_files(&db_path);
}

#[test]
fn coordinator_provider_command_surfaces_external_not_configured() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) = create_coordinator_widget_in_test_db(&db_path);

    let response =
        generate_coordinator_provider_response_with_config(
            provider_request(&workspace_id, &workbench_id, &widget_id),
            db_path.clone(),
            CoordinatorProviderCommandConfig::ExternalMissing(
                ExternalCoordinatorProviderConfig::new("external-test", false, false),
            ),
        )
        .expect("generate provider response")
        .expect("provider response");

    assert_eq!(response.provider_kind, "external-test");
    assert_eq!(response.provider_status, "not_configured");
    assert!(response.allowed_tools.is_empty());
    assert!(response.no_tools_executed);
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("Configure backend endpoint and credential"));
    remove_test_db_files(&db_path);
}

#[test]
fn coordinator_provider_command_surfaces_unsupported_external_kind() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) = create_coordinator_widget_in_test_db(&db_path);

    let response = generate_coordinator_provider_response_with_config(
        provider_request(&workspace_id, &workbench_id, &widget_id),
        db_path.clone(),
        CoordinatorProviderCommandConfig::ExternalUnsupported("unsupported-kind".to_owned()),
    )
    .expect("generate provider response")
    .expect("provider response");

    assert_eq!(response.provider_kind, "unsupported-kind");
    assert_eq!(response.provider_status, "unsupported");
    assert!(response.allowed_tools.is_empty());
    assert!(response
        .provider_error
        .as_deref()
        .unwrap_or_default()
        .contains("not supported"));
    remove_test_db_files(&db_path);
}

#[test]
fn coordinator_provider_command_rejects_missing_widget_without_provider_call() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = generate_coordinator_provider_response_with_config(
        provider_request("missing-workspace", "missing-workbench", "missing-widget"),
        db_path.clone(),
        CoordinatorProviderCommandConfig::MockLocal,
    )
    .expect("missing widget should return cleanly");

    assert!(response.is_none());
    remove_test_db_files(&db_path);
}

fn create_coordinator_widget_in_test_db(db_path: &Path) -> (String, String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Coordinator provider command test", None)
        .expect("create workspace");
    let workspace_id = workspace.id;
    let workbench_id = workspace.workbench_id.expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace_id,
            &workbench_id,
            "interactive-agent",
            "Coordinator Chat",
            "core",
        )
        .expect("add coordinator widget")
        .expect("updated state");
    let widget_id = state.widget_instances[0].id.clone();
    drop(service);

    (workspace_id, workbench_id, widget_id)
}

fn provider_request(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> GenerateCoordinatorProviderResponseRequest {
    GenerateCoordinatorProviderResponseRequest {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        operator_message: "Create a note from visible text.".to_owned(),
        visible_conversation: vec![CoordinatorProviderMessageDto {
            id: "message-1".to_owned(),
            role: "operator".to_owned(),
            body: "Create a note from visible text.".to_owned(),
        }],
        visible_proposal_drafts: vec![CoordinatorProviderProposalDraftContextDto {
            id: "proposal-1".to_owned(),
            type_id: "create-note".to_owned(),
            title: "Create Note".to_owned(),
            target_widget: "Notes".to_owned(),
            target_capability: "create note".to_owned(),
            intent: "Create a visible note.".to_owned(),
            visible_inputs: vec![CoordinatorProviderVisibleInputDto {
                label: "Title".to_owned(),
                value: "Visible note".to_owned(),
            }],
            risk_notes: vec!["Creates a Note only after explicit action.".to_owned()],
            expected_result: "A Note proposal remains reviewable.".to_owned(),
        }],
    }
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-coordinator-provider-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
