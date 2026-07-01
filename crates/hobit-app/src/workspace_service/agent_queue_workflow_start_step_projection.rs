use std::collections::BTreeMap;

use serde_json::{json, Map, Value};

use super::{
    agent_queue_workflow::{QueueWorkflowAction, QueueWorkflowCommandBlocker, QueueWorkflowRun},
    agent_queue_workflow_start_step::{
        QueueWorkflowCreateSetupStartActionSnapshots,
        QueueWorkflowCreateSetupStartDownstreamVerification,
        QueueWorkflowCreateSetupStartQueueControlSnapshot,
        QueueWorkflowCreateSetupStartStepPlanAction, QueueWorkflowCreateSetupStartStepResult,
        QueueWorkflowCreateSetupStartStepResultStatus, QueueWorkflowCreateSetupStartStepTransition,
    },
    agent_queue_workflow_start_step_support::{
        NormalizedCreateSetupStartStepRequest, DOWNSTREAM_SLOT, START_TRANSITION, UPSTREAM_SLOT,
    },
    AgentQueueControlStateSummary, AgentQueueTaskSummary,
};

pub(super) fn invalid_result(
    request_id: String,
    workflow_id: String,
    blocker: QueueWorkflowCommandBlocker,
) -> QueueWorkflowCreateSetupStartStepResult {
    QueueWorkflowCreateSetupStartStepResult {
        workflow_run_id: None,
        request_id,
        workflow_id,
        transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
        status: QueueWorkflowCreateSetupStartStepResultStatus::InvalidInput,
        actions: empty_actions(),
        slot_binding_snapshot: None,
        task_ids_by_slot: BTreeMap::new(),
        run_ids_by_slot: BTreeMap::new(),
        settings_hash: None,
        execution_target_hash: None,
        execution_target_kind: None,
        provider_id: None,
        workflow_run: None,
        next_phase: None,
        next_step: None,
        queue_control: None,
        downstream_verification: None,
        blockers: vec![blocker],
        conflict: None,
        worker_launch_intent: None,
    }
}

pub(super) fn empty_actions() -> QueueWorkflowCreateSetupStartActionSnapshots {
    QueueWorkflowCreateSetupStartActionSnapshots {
        create_task_upstream: None,
        create_task_downstream: None,
        update_run_settings: None,
        promote_task: None,
        start_worker: None,
    }
}

pub(super) fn action_blocker(action: &QueueWorkflowAction) -> Option<QueueWorkflowCommandBlocker> {
    let blocker_code = action.blocker_code.clone()?;
    Some(QueueWorkflowCommandBlocker {
        blocker_code,
        blocker_message: action
            .blocker_message
            .clone()
            .unwrap_or_else(|| "Queue workflow action was blocked.".to_owned()),
        missing_required_field: None,
    })
}

pub(super) fn action_run_id(action: &QueueWorkflowAction) -> Option<String> {
    action
        .result_refs_json
        .as_deref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| {
            value
                .as_object()
                .and_then(|object| object.get("runId"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
}

pub(super) fn action_slot(action: &QueueWorkflowAction) -> Option<String> {
    action
        .target_refs_json
        .as_deref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| {
            value
                .as_object()
                .and_then(|object| object.get("slot"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
}

pub(super) fn queue_control_snapshot(
    control: AgentQueueControlStateSummary,
) -> QueueWorkflowCreateSetupStartQueueControlSnapshot {
    QueueWorkflowCreateSetupStartQueueControlSnapshot {
        status: control.status,
        version: control.version,
    }
}

pub(super) fn slot_bindings_json(raw: Option<&str>) -> Map<String, Value> {
    raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

pub(super) fn slot_bindings_value(run: &QueueWorkflowRun) -> Option<Value> {
    run.slot_bindings_json
        .as_deref()
        .and_then(|raw| serde_json::from_str(raw).ok())
}

pub(super) fn task_ids_by_slot(run: &QueueWorkflowRun) -> BTreeMap<String, String> {
    ids_by_slot(run, "taskId")
}

pub(super) fn run_ids_by_slot(run: &QueueWorkflowRun) -> BTreeMap<String, String> {
    ids_by_slot(run, "runId")
}

pub(super) fn task_ids_by_slot_value(
    upstream_task: &AgentQueueTaskSummary,
    downstream_task: Option<&AgentQueueTaskSummary>,
) -> Value {
    let mut map = Map::new();
    if !upstream_task.queue_item_id.is_empty() {
        map.insert(
            UPSTREAM_SLOT.to_owned(),
            Value::String(upstream_task.queue_item_id.clone()),
        );
    }
    if let Some(downstream_task) = downstream_task {
        map.insert(
            DOWNSTREAM_SLOT.to_owned(),
            Value::String(downstream_task.queue_item_id.clone()),
        );
    }
    Value::Object(map)
}

pub(super) fn scoped_task_ids(
    upstream_task: &AgentQueueTaskSummary,
    downstream_task: Option<&AgentQueueTaskSummary>,
) -> Vec<String> {
    let mut ids = Vec::new();
    if !upstream_task.queue_item_id.is_empty() {
        ids.push(upstream_task.queue_item_id.clone());
    }
    if let Some(downstream_task) = downstream_task {
        ids.push(downstream_task.queue_item_id.clone());
    }
    ids
}

pub(super) fn action_plan_for(
    normalized: &NormalizedCreateSetupStartStepRequest,
    run: Option<&hobit_storage_sqlite::AgentQueueWorkflowRunRow>,
) -> Vec<QueueWorkflowCreateSetupStartStepPlanAction> {
    let workflow_run_id = run.map(|run| run.workflow_run_id.as_str());
    [
        (
            "create_task",
            Some(UPSTREAM_SLOT),
            workflow_run_id.map(|id| {
                format!(
                    "{id}:create_task:{UPSTREAM_SLOT}:{}",
                    normalized.upstream_task_spec_hash
                )
            }),
        ),
        (
            "create_task",
            Some(DOWNSTREAM_SLOT),
            workflow_run_id.map(|id| {
                format!(
                    "{id}:create_task:{DOWNSTREAM_SLOT}:{}",
                    normalized.downstream_task_spec_hash
                )
            }),
        ),
        (
            "update_run_settings",
            Some(UPSTREAM_SLOT),
            workflow_run_id.map(|id| {
                format!(
                    "{id}:update_run_settings:{UPSTREAM_SLOT}:{}",
                    normalized.settings_hash
                )
            }),
        ),
        (
            "promote_task",
            Some(UPSTREAM_SLOT),
            workflow_run_id.map(|id| {
                format!(
                    "{id}:promote_task:{UPSTREAM_SLOT}:{}:{}",
                    normalized.upstream_task_spec_hash, normalized.settings_hash
                )
            }),
        ),
        ("start_worker", Some(UPSTREAM_SLOT), None),
    ]
    .into_iter()
    .map(
        |(action_type, slot, idempotency_key)| QueueWorkflowCreateSetupStartStepPlanAction {
            action_type: action_type.to_owned(),
            slot: slot.map(str::to_owned),
            idempotency_key,
            already_applied: false,
        },
    )
    .collect()
}

pub(super) fn target_refs_preview(normalized: &NormalizedCreateSetupStartStepRequest) -> Value {
    json!({
        "downstreamSlot": DOWNSTREAM_SLOT,
        "executionTargetHash": normalized.execution_target_hash,
        "executionTargetKind": normalized.execution_target_kind,
        "providerId": normalized.provider_id,
        "settingsHash": normalized.settings_hash,
        "transition": START_TRANSITION,
        "upstreamSlot": UPSTREAM_SLOT,
    })
}

pub(super) fn expected_refs(normalized: &NormalizedCreateSetupStartStepRequest) -> Value {
    json!({
        "executionTargetHash": normalized.execution_target_hash,
        "settingsHash": normalized.settings_hash,
        "taskIdsBySlot": {},
        "runIdsBySlot": {},
    })
}

pub(super) fn success_start_step_result(
    normalized: NormalizedCreateSetupStartStepRequest,
    workflow_run: QueueWorkflowRun,
    actions: QueueWorkflowCreateSetupStartActionSnapshots,
    control: Option<AgentQueueControlStateSummary>,
    downstream_verification: Option<QueueWorkflowCreateSetupStartDownstreamVerification>,
    already_applied: bool,
) -> QueueWorkflowCreateSetupStartStepResult {
    QueueWorkflowCreateSetupStartStepResult {
        workflow_run_id: Some(workflow_run.workflow_run_id.clone()),
        request_id: normalized.request_id,
        workflow_id: normalized.workflow_id,
        transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
        status: if already_applied {
            QueueWorkflowCreateSetupStartStepResultStatus::AlreadyApplied
        } else {
            QueueWorkflowCreateSetupStartStepResultStatus::Executed
        },
        actions,
        slot_binding_snapshot: slot_bindings_value(&workflow_run),
        task_ids_by_slot: task_ids_by_slot(&workflow_run),
        run_ids_by_slot: run_ids_by_slot(&workflow_run),
        settings_hash: Some(normalized.settings_hash),
        execution_target_hash: Some(normalized.execution_target_hash),
        execution_target_kind: Some(normalized.execution_target_kind),
        provider_id: Some(normalized.provider_id),
        workflow_run: Some(workflow_run),
        next_phase: Some(super::agent_queue_workflow_start_step_support::START_PHASE.to_owned()),
        next_step: Some(
            super::agent_queue_workflow_start_step_support::AWAITING_WORKER_STEP.to_owned(),
        ),
        queue_control: control.map(queue_control_snapshot),
        downstream_verification,
        blockers: Vec::new(),
        conflict: None,
        worker_launch_intent: None,
    }
}

pub(super) fn blocked_start_step_result(
    normalized: NormalizedCreateSetupStartStepRequest,
    workflow_run: QueueWorkflowRun,
    actions: QueueWorkflowCreateSetupStartActionSnapshots,
    control: Option<AgentQueueControlStateSummary>,
    downstream_verification: Option<QueueWorkflowCreateSetupStartDownstreamVerification>,
    blocker: QueueWorkflowCommandBlocker,
) -> QueueWorkflowCreateSetupStartStepResult {
    QueueWorkflowCreateSetupStartStepResult {
        workflow_run_id: Some(workflow_run.workflow_run_id.clone()),
        request_id: normalized.request_id,
        workflow_id: normalized.workflow_id,
        transition: QueueWorkflowCreateSetupStartStepTransition::CreateSetupStart,
        status: QueueWorkflowCreateSetupStartStepResultStatus::BlockedPrecondition,
        actions,
        slot_binding_snapshot: slot_bindings_value(&workflow_run),
        task_ids_by_slot: task_ids_by_slot(&workflow_run),
        run_ids_by_slot: BTreeMap::new(),
        settings_hash: Some(normalized.settings_hash),
        execution_target_hash: Some(normalized.execution_target_hash),
        execution_target_kind: Some(normalized.execution_target_kind),
        provider_id: Some(normalized.provider_id),
        workflow_run: Some(workflow_run),
        next_phase: Some(super::agent_queue_workflow_start_step_support::START_PHASE.to_owned()),
        next_step: Some(
            super::agent_queue_workflow_start_step_support::START_BLOCKED_STEP.to_owned(),
        ),
        queue_control: control.map(queue_control_snapshot),
        downstream_verification,
        blockers: vec![blocker],
        conflict: None,
        worker_launch_intent: None,
    }
}

fn ids_by_slot(run: &QueueWorkflowRun, field: &str) -> BTreeMap<String, String> {
    let mut ids = BTreeMap::new();
    let Some(Value::Object(bindings)) = slot_bindings_value(run) else {
        return ids;
    };
    for (slot, binding) in bindings {
        if let Some(id) = binding
            .as_object()
            .and_then(|object| object.get(field))
            .and_then(Value::as_str)
        {
            ids.insert(slot, id.to_owned());
        }
    }
    ids
}
