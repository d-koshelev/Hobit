use std::path::{Path, PathBuf};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use tauri::State;

use crate::agent_queue_direct_work_launcher::{
    spawn_queue_direct_work_background_run, QueueDirectWorkLaunch,
};
use crate::agent_queue_workflow_dto::{
    AgentQueueWorkflowApplyRunSettingsResultDto, AgentQueueWorkflowCancelResultDto,
    AgentQueueWorkflowMaterializeTaskSlotResultDto, AgentQueueWorkflowPromoteTaskSlotResultDto,
    AgentQueueWorkflowReportDto, AgentQueueWorkflowResumePlanDto, AgentQueueWorkflowRunDto,
    AgentQueueWorkflowRunnerReportRecordResultDto, AgentQueueWorkflowStartResultDto,
    AgentQueueWorkflowWorkerEvidenceRecordResultDto, AgentQueueWorkflowWorkerEvidenceStepResultDto,
    ApplyAgentQueueWorkflowRunSettingsRequest, CancelAgentQueueWorkflowRequest,
    GetAgentQueueWorkflowRequest, ListAgentQueueWorkflowsRequest,
    MaterializeAgentQueueWorkflowTaskSlotRequest, PlanAgentQueueWorkflowResumeRequest,
    PromoteAgentQueueWorkflowTaskSlotRequest, RecordAgentQueueWorkflowRunnerReportRequest,
    RecordAgentQueueWorkflowWorkerEvidenceRequest, StartAgentQueueWorkflowRequest,
};
use crate::agent_queue_workflow_finalization_step_dto::{
    AgentQueueWorkflowFinalizationStepResultDto, ExecuteAgentQueueWorkflowFinalizationStepRequest,
};
use crate::agent_queue_workflow_review_step_dto::{
    AgentQueueWorkflowReviewStepResultDto, ExecuteAgentQueueWorkflowReviewStepRequest,
};
use crate::agent_queue_workflow_start_step_dto::{
    AgentQueueWorkflowCreateSetupStartStepResultDto,
    ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
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

#[tauri::command]
pub(crate) fn record_agent_queue_workflow_runner_report(
    request: RecordAgentQueueWorkflowRunnerReportRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowRunnerReportRecordResultDto, String> {
    record_agent_queue_workflow_runner_report_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn record_agent_queue_workflow_runner_report_blocking(
    request: RecordAgentQueueWorkflowRunnerReportRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowRunnerReportRecordResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .record_queue_workflow_runner_report(request.into())
        .map(AgentQueueWorkflowRunnerReportRecordResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn record_agent_queue_workflow_worker_evidence(
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowWorkerEvidenceRecordResultDto, String> {
    record_agent_queue_workflow_worker_evidence_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn record_agent_queue_workflow_worker_evidence_blocking(
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowWorkerEvidenceRecordResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .record_queue_workflow_worker_evidence(request.into())
        .map(AgentQueueWorkflowWorkerEvidenceRecordResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn execute_agent_queue_workflow_worker_evidence_step(
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowWorkerEvidenceStepResultDto, String> {
    execute_agent_queue_workflow_worker_evidence_step_blocking(
        request,
        state.db_path().to_path_buf(),
    )
}

pub(crate) fn execute_agent_queue_workflow_worker_evidence_step_blocking(
    request: RecordAgentQueueWorkflowWorkerEvidenceRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowWorkerEvidenceStepResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .execute_queue_workflow_worker_evidence_step(request.into())
        .map(AgentQueueWorkflowWorkerEvidenceStepResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn execute_agent_queue_workflow_create_setup_start_step(
    request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowCreateSetupStartStepResultDto, String> {
    execute_agent_queue_workflow_create_setup_start_step_with_launch_bridge(
        request,
        state.db_path().to_path_buf(),
        app,
        state.direct_work_active_runs(),
    )
}

pub(crate) fn execute_agent_queue_workflow_create_setup_start_step_with_launch_bridge(
    request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
    db_path: PathBuf,
    app: tauri::AppHandle,
    active_runs: crate::app_state::DirectWorkActiveRunRegistry,
) -> Result<AgentQueueWorkflowCreateSetupStartStepResultDto, String> {
    let service = workspace_service(&db_path)?;
    let result = service
        .execute_queue_workflow_create_setup_start_step(request.into())
        .map_err(command_error)?;
    if let Some(intent) = result.worker_launch_intent.clone() {
        launch_queue_workflow_worker_intent(intent, db_path, app, active_runs)?;
    }
    Ok(AgentQueueWorkflowCreateSetupStartStepResultDto::from(
        result,
    ))
}

#[cfg(test)]
pub(crate) fn execute_agent_queue_workflow_create_setup_start_step_with_test_launcher<L>(
    request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest,
    db_path: PathBuf,
    mut launch: L,
) -> Result<AgentQueueWorkflowCreateSetupStartStepResultDto, String>
where
    L: FnMut(hobit_app::QueueWorkflowWorkerLaunchIntent, PathBuf) -> Result<(), String>,
{
    let service = workspace_service(&db_path)?;
    let result = service
        .execute_queue_workflow_create_setup_start_step(request.into())
        .map_err(command_error)?;
    if let Some(intent) = result.worker_launch_intent.clone() {
        if intent.launch_disposition
            == hobit_app::QueueWorkflowWorkerLaunchDisposition::NewlyStarted
            && intent.executor_target_kind == "queue_local"
        {
            launch(intent, db_path)?;
        }
    }
    Ok(AgentQueueWorkflowCreateSetupStartStepResultDto::from(
        result,
    ))
}

fn launch_queue_workflow_worker_intent(
    intent: hobit_app::QueueWorkflowWorkerLaunchIntent,
    db_path: PathBuf,
    app: tauri::AppHandle,
    active_runs: crate::app_state::DirectWorkActiveRunRegistry,
) -> Result<(), String> {
    if intent.launch_disposition != hobit_app::QueueWorkflowWorkerLaunchDisposition::NewlyStarted
        || intent.executor_target_kind != "queue_local"
    {
        return Ok(());
    }

    let _launch_status = spawn_queue_direct_work_background_run(
        QueueDirectWorkLaunch {
            workspace_id: intent.workspace_id,
            queue_item_id: intent.queue_task_id,
            run_id: intent.run_id,
            direct_work_input: intent.direct_work_input,
        },
        db_path,
        app,
        active_runs,
    )?;
    Ok(())
}

#[tauri::command]
pub(crate) fn execute_agent_queue_workflow_review_step(
    request: ExecuteAgentQueueWorkflowReviewStepRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowReviewStepResultDto, String> {
    execute_agent_queue_workflow_review_step_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn execute_agent_queue_workflow_review_step_blocking(
    request: ExecuteAgentQueueWorkflowReviewStepRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowReviewStepResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .execute_queue_workflow_review_step(request.into())
        .map(AgentQueueWorkflowReviewStepResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn execute_agent_queue_workflow_finalization_step(
    request: ExecuteAgentQueueWorkflowFinalizationStepRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowFinalizationStepResultDto, String> {
    execute_agent_queue_workflow_finalization_step_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn execute_agent_queue_workflow_finalization_step_blocking(
    request: ExecuteAgentQueueWorkflowFinalizationStepRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowFinalizationStepResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .execute_queue_workflow_finalization_step(request.into())
        .map(AgentQueueWorkflowFinalizationStepResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn materialize_agent_queue_workflow_task_slot(
    request: MaterializeAgentQueueWorkflowTaskSlotRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowMaterializeTaskSlotResultDto, String> {
    materialize_agent_queue_workflow_task_slot_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn materialize_agent_queue_workflow_task_slot_blocking(
    request: MaterializeAgentQueueWorkflowTaskSlotRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowMaterializeTaskSlotResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .materialize_agent_queue_workflow_task_slot(request.into())
        .map(AgentQueueWorkflowMaterializeTaskSlotResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn apply_agent_queue_workflow_run_settings(
    request: ApplyAgentQueueWorkflowRunSettingsRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowApplyRunSettingsResultDto, String> {
    apply_agent_queue_workflow_run_settings_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn apply_agent_queue_workflow_run_settings_blocking(
    request: ApplyAgentQueueWorkflowRunSettingsRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowApplyRunSettingsResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .apply_agent_queue_workflow_run_settings(request.into())
        .map(AgentQueueWorkflowApplyRunSettingsResultDto::from)
        .map_err(command_error)
}

#[tauri::command]
pub(crate) fn promote_agent_queue_workflow_task_slot(
    request: PromoteAgentQueueWorkflowTaskSlotRequest,
    state: State<'_, AppState>,
) -> Result<AgentQueueWorkflowPromoteTaskSlotResultDto, String> {
    promote_agent_queue_workflow_task_slot_blocking(request, state.db_path().to_path_buf())
}

pub(crate) fn promote_agent_queue_workflow_task_slot_blocking(
    request: PromoteAgentQueueWorkflowTaskSlotRequest,
    db_path: PathBuf,
) -> Result<AgentQueueWorkflowPromoteTaskSlotResultDto, String> {
    let service = workspace_service(&db_path)?;
    service
        .promote_agent_queue_workflow_task_slot(request.into())
        .map(AgentQueueWorkflowPromoteTaskSlotResultDto::from)
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
#[path = "agent_queue_workflow_commands/headless_smoke_tests.rs"]
mod queue_workflow_headless_smoke_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod workflow_launch_bridge_tests;
