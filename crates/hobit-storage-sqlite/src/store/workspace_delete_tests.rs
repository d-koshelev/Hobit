use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace_graph(store: &SqliteStore, workspace_id: &str, suffix: &str) {
    let workbench_id = format!("workbench-{suffix}");
    let widget_id = format!("widget-{suffix}");
    let run_id = format!("run-{suffix}");
    let result_id = format!("result-{suffix}");
    let run_log_id = format!("run-log-{suffix}");
    let local_log_id = format!("local-log-{suffix}");
    let shared_id = format!("shared-{suffix}");
    let event_id = format!("event-{suffix}");
    let session_id = format!("session-{suffix}");
    let queue_id = format!("queue-{suffix}");
    let queue_task_id = format!("queue-task-{suffix}");
    let note_id = format!("note-{suffix}");
    let jdbc_connector_id = format!("jdbc-{suffix}");

    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench(&workbench_id, workspace_id, None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: &widget_id,
            workspace_id,
            workbench_id: &workbench_id,
            definition_id: "agent-run",
            title: "Direct Work / Codex",
            category: "workflow",
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
        .expect("insert widget");
    store
        .insert_widget_run(NewWidgetRun {
            id: &run_id,
            widget_instance_id: &widget_id,
            status: "completed",
            command_kind: Some("direct_work"),
            command_payload: Some("{}"),
            started_at: Some("1"),
            finished_at: Some("2"),
            summary: Some("Completed"),
        })
        .expect("insert run");
    store
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
        .expect("insert result");
    store
        .append_widget_log(NewWidgetLog {
            id: &run_log_id,
            widget_instance_id: &widget_id,
            run_id: Some(&run_id),
            level: "info",
            message: "Run log",
            created_at: Some("2"),
            details: None,
        })
        .expect("append run log");
    store
        .append_widget_log(NewWidgetLog {
            id: &local_log_id,
            widget_instance_id: &widget_id,
            run_id: None,
            level: "info",
            message: "Widget log",
            created_at: Some("3"),
            details: None,
        })
        .expect("append local log");
    store
        .insert_shared_state_object(NewSharedStateObject {
            id: &shared_id,
            workspace_id,
            key: "current_goal",
            value: "Review",
            value_kind: "text",
        })
        .expect("insert shared state");
    store
        .append_workbench_event(
            &event_id,
            workspace_id,
            "workspace_created",
            "Workspace created",
            None,
        )
        .expect("append event");
    store
        .create_workspace_session(NewWorkspaceSession {
            id: &session_id,
            workspace_id,
            status: "open",
            opened_at: Some("4"),
            closed_at: None,
            active_widget_id: Some(&widget_id),
            current_focus_kind: None,
            current_focus_ref: None,
        })
        .expect("create session");
    store
        .insert_agent_queue_item(NewAgentQueueItem {
            id: &queue_id,
            workspace_id,
            workbench_id: &workbench_id,
            source_run_id: &run_id,
            source_result_id: &result_id,
            source_widget_instance_id: &widget_id,
            title: "Review proposal",
            status: "needs_review",
            payload_json: "{}",
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert queue item");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: &queue_task_id,
            workspace_id,
            title: "Manual queue task",
            description: "Stored task only",
            prompt: "Review the workspace",
            status: "queued",
            priority: 2,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert queue task");
    store
        .create_note(NewWorkspaceNote {
            note_id: &note_id,
            workspace_id,
            title: "Workspace note",
            body: "Workspace-local note",
            pinned: false,
            archived: false,
            created_at: Some("6"),
            updated_at: Some("6"),
        })
        .expect("create note");
    store
        .create_jdbc_connector(NewJdbcConnector {
            connector_id: &jdbc_connector_id,
            workspace_id,
            display_name: "Workspace JDBC connector",
            database_kind: "postgres",
            driver_kind: "jdbc",
            jdbc_url_masked: "jdbc:postgresql://db.example.test/app",
            environment: "dev",
            read_only_default: true,
            status: "not_configured",
            notes: "metadata only",
            created_at: Some("7"),
            updated_at: Some("7"),
            last_used_at: None,
        })
        .expect("create JDBC connector");
}

#[test]
fn deleting_workspace_removes_workspace_and_local_children() {
    let store = initialized_store();
    create_workspace_graph(&store, "workspace-delete", "delete");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_workspace("workspace-delete")
        .expect("get deleted workspace")
        .is_none());
    assert!(store
        .list_workspace_workbenches("workspace-delete")
        .expect("list deleted workbenches")
        .is_empty());
    assert!(store
        .get_widget_instance("widget-delete")
        .expect("get deleted widget")
        .is_none());
    assert!(store
        .get_widget_run("run-delete")
        .expect("get deleted run")
        .is_none());
    assert!(store
        .get_widget_result("result-delete")
        .expect("get deleted result")
        .is_none());
    assert!(store
        .get_widget_log("run-log-delete")
        .expect("get deleted run log")
        .is_none());
    assert!(store
        .get_widget_log("local-log-delete")
        .expect("get deleted local log")
        .is_none());
    assert!(store
        .get_shared_state_object("shared-delete")
        .expect("get deleted shared state")
        .is_none());
    assert!(store
        .get_workbench_event("event-delete")
        .expect("get deleted event")
        .is_none());
    assert!(store
        .get_workspace_session("session-delete")
        .expect("get deleted session")
        .is_none());
    assert!(store
        .get_agent_queue_item("queue-delete")
        .expect("get deleted queue item")
        .is_none());
    assert!(store
        .get_agent_queue_task_by_id("queue-task-delete")
        .expect("get deleted queue task")
        .is_none());
    assert!(store
        .get_note_by_id("note-delete")
        .expect("get deleted note")
        .is_none());
    assert!(store
        .get_jdbc_connector_by_id("jdbc-delete")
        .expect("get deleted JDBC connector")
        .is_none());
}

#[test]
fn deleting_one_workspace_preserves_other_workspace_graph() {
    let store = initialized_store();
    create_workspace_graph(&store, "workspace-delete", "delete");
    create_workspace_graph(&store, "workspace-keep", "keep");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_workspace("workspace-keep")
        .expect("get kept workspace")
        .is_some());
    assert!(store
        .get_workspace_workbench("workbench-keep")
        .expect("get kept workbench")
        .is_some());
    assert!(store
        .get_widget_instance("widget-keep")
        .expect("get kept widget")
        .is_some());
    assert!(store
        .get_widget_run("run-keep")
        .expect("get kept run")
        .is_some());
    assert!(store
        .get_widget_result("result-keep")
        .expect("get kept result")
        .is_some());
    assert!(store
        .get_agent_queue_item("queue-keep")
        .expect("get kept queue item")
        .is_some());
    assert!(store
        .get_agent_queue_task_by_id("queue-task-keep")
        .expect("get kept queue task")
        .is_some());
    assert!(store
        .get_note_by_id("note-keep")
        .expect("get kept note")
        .is_some());
    assert!(store
        .get_jdbc_connector_by_id("jdbc-keep")
        .expect("get kept JDBC connector")
        .is_some());
}

#[test]
fn deleting_missing_workspace_rolls_back_transaction() {
    let store = initialized_store();
    create_workspace_graph(&store, "workspace-keep", "keep");

    let result = store.with_immediate_transaction(|store| {
        store.delete_workspace_and_local_data("missing-workspace")
    });

    assert!(result.is_err());
    assert!(store
        .get_workspace("workspace-keep")
        .expect("get preserved workspace")
        .is_some());
    assert!(store
        .get_widget_instance("widget-keep")
        .expect("get preserved widget")
        .is_some());
}
