use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::jdbc_connector_dto::{
    CreateJdbcConnectorRequest, GetJdbcConnectorRequest, JdbcConnectorDto,
    ListJdbcConnectorsRequest, UpdateJdbcConnectorRequest,
};

#[tauri::command]
pub(crate) fn create_jdbc_connector(
    request: CreateJdbcConnectorRequest,
    state: State<'_, AppState>,
) -> Result<JdbcConnectorDto, String> {
    create_jdbc_connector_blocking(request, state.db_path().to_path_buf())
}

fn create_jdbc_connector_blocking(
    request: CreateJdbcConnectorRequest,
    db_path: PathBuf,
) -> Result<JdbcConnectorDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_jdbc_connector(request.into())
        .map(JdbcConnectorDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_jdbc_connectors(
    request: ListJdbcConnectorsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<JdbcConnectorDto>, String> {
    list_jdbc_connectors_blocking(request, state.db_path().to_path_buf())
}

fn list_jdbc_connectors_blocking(
    request: ListJdbcConnectorsRequest,
    db_path: PathBuf,
) -> Result<Vec<JdbcConnectorDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_jdbc_connectors(&request.workspace_id)
        .map(|connectors| connectors.into_iter().map(JdbcConnectorDto::from).collect())
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_jdbc_connector(
    request: GetJdbcConnectorRequest,
    state: State<'_, AppState>,
) -> Result<Option<JdbcConnectorDto>, String> {
    get_jdbc_connector_blocking(request, state.db_path().to_path_buf())
}

fn get_jdbc_connector_blocking(
    request: GetJdbcConnectorRequest,
    db_path: PathBuf,
) -> Result<Option<JdbcConnectorDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_jdbc_connector(&request.workspace_id, &request.connector_id)
        .map(|connector| connector.map(JdbcConnectorDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_jdbc_connector(
    request: UpdateJdbcConnectorRequest,
    state: State<'_, AppState>,
) -> Result<Option<JdbcConnectorDto>, String> {
    update_jdbc_connector_blocking(request, state.db_path().to_path_buf())
}

fn update_jdbc_connector_blocking(
    request: UpdateJdbcConnectorRequest,
    db_path: PathBuf,
) -> Result<Option<JdbcConnectorDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_jdbc_connector(request.into())
        .map(|connector| connector.map(JdbcConnectorDto::from))
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
