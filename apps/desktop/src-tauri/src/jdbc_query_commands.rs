use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;
use crate::jdbc_query_dto::{
    ExecuteJdbcReadOnlyQueryRequest, JdbcReadOnlyQueryResultDto, JdbcReadOnlySqlValidationDto,
    ValidateJdbcReadOnlySqlRequest,
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
