use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_note(
    store: &SqliteStore,
    workspace_id: &str,
    note_id: &str,
    title: &str,
    pinned: bool,
    updated_at: &str,
) {
    store
        .create_note(NewWorkspaceNote {
            note_id,
            workspace_id,
            title,
            body: "Body",
            pinned,
            archived: false,
            created_at: Some(updated_at),
            updated_at: Some(updated_at),
        })
        .expect("create note");
}

#[test]
fn create_note_stores_workspace_scoped_note() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let note = store
        .create_note(NewWorkspaceNote {
            note_id: "note-1",
            workspace_id: "workspace-1",
            title: "Incident notes",
            body: "Observed details",
            pinned: true,
            archived: false,
            created_at: Some("1"),
            updated_at: Some("2"),
        })
        .expect("create note");

    assert_eq!(note.note_id, "note-1");
    assert_eq!(note.workspace_id, "workspace-1");
    assert_eq!(note.title, "Incident notes");
    assert_eq!(note.body, "Observed details");
    assert!(note.pinned);
    assert!(!note.archived);
    assert_eq!(note.created_at, "1");
    assert_eq!(note.updated_at, "2");
}

#[test]
fn list_notes_returns_only_notes_for_workspace() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_note(&store, "workspace-1", "note-1", "One", false, "1");
    create_note(&store, "workspace-2", "note-2", "Two", false, "2");

    let notes = store
        .list_notes_for_workspace("workspace-1")
        .expect("list notes");

    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].note_id, "note-1");
}

#[test]
fn get_note_rejects_cross_workspace_access() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_note(&store, "workspace-1", "note-1", "One", false, "1");

    assert!(store
        .get_note("workspace-2", "note-1")
        .expect("get cross-workspace note")
        .is_none());
}

#[test]
fn update_note_updates_body_title_pin_and_updated_at() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_note(&store, "workspace-1", "note-1", "Original", false, "1");

    let note = store
        .update_note(
            "workspace-1",
            "note-1",
            WorkspaceNoteUpdate {
                title: "Updated",
                body: "Updated body",
                pinned: true,
                updated_at: Some("2"),
            },
        )
        .expect("update note")
        .expect("updated note");

    assert_eq!(note.title, "Updated");
    assert_eq!(note.body, "Updated body");
    assert!(note.pinned);
    assert_eq!(note.updated_at, "2");
}

#[test]
fn delete_workspace_deletes_workspace_notes_and_preserves_other_notes() {
    let store = initialized_store();
    create_workspace(&store, "workspace-delete");
    create_workspace(&store, "workspace-keep");
    create_note(
        &store,
        "workspace-delete",
        "note-delete",
        "Delete",
        false,
        "1",
    );
    create_note(&store, "workspace-keep", "note-keep", "Keep", false, "2");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_note_by_id("note-delete")
        .expect("get deleted note")
        .is_none());
    assert!(store
        .get_note_by_id("note-keep")
        .expect("get kept note")
        .is_some());
}

#[test]
fn list_notes_orders_pinned_first_then_recently_updated() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_note(&store, "workspace-1", "note-old", "Old", false, "1");
    create_note(&store, "workspace-1", "note-new", "New", false, "3");
    create_note(&store, "workspace-1", "note-pin", "Pinned", true, "2");

    let notes = store
        .list_notes_for_workspace("workspace-1")
        .expect("list notes");

    let ids = notes
        .into_iter()
        .map(|note| note.note_id)
        .collect::<Vec<_>>();
    assert_eq!(ids, vec!["note-pin", "note-new", "note-old"]);
}
