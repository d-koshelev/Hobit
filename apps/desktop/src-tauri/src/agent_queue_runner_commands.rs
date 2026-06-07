use std::path::PathBuf;
use std::time::Duration;

use hobit_app::{
    AgentQueueTaskRunReviewStatus, AgentQueueTaskRunSource,
    RecordAgentQueueTaskRunFinalStatusInput, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;
use tauri::{AppHandle, State};

#[cfg(test)]
use crate::agent_queue_execution_commands::start_assigned_agent_queue_task_blocking_with_source;
use crate::agent_queue_execution_commands::start_assigned_agent_queue_task_from_request_with_source;
use crate::agent_queue_execution_dto::StartAssignedAgentQueueTaskRequest;
use crate::agent_queue_runner::{
    select_next_autorun_task, select_next_autorun_task_after_success, QueueAutorunTaskSelection,
    QueueRunnerPolicy, QueueRunnerRuntimeConfig, QueueRunnerSessionRegistry,
    QueueRunnerStartRequest, QueueRunnerStopReason,
};
use crate::app_state::{AppState, DirectWorkActiveRunRegistry};

mod dto;

use dto::QueueRunnerSnapshotDto;
#[cfg(test)]
pub(crate) use dto::StartAgentQueueRunnerPolicyRequest;
pub(crate) use dto::StartAgentQueueRunnerSessionRequest;

const QUEUE_AUTORUN_TICK_INTERVAL: Duration = Duration::from_secs(10);

#[tauri::command]
pub(crate) async fn start_agent_queue_runner_session(
    request: StartAgentQueueRunnerSessionRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<QueueRunnerSnapshotDto, String> {
    let db_path = state.db_path().to_path_buf();
    let active_runs = state.direct_work_active_runs();
    let registry = state.queue_runner_sessions();
    let snapshot = start_agent_queue_runner_session_once(
        request,
        app.clone(),
        db_path.clone(),
        active_runs.clone(),
        registry.clone(),
    )
    .await?;

    spawn_agent_queue_runner_tick_loop_if_active(registry, db_path, app, active_runs);

    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn stop_agent_queue_runner_session(
    state: State<'_, AppState>,
) -> Result<QueueRunnerSnapshotDto, String> {
    Ok(stop_agent_queue_runner_session_in_registry(
        state.queue_runner_sessions(),
    ))
}

#[tauri::command]
pub(crate) async fn get_agent_queue_runner_snapshot(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<QueueRunnerSnapshotDto, String> {
    Ok(reconcile_agent_queue_runner_snapshot_from_registry(
        state.queue_runner_sessions(),
        state.db_path().to_path_buf(),
        app,
        state.direct_work_active_runs(),
    )
    .await)
}

async fn start_agent_queue_runner_session_once(
    request: StartAgentQueueRunnerSessionRequest,
    app: AppHandle,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
    registry: QueueRunnerSessionRegistry,
) -> Result<QueueRunnerSnapshotDto, String> {
    let policy = request
        .policy
        .clone()
        .map(QueueRunnerPolicy::from)
        .unwrap_or_default();
    registry.start_session_with_runtime_config(
        request.workspace_id.clone(),
        request.executor_widget_instance_id.clone(),
        policy,
        runtime_config_from_request(&request),
    )?;

    if runtime_config_is_missing(&request) {
        return Ok(QueueRunnerSnapshotDto::from(
            registry.stop_with_reason(QueueRunnerStopReason::InvalidConfig),
        ));
    }

    let selection = select_autorun_task_for_request(&request, &db_path)?;
    let queue_item_id = match selection {
        QueueAutorunTaskSelection::Start { queue_item_id } => queue_item_id,
        QueueAutorunTaskSelection::Stop { reason } => {
            return Ok(QueueRunnerSnapshotDto::from(
                registry.stop_with_reason(reason),
            ));
        }
    };

    let start_response = start_assigned_agent_queue_task_from_request_with_source(
        StartAssignedAgentQueueTaskRequest {
            workspace_id: request.workspace_id.clone(),
            queue_item_id: queue_item_id.clone(),
            queue_owner_widget_instance_id: None,
            codex_executable: request.codex_executable,
            repo_root: request.repo_root,
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
        },
        app,
        db_path,
        active_runs,
        AgentQueueTaskRunSource::Autorun,
    )
    .await
    .map_err(|error| {
        let reason = stop_reason_for_start_error(&error);
        let _ = registry.stop_with_reason(reason);
        error
    })?;

    Ok(QueueRunnerSnapshotDto::from(registry.waiting_for_executor(
        start_response.queue_item_id,
        start_response.run_id,
    )))
}

#[cfg(test)]
fn start_agent_queue_runner_session_in_registry(
    request: StartAgentQueueRunnerSessionRequest,
    registry: QueueRunnerSessionRegistry,
) -> Result<QueueRunnerSnapshotDto, String> {
    let policy = request
        .policy
        .map(QueueRunnerPolicy::from)
        .unwrap_or_default();
    registry
        .start_session(
            request.workspace_id,
            request.executor_widget_instance_id,
            policy,
        )
        .map(QueueRunnerSnapshotDto::from)
}

#[cfg(test)]
fn start_agent_queue_runner_session_once_without_background(
    request: StartAgentQueueRunnerSessionRequest,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
    registry: QueueRunnerSessionRegistry,
) -> Result<QueueRunnerSnapshotDto, String> {
    let policy = request
        .policy
        .clone()
        .map(QueueRunnerPolicy::from)
        .unwrap_or_default();
    registry.start_session_with_runtime_config(
        request.workspace_id.clone(),
        request.executor_widget_instance_id.clone(),
        policy,
        runtime_config_from_request(&request),
    )?;

    if runtime_config_is_missing(&request) {
        return Ok(QueueRunnerSnapshotDto::from(
            registry.stop_with_reason(QueueRunnerStopReason::InvalidConfig),
        ));
    }

    let selection = select_autorun_task_for_request(&request, &db_path)?;
    let queue_item_id = match selection {
        QueueAutorunTaskSelection::Start { queue_item_id } => queue_item_id,
        QueueAutorunTaskSelection::Stop { reason } => {
            return Ok(QueueRunnerSnapshotDto::from(
                registry.stop_with_reason(reason),
            ));
        }
    };

    let start = start_assigned_agent_queue_task_blocking_with_source(
        StartAssignedAgentQueueTaskRequest {
            workspace_id: request.workspace_id.clone(),
            queue_item_id: queue_item_id.clone(),
            queue_owner_widget_instance_id: None,
            codex_executable: request.codex_executable,
            repo_root: request.repo_root,
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
        },
        db_path,
        active_runs,
        AgentQueueTaskRunSource::Autorun,
    )
    .map_err(|error| {
        let reason = stop_reason_for_start_error(&error);
        let _ = registry.stop_with_reason(reason);
        error
    })?;

    Ok(QueueRunnerSnapshotDto::from(
        registry.waiting_for_executor(start.queue_item_id, start.run_id),
    ))
}

fn select_autorun_task_for_request(
    request: &StartAgentQueueRunnerSessionRequest,
    db_path: &std::path::Path,
) -> Result<QueueAutorunTaskSelection, String> {
    let service = workspace_service(db_path)?;
    let tasks = service
        .list_agent_queue_tasks(&request.workspace_id)
        .map_err(command_error)?;

    Ok(select_next_autorun_task(
        &tasks,
        &request.executor_widget_instance_id,
    ))
}

fn select_autorun_continuation_task_for_request(
    request: &QueueRunnerStartRequest,
    db_path: &std::path::Path,
) -> Result<QueueAutorunTaskSelection, String> {
    let service = workspace_service(db_path)?;
    let tasks = service
        .list_agent_queue_tasks(&request.workspace_id)
        .map_err(command_error)?;

    Ok(select_next_autorun_task_after_success(
        &tasks,
        &request.executor_widget_instance_id,
    ))
}

fn runtime_config_is_missing(request: &StartAgentQueueRunnerSessionRequest) -> bool {
    request.codex_executable.trim().is_empty()
        || request.repo_root.trim().is_empty()
        || request.sandbox.trim().is_empty()
        || request.approval_policy.trim().is_empty()
}

fn stored_runtime_config_is_missing(request: &QueueRunnerStartRequest) -> bool {
    request.runtime_config.codex_executable.trim().is_empty()
        || request.runtime_config.repo_root.trim().is_empty()
        || request.runtime_config.sandbox.trim().is_empty()
        || request.runtime_config.approval_policy.trim().is_empty()
}

fn runtime_config_from_request(
    request: &StartAgentQueueRunnerSessionRequest,
) -> QueueRunnerRuntimeConfig {
    let mut runtime_config = QueueRunnerRuntimeConfig::new(
        request.codex_executable.clone(),
        request.repo_root.clone(),
        request.sandbox.clone(),
        request.approval_policy.clone(),
    );
    runtime_config.timeout_ms = request.timeout_ms;
    runtime_config.stdout_cap_bytes = request.stdout_cap_bytes;
    runtime_config.stderr_cap_bytes = request.stderr_cap_bytes;
    runtime_config
}

fn stop_reason_for_start_error(error: &str) -> QueueRunnerStopReason {
    if error.contains("active Direct Work run") {
        QueueRunnerStopReason::ExecutorBusy
    } else if error.contains("prompt must not be empty") {
        QueueRunnerStopReason::MissingPrompt
    } else if error.contains("assigned to an Agent Executor")
        || error.contains("executor widget not found")
        || error.contains("assigned widget is not an Agent Executor")
    {
        QueueRunnerStopReason::MissingExecutor
    } else {
        QueueRunnerStopReason::InvalidConfig
    }
}

fn workspace_service(db_path: &std::path::Path) -> Result<WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(WorkspaceService::new)
        .map_err(command_error)
}

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn stop_agent_queue_runner_session_in_registry(
    registry: QueueRunnerSessionRegistry,
) -> QueueRunnerSnapshotDto {
    QueueRunnerSnapshotDto::from(registry.stop_session())
}

#[cfg(test)]
fn get_agent_queue_runner_snapshot_from_registry(
    registry: QueueRunnerSessionRegistry,
) -> QueueRunnerSnapshotDto {
    QueueRunnerSnapshotDto::from(registry.snapshot())
}

async fn reconcile_agent_queue_runner_snapshot_from_registry(
    registry: QueueRunnerSessionRegistry,
    db_path: PathBuf,
    app: AppHandle,
    active_runs: DirectWorkActiveRunRegistry,
) -> QueueRunnerSnapshotDto {
    let snapshot = registry.snapshot();
    if snapshot.status.as_str() != "waiting_for_executor" {
        return QueueRunnerSnapshotDto::from(snapshot);
    }

    let Some(run_id) = snapshot.waiting_run_id.clone() else {
        return QueueRunnerSnapshotDto::from(snapshot);
    };

    let Ok(store) = SqliteStore::open(&db_path) else {
        return QueueRunnerSnapshotDto::from(snapshot);
    };

    match store.get_widget_run(&run_id) {
        Ok(Some(run)) => {
            let observed = registry.observe_waiting_run_for_reconciliation(
                &run_id,
                &run.status,
                run.finished_at.is_some(),
            );
            if run.finished_at.is_some() {
                if let Some(start_request) = registry.start_request() {
                    record_autorun_run_link_final_status(
                        &db_path,
                        &start_request.workspace_id,
                        &start_request.executor_widget_instance_id,
                        &snapshot,
                        &run_id,
                        &run.status,
                        run.finished_at.clone(),
                    );
                }
            }
            if observed.should_continue_after_success {
                continue_agent_queue_runner_after_success(registry, db_path, app, active_runs).await
            } else {
                QueueRunnerSnapshotDto::from(observed.snapshot)
            }
        }
        Ok(None) => QueueRunnerSnapshotDto::from(registry.observe_missing_waiting_run(&run_id)),
        Err(_) => QueueRunnerSnapshotDto::from(snapshot),
    }
}

async fn continue_agent_queue_runner_after_success(
    registry: QueueRunnerSessionRegistry,
    db_path: PathBuf,
    app: AppHandle,
    active_runs: DirectWorkActiveRunRegistry,
) -> QueueRunnerSnapshotDto {
    let Some(start_request) = registry.start_request() else {
        return QueueRunnerSnapshotDto::from(
            registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
        );
    };

    if registry
        .try_mark_continuation_starting(&start_request.session_id)
        .is_none()
    {
        return QueueRunnerSnapshotDto::from(registry.snapshot());
    }

    if stored_runtime_config_is_missing(&start_request) {
        return QueueRunnerSnapshotDto::from(
            registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
        );
    }

    let selection = match select_autorun_continuation_task_for_request(&start_request, &db_path) {
        Ok(selection) => selection,
        Err(_) => {
            return QueueRunnerSnapshotDto::from(
                registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
            );
        }
    };

    let queue_item_id = match selection {
        QueueAutorunTaskSelection::Start { queue_item_id } => queue_item_id,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::NoRunnableTasks,
        } => {
            return QueueRunnerSnapshotDto::from(
                registry.complete_without_continuation(QueueRunnerStopReason::NoRunnableTasks),
            );
        }
        QueueAutorunTaskSelection::Stop { reason } => {
            return QueueRunnerSnapshotDto::from(registry.stop_after_final_status(reason));
        }
    };

    let start_response = match start_assigned_agent_queue_task_from_request_with_source(
        match continuation_start_request(&start_request, queue_item_id) {
            Ok(request) => request,
            Err(_) => {
                return QueueRunnerSnapshotDto::from(
                    registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
                );
            }
        },
        app,
        db_path,
        active_runs,
        AgentQueueTaskRunSource::Autorun,
    )
    .await
    {
        Ok(start_response) => start_response,
        Err(error) => {
            let reason = stop_reason_for_start_error(&error);
            return QueueRunnerSnapshotDto::from(registry.stop_after_final_status(reason));
        }
    };

    QueueRunnerSnapshotDto::from(registry.waiting_for_executor_after_continuation(
        start_response.queue_item_id,
        start_response.run_id,
    ))
}

fn spawn_agent_queue_runner_tick_loop_if_active(
    registry: QueueRunnerSessionRegistry,
    db_path: PathBuf,
    app: AppHandle,
    active_runs: DirectWorkActiveRunRegistry,
) {
    let Some(session_id) = registry.try_claim_tick_loop() else {
        return;
    };

    tauri::async_runtime::spawn({
        let registry = registry.clone();
        async move {
            loop {
                sleep_queue_autorun_tick_interval().await;

                if !registry.tick_loop_should_continue(&session_id) {
                    break;
                }

                let _snapshot = run_agent_queue_runner_tick(
                    registry.clone(),
                    db_path.clone(),
                    app.clone(),
                    active_runs.clone(),
                )
                .await;

                if !registry.tick_loop_should_continue(&session_id) {
                    break;
                }
            }

            registry.release_tick_loop(&session_id);
        }
    });
}

async fn sleep_queue_autorun_tick_interval() {
    let _ = tauri::async_runtime::spawn_blocking(|| {
        std::thread::sleep(QUEUE_AUTORUN_TICK_INTERVAL);
    })
    .await;
}

async fn run_agent_queue_runner_tick(
    registry: QueueRunnerSessionRegistry,
    db_path: PathBuf,
    app: AppHandle,
    active_runs: DirectWorkActiveRunRegistry,
) -> QueueRunnerSnapshotDto {
    reconcile_agent_queue_runner_snapshot_from_registry(registry, db_path, app, active_runs).await
}

fn continuation_start_request(
    request: &QueueRunnerStartRequest,
    queue_item_id: String,
) -> Result<StartAssignedAgentQueueTaskRequest, String> {
    Ok(StartAssignedAgentQueueTaskRequest {
        workspace_id: request.workspace_id.clone(),
        queue_item_id,
        queue_owner_widget_instance_id: None,
        codex_executable: request.runtime_config.codex_executable.clone(),
        repo_root: request.runtime_config.repo_root.clone(),
        sandbox: request.runtime_config.sandbox.clone(),
        approval_policy: request.runtime_config.approval_policy.clone(),
        timeout_ms: request.runtime_config.timeout_ms,
        stdout_cap_bytes: request.runtime_config.stdout_cap_bytes,
        stderr_cap_bytes: request.runtime_config.stderr_cap_bytes,
    })
}

fn record_autorun_run_link_final_status(
    db_path: &std::path::Path,
    workspace_id: &str,
    executor_widget_id: &str,
    snapshot: &crate::agent_queue_runner::QueueRunnerSnapshot,
    run_id: &str,
    status: &str,
    completed_at: Option<String>,
) {
    let Some(queue_item_id) = snapshot.active_queue_item_id.clone() else {
        return;
    };
    let Ok(service) = workspace_service(db_path) else {
        return;
    };
    let _ =
        service.record_agent_queue_task_run_final_status(RecordAgentQueueTaskRunFinalStatusInput {
            workspace_id: workspace_id.to_owned(),
            queue_task_id: queue_item_id,
            executor_widget_id: executor_widget_id.to_owned(),
            direct_work_run_id: run_id.to_owned(),
            status: status.to_owned(),
            completed_at,
            validation_status: None,
            review_status: Some(AgentQueueTaskRunReviewStatus::ReviewNeeded),
        });
}

#[cfg(test)]
fn reconcile_agent_queue_runner_snapshot_from_registry_without_background(
    registry: QueueRunnerSessionRegistry,
    db_path: &std::path::Path,
    active_runs: DirectWorkActiveRunRegistry,
) -> QueueRunnerSnapshotDto {
    let snapshot = registry.snapshot();
    if snapshot.status.as_str() != "waiting_for_executor" {
        return QueueRunnerSnapshotDto::from(snapshot);
    }

    let Some(run_id) = snapshot.waiting_run_id.clone() else {
        return QueueRunnerSnapshotDto::from(snapshot);
    };

    let Ok(store) = SqliteStore::open(db_path) else {
        return QueueRunnerSnapshotDto::from(snapshot);
    };

    match store.get_widget_run(&run_id) {
        Ok(Some(run)) => {
            let observed = registry.observe_waiting_run_for_reconciliation(
                &run_id,
                &run.status,
                run.finished_at.is_some(),
            );
            if run.finished_at.is_some() {
                if let Some(start_request) = registry.start_request() {
                    record_autorun_run_link_final_status(
                        db_path,
                        &start_request.workspace_id,
                        &start_request.executor_widget_instance_id,
                        &snapshot,
                        &run_id,
                        &run.status,
                        run.finished_at.clone(),
                    );
                }
            }
            if observed.should_continue_after_success {
                continue_agent_queue_runner_after_success_without_background(
                    registry,
                    db_path.to_path_buf(),
                    active_runs,
                )
            } else {
                QueueRunnerSnapshotDto::from(observed.snapshot)
            }
        }
        Ok(None) => QueueRunnerSnapshotDto::from(registry.observe_missing_waiting_run(&run_id)),
        Err(_) => QueueRunnerSnapshotDto::from(snapshot),
    }
}

#[cfg(test)]
fn continue_agent_queue_runner_after_success_without_background(
    registry: QueueRunnerSessionRegistry,
    db_path: PathBuf,
    active_runs: DirectWorkActiveRunRegistry,
) -> QueueRunnerSnapshotDto {
    let Some(start_request) = registry.start_request() else {
        return QueueRunnerSnapshotDto::from(
            registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
        );
    };

    if registry
        .try_mark_continuation_starting(&start_request.session_id)
        .is_none()
    {
        return QueueRunnerSnapshotDto::from(registry.snapshot());
    }

    if stored_runtime_config_is_missing(&start_request) {
        return QueueRunnerSnapshotDto::from(
            registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
        );
    }

    let selection = match select_autorun_continuation_task_for_request(&start_request, &db_path) {
        Ok(selection) => selection,
        Err(_) => {
            return QueueRunnerSnapshotDto::from(
                registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
            );
        }
    };

    let queue_item_id = match selection {
        QueueAutorunTaskSelection::Start { queue_item_id } => queue_item_id,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::NoRunnableTasks,
        } => {
            return QueueRunnerSnapshotDto::from(
                registry.complete_without_continuation(QueueRunnerStopReason::NoRunnableTasks),
            );
        }
        QueueAutorunTaskSelection::Stop { reason } => {
            return QueueRunnerSnapshotDto::from(registry.stop_after_final_status(reason));
        }
    };

    let continuation_request = match continuation_start_request(&start_request, queue_item_id) {
        Ok(request) => request,
        Err(_) => {
            return QueueRunnerSnapshotDto::from(
                registry.stop_after_final_status(QueueRunnerStopReason::InvalidConfig),
            );
        }
    };

    let start_response = match start_assigned_agent_queue_task_blocking_with_source(
        continuation_request,
        db_path,
        active_runs,
        AgentQueueTaskRunSource::Autorun,
    ) {
        Ok(start_response) => start_response,
        Err(error) => {
            let reason = stop_reason_for_start_error(&error);
            return QueueRunnerSnapshotDto::from(registry.stop_after_final_status(reason));
        }
    };

    QueueRunnerSnapshotDto::from(registry.waiting_for_executor_after_continuation(
        start_response.queue_item_id,
        start_response.run_id,
    ))
}

#[cfg(test)]
fn run_agent_queue_runner_tick_without_background(
    registry: QueueRunnerSessionRegistry,
    db_path: &std::path::Path,
    active_runs: DirectWorkActiveRunRegistry,
) -> QueueRunnerSnapshotDto {
    reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        db_path,
        active_runs,
    )
}

#[cfg(test)]
mod tests;
