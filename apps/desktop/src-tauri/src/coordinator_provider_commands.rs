use std::path::{Path, PathBuf};

use hobit_app::{MockCoordinatorProviderAdapter, WorkspaceService};
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::coordinator_provider_dto::{
    GenerateCoordinatorProviderResponseDto, GenerateCoordinatorProviderResponseRequest,
};

#[tauri::command]
pub(crate) fn generate_coordinator_provider_response(
    request: GenerateCoordinatorProviderResponseRequest,
    state: State<'_, AppState>,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    generate_coordinator_provider_response_blocking(request, state.db_path().to_path_buf())
}

fn generate_coordinator_provider_response_blocking(
    request: GenerateCoordinatorProviderResponseRequest,
    db_path: PathBuf,
) -> Result<Option<GenerateCoordinatorProviderResponseDto>, String> {
    let service = workspace_service(&db_path)?;
    let provider = MockCoordinatorProviderAdapter;
    service
        .generate_coordinator_provider_response(request.into(), &provider)
        .map(|response| response.map(GenerateCoordinatorProviderResponseDto::from))
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
