use std::collections::BTreeSet;
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_storage_sqlite::{
    AgentQueueCompletionDecisionRow, AgentQueueFailureDecisionRow, AgentQueueReviewMessageRow,
    AgentQueueTaskRow, AgentQueueTaskRunLinkRow, AgentQueueWorkerEvidenceBundleRow,
};
use serde_json::Value;

use crate::WorkspaceServiceError;

use super::{
    agent_queue_aggregate::REVIEW_MESSAGE_STATUS_ACKNOWLEDGED, QueueItemAggregate,
    QueueWorkflowAction, QueueWorkflowRun, WorkspaceService,
};

const QUEUE_WORKFLOW_SCHEMA_VERSION: i64 = 1;
const RESUME_STATUS_RESUME_READY: &str = "resume_ready";
const RESUME_STATUS_RESUME_READ_ONLY_READY: &str = "resume_read_only_ready";
const RESUME_STATUS_BLOCKED_MISSING_TASK: &str = "blocked_missing_task";
const RESUME_STATUS_BLOCKED_STATE_MISMATCH: &str = "blocked_state_mismatch";
const RESUME_STATUS_BLOCKED_MISSING_REVIEW_ACK: &str = "blocked_missing_review_ack";
const RESUME_STATUS_BLOCKED_MISSING_EVIDENCE: &str = "blocked_missing_evidence";
const RESUME_STATUS_BLOCKED_MISSING_CONFIRMATION: &str = "blocked_missing_confirmation";
const RESUME_STATUS_BLOCKED_STALE_GRANT: &str = "blocked_stale_grant";
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
    BlockedStateMismatch,
    BlockedMissingReviewAck,
    BlockedMissingEvidence,
    BlockedMissingConfirmation,
    BlockedStaleGrant,
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
            Self::BlockedStateMismatch => RESUME_STATUS_BLOCKED_STATE_MISMATCH,
            Self::BlockedMissingReviewAck => RESUME_STATUS_BLOCKED_MISSING_REVIEW_ACK,
            Self::BlockedMissingEvidence => RESUME_STATUS_BLOCKED_MISSING_EVIDENCE,
            Self::BlockedMissingConfirmation => RESUME_STATUS_BLOCKED_MISSING_CONFIRMATION,
            Self::BlockedStaleGrant => RESUME_STATUS_BLOCKED_STALE_GRANT,
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
    run_id: Option<String>,
    evidence_bundle_id: Option<String>,
    message_id: Option<String>,
    completion_decision_id: Option<String>,
    failure_decision_id: Option<String>,
    executor_widget_id: Option<String>,
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
            "created" | "running" | "paused" | "blocked" => {}
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

        let mut reconciled_slots = Vec::new();
        for binding in slot_bindings {
            reconciled_slots.push(self.reconcile_workflow_slot(&workspace_id, binding)?);
        }

        let mut blockers = reconciled_slots
            .iter()
            .flat_map(|slot| slot.blockers.clone())
            .collect::<Vec<_>>();

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

    fn reconcile_workflow_slot(
        &self,
        workspace_id: &str,
        binding: SlotBinding,
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

fn optional_string_field(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
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
        let next_step = match slot.aggregate.as_ref() {
            Some(aggregate) if has_next_action(aggregate, "promote_draft") => {
                "setup_promote_draft_ready"
            }
            Some(aggregate) if has_next_action(aggregate, "update_run_settings") => {
                "setup_update_run_settings_ready"
            }
            Some(aggregate) if has_next_action(aggregate, "start_run") => "start_worker_ready",
            _ => "setup_or_start_worker_not_ready",
        };
        return DerivedStep {
            status: if next_step == "setup_or_start_worker_not_ready" {
                QueueWorkflowResumePlanStatus::BlockedStateMismatch
            } else {
                QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
            },
            next_phase: Some(if next_step == "start_worker_ready" {
                "run_start".to_owned()
            } else {
                "setup".to_owned()
            }),
            next_step: Some(next_step.to_owned()),
            required_fresh_grant: next_step != "setup_or_start_worker_not_ready",
            required_confirmation: next_step != "setup_or_start_worker_not_ready",
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
        if slot
            .run_link
            .as_ref()
            .is_some_and(|run| run.status == "running")
        {
            return DerivedStep {
                status: QueueWorkflowResumePlanStatus::ResumeReadOnlyReady,
                next_phase: Some("worker_evidence".to_owned()),
                next_step: Some("worker_running_waiting_for_evidence".to_owned()),
                required_fresh_grant: false,
                required_confirmation: false,
                blockers: Vec::new(),
            };
        }

        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::BlockedMissingEvidence,
            next_phase: Some("worker_evidence".to_owned()),
            next_step: Some("worker_evidence_required".to_owned()),
            required_fresh_grant: false,
            required_confirmation: false,
            blockers: vec![binding_blocker(
                "evidence_missing",
                "Durable worker evidence is required before review or finalization can resume.",
                &slot.binding,
                Some("evidenceBundleId"),
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
                required_confirmation: true,
                blockers: Vec::new(),
            };
        }
        Some(message) if message.status != REVIEW_MESSAGE_STATUS_ACKNOWLEDGED => {
            return DerivedStep {
                status: QueueWorkflowResumePlanStatus::BlockedMissingReviewAck,
                next_phase: Some("review".to_owned()),
                next_step: Some("review_ack_ready".to_owned()),
                required_fresh_grant: true,
                required_confirmation: true,
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
            "task_missing" | "missing_task"
        )
    }) {
        return QueueWorkflowResumePlanStatus::BlockedMissingTask;
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
