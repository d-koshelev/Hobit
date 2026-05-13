use hobit_storage_sqlite::{WidgetResultRow, WidgetRunRow};
use serde_json::Value;

use crate::WorkspaceServiceError;

use super::{
    direct_work::{
        CODEX_DIRECT_WORK_COMMAND_KIND, CODEX_DIRECT_WORK_MODE, CODEX_DIRECT_WORK_RESULT_TYPE,
    },
    direct_work_validation::{
        DIRECT_WORK_VALIDATION_COMMAND_KIND, DIRECT_WORK_VALIDATION_MODE,
        DIRECT_WORK_VALIDATION_RESULT_TYPE,
    },
    mapping,
    validation::{required_input, validate_widget_ownership},
    AgentExecutorRunDetail, AgentExecutorRunHistory, AgentExecutorRunSummary, WorkspaceService,
    AGENT_RUN_WIDGET_DEFINITION_ID,
};

const DEFAULT_AGENT_EXECUTOR_HISTORY_LIMIT: usize = 20;
const MAX_AGENT_EXECUTOR_HISTORY_LIMIT: usize = 100;
const AGENT_EXECUTOR_RUN_DETAIL_LOG_LIMIT: usize = 100;
const AGENT_EXECUTOR_TEXT_PREVIEW_LIMIT: usize = 16 * 1024;
const AGENT_EXECUTOR_HISTORY_WIDGET_ERROR: &str =
    "Agent Executor run history is only available for Agent Executor widgets.";

impl WorkspaceService {
    pub fn list_agent_executor_runs(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        limit: Option<usize>,
    ) -> Result<Option<AgentExecutorRunHistory>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let limit = normalize_history_limit(limit);

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(None);
        };

        ensure_agent_executor_widget(&widget.definition_id)?;

        let mut runs = Vec::new();
        for run in self
            .store
            .list_widget_runs_for_widget(&widget.id)?
            .into_iter()
            .rev()
        {
            let results = self.store.list_widget_results(&run.id)?;

            if !is_agent_executor_run(&run, &results) {
                continue;
            }

            let result = latest_agent_executor_result(&results);
            let result_payload =
                result.and_then(|result| parse_json_value(result.payload.as_deref()));
            let command_payload = parse_json_value(run.command_payload.as_deref());
            let log_count = self
                .store
                .list_widget_logs(&run.id)?
                .into_iter()
                .filter(|log| log.widget_instance_id == widget.id)
                .count();

            runs.push(agent_executor_run_summary(
                &run,
                result,
                result_payload.as_ref(),
                command_payload.as_ref(),
                Some(log_count),
            ));

            if runs.len() >= limit {
                break;
            }
        }

        Ok(Some(AgentExecutorRunHistory {
            workspace_id: workspace_id.to_owned(),
            workbench_id: workbench_id.to_owned(),
            widget_instance_id: widget.id,
            runs,
        }))
    }

    pub fn get_agent_executor_run_detail(
        &self,
        workspace_id: &str,
        workbench_id: &str,
        widget_instance_id: &str,
        run_id: &str,
    ) -> Result<Option<AgentExecutorRunDetail>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;
        let widget_instance_id = required_input(widget_instance_id, "widget instance id")?;
        let run_id = required_input(run_id, "run id")?;

        let Some((_workspace, _workbench, widget)) =
            validate_widget_ownership(&self.store, workspace_id, workbench_id, widget_instance_id)?
        else {
            return Ok(None);
        };

        ensure_agent_executor_widget(&widget.definition_id)?;

        let Some(run) = self.store.get_widget_run(run_id)? else {
            return Ok(None);
        };

        if run.widget_instance_id != widget.id {
            return Ok(None);
        }

        let results = self.store.list_widget_results(&run.id)?;

        if !is_agent_executor_run(&run, &results) {
            return Ok(None);
        }

        let result = latest_agent_executor_result(&results);
        let result_payload = result.and_then(|result| parse_json_value(result.payload.as_deref()));
        let command_payload = parse_json_value(run.command_payload.as_deref());
        let logs = self
            .store
            .list_recent_widget_logs_for_run(&run.id, AGENT_EXECUTOR_RUN_DETAIL_LOG_LIMIT)?
            .into_iter()
            .filter(|log| log.widget_instance_id == widget.id)
            .map(mapping::widget_log_summary)
            .collect::<Vec<_>>();
        let log_count = self
            .store
            .list_widget_logs(&run.id)?
            .into_iter()
            .filter(|log| log.widget_instance_id == widget.id)
            .count();
        let summary = agent_executor_run_summary(
            &run,
            result,
            result_payload.as_ref(),
            command_payload.as_ref(),
            Some(log_count),
        );

        Ok(Some(agent_executor_run_detail(
            summary,
            result,
            result_payload.as_ref(),
            logs,
        )))
    }
}

fn ensure_agent_executor_widget(definition_id: &str) -> Result<(), WorkspaceServiceError> {
    if definition_id != AGENT_RUN_WIDGET_DEFINITION_ID {
        return Err(WorkspaceServiceError::InvalidInput(
            AGENT_EXECUTOR_HISTORY_WIDGET_ERROR.to_owned(),
        ));
    }

    Ok(())
}

fn normalize_history_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(DEFAULT_AGENT_EXECUTOR_HISTORY_LIMIT)
        .clamp(1, MAX_AGENT_EXECUTOR_HISTORY_LIMIT)
}

fn is_agent_executor_run(run: &WidgetRunRow, results: &[WidgetResultRow]) -> bool {
    is_agent_executor_command(run.command_kind.as_deref())
        || results
            .iter()
            .any(|result| is_agent_executor_result_type(&result.result_type))
}

fn is_agent_executor_command(command_kind: Option<&str>) -> bool {
    matches!(
        command_kind,
        Some(CODEX_DIRECT_WORK_COMMAND_KIND) | Some(DIRECT_WORK_VALIDATION_COMMAND_KIND)
    )
}

fn is_validation_command(command_kind: Option<&str>) -> bool {
    matches!(command_kind, Some(DIRECT_WORK_VALIDATION_COMMAND_KIND))
}

fn is_agent_executor_result_type(result_type: &str) -> bool {
    matches!(
        result_type,
        CODEX_DIRECT_WORK_RESULT_TYPE | DIRECT_WORK_VALIDATION_RESULT_TYPE
    )
}

fn latest_agent_executor_result(results: &[WidgetResultRow]) -> Option<&WidgetResultRow> {
    results
        .iter()
        .rev()
        .find(|result| is_agent_executor_result_type(&result.result_type))
}

fn agent_executor_run_summary(
    run: &WidgetRunRow,
    result: Option<&WidgetResultRow>,
    result_payload: Option<&Value>,
    command_payload: Option<&Value>,
    log_count: Option<usize>,
) -> AgentExecutorRunSummary {
    let mode = string_field(result_payload, "mode")
        .or_else(|| string_field(command_payload, "mode"))
        .or_else(|| default_mode(run.command_kind.as_deref()).map(ToOwned::to_owned));
    let repo_root = string_field(result_payload, "repo_root")
        .or_else(|| string_field(command_payload, "repo_root"))
        .or_else(|| string_field(result_payload, "requested_repo_root"));
    let validation_profile = validation_field(run, result_payload, command_payload, "profile");
    let validation_status = validation_field(run, result_payload, command_payload, "status");

    AgentExecutorRunSummary {
        run_id: run.id.clone(),
        status: run.status.clone(),
        command_kind: run.command_kind.clone(),
        result_type: result.map(|result| result.result_type.clone()),
        started_at: run.started_at.clone(),
        finished_at: run.finished_at.clone(),
        duration_ms: numeric_field(result_payload, "duration_ms"),
        title: result
            .and_then(|result| result.summary.clone())
            .or_else(|| run.summary.clone())
            .unwrap_or_else(|| agent_executor_run_title(mode.as_deref())),
        repo_root,
        mode,
        validation_profile,
        validation_status,
        has_result: result.is_some(),
        log_count,
    }
}

fn agent_executor_run_detail(
    summary: AgentExecutorRunSummary,
    result: Option<&WidgetResultRow>,
    result_payload: Option<&Value>,
    logs: Vec<super::WidgetLogSummary>,
) -> AgentExecutorRunDetail {
    AgentExecutorRunDetail {
        validation_profile: summary.validation_profile.clone(),
        validation_status: summary.validation_status.clone(),
        result_id: result.map(|result| result.id.clone()),
        result_status: result.map(|result| result.status.clone()),
        result_summary: result.and_then(|result| result.summary.clone()),
        result_content: result.and_then(|result| result.content.clone()),
        result_payload: result.and_then(|result| result.payload.clone()),
        final_message: string_field(result_payload, "final_message")
            .or_else(|| result.and_then(|result| result.content.clone())),
        stdout_preview: string_preview_field(result_payload, "stdout"),
        stderr_preview: string_preview_field(result_payload, "stderr"),
        error_message: string_field(result_payload, "error_message"),
        changed_files_summary: changed_files_summary(result_payload),
        summary,
        logs,
    }
}

fn validation_field(
    run: &WidgetRunRow,
    result_payload: Option<&Value>,
    command_payload: Option<&Value>,
    key: &str,
) -> Option<String> {
    if is_validation_command(run.command_kind.as_deref())
        || string_field(result_payload, "mode").as_deref() == Some(DIRECT_WORK_VALIDATION_MODE)
    {
        return string_field(result_payload, key).or_else(|| string_field(command_payload, key));
    }

    None
}

fn default_mode(command_kind: Option<&str>) -> Option<&'static str> {
    match command_kind {
        Some(CODEX_DIRECT_WORK_COMMAND_KIND) => Some(CODEX_DIRECT_WORK_MODE),
        Some(DIRECT_WORK_VALIDATION_COMMAND_KIND) => Some(DIRECT_WORK_VALIDATION_MODE),
        _ => None,
    }
}

fn agent_executor_run_title(mode: Option<&str>) -> String {
    match mode {
        Some(DIRECT_WORK_VALIDATION_MODE) => "Direct Work validation".to_owned(),
        Some(CODEX_DIRECT_WORK_MODE) => "Codex Direct Work".to_owned(),
        _ => "Agent Executor run".to_owned(),
    }
}

fn string_field(value: Option<&Value>, key: &str) -> Option<String> {
    let field = value?.get(key)?;

    match field {
        Value::String(text) if !text.trim().is_empty() => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}

fn numeric_field(value: Option<&Value>, key: &str) -> Option<u64> {
    let field = value?.get(key)?;

    field
        .as_u64()
        .or_else(|| field.as_str().and_then(|text| text.parse::<u64>().ok()))
}

fn string_preview_field(value: Option<&Value>, key: &str) -> Option<String> {
    string_field(value, key).map(|text| {
        if text.len() <= AGENT_EXECUTOR_TEXT_PREVIEW_LIMIT {
            text
        } else {
            text.chars()
                .take(AGENT_EXECUTOR_TEXT_PREVIEW_LIMIT)
                .collect()
        }
    })
}

fn changed_files_summary(value: Option<&Value>) -> Option<String> {
    [
        "changed_files_summary",
        "changed_files",
        "git_changed_files_summary",
    ]
    .into_iter()
    .find_map(|key| value?.get(key).map(Value::to_string))
}

fn parse_json_value(raw: Option<&str>) -> Option<Value> {
    serde_json::from_str(raw?).ok()
}
