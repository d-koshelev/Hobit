use super::*;

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
