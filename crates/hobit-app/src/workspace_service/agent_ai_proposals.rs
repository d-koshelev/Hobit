use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{NewWidgetLog, NewWidgetResult, NewWidgetRun, WidgetRunFinishUpdate};
use serde_json::{json, Value};

use crate::WorkspaceServiceError;

use super::{
    placeholder_id, placeholder_timestamp,
    runs::widget_run_status_value,
    validation::{required_input, validate_widget_ownership},
    AgentChatAiProposalProvider, AgentChatAiProposalRunSummary, AgentChatAiProviderOutcome,
    AgentChatAiRequestArtifact, AgentChatProposalActionInput, AgentChatProposalInput,
    AgentChatProposalRunSummary, GenerateAgentChatAiProposalInput, WorkspaceService,
    AGENT_CHAT_AI_PROPOSAL_COMMAND_KIND, AGENT_CHAT_AI_PROPOSAL_RESULT_TYPE,
    AGENT_CHAT_WIDGET_DEFINITION_ID, WIDGET_LOG_INFO_LEVEL, WIDGET_RUN_STARTED_STATUS,
};

const AI_PROPOSAL_RESULT_SUMMARY: &str = "Agent Chat AI proposal-only result persisted";
const AI_PROPOSAL_RESULT_CONTENT: &str =
    "AI proposal-only artifact. No tools executed and no mutations performed.";
const RUNTIME_AI_PROPOSAL_ONLY: &str = "ai_proposal_only";
const RUNTIME_PROVIDER_FALLBACK: &str = "provider_unavailable_fallback";
const RUNTIME_PARSE_FALLBACK: &str = "provider_parse_fallback";
const PROVIDER_STATUS_COMPLETED: &str = "completed";
const PROVIDER_STATUS_NOT_CONFIGURED: &str = "not_configured";
const PROVIDER_STATUS_REQUEST_FAILED: &str = "request_failed";
const PROVIDER_STATUS_PARSE_FAILED: &str = "parse_failed";
const MAX_RAW_PROVIDER_RESPONSE_CHARS: usize = 16_000;

impl WorkspaceService {
    pub fn generate_agent_chat_ai_proposal(
        &self,
        input: GenerateAgentChatAiProposalInput,
        provider: &dyn AgentChatAiProposalProvider,
    ) -> Result<Option<AgentChatAiProposalRunSummary>, WorkspaceServiceError> {
        let input = normalize_generate_ai_input(input)?;

        let Some((_workspace, _workbench, widget)) = validate_widget_ownership(
            &self.store,
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

        let artifact = request_artifact(&input);
        let outcome = provider.request_agent_chat_ai_proposal(&artifact);
        let generated = normalize_provider_outcome(&artifact, outcome);

        self.persist_generated_ai_proposal(input, artifact, generated)
    }

    fn persist_generated_ai_proposal(
        &self,
        input: NormalizedGenerateAiProposalInput,
        artifact: AgentChatAiRequestArtifact,
        generated: GeneratedAiProposal,
    ) -> Result<Option<AgentChatAiProposalRunSummary>, WorkspaceServiceError> {
        let command_payload = ai_command_payload(&artifact, &generated);
        let result_payload = ai_result_payload(&input, &artifact, &generated);
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
                    command_kind: Some(AGENT_CHAT_AI_PROPOSAL_COMMAND_KIND),
                    command_payload: Some(&command_payload),
                    started_at: None,
                    finished_at: None,
                    summary: Some("Agent Chat AI proposal-only request running"),
                })?;

                append_ai_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent Chat AI request artifact built",
                    Some(&artifact_log_payload(&artifact)),
                )?;
                append_ai_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent Chat AI proposal normalized",
                    Some(&normalization_log_payload(&generated)),
                )?;

                let run = store.finish_widget_run(
                    &run.id,
                    WidgetRunFinishUpdate {
                        status: completed_status,
                        finished_at: None,
                        summary: Some(AI_PROPOSAL_RESULT_SUMMARY),
                    },
                )?;
                let result_id = placeholder_id("wres_");
                let result = store.insert_widget_result(NewWidgetResult {
                    id: &result_id,
                    run_id: &run.id,
                    status: completed_status,
                    result_type: Some(AGENT_CHAT_AI_PROPOSAL_RESULT_TYPE),
                    summary: Some(AI_PROPOSAL_RESULT_SUMMARY),
                    content: Some(AI_PROPOSAL_RESULT_CONTENT),
                    payload: Some(&result_payload),
                    created_at: None,
                })?;

                append_ai_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent Chat AI proposal persisted",
                    Some(&persisted_log_payload(&run.id, &result.id, &generated)),
                )?;
                append_ai_proposal_log(
                    store,
                    &widget.id,
                    &run.id,
                    "Agent Chat AI proposal no tools executed",
                    Some(&safety_log_payload(&generated)),
                )?;
                store.touch_workspace(&workspace.id)?;

                Ok(Some(AgentChatAiProposalRunSummary {
                    run: AgentChatProposalRunSummary {
                        run_id: run.id,
                        status: run.status,
                        result_id: result.id,
                        result_type: result.result_type,
                        summary: result
                            .summary
                            .unwrap_or_else(|| AI_PROPOSAL_RESULT_SUMMARY.to_owned()),
                    },
                    proposal: generated.proposal,
                    runtime_status: generated.runtime_status,
                    provider_status: generated.provider_status,
                    provider_used: generated.provider_used,
                    provider_response_received: generated.provider_response_received,
                    no_tools_executed: true,
                    no_mutations_performed: true,
                    context_was_approved: true,
                    normalization_warnings: generated.normalization_warnings,
                }))
            })
            .map_err(WorkspaceServiceError::from)
    }
}

#[derive(Clone, Debug)]
struct NormalizedGenerateAiProposalInput {
    workspace_id: String,
    workbench_id: String,
    widget_instance_id: String,
    operator_prompt: String,
    approved_context_snapshot: Value,
}

#[derive(Clone, Debug)]
struct GeneratedAiProposal {
    proposal: AgentChatProposalInput,
    runtime_status: String,
    provider_status: String,
    provider_configured: bool,
    provider_used: bool,
    provider_response_received: bool,
    no_llm_called: bool,
    raw_provider_response: Option<String>,
    provider_error: Option<String>,
    normalization_warnings: Vec<String>,
}

fn normalize_generate_ai_input(
    input: GenerateAgentChatAiProposalInput,
) -> Result<NormalizedGenerateAiProposalInput, WorkspaceServiceError> {
    Ok(NormalizedGenerateAiProposalInput {
        workspace_id: required_owned(input.workspace_id, "workspace id")?,
        workbench_id: required_owned(input.workbench_id, "workbench id")?,
        widget_instance_id: required_owned(input.widget_instance_id, "widget instance id")?,
        operator_prompt: required_owned(input.operator_prompt, "operator prompt")?,
        approved_context_snapshot: parse_approved_context_snapshot(
            &input.approved_context_snapshot_json,
        )?,
    })
}

fn request_artifact(input: &NormalizedGenerateAiProposalInput) -> AgentChatAiRequestArtifact {
    AgentChatAiRequestArtifact {
        request_id: placeholder_id("aipreq_"),
        workspace_id: input.workspace_id.clone(),
        workbench_id: input.workbench_id.clone(),
        source_widget_instance_id: input.widget_instance_id.clone(),
        operator_prompt: input.operator_prompt.clone(),
        approved_context_snapshot: input.approved_context_snapshot.clone(),
        contract_pack_summary: vec![
            "Proposal-only Agent Chat response.".to_owned(),
            "Use only the explicitly approved context snapshot.".to_owned(),
            "No tools, Terminal, Git, Notes, file, Queue, or external-system execution.".to_owned(),
            "No Workspace, widget, file, Notes, Git, Queue, or external mutation.".to_owned(),
            "Actions are proposals only and must remain not_executed.".to_owned(),
        ],
        allowed_tools: Vec::new(),
        safety_constraints: vec![
            "Return proposal content only.".to_owned(),
            "Do not request or imply tool execution.".to_owned(),
            "Do not claim changes were applied.".to_owned(),
            "Do not use hidden context, secrets, environment values, logs, files, Notes, Git status, or Terminal output.".to_owned(),
        ],
        expected_response_format: vec![
            "summary: string".to_owned(),
            "proposed_next_steps: string[]".to_owned(),
            "context_needed: string[]".to_owned(),
            "tool_action_proposals: { title, description, execution_status: not_executed }[]".to_owned(),
            "risks_and_approval_notes: string[]".to_owned(),
            "runtime_status: string".to_owned(),
            "safety_flags: string[] or object".to_owned(),
        ],
        validation_plan: vec![
            "Normalize the response into the Agent Chat proposal shape.".to_owned(),
            "Force every proposed action to not_executed.".to_owned(),
            "Persist a visible proposal-only run/result artifact.".to_owned(),
            "Keep no_tools_executed and no_mutations_performed true.".to_owned(),
        ],
        created_at: placeholder_timestamp(),
    }
}

fn normalize_provider_outcome(
    artifact: &AgentChatAiRequestArtifact,
    outcome: AgentChatAiProviderOutcome,
) -> GeneratedAiProposal {
    match outcome {
        AgentChatAiProviderOutcome::Response { raw_response } => {
            normalize_provider_response(artifact, raw_response)
        }
        AgentChatAiProviderOutcome::NotConfigured { message } => fallback_generated_proposal(
            artifact,
            RUNTIME_PROVIDER_FALLBACK,
            PROVIDER_STATUS_NOT_CONFIGURED,
            false,
            true,
            Some(message),
            "AI provider is not configured; local fallback proposal generated.",
        ),
        AgentChatAiProviderOutcome::RequestFailed { message } => fallback_generated_proposal(
            artifact,
            RUNTIME_PROVIDER_FALLBACK,
            PROVIDER_STATUS_REQUEST_FAILED,
            true,
            false,
            Some(message),
            "AI provider request failed; fallback proposal generated.",
        ),
    }
}

fn normalize_provider_response(
    artifact: &AgentChatAiRequestArtifact,
    raw_response: String,
) -> GeneratedAiProposal {
    let raw_response = truncate_for_storage(raw_response, MAX_RAW_PROVIDER_RESPONSE_CHARS);
    let parsed = parse_provider_json(&raw_response);

    let Ok(value) = parsed else {
        return fallback_generated_proposal(
            artifact,
            RUNTIME_PARSE_FALLBACK,
            PROVIDER_STATUS_PARSE_FAILED,
            true,
            false,
            Some("Provider response was not valid structured JSON.".to_owned()),
            "AI provider response could not be parsed; raw text was preserved.",
        )
        .with_raw_response(raw_response);
    };

    let mut warnings = Vec::new();
    let actions = proposal_actions(&value, &mut warnings);
    let proposal = AgentChatProposalInput {
        id: placeholder_id("agent-chat-ai-proposal-"),
        request_summary: string_field(&value, "summary")
            .unwrap_or_else(|| "AI proposal-only response.".to_owned()),
        proposed_plan: string_array_field(&value, "proposed_next_steps")
            .or_else(|| string_array_field(&value, "proposed_plan"))
            .unwrap_or_else(|| vec!["Review the AI-generated proposal.".to_owned()]),
        context_needed: string_array_field(&value, "context_needed").unwrap_or_else(|| {
            vec!["No additional hidden context was requested or used.".to_owned()]
        }),
        action_proposals: if actions.is_empty() {
            vec![AgentChatProposalActionInput {
                title: "No tool action executed".to_owned(),
                description: "The AI provider response did not execute tools.".to_owned(),
            }]
        } else {
            actions
        },
        safety_notes: string_array_field(&value, "risks_and_approval_notes")
            .or_else(|| string_array_field(&value, "safety_notes"))
            .unwrap_or_else(|| {
                vec![
                    "Proposal only. Operator approval is still required before any future action."
                        .to_owned(),
                ]
            }),
        runtime_notes: vec![
            "AI-generated proposal-only response.".to_owned(),
            "No tools were executed.".to_owned(),
            "No workspace content mutation was performed.".to_owned(),
            format!("Provider status: {PROVIDER_STATUS_COMPLETED}."),
        ],
    };

    GeneratedAiProposal {
        proposal,
        runtime_status: RUNTIME_AI_PROPOSAL_ONLY.to_owned(),
        provider_status: PROVIDER_STATUS_COMPLETED.to_owned(),
        provider_configured: true,
        provider_used: true,
        provider_response_received: true,
        no_llm_called: false,
        raw_provider_response: Some(raw_response),
        provider_error: None,
        normalization_warnings: warnings,
    }
}

fn fallback_generated_proposal(
    artifact: &AgentChatAiRequestArtifact,
    runtime_status: &str,
    provider_status: &str,
    provider_configured: bool,
    no_llm_called: bool,
    provider_error: Option<String>,
    summary: &str,
) -> GeneratedAiProposal {
    let context_summary = artifact
        .approved_context_snapshot
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Approved context snapshot was captured.");

    GeneratedAiProposal {
        proposal: AgentChatProposalInput {
            id: placeholder_id("agent-chat-ai-fallback-proposal-"),
            request_summary: summary.to_owned(),
            proposed_plan: vec![
                "Review the prompt and approved context snapshot.".to_owned(),
                "Configure the AI provider or continue with the local proposal fallback.".to_owned(),
                "Keep any future action as an operator-reviewed proposal before execution.".to_owned(),
            ],
            context_needed: vec![
                context_summary.to_owned(),
                "No hidden context, files, Notes, Git status, Terminal output, logs, or secrets were included.".to_owned(),
            ],
            action_proposals: vec![AgentChatProposalActionInput {
                title: "No tool action executed".to_owned(),
                description:
                    "The provider fallback did not run Terminal, Git, Notes, files, Queue, scripts, or external tools."
                        .to_owned(),
            }],
            safety_notes: vec![
                "Proposal only. This does not approve, queue, apply, or execute anything.".to_owned(),
                "No tools executed and no workspace content mutation was performed.".to_owned(),
            ],
            runtime_notes: vec![
                format!("Runtime status: {runtime_status}."),
                format!("Provider status: {provider_status}."),
                "Fallback proposal persisted for read-only Agent Monitoring inspection.".to_owned(),
            ],
        },
        runtime_status: runtime_status.to_owned(),
        provider_status: provider_status.to_owned(),
        provider_configured,
        provider_used: false,
        provider_response_received: false,
        no_llm_called,
        raw_provider_response: None,
        provider_error,
        normalization_warnings: Vec::new(),
    }
}

impl GeneratedAiProposal {
    fn with_raw_response(mut self, raw_response: String) -> Self {
        self.raw_provider_response = Some(raw_response);
        self.provider_response_received = true;
        self.provider_used = true;
        self.no_llm_called = false;
        self.normalization_warnings
            .push("Provider response was preserved as raw text after parse failure.".to_owned());
        self
    }
}

fn ai_command_payload(
    artifact: &AgentChatAiRequestArtifact,
    generated: &GeneratedAiProposal,
) -> String {
    json!({
        "command_kind": AGENT_CHAT_AI_PROPOSAL_COMMAND_KIND,
        "request_artifact": artifact_payload(artifact),
        "runtime_status": &generated.runtime_status,
        "provider_status": &generated.provider_status,
        "provider_used": generated.provider_used,
        "allowed_tools": [],
        "no_tools_executed": true,
        "no_mutations_performed": true,
        "context_was_approved": true,
    })
    .to_string()
}

fn ai_result_payload(
    input: &NormalizedGenerateAiProposalInput,
    artifact: &AgentChatAiRequestArtifact,
    generated: &GeneratedAiProposal,
) -> String {
    json!({
        "operator_prompt": &input.operator_prompt,
        "approved_context_snapshot": &input.approved_context_snapshot,
        "request_artifact": artifact_payload(artifact),
        "proposal": {
            "id": &generated.proposal.id,
            "request_summary": &generated.proposal.request_summary,
            "proposed_plan": &generated.proposal.proposed_plan,
            "context_needed": &generated.proposal.context_needed,
            "proposed_tool_actions": action_proposal_payloads(&generated.proposal.action_proposals),
            "safety_notes": &generated.proposal.safety_notes,
            "runtime_notes": &generated.proposal.runtime_notes,
        },
        "runtime_status": &generated.runtime_status,
        "provider_status": &generated.provider_status,
        "provider_configured": generated.provider_configured,
        "provider_used": generated.provider_used,
        "provider_response_received": generated.provider_response_received,
        "provider_error": &generated.provider_error,
        "raw_provider_response": &generated.raw_provider_response,
        "normalization_warnings": &generated.normalization_warnings,
        "allowed_tools": [],
        "no_llm_called": generated.no_llm_called,
        "no_tools_executed": true,
        "no_mutations_performed": true,
        "context_was_approved": true,
    })
    .to_string()
}

fn artifact_payload(artifact: &AgentChatAiRequestArtifact) -> Value {
    json!({
        "request_id": &artifact.request_id,
        "workspace_id": &artifact.workspace_id,
        "workbench_id": &artifact.workbench_id,
        "source_widget_instance_id": &artifact.source_widget_instance_id,
        "operator_prompt": &artifact.operator_prompt,
        "approved_context_snapshot": &artifact.approved_context_snapshot,
        "contract_pack_summary": &artifact.contract_pack_summary,
        "allowed_tools": &artifact.allowed_tools,
        "safety_constraints": &artifact.safety_constraints,
        "expected_response_format": &artifact.expected_response_format,
        "validation_plan": &artifact.validation_plan,
        "created_at": &artifact.created_at,
    })
}

fn action_proposal_payloads(actions: &[AgentChatProposalActionInput]) -> Vec<Value> {
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

fn artifact_log_payload(artifact: &AgentChatAiRequestArtifact) -> String {
    json!({
        "request_id": &artifact.request_id,
        "allowed_tools": &artifact.allowed_tools,
        "approved_context_status": artifact
            .approved_context_snapshot
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("unknown"),
    })
    .to_string()
}

fn normalization_log_payload(generated: &GeneratedAiProposal) -> String {
    json!({
        "runtime_status": &generated.runtime_status,
        "provider_status": &generated.provider_status,
        "provider_used": generated.provider_used,
        "normalization_warning_count": generated.normalization_warnings.len(),
    })
    .to_string()
}

fn persisted_log_payload(run_id: &str, result_id: &str, generated: &GeneratedAiProposal) -> String {
    json!({
        "runtime_status": &generated.runtime_status,
        "provider_status": &generated.provider_status,
        "run_id": run_id,
        "result_id": result_id,
    })
    .to_string()
}

fn safety_log_payload(generated: &GeneratedAiProposal) -> String {
    json!({
        "runtime_status": &generated.runtime_status,
        "provider_status": &generated.provider_status,
        "allowed_tools": [],
        "no_tools_executed": true,
        "no_mutations_performed": true,
        "context_was_approved": true,
    })
    .to_string()
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

fn parse_provider_json(raw: &str) -> Result<Value, serde_json::Error> {
    serde_json::from_str(raw).or_else(|_| {
        let start = raw.find('{').unwrap_or(0);
        let end = raw.rfind('}').map(|index| index + 1).unwrap_or(raw.len());
        serde_json::from_str(&raw[start..end])
    })
}

fn proposal_actions(
    value: &Value,
    warnings: &mut Vec<String>,
) -> Vec<AgentChatProposalActionInput> {
    let Some(actions) = value
        .get("tool_action_proposals")
        .or_else(|| value.get("proposed_tool_actions"))
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };

    actions
        .iter()
        .filter_map(|action| {
            if action
                .get("execution_status")
                .or_else(|| action.get("status"))
                .and_then(Value::as_str)
                .is_some_and(|status| status != "not_executed")
            {
                warnings.push(
                    "Provider action execution status was ignored and reset to not_executed."
                        .to_owned(),
                );
            }

            Some(AgentChatProposalActionInput {
                title: string_field(action, "title")?,
                description: string_field(action, "description")?,
            })
        })
        .collect()
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_owned)
}

fn string_array_field(value: &Value, key: &str) -> Option<Vec<String>> {
    value
        .get(key)?
        .as_array()?
        .iter()
        .map(|item| item.as_str().map(str::to_owned))
        .collect()
}

fn truncate_for_storage(value: String, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value;
    }

    let mut truncated = value.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn append_ai_proposal_log(
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
