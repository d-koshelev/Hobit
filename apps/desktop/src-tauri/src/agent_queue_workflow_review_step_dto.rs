use hobit_app::{
    QueueWorkflowReviewBindingSummary, QueueWorkflowReviewStepRequest,
    QueueWorkflowReviewStepResult,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::agent_queue_workflow_dto::{
    AgentQueueWorkflowActionDto, AgentQueueWorkflowCommandBlockerDto,
    AgentQueueWorkflowConflictDto, AgentQueueWorkflowRunDto,
};

#[derive(Clone, Debug, PartialEq, Deserialize)]
pub(crate) struct ExecuteAgentQueueWorkflowReviewStepRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    #[serde(default)]
    pub slot: Option<String>,
    #[serde(default)]
    pub actor_id: Option<String>,
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub grant_summary: Option<Value>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowReviewBindingDto {
    pub slot: String,
    pub task_id: String,
    pub run_id: String,
    pub evidence_bundle_id: String,
    pub message_id: String,
    pub create_action_id: Option<String>,
    pub create_action_idempotency_key: String,
    pub ack_action_id: Option<String>,
    pub ack_action_idempotency_key: String,
    pub ack_status: String,
    pub review_created_at: Option<String>,
    pub review_acked_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowReviewStepResultDto {
    pub workflow_run_id: String,
    pub transition: String,
    pub status: String,
    pub create_action: Option<AgentQueueWorkflowActionDto>,
    pub ack_action: Option<AgentQueueWorkflowActionDto>,
    pub message_id: Option<String>,
    pub ack_status: Option<String>,
    pub binding: Option<AgentQueueWorkflowReviewBindingDto>,
    pub workflow_run: Option<AgentQueueWorkflowRunDto>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub blockers: Vec<AgentQueueWorkflowCommandBlockerDto>,
    pub conflict: Option<AgentQueueWorkflowConflictDto>,
}

impl From<ExecuteAgentQueueWorkflowReviewStepRequest> for QueueWorkflowReviewStepRequest {
    fn from(request: ExecuteAgentQueueWorkflowReviewStepRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_run_id: request.workflow_run_id,
            slot: request.slot,
            actor_id: request.actor_id,
            request_id: request.request_id,
            grant_summary: request.grant_summary,
        }
    }
}

impl From<QueueWorkflowReviewBindingSummary> for AgentQueueWorkflowReviewBindingDto {
    fn from(binding: QueueWorkflowReviewBindingSummary) -> Self {
        Self {
            slot: binding.slot,
            task_id: binding.task_id,
            run_id: binding.run_id,
            evidence_bundle_id: binding.evidence_bundle_id,
            message_id: binding.message_id,
            create_action_id: binding.create_action_id,
            create_action_idempotency_key: binding.create_action_idempotency_key,
            ack_action_id: binding.ack_action_id,
            ack_action_idempotency_key: binding.ack_action_idempotency_key,
            ack_status: binding.ack_status,
            review_created_at: binding.review_created_at,
            review_acked_at: binding.review_acked_at,
        }
    }
}

impl From<QueueWorkflowReviewStepResult> for AgentQueueWorkflowReviewStepResultDto {
    fn from(result: QueueWorkflowReviewStepResult) -> Self {
        Self {
            workflow_run_id: result.workflow_run_id,
            transition: result.transition.as_str().to_owned(),
            status: result.status.as_str().to_owned(),
            create_action: result.create_action.map(AgentQueueWorkflowActionDto::from),
            ack_action: result.ack_action.map(AgentQueueWorkflowActionDto::from),
            message_id: result.message_id,
            ack_status: result.ack_status,
            binding: result.binding.map(AgentQueueWorkflowReviewBindingDto::from),
            workflow_run: result.workflow_run.map(AgentQueueWorkflowRunDto::from),
            next_phase: result.next_phase,
            next_step: result.next_step,
            blockers: result
                .blockers
                .into_iter()
                .map(AgentQueueWorkflowCommandBlockerDto::from)
                .collect(),
            conflict: result.conflict.map(AgentQueueWorkflowConflictDto::from),
        }
    }
}
