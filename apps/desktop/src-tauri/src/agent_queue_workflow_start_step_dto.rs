use std::collections::BTreeMap;

use hobit_app::{
    QueueWorkflowCreateSetupStartActionSnapshots,
    QueueWorkflowCreateSetupStartDownstreamVerification,
    QueueWorkflowCreateSetupStartQueueControlSnapshot, QueueWorkflowCreateSetupStartStepRequest,
    QueueWorkflowCreateSetupStartStepResult,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::agent_queue_workflow_dto::{
    AgentQueueWorkflowActionDto, AgentQueueWorkflowCommandBlockerDto,
    AgentQueueWorkflowConflictDto, AgentQueueWorkflowRunDto,
};

#[derive(Clone, Debug, PartialEq, Deserialize)]
pub(crate) struct ExecuteAgentQueueWorkflowCreateSetupStartStepRequest {
    pub workspace_id: String,
    #[serde(default)]
    pub workflow_run_id: Option<String>,
    pub workflow_id: String,
    pub request_id: String,
    #[serde(default)]
    pub actor_id: Option<String>,
    #[serde(default)]
    pub inputs: Option<Value>,
    #[serde(default)]
    pub grant_summary: Option<Value>,
    #[serde(default)]
    pub confirmation_token: Option<String>,
    #[serde(default)]
    pub expected_version: Option<i64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowCreateSetupStartActionSnapshotsDto {
    pub create_task_upstream: Option<AgentQueueWorkflowActionDto>,
    pub create_task_downstream: Option<AgentQueueWorkflowActionDto>,
    pub update_run_settings: Option<AgentQueueWorkflowActionDto>,
    pub promote_task: Option<AgentQueueWorkflowActionDto>,
    pub start_worker: Option<AgentQueueWorkflowActionDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowCreateSetupStartDownstreamVerificationDto {
    pub downstream_task_id: Option<String>,
    pub downstream_task_exists: bool,
    pub dependency_edge_exists: bool,
    pub downstream_run_id_absent: bool,
    pub downstream_not_started: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowCreateSetupStartQueueControlDto {
    pub status: String,
    pub version: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowCreateSetupStartStepResultDto {
    pub workflow_run_id: Option<String>,
    pub request_id: String,
    pub workflow_id: String,
    pub transition: String,
    pub status: String,
    pub actions: AgentQueueWorkflowCreateSetupStartActionSnapshotsDto,
    pub slot_binding_snapshot: Option<Value>,
    pub task_ids_by_slot: BTreeMap<String, String>,
    pub run_ids_by_slot: BTreeMap<String, String>,
    pub settings_hash: Option<String>,
    pub execution_target_hash: Option<String>,
    pub execution_target_kind: Option<String>,
    pub provider_id: Option<String>,
    pub workflow_run: Option<AgentQueueWorkflowRunDto>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub queue_control: Option<AgentQueueWorkflowCreateSetupStartQueueControlDto>,
    pub downstream_verification:
        Option<AgentQueueWorkflowCreateSetupStartDownstreamVerificationDto>,
    pub blockers: Vec<AgentQueueWorkflowCommandBlockerDto>,
    pub conflict: Option<AgentQueueWorkflowConflictDto>,
}

impl From<ExecuteAgentQueueWorkflowCreateSetupStartStepRequest>
    for QueueWorkflowCreateSetupStartStepRequest
{
    fn from(request: ExecuteAgentQueueWorkflowCreateSetupStartStepRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_run_id: request.workflow_run_id,
            workflow_id: request.workflow_id,
            request_id: request.request_id,
            actor_id: request.actor_id,
            inputs: request.inputs,
            grant_summary: request.grant_summary,
            confirmation_token: request.confirmation_token,
            expected_version: request.expected_version,
        }
    }
}

impl From<QueueWorkflowCreateSetupStartActionSnapshots>
    for AgentQueueWorkflowCreateSetupStartActionSnapshotsDto
{
    fn from(actions: QueueWorkflowCreateSetupStartActionSnapshots) -> Self {
        Self {
            create_task_upstream: actions
                .create_task_upstream
                .map(AgentQueueWorkflowActionDto::from),
            create_task_downstream: actions
                .create_task_downstream
                .map(AgentQueueWorkflowActionDto::from),
            update_run_settings: actions
                .update_run_settings
                .map(AgentQueueWorkflowActionDto::from),
            promote_task: actions.promote_task.map(AgentQueueWorkflowActionDto::from),
            start_worker: actions.start_worker.map(AgentQueueWorkflowActionDto::from),
        }
    }
}

impl From<QueueWorkflowCreateSetupStartDownstreamVerification>
    for AgentQueueWorkflowCreateSetupStartDownstreamVerificationDto
{
    fn from(verification: QueueWorkflowCreateSetupStartDownstreamVerification) -> Self {
        Self {
            downstream_task_id: verification.downstream_task_id,
            downstream_task_exists: verification.downstream_task_exists,
            dependency_edge_exists: verification.dependency_edge_exists,
            downstream_run_id_absent: verification.downstream_run_id_absent,
            downstream_not_started: verification.downstream_not_started,
        }
    }
}

impl From<QueueWorkflowCreateSetupStartQueueControlSnapshot>
    for AgentQueueWorkflowCreateSetupStartQueueControlDto
{
    fn from(control: QueueWorkflowCreateSetupStartQueueControlSnapshot) -> Self {
        Self {
            status: control.status,
            version: control.version,
        }
    }
}

impl From<QueueWorkflowCreateSetupStartStepResult>
    for AgentQueueWorkflowCreateSetupStartStepResultDto
{
    fn from(result: QueueWorkflowCreateSetupStartStepResult) -> Self {
        Self {
            workflow_run_id: result.workflow_run_id,
            request_id: result.request_id,
            workflow_id: result.workflow_id,
            transition: result.transition.as_str().to_owned(),
            status: result.status.as_str().to_owned(),
            actions: AgentQueueWorkflowCreateSetupStartActionSnapshotsDto::from(result.actions),
            slot_binding_snapshot: result.slot_binding_snapshot,
            task_ids_by_slot: result.task_ids_by_slot,
            run_ids_by_slot: result.run_ids_by_slot,
            settings_hash: result.settings_hash,
            execution_target_hash: result.execution_target_hash,
            execution_target_kind: result.execution_target_kind,
            provider_id: result.provider_id,
            workflow_run: result.workflow_run.map(AgentQueueWorkflowRunDto::from),
            next_phase: result.next_phase,
            next_step: result.next_step,
            queue_control: result
                .queue_control
                .map(AgentQueueWorkflowCreateSetupStartQueueControlDto::from),
            downstream_verification: result
                .downstream_verification
                .map(AgentQueueWorkflowCreateSetupStartDownstreamVerificationDto::from),
            blockers: result
                .blockers
                .into_iter()
                .map(AgentQueueWorkflowCommandBlockerDto::from)
                .collect(),
            conflict: result.conflict.map(AgentQueueWorkflowConflictDto::from),
        }
    }
}
