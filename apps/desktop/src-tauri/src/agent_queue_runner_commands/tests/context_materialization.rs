use super::*;

use hobit_app::{AttachKnowledgeToQueueTaskInput, CreateKnowledgeDocumentInput, WorkspaceService};
use hobit_storage_sqlite::SqliteStore;

#[test]
fn start_autorun_with_attached_context_uses_backend_materialized_prompt() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let queue_item_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt after context",
        1,
    );
    attach_knowledge_context(&db_path, &workspace_id, &queue_item_id, "Backend docs");

    let snapshot = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        QueueRunnerSessionRegistry::default(),
    )
    .expect("start autorun");
    let runs = list_widget_runs(&db_path, &executor_widget_id);
    let operator_prompt = run_operator_prompt(&runs[0]);

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert!(operator_prompt.starts_with("Knowledge / Skills context"));
    assert!(operator_prompt.contains("Backend docs"));
    assert!(operator_prompt.contains("Prompt after context"));
    assert!(operator_prompt.contains("Context storage: durable Queue task context."));
    remove_test_db_files(&db_path);
}

#[test]
fn continuation_autorun_with_attached_context_uses_backend_materialized_prompt() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second after context",
        1,
    );
    attach_knowledge_context(&db_path, &workspace_id, &second_id, "Continuation docs");
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );
    let runs = list_widget_runs(&db_path, &executor_widget_id);
    let operator_prompt = run_operator_prompt(&runs[1]);

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert!(operator_prompt.starts_with("Knowledge / Skills context"));
    assert!(operator_prompt.contains("Continuation docs"));
    assert!(operator_prompt.contains("Second after context"));
    assert!(operator_prompt.contains("Context storage: durable Queue task context."));
    remove_test_db_files(&db_path);
}

fn attach_knowledge_context(db_path: &Path, workspace_id: &str, queue_item_id: &str, title: &str) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let document = service
        .create_knowledge_document(CreateKnowledgeDocumentInput {
            workspace_id: workspace_id.to_owned(),
            scope: Some("workspace".to_owned()),
            catalog_item_type: Some("documentation_knowledge".to_owned()),
            quick_summary: Some(format!("{title} summary.")),
            lifecycle_status: Some("active".to_owned()),
            title: title.to_owned(),
            source_label: "Workspace document".to_owned(),
            source_kind: Some("manual".to_owned()),
            source_ref: Some(title.to_owned()),
            source_refs: Vec::new(),
            relations: Vec::new(),
            content: format!("{title} bounded body."),
            tags: "queue".to_owned(),
            enabled: true,
            searchable: true,
            version_summary: None,
            reviewed_at: None,
            created_by_task_id: None,
            created_from_run_id: None,
        })
        .expect("create knowledge document");

    service
        .attach_knowledge_to_queue_task(AttachKnowledgeToQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            knowledge_id: document.knowledge_document_id,
        })
        .expect("attach knowledge context");
}

fn run_operator_prompt(run: &hobit_storage_sqlite::WidgetRunRow) -> String {
    let command_payload: serde_json::Value =
        serde_json::from_str(run.command_payload.as_deref().expect("payload"))
            .expect("payload json");
    command_payload["operator_prompt"]
        .as_str()
        .expect("operator prompt")
        .to_owned()
}
