use std::path::{Path, PathBuf};

use hobit_app::{AgentQueueTaskRunSource, FinishAssignedAgentQueueTaskRunInput, WorkspaceService};
use hobit_storage_sqlite::SqliteStore;
use tauri::{Emitter, State};

use crate::agent_queue_execution_dto::{
    StartAssignedAgentQueueTaskRequest, StartAssignedAgentQueueTaskResponseDto,
};
use crate::app_state::{AppState, DirectWorkActiveRun, DirectWorkActiveRunRegistry};
use crate::codex_direct_work_dto::{DirectWorkStreamEventDto, DIRECT_WORK_STREAM_EVENT_NAME};
use crate::direct_work_host_artifacts::{
    DirectWorkHostRuntimeBoundarySummary, DirectWorkHostStartRuntimeArtifacts,
    DirectWorkHostStreamEventRuntimeArtifact,
};

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

    let run_id = start.run_id.clone();
    let cancellation_token = hobit_app::CodexDirectStreamCancellationToken::new();
    let _host_start_artifacts =
        DirectWorkHostStartRuntimeArtifacts::from_input(&start.direct_work_input);
    active_runs.register(DirectWorkActiveRun::new(
        run_id.clone(),
        start.workspace_id.clone(),
        start.workbench_id.clone(),
        start.executor_widget_instance_id.clone(),
        cancellation_token.clone(),
    ));
    let response = StartAssignedAgentQueueTaskResponseDto::from(start.clone());
    let background_active_runs = active_runs.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = run_assigned_agent_queue_task_background(
            start.direct_work_input.clone(),
            start.queue_item_id.clone(),
            run_id.clone(),
            db_path,
            app,
            cancellation_token,
        );
        background_active_runs.unregister(&run_id);
        if let Err(error) = result {
            let _host_error_artifact =
                DirectWorkHostRuntimeBoundarySummary::from_host_error(&error);
            eprintln!("Assigned Agent Queue task background run failed: {error}");
        }
    });

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
    let service = workspace_service(&db_path)?;
    let plan = service
        .prepare_assigned_agent_queue_task_run(input.clone())
        .map_err(command_error)?;

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

    service
        .start_assigned_agent_queue_task_with_run_source(input, source)
        .map_err(command_error)
}

fn run_assigned_agent_queue_task_background(
    input: hobit_app::RunCodexDirectWorkInput,
    queue_item_id: String,
    run_id: String,
    db_path: PathBuf,
    app: tauri::AppHandle,
    cancellation_token: hobit_app::CodexDirectStreamCancellationToken,
) -> Result<(), String> {
    let service = workspace_service(&db_path)?;
    let executor_widget_instance_id = input.widget_instance_id.clone();
    let workspace_id = input.workspace_id.clone();
    let result = service.run_codex_direct_work_stream_with_cancellation(
        input,
        &run_id,
        cancellation_token,
        |event| {
            let _event_artifact = DirectWorkHostStreamEventRuntimeArtifact::from_event(&event);
            let emit_result = app.emit(
                DIRECT_WORK_STREAM_EVENT_NAME,
                DirectWorkStreamEventDto::from(event),
            );
            let _emit_artifact = match &emit_result {
                Ok(_) => DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(None),
                Err(error) => {
                    let error_message = error.to_string();
                    DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(Some(
                        &error_message,
                    ))
                }
            };
            let _ = emit_result;
        },
    );

    match result {
        Ok(Some(summary)) => service
            .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
                workspace_id,
                queue_item_id,
                executor_widget_instance_id,
                run_id,
                direct_work_status: summary.status,
            })
            .map(|_| ())
            .map_err(command_error),
        Ok(None) => service
            .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
                workspace_id,
                queue_item_id,
                executor_widget_instance_id,
                run_id,
                direct_work_status: "failed".to_owned(),
            })
            .map(|_| ())
            .map_err(command_error),
        Err(error) => {
            let error = command_error(error);
            let _host_error_artifact =
                DirectWorkHostRuntimeBoundarySummary::from_host_error(&error);
            let _ = service.finish_assigned_agent_queue_task_run(
                FinishAssignedAgentQueueTaskRunInput {
                    workspace_id,
                    queue_item_id,
                    executor_widget_instance_id,
                    run_id,
                    direct_work_status: "failed".to_owned(),
                },
            );
            Err(error)
        }
    }
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
