use hobit_storage_sqlite::{
    AgentQueueTaskRunLinkRow, AgentQueueWorkerEvidenceBundleRow, AgentQueueWorkflowActionRow,
    AgentQueueWorkflowActionUpdate, AgentQueueWorkflowRunReportUpdate, AgentQueueWorkflowRunRow,
    NewAgentQueueWorkflowAction, SqliteStore, StorageError,
};
use serde_json::{json, Map, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_tasks::map_storage_agent_queue_task_error,
    agent_queue_worker_evidence::{
        normalize_record_agent_queue_worker_finished_input,
        record_agent_queue_worker_finished_in_store, worker_evidence_bundle_summary,
        worker_evidence_changed_files_json, AgentQueueWorkerEvidenceBundleSummary,
        NormalizedRecordAgentQueueWorkerFinishedInput, RecordAgentQueueWorkerFinishedInput,
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED, AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED,
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_NOT_COMPLETED,
    },
    agent_queue_workflow::{
        canonical_json_string, QueueWorkflowAction, QueueWorkflowActionStatus,
        QueueWorkflowCommandBlocker, QueueWorkflowConflict, QueueWorkflowRun,
        QueueWorkflowRunStatus, MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES, MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES, MAX_WORKFLOW_VARIABLES_JSON_BYTES,
    },
    placeholder_id, placeholder_timestamp, AgentQueueTaskRunStatus, QueueItemAggregate,
    WorkspaceService,
};

const RECORD_WORKER_EVIDENCE_ACTION_TYPE: &str = "record_worker_evidence";
const RECORD_WORKER_EVIDENCE_STEP_ID: &str = "record_worker_evidence";
const WORKFLOW_PHASE_WORKER_EVIDENCE: &str = "worker_evidence";
const WORKFLOW_STEP_AWAITING_REVIEW: &str = "awaiting_review";
const PAUSE_REASON_AWAITING_REVIEW: &str = "awaiting_review";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowRecordWorkerEvidenceRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub slot: String,
    pub task_id: String,
    pub run_id: String,
    pub outcome: String,
    pub summary: Option<String>,
    pub changed_files: Vec<String>,
    pub changed_files_summary: Option<String>,
    pub validation_summary: Option<String>,
    pub error_summary: Option<String>,
    pub worker_id: Option<String>,
    pub source: Option<String>,
    pub metadata_json: Option<String>,
    pub finished_at: Option<String>,
    pub actor_id: Option<String>,
    pub action_idempotency_key: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowRecordWorkerEvidenceStatus {
    Recorded,
    AlreadyRecorded,
    Blocked,
    Conflict,
    NotFound,
    InvalidInput,
}

impl QueueWorkflowRecordWorkerEvidenceStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Recorded => "recorded",
            Self::AlreadyRecorded => "already_recorded",
            Self::Blocked => "blocked",
            Self::Conflict => "conflict",
            Self::NotFound => "not_found",
            Self::InvalidInput => "invalid_input",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowWorkerEvidenceBindingSummary {
    pub slot: String,
    pub task_id: String,
    pub run_id: String,
    pub evidence_bundle_id: String,
    pub evidence_action_id: Option<String>,
    pub evidence_action_idempotency_key: String,
    pub evidence_recorded_at: String,
    pub worker_final_status: String,
    pub worker_outcome: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowRecordWorkerEvidenceResult {
    pub status: QueueWorkflowRecordWorkerEvidenceStatus,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub action: Option<QueueWorkflowAction>,
    pub evidence_bundle: Option<AgentQueueWorkerEvidenceBundleSummary>,
    pub aggregate: Option<QueueItemAggregate>,
    pub binding: Option<QueueWorkflowWorkerEvidenceBindingSummary>,
    pub blocker: Option<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowWorkerEvidenceStepTransition {
    RecordWorkerEvidence,
}

impl QueueWorkflowWorkerEvidenceStepTransition {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RecordWorkerEvidence => RECORD_WORKER_EVIDENCE_ACTION_TYPE,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowWorkerEvidenceStepResultStatus {
    Executed,
    AlreadyApplied,
    BlockedPrecondition,
    InvalidInput,
    Conflict,
    NotFound,
    FailedUnexpected,
}

impl QueueWorkflowWorkerEvidenceStepResultStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Executed => "executed",
            Self::AlreadyApplied => "already_applied",
            Self::BlockedPrecondition => "blocked_precondition",
            Self::InvalidInput => "invalid_input",
            Self::Conflict => "conflict",
            Self::NotFound => "not_found",
            Self::FailedUnexpected => "failed_unexpected",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowWorkerEvidenceStepPlan {
    pub workflow_run_id: String,
    pub workflow_id: Option<String>,
    pub persistent_status: Option<String>,
    pub phase: Option<String>,
    pub current_step: Option<String>,
    pub transition: QueueWorkflowWorkerEvidenceStepTransition,
    pub executable: bool,
    pub idempotency_key: Option<String>,
    pub target_refs: Option<Value>,
    pub current_refs: Option<Value>,
    pub missing_refs: Vec<String>,
    pub required_input: Vec<String>,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub safe_to_record_worker_evidence: bool,
    pub reason_if_not_safe: Option<String>,
    pub stale_history: bool,
    pub expected_next_phase_on_success: Option<String>,
    pub expected_next_step_on_success: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowWorkerEvidenceStepResult {
    pub workflow_run_id: String,
    pub transition: QueueWorkflowWorkerEvidenceStepTransition,
    pub status: QueueWorkflowWorkerEvidenceStepResultStatus,
    pub action: Option<QueueWorkflowAction>,
    pub evidence_bundle: Option<AgentQueueWorkerEvidenceBundleSummary>,
    pub aggregate: Option<QueueItemAggregate>,
    pub binding: Option<QueueWorkflowWorkerEvidenceBindingSummary>,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Debug)]
struct NormalizedWorkflowEvidenceRequest {
    workspace_id: String,
    workflow_run_id: String,
    slot: String,
    action_idempotency_key: String,
    worker: NormalizedRecordAgentQueueWorkerFinishedInput,
}

#[derive(Clone, Debug)]
enum ExistingActionDecision {
    None,
    Completed(AgentQueueWorkflowActionRow),
    Retryable {
        action: AgentQueueWorkflowActionRow,
        repair_target_refs: bool,
    },
}

#[derive(Clone, Debug)]
struct WorkerEvidenceStepResolution {
    request: NormalizedWorkflowEvidenceRequest,
    workflow_run: AgentQueueWorkflowRunRow,
    slot_bindings: Map<String, Value>,
    run_link: AgentQueueTaskRunLinkRow,
    existing_evidence: Option<AgentQueueWorkerEvidenceBundleRow>,
    existing_action: ExistingActionDecision,
    target_refs_json: String,
    changed_files_json: String,
    finished_at: String,
    bundle_id: String,
    stale_history: bool,
}

#[derive(Clone, Debug)]
enum WorkerEvidenceStepResolveStatus {
    Ready(WorkerEvidenceStepResolution),
    Blocked {
        request: Option<NormalizedWorkflowEvidenceRequest>,
        workflow_run: Option<AgentQueueWorkflowRunRow>,
        action: Option<AgentQueueWorkflowActionRow>,
        target_refs_json: Option<String>,
        blocker: QueueWorkflowCommandBlocker,
        stale_history: bool,
    },
    Conflict {
        workflow_run: Option<AgentQueueWorkflowRunRow>,
        action: Option<AgentQueueWorkflowActionRow>,
        evidence: Option<AgentQueueWorkerEvidenceBundleRow>,
        conflict: QueueWorkflowConflict,
        blocker: Option<QueueWorkflowCommandBlocker>,
    },
    NotFound {
        request: NormalizedWorkflowEvidenceRequest,
        blocker: QueueWorkflowCommandBlocker,
    },
    InvalidInput {
        workflow_run_id: String,
        blocker: QueueWorkflowCommandBlocker,
    },
}

impl WorkspaceService {
    pub fn plan_queue_workflow_worker_evidence_step(
        &self,
        request: QueueWorkflowRecordWorkerEvidenceRequest,
    ) -> Result<QueueWorkflowWorkerEvidenceStepPlan, WorkspaceServiceError> {
        let workflow_run_id = request.workflow_run_id.trim().to_owned();
        let resolution = self
            .store
            .with_immediate_transaction(|store| {
                resolve_queue_workflow_worker_evidence_step(store, request)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(plan_from_worker_evidence_resolution(
            &workflow_run_id,
            resolution,
        ))
    }

    pub fn execute_queue_workflow_worker_evidence_step(
        &self,
        request: QueueWorkflowRecordWorkerEvidenceRequest,
    ) -> Result<QueueWorkflowWorkerEvidenceStepResult, WorkspaceServiceError> {
        let tx_result = self
            .store
            .with_immediate_transaction(|store| {
                let resolution = resolve_queue_workflow_worker_evidence_step(store, request)?;
                execute_worker_evidence_step_resolution(store, resolution)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        match tx_result {
            QueueWorkflowWorkerEvidenceStepResult {
                aggregate: Some(_), ..
            } => Ok(tx_result),
            mut result => {
                if let Some(task_id) = result
                    .binding
                    .as_ref()
                    .map(|binding| binding.task_id.clone())
                {
                    result.aggregate = self.get_queue_item_aggregate(
                        result
                            .workflow_run
                            .as_ref()
                            .map(|run| run.workspace_id.as_str())
                            .unwrap_or(""),
                        &task_id,
                    )?;
                }
                Ok(result)
            }
        }
    }

    pub fn record_queue_workflow_worker_evidence(
        &self,
        request: QueueWorkflowRecordWorkerEvidenceRequest,
    ) -> Result<QueueWorkflowRecordWorkerEvidenceResult, WorkspaceServiceError> {
        let request = match normalize_workflow_evidence_request(request) {
            Ok(request) => request,
            Err(blocker) => {
                return Ok(result(
                    QueueWorkflowRecordWorkerEvidenceStatus::InvalidInput,
                    None,
                    None,
                    None,
                    None,
                    None,
                    Some(blocker),
                    None,
                ));
            }
        };

        let finished_at = request
            .worker
            .finished_at
            .clone()
            .unwrap_or_else(placeholder_timestamp);
        let bundle_id = placeholder_id("queue_worker_evidence_");
        let changed_files_json = worker_evidence_changed_files_json(&request.worker.changed_files)?;

        let tx_result = self
            .store
            .with_immediate_transaction(|store| {
                let Some(workflow_run) = store.get_agent_queue_workflow_run(
                    &request.workspace_id,
                    &request.workflow_run_id,
                )?
                else {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::NotFound,
                        None,
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_not_found",
                            "Queue workflow run was not found.",
                            Some("workflowRunId"),
                        )),
                        None,
                    )));
                };

                if !matches!(
                    workflow_run.workflow_id.as_str(),
                    "dependency_acceptance_smoke" | "dependency_failure_smoke"
                ) {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "unsupported_workflow",
                            "Worker evidence recording is currently supported only for dependency Queue workflows.",
                            Some("workflowId"),
                        )),
                        None,
                    )));
                }

                if matches!(workflow_run.status.as_str(), "completed" | "cancelled") {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "workflow_run_terminal",
                            "Terminal Queue workflow runs cannot record worker evidence.",
                            Some("status"),
                        )),
                        None,
                    )));
                }
                let terminal_reentry_required =
                    matches!(workflow_run.status.as_str(), "failed" | "blocked");
                let workflow_actions = if terminal_reentry_required {
                    Some(store.list_agent_queue_workflow_actions(
                        &request.workspace_id,
                        &request.workflow_run_id,
                    )?)
                } else {
                    None
                };

                let mut slot_bindings =
                    match parse_slot_bindings(workflow_run.slot_bindings_json.as_deref()) {
                        Ok(slot_bindings) => slot_bindings,
                        Err(blocker) => {
                            return Ok(TxResult::Return(result(
                                QueueWorkflowRecordWorkerEvidenceStatus::InvalidInput,
                                Some(QueueWorkflowRun::from(workflow_run)),
                                None,
                                None,
                                None,
                                None,
                                Some(blocker),
                                None,
                            )));
                        }
                    };

                let Some(existing_binding) = slot_bindings.get(&request.slot).cloned() else {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "missing_slot_binding",
                            "Queue workflow slot binding is missing for worker evidence recording.",
                            Some("slot"),
                        )),
                        None,
                    )));
                };

                let Some(bound_task_id) = string_field(&existing_binding, "taskId") else {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "missing_task_binding",
                            "Queue workflow slot binding is missing taskId.",
                            Some("slotBindings.taskId"),
                        )),
                        None,
                    )));
                };
                if bound_task_id != request.worker.queue_item_id {
                    return Ok(TxResult::Return(conflict_result(
                        workflow_run,
                        "slot_task_mismatch",
                        "Queue workflow evidence taskId does not match the persisted slot binding.",
                        Some(bound_task_id.to_owned()),
                        Some(request.worker.queue_item_id.clone()),
                    )));
                }

                if terminal_reentry_required {
                    if let Some(blocker) = retryable_worker_evidence_reentry_blocker(
                        store,
                        &workflow_run,
                        &request,
                        &slot_bindings,
                        &existing_binding,
                        workflow_actions.as_deref().unwrap_or(&[]),
                    )? {
                        return Ok(TxResult::Return(result(
                            QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                            Some(QueueWorkflowRun::from(workflow_run)),
                            None,
                            None,
                            None,
                            None,
                            Some(blocker),
                            None,
                        )));
                    }
                }

                let bound_run_id = string_field(&existing_binding, "runId").map(str::to_owned);
                let start_worker_run = match recover_start_worker_run_id_for_evidence(
                    store,
                    &request,
                    &slot_bindings,
                    &existing_binding,
                    bound_run_id.is_none(),
                )? {
                    StartWorkerRunRecovery::Recovered(run_id) => Some(run_id),
                    StartWorkerRunRecovery::NotAvailable => None,
                    StartWorkerRunRecovery::Blocked(blocker) => {
                        return Ok(TxResult::Return(result(
                            QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                            Some(QueueWorkflowRun::from(workflow_run)),
                            None,
                            None,
                            None,
                            None,
                            Some(blocker),
                            None,
                        )));
                    }
                    StartWorkerRunRecovery::Conflict {
                        code,
                        message,
                        existing,
                        requested,
                    } => {
                        return Ok(TxResult::Return(conflict_result(
                            workflow_run,
                            code,
                            message,
                            existing,
                            requested,
                        )));
                    }
                };

                if let Some(bound_run_id) = bound_run_id.as_deref() {
                    if bound_run_id != request.worker.run_id {
                        return Ok(TxResult::Return(conflict_result(
                            workflow_run,
                            "slot_run_mismatch",
                            "Queue workflow evidence runId does not match the persisted slot binding.",
                            Some(bound_run_id.to_owned()),
                            Some(request.worker.run_id.clone()),
                        )));
                    }
                }

                if let Some(recovered_run_id) = start_worker_run.as_deref() {
                    if recovered_run_id != request.worker.run_id {
                        return Ok(TxResult::Return(conflict_result(
                            workflow_run,
                            "run_id_mismatch",
                            "Queue workflow evidence runId does not match the recovered start_worker runId.",
                            Some(recovered_run_id.to_owned()),
                            Some(request.worker.run_id.clone()),
                        )));
                    }
                    if let Some(bound_run_id) = bound_run_id.as_deref() {
                        if bound_run_id != recovered_run_id {
                            return Ok(TxResult::Return(conflict_result(
                                workflow_run,
                                "run_id_mismatch",
                                "Queue workflow slot binding runId does not match the recovered start_worker runId.",
                                Some(recovered_run_id.to_owned()),
                                Some(bound_run_id.to_owned()),
                            )));
                        }
                    }
                } else if bound_run_id.is_none() {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "missing_run_binding",
                            "Queue workflow slot binding is missing runId and no verified start_worker runId was recoverable.",
                            Some("slotBindings.runId"),
                        )),
                        None,
                    )));
                }

                let Some(run_link) = store.get_agent_queue_task_run_link_by_run_id(
                    &request.workspace_id,
                    &request.worker.run_id,
                )?
                else {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "run_missing",
                            "Queue workflow evidence runId was not found in the requested workspace.",
                            Some("runId"),
                        )),
                        None,
                    )));
                };

                if run_link.queue_task_id != request.worker.queue_item_id {
                    return Ok(TxResult::Return(conflict_result(
                        workflow_run,
                        "run_task_mismatch",
                        "Queue workflow evidence runId belongs to a different Queue task.",
                        Some(run_link.queue_task_id),
                        Some(request.worker.queue_item_id.clone()),
                    )));
                }
                let bound_executor_widget_id =
                    string_field(&existing_binding, "executorWidgetId").map(str::to_owned);
                if bound_executor_widget_id
                    .as_deref()
                    .is_some_and(|executor| executor != run_link.executor_widget_id.as_str())
                {
                    return Ok(TxResult::Return(conflict_result(
                        workflow_run,
                        "run_executor_mismatch",
                        "Queue workflow evidence runId belongs to a different executorWidgetId.",
                        Some(run_link.executor_widget_id.clone()),
                        bound_executor_widget_id,
                    )));
                }

                if run_link.status == AgentQueueTaskRunStatus::Running.as_str() {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "worker_run_not_complete",
                            "Queue workflow worker run is still running; evidence recording is paused.",
                            Some("runId"),
                        )),
                        None,
                    )));
                }
                if !is_completed_worker_run_state(&run_link) {
                    return Ok(TxResult::Return(result(
                        QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                        Some(QueueWorkflowRun::from(workflow_run)),
                        None,
                        None,
                        None,
                        None,
                        Some(blocker(
                            "worker_run_state_mismatch",
                            "Queue workflow worker run state is not a deterministic completed state.",
                            Some("runId"),
                        )),
                        None,
                    )));
                }

                if let Some(expected_outcome) = expected_worker_outcome_for_run_state(&run_link) {
                    if expected_outcome != request.worker.outcome {
                        return Ok(TxResult::Return(result(
                            QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                            Some(QueueWorkflowRun::from(workflow_run)),
                            None,
                            None,
                            None,
                            None,
                            Some(blocker(
                                "worker_outcome_mismatch",
                                "Queue workflow worker evidence outcome does not match the durable worker run status.",
                                Some("workerEvidence.outcome"),
                            )),
                            None,
                        )));
                    }
                }

                let target_refs_json = target_refs_json(&request, &existing_binding);
                let existing_action = match store.get_agent_queue_workflow_action_by_idempotency_key(
                    &request.workflow_run_id,
                    &request.action_idempotency_key,
                )? {
                    Some(action) => {
                        let target_refs_match =
                            action_matches_target(&action, &request, &existing_binding);
                        let target_refs_compatible = action_target_refs_compatible_for_repair(
                            &action,
                            &request,
                            &existing_binding,
                        );
                        let target_refs_complete =
                            action.target_refs_json.as_deref() == Some(target_refs_json.as_str());
                        let retryable_action = is_retryable_record_worker_evidence_action(&action);
                        if !target_refs_match && (!retryable_action || !target_refs_compatible) {
                            return Ok(TxResult::Return(result(
                                QueueWorkflowRecordWorkerEvidenceStatus::Conflict,
                                Some(QueueWorkflowRun::from(workflow_run)),
                                Some(QueueWorkflowAction::from(action.clone())),
                                None,
                                None,
                                None,
                                None,
                                Some(QueueWorkflowConflict {
                                    conflict_code:
                                        "record_worker_evidence_action_ref_conflict".to_owned(),
                                    conflict_message:
                                        "A Queue workflow record_worker_evidence action already exists for this idempotency key with different typed refs."
                                            .to_owned(),
                                    existing_workflow_run_id: Some(action.workflow_run_id),
                                    existing_request_hash: action.target_refs_json,
                                    requested_request_hash: Some(target_refs_json),
                                }),
                            )));
                        }
                        if action.status != QueueWorkflowActionStatus::Completed.as_str()
                            && !retryable_action
                        {
                            return Ok(TxResult::Return(result(
                                QueueWorkflowRecordWorkerEvidenceStatus::Blocked,
                                Some(QueueWorkflowRun::from(workflow_run)),
                                Some(QueueWorkflowAction::from(action)),
                                None,
                                None,
                                None,
                                Some(blocker(
                                    "record_worker_evidence_action_not_completed",
                                    "Existing Queue workflow record_worker_evidence action is not completed and will not be retried blindly.",
                                    Some("actionIdempotencyKey"),
                                )),
                                None,
                            )));
                        }
                        if action.status == QueueWorkflowActionStatus::Completed.as_str() {
                            ExistingActionDecision::Completed(action)
                        } else {
                            ExistingActionDecision::Retryable {
                                action,
                                repair_target_refs: !target_refs_complete,
                            }
                        }
                    }
                    None => ExistingActionDecision::None,
                };

                let existing_evidence = store.get_agent_queue_worker_evidence_bundle(
                    &request.workspace_id,
                    &request.worker.queue_item_id,
                    &request.worker.run_id,
                )?;
                let had_existing_evidence = existing_evidence.is_some();
                if let Some(existing_evidence) = existing_evidence.as_ref() {
                    if !evidence_matches_request(existing_evidence, &request.worker, &changed_files_json)
                    {
                        return Ok(TxResult::Return(result(
                            QueueWorkflowRecordWorkerEvidenceStatus::Conflict,
                            Some(QueueWorkflowRun::from(workflow_run)),
                            None,
                            Some(worker_evidence_bundle_summary_for_tx(
                                existing_evidence.clone(),
                            )?),
                            None,
                            None,
                            Some(blocker(
                                "evidence_conflict",
                                "Durable worker evidence already exists for this task/run with different bounded metadata.",
                                Some("workerEvidence"),
                            )),
                            Some(QueueWorkflowConflict {
                                conflict_code: "evidence_metadata_conflict".to_owned(),
                                conflict_message:
                                    "Durable worker evidence already exists for this task/run with different bounded metadata."
                                        .to_owned(),
                                existing_workflow_run_id: Some(request.workflow_run_id.clone()),
                                existing_request_hash: Some(evidence_identity_json(existing_evidence)),
                                requested_request_hash: Some(request_evidence_identity_json(
                                    &request.worker,
                                    &changed_files_json,
                                )),
                            }),
                        )));
                    }
                }

                let evidence = match existing_evidence {
                    Some(evidence) => evidence,
                    None => record_agent_queue_worker_finished_in_store(
                        store,
                        &request.worker,
                        &finished_at,
                        &bundle_id,
                        &changed_files_json,
                    )?,
                };
                let result_refs_json = result_refs_json(&evidence, &run_link.status);
                let action = match existing_action {
                    ExistingActionDecision::Completed(action) => {
                        if action.result_refs_json.as_deref() != Some(result_refs_json.as_str()) {
                            return Ok(TxResult::Return(result(
                                QueueWorkflowRecordWorkerEvidenceStatus::Conflict,
                                Some(QueueWorkflowRun::from(workflow_run)),
                                Some(QueueWorkflowAction::from(action.clone())),
                                Some(worker_evidence_bundle_summary_for_tx(evidence.clone())?),
                                None,
                                None,
                                None,
                                Some(QueueWorkflowConflict {
                                    conflict_code:
                                        "record_worker_evidence_action_result_conflict".to_owned(),
                                    conflict_message:
                                        "Existing Queue workflow record_worker_evidence action result refs do not match durable evidence."
                                            .to_owned(),
                                    existing_workflow_run_id: Some(action.workflow_run_id),
                                    existing_request_hash: action.result_refs_json,
                                    requested_request_hash: Some(result_refs_json),
                                }),
                            )));
                        }
                        action
                    }
                    ExistingActionDecision::None => {
                        let action_id = placeholder_id("queue-workflow-action-");
                        store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                            action_id: &action_id,
                            workflow_run_id: &request.workflow_run_id,
                            workspace_id: &request.workspace_id,
                            step_id: RECORD_WORKER_EVIDENCE_STEP_ID,
                            action_type: RECORD_WORKER_EVIDENCE_ACTION_TYPE,
                            idempotency_key: &request.action_idempotency_key,
                            status: QueueWorkflowActionStatus::Completed.as_str(),
                            target_refs_json: Some(&target_refs_json),
                            result_refs_json: Some(&result_refs_json),
                            blocker_code: None,
                            blocker_message: None,
                            attempt_count: 1,
                            started_at: Some(&finished_at),
                            completed_at: Some(&finished_at),
                            created_at: Some(&finished_at),
                            updated_at: Some(&finished_at),
                        })?
                    }
                    ExistingActionDecision::Retryable {
                        action,
                        repair_target_refs,
                    } => {
                        let update = AgentQueueWorkflowActionUpdate {
                            status: QueueWorkflowActionStatus::Completed.as_str(),
                            result_refs_json: Some(&result_refs_json),
                            blocker_code: None,
                            blocker_message: None,
                            attempt_count: Some(action.attempt_count.saturating_add(1)),
                            started_at: action.started_at.as_deref().or(Some(&finished_at)),
                            completed_at: Some(&finished_at),
                            updated_at: Some(&finished_at),
                        };
                        if repair_target_refs {
                            store.replace_agent_queue_workflow_action_refs_and_resolution(
                                &request.workspace_id,
                                &request.workflow_run_id,
                                &request.action_idempotency_key,
                                Some(&target_refs_json),
                                update,
                            )?
                        } else {
                            store.replace_agent_queue_workflow_action_resolution(
                                &request.workspace_id,
                                &request.workflow_run_id,
                                &request.action_idempotency_key,
                                update,
                            )?
                        }
                        .ok_or(StorageError::QueryReturnedNoRows)?
                    }
                };

                update_binding_with_evidence(
                    &mut slot_bindings,
                    &request,
                    &evidence,
                    &action,
                    &finished_at,
                    &run_link.status,
                );
                let slot_bindings_json = bounded_json(
                    canonical_json_string(&Value::Object(slot_bindings)),
                    MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
                    "slotBindings",
                )?;
                let mutation_refs_json = bounded_json(
                    mutation_refs_json(workflow_run.mutation_refs_json.as_deref(), &request, &evidence),
                    MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
                    "mutationRefs",
                )?;
                let idempotency_keys_json = bounded_json(
                    idempotency_keys_json(
                        workflow_run.idempotency_keys_json.as_deref(),
                        &request.action_idempotency_key,
                    ),
                    MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES,
                    "idempotencyKeys",
                )?;
                let action_log_summary_json = bounded_json(
                    action_log_summary_json(
                        workflow_run.action_log_summary_json.as_deref(),
                        &request,
                        &evidence,
                        &run_link.status,
                    ),
                    MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
                    "actionLogSummary",
                )?;
                let variables_json = bounded_json(
                    variables_json(workflow_run.variables_json.as_deref(), &request, &evidence),
                    MAX_WORKFLOW_VARIABLES_JSON_BYTES,
                    "variables",
                )?;

                let updated_run = store
                    .update_agent_queue_workflow_run_report_reopened(
                        &request.workspace_id,
                        &request.workflow_run_id,
                        AgentQueueWorkflowRunReportUpdate {
                            status: QueueWorkflowRunStatus::Paused.as_str(),
                            phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE),
                            current_step: Some(WORKFLOW_STEP_AWAITING_REVIEW),
                            pause_reason: Some(PAUSE_REASON_AWAITING_REVIEW),
                            blocker_reason: None,
                            variables_json: Some(&variables_json),
                            slot_bindings_json: Some(&slot_bindings_json),
                            mutation_refs_json: Some(&mutation_refs_json),
                            idempotency_keys_json: Some(&idempotency_keys_json),
                            action_log_summary_json: Some(&action_log_summary_json),
                            updated_at: Some(&finished_at),
                            completed_at: None,
                        },
                    )?
                    .ok_or(StorageError::QueryReturnedNoRows)?;
                store.touch_workspace(&request.workspace_id)?;

                let evidence_summary = worker_evidence_bundle_summary_for_tx(evidence.clone())?;
                let binding = QueueWorkflowWorkerEvidenceBindingSummary {
                    slot: request.slot.clone(),
                    task_id: evidence.queue_task_id.clone(),
                    run_id: evidence.run_id.clone(),
                    evidence_bundle_id: evidence.bundle_id.clone(),
                    evidence_action_id: Some(action.action_id.clone()),
                    evidence_action_idempotency_key: request.action_idempotency_key.clone(),
                    evidence_recorded_at: evidence.updated_at.clone(),
                    worker_final_status: run_link.status.clone(),
                    worker_outcome: evidence.outcome.clone(),
                };
                let status = if had_existing_evidence {
                    QueueWorkflowRecordWorkerEvidenceStatus::AlreadyRecorded
                } else {
                    QueueWorkflowRecordWorkerEvidenceStatus::Recorded
                };

                Ok(TxResult::Recorded {
                    action,
                    binding,
                    evidence: evidence_summary,
                    status,
                    workflow_run: updated_run,
                })
            })
            .map_err(map_storage_agent_queue_task_error)?;

        match tx_result {
            TxResult::Return(result) => Ok(result),
            TxResult::Recorded {
                action,
                binding,
                evidence,
                status,
                workflow_run,
            } => {
                let aggregate = self.get_queue_item_aggregate(
                    &request.workspace_id,
                    &request.worker.queue_item_id,
                )?;
                Ok(result(
                    status,
                    Some(QueueWorkflowRun::from(workflow_run)),
                    Some(QueueWorkflowAction::from(action)),
                    Some(evidence),
                    aggregate,
                    Some(binding),
                    None,
                    None,
                ))
            }
        }
    }
}

enum TxResult {
    Return(QueueWorkflowRecordWorkerEvidenceResult),
    Recorded {
        status: QueueWorkflowRecordWorkerEvidenceStatus,
        workflow_run: hobit_storage_sqlite::AgentQueueWorkflowRunRow,
        action: AgentQueueWorkflowActionRow,
        evidence: AgentQueueWorkerEvidenceBundleSummary,
        binding: QueueWorkflowWorkerEvidenceBindingSummary,
    },
}

fn resolve_queue_workflow_worker_evidence_step(
    store: &SqliteStore,
    request: QueueWorkflowRecordWorkerEvidenceRequest,
) -> Result<WorkerEvidenceStepResolveStatus, StorageError> {
    let request = match normalize_workflow_evidence_request(request) {
        Ok(request) => request,
        Err(blocker) => {
            let workflow_run_id = blocker
                .missing_required_field
                .as_deref()
                .map(|_| String::new())
                .unwrap_or_default();
            return Ok(WorkerEvidenceStepResolveStatus::InvalidInput {
                workflow_run_id,
                blocker,
            });
        }
    };

    let finished_at = request
        .worker
        .finished_at
        .clone()
        .unwrap_or_else(placeholder_timestamp);
    let bundle_id = placeholder_id("queue_worker_evidence_");
    let changed_files_json = worker_evidence_changed_files_json(&request.worker.changed_files)
        .map_err(|error| StorageError::InvalidParameterName(error.to_string()))?;

    let Some(workflow_run) =
        store.get_agent_queue_workflow_run(&request.workspace_id, &request.workflow_run_id)?
    else {
        return Ok(WorkerEvidenceStepResolveStatus::NotFound {
            request,
            blocker: blocker(
                "workflow_run_not_found",
                "Queue workflow run was not found.",
                Some("workflowRunId"),
            ),
        });
    };

    if !matches!(
        workflow_run.workflow_id.as_str(),
        "dependency_acceptance_smoke" | "dependency_failure_smoke"
    ) {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            None,
            blocker(
                "unsupported_workflow",
                "Worker evidence recording is currently supported only for dependency Queue workflows.",
                Some("workflowId"),
            ),
            false,
        ));
    }

    if matches!(workflow_run.status.as_str(), "completed" | "cancelled") {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            None,
            blocker(
                "workflow_run_terminal",
                "Terminal Queue workflow runs cannot record worker evidence.",
                Some("status"),
            ),
            false,
        ));
    }
    let terminal_reentry_required = matches!(workflow_run.status.as_str(), "failed" | "blocked");
    let workflow_actions = if terminal_reentry_required {
        store.list_agent_queue_workflow_actions(&request.workspace_id, &request.workflow_run_id)?
    } else {
        Vec::new()
    };
    let stale_history = workflow_actions
        .iter()
        .any(|action| is_worker_evidence_runner_failed_action(action))
        || workflow_actions
            .iter()
            .any(is_retryable_record_worker_evidence_action);

    let slot_bindings = match parse_slot_bindings(workflow_run.slot_bindings_json.as_deref()) {
        Ok(slot_bindings) => slot_bindings,
        Err(blocker) => {
            return Ok(blocked_worker_evidence_resolution(
                Some(request),
                Some(workflow_run),
                None,
                None,
                blocker,
                stale_history,
            ));
        }
    };

    let Some(existing_binding) = slot_bindings.get(&request.slot).cloned() else {
        let target_refs_json = target_refs_json_without_binding(&request);
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "missing_slot_binding",
                "Queue workflow slot binding is missing for worker evidence recording.",
                Some("slot"),
            ),
            stale_history,
        ));
    };

    let target_refs_json = target_refs_json(&request, &existing_binding);

    let Some(bound_task_id) = string_field(&existing_binding, "taskId") else {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "missing_task_binding",
                "Queue workflow slot binding is missing taskId.",
                Some("slotBindings.taskId"),
            ),
            stale_history,
        ));
    };
    if bound_task_id != request.worker.queue_item_id {
        return Ok(conflict_worker_evidence_resolution(
            Some(workflow_run),
            None,
            None,
            "slot_task_mismatch",
            "Queue workflow evidence taskId does not match the persisted slot binding.",
            Some(bound_task_id.to_owned()),
            Some(request.worker.queue_item_id.clone()),
        ));
    }

    if terminal_reentry_required {
        if let Some(blocker) = retryable_worker_evidence_reentry_blocker(
            store,
            &workflow_run,
            &request,
            &slot_bindings,
            &existing_binding,
            &workflow_actions,
        )? {
            return Ok(blocked_worker_evidence_resolution(
                Some(request),
                Some(workflow_run),
                None,
                Some(target_refs_json),
                blocker,
                stale_history,
            ));
        }
    }

    let bound_run_id = string_field(&existing_binding, "runId").map(str::to_owned);
    let start_worker_run = match recover_start_worker_run_id_for_evidence(
        store,
        &request,
        &slot_bindings,
        &existing_binding,
        bound_run_id.is_none(),
    )? {
        StartWorkerRunRecovery::Recovered(run_id) => Some(run_id),
        StartWorkerRunRecovery::NotAvailable => None,
        StartWorkerRunRecovery::Blocked(blocker) => {
            return Ok(blocked_worker_evidence_resolution(
                Some(request),
                Some(workflow_run),
                None,
                Some(target_refs_json),
                blocker,
                stale_history,
            ));
        }
        StartWorkerRunRecovery::Conflict {
            code,
            message,
            existing,
            requested,
        } => {
            return Ok(conflict_worker_evidence_resolution(
                Some(workflow_run),
                None,
                None,
                code,
                message,
                existing,
                requested,
            ));
        }
    };

    if let Some(bound_run_id) = bound_run_id.as_deref() {
        if bound_run_id != request.worker.run_id {
            return Ok(conflict_worker_evidence_resolution(
                Some(workflow_run),
                None,
                None,
                "slot_run_mismatch",
                "Queue workflow evidence runId does not match the persisted slot binding.",
                Some(bound_run_id.to_owned()),
                Some(request.worker.run_id.clone()),
            ));
        }
    }

    if let Some(recovered_run_id) = start_worker_run.as_deref() {
        if recovered_run_id != request.worker.run_id {
            return Ok(conflict_worker_evidence_resolution(
                Some(workflow_run),
                None,
                None,
                "run_id_mismatch",
                "Queue workflow evidence runId does not match the recovered start_worker runId.",
                Some(recovered_run_id.to_owned()),
                Some(request.worker.run_id.clone()),
            ));
        }
    } else if bound_run_id.is_none() {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "missing_run_binding",
                "Queue workflow slot binding is missing runId and no verified start_worker runId was recoverable.",
                Some("slotBindings.runId"),
            ),
            stale_history,
        ));
    }

    let Some(run_link) = store
        .get_agent_queue_task_run_link_by_run_id(&request.workspace_id, &request.worker.run_id)?
    else {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "run_missing",
                "Queue workflow evidence runId was not found in the requested workspace.",
                Some("runId"),
            ),
            stale_history,
        ));
    };

    if run_link.queue_task_id != request.worker.queue_item_id {
        return Ok(conflict_worker_evidence_resolution(
            Some(workflow_run),
            None,
            None,
            "run_task_mismatch",
            "Queue workflow evidence runId belongs to a different Queue task.",
            Some(run_link.queue_task_id),
            Some(request.worker.queue_item_id.clone()),
        ));
    }
    let bound_executor_widget_id = string_field(&existing_binding, "executorWidgetId");
    if bound_executor_widget_id
        .is_some_and(|executor| executor != run_link.executor_widget_id.as_str())
    {
        return Ok(conflict_worker_evidence_resolution(
            Some(workflow_run),
            None,
            None,
            "run_executor_mismatch",
            "Queue workflow evidence runId belongs to a different executorWidgetId.",
            Some(run_link.executor_widget_id.clone()),
            bound_executor_widget_id.map(str::to_owned),
        ));
    }

    if run_link.status == AgentQueueTaskRunStatus::Running.as_str() {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "worker_run_not_complete",
                "Queue workflow worker run is still running; evidence recording is paused.",
                Some("runId"),
            ),
            stale_history,
        ));
    }
    if !is_completed_worker_run_state(&run_link) {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "worker_run_state_mismatch",
                "Queue workflow worker run state is not a deterministic completed state.",
                Some("runId"),
            ),
            stale_history,
        ));
    }
    if let Some(expected_outcome) = expected_worker_outcome_for_run_state(&run_link) {
        if expected_outcome != request.worker.outcome {
            return Ok(blocked_worker_evidence_resolution(
                Some(request),
                Some(workflow_run),
                None,
                Some(target_refs_json),
                blocker(
                    "worker_outcome_mismatch",
                    "Queue workflow worker evidence outcome does not match the durable worker run status.",
                    Some("workerEvidence.outcome"),
                ),
                stale_history,
            ));
        }
    }

    let existing_action = match store.get_agent_queue_workflow_action_by_idempotency_key(
        &request.workflow_run_id,
        &request.action_idempotency_key,
    )? {
        Some(action) => {
            let target_refs_match = action_matches_target(&action, &request, &existing_binding);
            let target_refs_compatible =
                action_target_refs_compatible_for_repair(&action, &request, &existing_binding);
            let target_refs_complete =
                action.target_refs_json.as_deref() == Some(target_refs_json.as_str());
            let retryable_action = is_retryable_record_worker_evidence_action(&action);
            if !target_refs_match && (!retryable_action || !target_refs_compatible) {
                return Ok(WorkerEvidenceStepResolveStatus::Conflict {
                    workflow_run: Some(workflow_run),
                    action: Some(action.clone()),
                    evidence: None,
                    blocker: None,
                    conflict: QueueWorkflowConflict {
                        conflict_code: "record_worker_evidence_action_ref_conflict".to_owned(),
                        conflict_message:
                            "A Queue workflow record_worker_evidence action already exists for this idempotency key with different typed refs."
                                .to_owned(),
                        existing_workflow_run_id: Some(action.workflow_run_id),
                        existing_request_hash: action.target_refs_json,
                        requested_request_hash: Some(target_refs_json),
                    },
                });
            }
            if action.status != QueueWorkflowActionStatus::Completed.as_str() && !retryable_action {
                return Ok(blocked_worker_evidence_resolution(
                    Some(request),
                    Some(workflow_run),
                    Some(action),
                    Some(target_refs_json),
                    blocker(
                        "record_worker_evidence_action_not_completed",
                        "Existing Queue workflow record_worker_evidence action is not completed and will not be retried blindly.",
                        Some("actionIdempotencyKey"),
                    ),
                    stale_history,
                ));
            }
            if action.status == QueueWorkflowActionStatus::Completed.as_str() {
                ExistingActionDecision::Completed(action)
            } else {
                ExistingActionDecision::Retryable {
                    action,
                    repair_target_refs: !target_refs_complete,
                }
            }
        }
        None => ExistingActionDecision::None,
    };

    let existing_evidence = store.get_agent_queue_worker_evidence_bundle(
        &request.workspace_id,
        &request.worker.queue_item_id,
        &request.worker.run_id,
    )?;
    if let Some(existing_evidence) = existing_evidence.as_ref() {
        if !evidence_matches_request(existing_evidence, &request.worker, &changed_files_json) {
            return Ok(WorkerEvidenceStepResolveStatus::Conflict {
                workflow_run: Some(workflow_run),
                action: None,
                evidence: Some(existing_evidence.clone()),
                blocker: Some(blocker(
                    "evidence_conflict",
                    "Durable worker evidence already exists for this task/run with different bounded metadata.",
                    Some("workerEvidence"),
                )),
                conflict: QueueWorkflowConflict {
                    conflict_code: "evidence_metadata_conflict".to_owned(),
                    conflict_message:
                        "Durable worker evidence already exists for this task/run with different bounded metadata."
                            .to_owned(),
                    existing_workflow_run_id: Some(request.workflow_run_id.clone()),
                    existing_request_hash: Some(evidence_identity_json(existing_evidence)),
                    requested_request_hash: Some(request_evidence_identity_json(
                        &request.worker,
                        &changed_files_json,
                    )),
                },
            });
        }
    } else if store
        .get_latest_agent_queue_completion_decision(
            &request.workspace_id,
            &request.worker.queue_item_id,
        )?
        .is_some()
        || store
            .get_latest_agent_queue_failure_decision(
                &request.workspace_id,
                &request.worker.queue_item_id,
            )?
            .is_some()
    {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "terminal_decision_exists",
                "Queue workflow worker evidence recording is blocked after a task completion or failure decision exists.",
                Some("taskId"),
            ),
            stale_history,
        ));
    } else if store
        .get_latest_agent_queue_review_message(
            &request.workspace_id,
            &request.worker.queue_item_id,
        )?
        .is_some()
    {
        return Ok(blocked_worker_evidence_resolution(
            Some(request),
            Some(workflow_run),
            None,
            Some(target_refs_json),
            blocker(
                "review_already_exists",
                "Queue workflow worker evidence recording is blocked after a review message exists without matching durable evidence.",
                Some("messageId"),
            ),
            stale_history,
        ));
    }

    Ok(WorkerEvidenceStepResolveStatus::Ready(
        WorkerEvidenceStepResolution {
            request,
            workflow_run,
            slot_bindings,
            run_link,
            existing_evidence,
            existing_action,
            target_refs_json,
            changed_files_json,
            finished_at,
            bundle_id,
            stale_history,
        },
    ))
}

fn execute_worker_evidence_step_resolution(
    store: &SqliteStore,
    resolution: WorkerEvidenceStepResolveStatus,
) -> Result<QueueWorkflowWorkerEvidenceStepResult, StorageError> {
    match resolution {
        WorkerEvidenceStepResolveStatus::Ready(resolved) => {
            execute_ready_worker_evidence_step(store, resolved)
        }
        WorkerEvidenceStepResolveStatus::Blocked {
            request,
            workflow_run,
            action,
            target_refs_json,
            blocker,
            ..
        } => {
            let action = match (
                request.as_ref(),
                workflow_run.as_ref(),
                target_refs_json.as_ref(),
            ) {
                (Some(request), Some(workflow_run), Some(target_refs_json)) => {
                    Some(record_blocked_worker_evidence_action(
                        store,
                        request,
                        workflow_run,
                        action,
                        target_refs_json,
                        &blocker,
                    )?)
                }
                _ => action,
            };
            let workflow_run = match (request.as_ref(), workflow_run) {
                (Some(request), Some(workflow_run)) => Some(block_workflow_run_for_evidence(
                    store,
                    request,
                    &workflow_run,
                    &blocker,
                )?),
                (_, workflow_run) => workflow_run,
            };
            Ok(QueueWorkflowWorkerEvidenceStepResult {
                workflow_run_id: request
                    .as_ref()
                    .map(|request| request.workflow_run_id.clone())
                    .or_else(|| workflow_run.as_ref().map(|run| run.workflow_run_id.clone()))
                    .unwrap_or_default(),
                transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
                status: QueueWorkflowWorkerEvidenceStepResultStatus::BlockedPrecondition,
                action: action.map(QueueWorkflowAction::from),
                evidence_bundle: None,
                aggregate: None,
                binding: None,
                workflow_run: workflow_run.map(QueueWorkflowRun::from),
                next_phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE.to_owned()),
                next_step: Some("worker_evidence_blocked".to_owned()),
                blockers: vec![blocker],
                conflict: None,
            })
        }
        WorkerEvidenceStepResolveStatus::Conflict {
            workflow_run,
            action,
            evidence,
            conflict,
            blocker,
        } => Ok(QueueWorkflowWorkerEvidenceStepResult {
            workflow_run_id: workflow_run
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .or_else(|| conflict.existing_workflow_run_id.clone())
                .unwrap_or_default(),
            transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
            status: QueueWorkflowWorkerEvidenceStepResultStatus::Conflict,
            action: action.map(QueueWorkflowAction::from),
            evidence_bundle: evidence
                .map(worker_evidence_bundle_summary_for_tx)
                .transpose()?,
            aggregate: None,
            binding: None,
            workflow_run: workflow_run.map(QueueWorkflowRun::from),
            next_phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE.to_owned()),
            next_step: Some("worker_evidence_blocked".to_owned()),
            blockers: blocker.into_iter().collect(),
            conflict: Some(conflict),
        }),
        WorkerEvidenceStepResolveStatus::NotFound { request, blocker } => {
            Ok(QueueWorkflowWorkerEvidenceStepResult {
                workflow_run_id: request.workflow_run_id,
                transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
                status: QueueWorkflowWorkerEvidenceStepResultStatus::NotFound,
                action: None,
                evidence_bundle: None,
                aggregate: None,
                binding: None,
                workflow_run: None,
                next_phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE.to_owned()),
                next_step: None,
                blockers: vec![blocker],
                conflict: None,
            })
        }
        WorkerEvidenceStepResolveStatus::InvalidInput {
            workflow_run_id,
            blocker,
        } => Ok(QueueWorkflowWorkerEvidenceStepResult {
            workflow_run_id,
            transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
            status: QueueWorkflowWorkerEvidenceStepResultStatus::InvalidInput,
            action: None,
            evidence_bundle: None,
            aggregate: None,
            binding: None,
            workflow_run: None,
            next_phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE.to_owned()),
            next_step: None,
            blockers: vec![blocker],
            conflict: None,
        }),
    }
}

fn execute_ready_worker_evidence_step(
    store: &SqliteStore,
    mut resolved: WorkerEvidenceStepResolution,
) -> Result<QueueWorkflowWorkerEvidenceStepResult, StorageError> {
    let started_action = open_worker_evidence_action_for_execution(store, &resolved)?;
    let had_existing_evidence = resolved.existing_evidence.is_some();
    let evidence = match resolved.existing_evidence.take() {
        Some(evidence) => evidence,
        None => record_agent_queue_worker_finished_in_store(
            store,
            &resolved.request.worker,
            &resolved.finished_at,
            &resolved.bundle_id,
            &resolved.changed_files_json,
        )?,
    };
    let result_refs_json = result_refs_json(&evidence, &resolved.run_link.status);
    let action =
        complete_worker_evidence_action(store, &resolved, started_action, &result_refs_json)?;

    update_binding_with_evidence(
        &mut resolved.slot_bindings,
        &resolved.request,
        &evidence,
        &action,
        &resolved.finished_at,
        &resolved.run_link.status,
    );
    let slot_bindings_json = bounded_json(
        canonical_json_string(&Value::Object(resolved.slot_bindings)),
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
        "slotBindings",
    )?;
    let mutation_refs_json = bounded_json(
        mutation_refs_json(
            resolved.workflow_run.mutation_refs_json.as_deref(),
            &resolved.request,
            &evidence,
        ),
        MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
        "mutationRefs",
    )?;
    let idempotency_keys_json = bounded_json(
        idempotency_keys_json(
            resolved.workflow_run.idempotency_keys_json.as_deref(),
            &resolved.request.action_idempotency_key,
        ),
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES,
        "idempotencyKeys",
    )?;
    let action_log_summary_json = bounded_json(
        action_log_summary_json(
            resolved.workflow_run.action_log_summary_json.as_deref(),
            &resolved.request,
            &evidence,
            &resolved.run_link.status,
        ),
        MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
        "actionLogSummary",
    )?;
    let variables_json = bounded_json(
        variables_json(
            resolved.workflow_run.variables_json.as_deref(),
            &resolved.request,
            &evidence,
        ),
        MAX_WORKFLOW_VARIABLES_JSON_BYTES,
        "variables",
    )?;

    let updated_run = store
        .update_agent_queue_workflow_run_report_reopened(
            &resolved.request.workspace_id,
            &resolved.request.workflow_run_id,
            AgentQueueWorkflowRunReportUpdate {
                status: QueueWorkflowRunStatus::Paused.as_str(),
                phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE),
                current_step: Some(WORKFLOW_STEP_AWAITING_REVIEW),
                pause_reason: Some(PAUSE_REASON_AWAITING_REVIEW),
                blocker_reason: None,
                variables_json: Some(&variables_json),
                slot_bindings_json: Some(&slot_bindings_json),
                mutation_refs_json: Some(&mutation_refs_json),
                idempotency_keys_json: Some(&idempotency_keys_json),
                action_log_summary_json: Some(&action_log_summary_json),
                updated_at: Some(&resolved.finished_at),
                completed_at: None,
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)?;
    store.touch_workspace(&resolved.request.workspace_id)?;

    let evidence_summary = worker_evidence_bundle_summary_for_tx(evidence.clone())?;
    let binding = QueueWorkflowWorkerEvidenceBindingSummary {
        slot: resolved.request.slot.clone(),
        task_id: evidence.queue_task_id.clone(),
        run_id: evidence.run_id.clone(),
        evidence_bundle_id: evidence.bundle_id.clone(),
        evidence_action_id: Some(action.action_id.clone()),
        evidence_action_idempotency_key: resolved.request.action_idempotency_key.clone(),
        evidence_recorded_at: evidence.updated_at.clone(),
        worker_final_status: resolved.run_link.status.clone(),
        worker_outcome: evidence.outcome.clone(),
    };

    Ok(QueueWorkflowWorkerEvidenceStepResult {
        workflow_run_id: resolved.request.workflow_run_id,
        transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
        status: if had_existing_evidence {
            QueueWorkflowWorkerEvidenceStepResultStatus::AlreadyApplied
        } else {
            QueueWorkflowWorkerEvidenceStepResultStatus::Executed
        },
        action: Some(QueueWorkflowAction::from(action)),
        evidence_bundle: Some(evidence_summary),
        aggregate: None,
        binding: Some(binding),
        workflow_run: Some(QueueWorkflowRun::from(updated_run)),
        next_phase: Some("review".to_owned()),
        next_step: Some(WORKFLOW_STEP_AWAITING_REVIEW.to_owned()),
        blockers: Vec::new(),
        conflict: None,
    })
}

fn open_worker_evidence_action_for_execution(
    store: &SqliteStore,
    resolved: &WorkerEvidenceStepResolution,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    match &resolved.existing_action {
        ExistingActionDecision::None => {
            let action_id = placeholder_id("queue-workflow-action-");
            store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &action_id,
                workflow_run_id: &resolved.request.workflow_run_id,
                workspace_id: &resolved.request.workspace_id,
                step_id: RECORD_WORKER_EVIDENCE_STEP_ID,
                action_type: RECORD_WORKER_EVIDENCE_ACTION_TYPE,
                idempotency_key: &resolved.request.action_idempotency_key,
                status: QueueWorkflowActionStatus::Running.as_str(),
                target_refs_json: Some(&resolved.target_refs_json),
                result_refs_json: None,
                blocker_code: None,
                blocker_message: None,
                attempt_count: 1,
                started_at: Some(&resolved.finished_at),
                completed_at: None,
                created_at: Some(&resolved.finished_at),
                updated_at: Some(&resolved.finished_at),
            })
        }
        ExistingActionDecision::Completed(action) => Ok(action.clone()),
        ExistingActionDecision::Retryable {
            action,
            repair_target_refs,
        } => {
            let update = AgentQueueWorkflowActionUpdate {
                status: QueueWorkflowActionStatus::Running.as_str(),
                result_refs_json: None,
                blocker_code: None,
                blocker_message: None,
                attempt_count: Some(action.attempt_count.saturating_add(1)),
                started_at: Some(&resolved.finished_at),
                completed_at: None,
                updated_at: Some(&resolved.finished_at),
            };
            if *repair_target_refs {
                store.replace_agent_queue_workflow_action_refs_and_resolution(
                    &resolved.request.workspace_id,
                    &resolved.request.workflow_run_id,
                    &resolved.request.action_idempotency_key,
                    Some(&resolved.target_refs_json),
                    update,
                )
            } else {
                store.replace_agent_queue_workflow_action_resolution(
                    &resolved.request.workspace_id,
                    &resolved.request.workflow_run_id,
                    &resolved.request.action_idempotency_key,
                    update,
                )
            }?
            .ok_or(StorageError::QueryReturnedNoRows)
        }
    }
}

fn complete_worker_evidence_action(
    store: &SqliteStore,
    resolved: &WorkerEvidenceStepResolution,
    action: AgentQueueWorkflowActionRow,
    result_refs_json: &str,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    if action.status == QueueWorkflowActionStatus::Completed.as_str() {
        if action.result_refs_json.as_deref() != Some(result_refs_json) {
            return Err(StorageError::InvalidParameterName(
                "Existing Queue workflow record_worker_evidence action result refs do not match durable evidence.".to_owned(),
            ));
        }
        return Ok(action);
    }

    store
        .replace_agent_queue_workflow_action_resolution(
            &resolved.request.workspace_id,
            &resolved.request.workflow_run_id,
            &resolved.request.action_idempotency_key,
            AgentQueueWorkflowActionUpdate {
                status: QueueWorkflowActionStatus::Completed.as_str(),
                result_refs_json: Some(result_refs_json),
                blocker_code: None,
                blocker_message: None,
                attempt_count: Some(action.attempt_count),
                started_at: action.started_at.as_deref().or(Some(&resolved.finished_at)),
                completed_at: Some(&resolved.finished_at),
                updated_at: Some(&resolved.finished_at),
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)
}

fn record_blocked_worker_evidence_action(
    store: &SqliteStore,
    request: &NormalizedWorkflowEvidenceRequest,
    _workflow_run: &AgentQueueWorkflowRunRow,
    existing_action: Option<AgentQueueWorkflowActionRow>,
    target_refs_json: &str,
    blocker: &QueueWorkflowCommandBlocker,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    let result_refs = canonical_json_string(&json!({
        "commandStatus": "blocked_precondition",
        "outcome": request.worker.outcome,
        "status": blocker.blocker_code,
    }));
    match existing_action {
        Some(action) => store
            .replace_agent_queue_workflow_action_resolution(
                &request.workspace_id,
                &request.workflow_run_id,
                &request.action_idempotency_key,
                AgentQueueWorkflowActionUpdate {
                    status: QueueWorkflowActionStatus::Blocked.as_str(),
                    result_refs_json: Some(&result_refs),
                    blocker_code: Some(&blocker.blocker_code),
                    blocker_message: Some(&blocker.blocker_message),
                    attempt_count: Some(action.attempt_count.saturating_add(1)),
                    started_at: action.started_at.as_deref(),
                    completed_at: None,
                    updated_at: None,
                },
            )?
            .ok_or(StorageError::QueryReturnedNoRows),
        None => {
            let now = placeholder_timestamp();
            let action_id = placeholder_id("queue-workflow-action-");
            store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &action_id,
                workflow_run_id: &request.workflow_run_id,
                workspace_id: &request.workspace_id,
                step_id: RECORD_WORKER_EVIDENCE_STEP_ID,
                action_type: RECORD_WORKER_EVIDENCE_ACTION_TYPE,
                idempotency_key: &request.action_idempotency_key,
                status: QueueWorkflowActionStatus::Blocked.as_str(),
                target_refs_json: Some(target_refs_json),
                result_refs_json: Some(&result_refs),
                blocker_code: Some(&blocker.blocker_code),
                blocker_message: Some(&blocker.blocker_message),
                attempt_count: 1,
                started_at: Some(&now),
                completed_at: Some(&now),
                created_at: Some(&now),
                updated_at: Some(&now),
            })
        }
    }
}

fn block_workflow_run_for_evidence(
    store: &SqliteStore,
    request: &NormalizedWorkflowEvidenceRequest,
    _workflow_run: &AgentQueueWorkflowRunRow,
    blocker: &QueueWorkflowCommandBlocker,
) -> Result<AgentQueueWorkflowRunRow, StorageError> {
    let now = placeholder_timestamp();
    store
        .update_agent_queue_workflow_run_report(
            &request.workspace_id,
            &request.workflow_run_id,
            AgentQueueWorkflowRunReportUpdate {
                status: QueueWorkflowRunStatus::Blocked.as_str(),
                phase: Some(WORKFLOW_PHASE_WORKER_EVIDENCE),
                current_step: Some("worker_evidence_blocked"),
                pause_reason: None,
                blocker_reason: Some(&blocker.blocker_message),
                variables_json: None,
                slot_bindings_json: None,
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                updated_at: Some(&now),
                completed_at: None,
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)
}

fn plan_from_worker_evidence_resolution(
    fallback_workflow_run_id: &str,
    resolution: WorkerEvidenceStepResolveStatus,
) -> QueueWorkflowWorkerEvidenceStepPlan {
    match resolution {
        WorkerEvidenceStepResolveStatus::Ready(resolved) => {
            let existing_bundle = resolved
                .existing_evidence
                .as_ref()
                .map(|evidence| evidence.bundle_id.clone());
            QueueWorkflowWorkerEvidenceStepPlan {
                workflow_run_id: resolved.request.workflow_run_id.clone(),
                workflow_id: Some(resolved.workflow_run.workflow_id.clone()),
                persistent_status: Some(resolved.workflow_run.status.clone()),
                phase: Some(resolved.workflow_run.phase.clone()),
                current_step: resolved.workflow_run.current_step.clone(),
                transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
                executable: true,
                idempotency_key: Some(resolved.request.action_idempotency_key.clone()),
                target_refs: parse_json_value(&resolved.target_refs_json),
                current_refs: Some(current_refs_json(
                    &resolved.run_link,
                    existing_bundle.as_deref(),
                    action_ref_for_plan(&resolved.existing_action).as_ref(),
                )),
                missing_refs: Vec::new(),
                required_input: Vec::new(),
                blockers: Vec::new(),
                safe_to_record_worker_evidence: true,
                reason_if_not_safe: None,
                stale_history: resolved.stale_history,
                expected_next_phase_on_success: Some("review".to_owned()),
                expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_REVIEW.to_owned()),
            }
        }
        WorkerEvidenceStepResolveStatus::Blocked {
            request,
            workflow_run,
            target_refs_json,
            blocker,
            stale_history,
            ..
        } => QueueWorkflowWorkerEvidenceStepPlan {
            workflow_run_id: request
                .as_ref()
                .map(|request| request.workflow_run_id.clone())
                .or_else(|| workflow_run.as_ref().map(|run| run.workflow_run_id.clone()))
                .unwrap_or_else(|| fallback_workflow_run_id.to_owned()),
            workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
            persistent_status: workflow_run.as_ref().map(|run| run.status.clone()),
            phase: workflow_run.as_ref().map(|run| run.phase.clone()),
            current_step: workflow_run
                .as_ref()
                .and_then(|run| run.current_step.clone()),
            transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
            executable: false,
            idempotency_key: request
                .as_ref()
                .map(|request| request.action_idempotency_key.clone()),
            target_refs: target_refs_json.as_deref().and_then(parse_json_value),
            current_refs: None,
            missing_refs: blocker.missing_required_field.clone().into_iter().collect(),
            required_input: blocker.missing_required_field.clone().into_iter().collect(),
            blockers: vec![blocker.clone()],
            safe_to_record_worker_evidence: false,
            reason_if_not_safe: Some(blocker.blocker_message),
            stale_history,
            expected_next_phase_on_success: Some("review".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_REVIEW.to_owned()),
        },
        WorkerEvidenceStepResolveStatus::Conflict {
            workflow_run,
            conflict,
            blocker,
            ..
        } => QueueWorkflowWorkerEvidenceStepPlan {
            workflow_run_id: workflow_run
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .or_else(|| conflict.existing_workflow_run_id.clone())
                .unwrap_or_else(|| fallback_workflow_run_id.to_owned()),
            workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
            persistent_status: workflow_run.as_ref().map(|run| run.status.clone()),
            phase: workflow_run.as_ref().map(|run| run.phase.clone()),
            current_step: workflow_run
                .as_ref()
                .and_then(|run| run.current_step.clone()),
            transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
            executable: false,
            idempotency_key: None,
            target_refs: None,
            current_refs: None,
            missing_refs: Vec::new(),
            required_input: Vec::new(),
            blockers: blocker.into_iter().collect(),
            safe_to_record_worker_evidence: false,
            reason_if_not_safe: Some(conflict.conflict_message),
            stale_history: false,
            expected_next_phase_on_success: Some("review".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_REVIEW.to_owned()),
        },
        WorkerEvidenceStepResolveStatus::NotFound { request, blocker } => {
            QueueWorkflowWorkerEvidenceStepPlan {
                workflow_run_id: request.workflow_run_id,
                workflow_id: None,
                persistent_status: None,
                phase: None,
                current_step: None,
                transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
                executable: false,
                idempotency_key: Some(request.action_idempotency_key),
                target_refs: None,
                current_refs: None,
                missing_refs: vec!["workflowRunId".to_owned()],
                required_input: Vec::new(),
                blockers: vec![blocker.clone()],
                safe_to_record_worker_evidence: false,
                reason_if_not_safe: Some(blocker.blocker_message),
                stale_history: false,
                expected_next_phase_on_success: Some("review".to_owned()),
                expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_REVIEW.to_owned()),
            }
        }
        WorkerEvidenceStepResolveStatus::InvalidInput {
            workflow_run_id,
            blocker,
        } => QueueWorkflowWorkerEvidenceStepPlan {
            workflow_run_id: if workflow_run_id.is_empty() {
                fallback_workflow_run_id.to_owned()
            } else {
                workflow_run_id
            },
            workflow_id: None,
            persistent_status: None,
            phase: None,
            current_step: None,
            transition: QueueWorkflowWorkerEvidenceStepTransition::RecordWorkerEvidence,
            executable: false,
            idempotency_key: None,
            target_refs: None,
            current_refs: None,
            missing_refs: blocker.missing_required_field.clone().into_iter().collect(),
            required_input: blocker.missing_required_field.clone().into_iter().collect(),
            blockers: vec![blocker.clone()],
            safe_to_record_worker_evidence: false,
            reason_if_not_safe: Some(blocker.blocker_message),
            stale_history: false,
            expected_next_phase_on_success: Some("review".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_REVIEW.to_owned()),
        },
    }
}

fn blocked_worker_evidence_resolution(
    request: Option<NormalizedWorkflowEvidenceRequest>,
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    action: Option<AgentQueueWorkflowActionRow>,
    target_refs_json: Option<String>,
    blocker: QueueWorkflowCommandBlocker,
    stale_history: bool,
) -> WorkerEvidenceStepResolveStatus {
    WorkerEvidenceStepResolveStatus::Blocked {
        request,
        workflow_run,
        action,
        target_refs_json,
        blocker,
        stale_history,
    }
}

fn conflict_worker_evidence_resolution(
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    action: Option<AgentQueueWorkflowActionRow>,
    evidence: Option<AgentQueueWorkerEvidenceBundleRow>,
    code: &str,
    message: &str,
    existing: Option<String>,
    requested: Option<String>,
) -> WorkerEvidenceStepResolveStatus {
    WorkerEvidenceStepResolveStatus::Conflict {
        workflow_run: workflow_run.clone(),
        action,
        evidence,
        blocker: None,
        conflict: QueueWorkflowConflict {
            conflict_code: code.to_owned(),
            conflict_message: message.to_owned(),
            existing_workflow_run_id: workflow_run.map(|run| run.workflow_run_id),
            existing_request_hash: existing,
            requested_request_hash: requested,
        },
    }
}

fn target_refs_json_without_binding(request: &NormalizedWorkflowEvidenceRequest) -> String {
    canonical_json_string(&json!({
        "runId": request.worker.run_id,
        "slot": request.slot,
        "taskId": request.worker.queue_item_id,
        "workflowRunId": request.workflow_run_id,
    }))
}

fn parse_json_value(raw: &str) -> Option<Value> {
    serde_json::from_str::<Value>(raw).ok()
}

fn current_refs_json(
    run_link: &AgentQueueTaskRunLinkRow,
    evidence_bundle_id: Option<&str>,
    action: Option<&QueueWorkflowAction>,
) -> Value {
    json!({
        "actionId": action.map(|action| action.action_id.clone()),
        "actionStatus": action.map(|action| action.status.clone()),
        "evidenceBundleId": evidence_bundle_id,
        "runId": run_link.direct_work_run_id.clone(),
        "runLinkId": run_link.link_id.clone(),
        "workerFinalStatus": run_link.status.clone(),
    })
}

fn action_ref_for_plan(action: &ExistingActionDecision) -> Option<QueueWorkflowAction> {
    match action {
        ExistingActionDecision::None => None,
        ExistingActionDecision::Completed(action) => {
            Some(QueueWorkflowAction::from(action.clone()))
        }
        ExistingActionDecision::Retryable { action, .. } => {
            Some(QueueWorkflowAction::from(action.clone()))
        }
    }
}

fn normalize_workflow_evidence_request(
    request: QueueWorkflowRecordWorkerEvidenceRequest,
) -> Result<NormalizedWorkflowEvidenceRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required(&request.workspace_id, "workspaceId")?;
    let workflow_run_id = required(&request.workflow_run_id, "workflowRunId")?;
    let slot = required(&request.slot, "slot")?;
    if slot != "upstream" {
        return Err(blocker(
            "unsupported_slot",
            "Queue dependency workflow evidence recording currently supports only the upstream slot.",
            Some("slot"),
        ));
    }
    let task_id = required(&request.task_id, "taskId")?;
    let run_id = required(&request.run_id, "runId")?;
    let expected_key =
        record_worker_evidence_idempotency_key(&workflow_run_id, &slot, &task_id, &run_id);
    if let Some(provided) = optional_trimmed(request.action_idempotency_key) {
        if provided != expected_key {
            return Err(blocker(
                "invalid_action_idempotency_key",
                "Queue workflow evidence idempotency key must be workflowRunId:record_worker_evidence:slot:taskId:runId.",
                Some("actionIdempotencyKey"),
            ));
        }
    }

    let worker =
        normalize_record_agent_queue_worker_finished_input(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task_id,
            run_id,
            outcome: request.outcome,
            summary: request.summary,
            changed_files: request.changed_files,
            changed_files_summary: request.changed_files_summary,
            validation_summary: request.validation_summary,
            error_summary: request.error_summary,
            worker_id: request.worker_id.or(request.actor_id),
            source: request.source,
            metadata_json: request.metadata_json,
            finished_at: request.finished_at,
        })
        .map_err(|error| {
            blocker(
                "invalid_worker_evidence",
                &error.to_string(),
                Some("workerEvidence"),
            )
        })?;

    Ok(NormalizedWorkflowEvidenceRequest {
        workspace_id,
        workflow_run_id,
        slot,
        action_idempotency_key: expected_key,
        worker,
    })
}

fn record_worker_evidence_idempotency_key(
    workflow_run_id: &str,
    slot: &str,
    task_id: &str,
    run_id: &str,
) -> String {
    format!("{workflow_run_id}:record_worker_evidence:{slot}:{task_id}:{run_id}")
}

fn parse_slot_bindings(
    slot_bindings_json: Option<&str>,
) -> Result<Map<String, Value>, QueueWorkflowCommandBlocker> {
    let Some(raw) = slot_bindings_json else {
        return Ok(Map::new());
    };
    if raw.trim().is_empty() {
        return Ok(Map::new());
    }
    let value = serde_json::from_str::<Value>(raw).map_err(|_| {
        blocker(
            "invalid_slot_bindings_json",
            "Queue workflow slotBindings JSON could not be parsed.",
            Some("slotBindings"),
        )
    })?;
    match value {
        Value::Object(object) => Ok(object),
        _ => Err(blocker(
            "invalid_slot_bindings_json",
            "Queue workflow slotBindings must be a JSON object.",
            Some("slotBindings"),
        )),
    }
}

fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .as_object()
        .and_then(|object| object.get(field))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn retryable_worker_evidence_reentry_blocker(
    store: &SqliteStore,
    workflow_run: &AgentQueueWorkflowRunRow,
    request: &NormalizedWorkflowEvidenceRequest,
    slot_bindings: &Map<String, Value>,
    existing_binding: &Value,
    actions: &[AgentQueueWorkflowActionRow],
) -> Result<Option<QueueWorkflowCommandBlocker>, StorageError> {
    if workflow_run.phase != WORKFLOW_PHASE_WORKER_EVIDENCE
        || !has_retryable_worker_evidence_reentry_marker(workflow_run, actions)
    {
        return Ok(Some(blocker(
            "worker_evidence_reentry_not_retryable",
            "Queue workflow worker evidence re-entry is allowed only for a proven retryable worker_evidence failure before durable evidence mutation.",
            Some("workflowRunId"),
        )));
    }

    if !grant_preserves_no_downstream_auto_start(workflow_run.grant_summary_json.as_deref()) {
        return Ok(Some(blocker(
            "worker_evidence_reentry_constraints_missing",
            "Queue workflow worker evidence re-entry requires the persisted grant constraints to preserve noDownstreamAutoStart.",
            Some("grantSummary.constraints.noDownstreamAutoStart"),
        )));
    }

    if string_field(existing_binding, "evidenceBundleId").is_some() {
        return Ok(Some(blocker(
            "worker_evidence_already_bound",
            "Queue workflow worker evidence re-entry is not allowed when the slot already has an evidenceBundleId.",
            Some("slotBindings.evidenceBundleId"),
        )));
    }

    if let Some(blocker) = record_worker_evidence_action_reentry_blocker(actions) {
        return Ok(Some(blocker));
    }

    if store
        .get_agent_queue_worker_evidence_bundle(
            &request.workspace_id,
            &request.worker.queue_item_id,
            &request.worker.run_id,
        )?
        .is_some()
    {
        return Ok(Some(blocker(
            "worker_evidence_already_durable",
            "Queue workflow worker evidence re-entry is not allowed after durable worker evidence already exists.",
            Some("workerEvidence.runId"),
        )));
    }

    match recover_start_worker_run_id_for_evidence(
        store,
        request,
        slot_bindings,
        existing_binding,
        true,
    )? {
        StartWorkerRunRecovery::Recovered(run_id) if run_id == request.worker.run_id => {}
        StartWorkerRunRecovery::Recovered(run_id) => {
            return Ok(Some(blocker(
                "run_id_mismatch",
                "Queue workflow evidence runId does not match the recovered start_worker runId.",
                Some(if run_id.is_empty() {
                    "startWorker.resultRefs.runId"
                } else {
                    "workerEvidence.runId"
                }),
            )));
        }
        StartWorkerRunRecovery::NotAvailable => {
            return Ok(Some(blocker(
                "missing_start_worker_action",
                "Queue workflow worker evidence re-entry requires a completed start_worker workflow action.",
                Some("startWorker"),
            )));
        }
        StartWorkerRunRecovery::Blocked(blocker) => return Ok(Some(blocker)),
        StartWorkerRunRecovery::Conflict { code, message, .. } => {
            return Ok(Some(blocker(code, message, Some("startWorker"))));
        }
    }

    let Some(run_link) = store
        .get_agent_queue_task_run_link_by_run_id(&request.workspace_id, &request.worker.run_id)?
    else {
        return Ok(Some(blocker(
            "run_missing",
            "Queue workflow evidence runId was not found in the requested workspace.",
            Some("runId"),
        )));
    };

    if run_link.queue_task_id != request.worker.queue_item_id {
        return Ok(Some(blocker(
            "run_task_mismatch",
            "Queue workflow evidence runId belongs to a different Queue task.",
            Some("runId"),
        )));
    }
    let bound_executor_widget_id = string_field(existing_binding, "executorWidgetId");
    if bound_executor_widget_id
        .is_some_and(|executor| executor != run_link.executor_widget_id.as_str())
    {
        return Ok(Some(blocker(
            "run_executor_mismatch",
            "Queue workflow evidence runId belongs to a different executorWidgetId.",
            Some("executorWidgetId"),
        )));
    }
    if run_link.status == AgentQueueTaskRunStatus::Running.as_str() {
        return Ok(Some(blocker(
            "worker_run_not_complete",
            "Queue workflow worker run is still running; evidence recording is paused.",
            Some("runId"),
        )));
    }
    if !is_completed_worker_run_state(&run_link) {
        return Ok(Some(blocker(
            "worker_run_state_mismatch",
            "Queue workflow worker run state is not a deterministic completed state.",
            Some("runId"),
        )));
    }
    if let Some(expected_outcome) = expected_worker_outcome_for_run_state(&run_link) {
        if expected_outcome != request.worker.outcome {
            return Ok(Some(blocker(
                "worker_outcome_mismatch",
                "Queue workflow worker evidence outcome does not match the durable worker run status.",
                Some("workerEvidence.outcome"),
            )));
        }
    }

    if store
        .get_latest_agent_queue_completion_decision(
            &request.workspace_id,
            &request.worker.queue_item_id,
        )?
        .is_some()
        || store
            .get_latest_agent_queue_failure_decision(
                &request.workspace_id,
                &request.worker.queue_item_id,
            )?
            .is_some()
    {
        return Ok(Some(blocker(
            "terminal_decision_exists",
            "Queue workflow worker evidence re-entry is not allowed after a task completion or failure decision exists.",
            Some("taskId"),
        )));
    }
    if store
        .get_latest_agent_queue_review_message(
            &request.workspace_id,
            &request.worker.queue_item_id,
        )?
        .is_some()
    {
        return Ok(Some(blocker(
            "review_already_exists",
            "Queue workflow worker evidence re-entry is not allowed after a review message exists.",
            Some("messageId"),
        )));
    }

    Ok(None)
}

fn has_retryable_worker_evidence_reentry_marker(
    workflow_run: &AgentQueueWorkflowRunRow,
    actions: &[AgentQueueWorkflowActionRow],
) -> bool {
    if actions.iter().any(is_worker_evidence_runner_failed_action) {
        return true;
    }
    workflow_run.status == "blocked"
        && actions
            .iter()
            .any(is_retryable_record_worker_evidence_action)
}

fn is_worker_evidence_runner_failed_action(action: &AgentQueueWorkflowActionRow) -> bool {
    action.action_type == "queue.workflow.runner"
        && action.status == QueueWorkflowActionStatus::Failed.as_str()
        && (action.step_id == "runner.worker_evidence"
            || action_ref_phase(action.target_refs_json.as_deref()).as_deref()
                == Some(WORKFLOW_PHASE_WORKER_EVIDENCE)
            || action_ref_phase(action.result_refs_json.as_deref()).as_deref()
                == Some(WORKFLOW_PHASE_WORKER_EVIDENCE))
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

fn grant_preserves_no_downstream_auto_start(raw: Option<&str>) -> bool {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| {
            value
                .as_object()
                .and_then(|object| object.get("constraints"))
                .and_then(Value::as_object)
                .and_then(|constraints| constraints.get("noDownstreamAutoStart"))
                .and_then(Value::as_bool)
        })
        == Some(true)
}

fn record_worker_evidence_action_reentry_blocker(
    actions: &[AgentQueueWorkflowActionRow],
) -> Option<QueueWorkflowCommandBlocker> {
    for action in actions
        .iter()
        .filter(|action| action.action_type == RECORD_WORKER_EVIDENCE_ACTION_TYPE)
    {
        if action.status == QueueWorkflowActionStatus::Completed.as_str() {
            if !completed_record_worker_evidence_action_refs_are_complete(action) {
                return Some(blocker(
                    "completed_evidence_action_incomplete",
                    "Queue workflow worker evidence re-entry is not allowed after a completed record_worker_evidence action with incomplete refs.",
                    Some("recordWorkerEvidence.refs"),
                ));
            }
            return Some(blocker(
                "record_worker_evidence_already_completed",
                "Queue workflow worker evidence re-entry is not allowed after record_worker_evidence completed.",
                Some("recordWorkerEvidence"),
            ));
        }
        if action_result_evidence_bundle_id(action).is_some() {
            return Some(blocker(
                "evidence_mutation_state_unknown",
                "Queue workflow worker evidence re-entry is not allowed when a non-completed record_worker_evidence action has evidence result refs.",
                Some("resultRefs.evidenceBundleId"),
            ));
        }
        if is_retryable_record_worker_evidence_action(action) {
            continue;
        }
        return Some(blocker(
            "record_worker_evidence_action_not_retryable",
            "Existing Queue workflow record_worker_evidence action is not retryable.",
            Some("recordWorkerEvidence"),
        ));
    }
    None
}

fn completed_record_worker_evidence_action_refs_are_complete(
    action: &AgentQueueWorkflowActionRow,
) -> bool {
    let Some(target) = parse_action_refs(action.target_refs_json.as_deref()) else {
        return false;
    };
    let Some(result) = parse_action_refs(action.result_refs_json.as_deref()) else {
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
    .all(|field| action_string_field(&target, field).is_some())
        && ["evidenceBundleId", "runId", "outcome", "workerFinalStatus"]
            .iter()
            .all(|field| action_string_field(&result, field).is_some())
}

enum StartWorkerRunRecovery {
    Recovered(String),
    NotAvailable,
    Blocked(QueueWorkflowCommandBlocker),
    Conflict {
        code: &'static str,
        message: &'static str,
        existing: Option<String>,
        requested: Option<String>,
    },
}

enum TaskSlotResolution {
    Found(String),
    Missing,
    Ambiguous,
}

fn recover_start_worker_run_id_for_evidence(
    store: &SqliteStore,
    request: &NormalizedWorkflowEvidenceRequest,
    slot_bindings: &Map<String, Value>,
    existing_binding: &Value,
    require_recovery_hashes: bool,
) -> Result<StartWorkerRunRecovery, StorageError> {
    let actions =
        store.list_agent_queue_workflow_actions(&request.workspace_id, &request.workflow_run_id)?;
    let mut recovered_run_id: Option<String> = None;

    for action in actions {
        if action.action_type != "start_worker"
            || action.status != QueueWorkflowActionStatus::Completed.as_str()
        {
            continue;
        }

        let Some(target_refs) = parse_action_refs(action.target_refs_json.as_deref()) else {
            continue;
        };

        if action_string_field(&target_refs, "workflowRunId")
            .as_deref()
            .is_some_and(|workflow_run_id| workflow_run_id != request.workflow_run_id)
        {
            return Ok(StartWorkerRunRecovery::Conflict {
                code: "start_worker_workflow_mismatch",
                message:
                    "Queue workflow start_worker action workflowRunId does not match the evidence workflowRunId.",
                existing: action_string_field(&target_refs, "workflowRunId"),
                requested: Some(request.workflow_run_id.clone()),
            });
        }

        if action_string_field(&target_refs, "taskId").as_deref()
            != Some(request.worker.queue_item_id.as_str())
        {
            continue;
        }

        match action_string_field(&target_refs, "slot") {
            Some(slot) if slot != request.slot => continue,
            Some(_) => {}
            None => match unique_slot_for_task(slot_bindings, &request.worker.queue_item_id) {
                TaskSlotResolution::Found(slot) if slot == request.slot => {}
                TaskSlotResolution::Found(_) | TaskSlotResolution::Missing => continue,
                TaskSlotResolution::Ambiguous => {
                    return Ok(StartWorkerRunRecovery::Blocked(blocker(
                        "ambiguous_task_slot_binding",
                        "Queue workflow start_worker action does not name a slot and taskId maps to multiple slot bindings.",
                        Some("slotBindings.taskId"),
                    )));
                }
            },
        }

        if let Some(recovery) = validate_start_worker_recovery_refs(
            &target_refs,
            existing_binding,
            require_recovery_hashes,
        ) {
            return Ok(recovery);
        }

        let Some(result_refs) = parse_action_refs(action.result_refs_json.as_deref()) else {
            if require_recovery_hashes {
                return Ok(StartWorkerRunRecovery::Blocked(blocker(
                    "missing_start_worker_result_refs",
                    "Queue workflow start_worker action is completed but has no durable result refs.",
                    Some("startWorker.resultRefs"),
                )));
            }
            continue;
        };
        let Some(run_id) = action_string_field(&result_refs, "runId") else {
            if require_recovery_hashes {
                return Ok(StartWorkerRunRecovery::Blocked(blocker(
                    "missing_start_worker_run_ref",
                    "Queue workflow start_worker action is completed but resultRefs.runId is missing.",
                    Some("startWorker.resultRefs.runId"),
                )));
            }
            continue;
        };

        if let Some(existing_run_id) = recovered_run_id.as_deref() {
            if existing_run_id != run_id {
                return Ok(StartWorkerRunRecovery::Conflict {
                    code: "run_id_mismatch",
                    message:
                        "Queue workflow has conflicting completed start_worker runId refs for the same slot.",
                    existing: Some(existing_run_id.to_owned()),
                    requested: Some(run_id),
                });
            }
        } else {
            recovered_run_id = Some(run_id);
        }
    }

    Ok(recovered_run_id
        .map(StartWorkerRunRecovery::Recovered)
        .unwrap_or(StartWorkerRunRecovery::NotAvailable))
}

fn validate_start_worker_recovery_refs(
    target_refs: &Map<String, Value>,
    existing_binding: &Value,
    require_recovery_hashes: bool,
) -> Option<StartWorkerRunRecovery> {
    if require_recovery_hashes {
        if let Some(recovery) =
            validate_required_matching_ref(target_refs, existing_binding, "settingsHash")
        {
            return Some(recovery);
        }
        if let Some(recovery) =
            validate_required_matching_ref(target_refs, existing_binding, "executionTargetHash")
        {
            return Some(recovery);
        }
    } else {
        if let Some(recovery) =
            validate_optional_matching_ref(target_refs, existing_binding, "settingsHash")
        {
            return Some(recovery);
        }
        if let Some(recovery) =
            validate_optional_matching_ref(target_refs, existing_binding, "executionTargetHash")
        {
            return Some(recovery);
        }
    }

    for field in [
        "executionTargetKind",
        "providerId",
        "queueOwnerWidgetInstanceId",
        "executorWidgetId",
    ] {
        if let Some(recovery) = validate_optional_matching_ref(target_refs, existing_binding, field)
        {
            return Some(recovery);
        }
    }

    None
}

fn validate_required_matching_ref(
    target_refs: &Map<String, Value>,
    existing_binding: &Value,
    field: &'static str,
) -> Option<StartWorkerRunRecovery> {
    let target = action_string_field(target_refs, field);
    let binding = string_field(existing_binding, field).map(str::to_owned);

    match (target, binding) {
        (Some(target), Some(binding)) if target == binding => None,
        (Some(target), Some(binding)) => Some(StartWorkerRunRecovery::Conflict {
            code: ref_mismatch_code(field),
            message: "Queue workflow start_worker refs do not match the persisted slot binding.",
            existing: Some(binding),
            requested: Some(target),
        }),
        (None, _) => Some(StartWorkerRunRecovery::Blocked(blocker(
            ref_missing_code(field),
            "Queue workflow start_worker action is missing a required recovery ref.",
            Some(ref_target_path(field)),
        ))),
        (_, None) => Some(StartWorkerRunRecovery::Blocked(blocker(
            ref_missing_code(field),
            "Queue workflow slot binding is missing a required recovery ref.",
            Some(ref_binding_path(field)),
        ))),
    }
}

fn validate_optional_matching_ref(
    target_refs: &Map<String, Value>,
    existing_binding: &Value,
    field: &'static str,
) -> Option<StartWorkerRunRecovery> {
    let target = action_string_field(target_refs, field);
    let binding = string_field(existing_binding, field).map(str::to_owned);

    match (target, binding) {
        (Some(target), Some(binding)) if target != binding => {
            Some(StartWorkerRunRecovery::Conflict {
                code: ref_mismatch_code(field),
                message:
                    "Queue workflow start_worker refs do not match the persisted slot binding.",
                existing: Some(binding),
                requested: Some(target),
            })
        }
        _ => None,
    }
}

fn parse_action_refs(raw: Option<&str>) -> Option<Map<String, Value>> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    serde_json::from_str::<Value>(raw)
        .ok()?
        .as_object()
        .cloned()
}

fn action_string_field(object: &Map<String, Value>, field: &str) -> Option<String> {
    object
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn unique_slot_for_task(slot_bindings: &Map<String, Value>, task_id: &str) -> TaskSlotResolution {
    let mut matched_slot: Option<String> = None;
    for (slot, binding) in slot_bindings {
        if string_field(binding, "taskId") != Some(task_id) {
            continue;
        }
        if matched_slot.is_some() {
            return TaskSlotResolution::Ambiguous;
        }
        matched_slot = Some(slot.clone());
    }

    matched_slot
        .map(TaskSlotResolution::Found)
        .unwrap_or(TaskSlotResolution::Missing)
}

fn ref_mismatch_code(field: &str) -> &'static str {
    match field {
        "executionTargetHash" => "execution_target_hash_mismatch",
        "executionTargetKind" => "execution_target_kind_mismatch",
        "executorWidgetId" => "executor_widget_id_mismatch",
        "providerId" => "provider_id_mismatch",
        "queueOwnerWidgetInstanceId" => "queue_owner_widget_instance_id_mismatch",
        "settingsHash" => "settings_hash_mismatch",
        _ => "start_worker_ref_mismatch",
    }
}

fn ref_missing_code(field: &str) -> &'static str {
    match field {
        "executionTargetHash" => "missing_execution_target_hash",
        "settingsHash" => "missing_settings_hash",
        _ => "missing_start_worker_ref",
    }
}

fn ref_target_path(field: &str) -> &'static str {
    match field {
        "executionTargetHash" => "startWorker.targetRefs.executionTargetHash",
        "settingsHash" => "startWorker.targetRefs.settingsHash",
        _ => "startWorker.targetRefs",
    }
}

fn ref_binding_path(field: &str) -> &'static str {
    match field {
        "executionTargetHash" => "slotBindings.executionTargetHash",
        "settingsHash" => "slotBindings.settingsHash",
        _ => "slotBindings",
    }
}

fn action_matches_target(
    action: &AgentQueueWorkflowActionRow,
    request: &NormalizedWorkflowEvidenceRequest,
    existing_binding: &Value,
) -> bool {
    let Some(target_refs) = parse_action_refs(action.target_refs_json.as_deref()) else {
        return false;
    };
    action.workspace_id == request.workspace_id
        && action.workflow_run_id == request.workflow_run_id
        && action.step_id == RECORD_WORKER_EVIDENCE_STEP_ID
        && action.action_type == RECORD_WORKER_EVIDENCE_ACTION_TYPE
        && action_string_field(&target_refs, "workflowRunId").as_deref()
            == Some(request.workflow_run_id.as_str())
        && action_string_field(&target_refs, "slot").as_deref() == Some(request.slot.as_str())
        && action_string_field(&target_refs, "taskId").as_deref()
            == Some(request.worker.queue_item_id.as_str())
        && action_string_field(&target_refs, "runId").as_deref()
            == Some(request.worker.run_id.as_str())
        && optional_target_ref_matches_binding(&target_refs, existing_binding, "settingsHash")
        && optional_target_ref_matches_binding(
            &target_refs,
            existing_binding,
            "executionTargetHash",
        )
        && optional_target_ref_matches_binding(
            &target_refs,
            existing_binding,
            "executionTargetKind",
        )
        && optional_target_ref_matches_binding(&target_refs, existing_binding, "providerId")
        && optional_target_ref_matches_binding(
            &target_refs,
            existing_binding,
            "queueOwnerWidgetInstanceId",
        )
        && optional_target_ref_matches_binding(&target_refs, existing_binding, "executorWidgetId")
}

fn action_target_refs_compatible_for_repair(
    action: &AgentQueueWorkflowActionRow,
    request: &NormalizedWorkflowEvidenceRequest,
    existing_binding: &Value,
) -> bool {
    if action.workspace_id != request.workspace_id
        || action.workflow_run_id != request.workflow_run_id
        || action.step_id != RECORD_WORKER_EVIDENCE_STEP_ID
        || action.action_type != RECORD_WORKER_EVIDENCE_ACTION_TYPE
    {
        return false;
    }
    let Some(target_refs) = parse_action_refs(action.target_refs_json.as_deref()) else {
        return action.idempotency_key == request.action_idempotency_key;
    };
    present_target_ref_matches(
        &target_refs,
        "workflowRunId",
        Some(request.workflow_run_id.as_str()),
    ) && present_target_ref_matches(&target_refs, "slot", Some(request.slot.as_str()))
        && present_target_ref_matches(
            &target_refs,
            "taskId",
            Some(request.worker.queue_item_id.as_str()),
        )
        && present_target_ref_matches(&target_refs, "runId", Some(request.worker.run_id.as_str()))
        && present_target_ref_matches(
            &target_refs,
            "settingsHash",
            string_field(existing_binding, "settingsHash"),
        )
        && present_target_ref_matches(
            &target_refs,
            "executionTargetHash",
            string_field(existing_binding, "executionTargetHash"),
        )
        && present_target_ref_matches(
            &target_refs,
            "executionTargetKind",
            string_field(existing_binding, "executionTargetKind"),
        )
        && present_target_ref_matches(
            &target_refs,
            "providerId",
            string_field(existing_binding, "providerId"),
        )
        && present_target_ref_matches(
            &target_refs,
            "queueOwnerWidgetInstanceId",
            string_field(existing_binding, "queueOwnerWidgetInstanceId"),
        )
        && present_target_ref_matches(
            &target_refs,
            "executorWidgetId",
            string_field(existing_binding, "executorWidgetId"),
        )
}

fn optional_target_ref_matches_binding(
    target_refs: &Map<String, Value>,
    existing_binding: &Value,
    field: &str,
) -> bool {
    match (
        action_string_field(target_refs, field),
        string_field(existing_binding, field),
    ) {
        (Some(target), Some(binding)) => target == binding,
        _ => true,
    }
}

fn present_target_ref_matches(
    target_refs: &Map<String, Value>,
    field: &str,
    expected: Option<&str>,
) -> bool {
    match action_string_field(target_refs, field) {
        Some(actual) => expected.is_some_and(|expected| actual == expected),
        None => true,
    }
}

fn target_refs_json(
    request: &NormalizedWorkflowEvidenceRequest,
    existing_binding: &Value,
) -> String {
    let mut refs = Map::new();
    refs.insert(
        "runId".to_owned(),
        Value::String(request.worker.run_id.clone()),
    );
    refs.insert("slot".to_owned(), Value::String(request.slot.clone()));
    refs.insert(
        "taskId".to_owned(),
        Value::String(request.worker.queue_item_id.clone()),
    );
    refs.insert(
        "workflowRunId".to_owned(),
        Value::String(request.workflow_run_id.clone()),
    );
    for field in [
        "settingsHash",
        "executionTargetHash",
        "executionTargetKind",
        "providerId",
        "queueOwnerWidgetInstanceId",
        "executorWidgetId",
    ] {
        if let Some(value) = string_field(existing_binding, field) {
            refs.insert(field.to_owned(), Value::String(value.to_owned()));
        }
    }
    canonical_json_string(&Value::Object(refs))
}

fn result_refs_json(
    evidence: &AgentQueueWorkerEvidenceBundleRow,
    worker_final_status: &str,
) -> String {
    canonical_json_string(&json!({
        "evidenceBundleId": evidence.bundle_id,
        "evidenceStatus": "available",
        "outcome": evidence.outcome,
        "runId": evidence.run_id,
        "workerFinalStatus": worker_final_status,
    }))
}

fn is_completed_worker_run_state(run_link: &AgentQueueTaskRunLinkRow) -> bool {
    run_link.completed_at.is_some()
        && matches!(
            AgentQueueTaskRunStatus::from_current_status(&run_link.status),
            AgentQueueTaskRunStatus::Completed
                | AgentQueueTaskRunStatus::Failed
                | AgentQueueTaskRunStatus::TimedOut
                | AgentQueueTaskRunStatus::Cancelled
                | AgentQueueTaskRunStatus::ReviewNeeded
        )
}

fn expected_worker_outcome_for_run_state(
    run_link: &AgentQueueTaskRunLinkRow,
) -> Option<&'static str> {
    match AgentQueueTaskRunStatus::from_current_status(&run_link.status) {
        AgentQueueTaskRunStatus::Completed => Some(AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED),
        AgentQueueTaskRunStatus::Failed | AgentQueueTaskRunStatus::TimedOut => {
            Some(AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED)
        }
        AgentQueueTaskRunStatus::Cancelled | AgentQueueTaskRunStatus::ReviewNeeded => {
            Some(AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_NOT_COMPLETED)
        }
        AgentQueueTaskRunStatus::Running | AgentQueueTaskRunStatus::Unknown => None,
    }
}

fn is_retryable_record_worker_evidence_action(action: &AgentQueueWorkflowActionRow) -> bool {
    if action_result_evidence_bundle_id(action).is_some() {
        return false;
    }
    let blocker = action.blocker_code.as_deref();
    let result_status = action_result_status(action);
    action.status == QueueWorkflowActionStatus::Blocked.as_str()
        && (blocker.is_some_and(is_retryable_record_worker_evidence_blocker)
            || blocker == Some("precondition_failed")
            || result_status.as_deref() == Some("precondition_failed"))
        || action.status == QueueWorkflowActionStatus::Failed.as_str()
            && (blocker == Some("failed_unexpected")
                || result_status.as_deref() == Some("failed_unexpected"))
}

pub(super) fn is_retryable_record_worker_evidence_blocker(code: &str) -> bool {
    matches!(
        code,
        "worker_outcome_mismatch"
            | "worker_run_not_complete"
            | "worker_run_state_mismatch"
            | "run_id_mismatch"
            | "task_id_mismatch"
            | "missing_run_id"
            | "missing_task_id"
            | "evidence_conflict"
            | "existing_evidence_mismatch"
            | "evidence_precondition_failed"
            | "recovered_run_ref_mismatch"
            | "missing_run_binding"
            | "run_missing"
            | "slot_run_mismatch"
            | "missing_task_binding"
            | "slot_task_mismatch"
            | "run_task_mismatch"
            | "ambiguous_task_slot_binding"
            | "missing_start_worker_result_refs"
            | "missing_start_worker_run_ref"
            | "missing_settings_hash"
            | "missing_execution_target_hash"
            | "workflow_run_terminal"
            | "incomplete_workflow_action_refs"
            | "precondition_failed"
    )
}

fn action_result_status(action: &AgentQueueWorkflowActionRow) -> Option<String> {
    let refs = parse_action_refs(action.result_refs_json.as_deref())?;
    action_string_field(&refs, "commandStatus").or_else(|| action_string_field(&refs, "status"))
}

fn action_result_evidence_bundle_id(action: &AgentQueueWorkflowActionRow) -> Option<String> {
    let refs = parse_action_refs(action.result_refs_json.as_deref())?;
    action_string_field(&refs, "evidenceBundleId")
}

fn evidence_matches_request(
    evidence: &AgentQueueWorkerEvidenceBundleRow,
    request: &NormalizedRecordAgentQueueWorkerFinishedInput,
    changed_files_json: &str,
) -> bool {
    evidence.workspace_id == request.workspace_id
        && evidence.queue_task_id == request.queue_item_id
        && evidence.run_id == request.run_id
        && evidence.outcome == request.outcome
        && evidence.summary == request.summary
        && evidence.changed_files_json == changed_files_json
        && evidence.changed_files_count == request.changed_files.len() as i64
        && evidence.changed_files_summary == request.changed_files_summary
        && evidence.validation_summary == request.validation_summary
        && evidence.error_summary == request.error_summary
        && evidence.worker_id == request.worker_id
        && evidence.source == request.source
        && evidence.metadata_json == request.metadata_json
}

fn worker_evidence_bundle_summary_for_tx(
    evidence: AgentQueueWorkerEvidenceBundleRow,
) -> Result<AgentQueueWorkerEvidenceBundleSummary, StorageError> {
    worker_evidence_bundle_summary(evidence).map_err(|error| {
        StorageError::InvalidParameterName(format!(
            "Queue workflow worker evidence summary could not be read: {error}"
        ))
    })
}

fn update_binding_with_evidence(
    slot_bindings: &mut Map<String, Value>,
    request: &NormalizedWorkflowEvidenceRequest,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
    action: &AgentQueueWorkflowActionRow,
    recorded_at: &str,
    worker_final_status: &str,
) {
    let binding = slot_bindings
        .entry(request.slot.clone())
        .or_insert_with(|| Value::Object(Map::new()));
    if !binding.is_object() {
        *binding = Value::Object(Map::new());
    }
    let object = binding.as_object_mut().expect("binding object");
    object.insert(
        "taskId".to_owned(),
        Value::String(request.worker.queue_item_id.clone()),
    );
    object.insert(
        "runId".to_owned(),
        Value::String(request.worker.run_id.clone()),
    );
    object.insert(
        "evidenceBundleId".to_owned(),
        Value::String(evidence.bundle_id.clone()),
    );
    object.insert(
        "evidenceActionId".to_owned(),
        Value::String(action.action_id.clone()),
    );
    object.insert(
        "evidenceActionIdempotencyKey".to_owned(),
        Value::String(request.action_idempotency_key.clone()),
    );
    object.insert(
        "evidenceRecordedAt".to_owned(),
        Value::String(recorded_at.to_owned()),
    );
    object.insert(
        "workerFinalStatus".to_owned(),
        Value::String(worker_final_status.to_owned()),
    );
    object.insert(
        "workerOutcome".to_owned(),
        Value::String(evidence.outcome.clone()),
    );
}

fn mutation_refs_json(
    existing: Option<&str>,
    request: &NormalizedWorkflowEvidenceRequest,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
) -> String {
    let mut object = parse_json_object(existing);
    object.insert(
        "recordWorkerEvidence".to_owned(),
        json!({
            "evidenceBundleId": evidence.bundle_id,
            "runId": evidence.run_id,
            "slot": request.slot,
            "taskId": evidence.queue_task_id,
        }),
    );
    canonical_json_string(&Value::Object(object))
}

fn variables_json(
    existing: Option<&str>,
    request: &NormalizedWorkflowEvidenceRequest,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
) -> String {
    let mut object = parse_json_object(existing);
    insert_slot_id(
        &mut object,
        "taskIdsBySlot",
        &request.slot,
        &request.worker.queue_item_id,
    );
    insert_slot_id(
        &mut object,
        "runIdsBySlot",
        &request.slot,
        &request.worker.run_id,
    );
    insert_slot_id(
        &mut object,
        "evidenceBundleIdsBySlot",
        &request.slot,
        &evidence.bundle_id,
    );
    canonical_json_string(&Value::Object(object))
}

fn idempotency_keys_json(existing: Option<&str>, action_key: &str) -> String {
    let mut values = match existing.and_then(|raw| serde_json::from_str::<Value>(raw).ok()) {
        Some(Value::Array(values)) => values,
        Some(Value::Object(mut object)) => match object.remove("recordWorkerEvidence") {
            Some(Value::Array(values)) => values,
            Some(Value::String(value)) => vec![Value::String(value)],
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };
    if !values
        .iter()
        .any(|value| value.as_str() == Some(action_key))
    {
        values.push(Value::String(action_key.to_owned()));
    }
    canonical_json_string(&Value::Array(values))
}

fn action_log_summary_json(
    existing: Option<&str>,
    request: &NormalizedWorkflowEvidenceRequest,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
    worker_final_status: &str,
) -> String {
    let mut object = parse_json_object(existing);
    object.insert(
        "recordWorkerEvidence".to_owned(),
        json!({
            "evidenceBundleId": evidence.bundle_id,
            "outcome": evidence.outcome,
            "runId": evidence.run_id,
            "slot": request.slot,
            "status": "evidence_recorded",
            "taskId": evidence.queue_task_id,
            "workerFinalStatus": worker_final_status,
        }),
    );
    canonical_json_string(&Value::Object(object))
}

fn insert_slot_id(object: &mut Map<String, Value>, key: &str, slot: &str, id: &str) {
    let entry = object
        .entry(key.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(Map::new());
    }
    entry
        .as_object_mut()
        .expect("slot id object")
        .insert(slot.to_owned(), Value::String(id.to_owned()));
}

fn parse_json_object(raw: Option<&str>) -> Map<String, Value> {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| match value {
            Value::Object(object) => Some(object),
            _ => None,
        })
        .unwrap_or_default()
}

fn bounded_json(json: String, max_bytes: usize, field: &str) -> Result<String, StorageError> {
    if json.len() > max_bytes {
        return Err(StorageError::InvalidParameterName(format!(
            "Queue workflow {field} exceeds the configured byte limit."
        )));
    }
    Ok(json)
}

fn evidence_identity_json(evidence: &AgentQueueWorkerEvidenceBundleRow) -> String {
    canonical_json_string(&json!({
        "changedFilesCount": evidence.changed_files_count,
        "changedFilesJson": evidence.changed_files_json,
        "changedFilesSummary": evidence.changed_files_summary,
        "errorSummary": evidence.error_summary,
        "metadataJson": evidence.metadata_json,
        "outcome": evidence.outcome,
        "source": evidence.source,
        "summary": evidence.summary,
        "validationSummary": evidence.validation_summary,
        "workerId": evidence.worker_id,
    }))
}

fn request_evidence_identity_json(
    request: &NormalizedRecordAgentQueueWorkerFinishedInput,
    changed_files_json: &str,
) -> String {
    canonical_json_string(&json!({
        "changedFilesCount": request.changed_files.len(),
        "changedFilesJson": changed_files_json,
        "changedFilesSummary": request.changed_files_summary,
        "errorSummary": request.error_summary,
        "metadataJson": request.metadata_json,
        "outcome": request.outcome,
        "source": request.source,
        "summary": request.summary,
        "validationSummary": request.validation_summary,
        "workerId": request.worker_id,
    }))
}

fn required(value: &str, field: &str) -> Result<String, QueueWorkflowCommandBlocker> {
    let value = value.trim();
    if value.is_empty() {
        return Err(blocker(
            &format!("missing_{field}"),
            &format!("{field} is required for Queue workflow evidence recording."),
            Some(field),
        ));
    }
    Ok(value.to_owned())
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn blocker(code: &str, message: &str, field: Option<&str>) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        missing_required_field: field.map(str::to_owned),
    }
}

fn conflict_result(
    workflow_run: hobit_storage_sqlite::AgentQueueWorkflowRunRow,
    code: &str,
    message: &str,
    existing: Option<String>,
    requested: Option<String>,
) -> QueueWorkflowRecordWorkerEvidenceResult {
    result(
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict,
        Some(QueueWorkflowRun::from(workflow_run.clone())),
        None,
        None,
        None,
        None,
        None,
        Some(QueueWorkflowConflict {
            conflict_code: code.to_owned(),
            conflict_message: message.to_owned(),
            existing_workflow_run_id: Some(workflow_run.workflow_run_id),
            existing_request_hash: existing,
            requested_request_hash: requested,
        }),
    )
}

#[allow(clippy::too_many_arguments)]
fn result(
    status: QueueWorkflowRecordWorkerEvidenceStatus,
    workflow_run: Option<QueueWorkflowRun>,
    action: Option<QueueWorkflowAction>,
    evidence_bundle: Option<AgentQueueWorkerEvidenceBundleSummary>,
    aggregate: Option<QueueItemAggregate>,
    binding: Option<QueueWorkflowWorkerEvidenceBindingSummary>,
    blocker: Option<QueueWorkflowCommandBlocker>,
    conflict: Option<QueueWorkflowConflict>,
) -> QueueWorkflowRecordWorkerEvidenceResult {
    QueueWorkflowRecordWorkerEvidenceResult {
        status,
        workflow_run,
        action,
        evidence_bundle,
        aggregate,
        binding,
        blocker,
        conflict,
    }
}
