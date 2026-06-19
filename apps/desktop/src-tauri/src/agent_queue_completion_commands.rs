use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_completion_dto::{
    AgentQueueCompletionCommandResultDto, MarkAgentQueueItemDoneRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn mark_agent_queue_item_done(
    request: MarkAgentQueueItemDoneRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueCompletionCommandResultDto, String> {
    mark_agent_queue_item_done_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn mark_agent_queue_item_done_blocking(
    request: MarkAgentQueueItemDoneRequest,
    db_path: PathBuf,
) -> Result<AgentQueueCompletionCommandResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .mark_agent_queue_item_done(request.into())
        .map(AgentQueueCompletionCommandResultDto::from)
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
