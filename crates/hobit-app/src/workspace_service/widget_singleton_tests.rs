use super::*;

use crate::WorkspaceServiceError;
use hobit_storage_sqlite::NewWidgetInstance;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn add_agent_queue_widget_rejects_duplicate_without_leaking_instance() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");

    let state_after_first = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-queue",
            "Agent Queue",
            "workflow",
        )
        .expect("add first Agent Queue")
        .expect("state after first Agent Queue");
    let duplicate_error = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-queue",
            "Agent Queue",
            "workflow",
        )
        .expect_err("reject duplicate Agent Queue");
    let stored_widgets = service
        .store
        .list_widget_instances(&workspace.id)
        .expect("list workspace widgets");
    let widget_added_events = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events")
        .into_iter()
        .filter(|event| event.kind == "widget_instance_added")
        .count();

    assert_agent_queue_duplicate_error(duplicate_error);
    assert_eq!(state_after_first.widget_instances.len(), 1);
    assert_eq!(
        state_after_first.widget_instances[0].definition_id,
        "agent-queue"
    );
    assert_eq!(stored_widgets.len(), 1);
    assert_eq!(stored_widgets[0].definition_id, "agent-queue");
    assert_eq!(widget_added_events, 1);
}

#[test]
fn add_agent_queue_widget_is_workspace_scoped_and_allows_other_widgets() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let other_workspace = service
        .create_empty_workspace("Other Incident", None)
        .expect("create other workspace");
    let other_workspace_workbench_id = other_workspace
        .workbench_id
        .as_deref()
        .expect("other workspace workbench id");

    service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-queue",
            "Agent Queue",
            "workflow",
        )
        .expect("add first Agent Queue")
        .expect("state after Agent Queue");
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace.id, None)
        .expect("create second workbench in same workspace");

    let same_workspace_error = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            "other-workbench",
            "agent-queue",
            "Agent Queue",
            "workflow",
        )
        .expect_err("reject Agent Queue in second workbench");
    assert_agent_queue_duplicate_error(same_workspace_error);

    let state_after_notes = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            "other-workbench",
            "notes",
            "Notes",
            "notes",
        )
        .expect("add non-queue widget")
        .expect("state after non-queue widget");
    let other_workspace_state = service
        .add_widget_instance_to_workbench(
            &other_workspace.id,
            other_workspace_workbench_id,
            "agent-queue",
            "Agent Queue",
            "workflow",
        )
        .expect("add Agent Queue in other workspace")
        .expect("other workspace state");
    let workspace_widgets = service
        .store
        .list_widget_instances(&workspace.id)
        .expect("list first workspace widgets");
    let other_workspace_widgets = service
        .store
        .list_widget_instances(&other_workspace.id)
        .expect("list other workspace widgets");

    assert_eq!(state_after_notes.widget_instances.len(), 1);
    assert_eq!(state_after_notes.widget_instances[0].definition_id, "notes");
    assert_eq!(workspace_widgets.len(), 2);
    assert_eq!(
        workspace_widgets
            .iter()
            .filter(|widget| widget.definition_id == "agent-queue")
            .count(),
        1
    );
    assert_eq!(other_workspace_state.widget_instances.len(), 1);
    assert_eq!(
        other_workspace_state.widget_instances[0].definition_id,
        "agent-queue"
    );
    assert_eq!(other_workspace_widgets.len(), 1);
}

#[test]
fn add_agent_queue_widget_preserves_existing_duplicates_when_rejecting_more() {
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
        .insert_widget_instance(NewWidgetInstance {
            id: "queue-widget-1",
            workspace_id: &workspace.id,
            workbench_id,
            definition_id: "agent-queue",
            title: "Agent Queue",
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
        .expect("insert first legacy duplicate");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "queue-widget-2",
            workspace_id: &workspace.id,
            workbench_id,
            definition_id: "agent-queue",
            title: "Agent Queue",
            category: "workflow",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(256),
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
        .expect("insert second legacy duplicate");

    let error = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-queue",
            "Agent Queue",
            "workflow",
        )
        .expect_err("reject another Agent Queue");
    let stored_widgets = service
        .store
        .list_widget_instances(&workspace.id)
        .expect("list workspace widgets");

    assert_agent_queue_duplicate_error(error);
    assert_eq!(stored_widgets.len(), 2);
    assert!(stored_widgets
        .iter()
        .all(|widget| widget.definition_id == "agent-queue"));
}

fn assert_agent_queue_duplicate_error(error: WorkspaceServiceError) {
    match error {
        WorkspaceServiceError::InvalidInput(message) => {
            assert_eq!(message, "Agent Queue already exists in this workspace.");
        }
        other => panic!("unexpected error: {other}"),
    }
}
