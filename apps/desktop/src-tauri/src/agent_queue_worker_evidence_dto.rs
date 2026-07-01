use hobit_app::{
    AgentQueueWorkerEvidenceBundleSummary, AgentQueueWorkerEvidenceQueryResult,
    AgentQueueWorkerFinishedCommandResult, GetAgentQueueWorkerEvidenceBundleInput,
    RecordAgentQueueWorkerFinishedInput,
};
use serde::{Deserialize, Serialize};

use crate::agent_queue_aggregate_dto::QueueItemAggregateDto;

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct RecordAgentQueueWorkerFinishedRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: String,
    pub outcome: String,
    pub summary: Option<String>,
    pub changed_files: Option<Vec<String>>,
    pub changed_files_summary: Option<String>,
    pub validation_summary: Option<String>,
    pub error_summary: Option<String>,
    pub worker_id: Option<String>,
    pub source: Option<String>,
    pub metadata_json: Option<String>,
    pub finished_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetAgentQueueWorkerEvidenceBundleRequest {
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkerEvidenceBundleDto {
    pub bundle_id: String,
    pub workspace_id: String,
    pub task_id: String,
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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkerFinishedCommandResultDto {
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: String,
    pub bundle_id: String,
    pub durable: bool,
    pub evidence_bundle: AgentQueueWorkerEvidenceBundleDto,
    pub aggregate: QueueItemAggregateDto,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentQueueWorkerEvidenceQueryResultDto {
    pub workspace_id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub state: String,
    pub durable: bool,
    pub evidence_bundle: Option<AgentQueueWorkerEvidenceBundleDto>,
    pub aggregate: Option<QueueItemAggregateDto>,
}

impl From<RecordAgentQueueWorkerFinishedRequest> for RecordAgentQueueWorkerFinishedInput {
    fn from(request: RecordAgentQueueWorkerFinishedRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            run_id: request.run_id,
            outcome: request.outcome,
            summary: request.summary,
            changed_files: request.changed_files.unwrap_or_default(),
            changed_files_summary: request.changed_files_summary,
            validation_summary: request.validation_summary,
            error_summary: request.error_summary,
            worker_id: request.worker_id,
            source: request.source,
            metadata_json: request.metadata_json,
            finished_at: request.finished_at,
        }
    }
}

impl From<GetAgentQueueWorkerEvidenceBundleRequest> for GetAgentQueueWorkerEvidenceBundleInput {
    fn from(request: GetAgentQueueWorkerEvidenceBundleRequest) -> Self {
        Self {
            workspace_id: request.workspace_id,
            queue_item_id: request.task_id,
            run_id: request.run_id,
        }
    }
}

impl From<AgentQueueWorkerFinishedCommandResult> for AgentQueueWorkerFinishedCommandResultDto {
    fn from(result: AgentQueueWorkerFinishedCommandResult) -> Self {
        Self {
            workspace_id: result.workspace_id,
            task_id: result.queue_item_id,
            run_id: result.run_id,
            bundle_id: result.bundle_id,
            durable: result.durable,
            evidence_bundle: AgentQueueWorkerEvidenceBundleDto::from(result.evidence_bundle),
            aggregate: QueueItemAggregateDto::from(result.aggregate),
        }
    }
}

impl From<AgentQueueWorkerEvidenceQueryResult> for AgentQueueWorkerEvidenceQueryResultDto {
    fn from(result: AgentQueueWorkerEvidenceQueryResult) -> Self {
        Self {
            workspace_id: result.workspace_id,
            task_id: result.queue_item_id,
            run_id: result.run_id,
            state: result.state.as_str().to_owned(),
            durable: result.durable,
            evidence_bundle: result
                .evidence_bundle
                .map(AgentQueueWorkerEvidenceBundleDto::from),
            aggregate: result.aggregate.map(QueueItemAggregateDto::from),
        }
    }
}

impl From<AgentQueueWorkerEvidenceBundleSummary> for AgentQueueWorkerEvidenceBundleDto {
    fn from(bundle: AgentQueueWorkerEvidenceBundleSummary) -> Self {
        Self {
            bundle_id: bundle.bundle_id,
            workspace_id: bundle.workspace_id,
            task_id: bundle.queue_item_id,
            run_id: bundle.run_id,
            run_link_id: bundle.run_link_id,
            executor_widget_id: bundle.executor_widget_id,
            worker_id: bundle.worker_id,
            source: bundle.source,
            outcome: bundle.outcome,
            summary: bundle.summary,
            changed_files: bundle.changed_files,
            changed_files_count: bundle.changed_files_count,
            changed_files_summary: bundle.changed_files_summary,
            validation_summary: bundle.validation_summary,
            error_summary: bundle.error_summary,
            metadata_json: bundle.metadata_json,
            created_at: bundle.created_at,
            updated_at: bundle.updated_at,
        }
    }
}
