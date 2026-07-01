use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_worker_evidence_dto::{
    AgentQueueWorkerEvidenceQueryResultDto, AgentQueueWorkerFinishedCommandResultDto,
    GetAgentQueueWorkerEvidenceBundleRequest, RecordAgentQueueWorkerFinishedRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn record_agent_queue_worker_finished(
    request: RecordAgentQueueWorkerFinishedRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkerFinishedCommandResultDto, String> {
    record_agent_queue_worker_finished_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn record_agent_queue_worker_finished_blocking(
    request: RecordAgentQueueWorkerFinishedRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkerFinishedCommandResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .record_agent_queue_worker_finished(request.into())
        .map(AgentQueueWorkerFinishedCommandResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_queue_worker_evidence_bundle(
    request: GetAgentQueueWorkerEvidenceBundleRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkerEvidenceQueryResultDto, String> {
    get_agent_queue_worker_evidence_bundle_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn get_agent_queue_worker_evidence_bundle_blocking(
    request: GetAgentQueueWorkerEvidenceBundleRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkerEvidenceQueryResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_agent_queue_worker_evidence_bundle(request.into())
        .map(AgentQueueWorkerEvidenceQueryResultDto::from)
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
