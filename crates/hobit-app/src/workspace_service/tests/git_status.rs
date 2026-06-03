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
fn get_workspace_git_status_reads_status_without_git_widget_instance() {
    let service = initialized_service();
    let called_path = RefCell::new(None);

    let status = service
        .get_workspace_git_status_with_reader("repo-root", |repository_root| {
            *called_path.borrow_mut() = Some(repository_root);
            Ok(git_status_fixture())
        })
        .expect("read workspace Git status");

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
    assert_eq!(status.changed_files[0].path, "src/lib.rs");
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
fn get_git_file_diff_for_valid_git_widget_reads_without_writes() {
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
    let called_request = RefCell::new(None);

    let diff = service
        .get_git_file_diff_with_reader(
            &workspace.id,
            workbench_id,
            &widget_id,
            "repo-root",
            "src/lib.rs",
            Some(2048),
            |request| {
                *called_request.borrow_mut() = Some(request);
                Ok(hobit_tools::git_diff::GitFileDiffResult {
                    repo_root: "repo-root".to_owned(),
                    path: "src/lib.rs".to_owned(),
                    status: hobit_tools::git_diff::GitFileDiffStatus::Available,
                    patch: Some("diff --git a/src/lib.rs b/src/lib.rs".to_owned()),
                    patch_truncated: false,
                    error_message: None,
                    command_summary: vec![hobit_tools::git_diff::GitDiffCommandSummary {
                        program: "git".to_owned(),
                        args: vec![
                            "-C".to_owned(),
                            "repo-root".to_owned(),
                            "diff".to_owned(),
                            "--".to_owned(),
                            "src/lib.rs".to_owned(),
                        ],
                    }],
                })
            },
        )
        .expect("read file diff")
        .expect("file diff");
    let events_after_read = service
        .store
        .list_workbench_events(&workspace.id)
        .expect("list events")
        .len();
    let request = called_request.into_inner().expect("request seen");

    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.path, "src/lib.rs");
    assert_eq!(request.max_patch_bytes, Some(2048));
    assert_eq!(diff.status, "available");
    assert_eq!(diff.path, "src/lib.rs");
    assert!(diff
        .patch
        .as_deref()
        .is_some_and(|patch| patch.contains("diff --git")));
    assert_eq!(events_after_read, event_count);
}

#[test]
fn get_workspace_git_diff_summary_reads_without_git_widget_instance() {
    let service = initialized_service();
    let called_request = RefCell::new(None);

    let summary = service
        .get_workspace_git_diff_summary_with_reader(
            "repo-root",
            Some(25),
            Some(4096),
            Some(false),
            |request| {
                *called_request.borrow_mut() = Some(request);
                Ok(hobit_tools::git_diff::GitDiffSummary {
                    repo_root: "repo-root".to_owned(),
                    status: hobit_tools::git_diff::GitDiffSummaryStatus::Dirty,
                    files: vec![hobit_tools::git_diff::GitDiffFileSummary {
                        path: "src/lib.rs".to_owned(),
                        status: hobit_tools::git_diff::GitDiffFileStatus::Modified,
                        staged: false,
                        unstaged: true,
                        untracked: false,
                        conflicted: false,
                        additions: Some(3),
                        deletions: Some(1),
                        patch_preview: None,
                        patch_truncated: false,
                    }],
                    summary: hobit_tools::git_diff::GitDiffTotals {
                        total_files: 1,
                        staged_count: 0,
                        unstaged_count: 1,
                        untracked_count: 0,
                        conflicted_count: 0,
                        total_additions: Some(3),
                        total_deletions: Some(1),
                    },
                    error_message: None,
                    command_summary: vec![hobit_tools::git_diff::GitDiffCommandSummary {
                        program: "git".to_owned(),
                        args: vec!["-C".to_owned(), "repo-root".to_owned(), "status".to_owned()],
                    }],
                })
            },
        )
        .expect("read workspace Git diff summary");
    let request = called_request.into_inner().expect("request seen");

    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.max_files, Some(25));
    assert_eq!(request.max_patch_bytes_per_file, Some(4096));
    assert!(!request.include_patch_preview);
    assert_eq!(summary.status, "dirty");
    assert_eq!(summary.files[0].path, "src/lib.rs");
}

#[test]
fn get_workspace_git_file_diff_reads_without_git_widget_instance() {
    let service = initialized_service();
    let called_request = RefCell::new(None);

    let diff = service
        .get_workspace_git_file_diff_with_reader("repo-root", "src/lib.rs", Some(2048), |request| {
            *called_request.borrow_mut() = Some(request);
            Ok(hobit_tools::git_diff::GitFileDiffResult {
                repo_root: "repo-root".to_owned(),
                path: "src/lib.rs".to_owned(),
                status: hobit_tools::git_diff::GitFileDiffStatus::Available,
                patch: Some("diff --git a/src/lib.rs b/src/lib.rs".to_owned()),
                patch_truncated: false,
                error_message: None,
                command_summary: vec![hobit_tools::git_diff::GitDiffCommandSummary {
                    program: "git".to_owned(),
                    args: vec![
                        "-C".to_owned(),
                        "repo-root".to_owned(),
                        "diff".to_owned(),
                        "--".to_owned(),
                        "src/lib.rs".to_owned(),
                    ],
                }],
            })
        })
        .expect("read workspace Git file diff");
    let request = called_request.into_inner().expect("request seen");

    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.path, "src/lib.rs");
    assert_eq!(request.max_patch_bytes, Some(2048));
    assert_eq!(diff.status, "available");
}

#[test]
fn get_git_log_for_valid_git_widget_reads_without_writes() {
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
    let called_request = RefCell::new(None);

    let log = service
        .get_git_log_with_reader(
            &workspace.id,
            workbench_id,
            &widget_id,
            "repo-root",
            Some(30),
            |request| {
                *called_request.borrow_mut() = Some(request);
                Ok(hobit_tools::git_diff::GitLogResult {
                    repo_root: "repo-root".to_owned(),
                    entries: vec![hobit_tools::git_diff::GitLogEntry {
                        hash: "abcdef123456".to_owned(),
                        short_hash: "abcdef1".to_owned(),
                        subject: "initial".to_owned(),
                        author: "Hobit".to_owned(),
                        date: "2026-05-27T10:00:00Z".to_owned(),
                    }],
                    command_summary: vec![hobit_tools::git_diff::GitDiffCommandSummary {
                        program: "git".to_owned(),
                        args: vec!["-C".to_owned(), "repo-root".to_owned(), "log".to_owned()],
                    }],
                })
            },
        )
        .expect("read git log")
        .expect("git log");
    let request = called_request.into_inner().expect("request seen");

    assert_eq!(request.repo_root, PathBuf::from("repo-root"));
    assert_eq!(request.limit, Some(30));
    assert_eq!(log.entries[0].short_hash, "abcdef1");
    assert_eq!(log.entries[0].subject, "initial");
    assert_eq!(log.command_summary[0].program, "git");
}
