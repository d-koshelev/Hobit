use std::collections::{BTreeMap, BTreeSet};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_storage_sqlite::{
    AgentQueueCompletionDecisionRow, AgentQueueFailureDecisionRow, AgentQueueReviewMessageRow,
    AgentQueueTaskRow, AgentQueueTaskRunLinkRow, AgentQueueWorkerEvidenceBundleRow,
};
use serde_json::Value;

use crate::WorkspaceServiceError;

use super::{
    agent_queue_aggregate::REVIEW_MESSAGE_STATUS_ACKNOWLEDGED,
    agent_queue_lifecycle::{
        AGENT_QUEUE_TASK_STATUS_DRAFT, AGENT_QUEUE_TASK_STATUS_QUEUED,
        AGENT_QUEUE_TASK_STATUS_READY,
    },
    agent_queue_workflow_evidence::{
        is_retryable_record_worker_evidence_blocker, QueueWorkflowRecordWorkerEvidenceRequest,
    },
    agent_queue_workflow_materialization::{
        normalize_queue_workflow_task_spec_for_hash, workflow_dependency_edge_hash,
        QueueWorkflowTaskSpec,
    },
    agent_queue_workflow_setup::{
        durable_settings_hash_for_task_with_target, normalize_queue_workflow_run_settings_for_hash,
        QueueWorkflowExecutionTarget, QueueWorkflowRunSettings,
    },
    QueueItemAggregate, QueueWorkflowAction, QueueWorkflowRun, WorkspaceService,
};

const QUEUE_WORKFLOW_SCHEMA_VERSION: i64 = 1;
const RESUME_STATUS_RESUME_READY: &str = "resume_ready";
const RESUME_STATUS_RESUME_READ_ONLY_READY: &str = "resume_read_only_ready";
const RESUME_STATUS_BLOCKED_MISSING_TASK: &str = "blocked_missing_task";
const RESUME_STATUS_BLOCKED_DEPENDENCY_EDGE_MISSING: &str = "blocked_dependency_edge_missing";
const RESUME_STATUS_BLOCKED_STATE_MISMATCH: &str = "blocked_state_mismatch";
const RESUME_STATUS_BLOCKED_MISSING_REVIEW_ACK: &str = "blocked_missing_review_ack";
const RESUME_STATUS_BLOCKED_MISSING_EVIDENCE: &str = "blocked_missing_evidence";
const RESUME_STATUS_BLOCKED_MISSING_CONFIRMATION: &str = "blocked_missing_confirmation";
const RESUME_STATUS_BLOCKED_STALE_GRANT: &str = "blocked_stale_grant";
const RESUME_STATUS_BLOCKED_SETTINGS_MISMATCH: &str = "blocked_settings_mismatch";
const RESUME_STATUS_BLOCKED_PROMOTE_STATE_MISMATCH: &str = "blocked_promote_state_mismatch";
const RESUME_STATUS_BLOCKED_EXECUTOR_MISMATCH: &str = "blocked_executor_mismatch";
const RESUME_STATUS_BLOCKED_INCOMPLETE_SLOT_BINDING: &str = "blocked_incomplete_slot_binding";
const RESUME_STATUS_BLOCKED_INCOMPLETE_WORKFLOW_ACTION_REFS: &str =
    "blocked_incomplete_workflow_action_refs";
const RESUME_STATUS_WAITING_FOR_RUN_SETTINGS: &str = "waiting_for_run_settings";
const RESUME_STATUS_WAITING_FOR_PROMOTE: &str = "waiting_for_promote";
const RESUME_STATUS_WAITING_FOR_WORKER_EVIDENCE: &str = "waiting_for_worker_evidence";
const RESUME_STATUS_RETRYABLE_WORKER_EVIDENCE_FAILURE: &str = "retryable_worker_evidence_failure";
const RESUME_STATUS_RETRYABLE_WORKER_EVIDENCE_ACTION_REPAIR: &str =
    "retryable_worker_evidence_action_repair";
const RESUME_STATUS_TERMINAL_COMPLETED: &str = "terminal_completed";
const RESUME_STATUS_TERMINAL_FAILED: &str = "terminal_failed";
const RESUME_STATUS_TERMINAL_CANCELLED: &str = "terminal_cancelled";
const RESUME_STATUS_UNSUPPORTED_PHASE: &str = "unsupported_phase";
const RESUME_STATUS_FAILED_UNEXPECTED: &str = "failed_unexpected";
const RESUME_STATUS_VERSION_CONFLICT: &str = "version_conflict";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowResumePlanStatus {
    ResumeReady,
    ResumeReadOnlyReady,
    BlockedMissingTask,
    BlockedDependencyEdgeMissing,
    BlockedStateMismatch,
    BlockedMissingReviewAck,
    BlockedMissingEvidence,
    BlockedMissingConfirmation,
    BlockedStaleGrant,
    BlockedSettingsMismatch,
    BlockedPromoteStateMismatch,
    BlockedExecutorMismatch,
    BlockedIncompleteSlotBinding,
    BlockedIncompleteWorkflowActionRefs,
    WaitingForRunSettings,
    WaitingForPromote,
    WaitingForWorkerEvidence,
    RetryableWorkerEvidenceFailure,
    RetryableWorkerEvidenceActionRepair,
    TerminalCompleted,
    TerminalFailed,
    TerminalCancelled,
    UnsupportedPhase,
    FailedUnexpected,
    VersionConflict,
}

impl QueueWorkflowResumePlanStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ResumeReady => RESUME_STATUS_RESUME_READY,
            Self::ResumeReadOnlyReady => RESUME_STATUS_RESUME_READ_ONLY_READY,
            Self::BlockedMissingTask => RESUME_STATUS_BLOCKED_MISSING_TASK,
            Self::BlockedDependencyEdgeMissing => RESUME_STATUS_BLOCKED_DEPENDENCY_EDGE_MISSING,
            Self::BlockedStateMismatch => RESUME_STATUS_BLOCKED_STATE_MISMATCH,
            Self::BlockedMissingReviewAck => RESUME_STATUS_BLOCKED_MISSING_REVIEW_ACK,
            Self::BlockedMissingEvidence => RESUME_STATUS_BLOCKED_MISSING_EVIDENCE,
            Self::BlockedMissingConfirmation => RESUME_STATUS_BLOCKED_MISSING_CONFIRMATION,
            Self::BlockedStaleGrant => RESUME_STATUS_BLOCKED_STALE_GRANT,
            Self::BlockedSettingsMismatch => RESUME_STATUS_BLOCKED_SETTINGS_MISMATCH,
            Self::BlockedPromoteStateMismatch => RESUME_STATUS_BLOCKED_PROMOTE_STATE_MISMATCH,
            Self::BlockedExecutorMismatch => RESUME_STATUS_BLOCKED_EXECUTOR_MISMATCH,
            Self::BlockedIncompleteSlotBinding => RESUME_STATUS_BLOCKED_INCOMPLETE_SLOT_BINDING,
            Self::BlockedIncompleteWorkflowActionRefs => {
                RESUME_STATUS_BLOCKED_INCOMPLETE_WORKFLOW_ACTION_REFS
            }
            Self::WaitingForRunSettings => RESUME_STATUS_WAITING_FOR_RUN_SETTINGS,
            Self::WaitingForPromote => RESUME_STATUS_WAITING_FOR_PROMOTE,
            Self::WaitingForWorkerEvidence => RESUME_STATUS_WAITING_FOR_WORKER_EVIDENCE,
            Self::RetryableWorkerEvidenceFailure => RESUME_STATUS_RETRYABLE_WORKER_EVIDENCE_FAILURE,
            Self::RetryableWorkerEvidenceActionRepair => {
                RESUME_STATUS_RETRYABLE_WORKER_EVIDENCE_ACTION_REPAIR
            }
            Self::TerminalCompleted => RESUME_STATUS_TERMINAL_COMPLETED,
            Self::TerminalFailed => RESUME_STATUS_TERMINAL_FAILED,
            Self::TerminalCancelled => RESUME_STATUS_TERMINAL_CANCELLED,
            Self::UnsupportedPhase => RESUME_STATUS_UNSUPPORTED_PHASE,
            Self::FailedUnexpected => RESUME_STATUS_FAILED_UNEXPECTED,
            Self::VersionConflict => RESUME_STATUS_VERSION_CONFLICT,
        }
    }

    fn resume_available(self) -> bool {
        !matches!(
            self,
            Self::TerminalCompleted
                | Self::TerminalFailed
                | Self::TerminalCancelled
                | Self::UnsupportedPhase
                | Self::FailedUnexpected
                | Self::VersionConflict
        )
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowPlanResumeRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub expected_version: Option<i64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowResumeBlocker {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowSlotReconciliation {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowTaskResumeSnapshot {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowResumePlan {
    pub status: QueueWorkflowResumePlanStatus,
    pub resume_available: bool,
    pub workflow_run: QueueWorkflowRun,
    pub actions: Vec<QueueWorkflowAction>,
    pub reconciled_variables_json: Option<String>,
    pub slot_reconciliations: Vec<QueueWorkflowSlotReconciliation>,
    pub task_snapshots: Vec<QueueWorkflowTaskResumeSnapshot>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub blockers: Vec<QueueWorkflowResumeBlocker>,
    pub required_fresh_grant: bool,
    pub required_confirmation: bool,
    pub terminal_status: Option<String>,
    pub report_summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Default)]
struct SlotBinding {
    slot: String,
    task_id: Option<String>,
    task_spec_hash: Option<String>,
    dependency_spec_hash: Option<String>,
    dependency_edge_hash: Option<String>,
    depends_on_slots: Vec<String>,
    dependency_task_ids: Vec<String>,
    settings_hash: Option<String>,
    execution_target_hash: Option<String>,
    execution_target_kind: Option<String>,
    provider_id: Option<String>,
    queue_owner_widget_instance_id: Option<String>,
    run_settings: Option<SlotRunSettings>,
    update_run_settings_action_id: Option<String>,
    update_run_settings_action_idempotency_key: Option<String>,
    promoted: bool,
    promote_action_id: Option<String>,
    promote_action_idempotency_key: Option<String>,
    promoted_task_status: Option<String>,
    run_id: Option<String>,
    evidence_bundle_id: Option<String>,
    message_id: Option<String>,
    completion_decision_id: Option<String>,
    failure_decision_id: Option<String>,
    executor_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct SlotRunSettings {
    execution_workspace: String,
    codex_executable: String,
    sandbox: String,
    approval_policy: String,
    execution_policy: String,
    execution_target: Option<QueueWorkflowExecutionTarget>,
    executor_widget_id: String,
}

#[derive(Clone, Debug)]
struct ReconciledSlot {
    binding: SlotBinding,
    task: Option<AgentQueueTaskRow>,
    run_link: Option<AgentQueueTaskRunLinkRow>,
    evidence: Option<AgentQueueWorkerEvidenceBundleRow>,
    review_message: Option<AgentQueueReviewMessageRow>,
    completion_decision: Option<AgentQueueCompletionDecisionRow>,
    failure_decision: Option<AgentQueueFailureDecisionRow>,
    aggregate: Option<QueueItemAggregate>,
    blockers: Vec<QueueWorkflowResumeBlocker>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ResumeTaskTemplate {
    task_spec: super::agent_queue_workflow_materialization::CanonicalQueueWorkflowTaskSpec,
    depends_on_slots: Vec<String>,
    task_spec_hash: String,
    dependency_spec_hash: String,
}

#[derive(Clone, Debug)]
struct DerivedStep {
    status: QueueWorkflowResumePlanStatus,
    next_phase: Option<String>,
    next_step: Option<String>,
    required_fresh_grant: bool,
    required_confirmation: bool,
    blockers: Vec<QueueWorkflowResumeBlocker>,
}

impl WorkspaceService {
    pub fn plan_queue_workflow_resume(
        &self,
        request: QueueWorkflowPlanResumeRequest,
    ) -> Result<Option<QueueWorkflowResumePlan>, WorkspaceServiceError> {
        let workspace_id = request.workspace_id.trim().to_owned();
        let workflow_run_id = request.workflow_run_id.trim().to_owned();

        if workspace_id.is_empty() {
            return Err(WorkspaceServiceError::InvalidInput(
                "workspaceId is required for queue.workflow.planResume.".to_owned(),
            ));
        }
        if workflow_run_id.is_empty() {
            return Err(WorkspaceServiceError::InvalidInput(
                "workflowRunId is required for queue.workflow.planResume.".to_owned(),
            ));
        }

        let Some(run_row) = self
            .store
            .get_agent_queue_workflow_run(&workspace_id, &workflow_run_id)?
        else {
            return Ok(None);
        };
        let actions = self
            .store
            .list_agent_queue_workflow_actions(&workspace_id, &workflow_run_id)?
            .into_iter()
            .map(QueueWorkflowAction::from)
            .collect::<Vec<_>>();
        let workflow_run = QueueWorkflowRun::from(run_row);

        if let Some(expected_version) = request.expected_version {
            if expected_version != workflow_run.version {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::VersionConflict,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker(
                        "version_conflict",
                        "Queue workflow run version does not match expectedVersion.",
                        None,
                        None,
                    )],
                )));
            }
        }

        if workflow_run.schema_version != QUEUE_WORKFLOW_SCHEMA_VERSION {
            return Ok(Some(plan_with_status(
                workflow_run,
                actions,
                QueueWorkflowResumePlanStatus::UnsupportedPhase,
                None,
                Some("unsupported_schema_version".to_owned()),
                false,
                false,
                None,
                vec![blocker(
                    "unsupported_schema_version",
                    "Queue workflow run schemaVersion is not supported by resume planning.",
                    None,
                    None,
                )],
            )));
        }

        match workflow_run.status.as_str() {
            "completed" => {
                let current_step = workflow_run.current_step.clone();
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::TerminalCompleted,
                    Some("closed".to_owned()),
                    current_step,
                    false,
                    false,
                    Some("completed".to_owned()),
                    Vec::new(),
                )));
            }
            "failed" => {
                if let Some(plan) = self.retryable_worker_evidence_failure_plan(
                    &workspace_id,
                    workflow_run.clone(),
                    actions.clone(),
                )? {
                    return Ok(Some(plan));
                }
                let current_step = workflow_run.current_step.clone();
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::TerminalFailed,
                    Some("closed".to_owned()),
                    current_step,
                    false,
                    false,
                    Some("failed".to_owned()),
                    Vec::new(),
                )));
            }
            "cancelled" => {
                let current_step = workflow_run.current_step.clone();
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::TerminalCancelled,
                    Some("closed".to_owned()),
                    current_step,
                    false,
                    false,
                    Some("cancelled".to_owned()),
                    Vec::new(),
                )));
            }
            "blocked" => {
                if let Some(plan) = self.retryable_worker_evidence_failure_plan(
                    &workspace_id,
                    workflow_run.clone(),
                    actions.clone(),
                )? {
                    return Ok(Some(plan));
                }
            }
            "created" | "running" | "paused" => {}
            _ => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker(
                        "unknown_workflow_status",
                        "Queue workflow run status is not recognized.",
                        None,
                        None,
                    )],
                )));
            }
        }

        if !is_supported_workflow(&workflow_run.workflow_id)
            || !is_supported_phase(&workflow_run.phase)
        {
            return Ok(Some(plan_with_status(
                workflow_run,
                actions,
                QueueWorkflowResumePlanStatus::UnsupportedPhase,
                None,
                Some("unsupported_phase".to_owned()),
                false,
                false,
                None,
                vec![blocker(
                    "unsupported_phase",
                    "Queue workflow id or phase is not supported by resume planning.",
                    None,
                    None,
                )],
            )));
        }

        let variables_value = match parse_json_field(
            workflow_run.variables_json.as_deref(),
            "variables",
            "invalid_variables_json",
        ) {
            Ok(value) => value,
            Err(blocker) => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker],
                )));
            }
        };
        let inputs_value = match parse_json_field(
            workflow_run.inputs_snapshot_json.as_deref(),
            "inputsSnapshot",
            "invalid_inputs_snapshot_json",
        ) {
            Ok(value) => value,
            Err(blocker) => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker],
                )));
            }
        };
        let grant_value = match parse_json_field(
            workflow_run.grant_summary_json.as_deref(),
            "grantSummary",
            "invalid_grant_summary_json",
        ) {
            Ok(value) => value,
            Err(blocker) => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker],
                )));
            }
        };
        let slot_bindings_value = match parse_json_field(
            workflow_run.slot_bindings_json.as_deref(),
            "slotBindings",
            "invalid_slot_bindings_json",
        ) {
            Ok(value) => value,
            Err(blocker) => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker],
                )));
            }
        };

        let slot_bindings = match parse_slot_bindings(slot_bindings_value.as_ref()) {
            Ok(bindings) => bindings,
            Err(blocker) => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker],
                )));
            }
        };
        let (slot_bindings, mut action_recovery_blockers) =
            augment_slot_bindings_from_actions(&workflow_run, slot_bindings, &actions);
        let task_templates = match parse_task_templates(inputs_value.as_ref()) {
            Ok(templates) => templates,
            Err(blocker) => {
                return Ok(Some(plan_with_status(
                    workflow_run,
                    actions,
                    QueueWorkflowResumePlanStatus::FailedUnexpected,
                    None,
                    None,
                    false,
                    false,
                    None,
                    vec![blocker],
                )));
            }
        };
        let slot_binding_map = slot_bindings
            .iter()
            .cloned()
            .map(|binding| (binding.slot.clone(), binding))
            .collect::<BTreeMap<_, _>>();

        let mut reconciled_slots = Vec::new();
        for binding in slot_bindings {
            let template = task_templates.get(&binding.slot);
            reconciled_slots.push(self.reconcile_workflow_slot(
                &workspace_id,
                binding,
                template,
                &slot_binding_map,
            )?);
        }

        let mut blockers = Vec::new();
        blockers.append(&mut action_recovery_blockers);
        blockers.extend(
            reconciled_slots
                .iter()
                .flat_map(|slot| slot.blockers.clone()),
        );

        let mut derived = if blockers.is_empty() {
            derive_next_step(
                &workflow_run,
                &reconciled_slots,
                inputs_value.as_ref(),
                variables_value.as_ref(),
            )
        } else {
            DerivedStep {
                status: status_for_blockers(&blockers),
                next_phase: Some(workflow_run.phase.clone()),
                next_step: workflow_run.current_step.clone(),
                required_fresh_grant: false,
                required_confirmation: false,
                blockers: Vec::new(),
            }
        };
        blockers.append(&mut derived.blockers);

        if derived.required_fresh_grant {
            if let Some(stale) =
                grant_stale_or_scope_blocker(grant_value.as_ref(), &reconciled_slots)
            {
                blockers.push(stale);
                derived.status = QueueWorkflowResumePlanStatus::BlockedStaleGrant;
            } else if derived.required_confirmation
                && matches!(
                    derived.status,
                    QueueWorkflowResumePlanStatus::ResumeReady
                        | QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
                )
            {
                blockers.push(blocker(
                    "fresh_confirmation_required",
                    "A fresh exact structured confirmation is required before this workflow step can resume execution.",
                    None,
                    Some("confirmationToken"),
                ));
                derived.status = QueueWorkflowResumePlanStatus::BlockedMissingConfirmation;
            }
        }

        if !blockers.is_empty()
            && matches!(
                derived.status,
                QueueWorkflowResumePlanStatus::ResumeReady
                    | QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
            )
        {
            derived.status = status_for_blockers(&blockers);
        }

        let task_snapshots = reconciled_slots
            .iter()
            .filter_map(|slot| task_snapshot(slot))
            .collect::<Vec<_>>();
        let slot_reconciliations = reconciled_slots
            .iter()
            .map(slot_reconciliation)
            .collect::<Vec<_>>();
        let reconciled_variables_json = variables_value.as_ref().map(|_| {
            workflow_run
                .variables_json
                .clone()
                .unwrap_or_else(|| "{}".to_owned())
        });
        let status = derived.status;
        let resume_available = status.resume_available();
        let report_summary = report_summary(
            &workflow_run.workflow_run_id,
            status,
            derived.next_step.as_deref(),
            blockers.len(),
            derived.required_fresh_grant,
            derived.required_confirmation,
        );

        Ok(Some(QueueWorkflowResumePlan {
            status,
            resume_available,
            workflow_run,
            actions,
            reconciled_variables_json,
            slot_reconciliations,
            task_snapshots,
            next_phase: derived.next_phase,
            next_step: derived.next_step,
            blockers,
            required_fresh_grant: derived.required_fresh_grant,
            required_confirmation: derived.required_confirmation,
            terminal_status: None,
            report_summary,
        }))
    }

    fn retryable_worker_evidence_failure_plan(
        &self,
        workspace_id: &str,
        workflow_run: QueueWorkflowRun,
        actions: Vec<QueueWorkflowAction>,
    ) -> Result<Option<QueueWorkflowResumePlan>, WorkspaceServiceError> {
        if !matches!(
            workflow_run.workflow_id.as_str(),
            "dependency_acceptance_smoke" | "dependency_failure_smoke"
        ) || workflow_run.phase != "worker_evidence"
        {
            return Ok(None);
        }
        if let Some(blocker) = completed_worker_evidence_action_incomplete_blocker(&actions) {
            return Ok(Some(plan_with_status(
                workflow_run,
                actions,
                QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs,
                Some("worker_evidence".to_owned()),
                Some("worker_evidence_blocked".to_owned()),
                false,
                false,
                None,
                vec![blocker],
            )));
        }
        if actions.iter().any(is_completed_worker_evidence_action) {
            return Ok(None);
        }
        if let Some(blocker) = non_retryable_worker_evidence_action_blocker(&actions) {
            return Ok(Some(plan_with_status(
                workflow_run,
                actions,
                QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs,
                Some("worker_evidence".to_owned()),
                Some("worker_evidence_blocked".to_owned()),
                false,
                false,
                None,
                vec![blocker],
            )));
        }

        let has_retryable_worker_evidence_action =
            actions.iter().any(is_retryable_worker_evidence_action);
        if !actions.iter().any(is_worker_evidence_runner_failed_action)
            && !has_retryable_worker_evidence_action
        {
            return Ok(None);
        }

        let variables_value = match parse_json_field(
            workflow_run.variables_json.as_deref(),
            "variables",
            "invalid_variables_json",
        ) {
            Ok(value) => value,
            Err(_) => return Ok(None),
        };
        let inputs_value = match parse_json_field(
            workflow_run.inputs_snapshot_json.as_deref(),
            "inputsSnapshot",
            "invalid_inputs_snapshot_json",
        ) {
            Ok(value) => value,
            Err(_) => return Ok(None),
        };
        let slot_bindings_value = match parse_json_field(
            workflow_run.slot_bindings_json.as_deref(),
            "slotBindings",
            "invalid_slot_bindings_json",
        ) {
            Ok(value) => value,
            Err(_) => return Ok(None),
        };
        let slot_bindings = match parse_slot_bindings(slot_bindings_value.as_ref()) {
            Ok(bindings) => bindings,
            Err(_) => return Ok(None),
        };
        let (slot_bindings, action_recovery_blockers) =
            augment_slot_bindings_from_actions(&workflow_run, slot_bindings, &actions);
        if !action_recovery_blockers.is_empty() {
            return Ok(None);
        }

        let task_templates = match parse_task_templates(inputs_value.as_ref()) {
            Ok(templates) => templates,
            Err(_) => return Ok(None),
        };
        let slot_binding_map = slot_bindings
            .iter()
            .cloned()
            .map(|binding| (binding.slot.clone(), binding))
            .collect::<BTreeMap<_, _>>();

        let mut reconciled_slots = Vec::new();
        for binding in slot_bindings {
            let template = task_templates.get(&binding.slot);
            reconciled_slots.push(self.reconcile_workflow_slot(
                workspace_id,
                binding,
                template,
                &slot_binding_map,
            )?);
        }

        if reconciled_slots
            .iter()
            .any(|slot| !slot.blockers.is_empty())
        {
            return Ok(None);
        }
        let Some(target) = target_slot(&workflow_run, &reconciled_slots) else {
            return Ok(None);
        };
        let Some(run_link) = target.run_link.as_ref() else {
            return Ok(None);
        };
        if target.binding.task_id.is_none()
            || target.binding.run_id.is_none()
            || target.binding.settings_hash.is_none()
            || target.binding.execution_target_hash.is_none()
            || target.binding.evidence_bundle_id.is_some()
            || target.evidence.is_some()
            || target.review_message.is_some()
            || target.completion_decision.is_some()
            || target.failure_decision.is_some()
            || !is_completed_worker_run_state(run_link)
            || !has_completed_start_worker_action_for_slot(&actions, &target.binding)
        {
            return Ok(None);
        }
        if let Some(blocker) = retryable_worker_evidence_action_ref_blocker(
            &actions,
            &target.binding,
            &workflow_run.workflow_run_id,
        ) {
            return Ok(Some(plan_with_status(
                workflow_run,
                actions,
                QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs,
                Some("worker_evidence".to_owned()),
                Some("worker_evidence_blocked".to_owned()),
                false,
                false,
                None,
                vec![blocker],
            )));
        }

        let Some(task_id) = target.binding.task_id.clone() else {
            return Ok(None);
        };
        let Some(run_id) = target.binding.run_id.clone() else {
            return Ok(None);
        };
        let Some(outcome) = worker_evidence_outcome_for_resume(&run_link.status) else {
            return Ok(None);
        };
        let worker_evidence_step_plan = self.plan_queue_workflow_worker_evidence_step(
            QueueWorkflowRecordWorkerEvidenceRequest {
                workspace_id: workspace_id.to_owned(),
                workflow_run_id: workflow_run.workflow_run_id.clone(),
                slot: target.binding.slot.clone(),
                task_id,
                run_id,
                outcome: outcome.to_owned(),
                summary: Some("Queue workflow resume worker-evidence planner probe.".to_owned()),
                changed_files: Vec::new(),
                changed_files_summary: None,
                validation_summary: None,
                error_summary: None,
                worker_id: None,
                source: Some("queue_workflow_resume_plan".to_owned()),
                metadata_json: None,
                finished_at: None,
                actor_id: None,
                action_idempotency_key: None,
            },
        )?;
        if !worker_evidence_step_plan.safe_to_record_worker_evidence {
            let blockers = worker_evidence_step_plan
                .blockers
                .into_iter()
                .map(|blocker| QueueWorkflowResumeBlocker {
                    blocker_code: blocker.blocker_code,
                    blocker_message: blocker.blocker_message,
                    slot: Some(target.binding.slot.clone()),
                    task_id: target.binding.task_id.clone(),
                    run_id: target.binding.run_id.clone(),
                    evidence_bundle_id: target.binding.evidence_bundle_id.clone(),
                    message_id: target.binding.message_id.clone(),
                    completion_decision_id: target.binding.completion_decision_id.clone(),
                    failure_decision_id: target.binding.failure_decision_id.clone(),
                    missing_required_field: blocker.missing_required_field,
                })
                .collect::<Vec<_>>();
            return Ok(Some(plan_with_status(
                workflow_run,
                actions,
                status_for_blockers(&blockers),
                Some("worker_evidence".to_owned()),
                Some("worker_evidence_blocked".to_owned()),
                false,
                false,
                None,
                blockers,
            )));
        }

        let (status, blocker_code, blocker_message) = if has_retryable_worker_evidence_action {
            (
                QueueWorkflowResumePlanStatus::RetryableWorkerEvidenceActionRepair,
                "retryable_worker_evidence_action_repair",
                "Queue workflow has stale non-mutating record_worker_evidence history with incomplete refs; retry with corrected typed workerEvidence is allowed.",
            )
        } else {
            (
                QueueWorkflowResumePlanStatus::RetryableWorkerEvidenceFailure,
                "retryable_worker_evidence_failure",
                "Queue workflow failed during worker evidence recording before durable evidence mutation; retry with corrected typed workerEvidence is allowed.",
            )
        };
        let blockers = vec![binding_blocker(
            blocker_code,
            blocker_message,
            &target.binding,
            Some("workerEvidence"),
        )];
        let task_snapshots = reconciled_slots
            .iter()
            .filter_map(task_snapshot)
            .collect::<Vec<_>>();
        let slot_reconciliations = reconciled_slots
            .iter()
            .map(slot_reconciliation)
            .collect::<Vec<_>>();
        let reconciled_variables_json = variables_value
            .as_ref()
            .and_then(|_| workflow_run.variables_json.clone());
        let report_summary = report_summary(
            &workflow_run.workflow_run_id,
            status,
            Some("waiting_for_worker_evidence"),
            blockers.len(),
            false,
            false,
        );

        Ok(Some(QueueWorkflowResumePlan {
            status,
            resume_available: status.resume_available(),
            workflow_run,
            actions,
            reconciled_variables_json,
            slot_reconciliations,
            task_snapshots,
            next_phase: Some("worker_evidence".to_owned()),
            next_step: Some("waiting_for_worker_evidence".to_owned()),
            blockers,
            required_fresh_grant: false,
            required_confirmation: false,
            terminal_status: None,
            report_summary,
        }))
    }

    fn reconcile_workflow_slot(
        &self,
        workspace_id: &str,
        binding: SlotBinding,
        task_template: Option<&ResumeTaskTemplate>,
        slot_bindings: &BTreeMap<String, SlotBinding>,
    ) -> Result<ReconciledSlot, WorkspaceServiceError> {
        let mut blockers = Vec::new();

        let task = match binding.task_id.as_deref() {
            Some(task_id) => match self.store.get_agent_queue_task(workspace_id, task_id)? {
                Some(task) => Some(task),
                None => match self.store.get_agent_queue_task_by_id(task_id)? {
                    Some(other) if other.workspace_id != workspace_id => {
                        blockers.push(binding_blocker(
                            "task_workspace_mismatch",
                            "Bound Queue task belongs to a different workspace.",
                            &binding,
                            None,
                        ));
                        None
                    }
                    _ => {
                        blockers.push(binding_blocker(
                            "task_missing",
                            "Bound Queue task was not found in the requested workspace.",
                            &binding,
                            Some("taskId"),
                        ));
                        None
                    }
                },
            },
            None => None,
        };

        if let Some(task) = task.as_ref() {
            validate_task_materialization_binding(
                workspace_id,
                &binding,
                task,
                task_template,
                slot_bindings,
                &self.store,
                &mut blockers,
            )?;
        }

        let run_link = match binding.run_id.as_deref() {
            Some(run_id) => {
                let run_link = self
                    .store
                    .get_agent_queue_task_run_link_by_run_id(workspace_id, run_id)?;
                match run_link {
                    Some(run_link) => {
                        if binding
                            .task_id
                            .as_deref()
                            .is_some_and(|task_id| task_id != run_link.queue_task_id)
                        {
                            blockers.push(binding_blocker(
                                "run_task_mismatch",
                                "Bound runId belongs to a different Queue task than the bound taskId.",
                                &binding,
                                None,
                            ));
                        }
                        if binding
                            .executor_widget_id
                            .as_deref()
                            .is_some_and(|executor| executor != run_link.executor_widget_id)
                        {
                            blockers.push(binding_blocker(
                                "executor_widget_mismatch",
                                "Bound executorWidgetId does not match the durable run link.",
                                &binding,
                                None,
                            ));
                        }
                        Some(run_link)
                    }
                    None => {
                        blockers.push(binding_blocker(
                            "run_missing",
                            "Bound runId was not found in the requested workspace.",
                            &binding,
                            Some("runId"),
                        ));
                        None
                    }
                }
            }
            None => None,
        };

        if let (Some(task), Some(executor_widget_id)) =
            (task.as_ref(), binding.executor_widget_id.as_deref())
        {
            if task
                .assigned_executor_widget_id
                .as_deref()
                .is_some_and(|assigned| assigned != executor_widget_id)
            {
                blockers.push(binding_blocker(
                    "executor_widget_mismatch",
                    "Bound executorWidgetId does not match the task assignment.",
                    &binding,
                    None,
                ));
            }
        }

        let evidence = match binding.evidence_bundle_id.as_deref() {
            Some(bundle_id) => {
                let evidence = self
                    .store
                    .get_agent_queue_worker_evidence_bundle_by_id(workspace_id, bundle_id)?;
                match evidence {
                    Some(evidence) => {
                        validate_evidence_matches_binding(&binding, &evidence, &mut blockers);
                        Some(evidence)
                    }
                    None => {
                        blockers.push(binding_blocker(
                            "evidence_missing",
                            "Bound evidenceBundleId was not found in the requested workspace.",
                            &binding,
                            Some("evidenceBundleId"),
                        ));
                        None
                    }
                }
            }
            None => match binding.task_id.as_deref() {
                Some(task_id) => self
                    .store
                    .get_latest_agent_queue_worker_evidence_bundle(workspace_id, task_id)?,
                None => None,
            },
        };
        if let Some(evidence) = evidence.as_ref() {
            validate_evidence_matches_binding(&binding, evidence, &mut blockers);
        }

        let review_message = match binding.message_id.as_deref() {
            Some(message_id) => {
                let message = self
                    .store
                    .get_agent_queue_review_message_by_id(workspace_id, message_id)?;
                match message {
                    Some(message) => {
                        validate_review_message_matches_binding(
                            &binding,
                            evidence.as_ref(),
                            &message,
                            &mut blockers,
                        );
                        Some(message)
                    }
                    None => {
                        blockers.push(binding_blocker(
                            "review_message_missing",
                            "Bound messageId was not found in the requested workspace.",
                            &binding,
                            Some("messageId"),
                        ));
                        None
                    }
                }
            }
            None => match binding.task_id.as_deref() {
                Some(task_id) => self
                    .store
                    .get_latest_agent_queue_review_message(workspace_id, task_id)?,
                None => None,
            },
        };
        if let Some(message) = review_message.as_ref() {
            validate_review_message_matches_binding(
                &binding,
                evidence.as_ref(),
                message,
                &mut blockers,
            );
        }

        let completion_decision = match binding.completion_decision_id.as_deref() {
            Some(decision_id) => {
                let decision = self
                    .store
                    .get_agent_queue_completion_decision_by_id(workspace_id, decision_id)?;
                match decision {
                    Some(decision) => {
                        validate_completion_decision_matches_binding(
                            &binding,
                            review_message.as_ref(),
                            &decision,
                            &mut blockers,
                        );
                        Some(decision)
                    }
                    None => {
                        blockers.push(binding_blocker(
                            "completion_decision_missing",
                            "Bound completionDecisionId was not found in the requested workspace.",
                            &binding,
                            Some("completionDecisionId"),
                        ));
                        None
                    }
                }
            }
            None => match binding.task_id.as_deref() {
                Some(task_id) => self
                    .store
                    .get_latest_agent_queue_completion_decision(workspace_id, task_id)?,
                None => None,
            },
        };
        if let Some(decision) = completion_decision.as_ref() {
            validate_completion_decision_matches_binding(
                &binding,
                review_message.as_ref(),
                decision,
                &mut blockers,
            );
        }

        let failure_decision = match binding.failure_decision_id.as_deref() {
            Some(decision_id) => {
                let decision = self
                    .store
                    .get_agent_queue_failure_decision_by_id(workspace_id, decision_id)?;
                match decision {
                    Some(decision) => {
                        validate_failure_decision_matches_binding(
                            &binding,
                            evidence.as_ref(),
                            review_message.as_ref(),
                            &decision,
                            &mut blockers,
                        );
                        Some(decision)
                    }
                    None => {
                        blockers.push(binding_blocker(
                            "failure_decision_missing",
                            "Bound failureDecisionId was not found in the requested workspace.",
                            &binding,
                            Some("failureDecisionId"),
                        ));
                        None
                    }
                }
            }
            None => match binding.task_id.as_deref() {
                Some(task_id) => self
                    .store
                    .get_latest_agent_queue_failure_decision(workspace_id, task_id)?,
                None => None,
            },
        };
        if let Some(decision) = failure_decision.as_ref() {
            validate_failure_decision_matches_binding(
                &binding,
                evidence.as_ref(),
                review_message.as_ref(),
                decision,
                &mut blockers,
            );
        }

        if completion_decision.is_some() && failure_decision.is_some() {
            blockers.push(binding_blocker(
                "terminal_decision_conflict",
                "Both completion and failure decisions exist for the same bound Queue task.",
                &binding,
                None,
            ));
        }

        let aggregate = match binding.task_id.as_deref() {
            Some(task_id) if task.is_some() => {
                self.get_queue_item_aggregate(workspace_id, task_id)?
            }
            _ => None,
        };

        Ok(ReconciledSlot {
            binding,
            task,
            run_link,
            evidence,
            review_message,
            completion_decision,
            failure_decision,
            aggregate,
            blockers,
        })
    }
}

fn plan_with_status(
    workflow_run: QueueWorkflowRun,
    actions: Vec<QueueWorkflowAction>,
    status: QueueWorkflowResumePlanStatus,
    next_phase: Option<String>,
    next_step: Option<String>,
    required_fresh_grant: bool,
    required_confirmation: bool,
    terminal_status: Option<String>,
    blockers: Vec<QueueWorkflowResumeBlocker>,
) -> QueueWorkflowResumePlan {
    let resume_available = status.resume_available();
    let report_summary = report_summary(
        &workflow_run.workflow_run_id,
        status,
        next_step.as_deref(),
        blockers.len(),
        required_fresh_grant,
        required_confirmation,
    );
    QueueWorkflowResumePlan {
        status,
        resume_available,
        workflow_run,
        actions,
        reconciled_variables_json: None,
        slot_reconciliations: Vec::new(),
        task_snapshots: Vec::new(),
        next_phase,
        next_step,
        blockers,
        required_fresh_grant,
        required_confirmation,
        terminal_status,
        report_summary,
    }
}

fn report_summary(
    workflow_run_id: &str,
    status: QueueWorkflowResumePlanStatus,
    next_step: Option<&str>,
    blocker_count: usize,
    required_fresh_grant: bool,
    required_confirmation: bool,
) -> String {
    let mut summary = format!(
        "Queue workflow run {workflow_run_id} resume plan status is {}.",
        status.as_str()
    );
    if let Some(next_step) = next_step {
        summary.push_str(&format!(" Next step: {next_step}."));
    }
    if blocker_count > 0 {
        summary.push_str(&format!(" Blockers: {blocker_count}."));
    }
    if required_fresh_grant {
        summary.push_str(" Fresh grant required.");
    }
    if required_confirmation {
        summary.push_str(" Fresh structured confirmation required.");
    }
    summary.push_str(" No workflow steps were executed.");
    summary
}

fn parse_json_field(
    raw: Option<&str>,
    field: &str,
    code: &str,
) -> Result<Option<Value>, QueueWorkflowResumeBlocker> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    if raw.trim().is_empty() {
        return Ok(None);
    }
    serde_json::from_str::<Value>(raw).map(Some).map_err(|_| {
        blocker(
            code,
            &format!("{field} must contain valid JSON for resume planning."),
            None,
            Some(field),
        )
    })
}

fn parse_slot_bindings(
    value: Option<&Value>,
) -> Result<Vec<SlotBinding>, QueueWorkflowResumeBlocker> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    if value.is_null() {
        return Ok(Vec::new());
    }
    let Some(object) = value.as_object() else {
        return Err(blocker(
            "invalid_slot_bindings_json",
            "slotBindings must be a JSON object keyed by explicit slot name.",
            None,
            Some("slotBindings"),
        ));
    };

    let mut bindings = Vec::new();
    for (slot, value) in object {
        let Some(fields) = value.as_object() else {
            return Err(blocker(
                "invalid_slot_binding",
                "Each slot binding must be a JSON object.",
                Some(slot),
                Some("slotBindings"),
            ));
        };
        bindings.push(SlotBinding {
            slot: slot.clone(),
            task_id: optional_string_field(fields.get("taskId")),
            task_spec_hash: optional_string_field(fields.get("taskSpecHash")),
            dependency_spec_hash: optional_string_field(fields.get("dependencySpecHash")),
            dependency_edge_hash: optional_string_field(fields.get("dependencyEdgeHash")),
            depends_on_slots: optional_string_array_field(fields.get("dependsOnSlots")),
            dependency_task_ids: optional_string_array_field(fields.get("dependencyTaskIds")),
            settings_hash: optional_string_field(fields.get("settingsHash")),
            execution_target_hash: optional_string_field(fields.get("executionTargetHash")),
            execution_target_kind: optional_string_field(fields.get("executionTargetKind")),
            provider_id: optional_string_field(fields.get("providerId")),
            queue_owner_widget_instance_id: optional_string_field(
                fields.get("queueOwnerWidgetInstanceId"),
            ),
            run_settings: parse_slot_run_settings(fields.get("runSettings")),
            update_run_settings_action_id: optional_string_field(
                fields.get("updateRunSettingsActionId"),
            ),
            update_run_settings_action_idempotency_key: optional_string_field(
                fields.get("updateRunSettingsActionIdempotencyKey"),
            ),
            promoted: fields
                .get("promoted")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            promote_action_id: optional_string_field(fields.get("promoteActionId")),
            promote_action_idempotency_key: optional_string_field(
                fields.get("promoteActionIdempotencyKey"),
            ),
            promoted_task_status: optional_string_field(fields.get("promotedTaskStatus")),
            run_id: optional_string_field(fields.get("runId")),
            evidence_bundle_id: optional_string_field(fields.get("evidenceBundleId")),
            message_id: optional_string_field(fields.get("messageId")),
            completion_decision_id: optional_string_field(fields.get("completionDecisionId")),
            failure_decision_id: optional_string_field(fields.get("failureDecisionId")),
            executor_widget_id: optional_string_field(fields.get("executorWidgetId")),
        });
    }
    bindings.sort_by(|left, right| left.slot.cmp(&right.slot));
    Ok(bindings)
}

fn augment_slot_bindings_from_actions(
    run: &QueueWorkflowRun,
    bindings: Vec<SlotBinding>,
    actions: &[QueueWorkflowAction],
) -> (Vec<SlotBinding>, Vec<QueueWorkflowResumeBlocker>) {
    let mut by_slot = bindings
        .into_iter()
        .map(|binding| (binding.slot.clone(), binding))
        .collect::<BTreeMap<_, _>>();
    let mut blockers = Vec::new();

    for action in actions {
        match action.action_type.as_str() {
            "create_task" => recover_create_task_action(&mut by_slot, action, &mut blockers),
            "update_run_settings" => {
                recover_update_run_settings_action(&mut by_slot, action, &mut blockers)
            }
            "promote_task" => recover_promote_task_action(&mut by_slot, action, &mut blockers),
            "start_worker" => recover_start_worker_action(run, &mut by_slot, action, &mut blockers),
            "record_worker_evidence" => {
                recover_worker_evidence_action(&mut by_slot, action, &mut blockers)
            }
            "queue.review.createMessage" | "queue.review.ack" => {
                recover_review_action(&mut by_slot, action, &mut blockers)
            }
            "queue.item.markDone" => {
                recover_decision_action(&mut by_slot, action, "completionDecisionId", &mut blockers)
            }
            "queue.item.fail" => {
                recover_decision_action(&mut by_slot, action, "failureDecisionId", &mut blockers)
            }
            _ => {}
        }
    }

    (by_slot.into_values().collect(), blockers)
}

fn is_worker_evidence_runner_failed_action(action: &QueueWorkflowAction) -> bool {
    action.action_type == "queue.workflow.runner"
        && action.status == "failed"
        && (action.step_id == "runner.worker_evidence"
            || action_ref_phase(action.target_refs_json.as_deref()).as_deref()
                == Some("worker_evidence")
            || action_ref_phase(action.result_refs_json.as_deref()).as_deref()
                == Some("worker_evidence"))
}

fn is_completed_worker_evidence_action(action: &QueueWorkflowAction) -> bool {
    action.action_type == "record_worker_evidence" && action.status == "completed"
}

fn is_retryable_worker_evidence_action(action: &QueueWorkflowAction) -> bool {
    is_stale_retryable_record_worker_evidence_action(action)
}

fn completed_worker_evidence_action_incomplete_blocker(
    actions: &[QueueWorkflowAction],
) -> Option<QueueWorkflowResumeBlocker> {
    actions
        .iter()
        .filter(|action| is_completed_worker_evidence_action(action))
        .find_map(|action| {
            (!completed_worker_evidence_action_refs_are_complete(action)).then(|| {
                action_ref_blocker(
                    "completed_evidence_action_incomplete",
                    "A completed record_worker_evidence action is missing durable typed refs; resume planning will not duplicate evidence.",
                    action,
                    None,
                    Some("recordWorkerEvidence.refs"),
                )
            })
        })
}

fn non_retryable_worker_evidence_action_blocker(
    actions: &[QueueWorkflowAction],
) -> Option<QueueWorkflowResumeBlocker> {
    actions
        .iter()
        .filter(|action| {
            action.action_type == "record_worker_evidence"
                && !is_completed_worker_evidence_action(action)
                && !is_stale_retryable_record_worker_evidence_action(action)
        })
        .map(|action| {
            if action_result_evidence_bundle_id(action).is_some() {
                action_ref_blocker(
                    "evidence_mutation_state_unknown",
                    "A non-completed record_worker_evidence action has evidence result refs; resume planning will not assume the mutation is safe to retry.",
                    action,
                    None,
                    Some("resultRefs.evidenceBundleId"),
                )
            } else {
                action_ref_blocker(
                    "stale_action_refs_ambiguous",
                    "A non-completed record_worker_evidence action is not a proven stale non-mutating repair candidate.",
                    action,
                    None,
                    Some("recordWorkerEvidence"),
                )
            }
        })
        .next()
}

fn retryable_worker_evidence_action_ref_blocker(
    actions: &[QueueWorkflowAction],
    binding: &SlotBinding,
    workflow_run_id: &str,
) -> Option<QueueWorkflowResumeBlocker> {
    actions
        .iter()
        .filter(|action| is_retryable_worker_evidence_action(action))
        .find_map(|action| {
            let Some(target) = action_ref_value(action.target_refs_json.as_deref()) else {
                if record_worker_evidence_idempotency_key(workflow_run_id, binding)
                    .as_deref()
                    == Some(action.idempotency_key.as_str())
                {
                    return None;
                }
                return Some(action_ref_blocker(
                    "stale_action_refs_ambiguous",
                    "A retryable record_worker_evidence action has unreadable target refs; resume planning will not repair it.",
                    action,
                    binding.task_id.as_deref(),
                    Some("recordWorkerEvidence.targetRefs"),
                ));
            };
            retryable_worker_evidence_ref_mismatch_blocker(
                action,
                &target,
                binding,
                workflow_run_id,
            )
        })
}

fn record_worker_evidence_idempotency_key(
    workflow_run_id: &str,
    binding: &SlotBinding,
) -> Option<String> {
    Some(format!(
        "{workflow_run_id}:record_worker_evidence:{}:{}:{}",
        binding.slot,
        binding.task_id.as_deref()?,
        binding.run_id.as_deref()?
    ))
}

fn retryable_worker_evidence_ref_mismatch_blocker(
    action: &QueueWorkflowAction,
    target: &serde_json::Map<String, Value>,
    binding: &SlotBinding,
    workflow_run_id: &str,
) -> Option<QueueWorkflowResumeBlocker> {
    for (field, expected, code, message) in [
        (
            "workflowRunId",
            Some(workflow_run_id),
            "workflow_run_ref_mismatch",
            "A retryable record_worker_evidence action points at a different workflowRunId.",
        ),
        (
            "slot",
            Some(binding.slot.as_str()),
            "stale_action_refs_ambiguous",
            "A retryable record_worker_evidence action points at a different slot.",
        ),
        (
            "taskId",
            binding.task_id.as_deref(),
            "task_ref_mismatch",
            "A retryable record_worker_evidence action points at a different taskId.",
        ),
        (
            "runId",
            binding.run_id.as_deref(),
            "run_ref_mismatch",
            "A retryable record_worker_evidence action points at a different runId.",
        ),
        (
            "settingsHash",
            binding.settings_hash.as_deref(),
            "settings_hash_mismatch",
            "A retryable record_worker_evidence action points at a different settingsHash.",
        ),
        (
            "executionTargetHash",
            binding.execution_target_hash.as_deref(),
            "execution_target_hash_mismatch",
            "A retryable record_worker_evidence action points at a different executionTargetHash.",
        ),
        (
            "executionTargetKind",
            binding.execution_target_kind.as_deref(),
            "stale_action_refs_ambiguous",
            "A retryable record_worker_evidence action points at a different executionTargetKind.",
        ),
        (
            "providerId",
            binding.provider_id.as_deref(),
            "stale_action_refs_ambiguous",
            "A retryable record_worker_evidence action points at a different providerId.",
        ),
        (
            "queueOwnerWidgetInstanceId",
            binding.queue_owner_widget_instance_id.as_deref(),
            "stale_action_refs_ambiguous",
            "A retryable record_worker_evidence action points at a different queueOwnerWidgetInstanceId.",
        ),
        (
            "executorWidgetId",
            binding.executor_widget_id.as_deref(),
            "stale_action_refs_ambiguous",
            "A retryable record_worker_evidence action points at a different executorWidgetId.",
        ),
    ] {
        if present_ref_mismatch(target, field, expected) {
            return Some(action_ref_blocker(
                code,
                message,
                action,
                binding.task_id.as_deref(),
                Some("recordWorkerEvidence.targetRefs"),
            ));
        }
    }
    None
}

fn present_ref_mismatch(
    target: &serde_json::Map<String, Value>,
    field: &str,
    expected: Option<&str>,
) -> bool {
    optional_string_ref(target, field).is_some_and(|actual| match expected {
        Some(expected) => actual != expected,
        None => true,
    })
}

fn is_stale_retryable_record_worker_evidence_action(action: &QueueWorkflowAction) -> bool {
    if action.action_type != "record_worker_evidence"
        || action_result_evidence_bundle_id(action).is_some()
    {
        return false;
    }
    let blocker = action.blocker_code.as_deref();
    let result_status = action_result_status(action);
    action.status == "blocked"
        && (blocker.is_some_and(is_retryable_record_worker_evidence_blocker)
            || blocker == Some("precondition_failed")
            || result_status.as_deref() == Some("precondition_failed"))
        || action.status == "failed"
            && (blocker == Some("failed_unexpected")
                || blocker == Some("incomplete_workflow_action_refs")
                || result_status.as_deref() == Some("failed_unexpected"))
}

fn completed_worker_evidence_action_refs_are_complete(action: &QueueWorkflowAction) -> bool {
    let Some(target) = action_ref_value(action.target_refs_json.as_deref()) else {
        return false;
    };
    let Some(result) = action_ref_value(action.result_refs_json.as_deref()) else {
        return false;
    };
    [
        "workflowRunId",
        "slot",
        "taskId",
        "runId",
        "settingsHash",
        "executionTargetHash",
    ]
    .iter()
    .all(|field| optional_string_ref(&target, field).is_some())
        && ["evidenceBundleId", "runId", "outcome", "workerFinalStatus"]
            .iter()
            .all(|field| optional_string_ref(&result, field).is_some())
}

fn action_ref_phase(raw: Option<&str>) -> Option<String> {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| {
            value
                .as_object()
                .and_then(|object| object.get("phase"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
}

fn has_completed_start_worker_action_for_slot(
    actions: &[QueueWorkflowAction],
    binding: &SlotBinding,
) -> bool {
    actions.iter().any(|action| {
        if action.action_type != "start_worker" || action.status != "completed" {
            return false;
        }
        let Some(target) = action_ref_value(action.target_refs_json.as_deref()) else {
            return false;
        };
        let Some(result) = action_ref_value(action.result_refs_json.as_deref()) else {
            return false;
        };
        let target_task_id = target
            .get("taskId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let result_run_id = result
            .get("runId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let target_slot = target
            .get("slot")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let target_settings_hash = target
            .get("settingsHash")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let target_execution_target_hash = target
            .get("executionTargetHash")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());

        target_task_id == binding.task_id.as_deref()
            && result_run_id == binding.run_id.as_deref()
            && target_settings_hash == binding.settings_hash.as_deref()
            && target_execution_target_hash == binding.execution_target_hash.as_deref()
            && match target_slot {
                Some(slot) => slot == binding.slot,
                None => true,
            }
    })
}

fn action_ref_value(raw: Option<&str>) -> Option<serde_json::Map<String, Value>> {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.as_object().cloned())
}

fn action_result_status(action: &QueueWorkflowAction) -> Option<String> {
    let refs = action_ref_value(action.result_refs_json.as_deref())?;
    optional_string_ref(&refs, "commandStatus").or_else(|| optional_string_ref(&refs, "status"))
}

fn action_result_evidence_bundle_id(action: &QueueWorkflowAction) -> Option<String> {
    let refs = action_ref_value(action.result_refs_json.as_deref())?;
    optional_string_ref(&refs, "evidenceBundleId")
}

fn recover_create_task_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status != "completed" {
        blockers.push(action_ref_blocker(
            "incomplete_workflow_action_refs",
            "A workflow create_task action exists but is not completed; resume planning will not recreate or infer the task binding.",
            action,
            None,
            None,
        ));
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(slot) = string_ref(action, &target, "slot", blockers) else {
        return;
    };
    let binding = by_slot.entry(slot.clone()).or_insert_with(|| SlotBinding {
        slot: slot.clone(),
        ..SlotBinding::default()
    });
    set_binding_string(
        binding,
        "taskId",
        string_ref(action, &result, "taskId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "taskSpecHash",
        string_ref(action, &target, "taskSpecHash", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "dependencySpecHash",
        string_ref(action, &target, "dependencySpecHash", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "dependencyEdgeHash",
        string_ref(action, &result, "dependencyEdgeHash", blockers),
        action,
        blockers,
    );
    set_binding_strings(
        binding,
        "dependsOnSlots",
        string_array_ref(&target, "dependsOnSlots"),
        action,
        blockers,
    );
    set_binding_strings(
        binding,
        "dependencyTaskIds",
        string_array_ref(&result, "dependencyTaskIds"),
        action,
        blockers,
    );
}

fn recover_update_run_settings_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status != "completed" {
        blockers.push(action_ref_blocker(
            "incomplete_workflow_action_refs",
            "A workflow update_run_settings action exists but is not completed; resume planning will not infer setup state.",
            action,
            None,
            None,
        ));
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(slot) = string_ref(action, &target, "slot", blockers) else {
        return;
    };
    let Some(binding) = binding_for_action_slot(by_slot, action, &slot, blockers) else {
        return;
    };
    set_binding_string(
        binding,
        "taskId",
        string_ref(action, &target, "taskId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "settingsHash",
        string_ref(action, &target, "settingsHash", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "executionTargetHash",
        optional_string_ref(&target, "executionTargetHash"),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "executionTargetKind",
        optional_string_ref(&target, "executionTargetKind"),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "providerId",
        optional_string_ref(&target, "providerId"),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "queueOwnerWidgetInstanceId",
        optional_string_ref(&target, "queueOwnerWidgetInstanceId"),
        action,
        blockers,
    );
    let execution_target_kind = binding
        .execution_target_kind
        .clone()
        .or_else(|| optional_string_ref(&target, "executionTargetKind"))
        .or_else(|| optional_string_ref(&result, "executionTargetKind"));
    set_binding_string(
        binding,
        "executorWidgetId",
        if execution_target_kind.as_deref() == Some("queue_local") {
            optional_string_ref(&result, "executorWidgetId")
        } else {
            string_ref(action, &result, "executorWidgetId", blockers)
        },
        action,
        blockers,
    );
    binding.update_run_settings_action_id = Some(action.action_id.clone());
    binding.update_run_settings_action_idempotency_key = Some(action.idempotency_key.clone());
}

fn recover_promote_task_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status != "completed" {
        blockers.push(action_ref_blocker(
            "incomplete_workflow_action_refs",
            "A workflow promote_task action exists but is not completed; resume planning will not infer promoted state.",
            action,
            None,
            None,
        ));
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(slot) = string_ref(action, &target, "slot", blockers) else {
        return;
    };
    let Some(binding) = binding_for_action_slot(by_slot, action, &slot, blockers) else {
        return;
    };
    set_binding_string(
        binding,
        "taskId",
        string_ref(action, &target, "taskId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "taskSpecHash",
        string_ref(action, &target, "taskSpecHash", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "settingsHash",
        string_ref(action, &target, "settingsHash", blockers),
        action,
        blockers,
    );
    binding.promoted = true;
    set_binding_string(
        binding,
        "promotedTaskStatus",
        string_ref(action, &result, "taskState", blockers),
        action,
        blockers,
    );
    binding.promote_action_id = Some(action.action_id.clone());
    binding.promote_action_idempotency_key = Some(action.idempotency_key.clone());
}

fn recover_start_worker_action(
    run: &QueueWorkflowRun,
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status == "blocked" {
        blockers.push(action_ref_blocker(
            action
                .blocker_code
                .as_deref()
                .unwrap_or("start_state_unknown"),
            action.blocker_message.as_deref().unwrap_or(
                "A workflow start_worker action is blocked and cannot be retried blindly.",
            ),
            action,
            None,
            None,
        ));
        return;
    }
    if action.status != "completed" {
        blockers.push(action_ref_blocker(
            "start_state_unknown",
            "A workflow start_worker action exists without a durable runId; resume planning will not start a duplicate worker.",
            action,
            None,
            None,
        ));
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    if target
        .get("workflowRunId")
        .and_then(Value::as_str)
        .is_some_and(|id| id != run.workflow_run_id)
    {
        blockers.push(action_ref_blocker(
            "workflow_action_ref_mismatch",
            "A workflow start_worker action references a different workflowRunId.",
            action,
            None,
            None,
        ));
        return;
    }
    let Some(task_id) = string_ref(action, &target, "taskId", blockers) else {
        return;
    };
    let slot = match optional_string_ref(&target, "slot") {
        Some(slot) => slot,
        None => match unique_slot_for_task(by_slot, &task_id) {
            TaskSlotMatch::Found(slot) => slot,
            TaskSlotMatch::Missing => {
                blockers.push(action_ref_blocker(
                    "incomplete_slot_binding",
                    "A workflow start_worker action has durable refs but no matching task slot binding.",
                    action,
                    Some(&task_id),
                    Some("slot"),
                ));
                return;
            }
            TaskSlotMatch::Ambiguous => {
                blockers.push(action_ref_blocker(
                    "ambiguous_slot_binding",
                    "A workflow start_worker action taskId maps to multiple slots; resume planning will not guess.",
                    action,
                    Some(&task_id),
                    Some("slot"),
                ));
                return;
            }
        },
    };
    let Some(binding) = binding_for_action_slot(by_slot, action, &slot, blockers) else {
        return;
    };
    set_binding_string(binding, "taskId", Some(task_id), action, blockers);
    set_binding_string(
        binding,
        "executionTargetKind",
        optional_string_ref(&target, "executionTargetKind"),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "providerId",
        optional_string_ref(&target, "providerId"),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "queueOwnerWidgetInstanceId",
        optional_string_ref(&target, "queueOwnerWidgetInstanceId"),
        action,
        blockers,
    );
    let execution_target_kind = binding
        .execution_target_kind
        .clone()
        .or_else(|| optional_string_ref(&target, "executionTargetKind"))
        .or_else(|| {
            binding
                .run_settings
                .as_ref()
                .and_then(|settings| settings.execution_target.as_ref())
                .map(|target| target.kind.clone())
        });
    set_binding_string(
        binding,
        "executorWidgetId",
        if execution_target_kind.as_deref() == Some("queue_local") {
            optional_string_ref(&target, "executorWidgetId")
        } else {
            string_ref(action, &target, "executorWidgetId", blockers)
        },
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "settingsHash",
        string_ref(action, &target, "settingsHash", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "executionTargetHash",
        optional_string_ref(&target, "executionTargetHash"),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "runId",
        string_ref(action, &result, "runId", blockers),
        action,
        blockers,
    );
}

fn recover_worker_evidence_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if is_stale_retryable_record_worker_evidence_action(action) {
        return;
    }
    if action.status != "completed" {
        blockers.push(action_ref_blocker(
            "incomplete_workflow_action_refs",
            "A workflow record_worker_evidence action exists but is not completed; resume planning will not infer evidence state.",
            action,
            None,
            None,
        ));
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(slot) = string_ref(action, &target, "slot", blockers) else {
        return;
    };
    let Some(binding) = binding_for_action_slot(by_slot, action, &slot, blockers) else {
        return;
    };
    set_binding_string(
        binding,
        "taskId",
        string_ref(action, &target, "taskId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "runId",
        string_ref(action, &target, "runId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "evidenceBundleId",
        string_ref(action, &result, "evidenceBundleId", blockers),
        action,
        blockers,
    );
}

fn recover_review_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status != "completed" {
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let result = action
        .result_refs_json
        .as_deref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let Some(task_id) = string_ref(action, &target, "taskId", blockers) else {
        return;
    };
    let Some(slot) = slot_for_task(by_slot, &task_id) else {
        blockers.push(action_ref_blocker(
            "incomplete_slot_binding",
            "A workflow review action has durable refs but no matching task slot binding.",
            action,
            Some(&task_id),
            None,
        ));
        return;
    };
    let binding = by_slot.get_mut(&slot).expect("slot exists");
    let message_id = string_ref(action, &result, "messageId", blockers)
        .or_else(|| string_ref(action, &target, "messageId", blockers));
    set_binding_string(binding, "messageId", message_id, action, blockers);
}

fn recover_decision_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    decision_field: &str,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status != "completed" {
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(task_id) = string_ref(action, &target, "taskId", blockers) else {
        return;
    };
    let Some(slot) = slot_for_task(by_slot, &task_id) else {
        blockers.push(action_ref_blocker(
            "incomplete_slot_binding",
            "A workflow finalization action has durable refs but no matching task slot binding.",
            action,
            Some(&task_id),
            None,
        ));
        return;
    };
    let binding = by_slot.get_mut(&slot).expect("slot exists");
    set_binding_string(binding, "taskId", Some(task_id), action, blockers);
    set_binding_string(
        binding,
        "runId",
        string_ref(action, &target, "runId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "evidenceBundleId",
        string_ref(action, &target, "evidenceBundleId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "messageId",
        string_ref(action, &target, "messageId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        decision_field,
        string_ref(action, &result, "decisionId", blockers),
        action,
        blockers,
    );
}

fn action_ref_object(
    action: &QueueWorkflowAction,
    raw: Option<&str>,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) -> Option<serde_json::Map<String, Value>> {
    let Some(raw) = raw else {
        blockers.push(action_ref_blocker(
            "incomplete_workflow_action_refs",
            "A workflow action is missing required typed refs for restart recovery.",
            action,
            None,
            None,
        ));
        return None;
    };
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::Object(object)) => Some(object),
        _ => {
            blockers.push(action_ref_blocker(
                "incomplete_workflow_action_refs",
                "A workflow action has invalid typed refs for restart recovery.",
                action,
                None,
                None,
            ));
            None
        }
    }
}

fn string_ref(
    action: &QueueWorkflowAction,
    object: &serde_json::Map<String, Value>,
    field: &str,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) -> Option<String> {
    let value = object
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    if value.is_none() {
        blockers.push(action_ref_blocker(
            "incomplete_workflow_action_refs",
            &format!("A workflow action is missing required typed ref field `{field}`."),
            action,
            None,
            Some(field),
        ));
    }
    value
}

fn optional_string_ref(object: &serde_json::Map<String, Value>, field: &str) -> Option<String> {
    object
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn string_array_ref(object: &serde_json::Map<String, Value>, field: &str) -> Vec<String> {
    object
        .get(field)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn binding_for_action_slot<'a>(
    by_slot: &'a mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    slot: &str,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) -> Option<&'a mut SlotBinding> {
    if !by_slot.contains_key(slot) {
        blockers.push(action_ref_blocker(
            "incomplete_slot_binding",
            "A workflow action has durable refs but its slot binding is missing.",
            action,
            None,
            Some("slotBindings"),
        ));
        return None;
    }
    by_slot.get_mut(slot)
}

fn slot_for_task(by_slot: &BTreeMap<String, SlotBinding>, task_id: &str) -> Option<String> {
    by_slot.iter().find_map(|(slot, binding)| {
        (binding.task_id.as_deref() == Some(task_id)).then(|| slot.clone())
    })
}

enum TaskSlotMatch {
    Found(String),
    Missing,
    Ambiguous,
}

fn unique_slot_for_task(by_slot: &BTreeMap<String, SlotBinding>, task_id: &str) -> TaskSlotMatch {
    let mut matches = by_slot.iter().filter_map(|(slot, binding)| {
        (binding.task_id.as_deref() == Some(task_id)).then(|| slot.clone())
    });
    let Some(first) = matches.next() else {
        return TaskSlotMatch::Missing;
    };
    if matches.next().is_some() {
        return TaskSlotMatch::Ambiguous;
    }
    TaskSlotMatch::Found(first)
}

fn set_binding_string(
    binding: &mut SlotBinding,
    field: &str,
    incoming: Option<String>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    let Some(incoming) = incoming else {
        return;
    };
    let target = match field {
        "taskId" => &mut binding.task_id,
        "taskSpecHash" => &mut binding.task_spec_hash,
        "dependencySpecHash" => &mut binding.dependency_spec_hash,
        "dependencyEdgeHash" => &mut binding.dependency_edge_hash,
        "settingsHash" => &mut binding.settings_hash,
        "executionTargetHash" => &mut binding.execution_target_hash,
        "executionTargetKind" => &mut binding.execution_target_kind,
        "providerId" => &mut binding.provider_id,
        "queueOwnerWidgetInstanceId" => &mut binding.queue_owner_widget_instance_id,
        "promotedTaskStatus" => &mut binding.promoted_task_status,
        "runId" => &mut binding.run_id,
        "evidenceBundleId" => &mut binding.evidence_bundle_id,
        "messageId" => &mut binding.message_id,
        "completionDecisionId" => &mut binding.completion_decision_id,
        "failureDecisionId" => &mut binding.failure_decision_id,
        "executorWidgetId" => &mut binding.executor_widget_id,
        _ => return,
    };
    if let Some(existing) = target.as_deref() {
        if existing != incoming {
            blockers.push(action_ref_blocker(
                "workflow_action_ref_binding_mismatch",
                &format!(
                    "A workflow action typed ref for `{field}` conflicts with the persisted slot binding."
                ),
                action,
                binding.task_id.as_deref(),
                Some(field),
            ));
        }
        return;
    }
    *target = Some(incoming);
}

fn set_binding_strings(
    binding: &mut SlotBinding,
    field: &str,
    incoming: Vec<String>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if incoming.is_empty() {
        return;
    }
    let target = match field {
        "dependsOnSlots" => &mut binding.depends_on_slots,
        "dependencyTaskIds" => &mut binding.dependency_task_ids,
        _ => return,
    };
    if !target.is_empty() {
        if !same_string_set(target, &incoming) {
            blockers.push(action_ref_blocker(
                "workflow_action_ref_binding_mismatch",
                &format!(
                    "A workflow action typed ref for `{field}` conflicts with the persisted slot binding."
                ),
                action,
                binding.task_id.as_deref(),
                Some(field),
            ));
        }
        return;
    }
    *target = incoming;
}

fn action_ref_blocker(
    code: &str,
    message: &str,
    action: &QueueWorkflowAction,
    task_id: Option<&str>,
    missing_required_field: Option<&str>,
) -> QueueWorkflowResumeBlocker {
    QueueWorkflowResumeBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        slot: action_target_string(action, "slot"),
        task_id: task_id.map(str::to_owned).or_else(|| {
            action_target_string(action, "taskId")
                .or_else(|| action_result_string(action, "taskId"))
        }),
        run_id: action_target_string(action, "runId")
            .or_else(|| action_result_string(action, "runId")),
        evidence_bundle_id: action_target_string(action, "evidenceBundleId")
            .or_else(|| action_result_string(action, "evidenceBundleId")),
        message_id: action_target_string(action, "messageId")
            .or_else(|| action_result_string(action, "messageId")),
        completion_decision_id: action_result_string(action, "completionDecisionId")
            .or_else(|| action_result_string(action, "decisionId")),
        failure_decision_id: action_result_string(action, "failureDecisionId")
            .or_else(|| action_result_string(action, "decisionId")),
        missing_required_field: missing_required_field.map(str::to_owned),
    }
}

fn action_target_string(action: &QueueWorkflowAction, field: &str) -> Option<String> {
    action
        .target_refs_json
        .as_deref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.get(field).and_then(Value::as_str).map(str::to_owned))
}

fn action_result_string(action: &QueueWorkflowAction, field: &str) -> Option<String> {
    action
        .result_refs_json
        .as_deref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.get(field).and_then(Value::as_str).map(str::to_owned))
}

fn optional_string_field(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn optional_string_array_field(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn parse_slot_run_settings(value: Option<&Value>) -> Option<SlotRunSettings> {
    let fields = value.and_then(Value::as_object)?;
    let execution_target = if let Some(value) = fields.get("executionTarget") {
        Some(parse_slot_execution_target(value)?)
    } else {
        None
    };
    let executor_widget_id = optional_string_field(fields.get("executorWidgetId"))
        .or_else(|| {
            execution_target
                .as_ref()
                .and_then(|target| target.executor_widget_id.clone())
        })
        .or_else(|| {
            if execution_target
                .as_ref()
                .map_or(false, |target| target.kind == "queue_local")
            {
                Some(String::new())
            } else {
                None
            }
        })?;
    Some(SlotRunSettings {
        execution_workspace: optional_string_field(fields.get("executionWorkspace"))?,
        codex_executable: optional_string_field(fields.get("codexExecutable"))?,
        sandbox: optional_string_field(fields.get("sandbox"))?,
        approval_policy: optional_string_field(fields.get("approvalPolicy"))?,
        execution_policy: optional_string_field(fields.get("executionPolicy"))?,
        execution_target,
        executor_widget_id,
    })
}

fn parse_slot_execution_target(value: &Value) -> Option<QueueWorkflowExecutionTarget> {
    let fields = value.as_object()?;
    Some(QueueWorkflowExecutionTarget {
        kind: optional_string_field(fields.get("kind"))?,
        provider_id: optional_string_field(fields.get("providerId"))?,
        queue_owner_widget_instance_id: optional_string_field(
            fields.get("queueOwnerWidgetInstanceId"),
        ),
        executor_widget_id: optional_string_field(fields.get("executorWidgetId")),
    })
}

fn parse_task_templates(
    inputs: Option<&Value>,
) -> Result<BTreeMap<String, ResumeTaskTemplate>, QueueWorkflowResumeBlocker> {
    let Some(tasks) = inputs
        .and_then(|value| value.get("tasks"))
        .and_then(Value::as_array)
    else {
        return Ok(BTreeMap::new());
    };

    let mut templates = BTreeMap::new();
    for task in tasks {
        let Some(fields) = task.as_object() else {
            return Err(blocker(
                "invalid_task_template",
                "inputs.tasks entries must be typed task template objects.",
                None,
                Some("inputs.tasks"),
            ));
        };
        let Some(slot) = optional_string_field(fields.get("slot")) else {
            return Err(blocker(
                "invalid_task_template",
                "inputs.tasks entries must include an explicit slot.",
                None,
                Some("inputs.tasks.slot"),
            ));
        };
        if templates.contains_key(&slot) {
            return Err(blocker(
                "duplicate_task_slot",
                "inputs.tasks contains duplicate slot values.",
                Some(&slot),
                Some("inputs.tasks.slot"),
            ));
        }

        let task_spec = QueueWorkflowTaskSpec {
            title: optional_string_field(fields.get("title")).unwrap_or_default(),
            prompt: optional_string_field(fields.get("prompt")).unwrap_or_default(),
            description: optional_string_field(fields.get("description")),
            status: optional_string_field(fields.get("status")),
            priority: fields.get("priority").and_then(Value::as_i64),
        };
        let depends_on_slots = optional_string_array_field(fields.get("dependsOnSlots"));
        let (task_spec, depends_on_slots, task_spec_hash, dependency_spec_hash) =
            normalize_queue_workflow_task_spec_for_hash(task_spec, depends_on_slots).map_err(
                |message| {
                    blocker(
                        "invalid_task_template",
                        &message,
                        Some(&slot),
                        Some("inputs.tasks"),
                    )
                },
            )?;
        templates.insert(
            slot,
            ResumeTaskTemplate {
                task_spec,
                depends_on_slots,
                task_spec_hash,
                dependency_spec_hash,
            },
        );
    }

    Ok(templates)
}

fn validate_task_materialization_binding(
    workspace_id: &str,
    binding: &SlotBinding,
    task: &AgentQueueTaskRow,
    task_template: Option<&ResumeTaskTemplate>,
    slot_bindings: &BTreeMap<String, SlotBinding>,
    store: &hobit_storage_sqlite::SqliteStore,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) -> Result<(), WorkspaceServiceError> {
    if let (Some(bound_hash), Some(template)) = (binding.task_spec_hash.as_deref(), task_template) {
        if bound_hash != template.task_spec_hash {
            blockers.push(binding_blocker(
                "task_spec_hash_mismatch",
                "Persisted taskSpecHash no longer matches the typed workflow task template.",
                binding,
                Some("taskSpecHash"),
            ));
        }
        if task.title != template.task_spec.title
            || task.description != template.task_spec.description
            || task.prompt != template.task_spec.prompt
            || task.priority != template.task_spec.priority
        {
            blockers.push(binding_blocker(
                "task_spec_state_mismatch",
                "Bound Queue task row no longer matches the typed workflow task template.",
                binding,
                None,
            ));
        }
    }

    validate_settings_binding(binding, task, blockers);
    validate_promote_binding(binding, task, blockers);

    if let (Some(bound_hash), Some(template)) =
        (binding.dependency_spec_hash.as_deref(), task_template)
    {
        if bound_hash != template.dependency_spec_hash {
            blockers.push(binding_blocker(
                "dependency_spec_hash_mismatch",
                "Persisted dependencySpecHash no longer matches explicit dependsOnSlots.",
                binding,
                Some("dependencySpecHash"),
            ));
        }
    }

    let expected_task_ids = expected_dependency_task_ids(binding, task_template, slot_bindings);
    if expected_task_ids.is_empty() && binding.dependency_edge_hash.is_none() {
        return Ok(());
    }

    for task_id in &expected_task_ids {
        if store.get_agent_queue_task(workspace_id, task_id)?.is_none() {
            blockers.push(binding_blocker(
                "dependency_task_missing",
                "Persisted dependency edge references an upstream task that is missing.",
                binding,
                Some("dependencyTaskIds"),
            ));
        }
    }

    let actual_task_ids = task_dependency_ids(task).unwrap_or_default();
    if !same_string_set(&actual_task_ids, &expected_task_ids) {
        blockers.push(binding_blocker(
            "dependency_edge_missing",
            "Bound Queue task depends_on does not match explicit workflow dependsOnSlots.",
            binding,
            Some("dependsOnSlots"),
        ));
    }

    if let Some(bound_edge_hash) = binding.dependency_edge_hash.as_deref() {
        let expected_edge_hash = workflow_dependency_edge_hash(&expected_task_ids);
        if bound_edge_hash != expected_edge_hash {
            blockers.push(binding_blocker(
                "dependency_edge_hash_mismatch",
                "Persisted dependencyEdgeHash no longer matches the durable dependency task ids.",
                binding,
                Some("dependencyEdgeHash"),
            ));
        }
    }

    Ok(())
}

fn validate_settings_binding(
    binding: &SlotBinding,
    task: &AgentQueueTaskRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    let Some(settings_hash) = binding.settings_hash.as_deref() else {
        if binding_has_runtime_progress(binding) {
            return;
        }
        let pristine_materialized_task = task.execution_policy == "manual"
            && task.execution_workspace.is_none()
            && task.codex_executable.is_none()
            && task.sandbox.is_none()
            && task.approval_policy.is_none()
            && task.assigned_executor_widget_id.is_none();
        if !pristine_materialized_task {
            blockers.push(binding_blocker(
                "settings_durable_mismatch",
                "Bound Queue task has durable run settings but the workflow slot binding has no settingsHash.",
                binding,
                Some("settingsHash"),
            ));
        }
        return;
    };

    let normalized = if let Some(run_settings) = binding.run_settings.as_ref() {
        QueueWorkflowRunSettings {
            execution_workspace: run_settings.execution_workspace.clone(),
            codex_executable: run_settings.codex_executable.clone(),
            sandbox: run_settings.sandbox.clone(),
            approval_policy: run_settings.approval_policy.clone(),
            execution_policy: run_settings.execution_policy.clone(),
            execution_target: run_settings.execution_target.clone(),
            executor_widget_id: run_settings.executor_widget_id.clone(),
        }
    } else {
        match run_settings_from_durable_task(binding, task) {
            Ok(settings) => settings,
            Err(missing_field) => {
                blockers.push(binding_blocker(
                    "settings_binding_missing",
                    "Workflow slot binding has settingsHash but durable run settings are incomplete.",
                    binding,
                    Some(missing_field),
                ));
                return;
            }
        }
    };
    let (canonical_settings, expected_hash) =
        match normalize_queue_workflow_run_settings_for_hash(normalized) {
            Ok((canonical_settings, expected_hash)) => (canonical_settings, expected_hash),
            Err(_) => {
                blockers.push(binding_blocker(
                    "settings_binding_invalid",
                    "Workflow slot binding contains an invalid runSettings snapshot.",
                    binding,
                    Some("runSettings"),
                ));
                return;
            }
        };
    let expected_executor_widget_id = canonical_settings.executor_widget_id.clone();
    if expected_hash != settings_hash {
        blockers.push(binding_blocker(
            "settings_hash_mismatch",
            "Persisted settingsHash no longer matches the bounded runSettings snapshot.",
            binding,
            Some("settingsHash"),
        ));
    }

    if task.assigned_executor_widget_id.clone().unwrap_or_default() != expected_executor_widget_id {
        blockers.push(binding_blocker(
            "executor_widget_mismatch",
            "Workflow slot executorWidgetId does not match the durable task assignment.",
            binding,
            Some("executorWidgetId"),
        ));
    }
    if let Some(binding_executor) = binding.executor_widget_id.as_deref() {
        if binding_executor != expected_executor_widget_id {
            blockers.push(binding_blocker(
                "executor_widget_mismatch",
                "Workflow slot executorWidgetId does not match the bounded runSettings snapshot.",
                binding,
                Some("executorWidgetId"),
            ));
        }
    }

    match durable_settings_hash_for_task_with_target(
        task,
        &canonical_settings.execution_target,
    ) {
        Some(actual_hash) if actual_hash == settings_hash => {}
        Some(_) => blockers.push(binding_blocker(
            "settings_durable_mismatch",
            "Workflow settingsHash does not match durable task run settings.",
            binding,
            Some("settingsHash"),
        )),
        None => blockers.push(binding_blocker(
            "settings_durable_mismatch",
            "Workflow settingsHash requires complete durable task run settings and executor assignment.",
            binding,
            Some("settingsHash"),
        )),
    }
}

fn validate_promote_binding(
    binding: &SlotBinding,
    task: &AgentQueueTaskRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    let durable_promoted = task.status != AGENT_QUEUE_TASK_STATUS_DRAFT;
    if binding.promoted && !durable_promoted {
        blockers.push(binding_blocker(
            "promote_state_mismatch",
            "Workflow slot is marked promoted but the durable Queue task is still draft.",
            binding,
            Some("promoted"),
        ));
    }
    if !binding.promoted && durable_promoted && !binding_has_runtime_progress(binding) {
        blockers.push(binding_blocker(
            "promote_state_mismatch",
            "Durable Queue task has left draft state but the workflow slot has no promote binding.",
            binding,
            Some("promoted"),
        ));
    }
    if binding.promoted
        && (binding.promote_action_id.is_none() || binding.promote_action_idempotency_key.is_none())
    {
        blockers.push(binding_blocker(
            "promote_state_mismatch",
            "Workflow slot promote binding is missing durable promote action refs.",
            binding,
            Some("promoteActionId"),
        ));
    }
    if binding.settings_hash.is_none() && binding.promoted {
        blockers.push(binding_blocker(
            "settings_durable_mismatch",
            "Workflow slot cannot be promoted without a persisted settingsHash.",
            binding,
            Some("settingsHash"),
        ));
    }
    if let Some(promoted_task_status) = binding.promoted_task_status.as_deref() {
        if binding.promoted
            && matches!(
                task.status.as_str(),
                AGENT_QUEUE_TASK_STATUS_QUEUED | AGENT_QUEUE_TASK_STATUS_READY
            )
            && promoted_task_status != task.status
        {
            blockers.push(binding_blocker(
                "promote_state_mismatch",
                "Workflow slot promoted task status no longer matches the durable queued task state.",
                binding,
                Some("promotedTaskStatus"),
            ));
        }
    }
}

fn run_settings_from_durable_task(
    binding: &SlotBinding,
    task: &AgentQueueTaskRow,
) -> Result<QueueWorkflowRunSettings, &'static str> {
    let execution_workspace = task
        .execution_workspace
        .clone()
        .ok_or("runSettingsSnapshot")?;
    let codex_executable = task.codex_executable.clone().ok_or("runSettingsSnapshot")?;
    let sandbox = task.sandbox.clone().ok_or("runSettingsSnapshot")?;
    let approval_policy = task.approval_policy.clone().ok_or("runSettingsSnapshot")?;

    if binding.execution_target_kind.as_deref() == Some("queue_local") {
        let provider_id = binding.provider_id.clone().ok_or("providerId")?;
        if binding.execution_target_hash.is_none() {
            return Err("executionTargetHash");
        }
        return Ok(QueueWorkflowRunSettings {
            execution_workspace,
            codex_executable,
            sandbox,
            approval_policy,
            execution_policy: task.execution_policy.clone(),
            execution_target: Some(QueueWorkflowExecutionTarget {
                kind: "queue_local".to_owned(),
                provider_id,
                queue_owner_widget_instance_id: binding.queue_owner_widget_instance_id.clone(),
                executor_widget_id: None,
            }),
            executor_widget_id: String::new(),
        });
    }

    Ok(QueueWorkflowRunSettings {
        execution_workspace,
        codex_executable,
        sandbox,
        approval_policy,
        execution_policy: task.execution_policy.clone(),
        execution_target: None,
        executor_widget_id: task
            .assigned_executor_widget_id
            .clone()
            .ok_or("executorWidgetId")?,
    })
}

fn binding_has_runtime_progress(binding: &SlotBinding) -> bool {
    binding.run_id.is_some()
        || binding.evidence_bundle_id.is_some()
        || binding.message_id.is_some()
        || binding.completion_decision_id.is_some()
        || binding.failure_decision_id.is_some()
}

fn expected_dependency_task_ids(
    binding: &SlotBinding,
    task_template: Option<&ResumeTaskTemplate>,
    slot_bindings: &BTreeMap<String, SlotBinding>,
) -> Vec<String> {
    if !binding.dependency_task_ids.is_empty() {
        let mut task_ids = binding.dependency_task_ids.clone();
        task_ids.sort();
        task_ids.dedup();
        return task_ids;
    }

    let depends_on_slots = task_template
        .map(|template| template.depends_on_slots.as_slice())
        .unwrap_or(binding.depends_on_slots.as_slice());
    let mut task_ids = depends_on_slots
        .iter()
        .filter_map(|slot| slot_bindings.get(slot))
        .filter_map(|binding| binding.task_id.clone())
        .collect::<Vec<_>>();
    task_ids.sort();
    task_ids.dedup();
    task_ids
}

fn task_dependency_ids(task: &AgentQueueTaskRow) -> Result<Vec<String>, serde_json::Error> {
    let mut ids = serde_json::from_str::<Vec<String>>(&task.depends_on)?;
    ids.sort();
    ids.dedup();
    Ok(ids)
}

fn same_string_set(left: &[String], right: &[String]) -> bool {
    let mut left = left.to_vec();
    let mut right = right.to_vec();
    left.sort();
    left.dedup();
    right.sort();
    right.dedup();
    left == right
}

fn derive_next_step(
    run: &QueueWorkflowRun,
    slots: &[ReconciledSlot],
    inputs: Option<&Value>,
    variables: Option<&Value>,
) -> DerivedStep {
    if slots.is_empty() {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::ResumeReadOnlyReady,
            next_phase: Some("setup".to_owned()),
            next_step: Some("waiting_for_task_creation_phase".to_owned()),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: Vec::new(),
        };
    }

    let Some(slot) = target_slot(run, slots) else {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::BlockedStateMismatch,
            next_phase: Some(run.phase.clone()),
            next_step: run.current_step.clone(),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: vec![blocker(
                "ambiguous_slot_binding",
                "Resume planning requires an explicit upstream slot or exactly one slot binding.",
                None,
                Some("slotBindings.upstream"),
            )],
        };
    };

    if slot.binding.task_id.is_none() {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::BlockedMissingTask,
            next_phase: Some(run.phase.clone()),
            next_step: Some("waiting_for_task_binding".to_owned()),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: vec![binding_blocker(
                "task_missing",
                "Resume planning requires an explicit bound taskId for the target slot.",
                &slot.binding,
                Some("taskId"),
            )],
        };
    }

    if slot.completion_decision.is_some() {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::ResumeReadOnlyReady,
            next_phase: Some("closed".to_owned()),
            next_step: Some("completed_idempotent_acceptance".to_owned()),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: Vec::new(),
        };
    }
    if slot.failure_decision.is_some() {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::ResumeReadOnlyReady,
            next_phase: Some("closed".to_owned()),
            next_step: Some("completed_idempotent_failure".to_owned()),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: Vec::new(),
        };
    }

    if slot.run_link.is_none() {
        if slot.binding.settings_hash.is_none() {
            return DerivedStep {
                status: QueueWorkflowResumePlanStatus::WaitingForRunSettings,
                next_phase: Some("setup".to_owned()),
                next_step: Some("waiting_for_run_settings".to_owned()),
                required_fresh_grant: true,
                required_confirmation: false,
                blockers: Vec::new(),
            };
        }
        if !slot.binding.promoted {
            return DerivedStep {
                status: QueueWorkflowResumePlanStatus::WaitingForPromote,
                next_phase: Some("setup".to_owned()),
                next_step: Some("waiting_for_promote".to_owned()),
                required_fresh_grant: true,
                required_confirmation: false,
                blockers: Vec::new(),
            };
        }
        let next_step = match slot.aggregate.as_ref() {
            Some(aggregate) if has_next_action(aggregate, "start_run") => "start_worker_ready",
            Some(aggregate)
                if matches!(
                    aggregate.dependency_state.as_str(),
                    "waiting" | "blocked" | "failed_upstream" | "unknown"
                ) =>
            {
                "waiting_for_dependency_completion"
            }
            _ => "setup_or_start_worker_not_ready",
        };
        return DerivedStep {
            status: match next_step {
                "start_worker_ready" => QueueWorkflowResumePlanStatus::BlockedMissingConfirmation,
                "waiting_for_dependency_completion" => {
                    QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
                }
                _ => QueueWorkflowResumePlanStatus::BlockedStateMismatch,
            },
            next_phase: Some(if next_step == "start_worker_ready" {
                "run_start".to_owned()
            } else if next_step == "waiting_for_dependency_completion" {
                "dependency_wait".to_owned()
            } else {
                "setup".to_owned()
            }),
            next_step: Some(next_step.to_owned()),
            required_fresh_grant: next_step == "start_worker_ready",
            required_confirmation: next_step == "start_worker_ready",
            blockers: (next_step == "setup_or_start_worker_not_ready")
                .then(|| {
                    vec![binding_blocker(
                        "task_not_ready_for_resume",
                        "Bound Queue task aggregate does not expose a deterministic setup or start step.",
                        &slot.binding,
                        None,
                    )]
                })
                .unwrap_or_default(),
        };
    }

    if slot.evidence.is_none() {
        if let Some(run_link) = slot.run_link.as_ref() {
            if run_link.status == "running" {
                return DerivedStep {
                    status: QueueWorkflowResumePlanStatus::ResumeReadOnlyReady,
                    next_phase: Some("worker_evidence".to_owned()),
                    next_step: Some("awaiting_worker_completion".to_owned()),
                    required_fresh_grant: false,
                    required_confirmation: false,
                    blockers: Vec::new(),
                };
            }
            if is_completed_worker_run_state(run_link) {
                return DerivedStep {
                    status: QueueWorkflowResumePlanStatus::WaitingForWorkerEvidence,
                    next_phase: Some("worker_evidence".to_owned()),
                    next_step: Some("waiting_for_worker_evidence".to_owned()),
                    required_fresh_grant: false,
                    required_confirmation: false,
                    blockers: Vec::new(),
                };
            }
        }

        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::BlockedStateMismatch,
            next_phase: Some("worker_evidence".to_owned()),
            next_step: Some("blocked_worker_state_ambiguous".to_owned()),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: vec![binding_blocker(
                "worker_state_ambiguous",
                "Bound worker run is not running and is not a deterministic completed state.",
                &slot.binding,
                Some("runId"),
            )],
        };
    }

    match slot.review_message.as_ref() {
        None => {
            return DerivedStep {
                status: QueueWorkflowResumePlanStatus::ResumeReady,
                next_phase: Some("review".to_owned()),
                next_step: Some("review_create_ready".to_owned()),
                required_fresh_grant: true,
                required_confirmation: false,
                blockers: Vec::new(),
            };
        }
        Some(message) if message.status != REVIEW_MESSAGE_STATUS_ACKNOWLEDGED => {
            return DerivedStep {
                status: QueueWorkflowResumePlanStatus::BlockedMissingReviewAck,
                next_phase: Some("review".to_owned()),
                next_step: Some("review_ack_ready".to_owned()),
                required_fresh_grant: true,
                required_confirmation: false,
                blockers: vec![binding_blocker(
                    "review_ack_missing",
                    "The durable review message exists but has not been ACKed.",
                    &slot.binding,
                    Some("messageId"),
                )],
            };
        }
        Some(_) => {}
    }

    let failure_workflow = matches!(
        run.workflow_id.as_str(),
        "dependency_failure_smoke" | "terminal_failure"
    );
    if failure_workflow && failure_reason(inputs, variables).is_none() {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::BlockedStateMismatch,
            next_phase: Some("decision".to_owned()),
            next_step: Some("fail_ready".to_owned()),
            required_fresh_grant: true,
            required_confirmation: true,
            blockers: vec![blocker(
                "failure_reason_missing",
                "Terminal failure resume planning requires a structured failureReason.",
                None,
                Some("failureReason"),
            )],
        };
    }

    DerivedStep {
        status: QueueWorkflowResumePlanStatus::BlockedMissingConfirmation,
        next_phase: Some("decision".to_owned()),
        next_step: Some(if failure_workflow {
            "fail_ready".to_owned()
        } else {
            "mark_done_ready".to_owned()
        }),
        required_fresh_grant: true,
        required_confirmation: true,
        blockers: vec![blocker(
            "fresh_confirmation_required",
            "A fresh exact structured confirmation is required before finalization can resume execution.",
            None,
            Some("confirmationToken"),
        )],
    }
}

fn target_slot<'a>(
    run: &QueueWorkflowRun,
    slots: &'a [ReconciledSlot],
) -> Option<&'a ReconciledSlot> {
    if let Some(slot) = slots.iter().find(|slot| slot.binding.slot == "upstream") {
        return Some(slot);
    }
    if slots.len() == 1 {
        return slots.first();
    }
    if matches!(
        run.workflow_id.as_str(),
        "review_acceptance" | "terminal_failure"
    ) {
        let task_bound_slots = slots
            .iter()
            .filter(|slot| slot.binding.task_id.is_some())
            .collect::<Vec<_>>();
        if task_bound_slots.len() == 1 {
            return task_bound_slots.first().copied();
        }
    }
    None
}

fn is_completed_worker_run_state(run_link: &AgentQueueTaskRunLinkRow) -> bool {
    run_link.completed_at.is_some()
        && matches!(
            run_link.status.as_str(),
            "completed" | "failed" | "timed_out" | "cancelled" | "review_needed"
        )
}

fn worker_evidence_outcome_for_resume(run_status: &str) -> Option<&'static str> {
    match run_status {
        "completed" => Some("completed"),
        "failed" | "timed_out" => Some("failed"),
        "cancelled" | "review_needed" => Some("not_completed"),
        _ => None,
    }
}

fn has_next_action(aggregate: &QueueItemAggregate, code: &str) -> bool {
    aggregate
        .next_actions
        .iter()
        .any(|action| action.code == code && action.available)
}

fn failure_reason(inputs: Option<&Value>, variables: Option<&Value>) -> Option<String> {
    inputs
        .and_then(|value| optional_string_field(value.get("failureReason")))
        .or_else(|| variables.and_then(|value| optional_string_field(value.get("failureReason"))))
}

fn validate_evidence_matches_binding(
    binding: &SlotBinding,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if binding
        .task_id
        .as_deref()
        .is_some_and(|task_id| task_id != evidence.queue_task_id)
    {
        blockers.push(binding_blocker(
            "evidence_task_mismatch",
            "Bound evidenceBundleId belongs to a different Queue task.",
            binding,
            None,
        ));
    }
    if binding
        .run_id
        .as_deref()
        .is_some_and(|run_id| run_id != evidence.run_id)
    {
        blockers.push(binding_blocker(
            "evidence_run_mismatch",
            "Bound evidenceBundleId belongs to a different runId.",
            binding,
            None,
        ));
    }
    if binding
        .executor_widget_id
        .as_deref()
        .zip(evidence.executor_widget_id.as_deref())
        .is_some_and(|(bound, durable)| bound != durable)
    {
        blockers.push(binding_blocker(
            "evidence_executor_mismatch",
            "Bound executorWidgetId does not match the durable evidence bundle.",
            binding,
            None,
        ));
    }
}

fn validate_review_message_matches_binding(
    binding: &SlotBinding,
    evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    message: &AgentQueueReviewMessageRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if binding
        .task_id
        .as_deref()
        .is_some_and(|task_id| task_id != message.queue_task_id)
    {
        blockers.push(binding_blocker(
            "review_message_task_mismatch",
            "Bound messageId belongs to a different Queue task.",
            binding,
            None,
        ));
    }
    if let (Some(bound_run), Some(message_run)) =
        (binding.run_id.as_deref(), message.run_id.as_deref())
    {
        if bound_run != message_run {
            blockers.push(binding_blocker(
                "review_message_run_mismatch",
                "Bound messageId belongs to a different runId.",
                binding,
                None,
            ));
        }
    }
    if let Some(evidence) = evidence {
        if evidence.queue_task_id != message.queue_task_id {
            blockers.push(binding_blocker(
                "review_message_evidence_task_mismatch",
                "Bound messageId and evidenceBundleId refer to different Queue tasks.",
                binding,
                None,
            ));
        }
        if message
            .run_id
            .as_deref()
            .is_some_and(|message_run| message_run != evidence.run_id)
        {
            blockers.push(binding_blocker(
                "review_message_evidence_run_mismatch",
                "Bound messageId and evidenceBundleId refer to different runs.",
                binding,
                None,
            ));
        }
    }
}

fn validate_completion_decision_matches_binding(
    binding: &SlotBinding,
    message: Option<&AgentQueueReviewMessageRow>,
    decision: &AgentQueueCompletionDecisionRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if binding
        .task_id
        .as_deref()
        .is_some_and(|task_id| task_id != decision.queue_task_id)
    {
        blockers.push(binding_blocker(
            "completion_decision_task_mismatch",
            "Bound completionDecisionId belongs to a different Queue task.",
            binding,
            None,
        ));
    }
    if let (Some(bound_run), Some(decision_run)) =
        (binding.run_id.as_deref(), decision.run_id.as_deref())
    {
        if bound_run != decision_run {
            blockers.push(binding_blocker(
                "completion_decision_run_mismatch",
                "Bound completionDecisionId belongs to a different runId.",
                binding,
                None,
            ));
        }
    }
    if let Some(message) = message {
        if decision.review_message_id.as_deref() != Some(message.message_id.as_str()) {
            blockers.push(binding_blocker(
                "completion_decision_review_mismatch",
                "Completion decision does not reference the bound review message.",
                binding,
                None,
            ));
        }
    }
}

fn validate_failure_decision_matches_binding(
    binding: &SlotBinding,
    evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    message: Option<&AgentQueueReviewMessageRow>,
    decision: &AgentQueueFailureDecisionRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if binding
        .task_id
        .as_deref()
        .is_some_and(|task_id| task_id != decision.queue_task_id)
    {
        blockers.push(binding_blocker(
            "failure_decision_task_mismatch",
            "Bound failureDecisionId belongs to a different Queue task.",
            binding,
            None,
        ));
    }
    if let (Some(bound_run), Some(decision_run)) =
        (binding.run_id.as_deref(), decision.run_id.as_deref())
    {
        if bound_run != decision_run {
            blockers.push(binding_blocker(
                "failure_decision_run_mismatch",
                "Bound failureDecisionId belongs to a different runId.",
                binding,
                None,
            ));
        }
    }
    if let Some(evidence) = evidence {
        if decision.evidence_bundle_id.as_deref() != Some(evidence.bundle_id.as_str()) {
            blockers.push(binding_blocker(
                "failure_decision_evidence_mismatch",
                "Failure decision does not reference the bound evidence bundle.",
                binding,
                None,
            ));
        }
    }
    if let Some(message) = message {
        if decision.review_message_id.as_deref() != Some(message.message_id.as_str()) {
            blockers.push(binding_blocker(
                "failure_decision_review_mismatch",
                "Failure decision does not reference the bound review message.",
                binding,
                None,
            ));
        }
    }
}

fn grant_stale_or_scope_blocker(
    grant: Option<&Value>,
    slots: &[ReconciledSlot],
) -> Option<QueueWorkflowResumeBlocker> {
    if grant_is_expired(grant) {
        return Some(blocker(
            "grant_expired",
            "Persisted grant summary is expired or stale; a fresh grant is required after restart.",
            None,
            Some("grantSummary.expiresAt"),
        ));
    }

    let Some(grant) = grant else {
        return None;
    };
    let Some(scope) = grant.get("scope").and_then(Value::as_object) else {
        return None;
    };

    let checks = [
        ("taskIds", "taskId"),
        ("runIds", "runId"),
        ("evidenceBundleIds", "evidenceBundleId"),
        ("messageIds", "messageId"),
        ("completionDecisionIds", "completionDecisionId"),
        ("failureDecisionIds", "failureDecisionId"),
        ("executorWidgetIds", "executorWidgetId"),
    ];
    for (scope_key, field) in checks {
        let Some(allowed) = scope_array(scope.get(scope_key)) else {
            continue;
        };
        for slot in slots {
            let value = match field {
                "taskId" => slot.binding.task_id.as_deref(),
                "runId" => slot.binding.run_id.as_deref(),
                "evidenceBundleId" => slot.binding.evidence_bundle_id.as_deref(),
                "messageId" => slot.binding.message_id.as_deref(),
                "completionDecisionId" => slot.binding.completion_decision_id.as_deref(),
                "failureDecisionId" => slot.binding.failure_decision_id.as_deref(),
                "executorWidgetId" => slot.binding.executor_widget_id.as_deref(),
                _ => None,
            };
            if value.is_some_and(|id| !allowed.contains(id)) {
                return Some(binding_blocker(
                    "grant_scope_mismatch",
                    "Persisted grant scope does not include a bound workflow id.",
                    &slot.binding,
                    Some(&format!("grantSummary.scope.{scope_key}")),
                ));
            }
        }
    }

    None
}

fn grant_is_expired(grant: Option<&Value>) -> bool {
    let Some(grant) = grant else {
        return false;
    };
    let Some(expires_at) = grant.get("expiresAt") else {
        return false;
    };
    match expires_at {
        Value::String(value) if matches!(value.as_str(), "expired" | "stale") => true,
        Value::String(value) => value
            .parse::<u64>()
            .ok()
            .is_some_and(|expires| expires <= unix_epoch_secs()),
        Value::Number(value) => value
            .as_u64()
            .is_some_and(|expires| expires <= unix_epoch_secs()),
        _ => false,
    }
}

fn unix_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn scope_array(value: Option<&Value>) -> Option<BTreeSet<&str>> {
    let values = value?.as_array()?;
    Some(values.iter().filter_map(Value::as_str).collect())
}

fn status_for_blockers(blockers: &[QueueWorkflowResumeBlocker]) -> QueueWorkflowResumePlanStatus {
    if blockers.iter().any(|blocker| {
        matches!(
            blocker.blocker_code.as_str(),
            "task_missing" | "missing_task" | "dependency_task_missing"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedMissingTask;
    }
    if blockers.iter().any(|blocker| {
        matches!(
            blocker.blocker_code.as_str(),
            "dependency_edge_missing" | "dependency_edge_hash_mismatch"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedDependencyEdgeMissing;
    }
    if blockers
        .iter()
        .any(|blocker| blocker.blocker_code.contains("evidence_missing"))
    {
        return QueueWorkflowResumePlanStatus::BlockedMissingEvidence;
    }
    if blockers.iter().any(|blocker| {
        matches!(
            blocker.blocker_code.as_str(),
            "review_message_missing" | "review_ack_missing"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedMissingReviewAck;
    }
    if blockers.iter().any(|blocker| {
        matches!(
            blocker.blocker_code.as_str(),
            "grant_expired" | "grant_scope_mismatch"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedStaleGrant;
    }
    if blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "fresh_confirmation_required")
    {
        return QueueWorkflowResumePlanStatus::BlockedMissingConfirmation;
    }
    if blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "executor_widget_mismatch")
    {
        return QueueWorkflowResumePlanStatus::BlockedExecutorMismatch;
    }
    if blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "incomplete_slot_binding")
    {
        return QueueWorkflowResumePlanStatus::BlockedIncompleteSlotBinding;
    }
    if blockers.iter().any(|blocker| {
        matches!(
            blocker.blocker_code.as_str(),
            "incomplete_workflow_action_refs"
                | "start_state_unknown"
                | "orphaned_start"
                | "active_run_conflict"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs;
    }
    if blockers.iter().any(|blocker| {
        matches!(
            blocker.blocker_code.as_str(),
            "settings_hash_mismatch"
                | "settings_durable_mismatch"
                | "settings_binding_missing"
                | "settings_binding_invalid"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedSettingsMismatch;
    }
    if blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "promote_state_mismatch")
    {
        return QueueWorkflowResumePlanStatus::BlockedPromoteStateMismatch;
    }
    QueueWorkflowResumePlanStatus::BlockedStateMismatch
}

fn task_snapshot(slot: &ReconciledSlot) -> Option<QueueWorkflowTaskResumeSnapshot> {
    let aggregate = slot.aggregate.as_ref()?;
    Some(QueueWorkflowTaskResumeSnapshot {
        task_id: aggregate.task_id.clone(),
        ticket_state: aggregate.ticket_state.as_str().to_owned(),
        worker_run_state: aggregate.worker_run_state.as_str().to_owned(),
        review_state: aggregate.review_state.as_str().to_owned(),
        evidence_state: aggregate.evidence_state.as_str().to_owned(),
        validation_state: aggregate.validation_state.as_str().to_owned(),
        commit_state: aggregate.commit_state.as_str().to_owned(),
        dependency_state: aggregate.dependency_state.as_str().to_owned(),
        latest_run_id: aggregate.latest_run.as_ref().map(|run| run.run_id.clone()),
        latest_run_status: aggregate.latest_run.as_ref().map(|run| run.status.clone()),
        latest_evidence_bundle_id: slot
            .evidence
            .as_ref()
            .map(|evidence| evidence.bundle_id.clone()),
        latest_review_message_id: slot
            .review_message
            .as_ref()
            .map(|message| message.message_id.clone()),
        latest_review_message_status: slot
            .review_message
            .as_ref()
            .map(|message| message.status.clone()),
        latest_completion_decision_id: slot
            .completion_decision
            .as_ref()
            .map(|decision| decision.decision_id.clone()),
        latest_failure_decision_id: slot
            .failure_decision
            .as_ref()
            .map(|decision| decision.decision_id.clone()),
    })
}

fn slot_reconciliation(slot: &ReconciledSlot) -> QueueWorkflowSlotReconciliation {
    QueueWorkflowSlotReconciliation {
        slot: slot.binding.slot.clone(),
        task_id: slot.binding.task_id.clone(),
        run_id: slot.binding.run_id.clone(),
        evidence_bundle_id: slot.binding.evidence_bundle_id.clone(),
        message_id: slot.binding.message_id.clone(),
        completion_decision_id: slot.binding.completion_decision_id.clone(),
        failure_decision_id: slot.binding.failure_decision_id.clone(),
        executor_widget_id: slot.binding.executor_widget_id.clone(),
        task_exists: slot.task.is_some(),
        run_exists: slot.run_link.is_some(),
        evidence_exists: slot.evidence.is_some(),
        review_message_exists: slot.review_message.is_some(),
        review_message_status: slot
            .review_message
            .as_ref()
            .map(|message| message.status.clone()),
        completion_decision_exists: slot.completion_decision.is_some(),
        failure_decision_exists: slot.failure_decision.is_some(),
        aggregate_ticket_state: slot
            .aggregate
            .as_ref()
            .map(|aggregate| aggregate.ticket_state.as_str().to_owned()),
        aggregate_review_state: slot
            .aggregate
            .as_ref()
            .map(|aggregate| aggregate.review_state.as_str().to_owned()),
        aggregate_evidence_state: slot
            .aggregate
            .as_ref()
            .map(|aggregate| aggregate.evidence_state.as_str().to_owned()),
        aggregate_dependency_state: slot
            .aggregate
            .as_ref()
            .map(|aggregate| aggregate.dependency_state.as_str().to_owned()),
        blocker_code: slot
            .blockers
            .first()
            .map(|blocker| blocker.blocker_code.clone()),
    }
}

fn binding_blocker(
    code: &str,
    message: &str,
    binding: &SlotBinding,
    missing_required_field: Option<&str>,
) -> QueueWorkflowResumeBlocker {
    QueueWorkflowResumeBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        slot: Some(binding.slot.clone()),
        task_id: binding.task_id.clone(),
        run_id: binding.run_id.clone(),
        evidence_bundle_id: binding.evidence_bundle_id.clone(),
        message_id: binding.message_id.clone(),
        completion_decision_id: binding.completion_decision_id.clone(),
        failure_decision_id: binding.failure_decision_id.clone(),
        missing_required_field: missing_required_field.map(str::to_owned),
    }
}

fn blocker(
    code: &str,
    message: &str,
    slot: Option<&str>,
    missing_required_field: Option<&str>,
) -> QueueWorkflowResumeBlocker {
    QueueWorkflowResumeBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        slot: slot.map(str::to_owned),
        task_id: None,
        run_id: None,
        evidence_bundle_id: None,
        message_id: None,
        completion_decision_id: None,
        failure_decision_id: None,
        missing_required_field: missing_required_field.map(str::to_owned),
    }
}

fn is_supported_workflow(value: &str) -> bool {
    matches!(
        value,
        "dependency_acceptance_smoke"
            | "dependency_failure_smoke"
            | "review_acceptance"
            | "terminal_failure"
    )
}

fn is_supported_phase(value: &str) -> bool {
    matches!(
        value,
        "intake" | "setup" | "run_start" | "worker_evidence" | "review" | "decision" | "closed"
    )
}
