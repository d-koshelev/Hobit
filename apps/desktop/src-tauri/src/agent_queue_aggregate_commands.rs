use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_aggregate_dto::{
    GetQueueItemAggregateRequest, ListQueueItemAggregatesRequest, QueueItemAggregateDto,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn list_agent_queue_item_aggregates(
    request: ListQueueItemAggregatesRequest,
    state: State<'_, AppState>,
) -> Result<Vec<QueueItemAggregateDto>, String> {
    list_agent_queue_item_aggregates_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn list_agent_queue_item_aggregates_blocking(
    request: ListQueueItemAggregatesRequest,
    db_path: PathBuf,
) -> Result<Vec<QueueItemAggregateDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_queue_item_aggregates(&request.workspace_id)
        .map(|aggregates| {
            aggregates
                .into_iter()
                .map(QueueItemAggregateDto::from)
                .collect()
        })
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_queue_item_aggregate(
    request: GetQueueItemAggregateRequest,
    state: State<'_, AppState>,
) -> Result<Option<QueueItemAggregateDto>, String> {
    get_agent_queue_item_aggregate_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn get_agent_queue_item_aggregate_blocking(
    request: GetQueueItemAggregateRequest,
    db_path: PathBuf,
) -> Result<Option<QueueItemAggregateDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_queue_item_aggregate(&request.workspace_id, &request.task_id)
        .map(|aggregate| aggregate.map(QueueItemAggregateDto::from))
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
