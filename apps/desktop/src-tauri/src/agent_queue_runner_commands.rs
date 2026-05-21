use std::fmt;
use std::path::PathBuf;

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[cfg(test)]
use crate::agent_queue_execution_commands::start_assigned_agent_queue_task_blocking;
use crate::agent_queue_execution_commands::start_assigned_agent_queue_task_from_request;
use crate::agent_queue_execution_dto::StartAssignedAgentQueueTaskRequest;
use crate::agent_queue_runner::{
    select_next_autorun_task, QueueAutorunTaskSelection, QueueRunnerPolicy,
    QueueRunnerSessionRegistry, QueueRunnerSnapshot, QueueRunnerStopReason,
};
use crate::app_state::{AppState, DirectWorkActiveRunRegistry};

#[derive(Clone, Eq, PartialEq, Deserialize)]
pub(crate) struct StartAgentQueueRunnerSessionRequest {
    pub workspace_id: String,
    pub executor_widget_instance_id: String,
    pub codex_executable: String,
    pub repo_root: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
    #[serde(default)]
    pub policy: Option<StartAgentQueueRunnerPolicyRequest>,
}

impl fmt::Debug for StartAgentQueueRunnerSessionRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("StartAgentQueueRunnerSessionRequest")
            .field("workspace_id", &"<redacted>")
            .field("executor_widget_instance_id", &"<redacted>")
            .field("codex_executable", &"<redacted>")
            .field("repo_root", &"<redacted>")
            .field("sandbox", &"<redacted>")
            .field("approval_policy", &"<redacted>")
            .field("timeout_ms", &self.timeout_ms)
            .field("stdout_cap_bytes", &self.stdout_cap_bytes)
            .field("stderr_cap_bytes", &self.stderr_cap_bytes)
            .field("policy", &self.policy)
            .finish()
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct StartAgentQueueRunnerPolicyRequest {
    #[serde(default)]
    pub stop_on_failure: Option<bool>,
    #[serde(default)]
    pub stop_on_review_needed: Option<bool>,
    #[serde(default)]
    pub stop_on_cancel: Option<bool>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueRunnerPolicyDto {
    pub require_operator_start: bool,
    pub one_task_at_a_time: bool,
    pub stop_on_failure: bool,
    pub stop_on_review_needed: bool,
    pub stop_on_cancel: bool,
    pub allow_hidden_execution: bool,
    pub durable_resume: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueRunnerSnapshotDto {
    pub session_id: Option<String>,
    pub status: String,
    pub is_active: bool,
    pub is_session_only: bool,
    pub policy: QueueRunnerPolicyDto,
    pub active_queue_item_id: Option<String>,
    pub waiting_run_id: Option<String>,
    pub stop_reason: Option<String>,
}

#[tauri::command]
pub(crate) async fn start_agent_queue_runner_session(
    request: StartAgentQueueRunnerSessionRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<QueueRunnerSnapshotDto, String> {
    let snapshot = start_agent_queue_runner_session_once(
        request,
        app,
        state.db_path().to_path_buf(),
        state.direct_work_active_runs(),
        state.queue_runner_sessions(),
    )
    .await?;

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
pub(crate) fn get_agent_queue_runner_snapshot(
    state: State<'_, AppState>,
) -> Result<QueueRunnerSnapshotDto, String> {
    Ok(get_agent_queue_runner_snapshot_from_registry(
        state.queue_runner_sessions(),
    ))
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
    registry.start_session(
        request.workspace_id.clone(),
        request.executor_widget_instance_id.clone(),
        policy,
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

    let start_response = start_assigned_agent_queue_task_from_request(
        StartAssignedAgentQueueTaskRequest {
            workspace_id: request.workspace_id,
            queue_item_id: queue_item_id.clone(),
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
    registry.start_session(
        request.workspace_id.clone(),
        request.executor_widget_instance_id.clone(),
        policy,
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

    let start = start_assigned_agent_queue_task_blocking(
        StartAssignedAgentQueueTaskRequest {
            workspace_id: request.workspace_id,
            queue_item_id,
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

fn runtime_config_is_missing(request: &StartAgentQueueRunnerSessionRequest) -> bool {
    request.codex_executable.trim().is_empty()
        || request.repo_root.trim().is_empty()
        || request.sandbox.trim().is_empty()
        || request.approval_policy.trim().is_empty()
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

fn get_agent_queue_runner_snapshot_from_registry(
    registry: QueueRunnerSessionRegistry,
) -> QueueRunnerSnapshotDto {
    QueueRunnerSnapshotDto::from(registry.snapshot())
}

impl From<StartAgentQueueRunnerPolicyRequest> for QueueRunnerPolicy {
    fn from(request: StartAgentQueueRunnerPolicyRequest) -> Self {
        let mut policy = QueueRunnerPolicy::default();
        if let Some(stop_on_failure) = request.stop_on_failure {
            policy.stop_on_failure = stop_on_failure;
        }
        if let Some(stop_on_review_needed) = request.stop_on_review_needed {
            policy.stop_on_review_needed = stop_on_review_needed;
        }
        if let Some(stop_on_cancel) = request.stop_on_cancel {
            policy.stop_on_cancel = stop_on_cancel;
        }
        policy
    }
}

impl From<QueueRunnerPolicy> for QueueRunnerPolicyDto {
    fn from(policy: QueueRunnerPolicy) -> Self {
        Self {
            require_operator_start: policy.require_operator_start,
            one_task_at_a_time: policy.one_task_at_a_time,
            stop_on_failure: policy.stop_on_failure,
            stop_on_review_needed: policy.stop_on_review_needed,
            stop_on_cancel: policy.stop_on_cancel,
            allow_hidden_execution: policy.allow_hidden_execution,
            durable_resume: policy.durable_resume,
        }
    }
}

impl From<QueueRunnerSnapshot> for QueueRunnerSnapshotDto {
    fn from(snapshot: QueueRunnerSnapshot) -> Self {
        Self {
            session_id: snapshot
                .session_id
                .as_ref()
                .map(|session_id| session_id.as_str().to_owned()),
            status: snapshot.status.as_str().to_owned(),
            is_active: snapshot.status.is_active(),
            is_session_only: snapshot.is_session_only(),
            policy: QueueRunnerPolicyDto::from(snapshot.policy),
            active_queue_item_id: snapshot.active_queue_item_id,
            waiting_run_id: snapshot.waiting_run_id,
            stop_reason: snapshot
                .stop_reason
                .map(|stop_reason| stop_reason.as_str().to_owned()),
        }
    }
}

#[cfg(test)]
mod tests;
