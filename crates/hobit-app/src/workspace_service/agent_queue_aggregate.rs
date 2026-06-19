use std::collections::HashMap;

use hobit_storage_sqlite::{
    AgentQueueCompletionDecisionRow, AgentQueueReviewMessageRow, AgentQueueTaskRow,
    AgentQueueTaskRunLinkRow, AgentQueueWorkerEvidenceBundleRow, WidgetRunRow,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_lifecycle::{
        AGENT_QUEUE_TASK_STATUS_CANCELLED, AGENT_QUEUE_TASK_STATUS_COMPLETED,
        AGENT_QUEUE_TASK_STATUS_DRAFT, AGENT_QUEUE_TASK_STATUS_FAILED,
        AGENT_QUEUE_TASK_STATUS_QUEUED, AGENT_QUEUE_TASK_STATUS_READY,
        AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED, AGENT_QUEUE_TASK_STATUS_RUNNING,
    },
    agent_queue_tasks::{load_agent_queue_task, map_storage_agent_queue_task_error},
    validation::required_input,
    WorkspaceService,
};

const RUN_STATUS_RUNNING: &str = "running";
const RUN_STATUS_COMPLETED: &str = "completed";
const RUN_STATUS_FAILED: &str = "failed";
const RUN_STATUS_TIMED_OUT: &str = "timed_out";
const RUN_STATUS_CANCELLED: &str = "cancelled";
const RUN_STATUS_REVIEW_NEEDED: &str = "review_needed";
const REVIEW_STATUS_REVIEW_NEEDED: &str = "review_needed";
pub(super) const REVIEW_MESSAGE_STATUS_CREATED: &str = "created";
pub(super) const REVIEW_MESSAGE_STATUS_ACKNOWLEDGED: &str = "acknowledged";
const SUMMARY_CAP: usize = 500;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateTicketState {
    Draft,
    Queued,
    Blocked,
    Running,
    AwaitingReview,
    InReview,
    Done,
    Failure,
    Unknown,
}

impl QueueItemAggregateTicketState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Queued => "queued",
            Self::Blocked => "blocked",
            Self::Running => "running",
            Self::AwaitingReview => "awaiting_review",
            Self::InReview => "in_review",
            Self::Done => "done",
            Self::Failure => "failure",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateWorkerRunState {
    NotStarted,
    Starting,
    Running,
    Completed,
    Failed,
    Cancelled,
    Unavailable,
    Unknown,
}

impl QueueItemAggregateWorkerRunState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotStarted => "not_started",
            Self::Starting => "starting",
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::Unavailable => "unavailable",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateReviewState {
    None,
    AwaitingReview,
    ReviewMessageCreated,
    InReview,
    Approved,
    FollowupRequested,
    Done,
    Failed,
    NotDurable,
    Unknown,
}

impl QueueItemAggregateReviewState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::AwaitingReview => "awaiting_review",
            Self::ReviewMessageCreated => "review_message_created",
            Self::InReview => "in_review",
            Self::Approved => "approved",
            Self::FollowupRequested => "followup_requested",
            Self::Done => "done",
            Self::Failed => "failed",
            Self::NotDurable => "not_durable",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateEvidenceState {
    None,
    Pending,
    Available,
    Invalid,
    NotDurable,
    Unknown,
}

impl QueueItemAggregateEvidenceState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Pending => "pending",
            Self::Available => "available",
            Self::Invalid => "invalid",
            Self::NotDurable => "not_durable",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateValidationState {
    NotRequested,
    Requested,
    Running,
    Passed,
    Failed,
    ApprovedPlaceholder,
    Unknown,
}

impl QueueItemAggregateValidationState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotRequested => "not_requested",
            Self::Requested => "requested",
            Self::Running => "running",
            Self::Passed => "passed",
            Self::Failed => "failed",
            Self::ApprovedPlaceholder => "approved_placeholder",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateCommitState {
    None,
    Requested,
    Approved,
    Committed,
    Failed,
    Unknown,
}

impl QueueItemAggregateCommitState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Requested => "requested",
            Self::Approved => "approved",
            Self::Committed => "committed",
            Self::Failed => "failed",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum QueueItemAggregateDependencyState {
    None,
    Waiting,
    Blocked,
    Ready,
    FailedUpstream,
    Unknown,
}

impl QueueItemAggregateDependencyState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Waiting => "waiting",
            Self::Blocked => "blocked",
            Self::Ready => "ready",
            Self::FailedUpstream => "failed_upstream",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregateRunSettings {
    pub execution_policy: String,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
    pub assigned_executor_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregateLatestRun {
    pub run_link_id: String,
    pub run_id: String,
    pub executor_widget_id: String,
    pub status: String,
    pub source: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub validation_status: Option<String>,
    pub review_status: Option<String>,
    pub final_detail_available: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregateEvidenceSummary {
    pub available: bool,
    pub source: String,
    pub summary: Option<String>,
    pub not_durable_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregateBlocker {
    pub code: String,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregateNextAction {
    pub code: String,
    pub label: String,
    pub available: bool,
    pub unavailable_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregateDurableFlags {
    pub task_row: bool,
    pub latest_run_link: bool,
    pub dependency_state: bool,
    pub review_state: bool,
    pub evidence_state: bool,
    pub validation_state: bool,
    pub commit_state: bool,
    pub completion_state: bool,
    pub frontend_overlay_used: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueueItemAggregate {
    pub task_id: String,
    pub workspace_id: String,
    pub title: String,
    pub ticket_state: QueueItemAggregateTicketState,
    pub worker_run_state: QueueItemAggregateWorkerRunState,
    pub review_state: QueueItemAggregateReviewState,
    pub evidence_state: QueueItemAggregateEvidenceState,
    pub validation_state: QueueItemAggregateValidationState,
    pub commit_state: QueueItemAggregateCommitState,
    pub dependency_state: QueueItemAggregateDependencyState,
    pub run_settings: QueueItemAggregateRunSettings,
    pub latest_run: Option<QueueItemAggregateLatestRun>,
    pub evidence_summary: Option<QueueItemAggregateEvidenceSummary>,
    pub blockers: Vec<QueueItemAggregateBlocker>,
    pub next_actions: Vec<QueueItemAggregateNextAction>,
    pub durable_flags: QueueItemAggregateDurableFlags,
    pub updated_at: String,
}

impl WorkspaceService {
    pub fn list_queue_item_aggregates(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<QueueItemAggregate>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;

        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let tasks = self.store.list_agent_queue_tasks(workspace_id)?;
        let mut latest_links = HashMap::new();
        let mut latest_review_messages = HashMap::new();
        let mut latest_evidence_bundles = HashMap::new();
        let mut latest_completion_decisions = HashMap::new();
        let mut widget_runs = HashMap::new();

        for task in &tasks {
            let latest_link = self
                .store
                .get_latest_agent_queue_task_run_link(workspace_id, &task.queue_item_id)?;
            let latest_review_message = self
                .store
                .get_latest_agent_queue_review_message(workspace_id, &task.queue_item_id)?;
            let latest_evidence_bundle = self
                .store
                .get_latest_agent_queue_worker_evidence_bundle(workspace_id, &task.queue_item_id)?;
            let latest_completion_decision = self
                .store
                .get_latest_agent_queue_completion_decision(workspace_id, &task.queue_item_id)?;
            if let Some(link) = latest_link {
                let widget_run = self.store.get_widget_run(&link.direct_work_run_id)?;
                if let Some(run) = widget_run {
                    widget_runs.insert(link.direct_work_run_id.clone(), run);
                }
                latest_links.insert(task.queue_item_id.clone(), link);
            }
            if let Some(message) = latest_review_message {
                latest_review_messages.insert(task.queue_item_id.clone(), message);
            }
            if let Some(evidence_bundle) = latest_evidence_bundle {
                latest_evidence_bundles.insert(task.queue_item_id.clone(), evidence_bundle);
            }
            if let Some(completion_decision) = latest_completion_decision {
                latest_completion_decisions.insert(task.queue_item_id.clone(), completion_decision);
            }
        }

        Ok(build_queue_item_aggregates(
            tasks,
            latest_links,
            latest_review_messages,
            latest_evidence_bundles,
            latest_completion_decisions,
            widget_runs,
        ))
    }

    pub fn get_queue_item_aggregate(
        &self,
        workspace_id: &str,
        task_id: &str,
    ) -> Result<Option<QueueItemAggregate>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let task_id = required_input(task_id, "queue item id")?;

        self.validate_queue_item_aggregate_access(workspace_id, task_id)?;
        let Some(task) = self.store.get_agent_queue_task(workspace_id, task_id)? else {
            return Ok(None);
        };
        let all_tasks = self.store.list_agent_queue_tasks(workspace_id)?;
        let latest_link = self
            .store
            .get_latest_agent_queue_task_run_link(workspace_id, task_id)?;
        let latest_review_message = self
            .store
            .get_latest_agent_queue_review_message(workspace_id, task_id)?;
        let latest_evidence_bundle = self
            .store
            .get_latest_agent_queue_worker_evidence_bundle(workspace_id, task_id)?;
        let latest_completion_decision = self
            .store
            .get_latest_agent_queue_completion_decision(workspace_id, task_id)?;
        let mut completion_decisions = HashMap::new();
        for candidate in &all_tasks {
            if let Some(decision) = self.store.get_latest_agent_queue_completion_decision(
                workspace_id,
                &candidate.queue_item_id,
            )? {
                completion_decisions.insert(candidate.queue_item_id.clone(), decision);
            }
        }
        let widget_run = latest_link
            .as_ref()
            .and_then(|link| self.store.get_widget_run(&link.direct_work_run_id).ok())
            .flatten();

        Ok(Some(build_queue_item_aggregate(
            &task,
            &all_tasks,
            &completion_decisions,
            latest_link.as_ref(),
            latest_review_message.as_ref(),
            latest_evidence_bundle.as_ref(),
            latest_completion_decision.as_ref(),
            widget_run.as_ref(),
        )))
    }

    fn validate_queue_item_aggregate_access(
        &self,
        workspace_id: &str,
        task_id: &str,
    ) -> Result<(), WorkspaceServiceError> {
        if self.store.get_workspace(workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {workspace_id}"
            )));
        }

        let Some(task) = self.store.get_agent_queue_task_by_id(task_id)? else {
            return Ok(());
        };
        if task.workspace_id != workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "queue task does not belong to workspace: {task_id}"
            )));
        }

        Ok(())
    }
}

pub(super) fn build_queue_item_aggregates(
    tasks: Vec<AgentQueueTaskRow>,
    latest_links: HashMap<String, AgentQueueTaskRunLinkRow>,
    latest_review_messages: HashMap<String, AgentQueueReviewMessageRow>,
    latest_evidence_bundles: HashMap<String, AgentQueueWorkerEvidenceBundleRow>,
    latest_completion_decisions: HashMap<String, AgentQueueCompletionDecisionRow>,
    widget_runs: HashMap<String, WidgetRunRow>,
) -> Vec<QueueItemAggregate> {
    tasks
        .iter()
        .map(|task| {
            let latest_link = latest_links.get(&task.queue_item_id);
            let latest_review_message = latest_review_messages.get(&task.queue_item_id);
            let latest_evidence_bundle = latest_evidence_bundles.get(&task.queue_item_id);
            let latest_completion_decision = latest_completion_decisions.get(&task.queue_item_id);
            let widget_run = latest_link.and_then(|link| widget_runs.get(&link.direct_work_run_id));
            build_queue_item_aggregate(
                task,
                &tasks,
                &latest_completion_decisions,
                latest_link,
                latest_review_message,
                latest_evidence_bundle,
                latest_completion_decision,
                widget_run,
            )
        })
        .collect()
}

fn build_queue_item_aggregate(
    task: &AgentQueueTaskRow,
    all_tasks: &[AgentQueueTaskRow],
    completion_decisions: &HashMap<String, AgentQueueCompletionDecisionRow>,
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    latest_evidence_bundle: Option<&AgentQueueWorkerEvidenceBundleRow>,
    latest_completion_decision: Option<&AgentQueueCompletionDecisionRow>,
    widget_run: Option<&WidgetRunRow>,
) -> QueueItemAggregate {
    // Raw task.status is a legacy storage input. This builder folds it together
    // with durable run-link data and never reads frontend lifecycle overlays.
    let worker_run_state = worker_run_state(task, latest_link);
    let dependency_state = dependency_state(task, all_tasks, completion_decisions);
    let ticket_state = ticket_state(
        task,
        latest_link,
        latest_review_message,
        latest_completion_decision,
        worker_run_state,
        dependency_state,
    );
    let review_state = review_state(
        task,
        latest_link,
        latest_review_message,
        latest_completion_decision,
        ticket_state,
    );
    let evidence_state = evidence_state(latest_link, latest_evidence_bundle, ticket_state);
    let validation_state = validation_state(latest_link);
    let commit_state = QueueItemAggregateCommitState::None;
    let run_settings = run_settings(task);
    let latest_run = latest_link.map(|link| latest_run(link, widget_run, latest_evidence_bundle));
    let evidence_summary = evidence_summary(
        latest_link,
        latest_evidence_bundle,
        widget_run,
        evidence_state,
        ticket_state,
    );
    let blockers = blockers(task, ticket_state, dependency_state);
    let next_actions = next_actions(
        task,
        ticket_state,
        review_state,
        dependency_state,
        &blockers,
    );
    let durable_flags = durable_flags(
        latest_link,
        review_state,
        evidence_state,
        validation_state,
        commit_state,
        latest_completion_decision,
    );

    QueueItemAggregate {
        task_id: task.queue_item_id.clone(),
        workspace_id: task.workspace_id.clone(),
        title: task.title.clone(),
        ticket_state,
        worker_run_state,
        review_state,
        evidence_state,
        validation_state,
        commit_state,
        dependency_state,
        run_settings,
        latest_run,
        evidence_summary,
        blockers,
        next_actions,
        durable_flags,
        updated_at: task.updated_at.clone(),
    }
}

fn worker_run_state(
    task: &AgentQueueTaskRow,
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
) -> QueueItemAggregateWorkerRunState {
    match latest_link.map(|link| link.status.as_str()) {
        Some(RUN_STATUS_RUNNING) => QueueItemAggregateWorkerRunState::Running,
        Some(RUN_STATUS_COMPLETED | RUN_STATUS_REVIEW_NEEDED) => {
            QueueItemAggregateWorkerRunState::Completed
        }
        Some(RUN_STATUS_FAILED | RUN_STATUS_TIMED_OUT) => QueueItemAggregateWorkerRunState::Failed,
        Some(RUN_STATUS_CANCELLED) => QueueItemAggregateWorkerRunState::Cancelled,
        Some(_) => QueueItemAggregateWorkerRunState::Unknown,
        None => match task.status.as_str() {
            AGENT_QUEUE_TASK_STATUS_RUNNING => QueueItemAggregateWorkerRunState::Running,
            AGENT_QUEUE_TASK_STATUS_COMPLETED | AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED => {
                QueueItemAggregateWorkerRunState::Completed
            }
            AGENT_QUEUE_TASK_STATUS_FAILED => QueueItemAggregateWorkerRunState::Failed,
            AGENT_QUEUE_TASK_STATUS_CANCELLED => QueueItemAggregateWorkerRunState::Cancelled,
            AGENT_QUEUE_TASK_STATUS_DRAFT
            | AGENT_QUEUE_TASK_STATUS_QUEUED
            | AGENT_QUEUE_TASK_STATUS_READY => QueueItemAggregateWorkerRunState::NotStarted,
            _ => QueueItemAggregateWorkerRunState::Unknown,
        },
    }
}

fn ticket_state(
    task: &AgentQueueTaskRow,
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    latest_completion_decision: Option<&AgentQueueCompletionDecisionRow>,
    worker_run_state: QueueItemAggregateWorkerRunState,
    dependency_state: QueueItemAggregateDependencyState,
) -> QueueItemAggregateTicketState {
    if latest_completion_decision.is_some() {
        return QueueItemAggregateTicketState::Done;
    }
    if matches!(worker_run_state, QueueItemAggregateWorkerRunState::Running) {
        return QueueItemAggregateTicketState::Running;
    }
    if matches!(
        worker_run_state,
        QueueItemAggregateWorkerRunState::Failed | QueueItemAggregateWorkerRunState::Cancelled
    ) || matches!(
        latest_link.map(|link| link.status.as_str()),
        Some(RUN_STATUS_FAILED | RUN_STATUS_TIMED_OUT | RUN_STATUS_CANCELLED)
    ) {
        return QueueItemAggregateTicketState::Failure;
    }
    if latest_review_message
        .map(|message| message.status.as_str())
        .is_some_and(|status| status == REVIEW_MESSAGE_STATUS_ACKNOWLEDGED)
    {
        return QueueItemAggregateTicketState::InReview;
    }
    if matches!(
        worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    ) || matches!(
        task.status.as_str(),
        AGENT_QUEUE_TASK_STATUS_COMPLETED | AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED
    ) {
        return QueueItemAggregateTicketState::AwaitingReview;
    }
    if matches!(
        dependency_state,
        QueueItemAggregateDependencyState::Blocked
            | QueueItemAggregateDependencyState::FailedUpstream
    ) && matches!(
        task.status.as_str(),
        AGENT_QUEUE_TASK_STATUS_QUEUED | AGENT_QUEUE_TASK_STATUS_READY
    ) {
        return QueueItemAggregateTicketState::Blocked;
    }

    match task.status.as_str() {
        AGENT_QUEUE_TASK_STATUS_DRAFT => QueueItemAggregateTicketState::Draft,
        AGENT_QUEUE_TASK_STATUS_QUEUED | AGENT_QUEUE_TASK_STATUS_READY => {
            QueueItemAggregateTicketState::Queued
        }
        AGENT_QUEUE_TASK_STATUS_RUNNING => QueueItemAggregateTicketState::Running,
        AGENT_QUEUE_TASK_STATUS_FAILED | AGENT_QUEUE_TASK_STATUS_CANCELLED => {
            QueueItemAggregateTicketState::Failure
        }
        _ => QueueItemAggregateTicketState::Unknown,
    }
}

fn review_state(
    task: &AgentQueueTaskRow,
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
    latest_review_message: Option<&AgentQueueReviewMessageRow>,
    latest_completion_decision: Option<&AgentQueueCompletionDecisionRow>,
    ticket_state: QueueItemAggregateTicketState,
) -> QueueItemAggregateReviewState {
    if latest_completion_decision.is_some() {
        return QueueItemAggregateReviewState::Done;
    }
    if matches!(ticket_state, QueueItemAggregateTicketState::Failure) {
        return QueueItemAggregateReviewState::Failed;
    }
    match latest_review_message.map(|message| message.status.as_str()) {
        Some(REVIEW_MESSAGE_STATUS_ACKNOWLEDGED) => {
            return QueueItemAggregateReviewState::InReview;
        }
        Some(REVIEW_MESSAGE_STATUS_CREATED) => {
            return QueueItemAggregateReviewState::ReviewMessageCreated;
        }
        Some(_) => {
            return QueueItemAggregateReviewState::Unknown;
        }
        None => {}
    }
    if latest_link.and_then(|link| link.review_status.as_deref())
        == Some(REVIEW_STATUS_REVIEW_NEEDED)
        || matches!(ticket_state, QueueItemAggregateTicketState::AwaitingReview)
        || task.status == AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED
    {
        return QueueItemAggregateReviewState::AwaitingReview;
    }

    QueueItemAggregateReviewState::None
}

fn evidence_state(
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
    latest_evidence_bundle: Option<&AgentQueueWorkerEvidenceBundleRow>,
    ticket_state: QueueItemAggregateTicketState,
) -> QueueItemAggregateEvidenceState {
    if latest_evidence_bundle.is_some() {
        return QueueItemAggregateEvidenceState::Available;
    }

    match latest_link.map(|link| link.status.as_str()) {
        Some(RUN_STATUS_RUNNING) => QueueItemAggregateEvidenceState::Pending,
        Some(
            RUN_STATUS_COMPLETED
            | RUN_STATUS_REVIEW_NEEDED
            | RUN_STATUS_FAILED
            | RUN_STATUS_TIMED_OUT
            | RUN_STATUS_CANCELLED,
        ) => QueueItemAggregateEvidenceState::NotDurable,
        Some(_) => QueueItemAggregateEvidenceState::Unknown,
        None if matches!(ticket_state, QueueItemAggregateTicketState::AwaitingReview) => {
            QueueItemAggregateEvidenceState::NotDurable
        }
        None => QueueItemAggregateEvidenceState::None,
    }
}

fn validation_state(
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
) -> QueueItemAggregateValidationState {
    match latest_link.and_then(|link| link.validation_status.as_deref()) {
        Some("requested") => QueueItemAggregateValidationState::Requested,
        Some("running") => QueueItemAggregateValidationState::Running,
        Some("passed") => QueueItemAggregateValidationState::Passed,
        Some("failed") => QueueItemAggregateValidationState::Failed,
        Some("approved_placeholder") => QueueItemAggregateValidationState::ApprovedPlaceholder,
        Some(_) => QueueItemAggregateValidationState::Unknown,
        None => QueueItemAggregateValidationState::NotRequested,
    }
}

fn dependency_state(
    task: &AgentQueueTaskRow,
    all_tasks: &[AgentQueueTaskRow],
    completion_decisions: &HashMap<String, AgentQueueCompletionDecisionRow>,
) -> QueueItemAggregateDependencyState {
    let dependency_ids = dependency_ids(task);
    if dependency_ids.is_empty() {
        return QueueItemAggregateDependencyState::None;
    }

    let by_id: HashMap<&str, &AgentQueueTaskRow> = all_tasks
        .iter()
        .map(|candidate| (candidate.queue_item_id.as_str(), candidate))
        .collect();
    let mut all_ready = true;

    for dependency_id in dependency_ids {
        let Some(upstream) = by_id.get(dependency_id.as_str()) else {
            return QueueItemAggregateDependencyState::Unknown;
        };
        if completion_decisions.contains_key(dependency_id.as_str()) {
            continue;
        }
        match upstream.status.as_str() {
            AGENT_QUEUE_TASK_STATUS_FAILED | AGENT_QUEUE_TASK_STATUS_CANCELLED => {
                return QueueItemAggregateDependencyState::FailedUpstream;
            }
            _ => all_ready = false,
        }
    }

    if all_ready {
        QueueItemAggregateDependencyState::Ready
    } else {
        QueueItemAggregateDependencyState::Waiting
    }
}

fn run_settings(task: &AgentQueueTaskRow) -> QueueItemAggregateRunSettings {
    QueueItemAggregateRunSettings {
        execution_policy: task.execution_policy.clone(),
        execution_workspace: task.execution_workspace.clone(),
        codex_executable: task.codex_executable.clone(),
        sandbox: task.sandbox.clone(),
        approval_policy: task.approval_policy.clone(),
        assigned_executor_widget_id: task.assigned_executor_widget_id.clone(),
    }
}

fn latest_run(
    link: &AgentQueueTaskRunLinkRow,
    widget_run: Option<&WidgetRunRow>,
    latest_evidence_bundle: Option<&AgentQueueWorkerEvidenceBundleRow>,
) -> QueueItemAggregateLatestRun {
    QueueItemAggregateLatestRun {
        run_link_id: link.link_id.clone(),
        run_id: link.direct_work_run_id.clone(),
        executor_widget_id: link.executor_widget_id.clone(),
        status: link.status.clone(),
        source: link.source.clone(),
        started_at: link.started_at.clone(),
        completed_at: link.completed_at.clone(),
        validation_status: link.validation_status.clone(),
        review_status: link.review_status.clone(),
        final_detail_available: latest_evidence_bundle.is_some()
            || widget_run
                .map(|run| run.finished_at.is_some() || run.summary.is_some())
                .unwrap_or(false),
    }
}

fn evidence_summary(
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
    latest_evidence_bundle: Option<&AgentQueueWorkerEvidenceBundleRow>,
    widget_run: Option<&WidgetRunRow>,
    evidence_state: QueueItemAggregateEvidenceState,
    ticket_state: QueueItemAggregateTicketState,
) -> Option<QueueItemAggregateEvidenceSummary> {
    match evidence_state {
        QueueItemAggregateEvidenceState::Available => Some(QueueItemAggregateEvidenceSummary {
            available: true,
            source: "durable_worker_evidence_bundle".to_owned(),
            summary: latest_evidence_bundle
                .map(|bundle| bounded_summary(&bundle.summary))
                .or_else(|| {
                    widget_run
                        .and_then(|run| run.summary.as_deref())
                        .map(bounded_summary)
                })
                .or_else(|| {
                    latest_link.map(|link| {
                        format!(
                            "Queue-linked Direct Work run finished with status {}.",
                            link.status
                        )
                    })
                }),
            not_durable_reason: None,
        }),
        QueueItemAggregateEvidenceState::NotDurable
            if matches!(ticket_state, QueueItemAggregateTicketState::AwaitingReview) =>
        {
            Some(QueueItemAggregateEvidenceSummary {
                available: false,
                source: "missing_durable_evidence_bundle".to_owned(),
                summary: None,
                not_durable_reason: Some(
                    "Queue worker evidence bundle has not been recorded durably yet.".to_owned(),
                ),
            })
        }
        _ => None,
    }
}

fn blockers(
    task: &AgentQueueTaskRow,
    ticket_state: QueueItemAggregateTicketState,
    dependency_state: QueueItemAggregateDependencyState,
) -> Vec<QueueItemAggregateBlocker> {
    let mut blockers = Vec::new();
    if task.prompt.trim().is_empty() {
        blockers.push(blocker(
            "missing_prompt",
            "Task prompt is required before running.",
        ));
    }
    if task
        .execution_workspace
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        blockers.push(blocker(
            "missing_workspace",
            "Execution workspace is required before running.",
        ));
    }
    if task
        .codex_executable
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        blockers.push(blocker(
            "missing_codex_executable",
            "Codex executable is required before running.",
        ));
    }
    if task.sandbox.as_deref().unwrap_or("").trim().is_empty() {
        blockers.push(blocker(
            "missing_sandbox",
            "Sandbox is required before running.",
        ));
    }
    if task
        .approval_policy
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        blockers.push(blocker(
            "missing_approval_policy",
            "Approval policy is required before running.",
        ));
    }
    if matches!(ticket_state, QueueItemAggregateTicketState::Draft) {
        blockers.push(blocker(
            "task_is_draft",
            "Draft task must be promoted before running.",
        ));
    }
    match dependency_state {
        QueueItemAggregateDependencyState::Waiting => blockers.push(blocker(
            "dependency_waiting",
            "At least one dependency has not reached accepted completion.",
        )),
        QueueItemAggregateDependencyState::FailedUpstream => blockers.push(blocker(
            "dependency_failed",
            "At least one dependency failed before accepted completion.",
        )),
        QueueItemAggregateDependencyState::Blocked => blockers.push(blocker(
            "dependency_blocked",
            "At least one dependency is blocked.",
        )),
        _ => {}
    }
    match ticket_state {
        QueueItemAggregateTicketState::Running => {
            blockers.push(blocker("worker_running", "Worker run is already active."));
        }
        QueueItemAggregateTicketState::AwaitingReview => blockers.push(blocker(
            "awaiting_review",
            "Worker result is awaiting explicit review.",
        )),
        QueueItemAggregateTicketState::Failure => {
            blockers.push(blocker("final_failed", "Queue item is in failure state."));
        }
        _ => {}
    }
    blockers
}

fn next_actions(
    task: &AgentQueueTaskRow,
    ticket_state: QueueItemAggregateTicketState,
    review_state: QueueItemAggregateReviewState,
    dependency_state: QueueItemAggregateDependencyState,
    blockers: &[QueueItemAggregateBlocker],
) -> Vec<QueueItemAggregateNextAction> {
    match ticket_state {
        QueueItemAggregateTicketState::Draft => {
            let mut actions = Vec::new();
            if has_missing_run_settings(blockers) {
                actions.push(action(
                    "update_run_settings",
                    "Update run settings",
                    true,
                    None,
                ));
            }
            if draft_ready_for_promotion(task) {
                actions.push(action("promote_draft", "Promote draft", true, None));
            }
            if actions.is_empty() {
                actions.push(action(
                    "update_run_settings",
                    "Update run settings",
                    true,
                    None,
                ));
            }
            actions
        }
        QueueItemAggregateTicketState::Queued => {
            if matches!(
                dependency_state,
                QueueItemAggregateDependencyState::Waiting
                    | QueueItemAggregateDependencyState::Blocked
                    | QueueItemAggregateDependencyState::FailedUpstream
            ) {
                return vec![action(
                    "none",
                    "No action",
                    false,
                    Some("dependencies_not_ready"),
                )];
            }
            if has_missing_run_settings(blockers) {
                return vec![action(
                    "update_run_settings",
                    "Update run settings",
                    true,
                    None,
                )];
            }
            vec![action("start_run", "Start run", true, None)]
        }
        QueueItemAggregateTicketState::AwaitingReview => match review_state {
            QueueItemAggregateReviewState::AwaitingReview => {
                vec![action(
                    "create_review_message",
                    "Create review message",
                    true,
                    None,
                )]
            }
            QueueItemAggregateReviewState::ReviewMessageCreated => {
                vec![action(
                    "ack_review",
                    "Acknowledge review message",
                    true,
                    None,
                )]
            }
            QueueItemAggregateReviewState::InReview => {
                vec![action("none", "No action", false, Some("in_review"))]
            }
            QueueItemAggregateReviewState::Done => {
                vec![action("none", "No action", false, Some("final_done"))]
            }
            QueueItemAggregateReviewState::Failed => {
                vec![action("none", "No action", false, Some("final_failed"))]
            }
            QueueItemAggregateReviewState::Unknown => {
                vec![action(
                    "none",
                    "No action",
                    false,
                    Some("unknown_review_state"),
                )]
            }
            _ => vec![action(
                "none",
                "No action",
                false,
                Some("review_not_required"),
            )],
        },
        QueueItemAggregateTicketState::InReview => {
            vec![action("mark_done", "Mark done", true, None)]
        }
        QueueItemAggregateTicketState::Running => {
            vec![action("none", "No action", false, Some("worker_running"))]
        }
        QueueItemAggregateTicketState::Failure => {
            vec![action("none", "No action", false, Some("final_failed"))]
        }
        QueueItemAggregateTicketState::Done => {
            vec![action("none", "No action", false, Some("final_done"))]
        }
        QueueItemAggregateTicketState::Blocked => {
            vec![action("none", "No action", false, Some("blocked"))]
        }
        _ => vec![action("none", "No action", false, Some("unknown_state"))],
    }
}

fn durable_flags(
    latest_link: Option<&AgentQueueTaskRunLinkRow>,
    review_state: QueueItemAggregateReviewState,
    evidence_state: QueueItemAggregateEvidenceState,
    validation_state: QueueItemAggregateValidationState,
    commit_state: QueueItemAggregateCommitState,
    latest_completion_decision: Option<&AgentQueueCompletionDecisionRow>,
) -> QueueItemAggregateDurableFlags {
    QueueItemAggregateDurableFlags {
        task_row: true,
        latest_run_link: latest_link.is_some(),
        dependency_state: true,
        review_state: !matches!(
            review_state,
            QueueItemAggregateReviewState::NotDurable | QueueItemAggregateReviewState::Unknown
        ),
        evidence_state: matches!(
            evidence_state,
            QueueItemAggregateEvidenceState::None
                | QueueItemAggregateEvidenceState::Pending
                | QueueItemAggregateEvidenceState::Available
        ),
        validation_state: !matches!(validation_state, QueueItemAggregateValidationState::Unknown),
        commit_state: matches!(commit_state, QueueItemAggregateCommitState::None),
        completion_state: latest_completion_decision.is_some(),
        frontend_overlay_used: false,
    }
}

fn dependency_ids(task: &AgentQueueTaskRow) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(&task.depends_on).unwrap_or_default()
}

fn draft_ready_for_promotion(task: &AgentQueueTaskRow) -> bool {
    !task.prompt.trim().is_empty()
        && task.execution_workspace.as_deref().unwrap_or("").trim() != ""
        && task.codex_executable.as_deref().unwrap_or("").trim() != ""
        && task.sandbox.as_deref().unwrap_or("").trim() != ""
        && task.approval_policy.as_deref().unwrap_or("").trim() != ""
}

fn has_missing_run_settings(blockers: &[QueueItemAggregateBlocker]) -> bool {
    blockers.iter().any(|blocker| {
        matches!(
            blocker.code.as_str(),
            "missing_prompt"
                | "missing_workspace"
                | "missing_codex_executable"
                | "missing_sandbox"
                | "missing_approval_policy"
        )
    })
}

fn blocker(code: &str, message: &str) -> QueueItemAggregateBlocker {
    QueueItemAggregateBlocker {
        code: code.to_owned(),
        message: message.to_owned(),
    }
}

fn action(
    code: &str,
    label: &str,
    available: bool,
    unavailable_reason: Option<&str>,
) -> QueueItemAggregateNextAction {
    QueueItemAggregateNextAction {
        code: code.to_owned(),
        label: label.to_owned(),
        available,
        unavailable_reason: unavailable_reason.map(str::to_owned),
    }
}

fn bounded_summary(value: &str) -> String {
    let mut chars = value.chars();
    let mut output = String::new();
    for _ in 0..SUMMARY_CAP {
        let Some(next) = chars.next() else {
            return output;
        };
        output.push(next);
    }
    if chars.next().is_some() {
        output.push_str("...");
    }
    output
}

#[allow(dead_code)]
fn _ensure_task_loader_error_mapping(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    task_id: &str,
) -> Result<AgentQueueTaskRow, WorkspaceServiceError> {
    load_agent_queue_task(store, workspace_id, task_id).map_err(map_storage_agent_queue_task_error)
}
