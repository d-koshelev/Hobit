use std::collections::BTreeMap;

use serde_json::Value;

use super::{
    agent_queue_workflow::{
        QueueWorkflowAction, QueueWorkflowCommandBlocker, QueueWorkflowConflict, QueueWorkflowRun,
    },
    agent_queue_workflow_start_step_support::START_TRANSITION,
    RunCodexDirectWorkInput,
};

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowCreateSetupStartStepRequest {
    pub workspace_id: String,
    pub workflow_run_id: Option<String>,
    pub workflow_id: String,
    pub request_id: String,
    pub actor_id: Option<String>,
    pub inputs: Option<Value>,
    pub grant_summary: Option<Value>,
    pub confirmation_token: Option<String>,
    pub expected_version: Option<i64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowCreateSetupStartStepTransition {
    CreateSetupStart,
}

impl QueueWorkflowCreateSetupStartStepTransition {
    pub fn as_str(self) -> &'static str {
        START_TRANSITION
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowCreateSetupStartStepResultStatus {
    Executed,
    AlreadyApplied,
    BlockedPrecondition,
    Conflict,
    InvalidInput,
    FailedUnexpected,
}

impl QueueWorkflowCreateSetupStartStepResultStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Executed => "executed",
            Self::AlreadyApplied => "already_applied",
            Self::BlockedPrecondition => "blocked_precondition",
            Self::Conflict => "conflict",
            Self::InvalidInput => "invalid_input",
            Self::FailedUnexpected => "failed_unexpected",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowCreateSetupStartActionSnapshots {
    pub create_task_upstream: Option<QueueWorkflowAction>,
    pub create_task_downstream: Option<QueueWorkflowAction>,
    pub update_run_settings: Option<QueueWorkflowAction>,
    pub promote_task: Option<QueueWorkflowAction>,
    pub start_worker: Option<QueueWorkflowAction>,
}

impl QueueWorkflowCreateSetupStartActionSnapshots {
    pub(super) fn action_count(&self) -> usize {
        [
            &self.create_task_upstream,
            &self.create_task_downstream,
            &self.update_run_settings,
            &self.promote_task,
            &self.start_worker,
        ]
        .into_iter()
        .filter(|action| action.is_some())
        .count()
    }

    pub(super) fn idempotency_keys(&self) -> Vec<String> {
        [
            &self.create_task_upstream,
            &self.create_task_downstream,
            &self.update_run_settings,
            &self.promote_task,
            &self.start_worker,
        ]
        .into_iter()
        .filter_map(|action| action.as_ref().map(|action| action.idempotency_key.clone()))
        .collect()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowCreateSetupStartDownstreamVerification {
    pub downstream_task_id: Option<String>,
    pub downstream_task_exists: bool,
    pub dependency_edge_exists: bool,
    pub downstream_run_id_absent: bool,
    pub downstream_not_started: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowCreateSetupStartQueueControlSnapshot {
    pub status: String,
    pub version: i64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowCreateSetupStartStepPlanAction {
    pub action_type: String,
    pub slot: Option<String>,
    pub idempotency_key: Option<String>,
    pub already_applied: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowCreateSetupStartStepPlan {
    pub workflow_run_id: Option<String>,
    pub request_id: String,
    pub workflow_id: String,
    pub persistent_status: Option<String>,
    pub phase: Option<String>,
    pub current_step: Option<String>,
    pub transition: QueueWorkflowCreateSetupStartStepTransition,
    pub executable: bool,
    pub already_applied: bool,
    pub request_hash: Option<String>,
    pub action_plan: Vec<QueueWorkflowCreateSetupStartStepPlanAction>,
    pub target_refs_preview: Option<Value>,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub expected_next_phase: Option<String>,
    pub expected_next_step: Option<String>,
    pub expected_refs: Option<Value>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowCreateSetupStartStepResult {
    pub workflow_run_id: Option<String>,
    pub request_id: String,
    pub workflow_id: String,
    pub transition: QueueWorkflowCreateSetupStartStepTransition,
    pub status: QueueWorkflowCreateSetupStartStepResultStatus,
    pub actions: QueueWorkflowCreateSetupStartActionSnapshots,
    pub slot_binding_snapshot: Option<Value>,
    pub task_ids_by_slot: BTreeMap<String, String>,
    pub run_ids_by_slot: BTreeMap<String, String>,
    pub settings_hash: Option<String>,
    pub execution_target_hash: Option<String>,
    pub execution_target_kind: Option<String>,
    pub provider_id: Option<String>,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub queue_control: Option<QueueWorkflowCreateSetupStartQueueControlSnapshot>,
    pub downstream_verification: Option<QueueWorkflowCreateSetupStartDownstreamVerification>,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
    pub worker_launch_intent: Option<QueueWorkflowWorkerLaunchIntent>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowWorkerLaunchDisposition {
    NewlyStarted,
    AlreadyStarted,
    AlreadyRunning,
    None,
}

impl QueueWorkflowWorkerLaunchDisposition {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NewlyStarted => "newly_started",
            Self::AlreadyStarted => "already_started",
            Self::AlreadyRunning => "already_running",
            Self::None => "none",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowWorkerLaunchIntent {
    pub workspace_id: String,
    pub queue_task_id: String,
    pub run_id: String,
    pub run_link_id: Option<String>,
    pub executor_target_kind: String,
    pub provider_id: String,
    pub direct_work_input: RunCodexDirectWorkInput,
    pub started_by_workflow_run_id: String,
    pub workflow_action_id: Option<String>,
    pub launch_disposition: QueueWorkflowWorkerLaunchDisposition,
}
