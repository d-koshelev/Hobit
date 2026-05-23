use std::path::PathBuf;

use hobit_app::{
    AgentQueueTaskRunSummary, AssignedAgentQueueTaskStartSummary, StartAssignedAgentQueueTaskInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct StartAssignedAgentQueueTaskRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub codex_executable: String,
    pub repo_root: String,
    pub sandbox: String,
    pub approval_policy: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct StartAssignedAgentQueueTaskResponseDto {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub workbench_id: String,
    pub executor_widget_instance_id: String,
    pub run_id: String,
    pub status: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetAgentQueueTaskLatestRunLinkRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
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

impl From<StartAssignedAgentQueueTaskRequest> for StartAssignedAgentQueueTaskInput {
    fn from(request: StartAssignedAgentQueueTaskRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
            codex_executable: request.codex_executable,
            repo_root: PathBuf::from(request.repo_root),
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
            timeout_ms: request.timeout_ms,
            stdout_cap_bytes: request.stdout_cap_bytes,
            stderr_cap_bytes: request.stderr_cap_bytes,
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
