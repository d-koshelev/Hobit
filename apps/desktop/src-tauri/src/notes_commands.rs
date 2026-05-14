use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::notes_dto::{
    CreateWorkspaceNoteRequest, GetWorkspaceNoteRequest, ListWorkspaceNotesRequest,
    UpdateWorkspaceNoteRequest, WorkspaceNoteDto,
};

#[tauri::command]
pub(crate) fn create_workspace_note(
    request: CreateWorkspaceNoteRequest,
    state: State<'_, AppState>,
) -> Result<WorkspaceNoteDto, String> {
    create_workspace_note_blocking(request, state.db_path().to_path_buf())
}

fn create_workspace_note_blocking(
    request: CreateWorkspaceNoteRequest,
    db_path: PathBuf,
) -> Result<WorkspaceNoteDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_workspace_note(request.into())
        .map(WorkspaceNoteDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_workspace_notes(
    request: ListWorkspaceNotesRequest,
    state: State<'_, AppState>,
) -> Result<Vec<WorkspaceNoteDto>, String> {
    list_workspace_notes_blocking(request, state.db_path().to_path_buf())
}

fn list_workspace_notes_blocking(
    request: ListWorkspaceNotesRequest,
    db_path: PathBuf,
) -> Result<Vec<WorkspaceNoteDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_workspace_notes(&request.workspace_id)
        .map(|notes| notes.into_iter().map(WorkspaceNoteDto::from).collect())
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_workspace_note(
    request: GetWorkspaceNoteRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceNoteDto>, String> {
    get_workspace_note_blocking(request, state.db_path().to_path_buf())
}

fn get_workspace_note_blocking(
    request: GetWorkspaceNoteRequest,
    db_path: PathBuf,
) -> Result<Option<WorkspaceNoteDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_workspace_note(&request.workspace_id, &request.note_id)
        .map(|note| note.map(WorkspaceNoteDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_workspace_note(
    request: UpdateWorkspaceNoteRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceNoteDto>, String> {
    update_workspace_note_blocking(request, state.db_path().to_path_buf())
}

fn update_workspace_note_blocking(
    request: UpdateWorkspaceNoteRequest,
    db_path: PathBuf,
) -> Result<Option<WorkspaceNoteDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_workspace_note(request.into())
        .map(|note| note.map(WorkspaceNoteDto::from))
        .map_err(command_error)
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests;
