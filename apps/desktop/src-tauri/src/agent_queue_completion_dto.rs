use hobit_app::{
    AgentQueueCompletionCommandBlocker, AgentQueueCompletionCommandResult,
    AgentQueueCompletionDecisionSummary, MarkAgentQueueItemDoneInput,
};
use serde::{Deserialize, Serialize};

use crate::agent_queue_aggregate_dto::QueueItemAggregateDto;

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct MarkAgentQueueItemDoneRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub actor_id: String,
    pub confirmation_token: String,
    pub reason: Option<String>,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueCompletionDecisionDto {
    pub decision_id: String,
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub review_message_id: Option<String>,
    pub actor_id: String,
    pub decision: String,
    pub reason: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueCompletionCommandBlockerDto {
    pub blocker_code: String,
    pub blocker_message: String,
    pub missing_required_field: Option<String>,
    pub task_id: String,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub ticket_state: Option<String>,
    pub worker_run_state: Option<String>,
    pub review_state: Option<String>,
    pub evidence_state: Option<String>,
    pub validation_state: Option<String>,
    pub commit_state: Option<String>,
    pub dependency_state: Option<String>,
    pub next_suggested_capability: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueCompletionCommandResultDto {
    pub status: String,
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub decision_id: Option<String>,
    pub durable: bool,
    pub completion_decision: Option<AgentQueueCompletionDecisionDto>,
    pub aggregate: Option<QueueItemAggregateDto>,
    pub blocker: Option<AgentQueueCompletionCommandBlockerDto>,
}

impl From<MarkAgentQueueItemDoneRequest> for MarkAgentQueueItemDoneInput {
    fn from(request: MarkAgentQueueItemDoneRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            actor_id: request.actor_id,
            confirmation_token: request.confirmation_token,
            reason: request.reason,
            run_id: request.run_id,
            review_message_id: request.review_message_id,
        }
    }
}

impl From<AgentQueueCompletionCommandResult> for AgentQueueCompletionCommandResultDto {
    fn from(result: AgentQueueCompletionCommandResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            workspace_id: result.workspace_id,
            task_id: result.queue_item_id,
            run_id: result.run_id,
            review_message_id: result.review_message_id,
            evidence_bundle_id: result.evidence_bundle_id,
            decision_id: result.decision_id,
            durable: result.durable,
            completion_decision: result
                .completion_decision
                .map(AgentQueueCompletionDecisionDto::from),
            aggregate: result.aggregate.map(QueueItemAggregateDto::from),
            blocker: result
                .blocker
                .map(AgentQueueCompletionCommandBlockerDto::from),
        }
    }
}

impl From<AgentQueueCompletionDecisionSummary> for AgentQueueCompletionDecisionDto {
    fn from(decision: AgentQueueCompletionDecisionSummary) -> Self {
        Self {
            decision_id: decision.decision_id,
            workspace_id: decision.workspace_id,
            task_id: decision.queue_item_id,
            run_id: decision.run_id,
            run_link_id: decision.run_link_id,
            review_message_id: decision.review_message_id,
            actor_id: decision.actor_id,
            decision: decision.decision,
            reason: decision.reason,
            metadata_json: decision.metadata_json,
            created_at: decision.created_at,
        }
    }
}

impl From<AgentQueueCompletionCommandBlocker> for AgentQueueCompletionCommandBlockerDto {
    fn from(blocker: AgentQueueCompletionCommandBlocker) -> Self {
        Self {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            missing_required_field: blocker.missing_required_field,
            task_id: blocker.task_id,
            run_id: blocker.run_id,
            review_message_id: blocker.review_message_id,
            evidence_bundle_id: blocker.evidence_bundle_id,
            ticket_state: blocker.ticket_state,
            worker_run_state: blocker.worker_run_state,
            review_state: blocker.review_state,
            evidence_state: blocker.evidence_state,
            validation_state: blocker.validation_state,
            commit_state: blocker.commit_state,
            dependency_state: blocker.dependency_state,
            next_suggested_capability: blocker.next_suggested_capability,
        }
    }
}
