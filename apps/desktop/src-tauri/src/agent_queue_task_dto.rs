use hobit_app::{AgentQueueTaskSummary, CreateAgentQueueTaskInput, UpdateAgentQueueTaskInput};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateAgentQueueTaskRequest {
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
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
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
