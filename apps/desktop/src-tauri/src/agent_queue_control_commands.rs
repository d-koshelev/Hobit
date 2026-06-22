use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_control_dto::{
    AgentQueueControlStateDto, GetAgentQueueControlStateRequest, SetAgentQueueControlStateRequest,
    SetAgentQueueControlStateResultDto,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn get_agent_queue_control_state(
    request: GetAgentQueueControlStateRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueControlStateDto>, String> {
    get_agent_queue_control_state_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn get_agent_queue_control_state_blocking(
    request: GetAgentQueueControlStateRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueControlStateDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_agent_queue_control_state(&request.workspace_id)
        .map(|state| state.map(AgentQueueControlStateDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn set_agent_queue_control_state(
    request: SetAgentQueueControlStateRequest,
    state: State<'_, AppState>,
) -> Result<SetAgentQueueControlStateResultDto, String> {
    set_agent_queue_control_state_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn set_agent_queue_control_state_blocking(
    request: SetAgentQueueControlStateRequest,
    db_path: PathBuf,
) -> Result<SetAgentQueueControlStateResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .set_agent_queue_control_state(request.into())
        .map(SetAgentQueueControlStateResultDto::from)
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
