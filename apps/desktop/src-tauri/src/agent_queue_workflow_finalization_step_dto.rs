use hobit_app::{
    QueueWorkflowFinalizationBindingSummary, QueueWorkflowFinalizationDownstreamVerification,
    QueueWorkflowFinalizationStepRequest, QueueWorkflowFinalizationStepResult,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::agent_queue_workflow_dto::{
    AgentQueueWorkflowActionDto, AgentQueueWorkflowCommandBlockerDto,
    AgentQueueWorkflowConflictDto, AgentQueueWorkflowRunDto,
};

#[derive(Clone, Debug, PartialEq, Deserialize)]
pub(crate) struct ExecuteAgentQueueWorkflowFinalizationStepRequest {
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
    #[serde(default)]
    pub confirmation_token: Option<String>,
    #[serde(default)]
    pub failure_reason: Option<String>,
    #[serde(default)]
    pub expected_version: Option<i64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowFinalizationBindingDto {
    pub slot: String,
    pub task_id: String,
    pub run_id: String,
    pub evidence_bundle_id: String,
    pub message_id: String,
    pub completion_decision_id: Option<String>,
    pub failure_decision_id: Option<String>,
    pub finalization_action_id: Option<String>,
    pub action_idempotency_key: String,
    pub terminal_status: String,
    pub finalized_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowFinalizationDownstreamVerificationDto {
    pub downstream_task_id: Option<String>,
    pub dependency_state: Option<String>,
    pub ticket_state: Option<String>,
    pub worker_run_state: Option<String>,
    pub latest_run_id: Option<String>,
    pub expected_dependency_state: String,
    pub dependency_verified: bool,
    pub not_auto_started_verified: bool,
    pub verification_missing: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowFinalizationStepResultDto {
    pub workflow_run_id: String,
    pub workflow_id: Option<String>,
    pub transition: String,
    pub status: String,
    pub action: Option<AgentQueueWorkflowActionDto>,
    pub completion_decision_id: Option<String>,
    pub failure_decision_id: Option<String>,
    pub binding: Option<AgentQueueWorkflowFinalizationBindingDto>,
    pub workflow_run: Option<AgentQueueWorkflowRunDto>,
    pub downstream_verification: Option<AgentQueueWorkflowFinalizationDownstreamVerificationDto>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub terminal_status: Option<String>,
    pub blockers: Vec<AgentQueueWorkflowCommandBlockerDto>,
    pub conflict: Option<AgentQueueWorkflowConflictDto>,
}

impl From<ExecuteAgentQueueWorkflowFinalizationStepRequest>
    for QueueWorkflowFinalizationStepRequest
{
    fn from(request: ExecuteAgentQueueWorkflowFinalizationStepRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_run_id: request.workflow_run_id,
            slot: request.slot,
            actor_id: request.actor_id,
            request_id: request.request_id,
            grant_summary: request.grant_summary,
            confirmation_token: request.confirmation_token,
            failure_reason: request.failure_reason,
            expected_version: request.expected_version,
        }
    }
}

impl From<QueueWorkflowFinalizationBindingSummary> for AgentQueueWorkflowFinalizationBindingDto {
    fn from(binding: QueueWorkflowFinalizationBindingSummary) -> Self {
        Self {
            slot: binding.slot,
            task_id: binding.task_id,
            run_id: binding.run_id,
            evidence_bundle_id: binding.evidence_bundle_id,
            message_id: binding.message_id,
            completion_decision_id: binding.completion_decision_id,
            failure_decision_id: binding.failure_decision_id,
            finalization_action_id: binding.finalization_action_id,
            action_idempotency_key: binding.action_idempotency_key,
            terminal_status: binding.terminal_status,
            finalized_at: binding.finalized_at,
        }
    }
}

impl From<QueueWorkflowFinalizationDownstreamVerification>
    for AgentQueueWorkflowFinalizationDownstreamVerificationDto
{
    fn from(verification: QueueWorkflowFinalizationDownstreamVerification) -> Self {
        Self {
            downstream_task_id: verification.downstream_task_id,
            dependency_state: verification.dependency_state,
            ticket_state: verification.ticket_state,
            worker_run_state: verification.worker_run_state,
            latest_run_id: verification.latest_run_id,
            expected_dependency_state: verification.expected_dependency_state,
            dependency_verified: verification.dependency_verified,
            not_auto_started_verified: verification.not_auto_started_verified,
            verification_missing: verification.verification_missing,
        }
    }
}

impl From<QueueWorkflowFinalizationStepResult> for AgentQueueWorkflowFinalizationStepResultDto {
    fn from(result: QueueWorkflowFinalizationStepResult) -> Self {
        Self {
            workflow_run_id: result.workflow_run_id,
            workflow_id: result.workflow_id,
            transition: result.transition.as_str().to_owned(),
            status: result.status.as_str().to_owned(),
            action: result.action.map(AgentQueueWorkflowActionDto::from),
            completion_decision_id: result.completion_decision_id,
            failure_decision_id: result.failure_decision_id,
            binding: result
                .binding
                .map(AgentQueueWorkflowFinalizationBindingDto::from),
            workflow_run: result.workflow_run.map(AgentQueueWorkflowRunDto::from),
            downstream_verification: result
                .downstream_verification
                .map(AgentQueueWorkflowFinalizationDownstreamVerificationDto::from),
            next_phase: result.next_phase,
            next_step: result.next_step,
            terminal_status: result.terminal_status,
            blockers: result
                .blockers
                .into_iter()
                .map(AgentQueueWorkflowCommandBlockerDto::from)
                .collect(),
            conflict: result.conflict.map(AgentQueueWorkflowConflictDto::from),
        }
    }
}
