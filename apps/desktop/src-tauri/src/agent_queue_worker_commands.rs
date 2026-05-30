use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_worker_dto::{
    AgentQueueWorkerDto, CreateAgentQueueWorkerRequest, DeleteAgentQueueWorkerRequest,
    ListAgentQueueWorkersRequest, UpdateAgentQueueWorkerRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn list_agent_queue_workers(
    request: ListAgentQueueWorkersRequest,
    state: State<'_, AppState>,
) -> Result<Vec<AgentQueueWorkerDto>, String> {
    list_agent_queue_workers_blocking(request, state.db_path().to_path_buf())
}

fn list_agent_queue_workers_blocking(
    request: ListAgentQueueWorkersRequest,
    db_path: PathBuf,
) -> Result<Vec<AgentQueueWorkerDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_agent_queue_workers(&request.workspace_id)
        .map(|workers| workers.into_iter().map(AgentQueueWorkerDto::from).collect())
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn create_agent_queue_worker(
    request: CreateAgentQueueWorkerRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkerDto, String> {
    create_agent_queue_worker_blocking(request, state.db_path().to_path_buf())
}

fn create_agent_queue_worker_blocking(
    request: CreateAgentQueueWorkerRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkerDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .create_agent_queue_worker(request.into())
        .map(AgentQueueWorkerDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn update_agent_queue_worker(
    request: UpdateAgentQueueWorkerRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueWorkerDto>, String> {
    update_agent_queue_worker_blocking(request, state.db_path().to_path_buf())
}

fn update_agent_queue_worker_blocking(
    request: UpdateAgentQueueWorkerRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueWorkerDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .update_agent_queue_worker(request.into())
        .map(|worker| worker.map(AgentQueueWorkerDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn delete_agent_queue_worker(
    request: DeleteAgentQueueWorkerRequest,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    delete_agent_queue_worker_blocking(request, state.db_path().to_path_buf())
}

fn delete_agent_queue_worker_blocking(
    request: DeleteAgentQueueWorkerRequest,
    db_path: PathBuf,
) -> Result<bool, String> {
    let service = workspace_service(&db_path)?;
    service
        .delete_agent_queue_worker(request.into())
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
