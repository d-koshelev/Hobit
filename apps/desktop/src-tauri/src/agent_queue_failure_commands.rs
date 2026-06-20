use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_failure_dto::{
    AgentQueueFailureCommandResultDto, FailAgentQueueItemRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn fail_agent_queue_item(
    request: FailAgentQueueItemRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueFailureCommandResultDto, String> {
    fail_agent_queue_item_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn fail_agent_queue_item_blocking(
    request: FailAgentQueueItemRequest,
    db_path: PathBuf,
) -> Result<AgentQueueFailureCommandResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .fail_agent_queue_item(request.into())
        .map(AgentQueueFailureCommandResultDto::from)
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
