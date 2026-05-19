use super::*;

#[test]
fn list_widget_logs_for_valid_widget_returns_logs() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add widget instance")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    service
        .store
        .append_widget_log(NewWidgetLog {
            id: "log-1",
            widget_instance_id: &widget_id,
            run_id: None,
            level: "info",
            message: "Saved note",
            created_at: Some("1"),
            details: Some("{\"source\":\"test\"}"),
        })
        .expect("append widget log");
    let event_count = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events")
        .len();

    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list widget logs")
        .expect("widget logs");
    let events_after_listing = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events")
        .len();

    let saved_log = logs
        .iter()
        .find(|log| log.id == "log-1")
        .expect("manual saved log");

    assert_eq!(logs.len(), 2);
    assert!(widget_log_messages(&logs).contains(&WIDGET_LOG_WIDGET_ADDED));
    assert_eq!(saved_log.widget_instance_id, widget_id);
    assert_eq!(saved_log.run_id, None);
    assert_eq!(saved_log.level, "info");
    assert_eq!(saved_log.message, "Saved note");
    assert_eq!(saved_log.payload.as_deref(), Some("{\"source\":\"test\"}"));
    assert_eq!(saved_log.created_at, "1");
    assert_eq!(events_after_listing, event_count);
}

#[test]
fn list_widget_logs_for_other_workbench_returns_none_without_leaking_logs() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace.id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-widget",
            workspace_id: &workspace.id,
            workbench_id: "other-workbench",
            definition_id: "notes",
            title: "Other Notes",
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
        .expect("insert other workbench widget");
    service
        .store
        .append_widget_log(NewWidgetLog {
            id: "other-log",
            widget_instance_id: "other-widget",
            run_id: None,
            level: "info",
            message: "Other workbench activity",
            created_at: Some("1"),
            details: None,
        })
        .expect("append other widget log");

    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, "other-widget", 10)
        .expect("list widget logs");

    assert!(logs.is_none());
}
