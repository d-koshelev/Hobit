use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn run_codex_direct_work_blocking_rejects_missing_workspace_without_process_run() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = run_codex_direct_work_blocking(
        RunCodexDirectWorkRequest {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            codex_executable: "codex".to_owned(),
            repo_root: ".".to_owned(),
            operator_prompt: "Return exactly: test".to_owned(),
            sandbox: "read_only".to_owned(),
            approval_policy: "never".to_owned(),
            timeout_ms: Some(1),
            stdout_cap_bytes: Some(1),
            stderr_cap_bytes: Some(1),
        },
        db_path.clone(),
    )
    .expect("direct work command helper should return cleanly");

    assert!(response.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn start_codex_direct_work_stream_blocking_rejects_missing_workspace_without_process_run() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = start_codex_direct_work_stream_blocking(
        hobit_app::RunCodexDirectWorkInput {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            codex_executable: "codex".to_owned(),
            repo_root: ".".into(),
            operator_prompt: "Return exactly: test".to_owned(),
            sandbox: "read_only".to_owned(),
            approval_policy: "never".to_owned(),
            timeout_ms: Some(1),
            stdout_cap_bytes: Some(1),
            stderr_cap_bytes: Some(1),
        },
        db_path.clone(),
    )
    .expect("direct work stream command helper should return cleanly");

    assert!(response.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn run_direct_work_validation_blocking_rejects_missing_workspace_without_process_run() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = run_direct_work_validation_blocking(
        RunDirectWorkValidationRequest {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            repo_root: ".".to_owned(),
            validation_profile: "fast".to_owned(),
            timeout_ms: Some(1),
            stdout_cap_bytes: Some(1),
            stderr_cap_bytes: Some(1),
        },
        db_path.clone(),
    )
    .expect("direct work validation command helper should return cleanly");

    assert!(response.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn get_agent_executor_diff_summary_blocking_rejects_missing_workspace_without_git_read() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = get_agent_executor_diff_summary_blocking(
        GetAgentExecutorDiffSummaryRequest {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            repo_root: ".".to_owned(),
            max_files: Some(10),
            max_patch_bytes_per_file: Some(100),
            include_patch_preview: Some(false),
        },
        db_path.clone(),
    )
    .expect("diff summary command helper should return cleanly");

    assert!(response.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn create_git_commit_blocking_rejects_missing_workspace_without_git_mutation() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = create_git_commit_blocking(
        CreateGitCommitRequest {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            repo_root: ".".to_owned(),
            commit_message: "Commit message".to_owned(),
            included_files: vec!["src/lib.rs".to_owned()],
        },
        db_path.clone(),
    )
    .expect("commit command helper should return cleanly");

    assert!(response.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn cancel_codex_direct_work_run_blocking_returns_not_found_for_missing_workspace() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let response = cancel_codex_direct_work_run_blocking(
        CancelCodexDirectWorkRunRequest {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            run_id: "missing-run".to_owned(),
        },
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect("direct work cancellation helper should return cleanly");

    assert_eq!(response.status, "not_found");
    assert!(!response.cancellation_requested);
    remove_test_db_files(&db_path);
}

#[test]
fn delete_widget_instance_from_workbench_blocking_returns_refreshed_state() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) = create_widget_in_test_db(&db_path);

    let response = delete_widget_instance_from_workbench_blocking(
        DeleteWidgetInstanceFromWorkbenchRequest {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id.clone(),
        },
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect("delete widget command helper")
    .expect("refreshed state");

    assert!(!response
        .widget_instances
        .iter()
        .any(|widget| widget.id == widget_id));
    assert!(response
        .recent_events
        .iter()
        .any(|event| event.kind == "widget_instance_deleted"));
    remove_test_db_files(&db_path);
}

#[test]
fn delete_widget_instance_from_workbench_blocking_rejects_active_direct_work_widget() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) = create_widget_in_test_db(&db_path);
    let active_runs = DirectWorkActiveRunRegistry::default();
    active_runs.register(DirectWorkActiveRun::new(
        "run_1".to_owned(),
        workspace_id.clone(),
        workbench_id.clone(),
        widget_id.clone(),
        hobit_app::CodexDirectStreamCancellationToken::new(),
    ));

    let error = delete_widget_instance_from_workbench_blocking(
        DeleteWidgetInstanceFromWorkbenchRequest {
            workspace_id,
            workbench_id,
            widget_instance_id: widget_id,
        },
        db_path.clone(),
        active_runs,
    )
    .expect_err("active run blocks delete");

    assert!(error.contains("Direct Work run is active"));
    remove_test_db_files(&db_path);
}

#[test]
fn delete_workspace_blocking_returns_remaining_workspaces() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let deleted_workspace = service
        .create_empty_workspace("Delete workspace test", None)
        .expect("create deleted workspace");
    let kept_workspace = service
        .create_empty_workspace("Keep workspace test", None)
        .expect("create kept workspace");
    drop(service);

    let response = delete_workspace_blocking(
        DeleteWorkspaceRequest {
            workspace_id: deleted_workspace.id.clone(),
        },
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect("delete workspace command helper");

    assert_eq!(response.deleted_workspace_id, deleted_workspace.id);
    assert!(response.deleted);
    assert!(!response
        .remaining_workspaces
        .iter()
        .any(|workspace| workspace.id == response.deleted_workspace_id));
    assert!(response
        .remaining_workspaces
        .iter()
        .any(|workspace| workspace.id == kept_workspace.id));

    let store = SqliteStore::open(&db_path).expect("reopen sqlite test store");
    assert!(store
        .get_workspace(&response.deleted_workspace_id)
        .expect("get deleted workspace")
        .is_none());
    assert!(store
        .get_workspace(&kept_workspace.id)
        .expect("get kept workspace")
        .is_some());
    remove_test_db_files(&db_path);
}

#[test]
fn delete_workspace_blocking_rejects_active_direct_work_run() {
    let db_path = unique_test_db_path();
    let (workspace_id, workbench_id, widget_id) = create_widget_in_test_db(&db_path);
    let active_runs = DirectWorkActiveRunRegistry::default();
    active_runs.register(DirectWorkActiveRun::new(
        "run_1".to_owned(),
        workspace_id.clone(),
        workbench_id,
        widget_id,
        hobit_app::CodexDirectStreamCancellationToken::new(),
    ));

    let error = delete_workspace_blocking(
        DeleteWorkspaceRequest {
            workspace_id: workspace_id.clone(),
        },
        db_path.clone(),
        active_runs,
    )
    .expect_err("active run blocks workspace delete");

    assert!(error.contains("active Direct Work run"));
    let store = SqliteStore::open(&db_path).expect("reopen sqlite test store");
    assert!(store
        .get_workspace(&workspace_id)
        .expect("get preserved workspace")
        .is_some());
    remove_test_db_files(&db_path);
}

fn create_widget_in_test_db(db_path: &Path) -> (String, String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Delete widget test", None)
        .expect("create workspace");
    let workspace_id = workspace.id;
    let workbench_id = workspace.workbench_id.expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(
            &workspace_id,
            &workbench_id,
            "agent-run",
            "Direct Work / Codex",
            "workflow",
        )
        .expect("add widget")
        .expect("updated state");
    let widget_id = state.widget_instances[0].id.clone();
    drop(service);

    (workspace_id, workbench_id, widget_id)
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-workspace-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
