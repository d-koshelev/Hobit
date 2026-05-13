use hobit_app::{
    AgentExecutorRunDetail, AgentExecutorRunHistory, AgentExecutorRunSummary, WidgetLogSummary,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ListAgentExecutorRunsRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct GetAgentExecutorRunDetailRequest {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub run_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorRunHistoryDto {
    pub workspace_id: String,
    pub workbench_id: String,
    pub widget_instance_id: String,
    pub runs: Vec<AgentExecutorRunSummaryDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorRunSummaryDto {
    pub run_id: String,
    pub status: String,
    pub command_kind: Option<String>,
    pub result_type: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub title: String,
    pub repo_root: Option<String>,
    pub mode: Option<String>,
    pub validation_profile: Option<String>,
    pub validation_status: Option<String>,
    pub has_result: bool,
    pub log_count: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorRunDetailDto {
    pub summary: AgentExecutorRunSummaryDto,
    pub result_id: Option<String>,
    pub result_status: Option<String>,
    pub result_summary: Option<String>,
    pub result_content: Option<String>,
    pub result_payload: Option<String>,
    pub final_message: Option<String>,
    pub stdout_preview: Option<String>,
    pub stderr_preview: Option<String>,
    pub error_message: Option<String>,
    pub validation_profile: Option<String>,
    pub validation_status: Option<String>,
    pub changed_files_summary: Option<String>,
    pub logs: Vec<AgentExecutorRunLogDto>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct AgentExecutorRunLogDto {
    pub id: String,
    pub widget_instance_id: String,
    pub run_id: Option<String>,
    pub level: String,
    pub message: String,
    pub payload: Option<String>,
    pub created_at: String,
}

impl From<AgentExecutorRunHistory> for AgentExecutorRunHistoryDto {
    fn from(history: AgentExecutorRunHistory) -> Self {
        Self {
            workspace_id: history.workspace_id,
            workbench_id: history.workbench_id,
            widget_instance_id: history.widget_instance_id,
            runs: history
                .runs
                .into_iter()
                .map(AgentExecutorRunSummaryDto::from)
                .collect(),
        }
    }
}

impl From<AgentExecutorRunSummary> for AgentExecutorRunSummaryDto {
    fn from(summary: AgentExecutorRunSummary) -> Self {
        Self {
            run_id: summary.run_id,
            status: summary.status,
            command_kind: summary.command_kind,
            result_type: summary.result_type,
            started_at: summary.started_at,
            finished_at: summary.finished_at,
            duration_ms: summary.duration_ms,
            title: summary.title,
            repo_root: summary.repo_root,
            mode: summary.mode,
            validation_profile: summary.validation_profile,
            validation_status: summary.validation_status,
            has_result: summary.has_result,
            log_count: summary.log_count,
        }
    }
}

impl From<AgentExecutorRunDetail> for AgentExecutorRunDetailDto {
    fn from(detail: AgentExecutorRunDetail) -> Self {
        Self {
            summary: AgentExecutorRunSummaryDto::from(detail.summary),
            result_id: detail.result_id,
            result_status: detail.result_status,
            result_summary: detail.result_summary,
            result_content: detail.result_content,
            result_payload: detail.result_payload,
            final_message: detail.final_message,
            stdout_preview: detail.stdout_preview,
            stderr_preview: detail.stderr_preview,
            error_message: detail.error_message,
            validation_profile: detail.validation_profile,
            validation_status: detail.validation_status,
            changed_files_summary: detail.changed_files_summary,
            logs: detail
                .logs
                .into_iter()
                .map(AgentExecutorRunLogDto::from)
                .collect(),
        }
    }
}

impl From<WidgetLogSummary> for AgentExecutorRunLogDto {
    fn from(log: WidgetLogSummary) -> Self {
        Self {
            id: log.id,
            widget_instance_id: log.widget_instance_id,
            run_id: log.run_id,
            level: log.level,
            message: log.message,
            payload: log.payload,
            created_at: log.created_at,
        }
    }
}
