use hobit_storage_sqlite::{WidgetInstanceRow, WidgetResultRow, WidgetRunRow};
use serde_json::Value;

use crate::WorkspaceServiceError;

use super::{
    validation::required_input, AgentMonitoringProposalActionSummary,
    AgentMonitoringProposalResultSummary, AgentMonitoringSnapshot, WorkspaceService,
    AGENT_CHAT_PROPOSAL_RESULT_TYPE, AGENT_CHAT_PROPOSAL_RUNTIME_STATUS,
    AGENT_CHAT_WIDGET_DEFINITION_ID,
};

impl WorkspaceService {
    pub fn get_agent_monitoring_snapshot(
        &self,
        workspace_id: &str,
        workbench_id: &str,
    ) -> Result<Option<AgentMonitoringSnapshot>, WorkspaceServiceError> {
        let workspace_id = required_input(workspace_id, "workspace id")?;
        let workbench_id = required_input(workbench_id, "workbench id")?;

        let Some(workspace) = self.store.get_workspace(workspace_id)? else {
            return Ok(None);
        };

        let Some(workbench) = self
            .store
            .list_workspace_workbenches(&workspace.id)?
            .into_iter()
            .find(|workbench| workbench.id == workbench_id)
        else {
            return Ok(None);
        };

        let widgets = self
            .store
            .list_widget_instances_for_workbench(&workbench.id)?;
        let mut proposal_results = Vec::new();

        for widget in widgets
            .iter()
            .filter(|widget| widget.definition_id == AGENT_CHAT_WIDGET_DEFINITION_ID)
        {
            for run in self.store.list_widget_runs_for_widget(&widget.id)? {
                for result in self.store.list_widget_results(&run.id)? {
                    if let Some(summary) = proposal_result_summary(widget, &run, result) {
                        proposal_results.push(summary);
                    }
                }
            }
        }

        proposal_results.sort_by(|left, right| {
            right
                .result_created_at
                .cmp(&left.result_created_at)
                .then_with(|| right.run_id.cmp(&left.run_id))
                .then_with(|| right.result_id.cmp(&left.result_id))
        });

        Ok(Some(AgentMonitoringSnapshot {
            workspace_id: workspace.id,
            workbench_id: workbench.id,
            proposal_results,
        }))
    }
}

fn proposal_result_summary(
    widget: &WidgetInstanceRow,
    run: &WidgetRunRow,
    result: WidgetResultRow,
) -> Option<AgentMonitoringProposalResultSummary> {
    if result.result_type != AGENT_CHAT_PROPOSAL_RESULT_TYPE {
        return None;
    }

    let raw_payload = result.payload.clone()?;
    let payload = serde_json::from_str::<Value>(&raw_payload).ok()?;

    if string_field(&payload, &["runtime_status"])? != AGENT_CHAT_PROPOSAL_RUNTIME_STATUS {
        return None;
    }

    let no_llm_called = bool_field(&payload, &["no_llm_called"])?;
    let no_tools_executed = bool_field(&payload, &["no_tools_executed"])?;
    let no_mutations_performed = bool_field(&payload, &["no_mutations_performed"])?;

    if !no_llm_called || !no_tools_executed || !no_mutations_performed {
        return None;
    }

    let proposal = payload.get("proposal")?;
    let approved_context = payload.get("approved_context_snapshot")?;

    Some(AgentMonitoringProposalResultSummary {
        run_id: run.id.clone(),
        result_id: result.id,
        status: result.status,
        result_type: result.result_type,
        result_summary: result.summary,
        result_content: result.content,
        run_started_at: run.started_at.clone(),
        run_finished_at: run.finished_at.clone(),
        result_created_at: result.created_at,
        source_widget_id: widget.id.clone(),
        source_widget_title: widget.title.clone(),
        runtime_status: AGENT_CHAT_PROPOSAL_RUNTIME_STATUS.to_owned(),
        no_llm_called,
        no_tools_executed,
        no_mutations_performed,
        operator_prompt: string_field(&payload, &["operator_prompt"])?,
        proposal_summary: string_field(proposal, &["request_summary"])?,
        proposed_plan: string_array_field(proposal, &["proposed_plan"])?,
        context_needed: string_array_field(proposal, &["context_needed"])?,
        approved_context_summary: string_field(approved_context, &["summary"])
            .unwrap_or_else(|| "No approved context summary stored.".to_owned()),
        approved_context_status: string_field(approved_context, &["status"])
            .unwrap_or_else(|| "unknown".to_owned()),
        approved_context_source_labels: string_array_field(approved_context, &["sourceLabels"])
            .or_else(|| string_array_field(approved_context, &["source_labels"]))
            .unwrap_or_default(),
        proposed_actions: proposal_actions(proposal.get("proposed_tool_actions")?)?,
        safety_notes: string_array_field(proposal, &["safety_notes"])?,
        raw_payload,
    })
}

fn proposal_actions(value: &Value) -> Option<Vec<AgentMonitoringProposalActionSummary>> {
    value
        .as_array()?
        .iter()
        .map(|action| {
            Some(AgentMonitoringProposalActionSummary {
                title: string_field(action, &["title"])?,
                description: string_field(action, &["description"])?,
                status: string_field(action, &["status"])?,
                executed: bool_field(action, &["executed"])?,
            })
        })
        .collect()
}

fn string_field(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;

    for segment in path {
        current = current.get(*segment)?;
    }

    current.as_str().map(str::to_owned)
}

fn bool_field(value: &Value, path: &[&str]) -> Option<bool> {
    let mut current = value;

    for segment in path {
        current = current.get(*segment)?;
    }

    current.as_bool()
}

fn string_array_field(value: &Value, path: &[&str]) -> Option<Vec<String>> {
    let mut current = value;

    for segment in path {
        current = current.get(*segment)?;
    }

    current
        .as_array()?
        .iter()
        .map(|item| item.as_str().map(str::to_owned))
        .collect()
}
