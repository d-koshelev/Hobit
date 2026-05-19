use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn create_terminal_pty_session_rejects_missing_workspace_without_session() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let sessions = TerminalPtySessionRegistry::default();
    let response = create_terminal_pty_session_blocking(
        CreateTerminalPtySessionRequest {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: "missing-widget".to_owned(),
            shell: "powershell.exe".to_owned(),
            shell_args: Vec::new(),
            working_directory: std::env::current_dir()
                .expect("current dir")
                .display()
                .to_string(),
            cols: Some(80),
            rows: Some(24),
            output_buffer_cap_bytes: Some(1024),
        },
        db_path.clone(),
        sessions.clone(),
    )
    .expect("create command helper should return cleanly");

    assert!(response.is_none());
    assert!(sessions
        .list_sessions(crate::terminal_pty::TerminalPtySessionFilter {
            workspace_id: "missing-workspace".to_owned(),
            workbench_id: "missing-workbench".to_owned(),
            widget_instance_id: None,
        })
        .is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn create_terminal_pty_session_rejects_non_terminal_widget_without_session() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("PTY command", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes")
        .expect("state");
    let widget_id = state.widget_instances[0].id.clone();
    drop(service);

    let sessions = TerminalPtySessionRegistry::default();
    let response = create_terminal_pty_session_blocking(
        CreateTerminalPtySessionRequest {
            workspace_id: workspace.id.clone(),
            workbench_id: workbench_id.to_owned(),
            widget_instance_id: widget_id,
            shell: "powershell.exe".to_owned(),
            shell_args: Vec::new(),
            working_directory: std::env::current_dir()
                .expect("current dir")
                .display()
                .to_string(),
            cols: Some(80),
            rows: Some(24),
            output_buffer_cap_bytes: Some(1024),
        },
        db_path.clone(),
        sessions.clone(),
    )
    .expect("create command helper should return cleanly");

    assert!(response.is_none());
    assert!(sessions
        .list_sessions(crate::terminal_pty::TerminalPtySessionFilter {
            workspace_id: workspace.id,
            workbench_id: workbench_id.to_owned(),
            widget_instance_id: None,
        })
        .is_empty());
    remove_test_db_files(&db_path);
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-terminal-pty-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
