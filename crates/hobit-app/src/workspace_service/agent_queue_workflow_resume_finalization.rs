use super::*;

pub(super) struct FinalizationResolverResumeStep {
    pub derived: DerivedStep,
    pub blockers: Vec<QueueWorkflowResumeBlocker>,
}

pub(super) fn recover_finalization_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) -> bool {
    match action.action_type.as_str() {
        "queue.item.markDone" => {
            recover_decision_action(by_slot, action, "completionDecisionId", blockers);
            true
        }
        "queue.item.fail" => {
            recover_decision_action(by_slot, action, "failureDecisionId", blockers);
            true
        }
        _ => false,
    }
}

pub(super) fn finalization_step_from_resolver(
    service: &WorkspaceService,
    workspace_id: &str,
    workflow_run: &QueueWorkflowRun,
    inputs: Option<&Value>,
    variables: Option<&Value>,
    derived: &DerivedStep,
) -> Result<Option<FinalizationResolverResumeStep>, WorkspaceServiceError> {
    if !is_dependency_finalization_candidate(workflow_run, derived) {
        return Ok(None);
    }

    let step_plan = service.plan_queue_workflow_finalization_step(finalization_step_request(
        workspace_id,
        workflow_run,
        inputs,
        variables,
    ))?;
    let next_step = if step_plan.already_applied {
        if step_plan.transition.as_str() == "finalize_fail" {
            "completed_idempotent_failure"
        } else {
            "completed_idempotent_acceptance"
        }
    } else {
        "awaiting_finalization"
    };
    if step_plan.already_applied {
        return Ok(Some(FinalizationResolverResumeStep {
            derived: DerivedStep {
                status: QueueWorkflowResumePlanStatus::ResumeReadOnlyReady,
                next_phase: Some("closed".to_owned()),
                next_step: Some(next_step.to_owned()),
                required_fresh_grant: false,
                required_confirmation: false,
                blockers: Vec::new(),
            },
            blockers: Vec::new(),
        }));
    }

    if step_plan.blockers.is_empty() && step_plan.executable {
        return Ok(Some(FinalizationResolverResumeStep {
            derived: DerivedStep {
                status: QueueWorkflowResumePlanStatus::ResumeReady,
                next_phase: Some("finalization".to_owned()),
                next_step: Some("finalization_ready".to_owned()),
                required_fresh_grant: true,
                required_confirmation: true,
                blockers: Vec::new(),
            },
            blockers: Vec::new(),
        }));
    }

    let blockers = step_plan
        .blockers
        .into_iter()
        .map(|blocker| QueueWorkflowResumeBlocker {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            slot: Some("upstream".to_owned()),
            task_id: None,
            run_id: None,
            evidence_bundle_id: None,
            message_id: None,
            completion_decision_id: None,
            failure_decision_id: None,
            missing_required_field: blocker.missing_required_field,
        })
        .collect::<Vec<_>>();
    let status = status_for_finalization_blockers(&blockers);

    Ok(Some(FinalizationResolverResumeStep {
        derived: DerivedStep {
            status,
            next_phase: Some("finalization".to_owned()),
            next_step: Some(next_step.to_owned()),
            required_fresh_grant: true,
            required_confirmation: status
                == QueueWorkflowResumePlanStatus::BlockedMissingConfirmation,
            blockers: Vec::new(),
        },
        blockers,
    }))
}

pub(super) fn retryable_finalization_failure_before_mutation_plan(
    service: &WorkspaceService,
    workspace_id: &str,
    workflow_run: QueueWorkflowRun,
    actions: Vec<QueueWorkflowAction>,
) -> Result<Option<QueueWorkflowResumePlan>, WorkspaceServiceError> {
    if workflow_run.status != "failed"
        || workflow_run.phase != "finalization"
        || workflow_run.current_step.as_deref() != Some("finalization_failed_unexpected")
    {
        return Ok(None);
    }
    let inputs = parse_json_field(
        workflow_run.inputs_snapshot_json.as_deref(),
        "inputsSnapshot",
        "invalid_inputs_snapshot_json",
    )
    .ok()
    .flatten();
    let variables = parse_json_field(
        workflow_run.variables_json.as_deref(),
        "variables",
        "invalid_variables_json",
    )
    .ok()
    .flatten();
    let step_plan = service.plan_queue_workflow_finalization_step(finalization_step_request(
        workspace_id,
        &workflow_run,
        inputs.as_ref(),
        variables.as_ref(),
    ))?;
    if !step_plan.retryable_failed_finalization_before_mutation {
        return Ok(None);
    }

    let blockers = step_plan
        .blockers
        .into_iter()
        .map(|blocker| QueueWorkflowResumeBlocker {
            blocker_code: blocker.blocker_code,
            blocker_message: blocker.blocker_message,
            slot: Some("upstream".to_owned()),
            task_id: None,
            run_id: None,
            evidence_bundle_id: None,
            message_id: None,
            completion_decision_id: None,
            failure_decision_id: None,
            missing_required_field: blocker.missing_required_field,
        })
        .chain(std::iter::once(QueueWorkflowResumeBlocker {
            blocker_code: "retryable_finalization_failure_before_mutation".to_owned(),
            blocker_message:
                "Queue workflow failed during finalization before durable decision mutation; backend-owned finalization retry is allowed."
                    .to_owned(),
            slot: Some("upstream".to_owned()),
            task_id: None,
            run_id: None,
            evidence_bundle_id: None,
            message_id: None,
            completion_decision_id: None,
            failure_decision_id: None,
            missing_required_field: Some("confirmationToken".to_owned()),
        }))
        .collect::<Vec<_>>();

    Ok(Some(plan_with_status(
        workflow_run,
        actions,
        QueueWorkflowResumePlanStatus::RetryableFinalizationFailureBeforeMutation,
        Some("finalization".to_owned()),
        Some("awaiting_finalization".to_owned()),
        true,
        true,
        None,
        blockers,
    )))
}

pub(super) fn derive_finalization_step(
    run: &QueueWorkflowRun,
    inputs: Option<&Value>,
    variables: Option<&Value>,
) -> DerivedStep {
    let failure_workflow = matches!(
        run.workflow_id.as_str(),
        "dependency_failure_smoke" | "terminal_failure"
    );
    if failure_workflow && failure_reason(inputs, variables).is_none() {
        return DerivedStep {
            status: QueueWorkflowResumePlanStatus::BlockedStateMismatch,
            next_phase: Some("finalization".to_owned()),
            next_step: Some("awaiting_finalization".to_owned()),
            required_fresh_grant: true,
            required_confirmation: true,
            blockers: vec![blocker(
                "failure_reason_missing",
                "Terminal failure resume planning requires a structured failureReason.",
                None,
                Some("failureReason"),
            )],
        };
    }

    DerivedStep {
        status: QueueWorkflowResumePlanStatus::BlockedMissingConfirmation,
        next_phase: Some("finalization".to_owned()),
        next_step: Some("awaiting_finalization".to_owned()),
        required_fresh_grant: true,
        required_confirmation: true,
        blockers: vec![blocker(
            "fresh_confirmation_required",
            "A fresh exact structured confirmation is required before finalization can resume execution.",
            None,
            Some("confirmationToken"),
        )],
    }
}

pub(super) fn validate_completion_decision_matches_binding(
    binding: &SlotBinding,
    message: Option<&AgentQueueReviewMessageRow>,
    decision: &AgentQueueCompletionDecisionRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if binding
        .task_id
        .as_deref()
        .is_some_and(|task_id| task_id != decision.queue_task_id)
    {
        blockers.push(binding_blocker(
            "completion_decision_task_mismatch",
            "Bound completionDecisionId belongs to a different Queue task.",
            binding,
            None,
        ));
    }
    if let (Some(bound_run), Some(decision_run)) =
        (binding.run_id.as_deref(), decision.run_id.as_deref())
    {
        if bound_run != decision_run {
            blockers.push(binding_blocker(
                "completion_decision_run_mismatch",
                "Bound completionDecisionId belongs to a different runId.",
                binding,
                None,
            ));
        }
    }
    if let Some(message) = message {
        if decision.review_message_id.as_deref() != Some(message.message_id.as_str()) {
            blockers.push(binding_blocker(
                "completion_decision_review_mismatch",
                "Completion decision does not reference the bound review message.",
                binding,
                None,
            ));
        }
    }
}

pub(super) fn validate_failure_decision_matches_binding(
    binding: &SlotBinding,
    evidence: Option<&AgentQueueWorkerEvidenceBundleRow>,
    message: Option<&AgentQueueReviewMessageRow>,
    decision: &AgentQueueFailureDecisionRow,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if binding
        .task_id
        .as_deref()
        .is_some_and(|task_id| task_id != decision.queue_task_id)
    {
        blockers.push(binding_blocker(
            "failure_decision_task_mismatch",
            "Bound failureDecisionId belongs to a different Queue task.",
            binding,
            None,
        ));
    }
    if let (Some(bound_run), Some(decision_run)) =
        (binding.run_id.as_deref(), decision.run_id.as_deref())
    {
        if bound_run != decision_run {
            blockers.push(binding_blocker(
                "failure_decision_run_mismatch",
                "Bound failureDecisionId belongs to a different runId.",
                binding,
                None,
            ));
        }
    }
    if let Some(evidence) = evidence {
        if decision.evidence_bundle_id.as_deref() != Some(evidence.bundle_id.as_str()) {
            blockers.push(binding_blocker(
                "failure_decision_evidence_mismatch",
                "Failure decision does not reference the bound evidence bundle.",
                binding,
                None,
            ));
        }
    }
    if let Some(message) = message {
        if decision.review_message_id.as_deref() != Some(message.message_id.as_str()) {
            blockers.push(binding_blocker(
                "failure_decision_review_mismatch",
                "Failure decision does not reference the bound review message.",
                binding,
                None,
            ));
        }
    }
}

fn finalization_step_request(
    workspace_id: &str,
    workflow_run: &QueueWorkflowRun,
    inputs: Option<&Value>,
    variables: Option<&Value>,
) -> QueueWorkflowFinalizationStepRequest {
    QueueWorkflowFinalizationStepRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run.workflow_run_id.clone(),
        slot: Some("upstream".to_owned()),
        actor_id: workflow_run.actor_id.clone(),
        request_id: None,
        grant_summary: None,
        confirmation_token: None,
        failure_reason: failure_reason(inputs, variables),
        expected_version: None,
    }
}

fn is_dependency_finalization_candidate(
    workflow_run: &QueueWorkflowRun,
    derived: &DerivedStep,
) -> bool {
    matches!(
        workflow_run.workflow_id.as_str(),
        "dependency_acceptance_smoke" | "dependency_failure_smoke"
    ) && (matches!(
        derived.next_phase.as_deref(),
        Some("finalization") | Some("closed")
    ) || matches!(
        workflow_run.phase.as_str(),
        "decision" | "finalization" | "closed"
    ))
}

fn status_for_finalization_blockers(
    blockers: &[QueueWorkflowResumeBlocker],
) -> QueueWorkflowResumePlanStatus {
    if blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "fresh_confirmation_required")
    {
        return QueueWorkflowResumePlanStatus::BlockedMissingConfirmation;
    }
    status_for_blockers(blockers)
}

fn failure_reason(inputs: Option<&Value>, variables: Option<&Value>) -> Option<String> {
    inputs
        .and_then(|value| optional_string_field(value.get("failureReason")))
        .or_else(|| variables.and_then(|value| optional_string_field(value.get("failureReason"))))
}

fn recover_decision_action(
    by_slot: &mut BTreeMap<String, SlotBinding>,
    action: &QueueWorkflowAction,
    decision_field: &str,
    blockers: &mut Vec<QueueWorkflowResumeBlocker>,
) {
    if action.status != "completed" {
        return;
    }
    let Some(target) = action_ref_object(action, action.target_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(result) = action_ref_object(action, action.result_refs_json.as_deref(), blockers)
    else {
        return;
    };
    let Some(task_id) = string_ref(action, &target, "taskId", blockers) else {
        return;
    };
    let Some(slot) = slot_for_task(by_slot, &task_id) else {
        blockers.push(action_ref_blocker(
            "incomplete_slot_binding",
            "A workflow finalization action has durable refs but no matching task slot binding.",
            action,
            Some(&task_id),
            None,
        ));
        return;
    };
    let binding = by_slot.get_mut(&slot).expect("slot exists");
    set_binding_string(binding, "taskId", Some(task_id), action, blockers);
    set_binding_string(
        binding,
        "runId",
        string_ref(action, &target, "runId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "evidenceBundleId",
        string_ref(action, &target, "evidenceBundleId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        "messageId",
        string_ref(action, &target, "messageId", blockers),
        action,
        blockers,
    );
    set_binding_string(
        binding,
        decision_field,
        string_ref(action, &result, "decisionId", blockers),
        action,
        blockers,
    );
}
