use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::{AppState, TerminalPtySessionRegistry};
use crate::terminal_pty_dto::{
    CreateTerminalPtySessionRequest, ListTerminalPtySessionsRequest,
    ResizeTerminalPtySessionRequest, TerminalPtySessionActionRequest, TerminalPtySessionDto,
    WriteTerminalPtySessionRequest,
};

#[tauri::command]
pub(crate) fn create_terminal_pty_session(
    request: CreateTerminalPtySessionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    create_terminal_pty_session_blocking(
        request,
        state.db_path().to_path_buf(),
        state.terminal_pty_sessions(),
    )
}

pub(crate) fn create_terminal_pty_session_blocking(
    request: CreateTerminalPtySessionRequest,
    db_path: PathBuf,
    sessions: TerminalPtySessionRegistry,
) -> Result<Option<TerminalPtySessionDto>, String> {
    if !terminal_pty_widget_owner_is_valid(
        &db_path,
        &request.workspace_id,
        &request.workbench_id,
        &request.widget_instance_id,
    )? {
        return Ok(None);
    }

    sessions
        .create_session(request.into())
        .map(|session| Some(TerminalPtySessionDto::from(session)))
}

#[tauri::command]
pub(crate) fn write_terminal_pty_session(
    request: WriteTerminalPtySessionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    state
        .terminal_pty_sessions()
        .write_stdin(request.into())
        .map(|session| session.map(TerminalPtySessionDto::from))
}

#[tauri::command]
pub(crate) fn resize_terminal_pty_session(
    request: ResizeTerminalPtySessionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    state
        .terminal_pty_sessions()
        .resize_session(request.into())
        .map(|session| session.map(TerminalPtySessionDto::from))
}

#[tauri::command]
pub(crate) fn stop_terminal_pty_session(
    request: TerminalPtySessionActionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    state
        .terminal_pty_sessions()
        .stop_session(request.into())
        .map(|session| session.map(TerminalPtySessionDto::from))
}

#[tauri::command]
pub(crate) fn kill_terminal_pty_session(
    request: TerminalPtySessionActionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    state
        .terminal_pty_sessions()
        .kill_session(request.into())
        .map(|session| session.map(TerminalPtySessionDto::from))
}

#[tauri::command]
pub(crate) fn close_terminal_pty_session(
    request: TerminalPtySessionActionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    state
        .terminal_pty_sessions()
        .close_session(request.into())
        .map(|session| session.map(TerminalPtySessionDto::from))
}

#[tauri::command]
pub(crate) fn get_terminal_pty_session(
    request: TerminalPtySessionActionRequest,
    state: State<'_, AppState>,
) -> Result<Option<TerminalPtySessionDto>, String> {
    Ok(state
        .terminal_pty_sessions()
        .get_session(request.into())
        .map(TerminalPtySessionDto::from))
}

#[tauri::command]
pub(crate) fn list_terminal_pty_sessions(
    request: ListTerminalPtySessionsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<TerminalPtySessionDto>, String> {
    Ok(state
        .terminal_pty_sessions()
        .list_sessions(request.into())
        .into_iter()
        .map(TerminalPtySessionDto::from)
        .collect())
}

fn terminal_pty_widget_owner_is_valid(
    db_path: &Path,
    workspace_id: &str,
    workbench_id: &str,
    widget_instance_id: &str,
) -> Result<bool, String> {
    let service = workspace_service(db_path)?;
    service
        .validate_terminal_pty_widget_owner(workspace_id, workbench_id, widget_instance_id)
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
