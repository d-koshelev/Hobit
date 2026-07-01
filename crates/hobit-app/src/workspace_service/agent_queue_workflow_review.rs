use hobit_storage_sqlite::{
    AgentQueueReviewMessageAckUpdate, AgentQueueReviewMessageRow, AgentQueueTaskRunLinkRow,
    AgentQueueWorkerEvidenceBundleRow, AgentQueueWorkflowActionRow, AgentQueueWorkflowActionUpdate,
    AgentQueueWorkflowRunReportUpdate, AgentQueueWorkflowRunRow, NewAgentQueueReviewMessage,
    NewAgentQueueWorkflowAction, SqliteStore, StorageError,
};
use serde_json::{json, Map, Value};

use crate::WorkspaceServiceError;

#[path = "agent_queue_workflow_review_apply.rs"]
mod apply;
#[path = "agent_queue_workflow_review_support.rs"]
mod support;

use apply::{execute_review_step_resolution, plan_from_review_resolution};
use support::*;

use super::{
    agent_queue_aggregate::{REVIEW_MESSAGE_STATUS_ACKNOWLEDGED, REVIEW_MESSAGE_STATUS_CREATED},
    agent_queue_tasks::map_storage_agent_queue_task_error,
    agent_queue_workflow::{
        canonical_json_string, QueueWorkflowAction, QueueWorkflowActionStatus,
        QueueWorkflowCommandBlocker, QueueWorkflowConflict, QueueWorkflowRun,
        QueueWorkflowRunStatus, MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES, MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES, MAX_WORKFLOW_VARIABLES_JSON_BYTES,
    },
    placeholder_id, placeholder_timestamp, WorkspaceService,
};

const CREATE_REVIEW_ACTION_TYPE: &str = "queue.review.createMessage";
const ACK_REVIEW_ACTION_TYPE: &str = "queue.review.ack";
const CREATE_REVIEW_STEP_ID: &str = "review.create";
const ACK_REVIEW_STEP_ID: &str = "review.ack";
const REVIEW_TRANSITION: &str = "review";
const WORKFLOW_PHASE_REVIEW: &str = "review";
const WORKFLOW_STEP_AWAITING_FINALIZATION: &str = "awaiting_finalization";
const PAUSE_REASON_AWAITING_FINALIZATION: &str = "awaiting_finalization";
const DEFAULT_REVIEW_MESSAGE_BODY: &str =
    "Queue worker result is ready for explicit operator review.";

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowReviewStepRequest {
    pub workspace_id: String,
    pub workflow_run_id: String,
    pub slot: Option<String>,
    pub actor_id: Option<String>,
    pub request_id: Option<String>,
    pub grant_summary: Option<Value>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowReviewStepTransition {
    Review,
}

impl QueueWorkflowReviewStepTransition {
    pub fn as_str(self) -> &'static str {
        REVIEW_TRANSITION
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueWorkflowReviewStepResultStatus {
    Executed,
    AlreadyApplied,
    BlockedPrecondition,
    InvalidInput,
    Conflict,
    NotFound,
    FailedUnexpected,
}

impl QueueWorkflowReviewStepResultStatus {
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
pub struct QueueWorkflowReviewBindingSummary {
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

#[derive(Clone, Debug, PartialEq)]
pub struct QueueWorkflowReviewStepPlan {
    pub workflow_run_id: String,
    pub workflow_id: Option<String>,
    pub persistent_status: Option<String>,
    pub phase: Option<String>,
    pub current_step: Option<String>,
    pub transition: QueueWorkflowReviewStepTransition,
    pub executable: bool,
    pub next_actions: Vec<String>,
    pub target_refs: Option<Value>,
    pub existing_refs: Option<Value>,
    pub required_fresh_grant: bool,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub expected_next_phase_on_success: Option<String>,
    pub expected_next_step_on_success: Option<String>,
    pub retryable_failed_review_before_mutation: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueWorkflowReviewStepResult {
    pub workflow_run_id: String,
    pub transition: QueueWorkflowReviewStepTransition,
    pub status: QueueWorkflowReviewStepResultStatus,
    pub create_action: Option<QueueWorkflowAction>,
    pub ack_action: Option<QueueWorkflowAction>,
    pub message_id: Option<String>,
    pub ack_status: Option<String>,
    pub binding: Option<QueueWorkflowReviewBindingSummary>,
    pub workflow_run: Option<QueueWorkflowRun>,
    pub next_phase: Option<String>,
    pub next_step: Option<String>,
    pub blockers: Vec<QueueWorkflowCommandBlocker>,
    pub conflict: Option<QueueWorkflowConflict>,
}

#[derive(Clone, Debug)]
struct NormalizedReviewStepRequest {
    workspace_id: String,
    workflow_run_id: String,
    slot: String,
    actor_id: String,
    grant_summary: Option<Value>,
}

#[derive(Clone, Debug)]
struct ReviewStepResolution {
    request: NormalizedReviewStepRequest,
    workflow_run: AgentQueueWorkflowRunRow,
    slot_bindings: Map<String, Value>,
    task_id: String,
    run_id: String,
    evidence: AgentQueueWorkerEvidenceBundleRow,
    run_link: AgentQueueTaskRunLinkRow,
    existing_message: Option<AgentQueueReviewMessageRow>,
    create_action: Option<AgentQueueWorkflowActionRow>,
    ack_action: Option<AgentQueueWorkflowActionRow>,
    create_idempotency_key: String,
    ack_idempotency_key: Option<String>,
    create_target_refs_json: String,
    ack_target_refs_json: Option<String>,
    retryable_failed_review_before_mutation: bool,
}

#[derive(Clone, Debug)]
enum ReviewStepResolveStatus {
    Ready(ReviewStepResolution),
    Blocked {
        request: Option<NormalizedReviewStepRequest>,
        workflow_run: Option<AgentQueueWorkflowRunRow>,
        create_action: Option<AgentQueueWorkflowActionRow>,
        ack_action: Option<AgentQueueWorkflowActionRow>,
        target_refs_json: Option<String>,
        blocker: QueueWorkflowCommandBlocker,
        retryable_failed_review_before_mutation: bool,
    },
    Conflict {
        workflow_run: Option<AgentQueueWorkflowRunRow>,
        create_action: Option<AgentQueueWorkflowActionRow>,
        ack_action: Option<AgentQueueWorkflowActionRow>,
        conflict: QueueWorkflowConflict,
        blocker: Option<QueueWorkflowCommandBlocker>,
    },
    NotFound {
        request: NormalizedReviewStepRequest,
        blocker: QueueWorkflowCommandBlocker,
    },
    InvalidInput {
        workflow_run_id: String,
        blocker: QueueWorkflowCommandBlocker,
    },
}

impl WorkspaceService {
    pub fn plan_queue_workflow_review_step(
        &self,
        request: QueueWorkflowReviewStepRequest,
    ) -> Result<QueueWorkflowReviewStepPlan, WorkspaceServiceError> {
        let workflow_run_id = request.workflow_run_id.trim().to_owned();
        let resolution = self
            .store
            .with_immediate_transaction(|store| {
                resolve_queue_workflow_review_step(store, request, false)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        Ok(plan_from_review_resolution(&workflow_run_id, resolution))
    }

    pub fn execute_queue_workflow_review_step(
        &self,
        request: QueueWorkflowReviewStepRequest,
    ) -> Result<QueueWorkflowReviewStepResult, WorkspaceServiceError> {
        self.store
            .with_immediate_transaction(|store| {
                let resolution = resolve_queue_workflow_review_step(store, request, true)?;
                execute_review_step_resolution(store, resolution)
            })
            .map_err(map_storage_agent_queue_task_error)
    }
}

fn resolve_queue_workflow_review_step(
    store: &SqliteStore,
    request: QueueWorkflowReviewStepRequest,
    require_fresh_grant: bool,
) -> Result<ReviewStepResolveStatus, StorageError> {
    let request = match normalize_review_step_request(request) {
        Ok(request) => request,
        Err(blocker) => {
            return Ok(ReviewStepResolveStatus::InvalidInput {
                workflow_run_id: String::new(),
                blocker,
            });
        }
    };

    let Some(workflow_run) =
        store.get_agent_queue_workflow_run(&request.workspace_id, &request.workflow_run_id)?
    else {
        return Ok(ReviewStepResolveStatus::NotFound {
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
        return Ok(blocked(
            request,
            Some(workflow_run),
            "unsupported_workflow",
            "Queue workflow review is currently supported only for dependency Queue workflows.",
            Some("workflowId"),
        ));
    }
    if workflow_run.status == QueueWorkflowRunStatus::Completed.as_str()
        || workflow_run.status == QueueWorkflowRunStatus::Cancelled.as_str()
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "workflow_run_terminal",
            "Completed and cancelled Queue workflow runs cannot execute review.",
            Some("status"),
        ));
    }

    let slot_bindings = match parse_slot_bindings(workflow_run.slot_bindings_json.as_deref()) {
        Ok(bindings) => bindings,
        Err(blocker) => {
            return Ok(ReviewStepResolveStatus::InvalidInput {
                workflow_run_id: workflow_run.workflow_run_id,
                blocker,
            });
        }
    };
    let Some(binding) = slot_bindings.get(&request.slot).cloned() else {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "missing_slot_binding",
            "Queue workflow review requires an existing upstream slot binding.",
            Some("slotBindings.upstream"),
        ));
    };
    let Some(task_id) = string_field(&binding, "taskId").map(str::to_owned) else {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "missing_task_binding",
            "Queue workflow review requires slotBindings.upstream.taskId.",
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
            "task_missing",
            "Queue workflow review task binding does not exist in the requested workspace.",
            Some("taskId"),
        ));
    }

    let evidence = match evidence_for_binding(store, &request.workspace_id, &task_id, &binding)? {
        EvidenceLookup::Found(evidence) => evidence,
        EvidenceLookup::Blocked(blocker) => {
            return Ok(ReviewStepResolveStatus::Blocked {
                request: Some(request),
                workflow_run: Some(workflow_run),
                create_action: None,
                ack_action: None,
                target_refs_json: None,
                blocker,
                retryable_failed_review_before_mutation: false,
            });
        }
        EvidenceLookup::Conflict(conflict, blocker) => {
            return Ok(ReviewStepResolveStatus::Conflict {
                workflow_run: Some(workflow_run),
                create_action: None,
                ack_action: None,
                conflict,
                blocker: Some(blocker),
            });
        }
    };

    let run_id = evidence.run_id.clone();
    if let Some(bound_run_id) = string_field(&binding, "runId") {
        if bound_run_id != run_id {
            return Ok(conflict(
                Some(workflow_run),
                None,
                None,
                "review_run_mismatch",
                "Queue workflow review runId does not match the durable evidence runId.",
                Some(bound_run_id.to_owned()),
                Some(run_id),
            ));
        }
    }

    let Some(run_link) =
        store.get_agent_queue_task_run_link_by_run_id(&request.workspace_id, &run_id)?
    else {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "run_missing",
            "Queue workflow review runId was not found in the requested workspace.",
            Some("runId"),
        ));
    };
    if run_link.queue_task_id != task_id {
        return Ok(conflict(
            Some(workflow_run),
            None,
            None,
            "review_run_task_mismatch",
            "Queue workflow review runId belongs to a different Queue task.",
            Some(run_link.queue_task_id),
            Some(task_id),
        ));
    }
    if evidence
        .run_link_id
        .as_deref()
        .is_some_and(|link_id| link_id != run_link.link_id.as_str())
    {
        return Ok(conflict(
            Some(workflow_run),
            None,
            None,
            "review_evidence_run_link_mismatch",
            "Queue workflow review evidence runLinkId does not match the durable run link.",
            evidence.run_link_id.clone(),
            Some(run_link.link_id),
        ));
    }

    if store
        .get_latest_agent_queue_completion_decision(&request.workspace_id, &task_id)?
        .is_some()
        || store
            .get_latest_agent_queue_failure_decision(&request.workspace_id, &task_id)?
            .is_some()
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "terminal_decision_exists",
            "Queue workflow review cannot run after a task completion or failure decision exists.",
            Some("taskId"),
        ));
    }
    if downstream_has_started(store, &request.workspace_id, &slot_bindings, &request.slot)? {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "downstream_already_started",
            "Queue workflow review cannot run when downstream work has already started.",
            Some("slotBindings.downstream.runId"),
        ));
    }

    let review_messages =
        store.list_agent_queue_review_messages(&request.workspace_id, &task_id)?;
    let existing_message = match review_message_for_binding(&binding, &review_messages, &run_id) {
        ReviewMessageLookup::Found(message) => message,
        ReviewMessageLookup::Blocked(blocker) => {
            return Ok(ReviewStepResolveStatus::Blocked {
                request: Some(request),
                workflow_run: Some(workflow_run),
                create_action: None,
                ack_action: None,
                target_refs_json: None,
                blocker,
                retryable_failed_review_before_mutation: false,
            });
        }
        ReviewMessageLookup::Conflict(conflict, blocker) => {
            return Ok(ReviewStepResolveStatus::Conflict {
                workflow_run: Some(workflow_run),
                create_action: None,
                ack_action: None,
                conflict,
                blocker: Some(blocker),
            });
        }
    };

    let actions =
        store.list_agent_queue_workflow_actions(&request.workspace_id, &request.workflow_run_id)?;
    let retryable_failed_review_before_mutation =
        workflow_run.status == QueueWorkflowRunStatus::Failed.as_str();
    if retryable_failed_review_before_mutation
        && !is_retryable_review_failure_before_mutation(
            &workflow_run,
            &actions,
            &slot_bindings,
            &request.slot,
            &review_messages,
        )
    {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "review_reentry_not_retryable",
            "Queue workflow review re-entry is allowed only for a proven review failure before durable review mutation.",
            Some("workflowRunId"),
        ));
    }

    if !matches!(
        workflow_run.status.as_str(),
        "created" | "running" | "paused" | "blocked" | "failed"
    ) {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "workflow_run_status_not_reviewable",
            "Queue workflow review cannot run from the current workflow status.",
            Some("status"),
        ));
    }
    if !matches!(
        workflow_run.phase.as_str(),
        "worker_evidence" | "review" | "decision" | "finalization"
    ) {
        return Ok(blocked(
            request,
            Some(workflow_run),
            "workflow_phase_not_reviewable",
            "Queue workflow review cannot run from the current workflow phase.",
            Some("phase"),
        ));
    }

    let create_idempotency_key = create_review_idempotency_key(
        &request.workflow_run_id,
        &request.slot,
        &task_id,
        &run_id,
        &evidence.bundle_id,
    );
    let create_target_refs_json = canonical_json_string(&review_target_refs(
        &request,
        &task_id,
        &run_id,
        &evidence.bundle_id,
    ));
    let create_action = store.get_agent_queue_workflow_action_by_idempotency_key(
        &request.workflow_run_id,
        &create_idempotency_key,
    )?;
    if let Some(action) = create_action.as_ref() {
        if !action_target_refs_match(action.target_refs_json.as_deref(), &create_target_refs_json) {
            return Ok(conflict(
                Some(workflow_run),
                create_action.clone(),
                None,
                "create_review_message_action_ref_conflict",
                "Existing Queue workflow create-review action has different typed refs.",
                action.target_refs_json.clone(),
                Some(create_target_refs_json),
            ));
        }
        if action_result_message_id(action).is_some()
            && existing_message.as_ref().is_none_or(|message| {
                Some(message.message_id.as_str()) != action_result_message_id(action).as_deref()
            })
        {
            return Ok(blocked(
                request,
                Some(workflow_run),
                "create_review_message_action_state_unknown",
                "Existing create-review action contains message refs that do not match durable review state.",
                Some("createReviewMessage.resultRefs.messageId"),
            ));
        }
    }

    let (ack_idempotency_key, ack_target_refs_json, ack_action) = if let Some(message) =
        existing_message.as_ref()
    {
        let key = ack_review_idempotency_key(
            &request.workflow_run_id,
            &request.slot,
            &message.message_id,
        );
        let target = canonical_json_string(&json!({
            "messageId": message.message_id,
            "slot": request.slot,
            "taskId": task_id,
            "workflowRunId": request.workflow_run_id,
        }));
        let action = store
            .get_agent_queue_workflow_action_by_idempotency_key(&request.workflow_run_id, &key)?;
        if let Some(action) = action.as_ref() {
            if !action_target_refs_match(action.target_refs_json.as_deref(), &target) {
                return Ok(conflict(
                    Some(workflow_run),
                    create_action,
                    Some(action.clone()),
                    "ack_review_message_action_ref_conflict",
                    "Existing Queue workflow ACK-review action has different typed refs.",
                    action.target_refs_json.clone(),
                    Some(target),
                ));
            }
        }
        (Some(key), Some(target), action)
    } else {
        (None, None, None)
    };

    if require_fresh_grant {
        if let Some(blocker) = fresh_review_grant_blocker(request.grant_summary.as_ref()) {
            return Ok(ReviewStepResolveStatus::Blocked {
                request: Some(request),
                workflow_run: Some(workflow_run),
                create_action,
                ack_action,
                target_refs_json: Some(create_target_refs_json),
                blocker,
                retryable_failed_review_before_mutation,
            });
        }
    }

    Ok(ReviewStepResolveStatus::Ready(ReviewStepResolution {
        request,
        workflow_run,
        slot_bindings,
        task_id,
        run_id,
        evidence,
        run_link,
        existing_message,
        create_action,
        ack_action,
        create_idempotency_key,
        ack_idempotency_key,
        create_target_refs_json,
        ack_target_refs_json,
        retryable_failed_review_before_mutation,
    }))
}
