use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn workspace_note_command_helpers_create_list_get_and_update() {
    let db_path = unique_test_db_path();
    let (workspace_id, _workbench_id) = create_workspace_in_test_db(&db_path);

    let created = create_workspace_note_blocking(
        CreateWorkspaceNoteRequest {
            workspace_id: workspace_id.clone(),
            title: "Note".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        },
        db_path.clone(),
    )
    .expect("create note");

    assert_eq!(created.workspace_id, workspace_id);
    assert_eq!(created.title, "Note");
    assert_eq!(created.body, "Body");

    let listed = list_workspace_notes_blocking(
        ListWorkspaceNotesRequest {
            workspace_id: workspace_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list notes");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].note_id, created.note_id);

    let fetched = get_workspace_note_blocking(
        GetWorkspaceNoteRequest {
            workspace_id: workspace_id.clone(),
            note_id: created.note_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get note")
    .expect("note");
    assert_eq!(fetched, created);

    let updated = update_workspace_note_blocking(
        UpdateWorkspaceNoteRequest {
            workspace_id,
            note_id: created.note_id,
            title: "Updated".to_owned(),
            body: "Updated body".to_owned(),
            pinned: true,
        },
        db_path.clone(),
    )
    .expect("update note")
    .expect("updated note");

    assert_eq!(updated.title, "Updated");
    assert_eq!(updated.body, "Updated body");
    assert!(updated.pinned);
    remove_test_db_files(&db_path);
}

#[test]
fn create_workspace_note_command_helper_rejects_unknown_workspace() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let error = create_workspace_note_blocking(
        CreateWorkspaceNoteRequest {
            workspace_id: "missing-workspace".to_owned(),
            title: "Note".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        },
        db_path.clone(),
    )
    .expect_err("unknown workspace rejected");

    assert!(error.contains("workspace not found: missing-workspace"));
    remove_test_db_files(&db_path);
}

#[test]
fn get_workspace_note_command_helper_rejects_cross_workspace_access() {
    let db_path = unique_test_db_path();
    let (first_workspace_id, _) = create_workspace_in_test_db(&db_path);
    let (second_workspace_id, _) = create_workspace_in_test_db(&db_path);
    let created = create_workspace_note_blocking(
        CreateWorkspaceNoteRequest {
            workspace_id: first_workspace_id,
            title: "Note".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        },
        db_path.clone(),
    )
    .expect("create note");

    let error = get_workspace_note_blocking(
        GetWorkspaceNoteRequest {
            workspace_id: second_workspace_id,
            note_id: created.note_id,
        },
        db_path.clone(),
    )
    .expect_err("cross-workspace access rejected");

    assert!(error.contains("note does not belong"));
    remove_test_db_files(&db_path);
}

fn create_workspace_in_test_db(db_path: &Path) -> (String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Notes command test", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.expect("workbench id");
    let workspace_id = workspace.id;
    drop(service);

    (workspace_id, workbench_id)
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-notes-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
