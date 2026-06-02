use hobit_app::{
    AgentQueueTaskSummary, AssignAgentQueueTaskToExecutorInput, ClearAgentQueueTaskAssignmentInput,
    CreateAgentQueueTaskInput, DeleteAgentQueueTaskInput, UpdateAgentQueueTaskInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateAgentQueueTaskRequest {
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    #[serde(default)]
    pub execution_policy: Option<String>,
    #[serde(default)]
    pub execution_workspace: Option<String>,
    #[serde(default)]
    pub codex_executable: Option<String>,
    #[serde(default)]
    pub sandbox: Option<String>,
    #[serde(default)]
    pub approval_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListAgentQueueTasksRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetAgentQueueTaskRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct UpdateAgentQueueTaskRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    #[serde(default)]
    pub execution_policy: Option<String>,
    #[serde(default)]
    pub execution_workspace: Option<String>,
    #[serde(default)]
    pub codex_executable: Option<String>,
    #[serde(default)]
    pub sandbox: Option<String>,
    #[serde(default)]
    pub approval_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct AssignAgentQueueTaskToExecutorRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub executor_widget_instance_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ClearAgentQueueTaskAssignmentRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct DeleteAgentQueueTaskRequest {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueTaskDto {
    pub queue_item_id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    pub execution_policy: String,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
    pub assigned_executor_widget_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CreateAgentQueueTaskRequest> for CreateAgentQueueTaskInput {
    fn from(request: CreateAgentQueueTaskRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            title: request.title,
            description: request.description,
            prompt: request.prompt,
            status: request.status,
            priority: request.priority,
            execution_policy: request.execution_policy,
            execution_workspace: request.execution_workspace,
            codex_executable: request.codex_executable,
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
        }
    }
}

impl From<UpdateAgentQueueTaskRequest> for UpdateAgentQueueTaskInput {
    fn from(request: UpdateAgentQueueTaskRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
            title: request.title,
            description: request.description,
            prompt: request.prompt,
            status: request.status,
            priority: request.priority,
            execution_policy: request.execution_policy,
            execution_workspace: request.execution_workspace,
            codex_executable: request.codex_executable,
            sandbox: request.sandbox,
            approval_policy: request.approval_policy,
        }
    }
}

impl From<AssignAgentQueueTaskToExecutorRequest> for AssignAgentQueueTaskToExecutorInput {
    fn from(request: AssignAgentQueueTaskToExecutorRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
            executor_widget_instance_id: request.executor_widget_instance_id,
        }
    }
}

impl From<ClearAgentQueueTaskAssignmentRequest> for ClearAgentQueueTaskAssignmentInput {
    fn from(request: ClearAgentQueueTaskAssignmentRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
        }
    }
}

impl From<DeleteAgentQueueTaskRequest> for DeleteAgentQueueTaskInput {
    fn from(request: DeleteAgentQueueTaskRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.queue_item_id,
        }
    }
}

impl From<AgentQueueTaskSummary> for AgentQueueTaskDto {
    fn from(summary: AgentQueueTaskSummary) -> Self {
        Self {
            queue_item_id: summary.queue_item_id,
            workspace_id: summary.workspace_id,
            title: summary.title,
            description: summary.description,
            prompt: summary.prompt,
            status: summary.status,
            priority: summary.priority,
            execution_policy: summary.execution_policy,
            execution_workspace: summary.execution_workspace,
            codex_executable: summary.codex_executable,
            sandbox: summary.sandbox,
            approval_policy: summary.approval_policy,
            assigned_executor_widget_id: summary.assigned_executor_widget_id,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
