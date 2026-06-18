use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_review_dto::{
    AckAgentQueueReviewMessageRequest, AgentQueueReviewCommandResultDto,
    CreateAgentQueueReviewMessageRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn create_agent_queue_review_message(
    request: CreateAgentQueueReviewMessageRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueReviewCommandResultDto, String> {
    create_agent_queue_review_message_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn create_agent_queue_review_message_blocking(
    request: CreateAgentQueueReviewMessageRequest,
    db_path: PathBuf,
) -> Result<AgentQueueReviewCommandResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_agent_queue_review_message(request.into())
        .map(AgentQueueReviewCommandResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn ack_agent_queue_review_message(
    request: AckAgentQueueReviewMessageRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueReviewCommandResultDto, String> {
    ack_agent_queue_review_message_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn ack_agent_queue_review_message_blocking(
    request: AckAgentQueueReviewMessageRequest,
    db_path: PathBuf,
) -> Result<AgentQueueReviewCommandResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .ack_agent_queue_review_message(request.into())
        .map(AgentQueueReviewCommandResultDto::from)
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
