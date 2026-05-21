use serde::{Deserialize, Serialize};
use tauri::State;

use crate::agent_queue_runner::{
    QueueRunnerPolicy, QueueRunnerSessionRegistry, QueueRunnerSnapshot,
};
use crate::app_state::AppState;

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct StartAgentQueueRunnerSessionRequest {
    pub workspace_id: String,
    pub executor_widget_instance_id: String,
    #[serde(default)]
    pub policy: Option<StartAgentQueueRunnerPolicyRequest>,
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
pub(crate) fn start_agent_queue_runner_session(
    request: StartAgentQueueRunnerSessionRequest,
    state: State<'_, AppState>,
) -> Result<QueueRunnerSnapshotDto, String> {
    start_agent_queue_runner_session_in_registry(request, state.queue_runner_sessions())
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
