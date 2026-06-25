use super::support::*;
use super::*;

pub(super) fn execute_review_step_resolution(
    store: &SqliteStore,
    resolution: ReviewStepResolveStatus,
) -> Result<QueueWorkflowReviewStepResult, StorageError> {
    match resolution {
        ReviewStepResolveStatus::Ready(resolved) => execute_ready_review_step(store, resolved),
        ReviewStepResolveStatus::Blocked {
            request,
            workflow_run,
            create_action,
            ack_action,
            target_refs_json,
            blocker,
            ..
        } => {
            let action = match (request.as_ref(), target_refs_json.as_ref()) {
                (Some(request), Some(target_refs)) => Some(record_blocked_review_action(
                    store,
                    request,
                    create_action.clone(),
                    target_refs,
                    &blocker,
                )?),
                _ => create_action,
            };
            let workflow_run = match (request.as_ref(), workflow_run) {
                (Some(request), Some(workflow_run)) => Some(block_workflow_run_for_review(
                    store,
                    request,
                    &workflow_run,
                    &blocker,
                )?),
                (_, workflow_run) => workflow_run,
            };
            Ok(QueueWorkflowReviewStepResult {
                workflow_run_id: request
                    .as_ref()
                    .map(|request| request.workflow_run_id.clone())
                    .or_else(|| workflow_run.as_ref().map(|run| run.workflow_run_id.clone()))
                    .unwrap_or_default(),
                transition: QueueWorkflowReviewStepTransition::Review,
                status: QueueWorkflowReviewStepResultStatus::BlockedPrecondition,
                create_action: action.map(QueueWorkflowAction::from),
                ack_action: ack_action.map(QueueWorkflowAction::from),
                message_id: None,
                ack_status: None,
                binding: None,
                workflow_run: workflow_run.map(QueueWorkflowRun::from),
                next_phase: Some(WORKFLOW_PHASE_REVIEW.to_owned()),
                next_step: Some("review_blocked".to_owned()),
                blockers: vec![blocker],
                conflict: None,
            })
        }
        ReviewStepResolveStatus::Conflict {
            workflow_run,
            create_action,
            ack_action,
            conflict,
            blocker,
        } => Ok(QueueWorkflowReviewStepResult {
            workflow_run_id: workflow_run
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .or_else(|| conflict.existing_workflow_run_id.clone())
                .unwrap_or_default(),
            transition: QueueWorkflowReviewStepTransition::Review,
            status: QueueWorkflowReviewStepResultStatus::Conflict,
            create_action: create_action.map(QueueWorkflowAction::from),
            ack_action: ack_action.map(QueueWorkflowAction::from),
            message_id: None,
            ack_status: None,
            binding: None,
            workflow_run: workflow_run.map(QueueWorkflowRun::from),
            next_phase: Some(WORKFLOW_PHASE_REVIEW.to_owned()),
            next_step: Some("review_blocked".to_owned()),
            blockers: blocker.into_iter().collect(),
            conflict: Some(conflict),
        }),
        ReviewStepResolveStatus::NotFound { request, blocker } => {
            Ok(QueueWorkflowReviewStepResult {
                workflow_run_id: request.workflow_run_id,
                transition: QueueWorkflowReviewStepTransition::Review,
                status: QueueWorkflowReviewStepResultStatus::NotFound,
                create_action: None,
                ack_action: None,
                message_id: None,
                ack_status: None,
                binding: None,
                workflow_run: None,
                next_phase: Some(WORKFLOW_PHASE_REVIEW.to_owned()),
                next_step: None,
                blockers: vec![blocker],
                conflict: None,
            })
        }
        ReviewStepResolveStatus::InvalidInput {
            workflow_run_id,
            blocker,
        } => Ok(QueueWorkflowReviewStepResult {
            workflow_run_id,
            transition: QueueWorkflowReviewStepTransition::Review,
            status: QueueWorkflowReviewStepResultStatus::InvalidInput,
            create_action: None,
            ack_action: None,
            message_id: None,
            ack_status: None,
            binding: None,
            workflow_run: None,
            next_phase: Some(WORKFLOW_PHASE_REVIEW.to_owned()),
            next_step: None,
            blockers: vec![blocker],
            conflict: None,
        }),
    }
}

fn execute_ready_review_step(
    store: &SqliteStore,
    mut resolved: ReviewStepResolution,
) -> Result<QueueWorkflowReviewStepResult, StorageError> {
    let now = placeholder_timestamp();
    let had_message = resolved.existing_message.is_some();
    let create_action = open_review_action(
        store,
        &resolved.request,
        resolved.create_action.take(),
        CREATE_REVIEW_STEP_ID,
        CREATE_REVIEW_ACTION_TYPE,
        &resolved.create_idempotency_key,
        &resolved.create_target_refs_json,
        &now,
    )?;
    let message = match resolved.existing_message.take() {
        Some(message) => message,
        None => store.insert_agent_queue_review_message(NewAgentQueueReviewMessage {
            message_id: &placeholder_id("queue-review-message-"),
            workspace_id: &resolved.request.workspace_id,
            queue_task_id: &resolved.task_id,
            run_id: Some(&resolved.run_id),
            run_link_id: Some(&resolved.run_link.link_id),
            actor_id: &resolved.request.actor_id,
            message_body: &review_message_body(&resolved.evidence),
            status: REVIEW_MESSAGE_STATUS_CREATED,
            created_at: Some(&now),
            acked_at: None,
            ack_actor_id: None,
            metadata_json: None,
            updated_at: Some(&now),
        })?,
    };
    let create_result_refs = canonical_json_string(&json!({
        "evidenceBundleId": resolved.evidence.bundle_id,
        "messageId": message.message_id,
        "runId": resolved.run_id,
        "status": if had_message { "reused" } else { "created" },
    }));
    let create_action = complete_review_action(
        store,
        &resolved.request,
        create_action,
        &resolved.create_idempotency_key,
        &create_result_refs,
        &now,
    )?;

    let ack_idempotency_key = resolved.ack_idempotency_key.clone().unwrap_or_else(|| {
        ack_review_idempotency_key(
            &resolved.request.workflow_run_id,
            &resolved.request.slot,
            &message.message_id,
        )
    });
    let ack_target_refs_json = resolved.ack_target_refs_json.clone().unwrap_or_else(|| {
        canonical_json_string(&json!({
            "messageId": message.message_id,
            "slot": resolved.request.slot,
            "taskId": resolved.task_id,
            "workflowRunId": resolved.request.workflow_run_id,
        }))
    });
    let ack_action = open_review_action(
        store,
        &resolved.request,
        resolved.ack_action.take(),
        ACK_REVIEW_STEP_ID,
        ACK_REVIEW_ACTION_TYPE,
        &ack_idempotency_key,
        &ack_target_refs_json,
        &now,
    )?;
    let had_ack = message.status == REVIEW_MESSAGE_STATUS_ACKNOWLEDGED;
    let message = if had_ack {
        message
    } else {
        store
            .ack_agent_queue_review_message(
                &resolved.request.workspace_id,
                &resolved.task_id,
                &message.message_id,
                AgentQueueReviewMessageAckUpdate {
                    actor_id: &resolved.request.actor_id,
                    status: REVIEW_MESSAGE_STATUS_ACKNOWLEDGED,
                    acked_at: Some(&now),
                    updated_at: Some(&now),
                },
            )?
            .ok_or(StorageError::QueryReturnedNoRows)?
    };
    let ack_result_refs = canonical_json_string(&json!({
        "ackStatus": if had_ack { "already_acknowledged" } else { "acknowledged" },
        "messageId": message.message_id,
        "status": "acknowledged",
    }));
    let ack_action = complete_review_action(
        store,
        &resolved.request,
        ack_action,
        &ack_idempotency_key,
        &ack_result_refs,
        &now,
    )?;

    update_binding_with_review(
        &mut resolved.slot_bindings,
        &resolved.request.slot,
        &message,
        &create_action,
        &ack_action,
        &resolved.create_idempotency_key,
        &ack_idempotency_key,
    );
    let slot_bindings_json = bounded_json(
        canonical_json_string(&Value::Object(resolved.slot_bindings)),
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
        "slotBindings",
    )?;
    let mutation_refs_json = bounded_json(
        mutation_refs_json(
            resolved.workflow_run.mutation_refs_json.as_deref(),
            &resolved.request,
            &message,
            &resolved.evidence,
        ),
        MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
        "mutationRefs",
    )?;
    let idempotency_keys_json = bounded_json(
        idempotency_keys_json(
            resolved.workflow_run.idempotency_keys_json.as_deref(),
            &resolved.create_idempotency_key,
            &ack_idempotency_key,
        ),
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES,
        "idempotencyKeys",
    )?;
    let action_log_summary_json = bounded_json(
        action_log_summary_json(
            resolved.workflow_run.action_log_summary_json.as_deref(),
            &resolved.request,
            &message,
        ),
        MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
        "actionLogSummary",
    )?;
    let variables_json = bounded_json(
        variables_json(
            resolved.workflow_run.variables_json.as_deref(),
            &resolved.request,
            &message,
            &resolved.evidence,
        ),
        MAX_WORKFLOW_VARIABLES_JSON_BYTES,
        "variables",
    )?;

    let updated_run = store
        .update_agent_queue_workflow_run_report_reopened(
            &resolved.request.workspace_id,
            &resolved.request.workflow_run_id,
            AgentQueueWorkflowRunReportUpdate {
                status: QueueWorkflowRunStatus::Paused.as_str(),
                phase: Some(WORKFLOW_PHASE_REVIEW),
                current_step: Some(WORKFLOW_STEP_AWAITING_FINALIZATION),
                pause_reason: Some(PAUSE_REASON_AWAITING_FINALIZATION),
                blocker_reason: None,
                variables_json: Some(&variables_json),
                slot_bindings_json: Some(&slot_bindings_json),
                mutation_refs_json: Some(&mutation_refs_json),
                idempotency_keys_json: Some(&idempotency_keys_json),
                action_log_summary_json: Some(&action_log_summary_json),
                updated_at: Some(&now),
                completed_at: None,
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)?;
    store.touch_workspace(&resolved.request.workspace_id)?;

    let binding = QueueWorkflowReviewBindingSummary {
        slot: resolved.request.slot.clone(),
        task_id: resolved.task_id,
        run_id: resolved.run_id,
        evidence_bundle_id: resolved.evidence.bundle_id,
        message_id: message.message_id.clone(),
        create_action_id: Some(create_action.action_id.clone()),
        create_action_idempotency_key: resolved.create_idempotency_key,
        ack_action_id: Some(ack_action.action_id.clone()),
        ack_action_idempotency_key: ack_idempotency_key,
        ack_status: message.status.clone(),
        review_created_at: Some(message.created_at.clone()),
        review_acked_at: message.acked_at.clone(),
    };

    Ok(QueueWorkflowReviewStepResult {
        workflow_run_id: resolved.request.workflow_run_id,
        transition: QueueWorkflowReviewStepTransition::Review,
        status: if had_message && had_ack {
            QueueWorkflowReviewStepResultStatus::AlreadyApplied
        } else {
            QueueWorkflowReviewStepResultStatus::Executed
        },
        create_action: Some(QueueWorkflowAction::from(create_action)),
        ack_action: Some(QueueWorkflowAction::from(ack_action)),
        message_id: Some(message.message_id),
        ack_status: Some(REVIEW_MESSAGE_STATUS_ACKNOWLEDGED.to_owned()),
        binding: Some(binding),
        workflow_run: Some(QueueWorkflowRun::from(updated_run)),
        next_phase: Some("finalization".to_owned()),
        next_step: Some(WORKFLOW_STEP_AWAITING_FINALIZATION.to_owned()),
        blockers: Vec::new(),
        conflict: None,
    })
}

pub(super) fn plan_from_review_resolution(
    fallback_workflow_run_id: &str,
    resolution: ReviewStepResolveStatus,
) -> QueueWorkflowReviewStepPlan {
    match resolution {
        ReviewStepResolveStatus::Ready(resolved) => {
            let message_id = resolved
                .existing_message
                .as_ref()
                .map(|message| message.message_id.clone());
            QueueWorkflowReviewStepPlan {
                workflow_run_id: resolved.request.workflow_run_id.clone(),
                workflow_id: Some(resolved.workflow_run.workflow_id.clone()),
                persistent_status: Some(resolved.workflow_run.status.clone()),
                phase: Some(resolved.workflow_run.phase.clone()),
                current_step: resolved.workflow_run.current_step.clone(),
                transition: QueueWorkflowReviewStepTransition::Review,
                executable: true,
                next_actions: if message_id.is_some() {
                    vec!["ack_review_message".to_owned()]
                } else {
                    vec![
                        "create_review_message".to_owned(),
                        "ack_review_message".to_owned(),
                    ]
                },
                target_refs: parse_json_value(&resolved.create_target_refs_json),
                existing_refs: Some(json!({
                    "ackActionId": resolved.ack_action.as_ref().map(|action| action.action_id.clone()),
                    "createActionId": resolved.create_action.as_ref().map(|action| action.action_id.clone()),
                    "evidenceBundleId": resolved.evidence.bundle_id,
                    "messageId": message_id,
                    "runId": resolved.run_id,
                    "runLinkId": resolved.run_link.link_id,
                })),
                required_fresh_grant: true,
                blockers: Vec::new(),
                expected_next_phase_on_success: Some("finalization".to_owned()),
                expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_FINALIZATION.to_owned()),
                retryable_failed_review_before_mutation: resolved
                    .retryable_failed_review_before_mutation,
            }
        }
        ReviewStepResolveStatus::Blocked {
            request,
            workflow_run,
            target_refs_json,
            blocker,
            retryable_failed_review_before_mutation,
            ..
        } => QueueWorkflowReviewStepPlan {
            workflow_run_id: request
                .as_ref()
                .map(|request| request.workflow_run_id.clone())
                .or_else(|| workflow_run.as_ref().map(|run| run.workflow_run_id.clone()))
                .unwrap_or_else(|| fallback_workflow_run_id.to_owned()),
            workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
            persistent_status: workflow_run.as_ref().map(|run| run.status.clone()),
            phase: workflow_run.as_ref().map(|run| run.phase.clone()),
            current_step: workflow_run
                .as_ref()
                .and_then(|run| run.current_step.clone()),
            transition: QueueWorkflowReviewStepTransition::Review,
            executable: false,
            next_actions: Vec::new(),
            target_refs: target_refs_json.as_deref().and_then(parse_json_value),
            existing_refs: None,
            required_fresh_grant: true,
            blockers: vec![blocker],
            expected_next_phase_on_success: Some("finalization".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_FINALIZATION.to_owned()),
            retryable_failed_review_before_mutation,
        },
        ReviewStepResolveStatus::Conflict {
            workflow_run,
            conflict,
            blocker,
            ..
        } => QueueWorkflowReviewStepPlan {
            workflow_run_id: workflow_run
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .or_else(|| conflict.existing_workflow_run_id.clone())
                .unwrap_or_else(|| fallback_workflow_run_id.to_owned()),
            workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
            persistent_status: workflow_run.as_ref().map(|run| run.status.clone()),
            phase: workflow_run.as_ref().map(|run| run.phase.clone()),
            current_step: workflow_run
                .as_ref()
                .and_then(|run| run.current_step.clone()),
            transition: QueueWorkflowReviewStepTransition::Review,
            executable: false,
            next_actions: Vec::new(),
            target_refs: None,
            existing_refs: None,
            required_fresh_grant: true,
            blockers: blocker.into_iter().collect(),
            expected_next_phase_on_success: Some("finalization".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_FINALIZATION.to_owned()),
            retryable_failed_review_before_mutation: false,
        },
        ReviewStepResolveStatus::NotFound { request, blocker } => QueueWorkflowReviewStepPlan {
            workflow_run_id: request.workflow_run_id,
            workflow_id: None,
            persistent_status: None,
            phase: None,
            current_step: None,
            transition: QueueWorkflowReviewStepTransition::Review,
            executable: false,
            next_actions: Vec::new(),
            target_refs: None,
            existing_refs: None,
            required_fresh_grant: true,
            blockers: vec![blocker],
            expected_next_phase_on_success: Some("finalization".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_FINALIZATION.to_owned()),
            retryable_failed_review_before_mutation: false,
        },
        ReviewStepResolveStatus::InvalidInput {
            workflow_run_id,
            blocker,
        } => QueueWorkflowReviewStepPlan {
            workflow_run_id,
            workflow_id: None,
            persistent_status: None,
            phase: None,
            current_step: None,
            transition: QueueWorkflowReviewStepTransition::Review,
            executable: false,
            next_actions: Vec::new(),
            target_refs: None,
            existing_refs: None,
            required_fresh_grant: true,
            blockers: vec![blocker],
            expected_next_phase_on_success: Some("finalization".to_owned()),
            expected_next_step_on_success: Some(WORKFLOW_STEP_AWAITING_FINALIZATION.to_owned()),
            retryable_failed_review_before_mutation: false,
        },
    }
}
