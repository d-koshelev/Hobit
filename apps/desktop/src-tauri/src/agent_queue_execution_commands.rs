use std::path::{Path, PathBuf};

use hobit_app::{AgentQueueTaskRunSource, WorkspaceService};
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_direct_work_launcher::{
    spawn_queue_direct_work_background_run, QueueDirectWorkLaunch,
};
use crate::agent_queue_execution_dto::{
    AgentQueueTaskRunLinkDto, GetAgentQueueTaskLatestRunLinkRequest,
    ListAgentQueueTaskRunLinksRequest, StartAssignedAgentQueueTaskRequest,
    StartAssignedAgentQueueTaskResponseDto,
};
use crate::app_state::{AppState, DirectWorkActiveRunRegistry};

#[tauri::command]
pub(crate) async fn start_assigned_agent_queue_task(
    request: StartAssignedAgentQueueTaskRequest,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<StartAssignedAgentQueueTaskResponseDto, String> {
    let db_path = state.db_path().to_path_buf();
    let active_runs = state.direct_work_active_runs();
    start_assigned_agent_queue_task_from_request(request, app, db_path, active_runs).await
}

#[tauri::command]
pub(crate) fn get_agent_queue_task_latest_run_link(
    request: GetAgentQueueTaskLatestRunLinkRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueTaskRunLinkDto>, String> {
    get_agent_queue_task_latest_run_link_blocking(request, state.db_path().to_path_buf())
}

#[tauri::command]
pub(crate) fn list_agent_queue_task_run_links(
    request: ListAgentQueueTaskRunLinksRequest,
    state: State<'_, AppState>,
) -> Result<Vec<AgentQueueTaskRunLinkDto>, String> {
    list_agent_queue_task_run_links_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn get_agent_queue_task_latest_run_link_blocking(
    request: GetAgentQueueTaskLatestRunLinkRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueTaskRunLinkDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_latest_agent_queue_task_run_link(&request.workspace_id, &request.queue_item_id)
        .map(|link| link.map(AgentQueueTaskRunLinkDto::from))
        .map_err(command_error)
}

pub(crate) fn list_agent_queue_task_run_links_blocking(
    request: ListAgentQueueTaskRunLinksRequest,
    db_path: PathBuf,
) -> Result<Vec<AgentQueueTaskRunLinkDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_agent_queue_task_run_links(&request.workspace_id, &request.queue_item_id)
        .map(|links| {
            links
                .into_iter()
                .map(AgentQueueTaskRunLinkDto::from)
                .collect()
        })
        .map_err(command_error)
}

pub(crate) async fn start_assigned_agent_queue_task_from_request(
    request: StartAssignedAgentQueueTaskRequest,
    app: tauri::AppHandle,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
) -> Result<StartAssignedAgentQueueTaskResponseDto, String> {
    start_assigned_agent_queue_task_from_request_with_source(
        request,
        app,
        db_path,
        active_runs,
        AgentQueueTaskRunSource::Manual,
    )
    .await
}

pub(crate) async fn start_assigned_agent_queue_task_from_request_with_source(
    request: StartAssignedAgentQueueTaskRequest,
    app: tauri::AppHandle,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
    source: AgentQueueTaskRunSource,
) -> Result<StartAssignedAgentQueueTaskResponseDto, String> {
    let start = tauri::async_runtime::spawn_blocking({
        let db_path = db_path.clone();
        let active_runs = active_runs.clone();
        move || {
            start_assigned_agent_queue_task_blocking_with_source(
                request,
                db_path,
                active_runs,
                source,
            )
        }
    })
    .await
    .map_err(command_error)??;

    if start.status != "started" {
        return Ok(StartAssignedAgentQueueTaskResponseDto::from(start));
    }

    let response = StartAssignedAgentQueueTaskResponseDto::from(start.clone());
    let _launch_status = spawn_queue_direct_work_background_run(
        QueueDirectWorkLaunch::from_start_summary(&start),
        db_path,
        app,
        active_runs,
    )?;

    Ok(response)
}

#[cfg(test)]
pub(crate) fn start_assigned_agent_queue_task_blocking(
    request: StartAssignedAgentQueueTaskRequest,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
) -> Result<hobit_app::AssignedAgentQueueTaskStartSummary, String> {
    start_assigned_agent_queue_task_blocking_with_source(
        request,
        db_path,
        active_runs,
        AgentQueueTaskRunSource::Manual,
    )
}

pub(crate) fn start_assigned_agent_queue_task_blocking_with_source(
    request: StartAssignedAgentQueueTaskRequest,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
    source: AgentQueueTaskRunSource,
) -> Result<hobit_app::AssignedAgentQueueTaskStartSummary, String> {
    let input: hobit_app::StartAssignedAgentQueueTaskInput = request.into();
    let has_workflow_context = input.workflow_start_context.is_some();
    let service = workspace_service(&db_path)?;

    match service.prepare_assigned_agent_queue_task_run(input.clone()) {
        Ok(plan) => {
            if active_runs.has_active_widget_run(
                &plan.workspace_id,
                &plan.workbench_id,
                &plan.executor_widget_instance_id,
            ) {
                return Err(
                    "Assigned Agent Executor already has an active Direct Work run. Stop it before running this Queue task."
                        .to_owned(),
                );
            }
        }
        Err(_error) if has_workflow_context => {}
        Err(error) => return Err(command_error(error)),
    }

    service
        .start_assigned_agent_queue_task_with_run_source(input, source)
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
