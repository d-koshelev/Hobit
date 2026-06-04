use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use serde::Deserialize;
use tauri::State;

use crate::app_state::AppState;
use crate::workspace_dto::WorkspaceSummaryDto;

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct UpdateWorkspaceRequest {
    pub workspace_id: String,
    pub title: String,
}

#[tauri::command]
pub(crate) fn update_workspace(
    request: UpdateWorkspaceRequest,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceSummaryDto>, String> {
    SqliteStore::open(state.db_path())
        .map(WorkspaceService::new)
        .map_err(command_error)?
        .update_workspace_title(&request.workspace_id, request.title)
        .map(|summary| summary.map(WorkspaceSummaryDto::from))
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}
