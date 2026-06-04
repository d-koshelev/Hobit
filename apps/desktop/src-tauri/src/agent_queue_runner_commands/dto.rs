use std::fmt;

use serde::{Deserialize, Serialize};

use crate::agent_queue_runner::{QueueRunnerPolicy, QueueRunnerSnapshot};

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
    pub final_run_status: Option<String>,
    pub last_reconciled_at: Option<String>,
    pub stop_reason: Option<String>,
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
            final_run_status: snapshot.final_run_status,
            last_reconciled_at: snapshot.last_reconciled_at,
            stop_reason: snapshot
                .stop_reason
                .map(|stop_reason| stop_reason.as_str().to_owned()),
        }
    }
}
