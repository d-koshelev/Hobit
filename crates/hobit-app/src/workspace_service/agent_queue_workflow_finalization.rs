use hobit_storage_sqlite::{
    AgentQueueCompletionDecisionRow, AgentQueueFailureDecisionRow, AgentQueueReviewMessageRow,
    AgentQueueTaskRunLinkRow, AgentQueueWorkerEvidenceBundleRow, AgentQueueWorkflowActionRow,
    AgentQueueWorkflowActionUpdate, AgentQueueWorkflowRunReportUpdate, AgentQueueWorkflowRunRow,
    NewAgentQueueWorkflowAction, SqliteStore, StorageError,
};
use serde_json::{json, Map, Value};

use crate::WorkspaceServiceError;

#[path = "agent_queue_workflow_finalization_apply.rs"]
mod apply;
#[path = "agent_queue_workflow_finalization_apply_acceptance.rs"]
mod apply_acceptance;
#[path = "agent_queue_workflow_finalization_apply_failure.rs"]
mod apply_failure;
#[path = "agent_queue_workflow_finalization_apply_shared.rs"]
mod apply_shared;
#[path = "agent_queue_workflow_finalization_apply_state.rs"]
mod apply_state;
#[path = "agent_queue_workflow_finalization_plan.rs"]
mod plan;
#[path = "agent_queue_workflow_finalization_support.rs"]
mod support;

use apply::execute_finalization_step_resolution;
use plan::plan_from_finalization_resolution;
use support::*;

use super::{
    agent_queue_aggregate::REVIEW_MESSAGE_STATUS_ACKNOWLEDGED,
    agent_queue_tasks::map_storage_agent_queue_task_error,
    agent_queue_workflow::{
        canonical_json_string, QueueWorkflowAction, QueueWorkflowActionStatus,
        QueueWorkflowCommandBlocker, QueueWorkflowConflict, QueueWorkflowRun,
        QueueWorkflowRunStatus, MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES, MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES, MAX_WORKFLOW_VARIABLES_JSON_BYTES,
    },
    placeholder_id, placeholder_timestamp, QueueItemAggregate, WorkspaceService,
};

const FINALIZE_DONE_TRANSITION: &str = "finalize_done";
const FINALIZE_FAIL_TRANSITION: &str = "finalize_fail";
const MARK_DONE_ACTION_TYPE: &str = "queue.item.markDone";
const FAIL_ITEM_ACTION_TYPE: &str = "queue.item.fail";
const MARK_DONE_STEP_ID: &str = "finalization.mark_done";
const FAIL_ITEM_STEP_ID: &str = "finalization.fail";
const WORKFLOW_PHASE_FINALIZATION: &str = "finalization";
const WORKFLOW_PHASE_CLOSED: &str = "closed";
const WORKFLOW_STEP_FINALIZATION_COMPLETE: &str = "finalization_complete";
const CONFIRMATION_TOKEN: &str = "operator-confirmed";

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowFinalizationStepRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub slot: Option<String>,
    pub actor_id: Option<String>,
    pub request_id: Option<String>,
    pub grant_summary: Option<Value>,
    pub confirmation_token: Option<String>,
    pub failure_reason: Option<String>,
    pub expected_version: Option<i64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowFinalizationStepTransition {
    FinalizeDone,
    FinalizeFail,
}

impl QueueWorkflowFinalizationStepTransition {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FinalizeDone => FINALIZE_DONE_TRANSITION,
            Self::FinalizeFail => FINALIZE_FAIL_TRANSITION,
        }
    }

    fn action_type(self) -> &'static str {
        match self {
            Self::FinalizeDone => MARK_DONE_ACTION_TYPE,
            Self::FinalizeFail => FAIL_ITEM_ACTION_TYPE,
        }
    }

    fn step_id(self) -> &'static str {
        match self {
            Self::FinalizeDone => MARK_DONE_STEP_ID,
            Self::FinalizeFail => FAIL_ITEM_STEP_ID,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowFinalizationStepResultStatus {
    Executed,
    AlreadyApplied,
    BlockedPrecondition,
    InvalidInput,
    Conflict,
    FailedUnexpected,
}

impl QueueWorkflowFinalizationStepResultStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Executed => "executed",
            Self::AlreadyApplied => "already_applied",
            Self::BlockedPrecondition => "blocked_precondition",
            Self::InvalidInput => "invalid_input",
            Self::Conflict => "conflict",
            Self::FailedUnexpected => "failed_unexpected",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowFinalizationDownstreamVerification {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowFinalizationBindingSummary {
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

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowFinalizationStepPlan {
    pub workflow_run_id: String,
    pub workflow_id: Option<String>,
    pub persistent_status: Option<String>,
    pub phase: Option<String>,
    pub current_step: Option<String>,
    pub transition: QueueWorkflowFinalizationStepTransition,
    pub executable: bool,
    pub already_applied: bool,
    pub action_idempotency_key: Option<String>,
    pub target_refs: Option<Value>,
    pub existing_refs: Option<Value>,
    pub required_grant_classes: Vec<String>,
    pub confirmation_required: bool,
    pub confirmation_accepted: bool,
    pub failure_reason_required: bool,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub expected_next_status: Option<String>,
    pub expected_downstream_verification: Option<QueueWorkflowFinalizationDownstreamVerification>,
    pub retryable_failed_finalization_before_mutation: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowFinalizationStepResult {
    pub workflow_run_id: String,
    pub workflow_id: Option<String>,
    pub transition: QueueWorkflowFinalizationStepTransition,
    pub status: QueueWorkflowFinalizationStepResultStatus,
    pub action: Option<QueueWorkflowAction>,
    pub completion_decision_id: Option<String>,
    pub failure_decision_id: Option<String>,
    pub binding: Option<QueueWorkflowFinalizationBindingSummary>,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub downstream_verification: Option<QueueWorkflowFinalizationDownstreamVerification>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub terminal_status: Option<String>,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Debug)]
struct NormalizedFinalizationStepRequest {
    workspace_id: String,
    workflow_run_id: String,
    slot: String,
    actor_id: String,
    grant_summary: Option<Value>,
    confirmation_token: Option<String>,
    failure_reason: Option<String>,
    expected_version: Option<i64>,
}

#[derive(Clone, Debug)]
struct FinalizationStepResolution {
    request: NormalizedFinalizationStepRequest,
    workflow_run: AgentQueueWorkflowRunRow,
    slot_bindings: Map<String, Value>,
    task_id: String,
    run_id: String,
    evidence: AgentQueueWorkerEvidenceBundleRow,
    run_link: AgentQueueTaskRunLinkRow,
    review_message: AgentQueueReviewMessageRow,
    completion_decision: Option<AgentQueueCompletionDecisionRow>,
    failure_decision: Option<AgentQueueFailureDecisionRow>,
    action: Option<AgentQueueWorkflowActionRow>,
    action_idempotency_key: String,
    target_refs_json: String,
    transition: QueueWorkflowFinalizationStepTransition,
    downstream_verification: QueueWorkflowFinalizationDownstreamVerification,
    retryable_failed_finalization_before_mutation: bool,
}

#[derive(Clone, Debug)]
enum FinalizationStepResolveStatus {
    Ready(FinalizationStepResolution),
    Blocked {
        request: Option<NormalizedFinalizationStepRequest>,
        workflow_run: Option<AgentQueueWorkflowRunRow>,
        action: Option<AgentQueueWorkflowActionRow>,
        target_refs_json: Option<String>,
        transition: Option<QueueWorkflowFinalizationStepTransition>,
        blocker: QueueWorkflowCommandBlocker,
        retryable_failed_finalization_before_mutation: bool,
    },
    Conflict {
        workflow_run: Option<AgentQueueWorkflowRunRow>,
        action: Option<AgentQueueWorkflowActionRow>,
        transition: Option<QueueWorkflowFinalizationStepTransition>,
        conflict: QueueWorkflowConflict,
        blocker: Option<QueueWorkflowCommandBlocker>,
    },
    NotFound {
        request: NormalizedFinalizationStepRequest,
        blocker: QueueWorkflowCommandBlocker,
    },
    InvalidInput {
        workflow_run_id: String,
        transition: Option<QueueWorkflowFinalizationStepTransition>,
        blocker: QueueWorkflowCommandBlocker,
    },
}

impl WorkspaceService {
    pub fn plan_queue_workflow_finalization_step(
        &self,
        request: QueueWorkflowFinalizationStepRequest,
    ) -> Result<QueueWorkflowFinalizationStepPlan, WorkspaceServiceError> {
        let workflow_run_id = request.workflow_run_id.trim().to_owned();
        let resolution = self
            .store
            .with_immediate_transaction(|store| {
                resolve_queue_workflow_finalization_step(store, request, false)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(plan_from_finalization_resolution(
            &workflow_run_id,
            resolution,
        ))
    }

    pub fn execute_queue_workflow_finalization_step(
        &self,
        request: QueueWorkflowFinalizationStepRequest,
    ) -> Result<QueueWorkflowFinalizationStepResult, WorkspaceServiceError> {
        let resolution = self
            .store
            .with_immediate_transaction(|store| {
                resolve_queue_workflow_finalization_step(store, request, true)
            })
            .map_err(map_storage_agent_queue_task_error)?;
        execute_finalization_step_resolution(self, resolution)
    }
}

fn resolve_queue_workflow_finalization_step(
    store: &SqliteStore,
    request: QueueWorkflowFinalizationStepRequest,
    require_authority: bool,
) -> Result<FinalizationStepResolveStatus, StorageError> {
    let request = match normalize_finalization_step_request(request) {
        Ok(request) => request,
        Err(blocker) => {
            return Ok(FinalizationStepResolveStatus::InvalidInput {
                workflow_run_id: String::new(),
                transition: None,
                blocker,
            });
        }
    };

    let Some(workflow_run) =
        store.get_agent_queue_workflow_run(&request.workspace_id, &request.workflow_run_id)?
    else {
        return Ok(FinalizationStepResolveStatus::NotFound {
            request,
            blocker: blocker(
                "workflow_run_not_found",
                "Queue workflow run was not found.",
                Some("workflowRunId"),
            ),
        });
    };

    if let Some(expected_version) = request.expected_version {
        if workflow_run.version != expected_version {
            return Ok(conflict(
                Some(workflow_run.clone()),
                None,
                None,
                "workflow_version_conflict",
                "Queue workflow finalization expectedVersion does not match the durable workflow version.",
                Some(workflow_run.version.to_string()),
                Some(expected_version.to_string()),
            ));
        }
    }

    let transition = match workflow_run.workflow_id.as_str() {
        "dependency_acceptance_smoke" => QueueWorkflowFinalizationStepTransition::FinalizeDone,
        "dependency_failure_smoke" => QueueWorkflowFinalizationStepTransition::FinalizeFail,
        _ => {
            return Ok(blocked(
                request,
                Some(workflow_run),
                None,
                "unsupported_workflow",
                "Queue workflow finalization is supported only for dependency Queue workflows.",
                Some("workflowId"),
            ));
        }
    };

    if workflow_run.status == QueueWorkflowRunStatus::Cancelled.as_str() {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "workflow_run_cancelled",
            "Cancelled Queue workflow runs cannot execute finalization.",
            Some("status"),
        ));
    }

    let slot_bindings = match parse_slot_bindings(workflow_run.slot_bindings_json.as_deref()) {
        Ok(bindings) => bindings,
        Err(blocker) => {
            return Ok(FinalizationStepResolveStatus::InvalidInput {
                workflow_run_id: workflow_run.workflow_run_id,
                transition: Some(transition),
                blocker,
            });
        }
    };
    let Some(binding) = slot_bindings.get(&request.slot).cloned() else {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "missing_slot_binding",
            "Queue workflow finalization requires an existing upstream slot binding.",
            Some("slotBindings.upstream"),
        ));
    };
    let Some(task_id) = string_field(&binding, "taskId").map(str::to_owned) else {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "missing_task_binding",
            "Queue workflow finalization requires slotBindings.upstream.taskId.",
            Some("slotBindings.taskId"),
        ));
    };
    if store
        .get_agent_queue_task(&request.workspace_id, &task_id)?
        .is_none()
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "task_missing",
            "Queue workflow finalization task binding does not exist in the requested workspace.",
            Some("taskId"),
        ));
    }

    let resolved_facts = match resolve_finalization_facts(store, &request, &binding, &task_id)? {
        FinalizationFactLookup::Resolved(facts) => facts,
        FinalizationFactLookup::Blocked(blocker) => {
            return Ok(FinalizationStepResolveStatus::Blocked {
                request: Some(request),
                workflow_run: Some(workflow_run),
                action: None,
                target_refs_json: None,
                transition: Some(transition),
                blocker,
                retryable_failed_finalization_before_mutation: false,
            });
        }
        FinalizationFactLookup::Conflict(conflict, blocker) => {
            return Ok(FinalizationStepResolveStatus::Conflict {
                workflow_run: Some(workflow_run),
                action: None,
                transition: Some(transition),
                conflict,
                blocker: Some(blocker),
            });
        }
    };

    let completion_decision =
        store.get_latest_agent_queue_completion_decision(&request.workspace_id, &task_id)?;
    let failure_decision =
        store.get_latest_agent_queue_failure_decision(&request.workspace_id, &task_id)?;
    let already_applied = matching_decision(
        transition,
        completion_decision.as_ref(),
        failure_decision.as_ref(),
    )
    .is_some();
    if let Some(conflict_status) = decision_conflict_or_already_applied(
        Some(workflow_run.clone()),
        transition,
        completion_decision.as_ref(),
        failure_decision.as_ref(),
    ) {
        match conflict_status {
            DecisionState::Conflict(conflict, blocker) => {
                return Ok(FinalizationStepResolveStatus::Conflict {
                    workflow_run: Some(workflow_run),
                    action: None,
                    transition: Some(transition),
                    conflict,
                    blocker: Some(blocker),
                });
            }
            DecisionState::AlreadyApplied => {}
        }
    }

    let downstream_verification = downstream_verification(
        store,
        &request.workspace_id,
        &slot_bindings,
        &request.slot,
        transition,
    )?;
    if downstream_verification.verification_missing && require_authority && !already_applied {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "downstream_binding_missing",
            "Queue workflow finalization requires a downstream dependency binding to verify no auto-start.",
            Some("slotBindings.downstream.taskId"),
        ));
    }
    if !downstream_verification.verification_missing
        && !downstream_verification.not_auto_started_verified
        && !already_applied
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "downstream_already_started",
            "Queue workflow finalization cannot run when downstream work has already started.",
            Some("slotBindings.downstream.runId"),
        ));
    }

    let actions =
        store.list_agent_queue_workflow_actions(&request.workspace_id, &request.workflow_run_id)?;
    let retryable_failed_finalization_before_mutation = workflow_run.status
        == QueueWorkflowRunStatus::Failed.as_str()
        && is_retryable_finalization_failure_before_mutation(
            &workflow_run,
            &actions,
            &slot_bindings,
            &request.slot,
            completion_decision.as_ref(),
            failure_decision.as_ref(),
            &downstream_verification,
        );
    if workflow_run.status == QueueWorkflowRunStatus::Failed.as_str()
        && !retryable_failed_finalization_before_mutation
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "finalization_reentry_not_retryable",
            "Queue workflow finalization re-entry is allowed only for a proven finalization failure before durable decision mutation.",
            Some("workflowRunId"),
        ));
    }
    if !matches!(
        workflow_run.status.as_str(),
        "created" | "running" | "paused" | "blocked" | "failed" | "completed"
    ) {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "workflow_run_status_not_finalizable",
            "Queue workflow finalization cannot run from the current workflow status.",
            Some("status"),
        ));
    }
    if workflow_run.status == QueueWorkflowRunStatus::Completed.as_str()
        && matching_decision(
            transition,
            completion_decision.as_ref(),
            failure_decision.as_ref(),
        )
        .is_none()
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "workflow_completed_without_matching_decision",
            "Completed Queue workflow runs cannot re-enter finalization without the matching durable decision.",
            Some("status"),
        ));
    }
    if !matches!(
        workflow_run.phase.as_str(),
        "review" | "decision" | "finalization" | "closed"
    ) {
        return Ok(blocked(
            request,
            Some(workflow_run),
            Some(transition),
            "workflow_phase_not_finalizable",
            "Queue workflow finalization cannot run from the current workflow phase.",
            Some("phase"),
        ));
    }

    if transition == QueueWorkflowFinalizationStepTransition::FinalizeDone
        && request.failure_reason.is_some()
    {
        return Ok(FinalizationStepResolveStatus::InvalidInput {
            workflow_run_id: workflow_run.workflow_run_id,
            transition: Some(transition),
            blocker: blocker(
                "failure_reason_unsupported",
                "Accepted dependency finalization does not accept failureReason.",
                Some("failureReason"),
            ),
        });
    }
    if transition == QueueWorkflowFinalizationStepTransition::FinalizeFail
        && request.failure_reason.is_none()
    {
        return Ok(FinalizationStepResolveStatus::InvalidInput {
            workflow_run_id: workflow_run.workflow_run_id,
            transition: Some(transition),
            blocker: blocker(
                "failure_reason_missing",
                "Dependency failure finalization requires a typed non-empty failureReason.",
                Some("failureReason"),
            ),
        });
    }

    let action_idempotency_key = finalization_idempotency_key(
        &request.workflow_run_id,
        transition,
        &request.slot,
        &task_id,
    );
    let target_refs_json = canonical_json_string(&finalization_target_refs(
        &request,
        transition,
        &task_id,
        &resolved_facts.run_id,
        &resolved_facts.evidence.bundle_id,
        &resolved_facts.review_message.message_id,
    ));
    let action = store.get_agent_queue_workflow_action_by_idempotency_key(
        &request.workflow_run_id,
        &action_idempotency_key,
    )?;
    if let Some(action) = action.as_ref() {
        if action.target_refs_json.as_deref() != Some(target_refs_json.as_str()) {
            return Ok(conflict(
                Some(workflow_run),
                Some(action.clone()),
                Some(transition),
                "finalization_action_ref_conflict",
                "Existing Queue workflow finalization action has different typed refs.",
                action.target_refs_json.clone(),
                Some(target_refs_json),
            ));
        }
    }

    if require_authority
        && matching_decision(
            transition,
            completion_decision.as_ref(),
            failure_decision.as_ref(),
        )
        .is_none()
    {
        if let Some(blocker) = fresh_finalization_grant_blocker(request.grant_summary.as_ref()) {
            return Ok(FinalizationStepResolveStatus::Blocked {
                request: Some(request),
                workflow_run: Some(workflow_run),
                action,
                target_refs_json: Some(target_refs_json),
                transition: Some(transition),
                blocker,
                retryable_failed_finalization_before_mutation,
            });
        }
        if request.confirmation_token.as_deref() != Some(CONFIRMATION_TOKEN) {
            return Ok(FinalizationStepResolveStatus::InvalidInput {
                workflow_run_id: workflow_run.workflow_run_id,
                transition: Some(transition),
                blocker: blocker(
                    "fresh_confirmation_required",
                    "A fresh exact structured confirmationToken is required for Queue workflow finalization.",
                    Some("confirmationToken"),
                ),
            });
        }
    }

    Ok(FinalizationStepResolveStatus::Ready(
        FinalizationStepResolution {
            request,
            workflow_run,
            slot_bindings,
            task_id,
            run_id: resolved_facts.run_id,
            evidence: resolved_facts.evidence,
            run_link: resolved_facts.run_link,
            review_message: resolved_facts.review_message,
            completion_decision,
            failure_decision,
            action,
            action_idempotency_key,
            target_refs_json,
            transition,
            downstream_verification,
            retryable_failed_finalization_before_mutation,
        },
    ))
}
