use hobit_storage_sqlite::{
    AgentQueueTaskUpdate, NewAgentQueueCompletionDecision, NewAgentQueueFailureDecision,
    NewAgentQueueReviewMessage, NewAgentQueueTask, NewAgentQueueTaskRunLink,
    NewAgentQueueWorkerEvidenceBundle, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun,
    NewWidgetInstance, NewWidgetRun, SqliteStore,
};
use serde_json::{json, Value};

use super::super::agent_queue_workflow::canonical_json_string;
use super::super::*;
use super::support::*;

#[test]
fn workflow_promote_is_idempotent_and_never_starts_worker() {
    let service = initialized_service_with_executor();
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let materialized = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let task = materialized.task.expect("task");
    let task_spec_hash = materialized.binding.expect("binding").task_spec_hash;
    let settings = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            workflow_run_settings("executor-1"),
            None,
        ))
        .expect("apply settings")
        .binding
        .expect("settings binding");

    let promoted = service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some(&task.queue_item_id),
            &task_spec_hash,
            &settings.settings_hash,
        ))
        .expect("promote");
    let duplicate = service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            &task_spec_hash,
            &settings.settings_hash,
        ))
        .expect("duplicate promote");

    assert_eq!(
        promoted.status,
        QueueWorkflowPromoteTaskSlotStatus::Promoted
    );
    assert_eq!(duplicate.status, QueueWorkflowPromoteTaskSlotStatus::Reused);
    assert_eq!(promoted.task.expect("task").status, "queued");
    assert_eq!(duplicate.binding.expect("duplicate binding").promoted, true);
    assert_no_queue_workflow_side_effects(&service, "workspace-1", &task.queue_item_id);
    assert!(
        service
            .store
            .list_agent_queue_task_run_links("workspace-1", &task.queue_item_id)
            .expect("run links")
            .is_empty(),
        "promotion must not create a run link"
    );

    let actions = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", &workflow_run.workflow_run_id)
        .expect("actions");
    assert_eq!(actions.len(), 3);
    assert!(actions
        .iter()
        .any(|action| action.action_type == "promote_task"));
}

#[test]
fn workflow_promote_conflicts_on_task_spec_or_settings_hash_mismatch() {
    let service = initialized_service_with_executor();
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let materialized = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let task_spec_hash = materialized.binding.expect("binding").task_spec_hash;
    let settings_hash = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            workflow_run_settings("executor-1"),
            None,
        ))
        .expect("apply settings")
        .binding
        .expect("settings binding")
        .settings_hash;

    let wrong_spec = service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            "queue-task-spec-fnv1a64:badbadbadbadbadb",
            &settings_hash,
        ))
        .expect("wrong spec");
    assert_eq!(
        wrong_spec.status,
        QueueWorkflowPromoteTaskSlotStatus::Conflict
    );
    assert_eq!(
        wrong_spec.conflict.expect("conflict").conflict_code,
        "task_spec_hash_conflict"
    );

    let wrong_settings = service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            &task_spec_hash,
            "queue-settings-fnv1a64:badbadbadbadbadb",
        ))
        .expect("wrong settings");
    assert_eq!(
        wrong_settings.status,
        QueueWorkflowPromoteTaskSlotStatus::Conflict
    );
    assert_eq!(
        wrong_settings.conflict.expect("conflict").conflict_code,
        "settings_hash_conflict"
    );
}

#[test]
fn workflow_promoted_downstream_remains_dependency_waiting_without_auto_start() {
    let service = initialized_service_with_executor();
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let _upstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let downstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream");
    let downstream_task = downstream.task.expect("downstream task");
    let downstream_spec_hash = downstream
        .binding
        .expect("downstream binding")
        .task_spec_hash;
    let downstream_settings_hash = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            None,
            workflow_run_settings("executor-1"),
            None,
        ))
        .expect("apply downstream settings")
        .binding
        .expect("downstream settings")
        .settings_hash;
    service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            None,
            &downstream_spec_hash,
            &downstream_settings_hash,
        ))
        .expect("promote downstream");

    let aggregate = service
        .get_queue_item_aggregate("workspace-1", &downstream_task.queue_item_id)
        .expect("aggregate")
        .expect("aggregate");
    assert_eq!(aggregate.dependency_state.as_str(), "waiting");
    assert!(aggregate
        .next_actions
        .iter()
        .all(|action| action.code != "start_run" || !action.available));
    assert_no_queue_workflow_side_effects(&service, "workspace-1", &downstream_task.queue_item_id);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan")
        .expect("plan");
    assert!(plan.slot_reconciliations.iter().any(|slot| {
        slot.slot == "downstream" && slot.aggregate_dependency_state.as_deref() == Some("waiting")
    }));
}
