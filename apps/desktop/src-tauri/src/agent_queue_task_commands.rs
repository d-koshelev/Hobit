use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_task_dto::{
    AgentQueueTaskDto, CreateAgentQueueTaskRequest, GetAgentQueueTaskRequest,
    ListAgentQueueTasksRequest, UpdateAgentQueueTaskRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn create_agent_queue_task(
    request: CreateAgentQueueTaskRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueTaskDto, String> {
    create_agent_queue_task_blocking(request, state.db_path().to_path_buf())
}

fn create_agent_queue_task_blocking(
    request: CreateAgentQueueTaskRequest,
    db_path: PathBuf,
) -> Result<AgentQueueTaskDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_agent_queue_task(request.into())
        .map(AgentQueueTaskDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_agent_queue_tasks(
    request: ListAgentQueueTasksRequest,
    state: State<'_, AppState>,
) -> Result<Vec<AgentQueueTaskDto>, String> {
    list_agent_queue_tasks_blocking(request, state.db_path().to_path_buf())
}

fn list_agent_queue_tasks_blocking(
    request: ListAgentQueueTasksRequest,
    db_path: PathBuf,
) -> Result<Vec<AgentQueueTaskDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_agent_queue_tasks(&request.workspace_id)
        .map(|tasks| tasks.into_iter().map(AgentQueueTaskDto::from).collect())
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_queue_task(
    request: GetAgentQueueTaskRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueTaskDto>, String> {
    get_agent_queue_task_blocking(request, state.db_path().to_path_buf())
}

fn get_agent_queue_task_blocking(
    request: GetAgentQueueTaskRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueTaskDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_agent_queue_task(&request.workspace_id, &request.queue_item_id)
        .map(|task| task.map(AgentQueueTaskDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_agent_queue_task(
    request: UpdateAgentQueueTaskRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueTaskDto>, String> {
    update_agent_queue_task_blocking(request, state.db_path().to_path_buf())
}

fn update_agent_queue_task_blocking(
    request: UpdateAgentQueueTaskRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueTaskDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_agent_queue_task(request.into())
        .map(|task| task.map(AgentQueueTaskDto::from))
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
