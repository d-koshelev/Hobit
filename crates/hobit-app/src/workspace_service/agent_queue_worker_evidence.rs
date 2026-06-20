use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{
    AgentQueueTaskRunLinkFinalUpdate, AgentQueueWorkerEvidenceBundleRow,
    NewAgentQueueWorkerEvidenceBundle, WidgetRunFinishUpdate,
};

use crate::WorkspaceServiceError;

use super::{
    agent_queue_lifecycle::{
        AGENT_QUEUE_TASK_STATUS_COMPLETED, AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED,
    },
    agent_queue_tasks::{load_agent_queue_task, map_storage_agent_queue_task_error},
    placeholder_id, placeholder_timestamp,
    runs::widget_run_status_value,
    validation::required_input,
    AgentQueueTaskRunReviewStatus, AgentQueueTaskRunStatus, QueueItemAggregate, WorkspaceService,
};

pub const AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED: &str = "completed";
pub const AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_NOT_COMPLETED: &str = "not_completed";
pub const AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED: &str = "failed";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecordAgentQueueWorkerFinishedInput {
    pub workspace_id: String,
    pub queue_item_id: String,
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
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GetAgentQueueWorkerEvidenceBundleInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkerEvidenceBundleSummary {
    pub bundle_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: String,
    pub run_link_id: Option<String>,
    pub executor_widget_id: Option<String>,
    pub worker_id: Option<String>,
    pub source: String,
    pub outcome: String,
    pub summary: String,
    pub changed_files: Vec<String>,
    pub changed_files_count: i64,
    pub changed_files_summary: Option<String>,
    pub validation_summary: Option<String>,
    pub error_summary: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgentQueueWorkerEvidenceQueryState {
    Available,
    NoEvidence,
    NotFound,
}

impl AgentQueueWorkerEvidenceQueryState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::NoEvidence => "no_evidence",
            Self::NotFound => "not_found",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkerFinishedCommandResult {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: String,
    pub bundle_id: String,
    pub durable: bool,
    pub evidence_bundle: AgentQueueWorkerEvidenceBundleSummary,
    pub aggregate: QueueItemAggregate,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkerEvidenceQueryResult {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub run_id: Option<String>,
    pub state: AgentQueueWorkerEvidenceQueryState,
    pub durable: bool,
    pub evidence_bundle: Option<AgentQueueWorkerEvidenceBundleSummary>,
    pub aggregate: Option<QueueItemAggregate>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedRecordAgentQueueWorkerFinishedInput {
    workspace_id: String,
    queue_item_id: String,
    run_id: String,
    outcome: String,
    summary: String,
    changed_files: Vec<String>,
    changed_files_summary: Option<String>,
    validation_summary: Option<String>,
    error_summary: Option<String>,
    worker_id: Option<String>,
    source: String,
    metadata_json: Option<String>,
    finished_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NormalizedGetAgentQueueWorkerEvidenceBundleInput {
    workspace_id: String,
    queue_item_id: String,
    run_id: Option<String>,
}

impl WorkspaceService {
    pub fn record_agent_queue_worker_finished(
        &self,
        input: RecordAgentQueueWorkerFinishedInput,
    ) -> Result<AgentQueueWorkerFinishedCommandResult, WorkspaceServiceError> {
        let input = normalize_record_agent_queue_worker_finished_input(input)?;
        let finished_at = input
            .finished_at
            .clone()
            .unwrap_or_else(placeholder_timestamp);
        let bundle_id = placeholder_id("queue_worker_evidence_");
        let changed_files_json = serde_json::to_string(&input.changed_files).map_err(|error| {
            WorkspaceServiceError::InvalidInput(format!(
                "worker evidence changed files must serialize as JSON: {error}"
            ))
        })?;

        let evidence = self
            .store
            .with_immediate_transaction(|store| {
                let _task =
                    load_agent_queue_task(store, &input.workspace_id, &input.queue_item_id)?;
                let Some(run_link) = store
                    .get_agent_queue_task_run_link_by_run_id(&input.workspace_id, &input.run_id)?
                else {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!("queue task run link not found: {}", input.run_id),
                    ));
                };

                if run_link.queue_task_id != input.queue_item_id {
                    return Err(hobit_storage_sqlite::StorageError::InvalidParameterName(
                        format!(
                            "queue task run link does not belong to task: {}",
                            input.run_id
                        ),
                    ));
                }

                let task_status = task_status_for_worker_outcome(&input.outcome);
                store
                    .update_agent_queue_task_status(
                        &input.workspace_id,
                        &input.queue_item_id,
                        task_status,
                        Some(&finished_at),
                    )?
                    .ok_or_else(|| {
                        hobit_storage_sqlite::StorageError::InvalidParameterName(format!(
                            "queue task not found: {}",
                            input.queue_item_id
                        ))
                    })?;

                store
                    .update_agent_queue_task_run_link_final_status(
                        &input.workspace_id,
                        &input.queue_item_id,
                        &input.run_id,
                        AgentQueueTaskRunLinkFinalUpdate {
                            status: run_status_for_worker_outcome(&input.outcome),
                            completed_at: Some(&finished_at),
                            validation_status: None,
                            review_status: Some(
                                AgentQueueTaskRunReviewStatus::ReviewNeeded.as_str(),
                            ),
                            updated_at: Some(&finished_at),
                        },
                    )?
                    .ok_or_else(|| {
                        hobit_storage_sqlite::StorageError::InvalidParameterName(format!(
                            "queue task run link not found: {}",
                            input.run_id
                        ))
                    })?;

                let widget_run_status = widget_run_status_for_worker_outcome(&input.outcome);
                let _run = store.finish_widget_run(
                    &input.run_id,
                    WidgetRunFinishUpdate {
                        status: widget_run_status,
                        finished_at: Some(&finished_at),
                        summary: Some(&input.summary),
                    },
                )?;

                let evidence = store.upsert_agent_queue_worker_evidence_bundle(
                    NewAgentQueueWorkerEvidenceBundle {
                        bundle_id: &bundle_id,
                        workspace_id: &input.workspace_id,
                        queue_task_id: &input.queue_item_id,
                        run_id: &input.run_id,
                        run_link_id: Some(&run_link.link_id),
                        executor_widget_id: Some(&run_link.executor_widget_id),
                        worker_id: input.worker_id.as_deref(),
                        source: &input.source,
                        outcome: &input.outcome,
                        summary: &input.summary,
                        changed_files_json: &changed_files_json,
                        changed_files_count: input.changed_files.len() as i64,
                        changed_files_summary: input.changed_files_summary.as_deref(),
                        validation_summary: input.validation_summary.as_deref(),
                        error_summary: input.error_summary.as_deref(),
                        metadata_json: input.metadata_json.as_deref(),
                        created_at: Some(&finished_at),
                        updated_at: Some(&finished_at),
                    },
                )?;

                store.touch_workspace(&input.workspace_id)?;
                Ok(evidence)
            })
            .map_err(map_storage_agent_queue_task_error)?;

        let aggregate = self
            .get_queue_item_aggregate(&input.workspace_id, &input.queue_item_id)?
            .ok_or_else(|| {
                WorkspaceServiceError::InvalidInput(format!(
                    "queue task not found: {}",
                    input.queue_item_id
                ))
            })?;
        let evidence_bundle = worker_evidence_bundle_summary(evidence)?;
        Ok(AgentQueueWorkerFinishedCommandResult {
            workspace_id: input.workspace_id,
            queue_item_id: input.queue_item_id,
            run_id: input.run_id,
            bundle_id: evidence_bundle.bundle_id.clone(),
            durable: true,
            evidence_bundle,
            aggregate,
        })
    }

    pub fn get_agent_queue_worker_evidence_bundle(
        &self,
        input: GetAgentQueueWorkerEvidenceBundleInput,
    ) -> Result<AgentQueueWorkerEvidenceQueryResult, WorkspaceServiceError> {
        let input = normalize_get_agent_queue_worker_evidence_bundle_input(input)?;
        if self.store.get_workspace(&input.workspace_id)?.is_none() {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "workspace not found: {}",
                input.workspace_id
            )));
        }

        let Some(task) = self
            .store
            .get_agent_queue_task_by_id(&input.queue_item_id)?
        else {
            return Ok(AgentQueueWorkerEvidenceQueryResult {
                workspace_id: input.workspace_id,
                queue_item_id: input.queue_item_id,
                run_id: input.run_id,
                state: AgentQueueWorkerEvidenceQueryState::NotFound,
                durable: false,
                evidence_bundle: None,
                aggregate: None,
            });
        };

        if task.workspace_id != input.workspace_id {
            return Err(WorkspaceServiceError::InvalidInput(format!(
                "queue task does not belong to workspace: {}",
                input.queue_item_id
            )));
        }

        let evidence = match input.run_id.as_deref() {
            Some(run_id) => {
                if let Some(run_link) = self
                    .store
                    .get_agent_queue_task_run_link_by_run_id(&input.workspace_id, run_id)?
                {
                    if run_link.queue_task_id != input.queue_item_id {
                        return Err(WorkspaceServiceError::InvalidInput(format!(
                            "queue task run link does not belong to task: {run_id}"
                        )));
                    }
                }

                self.store.get_agent_queue_worker_evidence_bundle(
                    &input.workspace_id,
                    &input.queue_item_id,
                    run_id,
                )?
            }
            None => self.store.get_latest_agent_queue_worker_evidence_bundle(
                &input.workspace_id,
                &input.queue_item_id,
            )?,
        };

        let aggregate = self.get_queue_item_aggregate(&input.workspace_id, &input.queue_item_id)?;
        match evidence {
            Some(evidence) => {
                let run_id = Some(evidence.run_id.clone());
                Ok(AgentQueueWorkerEvidenceQueryResult {
                    workspace_id: input.workspace_id,
                    queue_item_id: input.queue_item_id,
                    run_id,
                    state: AgentQueueWorkerEvidenceQueryState::Available,
                    durable: true,
                    evidence_bundle: Some(worker_evidence_bundle_summary(evidence)?),
                    aggregate,
                })
            }
            None => Ok(AgentQueueWorkerEvidenceQueryResult {
                workspace_id: input.workspace_id,
                queue_item_id: input.queue_item_id,
                run_id: input.run_id,
                state: AgentQueueWorkerEvidenceQueryState::NoEvidence,
                durable: false,
                evidence_bundle: None,
                aggregate,
            }),
        }
    }
}

fn normalize_record_agent_queue_worker_finished_input(
    input: RecordAgentQueueWorkerFinishedInput,
) -> Result<NormalizedRecordAgentQueueWorkerFinishedInput, WorkspaceServiceError> {
    let workspace_id = required_input(&input.workspace_id, "workspace id")?.to_owned();
    let queue_item_id = required_input(&input.queue_item_id, "queue item id")?.to_owned();
    let run_id = required_input(&input.run_id, "worker run id")?.to_owned();
    let outcome = normalize_worker_outcome(&input.outcome)?;
    let error_summary = optional_trimmed(input.error_summary);
    let summary = normalized_worker_summary(input.summary, &outcome, error_summary.as_deref());
    let changed_files = normalize_changed_files(input.changed_files);

    Ok(NormalizedRecordAgentQueueWorkerFinishedInput {
        workspace_id,
        queue_item_id,
        run_id,
        outcome,
        summary,
        changed_files,
        changed_files_summary: optional_trimmed(input.changed_files_summary),
        validation_summary: optional_trimmed(input.validation_summary),
        error_summary,
        worker_id: optional_trimmed(input.worker_id),
        source: optional_trimmed(input.source).unwrap_or_else(|| "workspace_agent".to_owned()),
        metadata_json: optional_trimmed(input.metadata_json),
        finished_at: optional_trimmed(input.finished_at),
    })
}

fn normalize_get_agent_queue_worker_evidence_bundle_input(
    input: GetAgentQueueWorkerEvidenceBundleInput,
) -> Result<NormalizedGetAgentQueueWorkerEvidenceBundleInput, WorkspaceServiceError> {
    Ok(NormalizedGetAgentQueueWorkerEvidenceBundleInput {
        workspace_id: required_input(&input.workspace_id, "workspace id")?.to_owned(),
        queue_item_id: required_input(&input.queue_item_id, "queue item id")?.to_owned(),
        run_id: input
            .run_id
            .map(|value| required_input(&value, "worker run id").map(str::to_owned))
            .transpose()?,
    })
}

fn normalize_worker_outcome(outcome: &str) -> Result<String, WorkspaceServiceError> {
    let outcome = required_input(outcome, "worker outcome")?;
    match outcome {
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED
        | AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_NOT_COMPLETED
        | AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED => Ok(outcome.to_owned()),
        value => Err(WorkspaceServiceError::InvalidInput(format!(
            "worker outcome must be completed, not_completed, or failed: {value}"
        ))),
    }
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn normalized_worker_summary(
    summary: Option<String>,
    outcome: &str,
    error_summary: Option<&str>,
) -> String {
    if let Some(summary) = optional_trimmed(summary) {
        return summary;
    }

    if outcome == AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED {
        if let Some(error_summary) = error_summary {
            return error_summary.to_owned();
        }
    }

    match outcome {
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED => {
            "Queue worker reported completed work.".to_owned()
        }
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_NOT_COMPLETED => {
            "Queue worker reported work that needs review or follow-up.".to_owned()
        }
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED => {
            "Queue worker reported failed work.".to_owned()
        }
        _ => "Queue worker reported final work evidence.".to_owned(),
    }
}

fn normalize_changed_files(changed_files: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for value in changed_files {
        let value = value.trim();
        if !value.is_empty() && !normalized.iter().any(|existing| existing == value) {
            normalized.push(value.to_owned());
        }
    }
    normalized
}

fn task_status_for_worker_outcome(outcome: &str) -> &'static str {
    match outcome {
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED => AGENT_QUEUE_TASK_STATUS_COMPLETED,
        _ => AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED,
    }
}

fn run_status_for_worker_outcome(outcome: &str) -> &'static str {
    match outcome {
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_COMPLETED => {
            AgentQueueTaskRunStatus::Completed.as_str()
        }
        AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED => AgentQueueTaskRunStatus::Failed.as_str(),
        _ => AgentQueueTaskRunStatus::ReviewNeeded.as_str(),
    }
}

fn widget_run_status_for_worker_outcome(outcome: &str) -> &'static str {
    let status = if outcome == AGENT_QUEUE_WORKER_EVIDENCE_OUTCOME_FAILED {
        WidgetRunStatus::Failed
    } else {
        WidgetRunStatus::Completed
    };
    widget_run_status_value(&status)
}

pub(super) fn worker_evidence_bundle_summary(
    row: AgentQueueWorkerEvidenceBundleRow,
) -> Result<AgentQueueWorkerEvidenceBundleSummary, WorkspaceServiceError> {
    let changed_files =
        serde_json::from_str::<Vec<String>>(&row.changed_files_json).map_err(|error| {
            WorkspaceServiceError::InvalidInput(format!(
                "worker evidence changed files must be valid JSON: {error}"
            ))
        })?;

    Ok(AgentQueueWorkerEvidenceBundleSummary {
        bundle_id: row.bundle_id,
        workspace_id: row.workspace_id,
        queue_item_id: row.queue_task_id,
        run_id: row.run_id,
        run_link_id: row.run_link_id,
        executor_widget_id: row.executor_widget_id,
        worker_id: row.worker_id,
        source: row.source,
        outcome: row.outcome,
        summary: row.summary,
        changed_files,
        changed_files_count: row.changed_files_count,
        changed_files_summary: row.changed_files_summary,
        validation_summary: row.validation_summary,
        error_summary: row.error_summary,
        metadata_json: row.metadata_json,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}
