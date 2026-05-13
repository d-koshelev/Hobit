use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace_and_workbenches(store: &SqliteStore) {
    store
        .create_workspace("workspace-1", "Incident", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    store
        .create_workspace_workbench("workbench-2", "workspace-1", None)
        .expect("create other workbench");
}

fn insert_widget(store: &SqliteStore, id: &str, workbench_id: &str) {
    store
        .insert_widget_instance(NewWidgetInstance {
            id,
            workspace_id: "workspace-1",
            workbench_id,
            definition_id: "notes",
            title: "Notes",
            category: "notes",
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
}

fn insert_widget_artifacts(store: &SqliteStore, widget_id: &str, suffix: &str) {
    let run_id = format!("run-{suffix}");
    let result_id = format!("result-{suffix}");
    let run_log_id = format!("run-log-{suffix}");
    let local_log_id = format!("local-log-{suffix}");

    store
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
        .expect("insert run");
    store
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
        .expect("insert result");
    store
        .append_widget_log(NewWidgetLog {
            id: &run_log_id,
            widget_instance_id: widget_id,
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
            widget_instance_id: widget_id,
            run_id: None,
            level: "info",
            message: "Widget log",
            created_at: Some("3"),
            details: None,
        })
        .expect("append local log");
}

#[test]
fn deleting_widget_removes_instance_and_widget_local_artifacts() {
    let store = initialized_store();
    create_workspace_and_workbenches(&store);
    insert_widget(&store, "widget-1", "workbench-1");
    insert_widget_artifacts(&store, "widget-1", "1");

    store
        .with_immediate_transaction(|store| {
            store.delete_widget_instance_and_local_artifacts("widget-1")
        })
        .expect("delete widget");

    assert!(store
        .get_widget_instance("widget-1")
        .expect("get deleted widget")
        .is_none());
    assert!(store
        .get_widget_run("run-1")
        .expect("get deleted run")
        .is_none());
    assert!(store
        .get_widget_result("result-1")
        .expect("get deleted result")
        .is_none());
    assert!(store
        .get_widget_log("run-log-1")
        .expect("get deleted run log")
        .is_none());
    assert!(store
        .get_widget_log("local-log-1")
        .expect("get deleted local log")
        .is_none());
}

#[test]
fn deleting_one_widget_preserves_other_widgets_and_workbenches() {
    let store = initialized_store();
    create_workspace_and_workbenches(&store);
    insert_widget(&store, "widget-1", "workbench-1");
    insert_widget(&store, "widget-2", "workbench-1");
    insert_widget(&store, "widget-3", "workbench-2");
    insert_widget_artifacts(&store, "widget-1", "1");
    insert_widget_artifacts(&store, "widget-2", "2");
    insert_widget_artifacts(&store, "widget-3", "3");

    store
        .with_immediate_transaction(|store| {
            store.delete_widget_instance_and_local_artifacts("widget-1")
        })
        .expect("delete widget");

    assert!(store
        .get_workspace("workspace-1")
        .expect("get workspace")
        .is_some());
    assert!(store
        .get_workspace_workbench("workbench-1")
        .expect("get workbench")
        .is_some());
    assert!(store
        .get_workspace_workbench("workbench-2")
        .expect("get other workbench")
        .is_some());
    assert_eq!(
        widget_ids(
            &store
                .list_widget_instances_for_workbench("workbench-1")
                .expect("list workbench widgets"),
        ),
        vec!["widget-2"],
    );
    assert_eq!(
        widget_ids(
            &store
                .list_widget_instances_for_workbench("workbench-2")
                .expect("list other workbench widgets"),
        ),
        vec!["widget-3"],
    );
    assert!(store
        .get_widget_run("run-2")
        .expect("get preserved run")
        .is_some());
    assert!(store
        .get_widget_result("result-3")
        .expect("get preserved result")
        .is_some());
}

#[test]
fn deleting_missing_widget_rolls_back_transaction() {
    let store = initialized_store();
    create_workspace_and_workbenches(&store);
    insert_widget(&store, "widget-1", "workbench-1");

    let result = store.with_immediate_transaction(|store| {
        store.delete_widget_instance_and_local_artifacts("missing-widget")
    });

    assert!(result.is_err());
    assert!(store
        .get_widget_instance("widget-1")
        .expect("get preserved widget")
        .is_some());
}

fn widget_ids(widgets: &[WidgetInstanceRow]) -> Vec<&str> {
    widgets.iter().map(|widget| widget.id.as_str()).collect()
}
