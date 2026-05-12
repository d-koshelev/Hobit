use hobit_storage_sqlite::{AgentQueueItemRow, NewAgentQueueItem};
use serde_json::{json, Value};

use crate::WorkspaceServiceError;

use super::{
    agent_monitoring::proposal_result_summary, placeholder_id, validation::required_input,
    AgentQueueItemSummary, AgentQueueProposalActionSummary, AgentQueueSnapshot,
    CreateAgentQueueItemFromProposalInput, WorkspaceService, AGENT_CHAT_PROPOSAL_RESULT_TYPE,
    AGENT_CHAT_WIDGET_DEFINITION_ID, AGENT_QUEUE_DECISION_PENDING_REVIEW,
    AGENT_QUEUE_PROPOSAL_REVIEW_ITEM_KIND, AGENT_QUEUE_STATUS_NEEDS_REVIEW,
};

impl WorkspaceService {
    pub fn create_agent_queue_item_from_proposal(
        &self,
        input: CreateAgentQueueItemFromProposalInput,
    ) -> Result<Option<AgentQueueItemSummary>, WorkspaceServiceError> {
        let input = normalize_create_queue_item_input(input)?;

        self.store
            .with_immediate_transaction(|store| {
                let Some(workspace) = store.get_workspace(&input.workspace_id)? else {
                    return Ok(None);
                };
                let Some(workbench) = store
                    .list_workspace_workbenches(&workspace.id)?
                    .into_iter()
                    .find(|workbench| workbench.id == input.workbench_id)
                else {
                    return Ok(None);
                };
                let Some(result) = store.get_widget_result(&input.source_result_id)? else {
                    return Ok(None);
                };
                let Some(run) = store.get_widget_run(&input.source_run_id)? else {
                    return Ok(None);
                };
                let Some(widget) = store.get_widget_instance(&run.widget_instance_id)? else {
                    return Ok(None);
                };

                if result.run_id != run.id
                    || widget.workspace_id != workspace.id
                    || widget.workbench_id != workbench.id
                    || widget.definition_id != AGENT_CHAT_WIDGET_DEFINITION_ID
                    || result.result_type != AGENT_CHAT_PROPOSAL_RESULT_TYPE
                {
                    return Ok(None);
                }

                let Some(proposal) = proposal_result_summary(&widget, &run, result) else {
                    return Ok(None);
                };
                if has_executed_action(&proposal.proposed_actions) {
                    return Ok(None);
                }

                let item_id = placeholder_id("aqi_");
                let title = queue_item_title(&proposal.proposal_summary);
                let payload_json = queue_item_payload(&item_id, &title, &proposal);
                let item = store.insert_agent_queue_item(NewAgentQueueItem {
                    id: &item_id,
                    workspace_id: &workspace.id,
                    workbench_id: &workbench.id,
                    source_run_id: &proposal.run_id,
                    source_result_id: &proposal.result_id,
                    source_widget_instance_id: &proposal.source_widget_id,
                    title: &title,
                    status: AGENT_QUEUE_STATUS_NEEDS_REVIEW,
                    payload_json: &payload_json,
                    created_at: None,
                    updated_at: None,
                })?;

                append_queue_item_created_event(store, &workspace.id, &item)?;
                store.touch_workspace(&workspace.id)?;

                Ok(agent_queue_item_summary(item))
            })
            .map_err(WorkspaceServiceError::from)
    }

    pub fn get_agent_queue_snapshot(
        &self,
        workspace_id: &str,
        workbench_id: &str,
    ) -> Result<Option<AgentQueueSnapshot>, WorkspaceServiceError> {
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

        let items = self
            .store
            .list_agent_queue_items(&workspace.id, &workbench.id)?
            .into_iter()
            .filter_map(agent_queue_item_summary)
            .collect();

        Ok(Some(AgentQueueSnapshot {
            workspace_id: workspace.id,
            workbench_id: workbench.id,
            items,
        }))
    }
}

#[derive(Clone, Debug)]
struct CreateQueueItemInput {
    workspace_id: String,
    workbench_id: String,
    source_run_id: String,
    source_result_id: String,
}

fn normalize_create_queue_item_input(
    input: CreateAgentQueueItemFromProposalInput,
) -> Result<CreateQueueItemInput, WorkspaceServiceError> {
    Ok(CreateQueueItemInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        workbench_id: required_owned(input.workbench_id, "workbench id")?,
        source_run_id: required_owned(input.source_run_id, "source run id")?,
        source_result_id: required_owned(input.source_result_id, "source result id")?,
    })
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn queue_item_title(proposal_summary: &str) -> String {
    truncate_text(proposal_summary, 96)
}

fn prompt_summary(operator_prompt: &str) -> String {
    truncate_text(operator_prompt, 160)
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_owned();
    }

    let mut truncated = trimmed.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn queue_item_payload(
    item_id: &str,
    title: &str,
    proposal: &super::AgentMonitoringProposalResultSummary,
) -> String {
    json!({
        "item_kind": AGENT_QUEUE_PROPOSAL_REVIEW_ITEM_KIND,
        "id": item_id,
        "title": title,
        "status": AGENT_QUEUE_STATUS_NEEDS_REVIEW,
        "decision_status": AGENT_QUEUE_DECISION_PENDING_REVIEW,
        "source": {
            "proposal_run_id": &proposal.run_id,
            "proposal_result_id": &proposal.result_id,
            "agent_chat_widget_id": &proposal.source_widget_id,
            "agent_chat_widget_title": &proposal.source_widget_title,
        },
        "prompt_summary": prompt_summary(&proposal.operator_prompt),
        "proposal_summary": &proposal.proposal_summary,
        "approved_context_snapshot_summary": &proposal.approved_context_summary,
        "approved_context_status": &proposal.approved_context_status,
        "approved_context_source_labels": &proposal.approved_context_source_labels,
        "proposed_plan": &proposal.proposed_plan,
        "proposed_tool_actions": proposal.proposed_actions.iter().map(|action| {
            json!({
                "title": &action.title,
                "description": &action.description,
                "status": &action.status,
                "executed": action.executed,
            })
        }).collect::<Vec<_>>(),
        "safety_notes": &proposal.safety_notes,
        "safety_flags": {
            "proposal_only_mock": true,
            "no_llm_called": proposal.no_llm_called,
            "no_tools_executed": proposal.no_tools_executed,
            "no_mutations_performed": proposal.no_mutations_performed,
        }
    })
    .to_string()
}

fn agent_queue_item_summary(row: AgentQueueItemRow) -> Option<AgentQueueItemSummary> {
    let payload = serde_json::from_str::<Value>(&row.payload_json).ok()?;
    if string_field(&payload, &["item_kind"])? != AGENT_QUEUE_PROPOSAL_REVIEW_ITEM_KIND {
        return None;
    }

    let source = payload.get("source")?;
    let safety_flags = payload.get("safety_flags")?;
    let proposal_only_mock = bool_field(safety_flags, &["proposal_only_mock"])?;
    let no_llm_called = bool_field(safety_flags, &["no_llm_called"])?;
    let no_tools_executed = bool_field(safety_flags, &["no_tools_executed"])?;
    let no_mutations_performed = bool_field(safety_flags, &["no_mutations_performed"])?;

    if !proposal_only_mock || !no_llm_called || !no_tools_executed || !no_mutations_performed {
        return None;
    }

    let proposed_actions = proposal_actions(payload.get("proposed_tool_actions")?)?;
    if has_executed_queue_action(&proposed_actions) {
        return None;
    }

    Some(AgentQueueItemSummary {
        id: row.id,
        workspace_id: row.workspace_id,
        workbench_id: row.workbench_id,
        source_run_id: row.source_run_id,
        source_result_id: row.source_result_id,
        source_widget_instance_id: row.source_widget_instance_id,
        source_widget_title: string_field(source, &["agent_chat_widget_title"])?,
        title: row.title,
        status: row.status,
        decision_status: string_field(&payload, &["decision_status"])?,
        prompt_summary: string_field(&payload, &["prompt_summary"])?,
        proposal_summary: string_field(&payload, &["proposal_summary"])?,
        approved_context_summary: string_field(&payload, &["approved_context_snapshot_summary"])?,
        proposed_plan: string_array_field(&payload, &["proposed_plan"])?,
        proposed_actions,
        proposal_only_mock,
        no_llm_called,
        no_tools_executed,
        no_mutations_performed,
        created_at: row.created_at,
        updated_at: row.updated_at,
        payload_json: row.payload_json,
    })
}

fn append_queue_item_created_event(
    store: &hobit_storage_sqlite::SqliteStore,
    workspace_id: &str,
    item: &AgentQueueItemRow,
) -> Result<(), hobit_storage_sqlite::StorageError> {
    let event_id = placeholder_id("evt_");
    let payload = json!({
        "queue_item_id": &item.id,
        "source_run_id": &item.source_run_id,
        "source_result_id": &item.source_result_id,
        "status": &item.status,
        "review_only": true,
        "no_tools_executed": true,
    })
    .to_string();

    store.append_workbench_event(
        &event_id,
        workspace_id,
        "agent_queue_item_created",
        "Agent Queue review item created",
        Some(&payload),
    )?;
    Ok(())
}

fn proposal_actions(value: &Value) -> Option<Vec<AgentQueueProposalActionSummary>> {
    value
        .as_array()?
        .iter()
        .map(|action| {
            Some(AgentQueueProposalActionSummary {
                title: string_field(action, &["title"])?,
                description: string_field(action, &["description"])?,
                status: string_field(action, &["status"])?,
                executed: bool_field(action, &["executed"])?,
            })
        })
        .collect()
}

fn has_executed_action(actions: &[super::AgentMonitoringProposalActionSummary]) -> bool {
    actions
        .iter()
        .any(|action| action.executed || action.status != "not_executed")
}

fn has_executed_queue_action(actions: &[AgentQueueProposalActionSummary]) -> bool {
    actions
        .iter()
        .any(|action| action.executed || action.status != "not_executed")
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
