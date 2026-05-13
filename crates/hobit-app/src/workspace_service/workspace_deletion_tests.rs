use super::*;

use crate::WorkspaceServiceError;
use hobit_storage_sqlite::{NewAgentQueueItem, NewWidgetLog, NewWidgetResult, NewWidgetRun};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> (String, String) {
    let workspace = service
        .create_empty_workspace(title, None)
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
        .add_widget_instance_to_workbench(
            workspace_id,
            workbench_id,
            "agent-run",
            title,
            "workflow",
        )
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
            command_kind: Some("direct_work"),
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
            result_type: Some("direct_work_result"),
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
fn delete_workspace_returns_remaining_workspaces_and_removes_local_artifacts() {
    let service = initialized_service();
    let (deleted_workspace_id, deleted_workbench_id) =
        create_workspace(&service, "Delete Workspace");
    let (kept_workspace_id, _) = create_workspace(&service, "Keep Workspace");
    let deleted_widget_id = add_widget(
        &service,
        &deleted_workspace_id,
        &deleted_workbench_id,
        "Direct Work / Codex",
    );
    insert_widget_artifacts(&service, &deleted_widget_id, "delete");
    service
        .store
        .insert_agent_queue_item(NewAgentQueueItem {
            id: "queue-delete",
            workspace_id: &deleted_workspace_id,
            workbench_id: &deleted_workbench_id,
            source_run_id: "run-delete",
            source_result_id: "result-delete",
            source_widget_instance_id: &deleted_widget_id,
            title: "Review proposal",
            status: "needs_review",
            payload_json: "{}",
            created_at: Some("3"),
            updated_at: Some("3"),
        })
        .expect("insert queue item");

    let response = service
        .delete_workspace(&deleted_workspace_id)
        .expect("delete workspace");

    assert_eq!(response.deleted_workspace_id, deleted_workspace_id);
    assert!(response.deleted);
    assert!(!response
        .remaining_workspaces
        .iter()
        .any(|workspace| workspace.id == deleted_workspace_id));
    assert!(response
        .remaining_workspaces
        .iter()
        .any(|workspace| workspace.id == kept_workspace_id));
    assert!(service
        .store
        .get_widget_instance(&deleted_widget_id)
        .expect("get deleted widget")
        .is_none());
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
        .get_agent_queue_item("queue-delete")
        .expect("get deleted queue item")
        .is_none());
}

#[test]
fn delete_workspace_rejects_unknown_workspace_without_mutation() {
    let service = initialized_service();
    let (workspace_id, _) = create_workspace(&service, "Keep Workspace");

    let error = service
        .delete_workspace("missing-workspace")
        .expect_err("unknown workspace rejected");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    assert!(service
        .get_workspace_summary(&workspace_id)
        .expect("get kept workspace")
        .is_some());
}

#[test]
fn deleted_workspace_cannot_be_opened_and_other_workspace_remains_readable() {
    let service = initialized_service();
    let (deleted_workspace_id, _) = create_workspace(&service, "Delete Workspace");
    let (kept_workspace_id, _) = create_workspace(&service, "Keep Workspace");

    service
        .delete_workspace(&deleted_workspace_id)
        .expect("delete workspace");

    assert!(service
        .get_workspace_summary(&deleted_workspace_id)
        .expect("get deleted workspace")
        .is_none());
    assert!(service
        .open_workspace(&deleted_workspace_id)
        .expect("open deleted workspace")
        .is_none());
    assert!(service
        .get_workspace_summary(&kept_workspace_id)
        .expect("get kept workspace")
        .is_some());
    assert!(service
        .open_workspace(&kept_workspace_id)
        .expect("open kept workspace")
        .is_some());
}
