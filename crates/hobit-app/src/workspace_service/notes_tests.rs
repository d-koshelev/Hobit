use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> WorkspaceSummary {
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
}

#[test]
fn create_list_get_and_update_workspace_note() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Notes workspace");

    let note = service
        .create_workspace_note(CreateWorkspaceNoteInput {
            workspace_id: workspace.id.clone(),
            title: "First note".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        })
        .expect("create note");

    assert_eq!(note.workspace_id, workspace.id);
    assert_eq!(note.title, "First note");
    assert_eq!(note.body, "Body");
    assert!(!note.pinned);
    assert!(!note.archived);
    assert!(!note.created_at.is_empty());
    assert_eq!(note.created_at, note.updated_at);

    let listed = service
        .list_workspace_notes(&workspace.id)
        .expect("list notes");
    assert_eq!(listed, vec![note.clone()]);

    let fetched = service
        .get_workspace_note(&workspace.id, &note.note_id)
        .expect("get note")
        .expect("note");
    assert_eq!(fetched, note);

    std::thread::sleep(std::time::Duration::from_millis(1));

    let updated = service
        .update_workspace_note(UpdateWorkspaceNoteInput {
            workspace_id: workspace.id.clone(),
            note_id: note.note_id.clone(),
            title: "Updated note".to_owned(),
            body: "Updated body".to_owned(),
            pinned: true,
        })
        .expect("update note")
        .expect("updated note");

    assert_eq!(updated.title, "Updated note");
    assert_eq!(updated.body, "Updated body");
    assert!(updated.pinned);
    assert_ne!(updated.updated_at, note.updated_at);
}

#[test]
fn create_workspace_note_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .create_workspace_note(CreateWorkspaceNoteInput {
            workspace_id: "missing-workspace".to_owned(),
            title: "Note".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        })
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn list_workspace_notes_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .list_workspace_notes("missing-workspace")
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn get_and_update_workspace_note_reject_cross_workspace_access() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let note = service
        .create_workspace_note(CreateWorkspaceNoteInput {
            workspace_id: first.id.clone(),
            title: "First note".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        })
        .expect("create note");

    let get_error = service
        .get_workspace_note(&second.id, &note.note_id)
        .expect_err("cross-workspace get rejected");
    assert!(get_error.to_string().contains("note does not belong"));

    let update_error = service
        .update_workspace_note(UpdateWorkspaceNoteInput {
            workspace_id: second.id,
            note_id: note.note_id,
            title: "Other".to_owned(),
            body: "Other body".to_owned(),
            pinned: false,
        })
        .expect_err("cross-workspace update rejected");
    assert!(update_error.to_string().contains("note does not belong"));
}

#[test]
fn get_and_update_unknown_note_returns_none() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Notes workspace");

    assert!(service
        .get_workspace_note(&workspace.id, "missing-note")
        .expect("get unknown note")
        .is_none());
    assert!(service
        .update_workspace_note(UpdateWorkspaceNoteInput {
            workspace_id: workspace.id,
            note_id: "missing-note".to_owned(),
            title: "Missing".to_owned(),
            body: "Body".to_owned(),
            pinned: false,
        })
        .expect("update unknown note")
        .is_none());
}
