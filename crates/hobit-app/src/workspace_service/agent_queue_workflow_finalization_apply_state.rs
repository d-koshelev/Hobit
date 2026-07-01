use super::support::{finalization_idempotency_key, parse_object};
use super::*;

pub(super) fn complete_finalization_action(
    store: &SqliteStore,
    request: &NormalizedFinalizationStepRequest,
    action: AgentQueueWorkflowActionRow,
    idempotency_key: &str,
    result_refs_json: &str,
    now: &str,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    if action.status == QueueWorkflowActionStatus::Completed.as_str()
        && action.result_refs_json.as_deref() == Some(result_refs_json)
    {
        return Ok(action);
    }
    store
        .replace_agent_queue_workflow_action_resolution(
            &request.workspace_id,
            &request.workflow_run_id,
            idempotency_key,
            AgentQueueWorkflowActionUpdate {
                status: QueueWorkflowActionStatus::Completed.as_str(),
                result_refs_json: Some(result_refs_json),
                blocker_code: None,
                blocker_message: None,
                attempt_count: Some(action.attempt_count),
                started_at: action.started_at.as_deref().or(Some(now)),
                completed_at: Some(now),
                updated_at: Some(now),
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)
}

pub(super) fn record_blocked_finalization_action(
    store: &SqliteStore,
    request: &NormalizedFinalizationStepRequest,
    existing_action: Option<AgentQueueWorkflowActionRow>,
    target_refs_json: &str,
    transition: QueueWorkflowFinalizationStepTransition,
    blocker: &QueueWorkflowCommandBlocker,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    let now = placeholder_timestamp();
    let result_refs_json = canonical_json_string(&json!({
        "commandStatus": "blocked_precondition",
        "status": blocker.blocker_code,
    }));
    match existing_action {
        Some(action) => store
            .replace_agent_queue_workflow_action_refs_and_resolution(
                &request.workspace_id,
                &request.workflow_run_id,
                &action.idempotency_key,
                Some(target_refs_json),
                AgentQueueWorkflowActionUpdate {
                    status: QueueWorkflowActionStatus::Blocked.as_str(),
                    result_refs_json: Some(&result_refs_json),
                    blocker_code: Some(&blocker.blocker_code),
                    blocker_message: Some(&blocker.blocker_message),
                    attempt_count: Some(action.attempt_count.saturating_add(1)),
                    started_at: action.started_at.as_deref(),
                    completed_at: Some(&now),
                    updated_at: Some(&now),
                },
            )?
            .ok_or(StorageError::QueryReturnedNoRows),
        None => {
            let action_id = placeholder_id("queue-workflow-action-");
            let refs = parse_object(Some(target_refs_json));
            let task_id = refs
                .get("taskId")
                .and_then(Value::as_str)
                .unwrap_or("unknown-task");
            let idempotency_key = finalization_idempotency_key(
                &request.workflow_run_id,
                transition,
                &request.slot,
                task_id,
            );
            store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &action_id,
                workflow_run_id: &request.workflow_run_id,
                workspace_id: &request.workspace_id,
                step_id: transition.step_id(),
                action_type: transition.action_type(),
                idempotency_key: &idempotency_key,
                status: QueueWorkflowActionStatus::Blocked.as_str(),
                target_refs_json: Some(target_refs_json),
                result_refs_json: Some(&result_refs_json),
                blocker_code: Some(&blocker.blocker_code),
                blocker_message: Some(&blocker.blocker_message),
                attempt_count: 1,
                started_at: Some(&now),
                completed_at: Some(&now),
                created_at: Some(&now),
                updated_at: Some(&now),
            })
        }
    }
}

pub(super) fn block_workflow_run_for_finalization(
    store: &SqliteStore,
    request: &NormalizedFinalizationStepRequest,
    _workflow_run: &AgentQueueWorkflowRunRow,
    blocker: &QueueWorkflowCommandBlocker,
) -> Result<AgentQueueWorkflowRunRow, StorageError> {
    let now = placeholder_timestamp();
    store
        .update_agent_queue_workflow_run_report(
            &request.workspace_id,
            &request.workflow_run_id,
            AgentQueueWorkflowRunReportUpdate {
                status: QueueWorkflowRunStatus::Blocked.as_str(),
                phase: Some(WORKFLOW_PHASE_FINALIZATION),
                current_step: Some("finalization_blocked"),
                pause_reason: None,
                blocker_reason: Some(&blocker.blocker_message),
                variables_json: None,
                slot_bindings_json: None,
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                updated_at: Some(&now),
                completed_at: None,
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)
}

pub(super) fn update_binding_with_finalization(
    slot_bindings: &mut Map<String, Value>,
    slot: &str,
    action: &AgentQueueWorkflowActionRow,
    action_idempotency_key: &str,
    completion_decision_id: Option<&str>,
    failure_decision_id: Option<&str>,
    finalized_at: &str,
    transition: QueueWorkflowFinalizationStepTransition,
) {
    let entry = slot_bindings
        .entry(slot.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    let Some(object) = entry.as_object_mut() else {
        return;
    };
    object.insert(
        "finalizationActionId".to_owned(),
        Value::String(action.action_id.clone()),
    );
    object.insert(
        "finalizationActionIdempotencyKey".to_owned(),
        Value::String(action_idempotency_key.to_owned()),
    );
    object.insert(
        "finalizationTransition".to_owned(),
        Value::String(transition.as_str().to_owned()),
    );
    object.insert(
        "finalizedAt".to_owned(),
        Value::String(finalized_at.to_owned()),
    );
    if let Some(decision_id) = completion_decision_id {
        object.insert(
            "completionDecisionId".to_owned(),
            Value::String(decision_id.to_owned()),
        );
    }
    if let Some(decision_id) = failure_decision_id {
        object.insert(
            "failureDecisionId".to_owned(),
            Value::String(decision_id.to_owned()),
        );
    }
}

pub(super) fn mutation_refs_json(
    existing_json: Option<&str>,
    resolved: &FinalizationStepResolution,
    action: &AgentQueueWorkflowActionRow,
    completion_decision_id: Option<&str>,
    failure_decision_id: Option<&str>,
) -> String {
    let mut object = parse_object(existing_json);
    object.insert(
        "finalization".to_owned(),
        json!({
            "actionId": action.action_id,
            "completionDecisionId": completion_decision_id,
            "evidenceBundleId": resolved.evidence.bundle_id,
            "failureDecisionId": failure_decision_id,
            "messageId": resolved.review_message.message_id,
            "runId": resolved.run_id,
            "slot": resolved.request.slot,
            "taskId": resolved.task_id,
            "transition": resolved.transition.as_str(),
        }),
    );
    canonical_json_string(&Value::Object(object))
}

pub(super) fn idempotency_keys_json(existing_json: Option<&str>, action_key: &str) -> String {
    let mut object = parse_object(existing_json);
    object.insert(
        "finalization".to_owned(),
        json!({
            "action": action_key,
        }),
    );
    canonical_json_string(&Value::Object(object))
}

pub(super) fn action_log_summary_json(
    existing_json: Option<&str>,
    resolved: &FinalizationStepResolution,
    completion_decision_id: Option<&str>,
    failure_decision_id: Option<&str>,
    status: QueueWorkflowFinalizationStepResultStatus,
) -> String {
    let mut object = parse_object(existing_json);
    object.insert(
        "finalization".to_owned(),
        json!({
            "completionDecisionId": completion_decision_id,
            "failureDecisionId": failure_decision_id,
            "slot": resolved.request.slot,
            "status": status.as_str(),
            "transition": resolved.transition.as_str(),
        }),
    );
    canonical_json_string(&Value::Object(object))
}

pub(super) fn variables_json(
    existing_json: Option<&str>,
    resolved: &FinalizationStepResolution,
    completion_decision_id: Option<&str>,
    failure_decision_id: Option<&str>,
) -> String {
    let mut object = parse_object(existing_json);
    if let Some(decision_id) = completion_decision_id {
        merge_string_map(
            &mut object,
            "completionDecisionIdsBySlot",
            &resolved.request.slot,
            decision_id,
        );
    }
    if let Some(decision_id) = failure_decision_id {
        merge_string_map(
            &mut object,
            "failureDecisionIdsBySlot",
            &resolved.request.slot,
            decision_id,
        );
    }
    object.insert(
        "finalizationCompletedBySlot".to_owned(),
        json!({ resolved.request.slot.clone(): true }),
    );
    canonical_json_string(&Value::Object(object))
}

fn merge_string_map(object: &mut Map<String, Value>, field: &str, key: &str, value: &str) {
    let entry = object
        .entry(field.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    if let Some(map) = entry.as_object_mut() {
        map.insert(key.to_owned(), Value::String(value.to_owned()));
    }
}
