use super::support::*;
use super::*;

pub(super) fn plan_from_finalization_resolution(
    fallback_workflow_run_id: &str,
    resolution: FinalizationStepResolveStatus,
) -> QueueWorkflowFinalizationStepPlan {
    match resolution {
        FinalizationStepResolveStatus::Ready(resolved) => ready_plan(resolved),
        FinalizationStepResolveStatus::Blocked {
            request,
            workflow_run,
            target_refs_json,
            transition,
            blocker,
            retryable_failed_finalization_before_mutation,
            ..
        } => QueueWorkflowFinalizationStepPlan {
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
            transition: transition.unwrap_or(QueueWorkflowFinalizationStepTransition::FinalizeDone),
            executable: false,
            already_applied: false,
            action_idempotency_key: None,
            target_refs: target_refs_json.as_deref().and_then(parse_json_value),
            existing_refs: None,
            required_grant_classes: vec!["queue_workflow_finalization".to_owned()],
            confirmation_required: true,
            confirmation_accepted: false,
            failure_reason_required: transition
                == Some(QueueWorkflowFinalizationStepTransition::FinalizeFail),
            blockers: vec![blocker],
            expected_next_status: Some(QueueWorkflowRunStatus::Completed.as_str().to_owned()),
            expected_downstream_verification: None,
            retryable_failed_finalization_before_mutation,
        },
        FinalizationStepResolveStatus::Conflict {
            workflow_run,
            transition,
            blocker,
            ..
        } => QueueWorkflowFinalizationStepPlan {
            workflow_run_id: workflow_run
                .as_ref()
                .map(|run| run.workflow_run_id.clone())
                .unwrap_or_else(|| fallback_workflow_run_id.to_owned()),
            workflow_id: workflow_run.as_ref().map(|run| run.workflow_id.clone()),
            persistent_status: workflow_run.as_ref().map(|run| run.status.clone()),
            phase: workflow_run.as_ref().map(|run| run.phase.clone()),
            current_step: workflow_run
                .as_ref()
                .and_then(|run| run.current_step.clone()),
            transition: transition.unwrap_or(QueueWorkflowFinalizationStepTransition::FinalizeDone),
            executable: false,
            already_applied: false,
            action_idempotency_key: None,
            target_refs: None,
            existing_refs: None,
            required_grant_classes: vec!["queue_workflow_finalization".to_owned()],
            confirmation_required: true,
            confirmation_accepted: false,
            failure_reason_required: transition
                == Some(QueueWorkflowFinalizationStepTransition::FinalizeFail),
            blockers: blocker.into_iter().collect(),
            expected_next_status: Some(QueueWorkflowRunStatus::Completed.as_str().to_owned()),
            expected_downstream_verification: None,
            retryable_failed_finalization_before_mutation: false,
        },
        FinalizationStepResolveStatus::NotFound { request, blocker } => {
            invalid_plan(request.workflow_run_id, None, blocker)
        }
        FinalizationStepResolveStatus::InvalidInput {
            workflow_run_id,
            transition,
            blocker,
        } => invalid_plan(workflow_run_id, transition, blocker),
    }
}

fn ready_plan(resolved: FinalizationStepResolution) -> QueueWorkflowFinalizationStepPlan {
    let already_applied = matching_decision(
        resolved.transition,
        resolved.completion_decision.as_ref(),
        resolved.failure_decision.as_ref(),
    )
    .is_some();
    let confirmation_accepted =
        resolved.request.confirmation_token.as_deref() == Some(CONFIRMATION_TOKEN);
    let blockers = if !already_applied && !confirmation_accepted {
        vec![blocker(
            "fresh_confirmation_required",
            "A fresh exact structured confirmationToken is required for Queue workflow finalization.",
            Some("confirmationToken"),
        )]
    } else {
        Vec::new()
    };
    QueueWorkflowFinalizationStepPlan {
        workflow_run_id: resolved.request.workflow_run_id,
        workflow_id: Some(resolved.workflow_run.workflow_id),
        persistent_status: Some(resolved.workflow_run.status),
        phase: Some(resolved.workflow_run.phase),
        current_step: resolved.workflow_run.current_step,
        transition: resolved.transition,
        executable: blockers.is_empty(),
        already_applied,
        action_idempotency_key: Some(resolved.action_idempotency_key),
        target_refs: parse_json_value(&resolved.target_refs_json),
        existing_refs: Some(json!({
            "completionDecisionId": resolved.completion_decision.as_ref().map(|decision| decision.decision_id.clone()),
            "evidenceBundleId": resolved.evidence.bundle_id,
            "failureDecisionId": resolved.failure_decision.as_ref().map(|decision| decision.decision_id.clone()),
            "messageId": resolved.review_message.message_id,
            "runId": resolved.run_id,
            "runLinkId": resolved.run_link.link_id,
        })),
        required_grant_classes: vec!["queue_workflow_finalization".to_owned()],
        confirmation_required: !already_applied,
        confirmation_accepted,
        failure_reason_required: resolved.transition
            == QueueWorkflowFinalizationStepTransition::FinalizeFail,
        blockers,
        expected_next_status: Some(QueueWorkflowRunStatus::Completed.as_str().to_owned()),
        expected_downstream_verification: Some(resolved.downstream_verification),
        retryable_failed_finalization_before_mutation: resolved
            .retryable_failed_finalization_before_mutation,
    }
}

fn invalid_plan(
    workflow_run_id: String,
    transition: Option<QueueWorkflowFinalizationStepTransition>,
    blocker: QueueWorkflowCommandBlocker,
) -> QueueWorkflowFinalizationStepPlan {
    QueueWorkflowFinalizationStepPlan {
        workflow_run_id,
        workflow_id: None,
        persistent_status: None,
        phase: None,
        current_step: None,
        transition: transition.unwrap_or(QueueWorkflowFinalizationStepTransition::FinalizeDone),
        executable: false,
        already_applied: false,
        action_idempotency_key: None,
        target_refs: None,
        existing_refs: None,
        required_grant_classes: vec!["queue_workflow_finalization".to_owned()],
        confirmation_required: true,
        confirmation_accepted: false,
        failure_reason_required: transition
            == Some(QueueWorkflowFinalizationStepTransition::FinalizeFail),
        blockers: vec![blocker],
        expected_next_status: Some(QueueWorkflowRunStatus::Completed.as_str().to_owned()),
        expected_downstream_verification: None,
        retryable_failed_finalization_before_mutation: false,
    }
}
