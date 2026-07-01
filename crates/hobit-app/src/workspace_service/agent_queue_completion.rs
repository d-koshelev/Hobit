use hobit_storage_sqlite::{
    AgentQueueCompletionDecisionRow, AgentQueueReviewMessageRow, AgentQueueWorkerEvidenceBundleRow,
    NewAgentQueueCompletionDecision,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_aggregate::REVIEW_MESSAGE_STATUS_ACKNOWLEDGED,
    agent_queue_worker_evidence::AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED, placeholder_id,
    placeholder_timestamp, QueueItemAggregate, QueueItemAggregateDependencyState,
    QueueItemAggregateEvidenceState, QueueItemAggregateReviewState, QueueItemAggregateTicketState,
    QueueItemAggregateWorkerRunState, WorkspaceService,
};

pub const AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN: &str = "operator-confirmed";
pub const AGENT_QUEUE_COMPLETION_DECISION_ACCEPTED: &str = "accepted";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarkAgentQueueItemDoneInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub actor_id: String,
    pub confirmation_token: String,
    pub reason: Option<String>,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueCompletionDecisionSummary {
    pub decision_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub review_message_id: Option<String>,
    pub actor_id: String,
    pub decision: String,
    pub reason: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentQueueCompletionCommandStatus {
    Succeeded,
    Blocked,
    InvalidInput,
    AlreadyDone,
    PreconditionFailed,
}

impl AgentQueueCompletionCommandStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Succeeded => "succeeded",
            Self::Blocked => "blocked",
            Self::InvalidInput => "invalid_input",
            Self::AlreadyDone => "already_done",
            Self::PreconditionFailed => "precondition_failed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueCompletionCommandBlocker {
    pub blocker_code: String,
    pub blocker_message: String,
    pub missing_required_field: Option<String>,
    pub task_id: String,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub ticket_state: Option<String>,
    pub worker_run_state: Option<String>,
    pub review_state: Option<String>,
    pub evidence_state: Option<String>,
    pub validation_state: Option<String>,
    pub commit_state: Option<String>,
    pub dependency_state: Option<String>,
    pub next_suggested_capability: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueCompletionCommandResult {
    pub status: AgentQueueCompletionCommandStatus,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: Option<String>,
    pub review_message_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub decision_id: Option<String>,
    pub durable: bool,
    pub completion_decision: Option<AgentQueueCompletionDecisionSummary>,
    pub aggregate: Option<QueueItemAggregate>,
    pub blocker: Option<AgentQueueCompletionCommandBlocker>,
}

impl WorkspaceService {
    pub fn mark_agent_queue_item_done(
        &self,
        input: MarkAgentQueueItemDoneInput,
    ) -> Result<AgentQueueCompletionCommandResult, WorkspaceServiceError> {
        let workspace_id = input.workspace_id.trim().to_owned();
        let queue_item_id = input.queue_item_id.trim().to_owned();
        let actor_id = optional_trimmed(input.actor_id);
        let confirmation_token = optional_trimmed(input.confirmation_token);
        let reason = optional_trimmed_option(input.reason);
        let requested_run_id = optional_trimmed_option(input.run_id);
        let requested_review_message_id = optional_trimmed_option(input.review_message_id);

        if workspace_id.is_empty() {
            return Ok(completion_invalid_input(
                workspace_id,
                queue_item_id,
                "workspaceId",
                "workspaceId is required.",
            ));
        }
        if queue_item_id.is_empty() {
            return Ok(completion_invalid_input(
                workspace_id,
                queue_item_id,
                "taskId",
                "taskId is required.",
            ));
        }
        let Some(actor_id) = actor_id else {
            return Ok(completion_invalid_input(
                workspace_id,
                queue_item_id,
                "actorId",
                "actorId is required.",
            ));
        };
        if confirmation_token.as_deref() != Some(AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN)
        {
            return Ok(completion_invalid_input(
                workspace_id,
                queue_item_id,
                "confirmationToken",
                "Exact structured confirmationToken is required.",
            ));
        }

        if self.store.get_workspace(&workspace_id)?.is_none() {
            return Ok(completion_blocked_without_aggregate(
                AgentQueueCompletionCommandStatus::InvalidInput,
                workspace_id,
                queue_item_id,
                "workspace_not_found",
                "Workspace was not found for queue.item.markDone.",
                None,
            ));
        }
        let Some(task) = self.store.get_agent_queue_task_by_id(&queue_item_id)? else {
            return Ok(completion_blocked_without_aggregate(
                AgentQueueCompletionCommandStatus::InvalidInput,
                workspace_id,
                queue_item_id,
                "task_not_found",
                "Queue task was not found for queue.item.markDone.",
                Some("queue.items.list"),
            ));
        };
        if task.workspace_id != workspace_id {
            return Ok(completion_blocked_without_aggregate(
                AgentQueueCompletionCommandStatus::InvalidInput,
                workspace_id,
                queue_item_id,
                "task_workspace_mismatch",
                "Queue task does not belong to the requested workspace.",
                Some("queue.items.list"),
            ));
        }

        let aggregate = self
            .get_queue_item_aggregate(&workspace_id, &queue_item_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue task not found: {queue_item_id}"
                ))
            })?;
        let latest_evidence = self
            .store
            .get_latest_agent_queue_worker_evidence_bundle(&workspace_id, &queue_item_id)?;
        let latest_review_message = self
            .store
            .get_latest_agent_queue_review_message(&workspace_id, &queue_item_id)?;
        let latest_completion = self
            .store
            .get_latest_agent_queue_completion_decision(&workspace_id, &queue_item_id)?;

        if let Some(existing) = latest_completion {
            let refreshed = self.get_queue_item_aggregate(&workspace_id, &queue_item_id)?;
            return Ok(completion_already_done(
                &workspace_id,
                &queue_item_id,
                Some(existing),
                refreshed,
            ));
        }

        if let Some(blocked) = validate_mark_done_precondition(
            &workspace_id,
            &queue_item_id,
            &aggregate,
            latest_evidence.as_ref(),
            latest_review_message.as_ref(),
            requested_run_id.as_deref(),
            requested_review_message_id.as_deref(),
        ) {
            return Ok(blocked);
        }

        let evidence = latest_evidence.expect("validated evidence");
        let review_message = latest_review_message.expect("validated review message");
        let created_at = placeholder_timestamp();
        let decision_id = placeholder_id("queue-completion-decision-");
        let row = self
            .store
            .with_immediate_transaction(|store| {
                let row = store.insert_agent_queue_completion_decision(
                    NewAgentQueueCompletionDecision {
                        decision_id: &decision_id,
                        workspace_id: &workspace_id,
                        queue_task_id: &queue_item_id,
                        run_id: Some(&evidence.run_id),
                        run_link_id: evidence.run_link_id.as_deref(),
                        review_message_id: Some(&review_message.message_id),
                        actor_id: &actor_id,
                        decision: AGENT_QUEUE_COMPLETION_DECISION_ACCEPTED,
                        reason: reason.as_deref(),
                        metadata_json: None,
                        created_at: Some(&created_at),
                    },
                )?;
                store.touch_workspace(&workspace_id)?;
                Ok(row)
            })
            .map_err(super::agent_queue_tasks::map_storage_agent_queue_task_error)?;
        let refreshed = self
            .get_queue_item_aggregate(&workspace_id, &queue_item_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue task not found: {queue_item_id}"
                ))
            })?;
        let summary = AgentQueueCompletionDecisionSummary::from(row);

        Ok(AgentQueueCompletionCommandResult {
            status: AgentQueueCompletionCommandStatus::Succeeded,
            workspace_id,
            queue_item_id,
            run_id: summary.run_id.clone(),
            review_message_id: summary.review_message_id.clone(),
            evidence_bundle_id: Some(evidence.bundle_id),
            decision_id: Some(summary.decision_id.clone()),
            durable: true,
            completion_decision: Some(summary),
            aggregate: Some(refreshed),
            blocker: None,
        })
    }
}

impl From<AgentQueueCompletionDecisionRow> for AgentQueueCompletionDecisionSummary {
    fn from(row: AgentQueueCompletionDecisionRow) -> Self {
        Self {
            decision_id: row.decision_id,
            workspace_id: row.workspace_id,
            queue_item_id: row.queue_task_id,
            run_id: row.run_id,
            run_link_id: row.run_link_id,
            review_message_id: row.review_message_id,
            actor_id: row.actor_id,
            decision: row.decision,
            reason: row.reason,
            metadata_json: row.metadata_json,
            created_at: row.created_at,
        }
    }
}

fn validate_mark_done_precondition(
    workspace_id: &str,
    queue_item_id: &str,
    aggregate: &QueueItemAggregate,
    latest_evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    requested_run_id: Option<&str>,
    requested_review_message_id: Option<&str>,
) -> Option<AgentQueueCompletionCommandResult> {
    if matches!(aggregate.ticket_state, QueueItemAggregateTicketState::Draft) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::PreconditionFailed,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            latest_review_message,
            "task_is_draft",
            "Draft Queue tasks cannot be marked done.",
            Some("queue.item.updateRunSettings"),
            None,
        ));
    }

    if matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Queued | QueueItemAggregateTicketState::Blocked
    ) && matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::NotStarted
            | QueueItemAggregateWorkerRunState::Starting
            | QueueItemAggregateWorkerRunState::Unavailable
    ) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            latest_review_message,
            "worker_not_started",
            "Queue worker completion evidence is required before queue.item.markDone.",
            Some("queue.item.startRun"),
            None,
        ));
    }

    if matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Running
    ) || matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Running
    ) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            latest_review_message,
            "worker_running",
            "Queue worker run is still active; accepted completion cannot be recorded.",
            Some("queue.lifecycle.get"),
            None,
        ));
    }

    if matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Failure
    ) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::PreconditionFailed,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            latest_review_message,
            "task_failed",
            "Failed Queue tasks cannot be marked done.",
            Some("queue.lifecycle.get"),
            None,
        ));
    }

    match aggregate.dependency_state {
        QueueItemAggregateDependencyState::Waiting => {
            return Some(completion_blocked_from_aggregate(
                AgentQueueCompletionCommandStatus::Blocked,
                workspace_id,
                queue_item_id,
                aggregate,
                latest_evidence,
                latest_review_message,
                "dependency_waiting",
                "Queue task dependencies must reach accepted completion first.",
                Some("queue.lifecycle.get"),
                None,
            ));
        }
        QueueItemAggregateDependencyState::Blocked => {
            return Some(completion_blocked_from_aggregate(
                AgentQueueCompletionCommandStatus::Blocked,
                workspace_id,
                queue_item_id,
                aggregate,
                latest_evidence,
                latest_review_message,
                "dependency_blocked",
                "Queue task dependencies are blocked.",
                Some("queue.lifecycle.get"),
                None,
            ));
        }
        QueueItemAggregateDependencyState::FailedUpstream => {
            return Some(completion_blocked_from_aggregate(
                AgentQueueCompletionCommandStatus::PreconditionFailed,
                workspace_id,
                queue_item_id,
                aggregate,
                latest_evidence,
                latest_review_message,
                "dependency_failed",
                "At least one Queue task dependency failed before accepted completion.",
                Some("queue.lifecycle.get"),
                None,
            ));
        }
        QueueItemAggregateDependencyState::Unknown => {
            return Some(completion_blocked_from_aggregate(
                AgentQueueCompletionCommandStatus::Blocked,
                workspace_id,
                queue_item_id,
                aggregate,
                latest_evidence,
                latest_review_message,
                "dependency_unknown",
                "Queue task dependency state is unknown.",
                Some("queue.lifecycle.get"),
                None,
            ));
        }
        QueueItemAggregateDependencyState::None | QueueItemAggregateDependencyState::Ready => {}
    }

    let Some(evidence) = latest_evidence else {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            None,
            latest_review_message,
            "durable_worker_evidence_required",
            "Durable worker evidence is required before queue.item.markDone.",
            Some("queue.lifecycle.agentFinished"),
            None,
        ));
    };

    if evidence.outcome != AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::PreconditionFailed,
            workspace_id,
            queue_item_id,
            aggregate,
            Some(evidence),
            latest_review_message,
            "worker_outcome_not_completed",
            "Only completed worker evidence can be accepted as done.",
            Some("queue.lifecycle.get"),
            None,
        ));
    }

    if let Some(requested_run_id) = requested_run_id {
        if evidence.run_id != requested_run_id {
            return Some(completion_blocked_from_aggregate(
                AgentQueueCompletionCommandStatus::PreconditionFailed,
                workspace_id,
                queue_item_id,
                aggregate,
                Some(evidence),
                latest_review_message,
                "run_id_mismatch",
                "The supplied runId does not match the latest durable worker evidence for this Queue task.",
                Some("queue.review.getEvidenceBundle"),
                None,
            ));
        }
    }

    let Some(review_message) = latest_review_message else {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            Some(evidence),
            None,
            "review_message_required",
            "A backend review message must exist before queue.item.markDone.",
            Some("queue.review.createMessage"),
            None,
        ));
    };

    if let Some(requested_review_message_id) = requested_review_message_id {
        if review_message.message_id != requested_review_message_id {
            return Some(completion_blocked_from_aggregate(
                AgentQueueCompletionCommandStatus::PreconditionFailed,
                workspace_id,
                queue_item_id,
                aggregate,
                Some(evidence),
                Some(review_message),
                "review_message_id_mismatch",
                "The supplied reviewMessageId does not match the latest backend review message for this Queue task.",
                Some("queue.lifecycle.get"),
                None,
            ));
        }
    }

    if review_message.status != REVIEW_MESSAGE_STATUS_ACKNOWLEDGED {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            Some(evidence),
            Some(review_message),
            "review_not_acked",
            "The backend review message must be ACKed before queue.item.markDone.",
            Some("queue.review.ack"),
            None,
        ));
    }

    if !matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    ) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::PreconditionFailed,
            workspace_id,
            queue_item_id,
            aggregate,
            Some(evidence),
            Some(review_message),
            "worker_not_completed",
            "Queue worker state must be completed before queue.item.markDone.",
            Some("queue.lifecycle.get"),
            None,
        ));
    }

    if !matches!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Available
    ) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            Some(evidence),
            Some(review_message),
            "durable_worker_evidence_required",
            "Durable worker evidence is required before queue.item.markDone.",
            Some("queue.lifecycle.agentFinished"),
            None,
        ));
    }

    if !matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::InReview
    ) || !matches!(
        aggregate.review_state,
        QueueItemAggregateReviewState::InReview
    ) {
        return Some(completion_blocked_from_aggregate(
            AgentQueueCompletionCommandStatus::PreconditionFailed,
            workspace_id,
            queue_item_id,
            aggregate,
            Some(evidence),
            Some(review_message),
            "accepted_completion_precondition_failed",
            "queue.item.markDone requires backend aggregate state in_review with ACKed durable review evidence.",
            Some("queue.lifecycle.get"),
            None,
        ));
    }

    None
}

fn completion_invalid_input(
    workspace_id: String,
    queue_item_id: String,
    missing_required_field: &str,
    message: &str,
) -> AgentQueueCompletionCommandResult {
    AgentQueueCompletionCommandResult {
        status: AgentQueueCompletionCommandStatus::InvalidInput,
        workspace_id,
        queue_item_id: queue_item_id.clone(),
        run_id: None,
        review_message_id: None,
        evidence_bundle_id: None,
        decision_id: None,
        durable: false,
        completion_decision: None,
        aggregate: None,
        blocker: Some(AgentQueueCompletionCommandBlocker {
            blocker_code: format!("missing_{}", missing_required_field),
            blocker_message: message.to_owned(),
            missing_required_field: Some(missing_required_field.to_owned()),
            task_id: queue_item_id,
            run_id: None,
            review_message_id: None,
            evidence_bundle_id: None,
            ticket_state: None,
            worker_run_state: None,
            review_state: None,
            evidence_state: None,
            validation_state: None,
            commit_state: None,
            dependency_state: None,
            next_suggested_capability: None,
        }),
    }
}

fn completion_blocked_without_aggregate(
    status: AgentQueueCompletionCommandStatus,
    workspace_id: String,
    queue_item_id: String,
    code: &str,
    message: &str,
    next_suggested_capability: Option<&str>,
) -> AgentQueueCompletionCommandResult {
    AgentQueueCompletionCommandResult {
        status,
        workspace_id,
        queue_item_id: queue_item_id.clone(),
        run_id: None,
        review_message_id: None,
        evidence_bundle_id: None,
        decision_id: None,
        durable: false,
        completion_decision: None,
        aggregate: None,
        blocker: Some(AgentQueueCompletionCommandBlocker {
            blocker_code: code.to_owned(),
            blocker_message: message.to_owned(),
            missing_required_field: None,
            task_id: queue_item_id,
            run_id: None,
            review_message_id: None,
            evidence_bundle_id: None,
            ticket_state: None,
            worker_run_state: None,
            review_state: None,
            evidence_state: None,
            validation_state: None,
            commit_state: None,
            dependency_state: None,
            next_suggested_capability: next_suggested_capability.map(str::to_owned),
        }),
    }
}

fn completion_already_done(
    workspace_id: &str,
    queue_item_id: &str,
    decision: Option<AgentQueueCompletionDecisionRow>,
    aggregate: Option<QueueItemAggregate>,
) -> AgentQueueCompletionCommandResult {
    let summary = decision.map(AgentQueueCompletionDecisionSummary::from);
    AgentQueueCompletionCommandResult {
        status: AgentQueueCompletionCommandStatus::AlreadyDone,
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        run_id: summary
            .as_ref()
            .and_then(|decision| decision.run_id.clone()),
        review_message_id: summary
            .as_ref()
            .and_then(|decision| decision.review_message_id.clone()),
        evidence_bundle_id: None,
        decision_id: summary
            .as_ref()
            .map(|decision| decision.decision_id.clone()),
        durable: summary.is_some(),
        completion_decision: summary,
        aggregate,
        blocker: None,
    }
}

fn completion_blocked_from_aggregate(
    status: AgentQueueCompletionCommandStatus,
    workspace_id: &str,
    queue_item_id: &str,
    aggregate: &QueueItemAggregate,
    latest_evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    code: &str,
    message: &str,
    next_suggested_capability: Option<&str>,
    missing_required_field: Option<&str>,
) -> AgentQueueCompletionCommandResult {
    let run_id = latest_evidence
        .map(|evidence| evidence.run_id.clone())
        .or_else(|| aggregate.latest_run.as_ref().map(|run| run.run_id.clone()));
    let review_message_id = latest_review_message.map(|message| message.message_id.clone());
    let evidence_bundle_id = latest_evidence.map(|evidence| evidence.bundle_id.clone());

    AgentQueueCompletionCommandResult {
        status,
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        run_id: run_id.clone(),
        review_message_id: review_message_id.clone(),
        evidence_bundle_id: evidence_bundle_id.clone(),
        decision_id: None,
        durable: false,
        completion_decision: None,
        aggregate: Some(aggregate.clone()),
        blocker: Some(AgentQueueCompletionCommandBlocker {
            blocker_code: code.to_owned(),
            blocker_message: message.to_owned(),
            missing_required_field: missing_required_field.map(str::to_owned),
            task_id: queue_item_id.to_owned(),
            run_id,
            review_message_id,
            evidence_bundle_id,
            ticket_state: Some(aggregate.ticket_state.as_str().to_owned()),
            worker_run_state: Some(aggregate.worker_run_state.as_str().to_owned()),
            review_state: Some(aggregate.review_state.as_str().to_owned()),
            evidence_state: Some(aggregate.evidence_state.as_str().to_owned()),
            validation_state: Some(aggregate.validation_state.as_str().to_owned()),
            commit_state: Some(aggregate.commit_state.as_str().to_owned()),
            dependency_state: Some(aggregate.dependency_state.as_str().to_owned()),
            next_suggested_capability: next_suggested_capability.map(str::to_owned),
        }),
    }
}

fn optional_trimmed(value: String) -> Option<String> {
    let value = value.trim().to_owned();
    (!value.is_empty()).then_some(value)
}

fn optional_trimmed_option(value: Option<String>) -> Option<String> {
    value.and_then(optional_trimmed)
}
