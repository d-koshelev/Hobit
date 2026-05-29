use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::jdbc_query_dto::{
    CheckJdbcSidecarHealthRequest, CreateJdbcConnectionProfileRequest,
    DeleteJdbcConnectionProfileRequest, ExecuteJdbcReadOnlyQueryRequest,
    GetJdbcConnectionProfileRequest, JdbcConnectionProfileDto, JdbcReadOnlyQueryResultDto,
    JdbcReadOnlySqlValidationDto, JdbcSidecarDiagnosticDto, ListJdbcConnectionProfilesRequest,
    ProbeJdbcDriverRequest, UpdateJdbcConnectionProfileRequest, ValidateJdbcReadOnlySqlRequest,
};

#[tauri::command]
pub(crate) fn validate_jdbc_read_only_sql(
    request: ValidateJdbcReadOnlySqlRequest,
    state: State<'_, AppState>,
) -> Result<JdbcReadOnlySqlValidationDto, String> {
    validate_jdbc_read_only_sql_blocking(request, state.db_path().to_path_buf())
}

fn validate_jdbc_read_only_sql_blocking(
    request: ValidateJdbcReadOnlySqlRequest,
    db_path: PathBuf,
) -> Result<JdbcReadOnlySqlValidationDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .validate_jdbc_read_only_sql(request.into())
        .map(JdbcReadOnlySqlValidationDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn execute_jdbc_read_only_query(
    request: ExecuteJdbcReadOnlyQueryRequest,
    state: State<'_, AppState>,
) -> Result<JdbcReadOnlyQueryResultDto, String> {
    execute_jdbc_read_only_query_blocking(request, state.db_path().to_path_buf())
}

fn execute_jdbc_read_only_query_blocking(
    request: ExecuteJdbcReadOnlyQueryRequest,
    db_path: PathBuf,
) -> Result<JdbcReadOnlyQueryResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .execute_jdbc_read_only_query(request.into())
        .map(JdbcReadOnlyQueryResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn check_jdbc_sidecar_health(
    request: CheckJdbcSidecarHealthRequest,
    state: State<'_, AppState>,
) -> Result<JdbcSidecarDiagnosticDto, String> {
    check_jdbc_sidecar_health_blocking(request, state.db_path().to_path_buf())
}

fn check_jdbc_sidecar_health_blocking(
    request: CheckJdbcSidecarHealthRequest,
    db_path: PathBuf,
) -> Result<JdbcSidecarDiagnosticDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .check_jdbc_sidecar_health(request.into())
        .map(JdbcSidecarDiagnosticDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn probe_jdbc_driver(
    request: ProbeJdbcDriverRequest,
    state: State<'_, AppState>,
) -> Result<JdbcSidecarDiagnosticDto, String> {
    probe_jdbc_driver_blocking(request, state.db_path().to_path_buf())
}

fn probe_jdbc_driver_blocking(
    request: ProbeJdbcDriverRequest,
    db_path: PathBuf,
) -> Result<JdbcSidecarDiagnosticDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .probe_jdbc_driver(request.into())
        .map(JdbcSidecarDiagnosticDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn create_jdbc_connection_profile(
    request: CreateJdbcConnectionProfileRequest,
    state: State<'_, AppState>,
) -> Result<JdbcConnectionProfileDto, String> {
    create_jdbc_connection_profile_blocking(request, state.db_path().to_path_buf())
}

fn create_jdbc_connection_profile_blocking(
    request: CreateJdbcConnectionProfileRequest,
    db_path: PathBuf,
) -> Result<JdbcConnectionProfileDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_jdbc_connection_profile(request.into())
        .map(JdbcConnectionProfileDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_jdbc_connection_profiles(
    request: ListJdbcConnectionProfilesRequest,
    state: State<'_, AppState>,
) -> Result<Vec<JdbcConnectionProfileDto>, String> {
    list_jdbc_connection_profiles_blocking(request, state.db_path().to_path_buf())
}

fn list_jdbc_connection_profiles_blocking(
    request: ListJdbcConnectionProfilesRequest,
    db_path: PathBuf,
) -> Result<Vec<JdbcConnectionProfileDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_jdbc_connection_profiles(&request.workspace_id)
        .map(|profiles| {
            profiles
                .into_iter()
                .map(JdbcConnectionProfileDto::from)
                .collect()
        })
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_jdbc_connection_profile(
    request: GetJdbcConnectionProfileRequest,
    state: State<'_, AppState>,
) -> Result<Option<JdbcConnectionProfileDto>, String> {
    get_jdbc_connection_profile_blocking(request, state.db_path().to_path_buf())
}

fn get_jdbc_connection_profile_blocking(
    request: GetJdbcConnectionProfileRequest,
    db_path: PathBuf,
) -> Result<Option<JdbcConnectionProfileDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_jdbc_connection_profile(&request.workspace_id, &request.profile_id)
        .map(|profile| profile.map(JdbcConnectionProfileDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_jdbc_connection_profile(
    request: UpdateJdbcConnectionProfileRequest,
    state: State<'_, AppState>,
) -> Result<Option<JdbcConnectionProfileDto>, String> {
    update_jdbc_connection_profile_blocking(request, state.db_path().to_path_buf())
}

fn update_jdbc_connection_profile_blocking(
    request: UpdateJdbcConnectionProfileRequest,
    db_path: PathBuf,
) -> Result<Option<JdbcConnectionProfileDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_jdbc_connection_profile(request.into())
        .map(|profile| profile.map(JdbcConnectionProfileDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn delete_jdbc_connection_profile(
    request: DeleteJdbcConnectionProfileRequest,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    delete_jdbc_connection_profile_blocking(request, state.db_path().to_path_buf())
}

fn delete_jdbc_connection_profile_blocking(
    request: DeleteJdbcConnectionProfileRequest,
    db_path: PathBuf,
) -> Result<bool, String> {
    let service = workspace_service(&db_path)?;
    service
        .delete_jdbc_connection_profile(request.into())
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
