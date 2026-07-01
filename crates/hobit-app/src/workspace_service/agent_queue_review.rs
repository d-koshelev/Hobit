use hobit_storage_sqlite::{
    AgentQueueReviewMessageAckUpdate, AgentQueueReviewMessageRow,
    AgentQueueWorkerEvidenceBundleRow, NewAgentQueueReviewMessage,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_aggregate::{REVIEW_MESSAGE_STATUS_ACKNOWLEDGED, REVIEW_MESSAGE_STATUS_CREATED},
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    QueueItemAggregate, QueueItemAggregateEvidenceState, QueueItemAggregateReviewState,
    QueueItemAggregateTicketState, QueueItemAggregateWorkerRunState, WorkspaceService,
};

const DEFAULT_REVIEW_MESSAGE_BODY: &str =
    "Queue worker result is ready for explicit operator review.";
const REVIEW_MESSAGE_BODY_CAP: usize = 4_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateAgentQueueReviewMessageInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub actor_id: String,
    pub message_body: Option<String>,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AckAgentQueueReviewMessageInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub message_id: String,
    pub actor_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueReviewMessageSummary {
    pub message_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub actor_id: String,
    pub message_body: String,
    pub status: String,
    pub created_at: String,
    pub acked_at: Option<String>,
    pub ack_actor_id: Option<String>,
    pub metadata_json: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueReviewCommandResult {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub message_id: String,
    pub durable: bool,
    pub review_message: AgentQueueReviewMessageSummary,
    pub aggregate: QueueItemAggregate,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentQueueReviewCreateMessageStatus {
    Succeeded,
    Blocked,
    InvalidInput,
    AlreadyExists,
    PreconditionFailed,
}

impl AgentQueueReviewCreateMessageStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Succeeded => "succeeded",
            Self::Blocked => "blocked",
            Self::InvalidInput => "invalid_input",
            Self::AlreadyExists => "already_exists",
            Self::PreconditionFailed => "precondition_failed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueReviewCreateMessageBlocker {
    pub blocker_code: String,
    pub blocker_message: String,
    pub missing_required_field: Option<String>,
    pub task_id: String,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub run_id_required: bool,
    pub evidence_bundle_id_required: bool,
    pub durable_evidence_required: bool,
    pub review_message_already_exists: bool,
    pub existing_message_id: Option<String>,
    pub ticket_state: Option<String>,
    pub worker_run_state: Option<String>,
    pub review_state: Option<String>,
    pub evidence_state: Option<String>,
    pub next_suggested_capability: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueReviewCreateMessageResult {
    pub status: AgentQueueReviewCreateMessageStatus,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: Option<String>,
    pub evidence_bundle_id: Option<String>,
    pub message_id: Option<String>,
    pub durable: bool,
    pub review_message: Option<AgentQueueReviewMessageSummary>,
    pub aggregate: Option<QueueItemAggregate>,
    pub blocker: Option<AgentQueueReviewCreateMessageBlocker>,
}

impl WorkspaceService {
    pub fn create_agent_queue_review_message(
        &self,
        input: CreateAgentQueueReviewMessageInput,
    ) -> Result<AgentQueueReviewCreateMessageResult, WorkspaceServiceError> {
        let workspace_id = input.workspace_id.trim().to_owned();
        let queue_item_id = input.queue_item_id.trim().to_owned();
        let actor_id =
            optional_trimmed(input.actor_id).unwrap_or_else(|| "workspace-agent".to_owned());
        let requested_run_id = optional_trimmed_option(input.run_id);
        let requested_evidence_bundle_id = optional_trimmed_option(input.evidence_bundle_id);

        if workspace_id.is_empty() {
            return Ok(create_message_invalid_input(
                workspace_id,
                queue_item_id,
                "workspaceId",
                "workspaceId is required.",
            ));
        }
        if queue_item_id.is_empty() {
            return Ok(create_message_invalid_input(
                workspace_id,
                queue_item_id,
                "taskId",
                "taskId is required.",
            ));
        }

        if self.store.get_workspace(&workspace_id)?.is_none() {
            return Ok(create_message_blocked_without_aggregate(
                AgentQueueReviewCreateMessageStatus::InvalidInput,
                workspace_id,
                queue_item_id,
                "workspace_not_found",
                "Workspace was not found for queue.review.createMessage.",
                None,
            ));
        }
        let Some(task) = self.store.get_agent_queue_task_by_id(&queue_item_id)? else {
            return Ok(create_message_blocked_without_aggregate(
                AgentQueueReviewCreateMessageStatus::InvalidInput,
                workspace_id,
                queue_item_id,
                "task_not_found",
                "Queue task was not found for queue.review.createMessage.",
                Some("queue.items.list"),
            ));
        };
        if task.workspace_id != workspace_id {
            return Ok(create_message_blocked_without_aggregate(
                AgentQueueReviewCreateMessageStatus::InvalidInput,
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

        if let Some(blocked) = validate_create_review_message_precondition(
            &workspace_id,
            &queue_item_id,
            &aggregate,
            latest_evidence.as_ref(),
            latest_review_message.as_ref(),
            requested_run_id.as_deref(),
            requested_evidence_bundle_id.as_deref(),
        ) {
            return Ok(blocked);
        }

        let created_at = placeholder_timestamp();
        let message_id = placeholder_id("queue-review-message-");
        let message_body = review_message_body(input.message_body.as_deref(), &aggregate);
        let latest_run = aggregate.latest_run.as_ref();
        let row = self
            .store
            .insert_agent_queue_review_message(NewAgentQueueReviewMessage {
                message_id: &message_id,
                workspace_id: &workspace_id,
                queue_task_id: &queue_item_id,
                run_id: latest_run.map(|run| run.run_id.as_str()),
                run_link_id: latest_run.map(|run| run.run_link_id.as_str()),
                actor_id: &actor_id,
                message_body: &message_body,
                status: REVIEW_MESSAGE_STATUS_CREATED,
                created_at: Some(&created_at),
                acked_at: None,
                ack_actor_id: None,
                metadata_json: None,
                updated_at: Some(&created_at),
            })?;

        let command_result =
            self.build_review_command_result(&workspace_id, &queue_item_id, row)?;
        Ok(AgentQueueReviewCreateMessageResult {
            status: AgentQueueReviewCreateMessageStatus::Succeeded,
            workspace_id,
            queue_item_id,
            run_id: latest_evidence
                .as_ref()
                .map(|evidence| evidence.run_id.clone()),
            evidence_bundle_id: latest_evidence
                .as_ref()
                .map(|evidence| evidence.bundle_id.clone()),
            message_id: Some(command_result.message_id.clone()),
            durable: command_result.durable,
            review_message: Some(command_result.review_message),
            aggregate: Some(command_result.aggregate),
            blocker: None,
        })
    }

    pub fn ack_agent_queue_review_message(
        &self,
        input: AckAgentQueueReviewMessageInput,
    ) -> Result<AgentQueueReviewCommandResult, WorkspaceServiceError> {
        let workspace_id = required_input(&input.workspace_id, "workspace id")?.to_owned();
        let queue_item_id = required_input(&input.queue_item_id, "queue item id")?.to_owned();
        let message_id = required_input(&input.message_id, "review message id")?.to_owned();
        let actor_id = required_input(&input.actor_id, "review actor id")?.to_owned();

        self.validate_queue_review_task_access(&workspace_id, &queue_item_id)?;
        let aggregate = self
            .get_queue_item_aggregate(&workspace_id, &queue_item_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue task not found: {queue_item_id}"
                ))
            })?;
        validate_ack_review_precondition(&aggregate)?;

        let Some(existing_message) = self.store.get_agent_queue_review_message(
            &workspace_id,
            &queue_item_id,
            &message_id,
        )?
        else {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "queue review message not found: {message_id}"
            )));
        };
        if existing_message.status != REVIEW_MESSAGE_STATUS_CREATED {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "queue review message cannot be acknowledged from status {}",
                existing_message.status
            )));
        }

        let acked_at = placeholder_timestamp();
        let row = self
            .store
            .ack_agent_queue_review_message(
                &workspace_id,
                &queue_item_id,
                &message_id,
                AgentQueueReviewMessageAckUpdate {
                    actor_id: &actor_id,
                    status: REVIEW_MESSAGE_STATUS_ACKNOWLEDGED,
                    acked_at: Some(&acked_at),
                    updated_at: Some(&acked_at),
                },
            )?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue review message not found: {message_id}"
                ))
            })?;

        self.build_review_command_result(&workspace_id, &queue_item_id, row)
    }

    fn validate_queue_review_task_access(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }
        let Some(task) = self.store.get_agent_queue_task_by_id(queue_item_id)? else {
            return Ok(());
        };
        if task.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "queue task does not belong to workspace: {queue_item_id}"
            )));
        }

        Ok(())
    }

    fn build_review_command_result(
        &self,
        workspace_id: &str,
        queue_item_id: &str,
        row: AgentQueueReviewMessageRow,
    ) -> Result<AgentQueueReviewCommandResult, WorkspaceServiceError> {
        let aggregate = self
            .get_queue_item_aggregate(workspace_id, queue_item_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue task not found: {queue_item_id}"
                ))
            })?;

        Ok(AgentQueueReviewCommandResult {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            message_id: row.message_id.clone(),
            durable: true,
            review_message: AgentQueueReviewMessageSummary::from(row),
            aggregate,
        })
    }
}

impl From<AgentQueueReviewMessageRow> for AgentQueueReviewMessageSummary {
    fn from(row: AgentQueueReviewMessageRow) -> Self {
        Self {
            message_id: row.message_id,
            workspace_id: row.workspace_id,
            queue_item_id: row.queue_task_id,
            run_id: row.run_id,
            run_link_id: row.run_link_id,
            actor_id: row.actor_id,
            message_body: row.message_body,
            status: row.status,
            created_at: row.created_at,
            acked_at: row.acked_at,
            ack_actor_id: row.ack_actor_id,
            metadata_json: row.metadata_json,
            updated_at: row.updated_at,
        }
    }
}

fn validate_create_review_message_precondition(
    workspace_id: &str,
    queue_item_id: &str,
    aggregate: &QueueItemAggregate,
    latest_evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    requested_run_id: Option<&str>,
    requested_evidence_bundle_id: Option<&str>,
) -> Option<AgentQueueReviewCreateMessageResult> {
    if let Some(review_message) = latest_review_message {
        let next = if review_message.status == REVIEW_MESSAGE_STATUS_CREATED {
            Some("queue.review.ack")
        } else {
            Some("queue.lifecycle.get")
        };
        let message = if review_message.status == REVIEW_MESSAGE_STATUS_CREATED {
            "A Queue review message already exists and must be acknowledged before creating another."
        } else {
            "A Queue review message already exists for this Queue item."
        };
        return Some(create_message_blocked_from_aggregate(
            AgentQueueReviewCreateMessageStatus::AlreadyExists,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            Some(review_message),
            "review_message_already_exists",
            message,
            next,
            None,
        ));
    }

    if let Some(requested_run_id) = requested_run_id {
        if latest_evidence
            .map(|evidence| evidence.run_id.as_str())
            .is_some_and(|run_id| run_id != requested_run_id)
        {
            return Some(create_message_blocked_from_aggregate(
                AgentQueueReviewCreateMessageStatus::PreconditionFailed,
                workspace_id,
                queue_item_id,
                aggregate,
                latest_evidence,
                None,
                "run_id_mismatch",
                "The supplied runId does not match the latest durable worker evidence for this Queue task.",
                Some("queue.review.getEvidenceBundle"),
                None,
            ));
        }
    }

    if let Some(requested_evidence_bundle_id) = requested_evidence_bundle_id {
        if latest_evidence
            .map(|evidence| evidence.bundle_id.as_str())
            .is_some_and(|bundle_id| bundle_id != requested_evidence_bundle_id)
        {
            return Some(create_message_blocked_from_aggregate(
                AgentQueueReviewCreateMessageStatus::PreconditionFailed,
                workspace_id,
                queue_item_id,
                aggregate,
                latest_evidence,
                None,
                "evidence_bundle_id_mismatch",
                "The supplied evidenceBundleId does not match the latest durable worker evidence for this Queue task.",
                Some("queue.review.getEvidenceBundle"),
                None,
            ));
        }
    }

    if matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Running
    ) {
        return Some(create_message_blocked_from_aggregate(
            AgentQueueReviewCreateMessageStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            None,
            "worker_running",
            "The Queue worker run is still active; create a review message after durable worker evidence is available.",
            Some("queue.lifecycle.get"),
            None,
        ));
    }

    if matches!(aggregate.ticket_state, QueueItemAggregateTicketState::Draft) {
        return Some(create_message_blocked_from_aggregate(
            AgentQueueReviewCreateMessageStatus::PreconditionFailed,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            None,
            "task_is_draft",
            "Draft Queue tasks cannot create review messages.",
            Some("queue.item.updateRunSettings"),
            None,
        ));
    }

    if !matches!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Available
    ) || latest_evidence.is_none()
    {
        return Some(create_message_blocked_from_aggregate(
            AgentQueueReviewCreateMessageStatus::Blocked,
            workspace_id,
            queue_item_id,
            aggregate,
            latest_evidence,
            None,
            "durable_worker_evidence_required",
            "Durable worker evidence is required before queue.review.createMessage can create a review message.",
            if aggregate.latest_run.is_some() {
                Some("queue.lifecycle.agentFinished")
            } else {
                Some("queue.lifecycle.get")
            },
            None,
        ));
    }

    if matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    ) && matches!(
        aggregate.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    ) {
        return None;
    }

    let (code, message, next) = if matches!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Running
    ) {
        (
            "worker_running",
            "The Queue worker run is still active; create a review message after durable worker evidence is available.",
            Some("queue.lifecycle.get"),
        )
    } else if matches!(aggregate.ticket_state, QueueItemAggregateTicketState::Draft) {
        (
            "task_is_draft",
            "Draft Queue tasks cannot create review messages.",
            Some("queue.item.updateRunSettings"),
        )
    } else {
        (
            "review_precondition_failed",
            "Queue review message cannot be created from the current backend aggregate state.",
            Some("queue.lifecycle.get"),
        )
    };

    Some(create_message_blocked_from_aggregate(
        AgentQueueReviewCreateMessageStatus::PreconditionFailed,
        workspace_id,
        queue_item_id,
        aggregate,
        latest_evidence,
        None,
        code,
        message,
        next,
        None,
    ))
}

fn validate_ack_review_precondition(
    aggregate: &QueueItemAggregate,
) -> Result<(), WorkspaceServiceError> {
    if matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    ) && matches!(
        aggregate.review_state,
        QueueItemAggregateReviewState::ReviewMessageCreated
    ) {
        return Ok(());
    }

    Err(WorkspaceServiceError::InvalidInput(format!(
        "queue review message cannot be acknowledged while ticket_state={} review_state={}",
        aggregate.ticket_state.as_str(),
        aggregate.review_state.as_str()
    )))
}

fn create_message_invalid_input(
    workspace_id: String,
    queue_item_id: String,
    missing_required_field: &str,
    message: &str,
) -> AgentQueueReviewCreateMessageResult {
    AgentQueueReviewCreateMessageResult {
        status: AgentQueueReviewCreateMessageStatus::InvalidInput,
        workspace_id,
        queue_item_id: queue_item_id.clone(),
        run_id: None,
        evidence_bundle_id: None,
        message_id: None,
        durable: false,
        review_message: None,
        aggregate: None,
        blocker: Some(AgentQueueReviewCreateMessageBlocker {
            blocker_code: format!("missing_{}", missing_required_field),
            blocker_message: message.to_owned(),
            missing_required_field: Some(missing_required_field.to_owned()),
            task_id: queue_item_id,
            run_id: None,
            evidence_bundle_id: None,
            run_id_required: false,
            evidence_bundle_id_required: false,
            durable_evidence_required: true,
            review_message_already_exists: false,
            existing_message_id: None,
            ticket_state: None,
            worker_run_state: None,
            review_state: None,
            evidence_state: None,
            next_suggested_capability: None,
        }),
    }
}

fn create_message_blocked_without_aggregate(
    status: AgentQueueReviewCreateMessageStatus,
    workspace_id: String,
    queue_item_id: String,
    code: &str,
    message: &str,
    next_suggested_capability: Option<&str>,
) -> AgentQueueReviewCreateMessageResult {
    AgentQueueReviewCreateMessageResult {
        status,
        workspace_id,
        queue_item_id: queue_item_id.clone(),
        run_id: None,
        evidence_bundle_id: None,
        message_id: None,
        durable: false,
        review_message: None,
        aggregate: None,
        blocker: Some(AgentQueueReviewCreateMessageBlocker {
            blocker_code: code.to_owned(),
            blocker_message: message.to_owned(),
            missing_required_field: None,
            task_id: queue_item_id,
            run_id: None,
            evidence_bundle_id: None,
            run_id_required: false,
            evidence_bundle_id_required: false,
            durable_evidence_required: true,
            review_message_already_exists: false,
            existing_message_id: None,
            ticket_state: None,
            worker_run_state: None,
            review_state: None,
            evidence_state: None,
            next_suggested_capability: next_suggested_capability.map(str::to_owned),
        }),
    }
}

fn create_message_blocked_from_aggregate(
    status: AgentQueueReviewCreateMessageStatus,
    workspace_id: &str,
    queue_item_id: &str,
    aggregate: &QueueItemAggregate,
    latest_evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    code: &str,
    message: &str,
    next_suggested_capability: Option<&str>,
    missing_required_field: Option<&str>,
) -> AgentQueueReviewCreateMessageResult {
    let run_id = latest_evidence
        .map(|evidence| evidence.run_id.clone())
        .or_else(|| aggregate.latest_run.as_ref().map(|run| run.run_id.clone()));
    let evidence_bundle_id = latest_evidence.map(|evidence| evidence.bundle_id.clone());
    let existing_message_id = latest_review_message.map(|message| message.message_id.clone());

    AgentQueueReviewCreateMessageResult {
        status,
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        run_id: run_id.clone(),
        evidence_bundle_id: evidence_bundle_id.clone(),
        message_id: existing_message_id.clone(),
        durable: false,
        review_message: latest_review_message
            .cloned()
            .map(AgentQueueReviewMessageSummary::from),
        aggregate: Some(aggregate.clone()),
        blocker: Some(AgentQueueReviewCreateMessageBlocker {
            blocker_code: code.to_owned(),
            blocker_message: message.to_owned(),
            missing_required_field: missing_required_field.map(str::to_owned),
            task_id: queue_item_id.to_owned(),
            run_id,
            evidence_bundle_id,
            run_id_required: false,
            evidence_bundle_id_required: false,
            durable_evidence_required: true,
            review_message_already_exists: latest_review_message.is_some(),
            existing_message_id,
            ticket_state: Some(aggregate.ticket_state.as_str().to_owned()),
            worker_run_state: Some(aggregate.worker_run_state.as_str().to_owned()),
            review_state: Some(aggregate.review_state.as_str().to_owned()),
            evidence_state: Some(aggregate.evidence_state.as_str().to_owned()),
            next_suggested_capability: next_suggested_capability.map(str::to_owned),
        }),
    }
}

fn review_message_body(body: Option<&str>, aggregate: &QueueItemAggregate) -> String {
    body.and_then(non_empty_bounded)
        .or_else(|| {
            aggregate
                .evidence_summary
                .as_ref()
                .and_then(|summary| summary.summary.as_deref())
                .and_then(non_empty_bounded)
        })
        .unwrap_or_else(|| DEFAULT_REVIEW_MESSAGE_BODY.to_owned())
}

fn non_empty_bounded(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else if trimmed.len() <= REVIEW_MESSAGE_BODY_CAP {
        Some(trimmed.to_owned())
    } else {
        Some(trimmed.chars().take(REVIEW_MESSAGE_BODY_CAP).collect())
    }
}

fn optional_trimmed(value: String) -> Option<String> {
    let value = value.trim().to_owned();
    (!value.is_empty()).then_some(value)
}

fn optional_trimmed_option(value: Option<String>) -> Option<String> {
    value.and_then(optional_trimmed)
}
