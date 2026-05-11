use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{NewWidgetLog, NewWidgetResult, NewWidgetRun, WidgetRunFinishUpdate};
use serde_json::{json, Value};

use crate::WorkspaceServiceError;

use super::{
    placeholder_id,
    runs::widget_run_status_value,
    validation::{required_input, validate_widget_ownership},
    AgentChatProposalActionInput, AgentChatProposalInput, AgentChatProposalRunSummary,
    PersistAgentChatProposalInput, WorkspaceService, AGENT_CHAT_WIDGET_DEFINITION_ID,
    WIDGET_LOG_INFO_LEVEL, WIDGET_RUN_STARTED_STATUS,
};

const AGENT_CHAT_PROPOSAL_COMMAND_KIND: &str = "agent_chat_mock_proposal";
const AGENT_CHAT_PROPOSAL_RESULT_TYPE: &str = "agent_chat_mock_proposal_result";
const AGENT_CHAT_PROPOSAL_RESULT_SUMMARY: &str = "Agent Chat proposal-only mock result persisted";
const AGENT_CHAT_PROPOSAL_RESULT_CONTENT: &str =
    "Proposal-only mock. No LLM called, no tools executed, and no mutations performed.";

impl WorkspaceService {
    pub fn persist_agent_chat_proposal(
        &self,
        input: PersistAgentChatProposalInput,
    ) -> Result<Option<AgentChatProposalRunSummary>, WorkspaceServiceError> {
        let input = normalize_agent_chat_proposal_input(input)?;
        let command_payload = agent_chat_proposal_command_payload(&input);
        let result_payload = agent_chat_proposal_result_payload(&input);
        let completed_status = widget_run_status_value(&WidgetRunStatus::Completed);

        self.store
            .with_immediate_transaction(|store| {
                let Some((workspace, _workbench, widget)) = validate_widget_ownership(
                    store,
                    &input.workspace_id,
                    &input.workbench_id,
                    &input.widget_instance_id,
                )?
                else {
                    return Ok(None);
                };

                if widget.definition_id != AGENT_CHAT_WIDGET_DEFINITION_ID {
                    return Ok(None);
                }

                let run_id = placeholder_id("wrun_");
                let run = store.insert_widget_run(NewWidgetRun {
                    id: &run_id,
                    widget_instance_id: &widget.id,
                    status: widget_run_status_value(&WIDGET_RUN_STARTED_STATUS),
                    command_kind: Some(AGENT_CHAT_PROPOSAL_COMMAND_KIND),
                    command_payload: Some(&command_payload),
                    started_at: None,
                    finished_at: None,
                    summary: Some("Agent Chat proposal-only mock running"),
                })?;

                append_agent_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent proposal prompt received",
                    Some(&prompt_received_log_payload(&input)),
                )?;
                append_agent_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent proposal approved context snapshot captured",
                    Some(&context_snapshot_log_payload(&input)),
                )?;
                append_agent_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent proposal-only mock generated",
                    Some(&proposal_generated_log_payload(&input)),
                )?;

                let run = store.finish_widget_run(
                    &run.id,
                    WidgetRunFinishUpdate {
                        status: completed_status,
                        finished_at: None,
                        summary: Some(AGENT_CHAT_PROPOSAL_RESULT_SUMMARY),
                    },
                )?;
                let result_id = placeholder_id("wres_");
                let result = store.insert_widget_result(NewWidgetResult {
                    id: &result_id,
                    run_id: &run.id,
                    status: completed_status,
                    result_type: Some(AGENT_CHAT_PROPOSAL_RESULT_TYPE),
                    summary: Some(AGENT_CHAT_PROPOSAL_RESULT_SUMMARY),
                    content: Some(AGENT_CHAT_PROPOSAL_RESULT_CONTENT),
                    payload: Some(&result_payload),
                    created_at: None,
                })?;

                append_agent_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent proposal persisted",
                    Some(&proposal_persisted_log_payload(&run.id, &result.id)),
                )?;
                append_agent_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent proposal no tools executed",
                    Some(&no_tools_executed_log_payload()),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(AgentChatProposalRunSummary {
                    run_id: run.id,
                    status: run.status,
                    result_id: result.id,
                    result_type: result.result_type,
                    summary: result
                        .summary
                        .unwrap_or_else(|| AGENT_CHAT_PROPOSAL_RESULT_SUMMARY.to_owned()),
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }
}

#[derive(Clone, Debug)]
struct NormalizedAgentChatProposalInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    operator_prompt: String,
    approved_context_snapshot: Value,
    proposal: NormalizedAgentChatProposal,
}

#[derive(Clone, Debug)]
struct NormalizedAgentChatProposal {
    id: String,
    request_summary: String,
    proposed_plan: Vec<String>,
    context_needed: Vec<String>,
    action_proposals: Vec<NormalizedAgentChatProposalAction>,
    safety_notes: Vec<String>,
    runtime_notes: Vec<String>,
}

#[derive(Clone, Debug)]
struct NormalizedAgentChatProposalAction {
    title: String,
    description: String,
}

fn normalize_agent_chat_proposal_input(
    input: PersistAgentChatProposalInput,
) -> Result<NormalizedAgentChatProposalInput, WorkspaceServiceError> {
    let approved_context_snapshot =
        parse_approved_context_snapshot(&input.approved_context_snapshot_json)?;

    Ok(NormalizedAgentChatProposalInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        workbench_id: required_owned(input.workbench_id, "workbench id")?,
        widget_instance_id: required_owned(input.widget_instance_id, "widget instance id")?,
        operator_prompt: required_owned(input.operator_prompt, "operator prompt")?,
        approved_context_snapshot,
        proposal: normalize_agent_chat_proposal(input.proposal)?,
    })
}

fn normalize_agent_chat_proposal(
    proposal: AgentChatProposalInput,
) -> Result<NormalizedAgentChatProposal, WorkspaceServiceError> {
    Ok(NormalizedAgentChatProposal {
        id: required_owned(proposal.id, "proposal id")?,
        request_summary: required_owned(proposal.request_summary, "proposal request summary")?,
        proposed_plan: required_list(proposal.proposed_plan, "proposal proposed plan")?,
        context_needed: required_list(proposal.context_needed, "proposal context needed")?,
        action_proposals: proposal
            .action_proposals
            .into_iter()
            .map(normalize_agent_chat_proposal_action)
            .collect::<Result<Vec<_>, _>>()?,
        safety_notes: required_list(proposal.safety_notes, "proposal safety notes")?,
        runtime_notes: required_list(proposal.runtime_notes, "proposal runtime notes")?,
    })
}

fn normalize_agent_chat_proposal_action(
    action: AgentChatProposalActionInput,
) -> Result<NormalizedAgentChatProposalAction, WorkspaceServiceError> {
    Ok(NormalizedAgentChatProposalAction {
        title: required_owned(action.title, "proposal action title")?,
        description: required_owned(action.description, "proposal action description")?,
    })
}

fn parse_approved_context_snapshot(value: &str) -> Result<Value, WorkspaceServiceError> {
    let value = required_input(value, "approved context snapshot")?;

    serde_json::from_str(value).map_err(|error| {
        WorkspaceServiceError::InvalidInput(format!(
            "approved context snapshot must be valid JSON: {error}"
        ))
    })
}

fn required_owned(value: String, label: &str) -> Result<String, WorkspaceServiceError> {
    required_input(&value, label).map(str::to_owned)
}

fn required_list(values: Vec<String>, label: &str) -> Result<Vec<String>, WorkspaceServiceError> {
    let values = values
        .into_iter()
        .map(|value| required_owned(value, label))
        .collect::<Result<Vec<_>, _>>()?;

    if values.is_empty() {
        return Err(WorkspaceServiceError::InvalidInput(format!(
            "{label} must not be empty"
        )));
    }

    Ok(values)
}

fn agent_chat_proposal_command_payload(input: &NormalizedAgentChatProposalInput) -> String {
    json!({
        "command_kind": AGENT_CHAT_PROPOSAL_COMMAND_KIND,
        "operator_prompt": &input.operator_prompt,
        "approved_context_snapshot": &input.approved_context_snapshot,
        "proposal_id": &input.proposal.id,
        "runtime_status": "proposal_only_mock",
        "no_llm_called": true,
        "no_tools_executed": true,
        "no_mutations_performed": true,
    })
    .to_string()
}

fn agent_chat_proposal_result_payload(input: &NormalizedAgentChatProposalInput) -> String {
    json!({
        "operator_prompt": &input.operator_prompt,
        "approved_context_snapshot": &input.approved_context_snapshot,
        "proposal": {
            "id": &input.proposal.id,
            "request_summary": &input.proposal.request_summary,
            "proposed_plan": &input.proposal.proposed_plan,
            "context_needed": &input.proposal.context_needed,
            "proposed_tool_actions": action_proposal_payloads(&input.proposal.action_proposals),
            "safety_notes": &input.proposal.safety_notes,
            "runtime_notes": &input.proposal.runtime_notes,
        },
        "runtime_status": "proposal_only_mock",
        "no_llm_called": true,
        "no_tools_executed": true,
        "no_mutations_performed": true,
    })
    .to_string()
}

fn action_proposal_payloads(actions: &[NormalizedAgentChatProposalAction]) -> Vec<Value> {
    actions
        .iter()
        .map(|action| {
            json!({
                "title": &action.title,
                "description": &action.description,
                "status": "not_executed",
                "executed": false,
            })
        })
        .collect()
}

fn prompt_received_log_payload(input: &NormalizedAgentChatProposalInput) -> String {
    json!({
        "runtime_status": "proposal_only_mock",
        "prompt_length": input.operator_prompt.chars().count(),
    })
    .to_string()
}

fn context_snapshot_log_payload(input: &NormalizedAgentChatProposalInput) -> String {
    json!({
        "runtime_status": "proposal_only_mock",
        "context_status": input
            .approved_context_snapshot
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("unknown"),
        "source_labels": input
            .approved_context_snapshot
            .get("sourceLabels")
            .or_else(|| input.approved_context_snapshot.get("source_labels")),
    })
    .to_string()
}

fn proposal_generated_log_payload(input: &NormalizedAgentChatProposalInput) -> String {
    json!({
        "runtime_status": "proposal_only_mock",
        "proposal_id": &input.proposal.id,
        "proposed_plan_count": input.proposal.proposed_plan.len(),
        "action_proposal_count": input.proposal.action_proposals.len(),
        "no_llm_called": true,
    })
    .to_string()
}

fn proposal_persisted_log_payload(run_id: &str, result_id: &str) -> String {
    json!({
        "runtime_status": "proposal_only_mock",
        "run_id": run_id,
        "result_id": result_id,
    })
    .to_string()
}

fn no_tools_executed_log_payload() -> String {
    json!({
        "runtime_status": "proposal_only_mock",
        "no_tools_executed": true,
        "no_mutations_performed": true,
        "no_llm_called": true,
    })
    .to_string()
}

fn append_agent_proposal_log(
    store: &hobit_storage_sqlite::SqliteStore,
    widget_instance_id: &str,
    run_id: &str,
    message: &str,
    details: Option<&str>,
) -> Result<(), hobit_storage_sqlite::StorageError> {
    let log_id = placeholder_id("wlog_");
    store.append_widget_log(NewWidgetLog {
        id: &log_id,
        widget_instance_id,
        run_id: Some(run_id),
        level: WIDGET_LOG_INFO_LEVEL,
        message,
        created_at: None,
        details,
    })?;
    Ok(())
}
