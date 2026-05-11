use super::*;
use std::path::PathBuf;

use hobit_tools::git::{
    GitBranchSummary as ToolsGitBranchSummary, GitFileChange as ToolsGitFileChange,
    GitFileChangeArea, GitFileChangeKind, GitRepositoryStatus as ToolsGitRepositoryStatus,
};

use crate::WorkspaceServiceError;

use std::cell::RefCell;

use hobit_storage_sqlite::{NewSharedStateObject, NewWidgetInstance, NewWidgetLog};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn create_empty_workspace_creates_workspace_and_workbench() {
    let service = initialized_service();

    let summary = service
        .create_empty_workspace("Incident", Some("Investigate".to_owned()))
        .expect("create workspace");

    let workbench_id = summary.workbench_id.as_deref().expect("workbench id");
    let workbenches = service
        .store
        .list_workspace_workbenches(&summary.id)
        .expect("list workbenches");
    let widgets = service
        .store
        .list_widget_instances(&summary.id)
        .expect("list widgets");
    let events = service
        .store
        .list_workbench_events(&summary.id)
        .expect("list events");

    assert!(summary.id.starts_with("ws_"));
    assert_eq!(summary.title, "Incident");
    assert_eq!(summary.description.as_deref(), Some("Investigate"));
    assert_eq!(summary.status, "active");
    assert_eq!(workbenches.len(), 1);
    assert_eq!(workbench_id, workbenches[0].id);
    assert!(widgets.is_empty());
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].kind, "workspace_created");
}

#[test]
fn list_workspaces_returns_created_workspace() {
    let service = initialized_service();
    let created = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    let workspaces = service.list_workspaces().expect("list workspaces");

    assert_eq!(workspaces, vec![created]);
}

#[test]
fn list_workspaces_returns_recent_workspaces_with_first_workbench_ids() {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
        .create_workspace("workspace-z-older", "Older", None, "active")
        .expect("create older workspace");
    store
        .create_workspace_workbench("workbench-a-first", "workspace-z-older", None)
        .expect("create first workbench");
    store
        .create_workspace_workbench("workbench-z-later", "workspace-z-older", None)
        .expect("create later workbench");
    store
        .create_workspace("workspace-a-newer", "Newer", None, "active")
        .expect("create newer workspace");
    store
        .create_workspace_workbench("workbench-newer", "workspace-a-newer", None)
        .expect("create newer workbench");
    let service = WorkspaceService::new(store);

    let workspaces = service.list_workspaces().expect("list workspaces");

    assert_eq!(
        workspace_ids(&workspaces),
        vec!["workspace-a-newer", "workspace-z-older"]
    );
    assert_eq!(
        workspace_workbench_ids(&workspaces),
        vec![Some("workbench-newer"), Some("workbench-a-first")]
    );
}

#[test]
fn open_workspace_moves_it_to_recent_workspaces_front() {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
        .create_workspace("workspace-z-older", "Older", None, "active")
        .expect("create older workspace");
    store
        .create_workspace_workbench("workbench-older", "workspace-z-older", None)
        .expect("create older workbench");
    store
        .create_workspace("workspace-a-newer", "Newer", None, "active")
        .expect("create newer workspace");
    store
        .create_workspace_workbench("workbench-newer", "workspace-a-newer", None)
        .expect("create newer workbench");
    let service = WorkspaceService::new(store);

    let initial_workspaces = service.list_workspaces().expect("list workspaces");
    assert_eq!(
        workspace_ids(&initial_workspaces),
        vec!["workspace-a-newer", "workspace-z-older"]
    );

    service
        .open_workspace("workspace-z-older")
        .expect("open workspace")
        .expect("session summary");

    let recent_workspaces = service.list_workspaces().expect("list workspaces");
    assert_eq!(
        workspace_ids(&recent_workspaces),
        vec!["workspace-z-older", "workspace-a-newer"]
    );
}

#[test]
fn get_workspace_summary_returns_none_for_missing_workspace() {
    let service = initialized_service();

    let summary = service
        .get_workspace_summary("missing")
        .expect("get workspace summary");

    assert!(summary.is_none());
}

#[test]
fn open_workspace_creates_workspace_session() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    let session = service
        .open_workspace(&workspace.id)
        .expect("open workspace")
        .expect("session summary");
    let stored_session = service
        .store
        .get_workspace_session(&session.id)
        .expect("get session")
        .expect("session row");
    let events = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events");

    assert!(session.id.starts_with("wss_"));
    assert_eq!(session.workspace_id, workspace.id);
    assert_eq!(session.status, "open");
    assert_eq!(session.active_widget_id, None);
    assert_eq!(stored_session.id, session.id);
    assert_eq!(stored_session.workspace_id, session.workspace_id);
    assert!(events.iter().any(|event| event.kind == "workspace_opened"));
}

#[test]
fn open_missing_workspace_returns_none() {
    let service = initialized_service();

    let session = service.open_workspace("missing").expect("open workspace");

    assert!(session.is_none());
}

#[test]
fn create_empty_workspace_rejects_empty_title() {
    let service = initialized_service();

    let error = service
        .create_empty_workspace("   ", None)
        .expect_err("reject empty title");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
}

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

#[test]
fn get_git_repository_status_for_valid_widget_reads_status_without_writes() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "git", "Git", "git")
        .expect("add Git widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let event_count = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events")
        .len();
    let log_count = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list logs")
        .expect("logs")
        .len();
    let called_path = RefCell::new(None);

    let status = service
        .get_git_repository_status_with_reader(
            &workspace.id,
            workbench_id,
            &widget_id,
            "repo-root",
            |repository_root| {
                *called_path.borrow_mut() = Some(repository_root);
                Ok(git_status_fixture())
            },
        )
        .expect("read Git status")
        .expect("Git status");

    let events_after_read = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events")
        .len();
    let logs_after_read = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 10)
        .expect("list logs")
        .expect("logs")
        .len();

    assert_eq!(called_path.into_inner(), Some(PathBuf::from("repo-root")));
    assert_eq!(
        status
            .branch
            .as_ref()
            .and_then(|branch| branch.name.as_deref()),
        Some("main")
    );
    assert_eq!(status.working_tree.staged_count, 1);
    assert!(status.working_tree.is_dirty);
    assert_eq!(status.changed_files[0].kind, "modified");
    assert_eq!(events_after_read, event_count);
    assert_eq!(logs_after_read, log_count);
}

#[test]
fn get_git_repository_status_for_other_workbench_returns_none_before_read() {
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
            id: "other-git-widget",
            workspace_id: &workspace.id,
            workbench_id: "other-workbench",
            definition_id: "git",
            title: "Git",
            category: "git",
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
        .expect("insert other workbench Git widget");

    let status = service
        .get_git_repository_status_with_reader(
            &workspace.id,
            workbench_id,
            "other-git-widget",
            "repo-root",
            |_| panic!("Git status reader should not be called"),
        )
        .expect("reject other workbench widget");

    assert!(status.is_none());
}

#[test]
fn get_git_repository_status_for_non_git_widget_returns_none_before_read() {
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
        .expect("add Notes widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();

    let status = service
        .get_git_repository_status_with_reader(
            &workspace.id,
            workbench_id,
            &widget_id,
            "repo-root",
            |_| panic!("Git status reader should not be called"),
        )
        .expect("reject non-Git widget");

    assert!(status.is_none());
}

#[test]
fn get_git_repository_status_rejects_empty_repository_root() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "git", "Git", "git")
        .expect("add Git widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();

    let error = service
        .get_git_repository_status(&workspace.id, workbench_id, &widget_id, "  ")
        .expect_err("reject empty repository root");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
}

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

#[test]
fn create_widget_run_for_owned_widget_persists_running_run() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "terminal",
            "Terminal",
            "tool",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();

    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: Some("{\"kind\":\"dry\"}".to_owned()),
                summary: Some("Preview lifecycle only".to_owned()),
            },
        )
        .expect("create widget run")
        .expect("widget run");
    let stored_runs = service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("list widget runs");

    assert!(run.id.starts_with("wrun_"));
    assert_eq!(run.widget_instance_id, widget_id);
    assert_eq!(run.status, "running");
    assert_eq!(run.command_kind.as_deref(), Some("preview"));
    assert_eq!(run.command_payload.as_deref(), Some("{\"kind\":\"dry\"}"));
    assert_eq!(run.summary.as_deref(), Some("Preview lifecycle only"));
    assert_eq!(run.finished_at, None);
    assert_eq!(stored_runs.len(), 1);
    assert_eq!(stored_runs[0].id, run.id);
}

#[test]
fn widget_run_lifecycle_rejects_unowned_widget_or_run_without_mutation() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "terminal",
            "Terminal",
            "tool",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
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
            definition_id: "terminal",
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
        .expect("insert other widget");
    let other_run = service
        .create_widget_run(
            &workspace.id,
            "other-workbench",
            "other-widget",
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("create other run")
        .expect("other run");

    let invalid_create = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            "other-widget",
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("reject create");
    let invalid_log = service
        .append_widget_run_log(
            &workspace.id,
            workbench_id,
            &widget_id,
            &other_run.id,
            "info",
            "Should not leak",
            Some("{\"leak\":true}".to_owned()),
        )
        .expect("reject append log");
    let invalid_finish = service
        .finish_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            &other_run.id,
            WidgetRunStatus::Completed,
            Some("Should not finish".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("test".to_owned()),
                summary: Some("Leaked result".to_owned()),
                content: None,
                payload: None,
            }),
        )
        .expect("reject finish");
    let other_runs = service
        .store
        .list_widget_runs_for_widget("other-widget")
        .expect("list other runs");
    let widget_logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list widget logs")
        .expect("widget logs");
    let other_logs = service
        .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 20)
        .expect("list other logs")
        .expect("other logs");
    let other_results = service
        .store
        .list_widget_results(&other_run.id)
        .expect("list other results");
    let stored_other_run = service
        .store
        .get_widget_run(&other_run.id)
        .expect("get other run")
        .expect("other run row");

    assert!(invalid_create.is_none());
    assert!(invalid_log.is_none());
    assert!(invalid_finish.is_none());
    assert_eq!(other_runs.len(), 1);
    assert_eq!(other_runs[0].id, other_run.id);
    assert_eq!(
        widget_log_messages(&widget_logs),
        vec![WIDGET_LOG_WIDGET_ADDED]
    );
    assert!(other_logs.is_empty());
    assert!(other_results.is_empty());
    assert_eq!(stored_other_run.status, "running");
    assert_eq!(stored_other_run.finished_at, None);
}

#[test]
fn append_widget_run_log_persists_run_scoped_widget_log() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "terminal",
            "Terminal",
            "tool",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("create run")
        .expect("run");

    let log = service
        .append_widget_run_log(
            &workspace.id,
            workbench_id,
            &widget_id,
            &run.id,
            "info",
            "Run lifecycle recorded",
            Some("{\"phase\":\"running\"}".to_owned()),
        )
        .expect("append run log")
        .expect("run log");
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("logs");

    assert!(log.id.starts_with("wlog_"));
    assert_eq!(log.widget_instance_id, widget_id);
    assert_eq!(log.run_id.as_deref(), Some(run.id.as_str()));
    assert_eq!(log.level, "info");
    assert_eq!(log.message, "Run lifecycle recorded");
    assert_eq!(log.payload.as_deref(), Some("{\"phase\":\"running\"}"));
    assert!(logs.iter().any(|saved| saved.id == log.id));
}

#[test]
fn finish_widget_run_persists_final_status_and_structured_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-run",
            "Agent Monitoring",
            "agent",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("executor_preview".to_owned()),
                command_payload: Some("{\"block\":108}".to_owned()),
                summary: None,
            },
        )
        .expect("create run")
        .expect("run");

    let finished = service
        .finish_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            &run.id,
            WidgetRunStatus::Completed,
            Some("Lifecycle completed".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("result_report".to_owned()),
                summary: Some("Result ready".to_owned()),
                content: Some("No runtime was executed.".to_owned()),
                payload: Some("{\"ok\":true}".to_owned()),
            }),
        )
        .expect("finish run")
        .expect("finished run");
    let read_back = service
        .get_widget_run(&workspace.id, workbench_id, &widget_id, &run.id)
        .expect("read run")
        .expect("run read model");

    assert_eq!(finished.run.id, run.id);
    assert_eq!(finished.run.status, "completed");
    assert!(finished.run.finished_at.is_some());
    assert_eq!(finished.run.summary.as_deref(), Some("Lifecycle completed"));
    assert_eq!(finished.results.len(), 1);
    assert!(finished.results[0].id.starts_with("wres_"));
    assert_eq!(finished.results[0].run_id, run.id);
    assert_eq!(finished.results[0].status, "completed");
    assert_eq!(finished.results[0].result_type, "result_report");
    assert_eq!(finished.results[0].summary.as_deref(), Some("Result ready"));
    assert_eq!(
        finished.results[0].content.as_deref(),
        Some("No runtime was executed.")
    );
    assert_eq!(read_back, finished);
}

#[test]
fn finish_widget_run_rejects_non_final_status_without_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-run",
            "Agent Monitoring",
            "agent",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("executor_preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("create run")
        .expect("run");

    let error = service
        .finish_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            &run.id,
            WidgetRunStatus::Running,
            Some("Should not finish".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("result_report".to_owned()),
                summary: Some("Should not persist".to_owned()),
                content: None,
                payload: None,
            }),
        )
        .expect_err("reject non-final status");
    let stored_run = service
        .store
        .get_widget_run(&run.id)
        .expect("get run")
        .expect("run row");
    let results = service
        .store
        .list_widget_results(&run.id)
        .expect("list results");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    assert_eq!(stored_run.status, "running");
    assert_eq!(stored_run.finished_at, None);
    assert!(results.is_empty());
}

fn docked_layout() -> WidgetInstanceLayout {
    WidgetInstanceLayout {
        layout_mode: "docked".to_owned(),
        dock_x: Some(12),
        dock_y: Some(24),
        dock_width: Some(480),
        dock_height: Some(320),
        popout_x: None,
        popout_y: None,
        popout_width: None,
        popout_height: None,
        always_on_top: false,
        is_visible: true,
    }
}

fn popped_out_layout() -> WidgetInstanceLayout {
    WidgetInstanceLayout {
        layout_mode: "popped_out".to_owned(),
        dock_x: Some(12),
        dock_y: Some(24),
        dock_width: Some(480),
        dock_height: Some(320),
        popout_x: Some(120),
        popout_y: Some(140),
        popout_width: Some(720),
        popout_height: Some(520),
        always_on_top: true,
        is_visible: true,
    }
}

fn git_status_fixture() -> ToolsGitRepositoryStatus {
    ToolsGitRepositoryStatus::from_changed_files(
        Some(ToolsGitBranchSummary {
            name: Some("main".to_owned()),
            upstream: Some("origin/main".to_owned()),
            ahead: Some(1),
            behind: None,
            is_detached: false,
        }),
        vec![ToolsGitFileChange {
            area: GitFileChangeArea::Staged,
            kind: GitFileChangeKind::Modified,
            path: "src/lib.rs".to_owned(),
            original_path: None,
        }],
        Vec::new(),
    )
}

fn workspace_ids(workspaces: &[WorkspaceSummary]) -> Vec<&str> {
    workspaces
        .iter()
        .map(|workspace| workspace.id.as_str())
        .collect()
}

fn workspace_workbench_ids(workspaces: &[WorkspaceSummary]) -> Vec<Option<&str>> {
    workspaces
        .iter()
        .map(|workspace| workspace.workbench_id.as_deref())
        .collect()
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}
