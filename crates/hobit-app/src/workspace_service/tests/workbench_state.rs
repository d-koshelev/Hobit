use super::*;

#[test]
fn get_workbench_state_returns_none_for_missing_workspace() {
    let service = initialized_service();

    let state = service
        .get_workspace_workbench_state("missing")
        .expect("get workbench state");

    assert!(state.is_none());
}

#[test]
fn get_workbench_state_for_empty_workspace_has_empty_widgets() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(state.workspace, workspace);
    assert_eq!(
        state
            .workbench
            .as_ref()
            .map(|workbench| workbench.id.as_str()),
        state.workspace.workbench_id.as_deref()
    );
    assert!(state.widget_instances.is_empty());
    assert!(state.shared_state_objects.is_empty());
    assert_eq!(state.recent_events.len(), 1);
    assert_eq!(state.recent_events[0].kind, "workspace_created");
}

#[test]
fn get_workbench_state_includes_shared_state_and_recent_workspace_events() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    service
        .store
        .insert_shared_state_object(NewSharedStateObject {
            id: "shared-1",
            workspace_id: &workspace.id,
            key: "current_goal",
            value: "Investigate outage",
            value_kind: "text",
        })
        .expect("insert shared state");
    service
        .store
        .append_workbench_event(
            "event-1",
            &workspace.id,
            "shared_state_changed",
            "Shared state changed",
            Some("shared_state_id=shared-1"),
        )
        .expect("append event");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(
        state.shared_state_objects,
        vec![SharedStateObjectSummary {
            id: "shared-1".to_owned(),
            key: "current_goal".to_owned(),
            value: "Investigate outage".to_owned(),
            value_kind: "text".to_owned(),
        }]
    );
    assert!(state
        .recent_events
        .iter()
        .any(|event| event.kind == "shared_state_changed"));
}

#[test]
fn get_workbench_state_includes_widget_instances() {
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
        .create_workspace_workbench("zz-other-workbench", &workspace.id, None)
        .expect("create other workbench");

    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-1",
            workspace_id: &workspace.id,
            workbench_id,
            definition_id: "notes",
            title: "Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(120),
            popout_y: Some(140),
            popout_width: Some(640),
            popout_height: Some(480),
            always_on_top: true,
            is_visible: true,
            config: Some("{\"scope\":\"workspace\"}"),
            state: Some("{\"dirty\":false}"),
        })
        .expect("insert widget");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-2",
            workspace_id: &workspace.id,
            workbench_id: "zz-other-workbench",
            definition_id: "notes",
            title: "Other Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(320),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: None,
            state: None,
        })
        .expect("insert other workbench widget");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(
        state.widget_instances,
        vec![WidgetInstanceSummary {
            id: "widget-1".to_owned(),
            definition_id: "notes".to_owned(),
            title: "Notes".to_owned(),
            category: "notes".to_owned(),
            layout_mode: "docked".to_owned(),
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(120),
            popout_y: Some(140),
            popout_width: Some(640),
            popout_height: Some(480),
            always_on_top: true,
            is_visible: true,
            config: Some("{\"scope\":\"workspace\"}".to_owned()),
            state: Some("{\"dirty\":false}".to_owned()),
        }]
    );
}
