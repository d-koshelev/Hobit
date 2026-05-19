use super::*;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn terminal_pty_owner_validation_accepts_terminal_widget() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("PTY", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            TERMINAL_WIDGET_DEFINITION_ID,
            "Terminal",
            "tool",
        )
        .expect("add terminal")
        .expect("state");
    let widget_id = &state.widget_instances[0].id;

    assert!(service
        .validate_terminal_pty_widget_owner(&workspace.id, workbench_id, widget_id)
        .expect("validate owner"));
}

#[test]
fn terminal_pty_owner_validation_rejects_non_terminal_widget() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("PTY", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes")
        .expect("state");
    let widget_id = &state.widget_instances[0].id;

    assert!(!service
        .validate_terminal_pty_widget_owner(&workspace.id, workbench_id, widget_id)
        .expect("validate owner"));
}

#[test]
fn terminal_pty_owner_validation_rejects_cross_workbench_widget() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("PTY", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace.id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-terminal",
            workspace_id: &workspace.id,
            workbench_id: "other-workbench",
            definition_id: TERMINAL_WIDGET_DEFINITION_ID,
            title: "Other Terminal",
            category: "tool",
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
        .expect("insert other terminal");

    assert!(!service
        .validate_terminal_pty_widget_owner(&workspace.id, workbench_id, "other-terminal")
        .expect("validate owner"));
}
