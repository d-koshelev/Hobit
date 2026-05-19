use super::*;

#[test]
fn add_widget_instance_to_workbench_persists_widget_and_returns_updated_state() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");

    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add widget instance")
        .expect("updated workbench state");
    let stored_widgets = service
        .store
        .list_widget_instances_for_workbench(workbench_id)
        .expect("list stored widgets");
    let widget_id = stored_widgets[0].id.clone();
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list widget logs")
        .expect("widget logs");

    assert_eq!(stored_widgets.len(), 1);
    assert_eq!(
        state.widget_instances,
        vec![WidgetInstanceSummary {
            id: widget_id.clone(),
            definition_id: "notes".to_owned(),
            title: "Notes".to_owned(),
            category: "notes".to_owned(),
            layout_mode: "docked".to_owned(),
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
            config: Some("{}".to_owned()),
            state: Some("{}".to_owned()),
        }]
    );
    assert!(stored_widgets[0].id.starts_with("wid_"));
    assert_eq!(widget_log_messages(&logs), vec![WIDGET_LOG_WIDGET_ADDED]);
    assert_eq!(logs[0].widget_instance_id, widget_id);
    assert_eq!(logs[0].level, WIDGET_LOG_INFO_LEVEL);
    assert_eq!(logs[0].run_id, None);
    assert_eq!(logs[0].payload, None);
    assert!(state
        .recent_events
        .iter()
        .any(|event| event.kind == "widget_instance_added"));
}

#[test]
fn add_widget_instance_to_unowned_workbench_returns_none() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let other_workspace = service
        .create_empty_workspace("Other Incident", None)
        .expect("create other workspace");
    let other_workbench_id = other_workspace
        .workbench_id
        .as_deref()
        .expect("other workbench id");

    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            other_workbench_id,
            "notes",
            "Notes",
            "notes",
        )
        .expect("add widget instance");
    let other_widgets = service
        .store
        .list_widget_instances_for_workbench(other_workbench_id)
        .expect("list other workbench widgets");

    assert!(state.is_none());
    assert!(other_widgets.is_empty());
}

#[test]
fn add_widget_instance_rejects_empty_definition_id() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");

    let error = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "  ", "Notes", "notes")
        .expect_err("reject empty definition id");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
}

#[test]
fn update_widget_instance_state_persists_state_and_returns_updated_state() {
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

    let updated_state = service
        .update_widget_instance_state(
            &workspace.id,
            workbench_id,
            &widget_id,
            "{\"body\":\"Draft\"}",
        )
        .expect("update widget state")
        .expect("updated workbench state");
    let stored_widget = service
        .store
        .get_widget_instance(&widget_id)
        .expect("get stored widget")
        .expect("stored widget");

    assert_eq!(stored_widget.state.as_deref(), Some("{\"body\":\"Draft\"}"));
    assert_eq!(
        updated_state.widget_instances[0].state.as_deref(),
        Some("{\"body\":\"Draft\"}")
    );
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list widget logs")
        .expect("widget logs");
    let messages = widget_log_messages(&logs);

    assert_eq!(logs.len(), 2);
    assert!(messages.contains(&WIDGET_LOG_WIDGET_ADDED));
    assert!(messages.contains(&WIDGET_LOG_STATE_SAVED));
    assert!(updated_state
        .recent_events
        .iter()
        .any(|event| event.kind == "widget_state_updated"));
}

#[test]
fn update_widget_instance_state_for_other_workbench_returns_none_without_mutation() {
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
            state: Some("{\"body\":\"Original\"}"),
        })
        .expect("insert other workbench widget");

    let state = service
        .update_widget_instance_state(
            &workspace.id,
            workbench_id,
            "other-widget",
            "{\"body\":\"Changed\"}",
        )
        .expect("update widget state");
    let stored_widget = service
        .store
        .get_widget_instance("other-widget")
        .expect("get stored widget")
        .expect("stored widget");
    let logs = service
        .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 10)
        .expect("list widget logs")
        .expect("widget logs");

    assert!(state.is_none());
    assert_eq!(
        stored_widget.state.as_deref(),
        Some("{\"body\":\"Original\"}")
    );
    assert!(logs.is_empty());
}

#[test]
fn update_widget_instance_state_rejects_invalid_json_state() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");

    let error = service
        .update_widget_instance_state(&workspace.id, workbench_id, "widget-1", "{bad")
        .expect_err("reject invalid JSON");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
}

#[test]
fn update_widget_instance_layout_persists_layout_and_returns_updated_state() {
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

    let updated_state = service
        .update_widget_instance_layout(&workspace.id, workbench_id, &widget_id, popped_out_layout())
        .expect("update widget layout")
        .expect("updated workbench state");
    let stored_widget = service
        .store
        .get_widget_instance(&widget_id)
        .expect("get stored widget")
        .expect("stored widget");

    assert_eq!(stored_widget.layout_mode, "popped_out");
    assert_eq!(stored_widget.dock_x, Some(12));
    assert_eq!(stored_widget.dock_y, Some(24));
    assert_eq!(stored_widget.dock_width, Some(480));
    assert_eq!(stored_widget.dock_height, Some(320));
    assert_eq!(stored_widget.popout_x, Some(120));
    assert_eq!(stored_widget.popout_y, Some(140));
    assert_eq!(stored_widget.popout_width, Some(720));
    assert_eq!(stored_widget.popout_height, Some(520));
    assert!(stored_widget.always_on_top);
    assert!(stored_widget.is_visible);
    assert_eq!(updated_state.widget_instances[0].layout_mode, "popped_out");
    assert_eq!(updated_state.widget_instances[0].popout_width, Some(720));
    assert!(updated_state.widget_instances[0].always_on_top);
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list widget logs")
        .expect("widget logs");
    let messages = widget_log_messages(&logs);

    assert_eq!(logs.len(), 2);
    assert!(messages.contains(&WIDGET_LOG_WIDGET_ADDED));
    assert!(messages.contains(&WIDGET_LOG_LAYOUT_UPDATED));
    assert!(updated_state
        .recent_events
        .iter()
        .any(|event| event.kind == "widget_layout_updated"));
}

#[test]
fn update_widget_instance_layout_for_other_workbench_returns_none_without_mutation() {
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

    let state = service
        .update_widget_instance_layout(
            &workspace.id,
            workbench_id,
            "other-widget",
            popped_out_layout(),
        )
        .expect("update widget layout");
    let stored_widget = service
        .store
        .get_widget_instance("other-widget")
        .expect("get stored widget")
        .expect("stored widget");
    let events = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events");
    let logs = service
        .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 10)
        .expect("list widget logs")
        .expect("widget logs");

    assert!(state.is_none());
    assert_eq!(stored_widget.layout_mode, "docked");
    assert_eq!(stored_widget.dock_width, Some(360));
    assert_eq!(stored_widget.popout_width, None);
    assert!(!stored_widget.always_on_top);
    assert!(!events
        .iter()
        .any(|event| event.kind == "widget_layout_updated"));
    assert!(logs.is_empty());
}

#[test]
fn update_widget_instance_layout_rejects_invalid_dimensions() {
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
    let mut invalid_layout = docked_layout();
    invalid_layout.dock_width = Some(0);

    let error = service
        .update_widget_instance_layout(&workspace.id, workbench_id, &widget_id, invalid_layout)
        .expect_err("reject invalid dimensions");
    let stored_widget = service
        .store
        .get_widget_instance(&widget_id)
        .expect("get stored widget")
        .expect("stored widget");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    let mut oversized_layout = docked_layout();
    oversized_layout.dock_height = Some(MAX_WIDGET_LAYOUT_DIMENSION + 1);
    let oversized_error = service
        .update_widget_instance_layout(&workspace.id, workbench_id, &widget_id, oversized_layout)
        .expect_err("reject oversized dimensions");

    assert!(matches!(
        oversized_error,
        WorkspaceServiceError::InvalidInput(_)
    ));
    assert_eq!(stored_widget.layout_mode, "docked");
    assert_eq!(stored_widget.dock_width, Some(360));
    assert_eq!(stored_widget.dock_height, Some(240));
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list widget logs")
        .expect("widget logs");

    assert_eq!(widget_log_messages(&logs), vec![WIDGET_LOG_WIDGET_ADDED]);
}
