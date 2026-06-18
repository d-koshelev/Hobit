use hobit_storage_sqlite::{
    AgentQueueReviewMessageAckUpdate, AgentQueueReviewMessageRow, NewAgentQueueReviewMessage,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_aggregate::{REVIEW_MESSAGE_STATUS_ACKNOWLEDGED, REVIEW_MESSAGE_STATUS_CREATED},
    placeholder_id, placeholder_timestamp,
    validation::required_input,
    QueueItemAggregate, QueueItemAggregateReviewState, QueueItemAggregateTicketState,
    WorkspaceService,
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

impl WorkspaceService {
    pub fn create_agent_queue_review_message(
        &self,
        input: CreateAgentQueueReviewMessageInput,
    ) -> Result<AgentQueueReviewCommandResult, WorkspaceServiceError> {
        let workspace_id = required_input(&input.workspace_id, "workspace id")?.to_owned();
        let queue_item_id = required_input(&input.queue_item_id, "queue item id")?.to_owned();
        let actor_id = required_input(&input.actor_id, "review actor id")?.to_owned();

        self.validate_queue_review_task_access(&workspace_id, &queue_item_id)?;
        let aggregate = self
            .get_queue_item_aggregate(&workspace_id, &queue_item_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue task not found: {queue_item_id}"
                ))
            })?;

        validate_create_review_message_precondition(&aggregate)?;

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

        self.build_review_command_result(&workspace_id, &queue_item_id, row)
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
    aggregate: &QueueItemAggregate,
) -> Result<(), WorkspaceServiceError> {
    if matches!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    ) && matches!(
        aggregate.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    ) {
        return Ok(());
    }

    Err(WorkspaceServiceError::InvalidInput(format!(
        "queue review message cannot be created while ticket_state={} review_state={}",
        aggregate.ticket_state.as_str(),
        aggregate.review_state.as_str()
    )))
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
