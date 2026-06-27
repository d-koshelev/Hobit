use std::path::{Path, PathBuf};

use hobit_app::{
    AssignedAgentQueueTaskStartSummary, FinishAssignedAgentQueueTaskRunInput,
    RunCodexDirectWorkInput, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;
use tauri::Emitter;

use crate::app_state::{DirectWorkActiveRun, DirectWorkActiveRunRegistry};
use crate::codex_direct_work_dto::{DirectWorkStreamEventDto, DIRECT_WORK_STREAM_EVENT_NAME};
use crate::direct_work_host_artifacts::{
    DirectWorkHostRuntimeBoundarySummary, DirectWorkHostStartRuntimeArtifacts,
    DirectWorkHostStreamEventRuntimeArtifact,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct QueueDirectWorkLaunch {
    pub(crate) workspace_id: String,
    pub(crate) queue_item_id: String,
    pub(crate) run_id: String,
    pub(crate) direct_work_input: RunCodexDirectWorkInput,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum QueueDirectWorkLaunchStatus {
    Spawned,
    AlreadyActive,
    BlockedActiveWidget,
}

impl QueueDirectWorkLaunch {
    pub(crate) fn from_start_summary(start: &AssignedAgentQueueTaskStartSummary) -> Self {
        Self {
            workspace_id: start.workspace_id.clone(),
            queue_item_id: start.queue_item_id.clone(),
            run_id: start.run_id.clone(),
            direct_work_input: start.direct_work_input.clone(),
        }
    }
}

pub(crate) fn spawn_queue_direct_work_background_run(
    launch: QueueDirectWorkLaunch,
    db_path: PathBuf,
    app: tauri::AppHandle,
    active_runs: DirectWorkActiveRunRegistry,
) -> Result<QueueDirectWorkLaunchStatus, String> {
    if active_runs.has_active_run(&launch.run_id) {
        return Ok(QueueDirectWorkLaunchStatus::AlreadyActive);
    }
    if active_runs.has_active_widget_run(
        &launch.direct_work_input.workspace_id,
        &launch.direct_work_input.workbench_id,
        &launch.direct_work_input.widget_instance_id,
    ) {
        finish_queue_direct_work_launch(&launch, &db_path, "failed")?;
        return Ok(QueueDirectWorkLaunchStatus::BlockedActiveWidget);
    }

    let cancellation_token = hobit_app::CodexDirectStreamCancellationToken::new();
    let _host_start_artifacts =
        DirectWorkHostStartRuntimeArtifacts::from_input(&launch.direct_work_input);
    let registered = active_runs.try_register(DirectWorkActiveRun::new(
        launch.run_id.clone(),
        launch.direct_work_input.workspace_id.clone(),
        launch.direct_work_input.workbench_id.clone(),
        launch.direct_work_input.widget_instance_id.clone(),
        cancellation_token.clone(),
    ));
    if !registered {
        return Ok(QueueDirectWorkLaunchStatus::AlreadyActive);
    }

    let run_id = launch.run_id.clone();
    let background_active_runs = active_runs.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = run_queue_direct_work_background(launch, db_path, app, cancellation_token);
        background_active_runs.unregister(&run_id);
        if let Err(error) = result {
            let _host_error_artifact =
                DirectWorkHostRuntimeBoundarySummary::from_host_error(&error);
            eprintln!("Assigned Agent Queue task background run failed: {error}");
        }
    });

    Ok(QueueDirectWorkLaunchStatus::Spawned)
}

#[cfg(test)]
pub(crate) fn finish_queue_direct_work_launch_for_test(
    launch: QueueDirectWorkLaunch,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
    direct_work_status: &str,
) -> Result<QueueDirectWorkLaunchStatus, String> {
    if active_runs.has_active_run(&launch.run_id) {
        return Ok(QueueDirectWorkLaunchStatus::AlreadyActive);
    }
    let cancellation_token = hobit_app::CodexDirectStreamCancellationToken::new();
    let registered = active_runs.try_register(DirectWorkActiveRun::new(
        launch.run_id.clone(),
        launch.direct_work_input.workspace_id.clone(),
        launch.direct_work_input.workbench_id.clone(),
        launch.direct_work_input.widget_instance_id.clone(),
        cancellation_token,
    ));
    if !registered {
        return Ok(QueueDirectWorkLaunchStatus::AlreadyActive);
    }
    let status = finish_queue_direct_work_launch(&launch, &db_path, direct_work_status);
    active_runs.unregister(&launch.run_id);
    status.map(|_| QueueDirectWorkLaunchStatus::Spawned)
}

fn run_queue_direct_work_background(
    launch: QueueDirectWorkLaunch,
    db_path: PathBuf,
    app: tauri::AppHandle,
    cancellation_token: hobit_app::CodexDirectStreamCancellationToken,
) -> Result<(), String> {
    let service = match workspace_service(&db_path) {
        Ok(service) => service,
        Err(error) => {
            let _ = finish_queue_direct_work_launch(&launch, &db_path, "failed");
            return Err(error);
        }
    };
    let executor_widget_instance_id = launch.direct_work_input.widget_instance_id.clone();
    let result =
        if executor_widget_instance_id == hobit_app::QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID {
            service.run_backend_owned_agent_queue_direct_work_stream_with_cancellation(
                launch.direct_work_input.clone(),
                &launch.run_id,
                cancellation_token,
                |event| emit_direct_work_stream_event(&app, event),
            )
        } else {
            service.run_codex_direct_work_stream_with_cancellation(
                launch.direct_work_input.clone(),
                &launch.run_id,
                cancellation_token,
                |event| emit_direct_work_stream_event(&app, event),
            )
        };

    match result {
        Ok(Some(summary)) => finish_queue_direct_work_launch(&launch, &db_path, &summary.status),
        Ok(None) => finish_queue_direct_work_launch(&launch, &db_path, "failed"),
        Err(error) => {
            let error = command_error(error);
            let _host_error_artifact =
                DirectWorkHostRuntimeBoundarySummary::from_host_error(&error);
            let _ = finish_queue_direct_work_launch(&launch, &db_path, "failed");
            Err(error)
        }
    }
}

fn finish_queue_direct_work_launch(
    launch: &QueueDirectWorkLaunch,
    db_path: &Path,
    direct_work_status: &str,
) -> Result<(), String> {
    let service = workspace_service(db_path)?;
    service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: launch.workspace_id.clone(),
            queue_item_id: launch.queue_item_id.clone(),
            executor_widget_instance_id: launch.direct_work_input.widget_instance_id.clone(),
            run_id: launch.run_id.clone(),
            direct_work_status: direct_work_status.to_owned(),
        })
        .map(|_| ())
        .map_err(command_error)
}

fn emit_direct_work_stream_event(
    app: &tauri::AppHandle,
    event: hobit_app::CodexDirectWorkStreamEventSummary,
) {
    let _event_artifact = DirectWorkHostStreamEventRuntimeArtifact::from_event(&event);
    let emit_result = app.emit(
        DIRECT_WORK_STREAM_EVENT_NAME,
        DirectWorkStreamEventDto::from(event),
    );
    let _emit_artifact = match &emit_result {
        Ok(_) => DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(None),
        Err(error) => {
            let error_message = error.to_string();
            DirectWorkHostRuntimeBoundarySummary::from_event_emit_result(Some(&error_message))
        }
    };
    let _ = emit_result;
}

fn workspace_service(db_path: &Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}
