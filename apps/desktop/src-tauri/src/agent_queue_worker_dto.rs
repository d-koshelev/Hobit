use hobit_app::{
    AgentQueueWorkerSummary, CreateAgentQueueWorkerInput, DeleteAgentQueueWorkerInput,
    UpdateAgentQueueWorkerInput,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListAgentQueueWorkersRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateAgentQueueWorkerRequest {
    pub workspace_id: String,
    #[serde(default)]
    pub worker_id: Option<String>,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    #[serde(default)]
    pub queue_tag_id: Option<String>,
    #[serde(default)]
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct UpdateAgentQueueWorkerRequest {
    pub workspace_id: String,
    pub worker_id: String,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    #[serde(default)]
    pub queue_tag_id: Option<String>,
    #[serde(default)]
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct DeleteAgentQueueWorkerRequest {
    pub workspace_id: String,
    pub worker_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkerDto {
    pub worker_id: String,
    pub workspace_id: String,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    pub queue_tag_id: Option<String>,
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CreateAgentQueueWorkerRequest> for CreateAgentQueueWorkerInput {
    fn from(request: CreateAgentQueueWorkerRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            worker_id: request.worker_id,
            name: request.name,
            enabled: request.enabled,
            scope_kind: request.scope_kind,
            queue_tag_id: request.queue_tag_id,
            queue_tag_name: request.queue_tag_name,
            display_order: request.display_order,
        }
    }
}

impl From<UpdateAgentQueueWorkerRequest> for UpdateAgentQueueWorkerInput {
    fn from(request: UpdateAgentQueueWorkerRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            worker_id: request.worker_id,
            name: request.name,
            enabled: request.enabled,
            scope_kind: request.scope_kind,
            queue_tag_id: request.queue_tag_id,
            queue_tag_name: request.queue_tag_name,
            display_order: request.display_order,
        }
    }
}

impl From<DeleteAgentQueueWorkerRequest> for DeleteAgentQueueWorkerInput {
    fn from(request: DeleteAgentQueueWorkerRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            worker_id: request.worker_id,
        }
    }
}

impl From<AgentQueueWorkerSummary> for AgentQueueWorkerDto {
    fn from(summary: AgentQueueWorkerSummary) -> Self {
        Self {
            worker_id: summary.worker_id,
            workspace_id: summary.workspace_id,
            name: summary.name,
            enabled: summary.enabled,
            scope_kind: summary.scope_kind,
            queue_tag_id: summary.queue_tag_id,
            queue_tag_name: summary.queue_tag_name,
            display_order: summary.display_order,
            created_at: summary.created_at,
            updated_at: summary.updated_at,
        }
    }
}
