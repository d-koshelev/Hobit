use super::super::QueueWorkflowReviewStepRequest;
use super::*;

pub(super) fn retryable_review_failure_before_mutation_plan(
    service: &WorkspaceService,
    workspace_id: &str,
    workflow_run: QueueWorkflowRun,
    actions: Vec<QueueWorkflowAction>,
) -> Result<Option<QueueWorkflowResumePlan>, WorkspaceServiceError> {
    if !matches!(
        workflow_run.workflow_id.as_str(),
        "dependency_acceptance_smoke" | "dependency_failure_smoke"
    ) || workflow_run.status != "failed"
        || workflow_run.phase != "review"
        || workflow_run.current_step.as_deref() != Some("review_failed_unexpected")
    {
        return Ok(None);
    }

    let variables_value = match parse_json_field(
        workflow_run.variables_json.as_deref(),
        "variables",
        "invalid_variables_json",
    ) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let slot_bindings_value = match parse_json_field(
        workflow_run.slot_bindings_json.as_deref(),
        "slotBindings",
        "invalid_slot_bindings_json",
    ) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let slot_bindings = match parse_slot_bindings(slot_bindings_value.as_ref()) {
        Ok(bindings) => bindings,
        Err(_) => return Ok(None),
    };
    let (slot_bindings, action_recovery_blockers) =
        augment_slot_bindings_from_actions(&workflow_run, slot_bindings, &actions);
    if !action_recovery_blockers.is_empty() {
        return Ok(None);
    }

    let Some(binding) = target_review_binding(&workflow_run, &slot_bindings) else {
        return Ok(None);
    };
    if binding.task_id.is_none()
        || binding.run_id.is_none()
        || binding.evidence_bundle_id.is_none()
        || binding.message_id.is_some()
        || binding.completion_decision_id.is_some()
        || binding.failure_decision_id.is_some()
    {
        return Ok(None);
    }

    let step_plan = service.plan_queue_workflow_review_step(QueueWorkflowReviewStepRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run.workflow_run_id.clone(),
        slot: Some(binding.slot.clone()),
        actor_id: None,
        request_id: None,
        grant_summary: None,
    })?;
    if !step_plan.retryable_failed_review_before_mutation {
        return Ok(None);
    }

    if !step_plan.executable {
        let blockers = step_plan
            .blockers
            .into_iter()
            .map(|blocker| QueueWorkflowResumeBlocker {
                blocker_code: blocker.blocker_code,
                blocker_message: blocker.blocker_message,
                slot: Some(binding.slot.clone()),
                task_id: binding.task_id.clone(),
                run_id: binding.run_id.clone(),
                evidence_bundle_id: binding.evidence_bundle_id.clone(),
                message_id: binding.message_id.clone(),
                completion_decision_id: binding.completion_decision_id.clone(),
                failure_decision_id: binding.failure_decision_id.clone(),
                missing_required_field: blocker.missing_required_field,
            })
            .collect::<Vec<_>>();
        return Ok(Some(plan_with_status(
            workflow_run,
            actions,
            status_for_blockers(&blockers),
            Some("review".to_owned()),
            Some("review_blocked".to_owned()),
            false,
            false,
            None,
            blockers,
        )));
    }

    let next_step = if step_plan
        .next_actions
        .iter()
        .any(|action| action == "create_review_message")
    {
        "review_create_ready"
    } else {
        "review_ack_ready"
    };
    let blockers = vec![binding_blocker(
        "retryable_review_failure_before_mutation",
        "Queue workflow failed during review before durable review mutation; backend-owned review retry is allowed.",
        binding,
        Some("review"),
    )];
    let reconciled_variables_json = variables_value
        .as_ref()
        .and_then(|_| workflow_run.variables_json.clone());
    let status = QueueWorkflowResumePlanStatus::RetryableReviewFailureBeforeMutation;
    let report_summary = report_summary(
        &workflow_run.workflow_run_id,
        status,
        Some(next_step),
        blockers.len(),
        true,
        false,
    );

    Ok(Some(QueueWorkflowResumePlan {
        status,
        resume_available: status.resume_available(),
        workflow_run,
        actions,
        reconciled_variables_json,
        slot_reconciliations: Vec::new(),
        task_snapshots: Vec::new(),
        next_phase: Some("review".to_owned()),
        next_step: Some(next_step.to_owned()),
        blockers,
        required_fresh_grant: true,
        required_confirmation: false,
        terminal_status: None,
        report_summary,
    }))
}

pub(super) fn filter_downstream_promote_mismatch_after_review_ack(
    run: &QueueWorkflowRun,
    slots: &[ReconciledSlot],
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if !target_review_acknowledged(run, slots) {
        return;
    }
    let Some(target_slot_name) =
        resume_support::target_slot(run, slots).map(|slot| slot.binding.slot.clone())
    else {
        return;
    };
    blockers.retain(|blocker| {
        blocker.blocker_code != "promote_state_mismatch"
            || blocker
                .slot
                .as_deref()
                .is_none_or(|slot| slot == target_slot_name)
    });
}

fn target_review_acknowledged(run: &QueueWorkflowRun, slots: &[ReconciledSlot]) -> bool {
    matches!(run.phase.as_str(), "review" | "finalization")
        && matches!(
            run.current_step.as_deref(),
            Some("awaiting_finalization") | Some("review_acknowledged")
        )
        && resume_support::target_slot(run, slots)
            .and_then(|slot| slot.review_message.as_ref())
            .is_some_and(|message| message.status == REVIEW_MESSAGE_STATUS_ACKNOWLEDGED)
}

fn target_review_binding<'a>(
    run: &QueueWorkflowRun,
    bindings: &'a [SlotBinding],
) -> Option<&'a SlotBinding> {
    if let Some(binding) = bindings.iter().find(|binding| binding.slot == "upstream") {
        return Some(binding);
    }
    if bindings.len() == 1 {
        return bindings.first();
    }
    if matches!(
        run.workflow_id.as_str(),
        "dependency_acceptance_smoke" | "dependency_failure_smoke"
    ) {
        let evidence_bound_slots = bindings
            .iter()
            .filter(|binding| {
                binding.task_id.is_some()
                    && binding.run_id.is_some()
                    && binding.evidence_bundle_id.is_some()
            })
            .collect::<Vec<_>>();
        if evidence_bound_slots.len() == 1 {
            return evidence_bound_slots.first().copied();
        }
    }
    None
}
