use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_workflow_dto::{
    AgentQueueWorkflowCancelResultDto, AgentQueueWorkflowReportDto,
    AgentQueueWorkflowResumePlanDto, AgentQueueWorkflowRunDto, AgentQueueWorkflowStartResultDto,
    CancelAgentQueueWorkflowRequest, GetAgentQueueWorkflowRequest, ListAgentQueueWorkflowsRequest,
    PlanAgentQueueWorkflowResumeRequest, StartAgentQueueWorkflowRequest,
};
use crate::app_state::AppState;

#[tauri::command]
pub(crate) fn start_agent_queue_workflow(
    request: StartAgentQueueWorkflowRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowStartResultDto, String> {
    start_agent_queue_workflow_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn start_agent_queue_workflow_blocking(
    request: StartAgentQueueWorkflowRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowStartResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .start_queue_workflow(request.into())
        .map(AgentQueueWorkflowStartResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_queue_workflow(
    request: GetAgentQueueWorkflowRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueWorkflowRunDto>, String> {
    get_agent_queue_workflow_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn get_agent_queue_workflow_blocking(
    request: GetAgentQueueWorkflowRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueWorkflowRunDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_queue_workflow_run(request.into())
        .map(|run| run.map(AgentQueueWorkflowRunDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn list_agent_queue_workflows(
    request: ListAgentQueueWorkflowsRequest,
    state: State<'_, AppState>,
) -> Result<Vec<AgentQueueWorkflowRunDto>, String> {
    list_agent_queue_workflows_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn list_agent_queue_workflows_blocking(
    request: ListAgentQueueWorkflowsRequest,
    db_path: PathBuf,
) -> Result<Vec<AgentQueueWorkflowRunDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .list_queue_workflow_runs(request.into())
        .map(|runs| {
            runs.into_iter()
                .map(AgentQueueWorkflowRunDto::from)
                .collect()
        })
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn cancel_agent_queue_workflow(
    request: CancelAgentQueueWorkflowRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowCancelResultDto, String> {
    cancel_agent_queue_workflow_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn cancel_agent_queue_workflow_blocking(
    request: CancelAgentQueueWorkflowRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowCancelResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .cancel_queue_workflow_run(request.into())
        .map(AgentQueueWorkflowCancelResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn get_agent_queue_workflow_report(
    request: GetAgentQueueWorkflowRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueWorkflowReportDto>, String> {
    get_agent_queue_workflow_report_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn get_agent_queue_workflow_report_blocking(
    request: GetAgentQueueWorkflowRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueWorkflowReportDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .get_queue_workflow_report(request.into())
        .map(|report| report.map(AgentQueueWorkflowReportDto::from))
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn plan_agent_queue_workflow_resume(
    request: PlanAgentQueueWorkflowResumeRequest,
    state: State<'_, AppState>,
) -> Result<Option<AgentQueueWorkflowResumePlanDto>, String> {
    plan_agent_queue_workflow_resume_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn plan_agent_queue_workflow_resume_blocking(
    request: PlanAgentQueueWorkflowResumeRequest,
    db_path: PathBuf,
) -> Result<Option<AgentQueueWorkflowResumePlanDto>, String> {
    let service = workspace_service(&db_path)?;
    service
        .plan_queue_workflow_resume(request.into())
        .map(|plan| plan.map(AgentQueueWorkflowResumePlanDto::from))
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
