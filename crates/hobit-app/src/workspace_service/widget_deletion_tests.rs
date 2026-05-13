use super::*;

use hobit_storage_sqlite::{NewAgentQueueItem, NewWidgetLog, NewWidgetResult, NewWidgetRun};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService) -> (String, String) {
    let workspace = service
        .create_empty_workspace("Deletion", None)
        .expect("create workspace");

    (
        workspace.id,
        workspace.workbench_id.expect("default workbench id"),
    )
}

fn add_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
    title: &str,
) -> String {
    service
        .add_widget_instance_to_workbench(workspace_id, workbench_id, "notes", title, "notes")
        .expect("add widget")
        .expect("updated state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("added widget")
        .id
}

fn insert_widget_artifacts(service: &WorkspaceService, widget_id: &str, suffix: &str) {
    let run_id = format!("run-{suffix}");
    let result_id = format!("result-{suffix}");
    let log_id = format!("log-{suffix}");

    service
        .store
        .insert_widget_run(NewWidgetRun {
            id: &run_id,
            widget_instance_id: widget_id,
            status: "completed",
            command_kind: Some("test"),
            command_payload: Some("{}"),
            started_at: Some("1"),
            finished_at: Some("2"),
            summary: Some("Completed"),
        })
        .expect("insert widget run");
    service
        .store
        .insert_widget_result(NewWidgetResult {
            id: &result_id,
            run_id: &run_id,
            status: "completed",
            result_type: Some("test_result"),
            summary: Some("Result"),
            content: Some("content"),
            payload: Some("{}"),
            created_at: Some("2"),
        })
        .expect("insert widget result");
    service
        .store
        .append_widget_log(NewWidgetLog {
            id: &log_id,
            widget_instance_id: widget_id,
            run_id: Some(&run_id),
            level: "info",
            message: "Run log",
            created_at: Some("2"),
            details: None,
        })
        .expect("append widget log");
}

#[test]
fn delete_widget_instance_returns_refreshed_state_and_removes_artifacts() {
    let service = initialized_service();
    let (workspace_id, workbench_id) = create_workspace(&service);
    let deleted_widget_id = add_widget(&service, &workspace_id, &workbench_id, "Delete Me");
    let kept_widget_id = add_widget(&service, &workspace_id, &workbench_id, "Keep Me");
    insert_widget_artifacts(&service, &deleted_widget_id, "delete");
    insert_widget_artifacts(&service, &kept_widget_id, "keep");

    let state = service
        .delete_widget_instance_from_workbench(&workspace_id, &workbench_id, &deleted_widget_id)
        .expect("delete widget")
        .expect("updated state");

    assert!(!state
        .widget_instances
        .iter()
        .any(|widget| widget.id == deleted_widget_id));
    assert!(state
        .widget_instances
        .iter()
        .any(|widget| widget.id == kept_widget_id));
    assert!(service
        .store
        .get_widget_run("run-delete")
        .expect("get deleted run")
        .is_none());
    assert!(service
        .store
        .get_widget_result("result-delete")
        .expect("get deleted result")
        .is_none());
    assert!(service
        .store
        .get_widget_log("log-delete")
        .expect("get deleted log")
        .is_none());
    assert!(service
        .store
        .get_widget_run("run-keep")
        .expect("get kept run")
        .is_some());
}

#[test]
fn delete_widget_rejects_cross_workbench_and_unknown_widget_without_mutation() {
    let service = initialized_service();
    let (workspace_id, workbench_id) = create_workspace(&service);
    let widget_id = add_widget(&service, &workspace_id, &workbench_id, "Delete Me");
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace_id, None)
        .expect("create other workbench");

    let cross_workbench = service
        .delete_widget_instance_from_workbench(&workspace_id, "other-workbench", &widget_id)
        .expect("cross-workbench delete returns cleanly");
    let unknown_widget = service
        .delete_widget_instance_from_workbench(&workspace_id, &workbench_id, "missing-widget")
        .expect("unknown widget delete returns cleanly");

    assert!(cross_workbench.is_none());
    assert!(unknown_widget.is_none());
    assert!(service
        .store
        .get_widget_instance(&widget_id)
        .expect("get preserved widget")
        .is_some());
}

#[test]
fn delete_widget_appends_activity_event_and_touches_workspace() {
    let service = initialized_service();
    let (workspace_id, workbench_id) = create_workspace(&service);
    let widget_id = add_widget(&service, &workspace_id, &workbench_id, "Delete Me");
    let before = service
        .store
        .get_workspace(&workspace_id)
        .expect("get workspace before delete")
        .expect("workspace");

    let state = service
        .delete_widget_instance_from_workbench(&workspace_id, &workbench_id, &widget_id)
        .expect("delete widget")
        .expect("updated state");
    let after = service
        .store
        .get_workspace(&workspace_id)
        .expect("get workspace after delete")
        .expect("workspace");

    assert_ne!(after.updated_at, before.updated_at);
    assert!(state
        .recent_events
        .iter()
        .any(|event| event.kind == "widget_instance_deleted"));
}

#[test]
fn delete_widget_rejects_agent_queue_references_without_deleting_widget() {
    let service = initialized_service();
    let (workspace_id, workbench_id) = create_workspace(&service);
    let widget_id = add_widget(&service, &workspace_id, &workbench_id, "Queue Source");
    insert_widget_artifacts(&service, &widget_id, "queue");
    service
        .store
        .insert_agent_queue_item(NewAgentQueueItem {
            id: "queue-item-1",
            workspace_id: &workspace_id,
            workbench_id: &workbench_id,
            source_run_id: "run-queue",
            source_result_id: "result-queue",
            source_widget_instance_id: &widget_id,
            title: "Review proposal",
            status: "needs_review",
            payload_json: "{}",
            created_at: Some("3"),
            updated_at: Some("3"),
        })
        .expect("insert queue item");

    let error = service
        .delete_widget_instance_from_workbench(&workspace_id, &workbench_id, &widget_id)
        .expect_err("queue reference blocks delete");

    assert!(error.to_string().contains("Agent Queue review items"));
    assert!(service
        .store
        .get_widget_instance(&widget_id)
        .expect("get preserved widget")
        .is_some());
    assert!(service
        .store
        .get_widget_run("run-queue")
        .expect("get preserved run")
        .is_some());
}
