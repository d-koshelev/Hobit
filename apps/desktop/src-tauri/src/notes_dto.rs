use hobit_app::{CreateWorkspaceNoteInput, UpdateWorkspaceNoteInput, WorkspaceNoteSummary};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateWorkspaceNoteRequest {
    pub workspace_id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListWorkspaceNotesRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetWorkspaceNoteRequest {
    pub workspace_id: String,
    pub note_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct UpdateWorkspaceNoteRequest {
    pub workspace_id: String,
    pub note_id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct WorkspaceNoteDto {
    pub note_id: String,
    pub workspace_id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CreateWorkspaceNoteRequest> for CreateWorkspaceNoteInput {
    fn from(request: CreateWorkspaceNoteRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            title: request.title,
            body: request.body,
            pinned: request.pinned,
        }
    }
}

impl From<UpdateWorkspaceNoteRequest> for UpdateWorkspaceNoteInput {
    fn from(request: UpdateWorkspaceNoteRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            note_id: request.note_id,
            title: request.title,
            body: request.body,
            pinned: request.pinned,
        }
    }
}

impl From<WorkspaceNoteSummary> for WorkspaceNoteDto {
    fn from(summary: WorkspaceNoteSummary) -> Self {
        Self {
            note_id: summary.note_id,
            workspace_id: summary.workspace_id,
            title: summary.title,
            body: summary.body,
            pinned: summary.pinned,
            archived: summary.archived,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
