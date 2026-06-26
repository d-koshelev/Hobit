use super::*;

pub(super) struct FinalizationFacts {
    pub run_id: String,
    pub evidence: AgentQueueWorkerEvidenceBundleRow,
    pub run_link: AgentQueueTaskRunLinkRow,
    pub review_message: AgentQueueReviewMessageRow,
}

pub(super) enum FinalizationFactLookup {
    Resolved(FinalizationFacts),
    Blocked(QueueWorkflowCommandBlocker),
    Conflict(QueueWorkflowConflict, QueueWorkflowCommandBlocker),
}

pub(super) enum DecisionState {
    AlreadyApplied,
    Conflict(QueueWorkflowConflict, QueueWorkflowCommandBlocker),
}

pub(super) fn normalize_finalization_step_request(
    request: QueueWorkflowFinalizationStepRequest,
) -> Result<NormalizedFinalizationStepRequest, QueueWorkflowCommandBlocker> {
    let workspace_id = required(&request.workspace_id, "workspaceId")?;
    let workflow_run_id = required(&request.workflow_run_id, "workflowRunId")?;
    let slot = optional_trimmed(request.slot).unwrap_or_else(|| "upstream".to_owned());
    if slot != "upstream" {
        return Err(blocker(
            "unsupported_slot",
            "Queue dependency workflow finalization currently supports only the upstream slot.",
            Some("slot"),
        ));
    }
    let actor_id =
        optional_trimmed(request.actor_id).unwrap_or_else(|| "workspace-agent".to_owned());
    Ok(NormalizedFinalizationStepRequest {
        workspace_id,
        workflow_run_id,
        slot,
        actor_id,
        grant_summary: request.grant_summary,
        confirmation_token: optional_trimmed(request.confirmation_token),
        failure_reason: optional_trimmed(request.failure_reason),
        expected_version: request.expected_version,
    })
}

pub(super) fn resolve_finalization_facts(
    store: &SqliteStore,
    request: &NormalizedFinalizationStepRequest,
    binding: &Value,
    task_id: &str,
) -> Result<FinalizationFactLookup, StorageError> {
    let evidence =
        match string_field(binding, "evidenceBundleId") {
            Some(bundle_id) => store
                .get_agent_queue_worker_evidence_bundle_by_id(&request.workspace_id, bundle_id)?,
            None => store
                .get_latest_agent_queue_worker_evidence_bundle(&request.workspace_id, task_id)?,
        };
    let Some(evidence) = evidence else {
        return Ok(FinalizationFactLookup::Blocked(blocker(
            "evidence_missing",
            "Queue workflow finalization requires durable worker evidence.",
            Some("evidenceBundleId"),
        )));
    };
    if evidence.queue_task_id != task_id {
        return Ok(FinalizationFactLookup::Conflict(
            queue_conflict(
                "finalization_evidence_task_mismatch",
                "Queue workflow finalization evidence belongs to a different Queue task.",
                Some(evidence.queue_task_id.clone()),
                Some(task_id.to_owned()),
                None,
            ),
            blocker(
                "finalization_evidence_task_mismatch",
                "Queue workflow finalization evidence belongs to a different Queue task.",
                Some("evidenceBundleId"),
            ),
        ));
    }
    let run_id = evidence.run_id.clone();
    if let Some(bound_run_id) = string_field(binding, "runId") {
        if bound_run_id != run_id {
            return Ok(FinalizationFactLookup::Conflict(
                queue_conflict(
                    "finalization_run_mismatch",
                    "Queue workflow finalization runId does not match durable evidence runId.",
                    Some(bound_run_id.to_owned()),
                    Some(run_id),
                    None,
                ),
                blocker(
                    "finalization_run_mismatch",
                    "Queue workflow finalization runId does not match durable evidence runId.",
                    Some("runId"),
                ),
            ));
        }
    }

    let Some(run_link) =
        store.get_agent_queue_task_run_link_by_run_id(&request.workspace_id, &run_id)?
    else {
        return Ok(FinalizationFactLookup::Blocked(blocker(
            "run_missing",
            "Queue workflow finalization runId was not found in the requested workspace.",
            Some("runId"),
        )));
    };
    if run_link.queue_task_id != task_id {
        return Ok(FinalizationFactLookup::Conflict(
            queue_conflict(
                "finalization_run_task_mismatch",
                "Queue workflow finalization runId belongs to a different Queue task.",
                Some(run_link.queue_task_id.clone()),
                Some(task_id.to_owned()),
                None,
            ),
            blocker(
                "finalization_run_task_mismatch",
                "Queue workflow finalization runId belongs to a different Queue task.",
                Some("runId"),
            ),
        ));
    }
    if evidence
        .run_link_id
        .as_deref()
        .is_some_and(|link_id| link_id != run_link.link_id.as_str())
    {
        return Ok(FinalizationFactLookup::Conflict(
            queue_conflict(
                "finalization_evidence_run_link_mismatch",
                "Queue workflow finalization evidence runLinkId does not match the durable run link.",
                evidence.run_link_id.clone(),
                Some(run_link.link_id.clone()),
                None,
            ),
            blocker(
                "finalization_evidence_run_link_mismatch",
                "Queue workflow finalization evidence runLinkId does not match the durable run link.",
                Some("runLinkId"),
            ),
        ));
    }

    let review_messages = store.list_agent_queue_review_messages(&request.workspace_id, task_id)?;
    let review_message = match string_field(binding, "messageId") {
        Some(message_id) => review_messages
            .into_iter()
            .find(|message| message.message_id == message_id),
        None => review_messages.into_iter().next(),
    };
    let Some(review_message) = review_message else {
        return Ok(FinalizationFactLookup::Blocked(blocker(
            "review_message_missing",
            "Queue workflow finalization requires a durable backend review message.",
            Some("messageId"),
        )));
    };
    if review_message
        .run_id
        .as_deref()
        .is_some_and(|message_run_id| message_run_id != run_id)
    {
        return Ok(FinalizationFactLookup::Conflict(
            queue_conflict(
                "finalization_review_message_run_mismatch",
                "Queue workflow finalization review message belongs to a different runId.",
                review_message.run_id.clone(),
                Some(run_id),
                None,
            ),
            blocker(
                "finalization_review_message_run_mismatch",
                "Queue workflow finalization review message belongs to a different runId.",
                Some("messageId"),
            ),
        ));
    }
    if review_message.status != REVIEW_MESSAGE_STATUS_ACKNOWLEDGED {
        return Ok(FinalizationFactLookup::Blocked(blocker(
            "review_not_acked",
            "Queue workflow finalization requires an ACKed durable review message.",
            Some("messageId"),
        )));
    }

    Ok(FinalizationFactLookup::Resolved(FinalizationFacts {
        run_id,
        evidence,
        run_link,
        review_message,
    }))
}

pub(super) fn decision_conflict_or_already_applied(
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    transition: QueueWorkflowFinalizationStepTransition,
    completion_decision: Option<&AgentQueueCompletionDecisionRow>,
    failure_decision: Option<&AgentQueueFailureDecisionRow>,
) -> Option<DecisionState> {
    match transition {
        QueueWorkflowFinalizationStepTransition::FinalizeDone => {
            if failure_decision.is_some() {
                let (conflict, blocker) = conflict_for_opposite_decision(
                    workflow_run,
                    "failureDecisionId",
                    failure_decision.map(|decision| decision.decision_id.clone()),
                );
                return Some(DecisionState::Conflict(conflict, blocker));
            }
            completion_decision.map(|_| DecisionState::AlreadyApplied)
        }
        QueueWorkflowFinalizationStepTransition::FinalizeFail => {
            if completion_decision.is_some() {
                let (conflict, blocker) = conflict_for_opposite_decision(
                    workflow_run,
                    "completionDecisionId",
                    completion_decision.map(|decision| decision.decision_id.clone()),
                );
                return Some(DecisionState::Conflict(conflict, blocker));
            }
            failure_decision.map(|_| DecisionState::AlreadyApplied)
        }
    }
}

pub(super) fn matching_decision(
    transition: QueueWorkflowFinalizationStepTransition,
    completion_decision: Option<&AgentQueueCompletionDecisionRow>,
    failure_decision: Option<&AgentQueueFailureDecisionRow>,
) -> Option<String> {
    match transition {
        QueueWorkflowFinalizationStepTransition::FinalizeDone => {
            completion_decision.map(|decision| decision.decision_id.clone())
        }
        QueueWorkflowFinalizationStepTransition::FinalizeFail => {
            failure_decision.map(|decision| decision.decision_id.clone())
        }
    }
}

pub(super) fn downstream_verification(
    store: &SqliteStore,
    workspace_id: &str,
    slot_bindings: &Map<String, Value>,
    target_slot: &str,
    transition: QueueWorkflowFinalizationStepTransition,
) -> Result<QueueWorkflowFinalizationDownstreamVerification, StorageError> {
    let downstream_task_id = slot_bindings.iter().find_map(|(slot, binding)| {
        (slot != target_slot)
            .then(|| string_field(binding, "taskId").map(str::to_owned))
            .flatten()
    });
    let expected_dependency_state = match transition {
        QueueWorkflowFinalizationStepTransition::FinalizeDone => "ready",
        QueueWorkflowFinalizationStepTransition::FinalizeFail => "failed_upstream",
    }
    .to_owned();
    let Some(task_id) = downstream_task_id else {
        return Ok(QueueWorkflowFinalizationDownstreamVerification {
            downstream_task_id: None,
            dependency_state: None,
            ticket_state: None,
            worker_run_state: None,
            latest_run_id: None,
            expected_dependency_state,
            dependency_verified: false,
            not_auto_started_verified: false,
            verification_missing: true,
        });
    };
    let latest_run = store.get_latest_agent_queue_task_run_link(workspace_id, &task_id)?;
    Ok(QueueWorkflowFinalizationDownstreamVerification {
        downstream_task_id: Some(task_id),
        dependency_state: None,
        ticket_state: None,
        worker_run_state: None,
        latest_run_id: latest_run
            .as_ref()
            .map(|run| run.direct_work_run_id.clone()),
        expected_dependency_state,
        dependency_verified: false,
        not_auto_started_verified: latest_run.is_none(),
        verification_missing: false,
    })
}

pub(super) fn finalization_downstream_from_aggregate(
    aggregate: Option<&QueueItemAggregate>,
    mut snapshot: QueueWorkflowFinalizationDownstreamVerification,
) -> QueueWorkflowFinalizationDownstreamVerification {
    if let Some(aggregate) = aggregate {
        snapshot.dependency_state = Some(aggregate.dependency_state.as_str().to_owned());
        snapshot.ticket_state = Some(aggregate.ticket_state.as_str().to_owned());
        snapshot.worker_run_state = Some(aggregate.worker_run_state.as_str().to_owned());
        snapshot.latest_run_id = aggregate.latest_run.as_ref().map(|run| run.run_id.clone());
        snapshot.dependency_verified = snapshot.dependency_state.as_deref()
            == Some(snapshot.expected_dependency_state.as_str());
        snapshot.not_auto_started_verified = aggregate.latest_run.is_none();
    }
    snapshot
}

pub(super) fn finalization_idempotency_key(
    workflow_run_id: &str,
    transition: QueueWorkflowFinalizationStepTransition,
    slot: &str,
    task_id: &str,
) -> String {
    match transition {
        QueueWorkflowFinalizationStepTransition::FinalizeDone => {
            format!("{workflow_run_id}:mark_done:{slot}:{task_id}")
        }
        QueueWorkflowFinalizationStepTransition::FinalizeFail => {
            format!("{workflow_run_id}:fail_item:{slot}:{task_id}")
        }
    }
}

pub(super) fn finalization_target_refs(
    request: &NormalizedFinalizationStepRequest,
    transition: QueueWorkflowFinalizationStepTransition,
    task_id: &str,
    run_id: &str,
    evidence_bundle_id: &str,
    message_id: &str,
) -> Value {
    json!({
        "evidenceBundleId": evidence_bundle_id,
        "messageId": message_id,
        "runId": run_id,
        "slot": request.slot,
        "taskId": task_id,
        "transition": transition.as_str(),
        "workflowRunId": request.workflow_run_id,
    })
}

pub(super) fn fresh_finalization_grant_blocker(
    grant_summary: Option<&Value>,
) -> Option<QueueWorkflowCommandBlocker> {
    let Some(grant) = grant_summary else {
        return Some(blocker(
            "finalization_grant_required",
            "Queue workflow finalization requires a fresh structured Queue workflow grant.",
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
            "finalization_constraints_missing",
            "Queue workflow finalization requires grant.constraints.noDownstreamAutoStart=true.",
            Some("grant.constraints.noDownstreamAutoStart"),
        ));
    }
    if grant
        .as_object()
        .and_then(|object| object.get("expiresAt"))
        .and_then(Value::as_str)
        .is_some_and(|expires_at| expires_at == "expired")
    {
        return Some(blocker(
            "grant_expired",
            "Queue workflow finalization grant is stale or expired.",
            Some("grant.expiresAt"),
        ));
    }
    None
}

pub(super) fn is_retryable_finalization_failure_before_mutation(
    workflow_run: &AgentQueueWorkflowRunRow,
    actions: &[AgentQueueWorkflowActionRow],
    slot_bindings: &Map<String, Value>,
    slot: &str,
    completion_decision: Option<&AgentQueueCompletionDecisionRow>,
    failure_decision: Option<&AgentQueueFailureDecisionRow>,
    downstream_verification: &QueueWorkflowFinalizationDownstreamVerification,
) -> bool {
    if workflow_run.status != QueueWorkflowRunStatus::Failed.as_str()
        || workflow_run.phase != WORKFLOW_PHASE_FINALIZATION
        || workflow_run.current_step.as_deref() != Some("finalization_failed_unexpected")
        || completion_decision.is_some()
        || failure_decision.is_some()
        || !downstream_verification.not_auto_started_verified
    {
        return false;
    }
    let Some(binding) = slot_bindings.get(slot) else {
        return false;
    };
    if string_field(binding, "completionDecisionId").is_some()
        || string_field(binding, "failureDecisionId").is_some()
    {
        return false;
    }
    actions
        .iter()
        .all(|action| is_safe_failed_finalization_retry_history_action(action))
}

fn is_safe_failed_finalization_retry_history_action(action: &AgentQueueWorkflowActionRow) -> bool {
    matches!(
        action.action_type.as_str(),
        "create_task"
            | "update_run_settings"
            | "promote_task"
            | "start_worker"
            | "record_worker_evidence"
            | "queue.review.createMessage"
            | "queue.review.ack"
            | "queue.lifecycle.get"
            | "queue.evidence.lookup"
            | "queue.workflow.runner"
    )
}

pub(super) fn parse_slot_bindings(
    slot_bindings_json: Option<&str>,
) -> Result<Map<String, Value>, QueueWorkflowCommandBlocker> {
    let Some(raw) = slot_bindings_json else {
        return Ok(Map::new());
    };
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

pub(super) fn string_field<'a>(value: &'a Value, field: &str) -> Option<&'a str> {
    value
        .as_object()
        .and_then(|object| object.get(field))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

pub(super) fn parse_object(raw: Option<&str>) -> Map<String, Value> {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

pub(super) fn parse_json_value(raw: &str) -> Option<Value> {
    serde_json::from_str::<Value>(raw).ok()
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

pub(super) fn blocked(
    request: NormalizedFinalizationStepRequest,
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    transition: Option<QueueWorkflowFinalizationStepTransition>,
    code: &str,
    message: &str,
    field: Option<&str>,
) -> FinalizationStepResolveStatus {
    FinalizationStepResolveStatus::Blocked {
        request: Some(request),
        workflow_run,
        action: None,
        target_refs_json: None,
        transition,
        blocker: blocker(code, message, field),
        retryable_failed_finalization_before_mutation: false,
    }
}

pub(super) fn conflict(
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    action: Option<AgentQueueWorkflowActionRow>,
    transition: Option<QueueWorkflowFinalizationStepTransition>,
    code: &str,
    message: &str,
    existing: Option<String>,
    requested: Option<String>,
) -> FinalizationStepResolveStatus {
    FinalizationStepResolveStatus::Conflict {
        workflow_run: workflow_run.clone(),
        action,
        transition,
        blocker: Some(blocker(code, message, None)),
        conflict: queue_conflict(
            code,
            message,
            existing,
            requested,
            workflow_run.map(|run| run.workflow_run_id),
        ),
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

fn conflict_for_opposite_decision(
    workflow_run: Option<AgentQueueWorkflowRunRow>,
    field: &str,
    decision_id: Option<String>,
) -> (QueueWorkflowConflict, QueueWorkflowCommandBlocker) {
    (
        queue_conflict(
            "opposite_terminal_decision_exists",
            "Queue workflow finalization conflicts with an existing opposite terminal decision.",
            decision_id,
            None,
            workflow_run.as_ref().map(|run| run.workflow_run_id.clone()),
        ),
        blocker(
            "opposite_terminal_decision_exists",
            "Queue workflow finalization conflicts with an existing opposite terminal decision.",
            Some(field),
        ),
    )
}

fn queue_conflict(
    code: &str,
    message: &str,
    existing: Option<String>,
    requested: Option<String>,
    workflow_run_id: Option<String>,
) -> QueueWorkflowConflict {
    QueueWorkflowConflict {
        conflict_code: code.to_owned(),
        conflict_message: message.to_owned(),
        existing_workflow_run_id: workflow_run_id,
        existing_request_hash: existing,
        requested_request_hash: requested,
    }
}
