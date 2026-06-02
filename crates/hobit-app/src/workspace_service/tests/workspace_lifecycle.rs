use super::*;

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
    assert_eq!(summary.last_opened_at, None);
    assert_eq!(summary.widget_count, 0);
    assert_eq!(summary.workspace_agent_count, 0);
    assert_eq!(workbenches.len(), 1);
    assert_eq!(workbench_id, workbenches[0].id);
    assert!(widgets.is_empty());
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].kind, "workspace_created");
}

#[test]
fn workspace_summary_includes_created_opened_and_safe_stats() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");

    service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "interactive-agent",
            "Workspace Agent",
            "core",
        )
        .expect("add workspace agent");
    service
        .create_workspace_note(CreateWorkspaceNoteInput {
            workspace_id: workspace.id.clone(),
            title: "Note".to_owned(),
            body: "Stored note body is not part of workspace summaries.".to_owned(),
            pinned: false,
        })
        .expect("create note");
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Task".to_owned(),
            description: "Description stays out of summaries.".to_owned(),
            prompt: "Prompt stays out of summaries.".to_owned(),
            status: "draft".to_owned(),
            priority: 0,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task");

    service
        .open_workspace(&workspace.id)
        .expect("open workspace")
        .expect("session summary");

    let summary = service
        .get_workspace_summary(&workspace.id)
        .expect("get workspace summary")
        .expect("workspace summary");

    assert_eq!(summary.created_at, workspace.created_at);
    assert!(summary.last_opened_at.is_some());
    assert_eq!(summary.widget_count, 1);
    assert_eq!(summary.workspace_agent_count, 1);
    assert_eq!(summary.note_count, 1);
    assert_eq!(summary.queue_task_count, 1);
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
fn opening_workspace_updates_last_opened_at() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    let before_open = service
        .get_workspace_summary(&workspace.id)
        .expect("get workspace summary")
        .expect("workspace summary");
    assert_eq!(before_open.last_opened_at, None);

    service
        .open_workspace(&workspace.id)
        .expect("open workspace")
        .expect("session summary");

    let after_open = service
        .get_workspace_summary(&workspace.id)
        .expect("get workspace summary")
        .expect("workspace summary");

    assert!(after_open.last_opened_at.is_some());
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
