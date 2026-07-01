use super::*;

pub(super) enum EvidenceLookup {
    Found(AgentQueueWorkerEvidenceBundleRow),
    Blocked(QueueWorkflowCommandBlocker),
    Conflict(QueueWorkflowConflict, QueueWorkflowCommandBlocker),
}

pub(super) fn evidence_for_binding(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    binding: &Value,
) -> Result<EvidenceLookup, StorageError> {
    let evidence = match string_field(binding, "evidenceBundleId") {
        Some(bundle_id) => {
            store.get_agent_queue_worker_evidence_bundle_by_id(workspace_id, bundle_id)?
        }
        None => store.get_latest_agent_queue_worker_evidence_bundle(workspace_id, task_id)?,
    };
    let Some(evidence) = evidence else {
        return Ok(EvidenceLookup::Blocked(blocker(
            "evidence_missing",
            "Queue workflow review requires durable worker evidence.",
            Some("evidenceBundleId"),
        )));
    };
    if evidence.queue_task_id != task_id {
        let conflict = QueueWorkflowConflict {
            conflict_code: "review_evidence_task_mismatch".to_owned(),
            conflict_message: "Queue workflow review evidence belongs to a different Queue task."
                .to_owned(),
            existing_workflow_run_id: None,
            existing_request_hash: Some(evidence.queue_task_id.clone()),
            requested_request_hash: Some(task_id.to_owned()),
        };
        return Ok(EvidenceLookup::Conflict(
            conflict,
            blocker(
                "review_evidence_task_mismatch",
                "Queue workflow review evidence belongs to a different Queue task.",
                Some("evidenceBundleId"),
            ),
        ));
    }
    Ok(EvidenceLookup::Found(evidence))
}

pub(super) enum ReviewMessageLookup {
    Found(Option<AgentQueueReviewMessageRow>),
    Blocked(QueueWorkflowCommandBlocker),
    Conflict(QueueWorkflowConflict, QueueWorkflowCommandBlocker),
}

pub(super) fn review_message_for_binding(
    binding: &Value,
    review_messages: &[AgentQueueReviewMessageRow],
    run_id: &str,
) -> ReviewMessageLookup {
    let message = match string_field(binding, "messageId") {
        Some(message_id) => match review_messages
            .iter()
            .find(|message| message.message_id == message_id)
        {
            Some(message) => Some(message.clone()),
            None => {
                return ReviewMessageLookup::Blocked(blocker(
                    "review_message_missing",
                    "Persisted Queue workflow review messageId does not exist.",
                    Some("messageId"),
                ));
            }
        },
        None => review_messages.first().cloned(),
    };
    if let Some(message) = message.as_ref() {
        if message
            .run_id
            .as_deref()
            .is_some_and(|message_run_id| message_run_id != run_id)
        {
            let conflict = QueueWorkflowConflict {
                conflict_code: "review_message_run_mismatch".to_owned(),
                conflict_message: "Existing Queue review message is bound to a different runId."
                    .to_owned(),
                existing_workflow_run_id: None,
                existing_request_hash: message.run_id.clone(),
                requested_request_hash: Some(run_id.to_owned()),
            };
            return ReviewMessageLookup::Conflict(
                conflict,
                blocker(
                    "review_message_run_mismatch",
                    "Existing Queue review message is bound to a different runId.",
                    Some("messageId"),
                ),
            );
        }
        if !matches!(
            message.status.as_str(),
            REVIEW_MESSAGE_STATUS_CREATED | REVIEW_MESSAGE_STATUS_ACKNOWLEDGED
        ) {
            return ReviewMessageLookup::Blocked(blocker(
                "review_message_status_not_ackable",
                "Existing Queue review message is not in an ACKable status.",
                Some("messageId"),
            ));
        }
    }
    ReviewMessageLookup::Found(message)
}

pub(super) fn open_review_action(
    store: &SqliteStore,
    request: &NormalizedReviewStepRequest,
    existing_action: Option<AgentQueueWorkflowActionRow>,
    step_id: &str,
    action_type: &str,
    idempotency_key: &str,
    target_refs_json: &str,
    now: &str,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    match existing_action {
        Some(action) if action.status == QueueWorkflowActionStatus::Completed.as_str() => {
            Ok(action)
        }
        Some(action) => store
            .replace_agent_queue_workflow_action_refs_and_resolution(
                &request.workspace_id,
                &request.workflow_run_id,
                idempotency_key,
                Some(target_refs_json),
                AgentQueueWorkflowActionUpdate {
                    status: QueueWorkflowActionStatus::Running.as_str(),
                    result_refs_json: None,
                    blocker_code: None,
                    blocker_message: None,
                    attempt_count: Some(action.attempt_count.saturating_add(1)),
                    started_at: action.started_at.as_deref().or(Some(now)),
                    completed_at: None,
                    updated_at: Some(now),
                },
            )?
            .ok_or(StorageError::QueryReturnedNoRows),
        None => {
            let action_id = placeholder_id("queue-workflow-action-");
            store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &action_id,
                workflow_run_id: &request.workflow_run_id,
                workspace_id: &request.workspace_id,
                step_id,
                action_type,
                idempotency_key,
                status: QueueWorkflowActionStatus::Running.as_str(),
                target_refs_json: Some(target_refs_json),
                result_refs_json: None,
                blocker_code: None,
                blocker_message: None,
                attempt_count: 1,
                started_at: Some(now),
                completed_at: None,
                created_at: Some(now),
                updated_at: Some(now),
            })
        }
    }
}

pub(super) fn complete_review_action(
    store: &SqliteStore,
    request: &NormalizedReviewStepRequest,
    action: AgentQueueWorkflowActionRow,
    idempotency_key: &str,
    result_refs_json: &str,
    now: &str,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    if action.status == QueueWorkflowActionStatus::Completed.as_str() {
        if action.result_refs_json.as_deref() != Some(result_refs_json) {
            return Err(StorageError::InvalidParameterName(
                "Existing Queue workflow review action result refs do not match durable review state."
                    .to_owned(),
            ));
        }
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

pub(super) fn record_blocked_review_action(
    store: &SqliteStore,
    request: &NormalizedReviewStepRequest,
    existing_action: Option<AgentQueueWorkflowActionRow>,
    target_refs_json: &str,
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
            let idempotency_key =
                fallback_create_key_from_target(target_refs_json).unwrap_or_else(|| {
                    format!("{}:create_review_message:blocked", request.workflow_run_id)
                });
            store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &action_id,
                workflow_run_id: &request.workflow_run_id,
                workspace_id: &request.workspace_id,
                step_id: CREATE_REVIEW_STEP_ID,
                action_type: CREATE_REVIEW_ACTION_TYPE,
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

pub(super) fn block_workflow_run_for_review(
    store: &SqliteStore,
    request: &NormalizedReviewStepRequest,
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
                phase: Some(WORKFLOW_PHASE_REVIEW),
                current_step: Some("review_blocked"),
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

pub(super) fn normalize_review_step_request(
    request: QueueWorkflowReviewStepRequest,
) -> Result<NormalizedReviewStepRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required(&request.workspace_id, "workspaceId")?;
    let workflow_run_id = required(&request.workflow_run_id, "workflowRunId")?;
    let slot = optional_trimmed(request.slot).unwrap_or_else(|| "upstream".to_owned());
    if slot != "upstream" {
        return Err(blocker(
            "unsupported_slot",
            "Queue dependency workflow review currently supports only the upstream slot.",
            Some("slot"),
        ));
    }
    let actor_id =
        optional_trimmed(request.actor_id).unwrap_or_else(|| "workspace-agent".to_owned());
    Ok(NormalizedReviewStepRequest {
        workspace_id,
        workflow_run_id,
        slot,
        actor_id,
        grant_summary: request.grant_summary,
    })
}

pub(super) fn review_target_refs(
    request: &NormalizedReviewStepRequest,
    task_id: &str,
    run_id: &str,
    evidence_bundle_id: &str,
) -> Value {
    json!({
        "evidenceBundleId": evidence_bundle_id,
        "runId": run_id,
        "slot": request.slot,
        "taskId": task_id,
        "workflowRunId": request.workflow_run_id,
    })
}

pub(super) fn update_binding_with_review(
    slot_bindings: &mut Map<String, Value>,
    slot: &str,
    message: &AgentQueueReviewMessageRow,
    create_action: &AgentQueueWorkflowActionRow,
    ack_action: &AgentQueueWorkflowActionRow,
    create_idempotency_key: &str,
    ack_idempotency_key: &str,
) {
    let entry = slot_bindings
        .entry(slot.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    let Some(object) = entry.as_object_mut() else {
        return;
    };
    object.insert(
        "messageId".to_owned(),
        Value::String(message.message_id.clone()),
    );
    object.insert(
        "reviewCreateActionId".to_owned(),
        Value::String(create_action.action_id.clone()),
    );
    object.insert(
        "reviewCreateActionIdempotencyKey".to_owned(),
        Value::String(create_idempotency_key.to_owned()),
    );
    object.insert(
        "reviewAckActionId".to_owned(),
        Value::String(ack_action.action_id.clone()),
    );
    object.insert(
        "reviewAckActionIdempotencyKey".to_owned(),
        Value::String(ack_idempotency_key.to_owned()),
    );
    object.insert(
        "reviewStatus".to_owned(),
        Value::String(message.status.clone()),
    );
    if let Some(acked_at) = message.acked_at.as_ref() {
        object.insert("reviewAckedAt".to_owned(), Value::String(acked_at.clone()));
    }
}

pub(super) fn mutation_refs_json(
    existing_json: Option<&str>,
    request: &NormalizedReviewStepRequest,
    message: &AgentQueueReviewMessageRow,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
) -> String {
    let mut object = parse_object(existing_json);
    object.insert(
        "review".to_owned(),
        json!({
            "evidenceBundleId": evidence.bundle_id,
            "messageId": message.message_id,
            "runId": evidence.run_id,
            "slot": request.slot,
            "status": message.status,
            "taskId": evidence.queue_task_id,
        }),
    );
    canonical_json_string(&Value::Object(object))
}

pub(super) fn idempotency_keys_json(
    existing_json: Option<&str>,
    create_key: &str,
    ack_key: &str,
) -> String {
    let mut object = parse_object(existing_json);
    object.insert(
        "review".to_owned(),
        json!({
            "ackReviewMessage": ack_key,
            "createReviewMessage": create_key,
        }),
    );
    canonical_json_string(&Value::Object(object))
}

pub(super) fn action_log_summary_json(
    existing_json: Option<&str>,
    request: &NormalizedReviewStepRequest,
    message: &AgentQueueReviewMessageRow,
) -> String {
    let mut object = parse_object(existing_json);
    object.insert(
        "review".to_owned(),
        json!({
            "ackStatus": message.status,
            "messageId": message.message_id,
            "slot": request.slot,
        }),
    );
    canonical_json_string(&Value::Object(object))
}

pub(super) fn variables_json(
    existing_json: Option<&str>,
    request: &NormalizedReviewStepRequest,
    message: &AgentQueueReviewMessageRow,
    evidence: &AgentQueueWorkerEvidenceBundleRow,
) -> String {
    let mut object = parse_object(existing_json);
    merge_string_map(
        &mut object,
        "messageIdsBySlot",
        &request.slot,
        &message.message_id,
    );
    merge_string_map(
        &mut object,
        "evidenceBundleIdsBySlot",
        &request.slot,
        &evidence.bundle_id,
    );
    merge_string_map(&mut object, "runIdsBySlot", &request.slot, &evidence.run_id);
    merge_string_map(
        &mut object,
        "taskIdsBySlot",
        &request.slot,
        &evidence.queue_task_id,
    );
    object.insert(
        "reviewAcknowledgedBySlot".to_owned(),
        json!({ request.slot.clone(): true }),
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

pub(super) fn is_retryable_review_failure_before_mutation(
    workflow_run: &AgentQueueWorkflowRunRow,
    actions: &[AgentQueueWorkflowActionRow],
    slot_bindings: &Map<String, Value>,
    slot: &str,
    review_messages: &[AgentQueueReviewMessageRow],
) -> bool {
    if workflow_run.status != QueueWorkflowRunStatus::Failed.as_str()
        || workflow_run.phase != WORKFLOW_PHASE_REVIEW
        || workflow_run.current_step.as_deref() != Some("review_failed_unexpected")
    {
        return false;
    }
    if slot_bindings
        .get(slot)
        .and_then(|binding| string_field(binding, "messageId"))
        .is_some()
    {
        return false;
    }
    if !message_ids_by_slot_empty(workflow_run.variables_json.as_deref(), slot) {
        return false;
    }
    if !review_messages.is_empty() {
        return false;
    }
    let Some(binding) = slot_bindings.get(slot) else {
        return false;
    };
    if actions
        .iter()
        .any(is_review_mutation_or_partial_result_action)
    {
        return false;
    }
    if !actions
        .iter()
        .any(|action| is_completed_worker_evidence_action_for_binding(action, binding))
    {
        return false;
    }
    actions
        .iter()
        .all(|action| is_safe_failed_review_retry_history_action(action, binding))
}

fn is_review_mutation_or_partial_result_action(action: &AgentQueueWorkflowActionRow) -> bool {
    matches!(
        action.action_type.as_str(),
        CREATE_REVIEW_ACTION_TYPE
            | ACK_REVIEW_ACTION_TYPE
            | "create_review_message"
            | "ack_review_message"
    ) || action_result_message_id(action).is_some()
}

fn is_completed_worker_evidence_action_for_binding(
    action: &AgentQueueWorkflowActionRow,
    binding: &Value,
) -> bool {
    if action.action_type != "record_worker_evidence"
        || action.status != QueueWorkflowActionStatus::Completed.as_str()
    {
        return false;
    }
    let Some(evidence_bundle_id) = string_field(binding, "evidenceBundleId") else {
        return false;
    };
    action_result_string_field(action, "evidenceBundleId").as_deref() == Some(evidence_bundle_id)
}

fn is_safe_failed_review_retry_history_action(
    action: &AgentQueueWorkflowActionRow,
    binding: &Value,
) -> bool {
    match action.action_type.as_str() {
        "create_task" | "update_run_settings" | "promote_task" | "start_worker" => true,
        "record_worker_evidence" => {
            is_completed_worker_evidence_action_for_binding(action, binding)
        }
        "queue.lifecycle.get" | "queue.evidence.lookup" => {
            action.status == QueueWorkflowActionStatus::Completed.as_str()
        }
        _ => false,
    }
}

pub(super) fn downstream_has_started(
    store: &SqliteStore,
    workspace_id: &str,
    slot_bindings: &Map<String, Value>,
    target_slot: &str,
) -> Result<bool, StorageError> {
    for (slot, binding) in slot_bindings {
        if slot == target_slot {
            continue;
        }
        if string_field(binding, "runId").is_some() {
            return Ok(true);
        }
        if let Some(task_id) = string_field(binding, "taskId") {
            if store
                .get_latest_agent_queue_task_run_link(workspace_id, task_id)?
                .is_some()
            {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

pub(super) fn fresh_review_grant_blocker(
    grant_summary: Option<&Value>,
) -> Option<QueueWorkflowCommandBlocker> {
    let Some(grant) = grant_summary else {
        return Some(blocker(
            "review_grant_required",
            "Queue workflow review execution requires a fresh structured Queue workflow grant.",
            Some("grant"),
        ));
    };
    let no_downstream = grant
        .as_object()
        .and_then(|object| object.get("constraints"))
        .and_then(Value::as_object)
        .and_then(|constraints| constraints.get("noDownstreamAutoStart"))
        .and_then(Value::as_bool)
        == Some(true);
    if !no_downstream {
        return Some(blocker(
            "review_constraints_missing",
            "Queue workflow review execution requires grant.constraints.noDownstreamAutoStart=true.",
            Some("grant.constraints.noDownstreamAutoStart"),
        ));
    }
    None
}

pub(super) fn create_review_idempotency_key(
    workflow_run_id: &str,
    slot: &str,
    task_id: &str,
    run_id: &str,
    evidence_bundle_id: &str,
) -> String {
    format!(
        "{workflow_run_id}:create_review_message:{slot}:{task_id}:{run_id}:{evidence_bundle_id}"
    )
}

pub(super) fn ack_review_idempotency_key(
    workflow_run_id: &str,
    slot: &str,
    message_id: &str,
) -> String {
    format!("{workflow_run_id}:ack_review_message:{slot}:{message_id}")
}

pub(super) fn action_target_refs_match(existing: Option<&str>, expected: &str) -> bool {
    existing == Some(expected)
}

pub(super) fn action_result_message_id(action: &AgentQueueWorkflowActionRow) -> Option<String> {
    action_result_string_field(action, "messageId")
}

fn action_result_string_field(action: &AgentQueueWorkflowActionRow, field: &str) -> Option<String> {
    parse_object(action.result_refs_json.as_deref())
        .get(field)
        .and_then(Value::as_str)
        .map(str::to_owned)
}

fn fallback_create_key_from_target(target_refs_json: &str) -> Option<String> {
    let refs = parse_object(Some(target_refs_json));
    Some(create_review_idempotency_key(
        refs.get("workflowRunId")?.as_str()?,
        refs.get("slot")?.as_str()?,
        refs.get("taskId")?.as_str()?,
        refs.get("runId")?.as_str()?,
        refs.get("evidenceBundleId")?.as_str()?,
    ))
}

fn message_ids_by_slot_empty(raw: Option<&str>, slot: &str) -> bool {
    parse_object(raw)
        .get("messageIdsBySlot")
        .and_then(Value::as_object)
        .is_none_or(|messages| !messages.contains_key(slot) && messages.is_empty())
}

pub(super) fn parse_slot_bindings(
    slot_bindings_json: Option<&str>,
) -> Result<Map<String, Value>, QueueWorkflowCommandBlocker> {
    let Some(raw) = slot_bindings_json else {
        return Ok(Map::new());
    };
    if raw.trim().is_empty() {
        return Ok(Map::new());
    }
    let value = serde_json::from_str::<Value>(raw).map_err(|_| {
        blocker(
            "invalid_slot_bindings_json",
            "Queue workflow slotBindings JSON could not be parsed.",
            Some("slotBindings"),
        )
    })?;
    match value {
        Value::Object(object) => Ok(object),
        _ => Err(blocker(
            "invalid_slot_bindings_json",
            "Queue workflow slotBindings must be a JSON object.",
            Some("slotBindings"),
        )),
    }
}

fn parse_object(raw: Option<&str>) -> Map<String, Value> {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

pub(super) fn parse_json_value(raw: &str) -> Option<Value> {
    serde_json::from_str::<Value>(raw).ok()
}

pub(super) fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .as_object()
        .and_then(|object| object.get(field))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

pub(super) fn review_message_body(evidence: &AgentQueueWorkerEvidenceBundleRow) -> String {
    if evidence.summary.trim().is_empty() {
        DEFAULT_REVIEW_MESSAGE_BODY.to_owned()
    } else {
        evidence.summary.trim().chars().take(4_000).collect()
    }
}

pub(super) fn bounded_json(
    raw: String,
    max_bytes: usize,
    field_name: &str,
) -> Result<String, StorageError> {
    if raw.len() > max_bytes {
        return Err(StorageError::InvalidParameterName(format!(
            "Queue workflow {field_name} JSON exceeds the configured byte limit."
        )));
    }
    Ok(raw)
}

fn required(value: &str, field: &'static str) -> Result<String, QueueWorkflowCommandBlocker> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(blocker(
            &format!("missing_{field}"),
            &format!("{field} is required."),
            Some(field),
        ));
    }
    Ok(value)
}

fn optional_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

pub(super) fn blocked(
    request: NormalizedReviewStepRequest,
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    code: &str,
    message: &str,
    field: Option<&str>,
) -> ReviewStepResolveStatus {
    ReviewStepResolveStatus::Blocked {
        request: Some(request),
        workflow_run,
        create_action: None,
        ack_action: None,
        target_refs_json: None,
        blocker: blocker(code, message, field),
        retryable_failed_review_before_mutation: false,
    }
}

pub(super) fn conflict(
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    create_action: Option<AgentQueueWorkflowActionRow>,
    ack_action: Option<AgentQueueWorkflowActionRow>,
    code: &str,
    message: &str,
    existing: Option<String>,
    requested: Option<String>,
) -> ReviewStepResolveStatus {
    ReviewStepResolveStatus::Conflict {
        workflow_run: workflow_run.clone(),
        create_action,
        ack_action,
        blocker: Some(blocker(code, message, None)),
        conflict: QueueWorkflowConflict {
            conflict_code: code.to_owned(),
            conflict_message: message.to_owned(),
            existing_workflow_run_id: workflow_run.map(|run| run.workflow_run_id),
            existing_request_hash: existing,
            requested_request_hash: requested,
        },
    }
}

pub(super) fn blocker(
    code: &str,
    message: &str,
    field: Option<&str>,
) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: code.to_owned(),
        blocker_message: message.to_owned(),
        missing_required_field: field.map(str::to_owned),
    }
}
