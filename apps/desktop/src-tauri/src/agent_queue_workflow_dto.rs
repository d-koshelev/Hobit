use hobit_app::{
    QueueWorkflowAction, QueueWorkflowCancelRequest, QueueWorkflowCancelResult,
    QueueWorkflowCommandBlocker, QueueWorkflowConflict, QueueWorkflowGetRequest,
    QueueWorkflowListRequest, QueueWorkflowPlanResumeRequest, QueueWorkflowReport,
    QueueWorkflowResumeBlocker, QueueWorkflowResumePlan, QueueWorkflowRun,
    QueueWorkflowSlotReconciliation, QueueWorkflowStartRequest, QueueWorkflowStartResult,
    QueueWorkflowTaskResumeSnapshot,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Deserialize)]
pub(crate) struct StartAgentQueueWorkflowRequest {
    pub workspace_id: String,
    pub workflow_id: String,
    pub request_id: String,
    pub phase: Option<String>,
    pub current_step: Option<String>,
    pub actor_id: Option<String>,
    pub inputs_snapshot: Option<Value>,
    pub grant_summary: Option<Value>,
    pub variables: Option<Value>,
    pub slot_bindings: Option<Value>,
    pub mutation_refs: Option<Value>,
    pub idempotency_keys: Option<Value>,
    pub action_log_summary: Option<Value>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetAgentQueueWorkflowRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListAgentQueueWorkflowsRequest {
    pub workspace_id: String,
    pub status: Option<String>,
    pub workflow_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct CancelAgentQueueWorkflowRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub actor_id: Option<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct PlanAgentQueueWorkflowResumeRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub expected_version: Option<i64>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowRunDto {
    pub workflow_run_id: String,
    pub workspace_id: String,
    pub workflow_id: String,
    pub request_id: String,
    pub request_hash: String,
    pub status: String,
    pub phase: String,
    pub current_step: Option<String>,
    pub pause_reason: Option<String>,
    pub blocker_reason: Option<String>,
    pub actor_id: Option<String>,
    pub inputs_snapshot_json: Option<String>,
    pub grant_summary_json: Option<String>,
    pub variables_json: Option<String>,
    pub slot_bindings_json: Option<String>,
    pub mutation_refs_json: Option<String>,
    pub idempotency_keys_json: Option<String>,
    pub action_log_summary_json: Option<String>,
    pub version: i64,
    pub schema_version: i64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowActionDto {
    pub action_id: String,
    pub workflow_run_id: String,
    pub workspace_id: String,
    pub step_id: String,
    pub action_type: String,
    pub idempotency_key: String,
    pub status: String,
    pub target_refs_json: Option<String>,
    pub result_refs_json: Option<String>,
    pub blocker_code: Option<String>,
    pub blocker_message: Option<String>,
    pub attempt_count: i64,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowCommandBlockerDto {
    pub blocker_code: String,
    pub blocker_message: String,
    pub missing_required_field: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowConflictDto {
    pub conflict_code: String,
    pub conflict_message: String,
    pub existing_workflow_run_id: Option<String>,
    pub existing_request_hash: Option<String>,
    pub requested_request_hash: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowStartResultDto {
    pub status: String,
    pub workflow_run: Option<AgentQueueWorkflowRunDto>,
    pub conflict: Option<AgentQueueWorkflowConflictDto>,
    pub blocker: Option<AgentQueueWorkflowCommandBlockerDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowCancelResultDto {
    pub status: String,
    pub workflow_run: Option<AgentQueueWorkflowRunDto>,
    pub blocker: Option<AgentQueueWorkflowCommandBlockerDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowReportDto {
    pub workflow_run: AgentQueueWorkflowRunDto,
    pub actions: Vec<AgentQueueWorkflowActionDto>,
    pub resume_available: bool,
    pub resume_status: String,
    pub report_summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowResumeBlockerDto {
    pub blocker_code: String,
    pub blocker_message: String,
    pub slot: Option<String>,
    pub task_id: Option<String>,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub message_id: Option<String>,
    pub completion_decision_id: Option<String>,
    pub failure_decision_id: Option<String>,
    pub missing_required_field: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowSlotReconciliationDto {
    pub slot: String,
    pub task_id: Option<String>,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub message_id: Option<String>,
    pub completion_decision_id: Option<String>,
    pub failure_decision_id: Option<String>,
    pub executor_widget_id: Option<String>,
    pub task_exists: bool,
    pub run_exists: bool,
    pub evidence_exists: bool,
    pub review_message_exists: bool,
    pub review_message_status: Option<String>,
    pub completion_decision_exists: bool,
    pub failure_decision_exists: bool,
    pub aggregate_ticket_state: Option<String>,
    pub aggregate_review_state: Option<String>,
    pub aggregate_evidence_state: Option<String>,
    pub aggregate_dependency_state: Option<String>,
    pub blocker_code: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowTaskResumeSnapshotDto {
    pub task_id: String,
    pub ticket_state: String,
    pub worker_run_state: String,
    pub review_state: String,
    pub evidence_state: String,
    pub validation_state: String,
    pub commit_state: String,
    pub dependency_state: String,
    pub latest_run_id: Option<String>,
    pub latest_run_status: Option<String>,
    pub latest_evidence_bundle_id: Option<String>,
    pub latest_review_message_id: Option<String>,
    pub latest_review_message_status: Option<String>,
    pub latest_completion_decision_id: Option<String>,
    pub latest_failure_decision_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkflowResumePlanDto {
    pub status: String,
    pub resume_available: bool,
    pub workflow_run: AgentQueueWorkflowRunDto,
    pub actions: Vec<AgentQueueWorkflowActionDto>,
    pub reconciled_variables_json: Option<String>,
    pub slot_reconciliations: Vec<AgentQueueWorkflowSlotReconciliationDto>,
    pub task_snapshots: Vec<AgentQueueWorkflowTaskResumeSnapshotDto>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub blockers: Vec<AgentQueueWorkflowResumeBlockerDto>,
    pub required_fresh_grant: bool,
    pub required_confirmation: bool,
    pub terminal_status: Option<String>,
    pub report_summary: String,
}

impl From<StartAgentQueueWorkflowRequest> for QueueWorkflowStartRequest {
    fn from(request: StartAgentQueueWorkflowRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_id: request.workflow_id,
            request_id: request.request_id,
            phase: request.phase,
            current_step: request.current_step,
            actor_id: request.actor_id,
            inputs_snapshot: request.inputs_snapshot,
            grant_summary: request.grant_summary,
            variables: request.variables,
            slot_bindings: request.slot_bindings,
            mutation_refs: request.mutation_refs,
            idempotency_keys: request.idempotency_keys,
            action_log_summary: request.action_log_summary,
        }
    }
}

impl From<GetAgentQueueWorkflowRequest> for QueueWorkflowGetRequest {
    fn from(request: GetAgentQueueWorkflowRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_run_id: request.workflow_run_id,
        }
    }
}

impl From<ListAgentQueueWorkflowsRequest> for QueueWorkflowListRequest {
    fn from(request: ListAgentQueueWorkflowsRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            status: request.status,
            workflow_id: request.workflow_id,
        }
    }
}

impl From<CancelAgentQueueWorkflowRequest> for QueueWorkflowCancelRequest {
    fn from(request: CancelAgentQueueWorkflowRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_run_id: request.workflow_run_id,
            actor_id: request.actor_id,
            reason: request.reason,
        }
    }
}

impl From<PlanAgentQueueWorkflowResumeRequest> for QueueWorkflowPlanResumeRequest {
    fn from(request: PlanAgentQueueWorkflowResumeRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            workflow_run_id: request.workflow_run_id,
            expected_version: request.expected_version,
        }
    }
}

impl From<QueueWorkflowRun> for AgentQueueWorkflowRunDto {
    fn from(run: QueueWorkflowRun) -> Self {
        Self {
            workflow_run_id: run.workflow_run_id,
            workspace_id: run.workspace_id,
            workflow_id: run.workflow_id,
            request_id: run.request_id,
            request_hash: run.request_hash,
            status: run.status,
            phase: run.phase,
            current_step: run.current_step,
            pause_reason: run.pause_reason,
            blocker_reason: run.blocker_reason,
            actor_id: run.actor_id,
            inputs_snapshot_json: run.inputs_snapshot_json,
            grant_summary_json: run.grant_summary_json,
            variables_json: run.variables_json,
            slot_bindings_json: run.slot_bindings_json,
            mutation_refs_json: run.mutation_refs_json,
            idempotency_keys_json: run.idempotency_keys_json,
            action_log_summary_json: run.action_log_summary_json,
            version: run.version,
            schema_version: run.schema_version,
            created_at: run.created_at,
            updated_at: run.updated_at,
            completed_at: run.completed_at,
        }
    }
}

impl From<QueueWorkflowAction> for AgentQueueWorkflowActionDto {
    fn from(action: QueueWorkflowAction) -> Self {
        Self {
            action_id: action.action_id,
            workflow_run_id: action.workflow_run_id,
            workspace_id: action.workspace_id,
            step_id: action.step_id,
            action_type: action.action_type,
            idempotency_key: action.idempotency_key,
            status: action.status,
            target_refs_json: action.target_refs_json,
            result_refs_json: action.result_refs_json,
            blocker_code: action.blocker_code,
            blocker_message: action.blocker_message,
            attempt_count: action.attempt_count,
            started_at: action.started_at,
            completed_at: action.completed_at,
            created_at: action.created_at,
            updated_at: action.updated_at,
        }
    }
}

impl From<QueueWorkflowCommandBlocker> for AgentQueueWorkflowCommandBlockerDto {
    fn from(blocker: QueueWorkflowCommandBlocker) -> Self {
        Self {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            missing_required_field: blocker.missing_required_field,
        }
    }
}

impl From<QueueWorkflowConflict> for AgentQueueWorkflowConflictDto {
    fn from(conflict: QueueWorkflowConflict) -> Self {
        Self {
            conflict_code: conflict.conflict_code,
            conflict_message: conflict.conflict_message,
            existing_workflow_run_id: conflict.existing_workflow_run_id,
            existing_request_hash: conflict.existing_request_hash,
            requested_request_hash: conflict.requested_request_hash,
        }
    }
}

impl From<QueueWorkflowStartResult> for AgentQueueWorkflowStartResultDto {
    fn from(result: QueueWorkflowStartResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            workflow_run: result.workflow_run.map(AgentQueueWorkflowRunDto::from),
            conflict: result.conflict.map(AgentQueueWorkflowConflictDto::from),
            blocker: result
                .blocker
                .map(AgentQueueWorkflowCommandBlockerDto::from),
        }
    }
}

impl From<QueueWorkflowCancelResult> for AgentQueueWorkflowCancelResultDto {
    fn from(result: QueueWorkflowCancelResult) -> Self {
        Self {
            status: result.status.as_str().to_owned(),
            workflow_run: result.workflow_run.map(AgentQueueWorkflowRunDto::from),
            blocker: result
                .blocker
                .map(AgentQueueWorkflowCommandBlockerDto::from),
        }
    }
}

impl From<QueueWorkflowReport> for AgentQueueWorkflowReportDto {
    fn from(report: QueueWorkflowReport) -> Self {
        Self {
            workflow_run: AgentQueueWorkflowRunDto::from(report.workflow_run),
            actions: report
                .actions
                .into_iter()
                .map(AgentQueueWorkflowActionDto::from)
                .collect(),
            resume_available: report.resume_available,
            resume_status: report.resume_status,
            report_summary: report.report_summary,
        }
    }
}

impl From<QueueWorkflowResumeBlocker> for AgentQueueWorkflowResumeBlockerDto {
    fn from(blocker: QueueWorkflowResumeBlocker) -> Self {
        Self {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            slot: blocker.slot,
            task_id: blocker.task_id,
            run_id: blocker.run_id,
            evidence_bundle_id: blocker.evidence_bundle_id,
            message_id: blocker.message_id,
            completion_decision_id: blocker.completion_decision_id,
            failure_decision_id: blocker.failure_decision_id,
            missing_required_field: blocker.missing_required_field,
        }
    }
}

impl From<QueueWorkflowSlotReconciliation> for AgentQueueWorkflowSlotReconciliationDto {
    fn from(reconciliation: QueueWorkflowSlotReconciliation) -> Self {
        Self {
            slot: reconciliation.slot,
            task_id: reconciliation.task_id,
            run_id: reconciliation.run_id,
            evidence_bundle_id: reconciliation.evidence_bundle_id,
            message_id: reconciliation.message_id,
            completion_decision_id: reconciliation.completion_decision_id,
            failure_decision_id: reconciliation.failure_decision_id,
            executor_widget_id: reconciliation.executor_widget_id,
            task_exists: reconciliation.task_exists,
            run_exists: reconciliation.run_exists,
            evidence_exists: reconciliation.evidence_exists,
            review_message_exists: reconciliation.review_message_exists,
            review_message_status: reconciliation.review_message_status,
            completion_decision_exists: reconciliation.completion_decision_exists,
            failure_decision_exists: reconciliation.failure_decision_exists,
            aggregate_ticket_state: reconciliation.aggregate_ticket_state,
            aggregate_review_state: reconciliation.aggregate_review_state,
            aggregate_evidence_state: reconciliation.aggregate_evidence_state,
            aggregate_dependency_state: reconciliation.aggregate_dependency_state,
            blocker_code: reconciliation.blocker_code,
        }
    }
}

impl From<QueueWorkflowTaskResumeSnapshot> for AgentQueueWorkflowTaskResumeSnapshotDto {
    fn from(snapshot: QueueWorkflowTaskResumeSnapshot) -> Self {
        Self {
            task_id: snapshot.task_id,
            ticket_state: snapshot.ticket_state,
            worker_run_state: snapshot.worker_run_state,
            review_state: snapshot.review_state,
            evidence_state: snapshot.evidence_state,
            validation_state: snapshot.validation_state,
            commit_state: snapshot.commit_state,
            dependency_state: snapshot.dependency_state,
            latest_run_id: snapshot.latest_run_id,
            latest_run_status: snapshot.latest_run_status,
            latest_evidence_bundle_id: snapshot.latest_evidence_bundle_id,
            latest_review_message_id: snapshot.latest_review_message_id,
            latest_review_message_status: snapshot.latest_review_message_status,
            latest_completion_decision_id: snapshot.latest_completion_decision_id,
            latest_failure_decision_id: snapshot.latest_failure_decision_id,
        }
    }
}

impl From<QueueWorkflowResumePlan> for AgentQueueWorkflowResumePlanDto {
    fn from(plan: QueueWorkflowResumePlan) -> Self {
        Self {
            status: plan.status.as_str().to_owned(),
            resume_available: plan.resume_available,
            workflow_run: AgentQueueWorkflowRunDto::from(plan.workflow_run),
            actions: plan
                .actions
                .into_iter()
                .map(AgentQueueWorkflowActionDto::from)
                .collect(),
            reconciled_variables_json: plan.reconciled_variables_json,
            slot_reconciliations: plan
                .slot_reconciliations
                .into_iter()
                .map(AgentQueueWorkflowSlotReconciliationDto::from)
                .collect(),
            task_snapshots: plan
                .task_snapshots
                .into_iter()
                .map(AgentQueueWorkflowTaskResumeSnapshotDto::from)
                .collect(),
            next_phase: plan.next_phase,
            next_step: plan.next_step,
            blockers: plan
                .blockers
                .into_iter()
                .map(AgentQueueWorkflowResumeBlockerDto::from)
                .collect(),
            required_fresh_grant: plan.required_fresh_grant,
            required_confirmation: plan.required_confirmation,
            terminal_status: plan.terminal_status,
            report_summary: plan.report_summary,
        }
    }
}
