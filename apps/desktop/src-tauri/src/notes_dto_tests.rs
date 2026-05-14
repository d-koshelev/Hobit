use hobit_app::WorkspaceNoteSummary;

use crate::notes_dto::{CreateWorkspaceNoteRequest, UpdateWorkspaceNoteRequest, WorkspaceNoteDto};

#[test]
fn maps_create_workspace_note_request_to_app_input() {
    let request = CreateWorkspaceNoteRequest {
        workspace_id: "ws_1".to_owned(),
        title: "Note".to_owned(),
        body: "Body".to_owned(),
        pinned: true,
    };

    let input: hobit_app::CreateWorkspaceNoteInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.title, "Note");
    assert_eq!(input.body, "Body");
    assert!(input.pinned);
}

#[test]
fn maps_update_workspace_note_request_to_app_input() {
    let request = UpdateWorkspaceNoteRequest {
        workspace_id: "ws_1".to_owned(),
        note_id: "note_1".to_owned(),
        title: "Updated".to_owned(),
        body: "Updated body".to_owned(),
        pinned: false,
    };

    let input: hobit_app::UpdateWorkspaceNoteInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.note_id, "note_1");
    assert_eq!(input.title, "Updated");
    assert_eq!(input.body, "Updated body");
    assert!(!input.pinned);
}

#[test]
fn maps_workspace_note_summary_to_dto() {
    let summary = WorkspaceNoteSummary {
        note_id: "note_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        title: "Note".to_owned(),
        body: "Body".to_owned(),
        pinned: true,
        archived: false,
        created_at: "1".to_owned(),
        updated_at: "2".to_owned(),
    };

    let dto = WorkspaceNoteDto::from(summary);

    assert_eq!(dto.note_id, "note_1");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.title, "Note");
    assert_eq!(dto.body, "Body");
    assert!(dto.pinned);
    assert!(!dto.archived);
    assert_eq!(dto.created_at, "1");
    assert_eq!(dto.updated_at, "2");
}
