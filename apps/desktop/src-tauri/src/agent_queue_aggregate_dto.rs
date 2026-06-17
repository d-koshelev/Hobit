use hobit_app::{
    QueueItemAggregate, QueueItemAggregateBlocker, QueueItemAggregateDurableFlags,
    QueueItemAggregateEvidenceSummary, QueueItemAggregateLatestRun, QueueItemAggregateNextAction,
    QueueItemAggregateRunSettings,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct ListQueueItemAggregatesRequest {
    pub workspace_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
pub(crate) struct GetQueueItemAggregateRequest {
    pub workspace_id: String,
    pub task_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateDto {
    pub task_id: String,
    pub workspace_id: String,
    pub title: String,
    pub ticket_state: String,
    pub worker_run_state: String,
    pub review_state: String,
    pub evidence_state: String,
    pub validation_state: String,
    pub commit_state: String,
    pub dependency_state: String,
    pub run_settings: QueueItemAggregateRunSettingsDto,
    pub latest_run: Option<QueueItemAggregateLatestRunDto>,
    pub evidence_summary: Option<QueueItemAggregateEvidenceSummaryDto>,
    pub blockers: Vec<QueueItemAggregateBlockerDto>,
    pub next_actions: Vec<QueueItemAggregateNextActionDto>,
    pub durable_flags: QueueItemAggregateDurableFlagsDto,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateRunSettingsDto {
    pub execution_policy: String,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
    pub assigned_executor_widget_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateLatestRunDto {
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

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateEvidenceSummaryDto {
    pub available: bool,
    pub source: String,
    pub summary: Option<String>,
    pub not_durable_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateBlockerDto {
    pub code: String,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateNextActionDto {
    pub code: String,
    pub label: String,
    pub available: bool,
    pub unavailable_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct QueueItemAggregateDurableFlagsDto {
    pub task_row: bool,
    pub latest_run_link: bool,
    pub dependency_state: bool,
    pub review_state: bool,
    pub evidence_state: bool,
    pub validation_state: bool,
    pub commit_state: bool,
    pub frontend_overlay_used: bool,
}

impl From<QueueItemAggregate> for QueueItemAggregateDto {
    fn from(aggregate: QueueItemAggregate) -> Self {
        Self {
            task_id: aggregate.task_id,
            workspace_id: aggregate.workspace_id,
            title: aggregate.title,
            ticket_state: aggregate.ticket_state.as_str().to_owned(),
            worker_run_state: aggregate.worker_run_state.as_str().to_owned(),
            review_state: aggregate.review_state.as_str().to_owned(),
            evidence_state: aggregate.evidence_state.as_str().to_owned(),
            validation_state: aggregate.validation_state.as_str().to_owned(),
            commit_state: aggregate.commit_state.as_str().to_owned(),
            dependency_state: aggregate.dependency_state.as_str().to_owned(),
            run_settings: QueueItemAggregateRunSettingsDto::from(aggregate.run_settings),
            latest_run: aggregate
                .latest_run
                .map(QueueItemAggregateLatestRunDto::from),
            evidence_summary: aggregate
                .evidence_summary
                .map(QueueItemAggregateEvidenceSummaryDto::from),
            blockers: aggregate
                .blockers
                .into_iter()
                .map(QueueItemAggregateBlockerDto::from)
                .collect(),
            next_actions: aggregate
                .next_actions
                .into_iter()
                .map(QueueItemAggregateNextActionDto::from)
                .collect(),
            durable_flags: QueueItemAggregateDurableFlagsDto::from(aggregate.durable_flags),
            updated_at: aggregate.updated_at,
        }
    }
}

impl From<QueueItemAggregateRunSettings> for QueueItemAggregateRunSettingsDto {
    fn from(settings: QueueItemAggregateRunSettings) -> Self {
        Self {
            execution_policy: settings.execution_policy,
            execution_workspace: settings.execution_workspace,
            codex_executable: settings.codex_executable,
            sandbox: settings.sandbox,
            approval_policy: settings.approval_policy,
            assigned_executor_widget_id: settings.assigned_executor_widget_id,
        }
    }
}

impl From<QueueItemAggregateLatestRun> for QueueItemAggregateLatestRunDto {
    fn from(run: QueueItemAggregateLatestRun) -> Self {
        Self {
            run_link_id: run.run_link_id,
            run_id: run.run_id,
            executor_widget_id: run.executor_widget_id,
            status: run.status,
            source: run.source,
            started_at: run.started_at,
            completed_at: run.completed_at,
            validation_status: run.validation_status,
            review_status: run.review_status,
            final_detail_available: run.final_detail_available,
        }
    }
}

impl From<QueueItemAggregateEvidenceSummary> for QueueItemAggregateEvidenceSummaryDto {
    fn from(summary: QueueItemAggregateEvidenceSummary) -> Self {
        Self {
            available: summary.available,
            source: summary.source,
            summary: summary.summary,
            not_durable_reason: summary.not_durable_reason,
        }
    }
}

impl From<QueueItemAggregateBlocker> for QueueItemAggregateBlockerDto {
    fn from(blocker: QueueItemAggregateBlocker) -> Self {
        Self {
            code: blocker.code,
            message: blocker.message,
        }
    }
}

impl From<QueueItemAggregateNextAction> for QueueItemAggregateNextActionDto {
    fn from(action: QueueItemAggregateNextAction) -> Self {
        Self {
            code: action.code,
            label: action.label,
            available: action.available,
            unavailable_reason: action.unavailable_reason,
        }
    }
}

impl From<QueueItemAggregateDurableFlags> for QueueItemAggregateDurableFlagsDto {
    fn from(flags: QueueItemAggregateDurableFlags) -> Self {
        Self {
            task_row: flags.task_row,
            latest_run_link: flags.latest_run_link,
            dependency_state: flags.dependency_state,
            review_state: flags.review_state,
            evidence_state: flags.evidence_state,
            validation_state: flags.validation_state,
            commit_state: flags.commit_state,
            frontend_overlay_used: flags.frontend_overlay_used,
        }
    }
}
