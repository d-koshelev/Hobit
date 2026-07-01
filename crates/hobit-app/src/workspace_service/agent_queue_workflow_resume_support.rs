use super::*;

pub(super) fn worker_evidence_outcome_for_resume(run_status: &str) -> Option<&'static str> {
    match run_status {
        "completed" => Some("completed"),
        "failed" | "timed_out" => Some("failed"),
        "cancelled" | "review_needed" => Some("not_completed"),
        _ => None,
    }
}

pub(super) fn has_next_action(aggregate: &QueueItemAggregate, code: &str) -> bool {
    aggregate
        .next_actions
        .iter()
        .any(|action| action.code == code && action.available)
}

pub(super) fn binding_has_runtime_progress(binding: &SlotBinding) -> bool {
    binding.run_id.is_some()
        || binding.evidence_bundle_id.is_some()
        || binding.message_id.is_some()
        || binding.completion_decision_id.is_some()
        || binding.failure_decision_id.is_some()
}

pub(super) fn expected_dependency_task_ids(
    binding: &SlotBinding,
    task_template: Option<&ResumeTaskTemplate>,
    slot_bindings: &BTreeMap<String, SlotBinding>,
) -> Vec<String> {
    if !binding.dependency_task_ids.is_empty() {
        let mut task_ids = binding.dependency_task_ids.clone();
        task_ids.sort();
        task_ids.dedup();
        return task_ids;
    }

    let depends_on_slots = task_template
        .map(|template| template.depends_on_slots.as_slice())
        .unwrap_or(binding.depends_on_slots.as_slice());
    let mut task_ids = depends_on_slots
        .iter()
        .filter_map(|slot| slot_bindings.get(slot))
        .filter_map(|binding| binding.task_id.clone())
        .collect::<Vec<_>>();
    task_ids.sort();
    task_ids.dedup();
    task_ids
}

pub(super) fn task_dependency_ids(
    task: &AgentQueueTaskRow,
) -> Result<Vec<String>, serde_json::Error> {
    let mut ids = serde_json::from_str::<Vec<String>>(&task.depends_on)?;
    ids.sort();
    ids.dedup();
    Ok(ids)
}

pub(super) fn same_string_set(left: &[String], right: &[String]) -> bool {
    let mut left = left.to_vec();
    let mut right = right.to_vec();
    left.sort();
    left.dedup();
    right.sort();
    right.dedup();
    left == right
}

pub(super) fn target_slot<'a>(
    run: &QueueWorkflowRun,
    slots: &'a [ReconciledSlot],
) -> Option<&'a ReconciledSlot> {
    if let Some(slot) = slots.iter().find(|slot| slot.binding.slot == "upstream") {
        return Some(slot);
    }
    if slots.len() == 1 {
        return slots.first();
    }
    if matches!(
        run.workflow_id.as_str(),
        "review_acceptance" | "terminal_failure"
    ) {
        let task_bound_slots = slots
            .iter()
            .filter(|slot| slot.binding.task_id.is_some())
            .collect::<Vec<_>>();
        if task_bound_slots.len() == 1 {
            return task_bound_slots.first().copied();
        }
    }
    None
}

pub(super) fn is_completed_worker_run_state(run_link: &AgentQueueTaskRunLinkRow) -> bool {
    run_link.completed_at.is_some()
        && matches!(
            run_link.status.as_str(),
            "completed" | "failed" | "timed_out" | "cancelled" | "review_needed"
        )
}
