use super::super::{
    AgentQueueCompletionCommandResult, AgentQueueCompletionCommandStatus,
    AgentQueueFailureCommandResult, AgentQueueFailureCommandStatus,
};
use super::apply_state::{
    action_log_summary_json, block_workflow_run_for_finalization, complete_finalization_action,
    idempotency_keys_json, mutation_refs_json, record_blocked_finalization_action,
    update_binding_with_finalization, variables_json,
};
use super::support::{blocker, bounded_json, finalization_downstream_from_aggregate};
use super::*;

pub(super) enum FinalizationCommandResult {
    Completion(AgentQueueCompletionCommandResult),
    Failure(AgentQueueFailureCommandResult),
}

pub(super) fn complete_workflow_from_command(
    service: &WorkspaceService,
    store: &SqliteStore,
    mut resolved: FinalizationStepResolution,
    action: AgentQueueWorkflowActionRow,
    command_result: FinalizationCommandResult,
) -> Result<QueueWorkflowFinalizationStepResult, StorageError> {
    let mapped = map_command_result(&resolved, command_result);
    match mapped.status {
        QueueWorkflowFinalizationStepResultStatus::Executed
        | QueueWorkflowFinalizationStepResultStatus::AlreadyApplied => {
            resolved.completion_decision = store.get_latest_agent_queue_completion_decision(
                &resolved.request.workspace_id,
                &resolved.task_id,
            )?;
            resolved.failure_decision = store.get_latest_agent_queue_failure_decision(
                &resolved.request.workspace_id,
                &resolved.task_id,
            )?;
            complete_workflow_terminal(service, store, resolved, action, mapped.status)
        }
        QueueWorkflowFinalizationStepResultStatus::Conflict => {
            Ok(QueueWorkflowFinalizationStepResult {
                workflow_run_id: resolved.request.workflow_run_id,
                workflow_id: Some(resolved.workflow_run.workflow_id.clone()),
                transition: resolved.transition,
                status: QueueWorkflowFinalizationStepResultStatus::Conflict,
                action: Some(QueueWorkflowAction::from(action)),
                completion_decision_id: None,
                failure_decision_id: None,
                binding: None,
                workflow_run: Some(QueueWorkflowRun::from(resolved.workflow_run)),
                downstream_verification: Some(resolved.downstream_verification),
                next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
                next_step: Some("finalization_conflict".to_owned()),
                terminal_status: None,
                blockers: mapped.blocker.into_iter().collect(),
                conflict: mapped.conflict,
            })
        }
        QueueWorkflowFinalizationStepResultStatus::InvalidInput
        | QueueWorkflowFinalizationStepResultStatus::BlockedPrecondition => {
            let blocker = mapped.blocker.expect("blocker for blocked command");
            let action = record_blocked_finalization_action(
                store,
                &resolved.request,
                Some(action),
                &resolved.target_refs_json,
                resolved.transition,
                &blocker,
            )?;
            let workflow_run = block_workflow_run_for_finalization(
                store,
                &resolved.request,
                &resolved.workflow_run,
                &blocker,
            )?;
            Ok(QueueWorkflowFinalizationStepResult {
                workflow_run_id: resolved.request.workflow_run_id,
                workflow_id: Some(resolved.workflow_run.workflow_id),
                transition: resolved.transition,
                status: mapped.status,
                action: Some(QueueWorkflowAction::from(action)),
                completion_decision_id: None,
                failure_decision_id: None,
                binding: None,
                workflow_run: Some(QueueWorkflowRun::from(workflow_run)),
                downstream_verification: Some(resolved.downstream_verification),
                next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
                next_step: Some("finalization_blocked".to_owned()),
                terminal_status: None,
                blockers: vec![blocker],
                conflict: None,
            })
        }
        QueueWorkflowFinalizationStepResultStatus::FailedUnexpected => failed_unexpected_result(
            store,
            resolved,
            action,
            "Queue workflow finalization failed unexpectedly.",
        ),
    }
}

pub(super) fn complete_workflow_from_existing_decision(
    service: &WorkspaceService,
    store: &SqliteStore,
    resolved: FinalizationStepResolution,
) -> Result<QueueWorkflowFinalizationStepResult, StorageError> {
    let action = open_finalization_action(store, &resolved)?;
    complete_workflow_terminal(
        service,
        store,
        resolved,
        action,
        QueueWorkflowFinalizationStepResultStatus::AlreadyApplied,
    )
}

pub(super) fn non_ready_result(
    store: &SqliteStore,
    resolution: FinalizationStepResolveStatus,
) -> Result<QueueWorkflowFinalizationStepResult, StorageError> {
    match resolution {
        FinalizationStepResolveStatus::Blocked {
            request,
            workflow_run,
            action,
            target_refs_json,
            transition,
            blocker,
            ..
        } => {
            let action = match (&request, target_refs_json.as_ref(), transition) {
                (Some(request), Some(target_refs), Some(transition)) => {
                    Some(record_blocked_finalization_action(
                        store,
                        request,
                        action,
                        target_refs,
                        transition,
                        &blocker,
                    )?)
                }
                _ => action,
            };
            let workflow_run = match (&request, workflow_run) {
                (Some(request), Some(workflow_run)) => Some(block_workflow_run_for_finalization(
                    store,
                    request,
                    &workflow_run,
                    &blocker,
                )?),
                (_, workflow_run) => workflow_run,
            };
            Ok(QueueWorkflowFinalizationStepResult {
                workflow_run_id: request
                    .as_ref()
                    .map(|request| request.workflow_run_id.clone())
                    .or_else(|| workflow_run.as_ref().map(|run| run.workflow_run_id.clone()))
                    .unwrap_or_default(),
                workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
                transition: transition
                    .unwrap_or(QueueWorkflowFinalizationStepTransition::FinalizeDone),
                status: QueueWorkflowFinalizationStepResultStatus::BlockedPrecondition,
                action: action.map(QueueWorkflowAction::from),
                completion_decision_id: None,
                failure_decision_id: None,
                binding: None,
                workflow_run: workflow_run.map(QueueWorkflowRun::from),
                downstream_verification: None,
                next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
                next_step: Some("finalization_blocked".to_owned()),
                terminal_status: None,
                blockers: vec![blocker],
                conflict: None,
            })
        }
        FinalizationStepResolveStatus::Conflict {
            workflow_run,
            action,
            transition,
            conflict,
            blocker,
        } => Ok(QueueWorkflowFinalizationStepResult {
            workflow_run_id: workflow_run
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .or_else(|| conflict.existing_workflow_run_id.clone())
                .unwrap_or_default(),
            workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
            transition: transition.unwrap_or(QueueWorkflowFinalizationStepTransition::FinalizeDone),
            status: QueueWorkflowFinalizationStepResultStatus::Conflict,
            action: action.map(QueueWorkflowAction::from),
            completion_decision_id: None,
            failure_decision_id: None,
            binding: None,
            workflow_run: workflow_run.map(QueueWorkflowRun::from),
            downstream_verification: None,
            next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
            next_step: Some("finalization_conflict".to_owned()),
            terminal_status: None,
            blockers: blocker.into_iter().collect(),
            conflict: Some(conflict),
        }),
        FinalizationStepResolveStatus::NotFound { request, blocker } => {
            Ok(QueueWorkflowFinalizationStepResult {
                workflow_run_id: request.workflow_run_id,
                workflow_id: None,
                transition: QueueWorkflowFinalizationStepTransition::FinalizeDone,
                status: QueueWorkflowFinalizationStepResultStatus::InvalidInput,
                action: None,
                completion_decision_id: None,
                failure_decision_id: None,
                binding: None,
                workflow_run: None,
                downstream_verification: None,
                next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
                next_step: None,
                terminal_status: None,
                blockers: vec![blocker],
                conflict: None,
            })
        }
        FinalizationStepResolveStatus::InvalidInput {
            workflow_run_id,
            transition,
            blocker,
        } => Ok(QueueWorkflowFinalizationStepResult {
            workflow_run_id,
            workflow_id: None,
            transition: transition.unwrap_or(QueueWorkflowFinalizationStepTransition::FinalizeDone),
            status: QueueWorkflowFinalizationStepResultStatus::InvalidInput,
            action: None,
            completion_decision_id: None,
            failure_decision_id: None,
            binding: None,
            workflow_run: None,
            downstream_verification: None,
            next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
            next_step: None,
            terminal_status: None,
            blockers: vec![blocker],
            conflict: None,
        }),
        FinalizationStepResolveStatus::Ready(_) => unreachable!("ready resolution handled earlier"),
    }
}

pub(super) fn open_finalization_action(
    store: &SqliteStore,
    resolved: &FinalizationStepResolution,
) -> Result<AgentQueueWorkflowActionRow, StorageError> {
    let now = placeholder_timestamp();
    match resolved.action.clone() {
        Some(action) if action.status == QueueWorkflowActionStatus::Completed.as_str() => {
            Ok(action)
        }
        Some(action) => store
            .replace_agent_queue_workflow_action_refs_and_resolution(
                &resolved.request.workspace_id,
                &resolved.request.workflow_run_id,
                &resolved.action_idempotency_key,
                Some(&resolved.target_refs_json),
                AgentQueueWorkflowActionUpdate {
                    status: QueueWorkflowActionStatus::Running.as_str(),
                    result_refs_json: None,
                    blocker_code: None,
                    blocker_message: None,
                    attempt_count: Some(action.attempt_count.saturating_add(1)),
                    started_at: action.started_at.as_deref().or(Some(&now)),
                    completed_at: None,
                    updated_at: Some(&now),
                },
            )?
            .ok_or(StorageError::QueryReturnedNoRows),
        None => {
            let action_id = placeholder_id("queue-workflow-action-");
            store.insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &action_id,
                workflow_run_id: &resolved.request.workflow_run_id,
                workspace_id: &resolved.request.workspace_id,
                step_id: resolved.transition.step_id(),
                action_type: resolved.transition.action_type(),
                idempotency_key: &resolved.action_idempotency_key,
                status: QueueWorkflowActionStatus::Running.as_str(),
                target_refs_json: Some(&resolved.target_refs_json),
                result_refs_json: None,
                blocker_code: None,
                blocker_message: None,
                attempt_count: 1,
                started_at: Some(&now),
                completed_at: None,
                created_at: Some(&now),
                updated_at: Some(&now),
            })
        }
    }
}

pub(super) fn failed_unexpected_result(
    store: &SqliteStore,
    resolved: FinalizationStepResolution,
    action: AgentQueueWorkflowActionRow,
    message: &str,
) -> Result<QueueWorkflowFinalizationStepResult, StorageError> {
    let now = placeholder_timestamp();
    let result_refs_json = canonical_json_string(&json!({
        "commandStatus": "failed_unexpected",
        "status": "failed_unexpected",
    }));
    let action = store
        .replace_agent_queue_workflow_action_resolution(
            &resolved.request.workspace_id,
            &resolved.request.workflow_run_id,
            &resolved.action_idempotency_key,
            AgentQueueWorkflowActionUpdate {
                status: QueueWorkflowActionStatus::Failed.as_str(),
                result_refs_json: Some(&result_refs_json),
                blocker_code: Some("failed_unexpected"),
                blocker_message: Some(message),
                attempt_count: Some(action.attempt_count),
                started_at: action.started_at.as_deref().or(Some(&now)),
                completed_at: Some(&now),
                updated_at: Some(&now),
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)?;
    let workflow_run = store
        .update_agent_queue_workflow_run_report(
            &resolved.request.workspace_id,
            &resolved.request.workflow_run_id,
            AgentQueueWorkflowRunReportUpdate {
                status: QueueWorkflowRunStatus::Failed.as_str(),
                phase: Some(WORKFLOW_PHASE_FINALIZATION),
                current_step: Some("finalization_failed_unexpected"),
                pause_reason: None,
                blocker_reason: Some(message),
                variables_json: None,
                slot_bindings_json: None,
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                updated_at: Some(&now),
                completed_at: Some(&now),
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)?;
    let blocker = blocker("failed_unexpected", message, None);
    Ok(QueueWorkflowFinalizationStepResult {
        workflow_run_id: resolved.request.workflow_run_id,
        workflow_id: Some(resolved.workflow_run.workflow_id),
        transition: resolved.transition,
        status: QueueWorkflowFinalizationStepResultStatus::FailedUnexpected,
        action: Some(QueueWorkflowAction::from(action)),
        completion_decision_id: None,
        failure_decision_id: None,
        binding: None,
        workflow_run: Some(QueueWorkflowRun::from(workflow_run)),
        downstream_verification: Some(resolved.downstream_verification),
        next_phase: Some(WORKFLOW_PHASE_FINALIZATION.to_owned()),
        next_step: Some("finalization_failed_unexpected".to_owned()),
        terminal_status: Some(QueueWorkflowRunStatus::Failed.as_str().to_owned()),
        blockers: vec![blocker],
        conflict: None,
    })
}

fn complete_workflow_terminal(
    service: &WorkspaceService,
    store: &SqliteStore,
    mut resolved: FinalizationStepResolution,
    action: AgentQueueWorkflowActionRow,
    status: QueueWorkflowFinalizationStepResultStatus,
) -> Result<QueueWorkflowFinalizationStepResult, StorageError> {
    let now = placeholder_timestamp();
    let completion_decision_id = resolved
        .completion_decision
        .as_ref()
        .map(|decision| decision.decision_id.clone());
    let failure_decision_id = resolved
        .failure_decision
        .as_ref()
        .map(|decision| decision.decision_id.clone());
    let confirmation_accepted =
        resolved.request.confirmation_token.as_deref() == Some(CONFIRMATION_TOKEN);
    let downstream_aggregate = resolved
        .downstream_verification
        .downstream_task_id
        .as_ref()
        .and_then(|task_id| {
            service
                .get_queue_item_aggregate(&resolved.request.workspace_id, task_id)
                .ok()
                .flatten()
        });
    let downstream_verification = finalization_downstream_from_aggregate(
        downstream_aggregate.as_ref(),
        resolved.downstream_verification.clone(),
    );
    let result_refs_json = canonical_json_string(&json!({
        "commandStatus": status.as_str(),
        "completionDecisionId": completion_decision_id,
        "confirmationAccepted": confirmation_accepted,
        "downstreamVerification": {
            "dependencyState": downstream_verification.dependency_state,
            "downstreamTaskId": downstream_verification.downstream_task_id,
            "expectedDependencyState": downstream_verification.expected_dependency_state,
            "notAutoStartedVerified": downstream_verification.not_auto_started_verified,
        },
        "evidenceBundleId": resolved.evidence.bundle_id,
        "failureDecisionId": failure_decision_id,
        "messageId": resolved.review_message.message_id,
        "runId": resolved.run_id,
        "status": status.as_str(),
        "transition": resolved.transition.as_str(),
    }));
    let action = complete_finalization_action(
        store,
        &resolved.request,
        action,
        &resolved.action_idempotency_key,
        &result_refs_json,
        &now,
    )?;

    update_binding_with_finalization(
        &mut resolved.slot_bindings,
        &resolved.request.slot,
        &action,
        &resolved.action_idempotency_key,
        completion_decision_id.as_deref(),
        failure_decision_id.as_deref(),
        &now,
        resolved.transition,
    );
    let slot_bindings_json = bounded_json(
        canonical_json_string(&Value::Object(resolved.slot_bindings.clone())),
        MAX_WORKFLOW_SLOT_BINDINGS_JSON_BYTES,
        "slotBindings",
    )?;
    let mutation_refs_json = bounded_json(
        mutation_refs_json(
            resolved.workflow_run.mutation_refs_json.as_deref(),
            &resolved,
            &action,
            completion_decision_id.as_deref(),
            failure_decision_id.as_deref(),
        ),
        MAX_WORKFLOW_MUTATION_REFS_JSON_BYTES,
        "mutationRefs",
    )?;
    let idempotency_keys_json = bounded_json(
        idempotency_keys_json(
            resolved.workflow_run.idempotency_keys_json.as_deref(),
            &resolved.action_idempotency_key,
        ),
        MAX_WORKFLOW_IDEMPOTENCY_KEYS_JSON_BYTES,
        "idempotencyKeys",
    )?;
    let action_log_summary_json = bounded_json(
        action_log_summary_json(
            resolved.workflow_run.action_log_summary_json.as_deref(),
            &resolved,
            completion_decision_id.as_deref(),
            failure_decision_id.as_deref(),
            status,
        ),
        MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES,
        "actionLogSummary",
    )?;
    let variables_json = bounded_json(
        variables_json(
            resolved.workflow_run.variables_json.as_deref(),
            &resolved,
            completion_decision_id.as_deref(),
            failure_decision_id.as_deref(),
        ),
        MAX_WORKFLOW_VARIABLES_JSON_BYTES,
        "variables",
    )?;

    let workflow_run = store
        .update_agent_queue_workflow_run_report(
            &resolved.request.workspace_id,
            &resolved.request.workflow_run_id,
            AgentQueueWorkflowRunReportUpdate {
                status: QueueWorkflowRunStatus::Completed.as_str(),
                phase: Some(WORKFLOW_PHASE_CLOSED),
                current_step: Some(WORKFLOW_STEP_FINALIZATION_COMPLETE),
                pause_reason: None,
                blocker_reason: None,
                variables_json: Some(&variables_json),
                slot_bindings_json: Some(&slot_bindings_json),
                mutation_refs_json: Some(&mutation_refs_json),
                idempotency_keys_json: Some(&idempotency_keys_json),
                action_log_summary_json: Some(&action_log_summary_json),
                updated_at: Some(&now),
                completed_at: Some(&now),
            },
        )?
        .ok_or(StorageError::QueryReturnedNoRows)?;
    store.touch_workspace(&resolved.request.workspace_id)?;

    let binding = QueueWorkflowFinalizationBindingSummary {
        slot: resolved.request.slot.clone(),
        task_id: resolved.task_id,
        run_id: resolved.run_id,
        evidence_bundle_id: resolved.evidence.bundle_id,
        message_id: resolved.review_message.message_id,
        completion_decision_id: completion_decision_id.clone(),
        failure_decision_id: failure_decision_id.clone(),
        finalization_action_id: Some(action.action_id.clone()),
        action_idempotency_key: resolved.action_idempotency_key,
        terminal_status: QueueWorkflowRunStatus::Completed.as_str().to_owned(),
        finalized_at: Some(now),
    };

    Ok(QueueWorkflowFinalizationStepResult {
        workflow_run_id: resolved.request.workflow_run_id,
        workflow_id: Some(resolved.workflow_run.workflow_id),
        transition: resolved.transition,
        status,
        action: Some(QueueWorkflowAction::from(action)),
        completion_decision_id,
        failure_decision_id,
        binding: Some(binding),
        workflow_run: Some(QueueWorkflowRun::from(workflow_run)),
        downstream_verification: Some(downstream_verification),
        next_phase: Some(WORKFLOW_PHASE_CLOSED.to_owned()),
        next_step: Some(WORKFLOW_STEP_FINALIZATION_COMPLETE.to_owned()),
        terminal_status: Some(QueueWorkflowRunStatus::Completed.as_str().to_owned()),
        blockers: Vec::new(),
        conflict: None,
    })
}

struct MappedCommandResult {
    status: QueueWorkflowFinalizationStepResultStatus,
    blocker: Option<QueueWorkflowCommandBlocker>,
    conflict: Option<QueueWorkflowConflict>,
}

fn map_command_result(
    resolved: &FinalizationStepResolution,
    command_result: FinalizationCommandResult,
) -> MappedCommandResult {
    match command_result {
        FinalizationCommandResult::Completion(result) => {
            let status = match result.status {
                AgentQueueCompletionCommandStatus::Succeeded => {
                    QueueWorkflowFinalizationStepResultStatus::Executed
                }
                AgentQueueCompletionCommandStatus::AlreadyDone => {
                    QueueWorkflowFinalizationStepResultStatus::AlreadyApplied
                }
                AgentQueueCompletionCommandStatus::InvalidInput => {
                    QueueWorkflowFinalizationStepResultStatus::InvalidInput
                }
                AgentQueueCompletionCommandStatus::Blocked
                | AgentQueueCompletionCommandStatus::PreconditionFailed => {
                    QueueWorkflowFinalizationStepResultStatus::BlockedPrecondition
                }
            };
            MappedCommandResult {
                status,
                blocker: result.blocker.map(completion_blocker),
                conflict: None,
            }
        }
        FinalizationCommandResult::Failure(result) => {
            if result.status == AgentQueueFailureCommandStatus::AlreadyDone {
                return MappedCommandResult {
                    status: QueueWorkflowFinalizationStepResultStatus::Conflict,
                    blocker: Some(blocker(
                        "opposite_terminal_decision_exists",
                        "Queue workflow failure finalization conflicts with an existing completion decision.",
                        Some("completionDecisionId"),
                    )),
                    conflict: Some(QueueWorkflowConflict {
                        conflict_code: "opposite_terminal_decision_exists".to_owned(),
                        conflict_message:
                            "Queue workflow failure finalization conflicts with an existing completion decision."
                                .to_owned(),
                        existing_workflow_run_id: Some(resolved.request.workflow_run_id.clone()),
                        existing_request_hash: None,
                        requested_request_hash: Some(resolved.transition.as_str().to_owned()),
                    }),
                };
            }
            let status = match result.status {
                AgentQueueFailureCommandStatus::Succeeded => {
                    QueueWorkflowFinalizationStepResultStatus::Executed
                }
                AgentQueueFailureCommandStatus::AlreadyFailed => {
                    QueueWorkflowFinalizationStepResultStatus::AlreadyApplied
                }
                AgentQueueFailureCommandStatus::InvalidInput => {
                    QueueWorkflowFinalizationStepResultStatus::InvalidInput
                }
                AgentQueueFailureCommandStatus::Blocked
                | AgentQueueFailureCommandStatus::PreconditionFailed => {
                    QueueWorkflowFinalizationStepResultStatus::BlockedPrecondition
                }
                AgentQueueFailureCommandStatus::AlreadyDone => unreachable!("handled above"),
            };
            MappedCommandResult {
                status,
                blocker: result.blocker.map(failure_blocker),
                conflict: None,
            }
        }
    }
}

fn completion_blocker(
    blocker: super::super::AgentQueueCompletionCommandBlocker,
) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: blocker.blocker_code,
        blocker_message: blocker.blocker_message,
        missing_required_field: blocker.missing_required_field,
    }
}

fn failure_blocker(
    blocker: super::super::AgentQueueFailureCommandBlocker,
) -> QueueWorkflowCommandBlocker {
    QueueWorkflowCommandBlocker {
        blocker_code: blocker.blocker_code,
        blocker_message: blocker.blocker_message,
        missing_required_field: blocker.missing_required_field,
    }
}
