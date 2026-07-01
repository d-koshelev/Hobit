use std::path::{Path, PathBuf};

#[cfg(test)]
use hobit_app::parse_and_preview_agent_queue_prompt_pack;
use hobit_app::{
    AgentQueuePromptPackPreviewRequest, AgentQueuePromptPackPreviewResult, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn preview_agent_queue_prompt_pack(
    request: AgentQueuePromptPackPreviewRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueuePromptPackPreviewResult, String> {
    preview_agent_queue_prompt_pack_stateful_blocking(request, state.db_path().to_path_buf())
}

#[tauri::command]
pub(crate) fn preview_agent_queue_prompt_pack_file(
    request: hobit_app::AgentQueuePromptPackFileRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueuePromptPackPreviewResult, String> {
    preview_agent_queue_prompt_pack_file_blocking(request, state.db_path().to_path_buf())
}

#[cfg(test)]
pub(crate) fn preview_agent_queue_prompt_pack_blocking(
    request: AgentQueuePromptPackPreviewRequest,
) -> AgentQueuePromptPackPreviewResult {
    parse_and_preview_agent_queue_prompt_pack(request)
}

pub(crate) fn preview_agent_queue_prompt_pack_stateful_blocking(
    request: AgentQueuePromptPackPreviewRequest,
    db_path: PathBuf,
) -> Result<AgentQueuePromptPackPreviewResult, String> {
    let service = workspace_service(&db_path)?;
    service
        .preview_agent_queue_prompt_pack(request)
        .map_err(command_error)
}

pub(crate) fn preview_agent_queue_prompt_pack_file_blocking(
    request: hobit_app::AgentQueuePromptPackFileRequest,
    db_path: PathBuf,
) -> Result<AgentQueuePromptPackPreviewResult, String> {
    let service = workspace_service(&db_path)?;
    service
        .preview_agent_queue_prompt_pack_file(request)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn materialize_agent_queue_prompt_pack(
    request: hobit_app::AgentQueuePromptPackMaterializeRequest,
    state: State<'_, AppState>,
) -> Result<hobit_app::AgentQueuePromptPackMaterializeResult, String> {
    materialize_agent_queue_prompt_pack_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn materialize_agent_queue_prompt_pack_blocking(
    request: hobit_app::AgentQueuePromptPackMaterializeRequest,
    db_path: PathBuf,
) -> Result<hobit_app::AgentQueuePromptPackMaterializeResult, String> {
    let service = workspace_service(&db_path)?;
    service
        .materialize_agent_queue_prompt_pack(request)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn materialize_agent_queue_prompt_pack_file(
    request: hobit_app::AgentQueuePromptPackFileRequest,
    state: State<'_, AppState>,
) -> Result<hobit_app::AgentQueuePromptPackMaterializeResult, String> {
    materialize_agent_queue_prompt_pack_file_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn materialize_agent_queue_prompt_pack_file_blocking(
    request: hobit_app::AgentQueuePromptPackFileRequest,
    db_path: PathBuf,
) -> Result<hobit_app::AgentQueuePromptPackMaterializeResult, String> {
    let service = workspace_service(&db_path)?;
    service
        .materialize_agent_queue_prompt_pack_file(request)
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
