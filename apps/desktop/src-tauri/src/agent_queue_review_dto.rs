use hobit_app::{
    AckAgentQueueReviewMessageInput, AgentQueueReviewCommandResult,
    AgentQueueReviewCreateMessageBlocker, AgentQueueReviewCreateMessageResult,
    AgentQueueReviewMessageSummary, CreateAgentQueueReviewMessageInput,
};
use serde::{Deserialize, Serialize};

use crate::agent_queue_aggregate_dto::QueueItemAggregateDto;

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CreateAgentQueueReviewMessageRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub actor_id: String,
    pub message_body: Option<String>,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueReviewCreateMessageBlockerDto {
    pub blocker_code: String,
    pub blocker_message: String,
    pub missing_required_field: Option<String>,
    pub task_id: String,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub run_id_required: bool,
    pub evidence_bundle_id_required: bool,
    pub durable_evidence_required: bool,
    pub review_message_already_exists: bool,
    pub existing_message_id: Option<String>,
    pub ticket_state: Option<String>,
    pub worker_run_state: Option<String>,
    pub review_state: Option<String>,
    pub evidence_state: Option<String>,
    pub next_suggested_capability: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueReviewCreateMessageResultDto {
    pub status: String,
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub message_id: Option<String>,
    pub durable: bool,
    pub review_message: Option<AgentQueueReviewMessageDto>,
    pub aggregate: Option<QueueItemAggregateDto>,
    pub blocker: Option<AgentQueueReviewCreateMessageBlockerDto>,
}

impl From<CreateAgentQueueReviewMessageRequest> for CreateAgentQueueReviewMessageInput {
    fn from(request: CreateAgentQueueReviewMessageRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            actor_id: request.actor_id,
            message_body: request.message_body,
            run_id: request.run_id,
            evidence_bundle_id: request.evidence_bundle_id,
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

impl From<AgentQueueReviewCreateMessageResult> for AgentQueueReviewCreateMessageResultDto {
    fn from(result: AgentQueueReviewCreateMessageResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            workspace_id: result.workspace_id,
            task_id: result.queue_item_id,
            run_id: result.run_id,
            evidence_bundle_id: result.evidence_bundle_id,
            message_id: result.message_id,
            durable: result.durable,
            review_message: result.review_message.map(AgentQueueReviewMessageDto::from),
            aggregate: result.aggregate.map(QueueItemAggregateDto::from),
            blocker: result
                .blocker
                .map(AgentQueueReviewCreateMessageBlockerDto::from),
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

impl From<AgentQueueReviewCreateMessageBlocker> for AgentQueueReviewCreateMessageBlockerDto {
    fn from(blocker: AgentQueueReviewCreateMessageBlocker) -> Self {
        Self {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            missing_required_field: blocker.missing_required_field,
            task_id: blocker.task_id,
            run_id: blocker.run_id,
            evidence_bundle_id: blocker.evidence_bundle_id,
            run_id_required: blocker.run_id_required,
            evidence_bundle_id_required: blocker.evidence_bundle_id_required,
            durable_evidence_required: blocker.durable_evidence_required,
            review_message_already_exists: blocker.review_message_already_exists,
            existing_message_id: blocker.existing_message_id,
            ticket_state: blocker.ticket_state,
            worker_run_state: blocker.worker_run_state,
            review_state: blocker.review_state,
            evidence_state: blocker.evidence_state,
            next_suggested_capability: blocker.next_suggested_capability,
        }
    }
}
