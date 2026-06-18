use hobit_app::{
    AckAgentQueueReviewMessageInput, AgentQueueReviewCommandResult, AgentQueueReviewMessageSummary,
    CreateAgentQueueReviewMessageInput,
};
use serde::{Deserialize, Serialize};

use crate::agent_queue_aggregate_dto::QueueItemAggregateDto;

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateAgentQueueReviewMessageRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub actor_id: String,
    pub message_body: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct AckAgentQueueReviewMessageRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub message_id: String,
    pub actor_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueReviewMessageDto {
    pub message_id: String,
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub actor_id: String,
    pub message_body: String,
    pub status: String,
    pub created_at: String,
    pub acked_at: Option<String>,
    pub ack_actor_id: Option<String>,
    pub metadata_json: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueReviewCommandResultDto {
    pub workspace_id: String,
    pub task_id: String,
    pub message_id: String,
    pub durable: bool,
    pub review_message: AgentQueueReviewMessageDto,
    pub aggregate: QueueItemAggregateDto,
}

impl From<CreateAgentQueueReviewMessageRequest> for CreateAgentQueueReviewMessageInput {
    fn from(request: CreateAgentQueueReviewMessageRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            actor_id: request.actor_id,
            message_body: request.message_body,
        }
    }
}

impl From<AckAgentQueueReviewMessageRequest> for AckAgentQueueReviewMessageInput {
    fn from(request: AckAgentQueueReviewMessageRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            message_id: request.message_id,
            actor_id: request.actor_id,
        }
    }
}

impl From<AgentQueueReviewCommandResult> for AgentQueueReviewCommandResultDto {
    fn from(result: AgentQueueReviewCommandResult) -> Self {
        Self {
            workspace_id: result.workspace_id,
            task_id: result.queue_item_id,
            message_id: result.message_id,
            durable: result.durable,
            review_message: AgentQueueReviewMessageDto::from(result.review_message),
            aggregate: QueueItemAggregateDto::from(result.aggregate),
        }
    }
}

impl From<AgentQueueReviewMessageSummary> for AgentQueueReviewMessageDto {
    fn from(message: AgentQueueReviewMessageSummary) -> Self {
        Self {
            message_id: message.message_id,
            workspace_id: message.workspace_id,
            task_id: message.queue_item_id,
            run_id: message.run_id,
            run_link_id: message.run_link_id,
            actor_id: message.actor_id,
            message_body: message.message_body,
            status: message.status,
            created_at: message.created_at,
            acked_at: message.acked_at,
            ack_actor_id: message.ack_actor_id,
            metadata_json: message.metadata_json,
            updated_at: message.updated_at,
        }
    }
}
