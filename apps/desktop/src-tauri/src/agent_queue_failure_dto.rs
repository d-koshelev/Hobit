use hobit_app::{
    AgentQueueFailureCommandBlocker, AgentQueueFailureCommandResult,
    AgentQueueFailureDecisionSummary, FailAgentQueueItemInput,
};
use serde::{Deserialize, Serialize};

use crate::agent_queue_aggregate_dto::QueueItemAggregateDto;

const DEFAULT_QUEUE_ACTOR_ID: &str = "workspace-agent";

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct FailAgentQueueItemRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub actor_id: Option<String>,
    pub confirmation_token: String,
    pub reason: String,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub review_message_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueFailureDecisionDto {
    pub decision_id: String,
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub review_message_id: Option<String>,
    pub actor_id: String,
    pub decision: String,
    pub reason: String,
    pub metadata_json: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueFailureCommandBlockerDto {
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
pub(crate) struct AgentQueueFailureCommandResultDto {
    pub status: String,
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub decision_id: Option<String>,
    pub durable: bool,
    pub failure_decision: Option<AgentQueueFailureDecisionDto>,
    pub aggregate: Option<QueueItemAggregateDto>,
    pub blocker: Option<AgentQueueFailureCommandBlockerDto>,
}

impl From<FailAgentQueueItemRequest> for FailAgentQueueItemInput {
    fn from(request: FailAgentQueueItemRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            actor_id: request
                .actor_id
                .map(|actor| actor.trim().to_owned())
                .filter(|actor| !actor.is_empty())
                .unwrap_or_else(|| DEFAULT_QUEUE_ACTOR_ID.to_owned()),
            confirmation_token: request.confirmation_token,
            reason: request.reason,
            run_id: request.run_id,
            evidence_bundle_id: request.evidence_bundle_id,
            review_message_id: request.review_message_id,
        }
    }
}

impl From<AgentQueueFailureCommandResult> for AgentQueueFailureCommandResultDto {
    fn from(result: AgentQueueFailureCommandResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            workspace_id: result.workspace_id,
            task_id: result.queue_item_id,
            run_id: result.run_id,
            review_message_id: result.review_message_id,
            evidence_bundle_id: result.evidence_bundle_id,
            decision_id: result.decision_id,
            durable: result.durable,
            failure_decision: result
                .failure_decision
                .map(AgentQueueFailureDecisionDto::from),
            aggregate: result.aggregate.map(QueueItemAggregateDto::from),
            blocker: result.blocker.map(AgentQueueFailureCommandBlockerDto::from),
        }
    }
}

impl From<AgentQueueFailureDecisionSummary> for AgentQueueFailureDecisionDto {
    fn from(decision: AgentQueueFailureDecisionSummary) -> Self {
        Self {
            decision_id: decision.decision_id,
            workspace_id: decision.workspace_id,
            task_id: decision.queue_item_id,
            run_id: decision.run_id,
            run_link_id: decision.run_link_id,
            evidence_bundle_id: decision.evidence_bundle_id,
            review_message_id: decision.review_message_id,
            actor_id: decision.actor_id,
            decision: decision.decision,
            reason: decision.reason,
            metadata_json: decision.metadata_json,
            created_at: decision.created_at,
        }
    }
}

impl From<AgentQueueFailureCommandBlocker> for AgentQueueFailureCommandBlockerDto {
    fn from(blocker: AgentQueueFailureCommandBlocker) -> Self {
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
