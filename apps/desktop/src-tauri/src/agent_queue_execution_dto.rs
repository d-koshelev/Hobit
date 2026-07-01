use std::path::PathBuf;

use hobit_app::{
    AgentQueueTaskRunSummary, AssignedAgentQueueTaskStartSummary, ListStaleQueueLocalRunsInput,
    QueueStaleRunCandidateSummary, QueueWorkerStartBlocker, QueueWorkerStartContext,
    RecoverStaleQueueLocalRunInput, RecoverStaleQueueLocalRunResult,
    SelectedAgentQueueTaskLocalStartSummary, StartAssignedAgentQueueTaskInput,
    StartSelectedAgentQueueTaskLocalInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct StartAssignedAgentQueueTaskRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub queue_owner_widget_instance_id: Option<String>,
    pub codex_executable: String,
    pub repo_root: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
    pub workflow_start_context: Option<QueueWorkerStartContextRequest>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct QueueWorkerStartContextRequest {
    pub workflow_run_id: String,
    pub workflow_action_id: Option<String>,
    pub action_idempotency_key: Option<String>,
    #[serde(default)]
    pub slot: Option<String>,
    pub task_id: String,
    #[serde(default)]
    pub executor_widget_id: Option<String>,
    pub settings_hash: String,
    #[serde(default)]
    pub execution_target_hash: Option<String>,
    pub expected_queue_control_version: Option<i64>,
    pub actor_id: Option<String>,
    pub confirmation_token: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct StartAssignedAgentQueueTaskResponseDto {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub workbench_id: String,
    pub executor_widget_instance_id: String,
    pub run_id: String,
    pub status: String,
    pub workflow_run_id: Option<String>,
    pub workflow_action_id: Option<String>,
    pub action_idempotency_key: Option<String>,
    pub settings_hash: Option<String>,
    pub current_run_state: Option<String>,
    pub blocker: Option<QueueWorkerStartBlockerDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub(crate) struct StartSelectedAgentQueueTaskLocalRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct StartSelectedAgentQueueTaskLocalResponseDto {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_link_id: Option<String>,
    pub run_id: Option<String>,
    pub status: String,
    pub blocked_reason: Option<String>,
    pub blocker_code: Option<String>,
    pub current_run_state: Option<String>,
    pub would_start_workers: bool,
    pub created_widget_run: bool,
    pub created_run_link: bool,
    pub used_workflow_slot: bool,
    pub used_widget_identity: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueWorkerStartBlockerDto {
    pub blocker_code: String,
    pub blocker_message: String,
    pub task_id: Option<String>,
    pub executor_widget_id: Option<String>,
    pub run_id: Option<String>,
    pub workflow_run_id: Option<String>,
    pub workflow_action_id: Option<String>,
    pub action_idempotency_key: Option<String>,
    pub current_run_state: Option<String>,
    pub expected_queue_control_version: Option<i64>,
    pub actual_queue_control_version: Option<i64>,
    pub expected_settings_hash: Option<String>,
    pub actual_settings_hash: Option<String>,
    pub missing_required_field: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetAgentQueueTaskLatestRunLinkRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListAgentQueueTaskRunLinksRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListStaleQueueLocalRunsRequest {
    pub workspace_id: String,
    pub min_age_seconds: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct RecoverStaleQueueLocalRunRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: String,
    pub run_link_id: String,
    pub reason: String,
    pub actor_id: String,
    pub confirmation_token: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueTaskRunLinkDto {
    pub link_id: String,
    pub workspace_id: String,
    pub queue_task_id: String,
    pub executor_widget_id: String,
    pub direct_work_run_id: String,
    pub source: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub validation_status: Option<String>,
    pub review_status: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueStaleRunCandidateDto {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub task_title: String,
    pub run_id: String,
    pub run_link_id: String,
    pub executor_widget_id: String,
    pub source: String,
    pub task_status: String,
    pub run_link_status: String,
    pub started_at: String,
    pub age_seconds: u64,
    pub reason_code: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct RecoverStaleQueueLocalRunResponseDto {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: String,
    pub run_link_id: String,
    pub reason: String,
    pub task_status: String,
    pub run_link_status: String,
    pub evidence_bundle_id: String,
}

impl From<StartAssignedAgentQueueTaskRequest> for StartAssignedAgentQueueTaskInput {
    fn from(request: StartAssignedAgentQueueTaskRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
            queue_owner_widget_instance_id: request.queue_owner_widget_instance_id,
            codex_executable: request.codex_executable,
            repo_root: PathBuf::from(request.repo_root),
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
            workflow_start_context: request
                .workflow_start_context
                .map(QueueWorkerStartContext::from),
        }
    }
}

impl From<StartSelectedAgentQueueTaskLocalRequest> for StartSelectedAgentQueueTaskLocalInput {
    fn from(request: StartSelectedAgentQueueTaskLocalRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
        }
    }
}

impl From<ListStaleQueueLocalRunsRequest> for ListStaleQueueLocalRunsInput {
    fn from(request: ListStaleQueueLocalRunsRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            min_age_seconds: request.min_age_seconds,
        }
    }
}

impl From<RecoverStaleQueueLocalRunRequest> for RecoverStaleQueueLocalRunInput {
    fn from(request: RecoverStaleQueueLocalRunRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
            run_id: request.run_id,
            run_link_id: request.run_link_id,
            reason: request.reason,
            actor_id: request.actor_id,
            confirmation_token: request.confirmation_token,
        }
    }
}

impl From<AssignedAgentQueueTaskStartSummary> for StartAssignedAgentQueueTaskResponseDto {
    fn from(summary: AssignedAgentQueueTaskStartSummary) -> Self {
        Self {
            workspace_id: summary.workspace_id,
            queue_item_id: summary.queue_item_id,
            workbench_id: summary.workbench_id,
            executor_widget_instance_id: summary.executor_widget_instance_id,
            run_id: summary.run_id,
            status: summary.status,
            workflow_run_id: summary.workflow_run_id,
            workflow_action_id: summary.workflow_action_id,
            action_idempotency_key: summary.action_idempotency_key,
            settings_hash: summary.settings_hash,
            current_run_state: summary.current_run_state,
            blocker: summary.blocker.map(QueueWorkerStartBlockerDto::from),
        }
    }
}

impl From<SelectedAgentQueueTaskLocalStartSummary> for StartSelectedAgentQueueTaskLocalResponseDto {
    fn from(summary: SelectedAgentQueueTaskLocalStartSummary) -> Self {
        let blocker_code = summary
            .blocker
            .as_ref()
            .map(|blocker| blocker.blocker_code.clone());
        let blocked_reason = summary
            .blocker
            .as_ref()
            .map(|blocker| blocker.blocker_message.clone());

        Self {
            workspace_id: summary.workspace_id,
            queue_item_id: summary.queue_item_id,
            run_link_id: summary.run_link_id,
            run_id: summary.run_id,
            status: summary.status,
            blocked_reason,
            blocker_code,
            current_run_state: summary.current_run_state,
            would_start_workers: false,
            created_widget_run: summary.created_widget_run,
            created_run_link: summary.created_run_link,
            used_workflow_slot: summary.used_workflow_slot,
            used_widget_identity: summary.used_widget_identity,
        }
    }
}

impl From<QueueWorkerStartContextRequest> for QueueWorkerStartContext {
    fn from(request: QueueWorkerStartContextRequest) -> Self {
        Self {
            workflow_run_id: request.workflow_run_id,
            workflow_action_id: request.workflow_action_id,
            action_idempotency_key: request.action_idempotency_key,
            slot: request.slot,
            task_id: request.task_id,
            executor_widget_id: request.executor_widget_id,
            settings_hash: request.settings_hash,
            execution_target_hash: request.execution_target_hash,
            expected_queue_control_version: request.expected_queue_control_version,
            actor_id: request.actor_id,
            confirmation_token: request.confirmation_token,
        }
    }
}

impl From<QueueWorkerStartBlocker> for QueueWorkerStartBlockerDto {
    fn from(blocker: QueueWorkerStartBlocker) -> Self {
        Self {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            task_id: blocker.task_id,
            executor_widget_id: blocker.executor_widget_id,
            run_id: blocker.run_id,
            workflow_run_id: blocker.workflow_run_id,
            workflow_action_id: blocker.workflow_action_id,
            action_idempotency_key: blocker.action_idempotency_key,
            current_run_state: blocker.current_run_state,
            expected_queue_control_version: blocker.expected_queue_control_version,
            actual_queue_control_version: blocker.actual_queue_control_version,
            expected_settings_hash: blocker.expected_settings_hash,
            actual_settings_hash: blocker.actual_settings_hash,
            missing_required_field: blocker.missing_required_field,
        }
    }
}

impl From<QueueStaleRunCandidateSummary> for QueueStaleRunCandidateDto {
    fn from(summary: QueueStaleRunCandidateSummary) -> Self {
        Self {
            workspace_id: summary.workspace_id,
            queue_item_id: summary.queue_item_id,
            task_title: summary.task_title,
            run_id: summary.run_id,
            run_link_id: summary.run_link_id,
            executor_widget_id: summary.executor_widget_id,
            source: summary.source,
            task_status: summary.task_status,
            run_link_status: summary.run_link_status,
            started_at: summary.started_at,
            age_seconds: summary.age_seconds,
            reason_code: summary.reason_code,
        }
    }
}

impl From<RecoverStaleQueueLocalRunResult> for RecoverStaleQueueLocalRunResponseDto {
    fn from(result: RecoverStaleQueueLocalRunResult) -> Self {
        Self {
            workspace_id: result.workspace_id,
            queue_item_id: result.queue_item_id,
            run_id: result.run_id,
            run_link_id: result.run_link_id,
            reason: result.reason,
            task_status: result.task_status,
            run_link_status: result.run_link_status,
            evidence_bundle_id: result.evidence_bundle_id,
        }
    }
}

impl From<AgentQueueTaskRunSummary> for AgentQueueTaskRunLinkDto {
    fn from(summary: AgentQueueTaskRunSummary) -> Self {
        Self {
            link_id: summary.link_id.as_str().to_owned(),
            workspace_id: summary.workspace_id,
            queue_task_id: summary.queue_task_id,
            executor_widget_id: summary.executor_widget_id,
            direct_work_run_id: summary.direct_work_run_id,
            source: summary.source.as_str().to_owned(),
            status: summary.status.as_str().to_owned(),
            started_at: summary.started_at,
            completed_at: summary.completed_at,
            validation_status: summary.validation_status,
            review_status: summary
                .review_status
                .map(hobit_app::AgentQueueTaskRunReviewStatus::as_str)
                .map(str::to_owned),
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
