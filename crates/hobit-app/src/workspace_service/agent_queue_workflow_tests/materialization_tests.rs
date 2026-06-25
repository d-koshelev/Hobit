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
fn materialize_workflow_task_slot_creates_draft_task_binding_and_action() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");

    let result = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let task = result.task.expect("task");
    let action = result.action.expect("action");
    let binding = result.binding.expect("binding");

    assert_eq!(
        result.status,
        QueueWorkflowMaterializeTaskSlotStatus::Created
    );
    assert_eq!(task.status, "draft");
    assert_eq!(task.execution_policy, "manual");
    assert_eq!(task.execution_workspace, None);
    assert_eq!(task.codex_executable, None);
    assert_eq!(task.sandbox, None);
    assert_eq!(task.approval_policy, None);
    assert_eq!(task.depends_on, Vec::<String>::new());
    assert_eq!(binding.slot, "upstream");
    assert_eq!(binding.task_id, task.queue_item_id);
    assert!(binding
        .task_spec_hash
        .starts_with("queue-task-spec-fnv1a64:"));
    assert!(binding
        .dependency_spec_hash
        .starts_with("queue-dependency-spec-fnv1a64:"));
    assert!(binding
        .dependency_edge_hash
        .starts_with("queue-dependency-edge-fnv1a64:"));
    assert_eq!(action.action_type, "create_task");
    assert_eq!(action.status, "completed");

    let updated_run = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: workflow_run.workflow_run_id.clone(),
        })
        .expect("get workflow")
        .expect("workflow");
    let slot_bindings: Value = serde_json::from_str(
        updated_run
            .slot_bindings_json
            .as_deref()
            .expect("slot bindings"),
    )
    .expect("slot bindings json");
    assert_eq!(
        slot_bindings["upstream"]["taskId"].as_str(),
        Some(task.queue_item_id.as_str())
    );
    assert_eq!(
        slot_bindings["upstream"]["taskSpecHash"].as_str(),
        Some(binding.task_spec_hash.as_str())
    );
    assert!(
        slot_bindings["upstream"]["runId"].is_null(),
        "task materialization must not bind worker runs"
    );
    assert_no_queue_workflow_side_effects(&service, "workspace-1", &task.queue_item_id);
}

#[test]
fn materialize_downstream_slot_creates_dependency_edge_by_depends_on_slots() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let upstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream")
        .task
        .expect("upstream task");

    let first = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream");
    let duplicate = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream duplicate");
    let downstream = first.task.expect("downstream task");

    assert_eq!(
        first.status,
        QueueWorkflowMaterializeTaskSlotStatus::Created
    );
    assert_eq!(
        duplicate.status,
        QueueWorkflowMaterializeTaskSlotStatus::Reused
    );
    assert_eq!(
        duplicate.task.expect("duplicate task").queue_item_id,
        downstream.queue_item_id
    );
    assert_eq!(downstream.depends_on, vec![upstream.queue_item_id.clone()]);
    assert_eq!(
        first.binding.expect("binding").dependency_task_ids,
        vec![upstream.queue_item_id]
    );

    let actions = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", &workflow_run.workflow_run_id)
        .expect("workflow actions");
    assert_eq!(actions.len(), 2);
    assert!(actions
        .iter()
        .all(|action| action.action_type == "create_task"));
}

#[test]
fn materialize_same_workflow_slot_different_spec_hash_conflicts() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");

    service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("materialize upstream");
    let conflict = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect changed contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("conflict");

    assert_eq!(
        conflict.status,
        QueueWorkflowMaterializeTaskSlotStatus::Conflict
    );
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "slot_task_spec_hash_conflict"
    );
}

#[test]
fn materialize_same_slot_spec_in_different_workflows_is_not_global_dedupe() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let first_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let second_run = start_materialization_workflow(&service, "workspace-1", "request-2");

    let first = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &first_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("first materialization")
        .task
        .expect("first task");
    let second = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &second_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("second materialization")
        .task
        .expect("second task");

    assert_ne!(first.queue_item_id, second.queue_item_id);
}

#[test]
fn materialize_downstream_missing_upstream_binding_blocks_without_task_creation() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");

    let result = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("blocked downstream");

    assert_eq!(
        result.status,
        QueueWorkflowMaterializeTaskSlotStatus::Blocked
    );
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "missing_upstream_slot_binding"
    );
    assert!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list tasks")
            .is_empty(),
        "blocked dependency materialization must not create a Queue task"
    );
}

#[test]
fn materialize_create_task_action_conflicting_refs_rejected_without_task_creation() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let (_, _, task_spec_hash, _) =
        super::super::agent_queue_workflow_materialization::normalize_queue_workflow_task_spec_for_hash(
            QueueWorkflowTaskSpec {
                title: "Inspect contract".to_owned(),
                prompt: "Read the visible contract and summarize blockers.".to_owned(),
                description: None,
                status: None,
                priority: None,
            },
            vec![],
        )
        .expect("hash task spec");
    let idempotency_key = format!(
        "{}:create_task:upstream:{}",
        workflow_run.workflow_run_id, task_spec_hash
    );
    service
        .store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "conflicting-action",
            workflow_run_id: &workflow_run.workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "create_task",
            action_type: "create_task",
            idempotency_key: &idempotency_key,
            status: "completed",
            target_refs_json: Some(r#"{"slot":"upstream","taskSpecHash":"different"}"#),
            result_refs_json: Some(r#"{"taskId":"other"}"#),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("1"),
            completed_at: Some("1"),
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("insert conflicting action");

    let result = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            "Inspect contract",
            "Read the visible contract and summarize blockers.",
            vec![],
        ))
        .expect("conflict");

    assert_eq!(
        result.status,
        QueueWorkflowMaterializeTaskSlotStatus::Conflict
    );
    assert_eq!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list tasks")
            .len(),
        0,
        "conflicting ledger refs must block before task creation"
    );
}
