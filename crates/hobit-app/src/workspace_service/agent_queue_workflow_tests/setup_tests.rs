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
fn workflow_run_settings_apply_is_idempotent_and_persists_binding() {
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
    let settings = workflow_run_settings("executor-1");

    let first = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            settings.clone(),
            None,
        ))
        .expect("apply settings");
    let duplicate = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some(&task.queue_item_id),
            settings,
            None,
        ))
        .expect("duplicate settings");

    assert_eq!(first.status, QueueWorkflowApplyRunSettingsStatus::Applied);
    assert_eq!(
        duplicate.status,
        QueueWorkflowApplyRunSettingsStatus::Reused
    );
    assert_eq!(
        first.binding.as_ref().expect("binding").settings_hash,
        duplicate
            .binding
            .as_ref()
            .expect("duplicate binding")
            .settings_hash
    );
    let updated_task = service
        .get_agent_queue_task("workspace-1", &task.queue_item_id)
        .expect("get task")
        .expect("task");
    assert_eq!(updated_task.status, "draft");
    assert_eq!(
        updated_task.execution_workspace.as_deref(),
        Some("C:/workspace/project")
    );
    assert_eq!(updated_task.codex_executable.as_deref(), Some("codex"));
    assert_eq!(updated_task.sandbox.as_deref(), Some("workspace_write"));
    assert_eq!(updated_task.approval_policy.as_deref(), Some("never"));
    assert_eq!(updated_task.execution_policy, "manual");
    assert_eq!(
        updated_task.assigned_executor_widget_id.as_deref(),
        Some("executor-1")
    );

    let run = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: workflow_run.workflow_run_id.clone(),
        })
        .expect("get workflow")
        .expect("workflow");
    let slot_bindings: Value = serde_json::from_str(
        run.slot_bindings_json
            .as_deref()
            .expect("slot bindings json"),
    )
    .expect("slot bindings");
    assert_eq!(
        slot_bindings["upstream"]["settingsHash"].as_str(),
        Some(
            first
                .binding
                .as_ref()
                .expect("binding")
                .settings_hash
                .as_str()
        )
    );
    assert_eq!(
        slot_bindings["upstream"]["runSettings"]["executorWidgetId"].as_str(),
        Some("executor-1")
    );
    assert_eq!(
        slot_bindings["upstream"]["updateRunSettingsActionIdempotencyKey"].as_str(),
        Some(
            first
                .binding
                .as_ref()
                .expect("binding")
                .update_run_settings_action_idempotency_key
                .as_str()
        )
    );

    let actions = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", &workflow_run.workflow_run_id)
        .expect("actions");
    assert_eq!(actions.len(), 2);
    assert!(actions
        .iter()
        .any(|action| action.action_type == "update_run_settings"));
    assert_no_queue_workflow_side_effects(&service, "workspace-1", &task.queue_item_id);
}

#[test]
fn workflow_run_settings_queue_local_accepts_agent_queue_widget_without_agent_executor() {
    let store = initialized_store();
    create_workspace_with_queue(&store, "workspace-1", "workbench-1", "queue-1");
    let service = WorkspaceService::new(store);
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let task = service
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
        .expect("task");

    let result = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            queue_local_workflow_run_settings("queue-1"),
            None,
        ))
        .expect("apply queue-local settings");

    assert_eq!(result.status, QueueWorkflowApplyRunSettingsStatus::Applied);
    let binding = result.binding.expect("binding");
    assert_eq!(binding.execution_target_kind, "queue_local");
    assert_eq!(binding.provider_id, "codex");
    assert_eq!(
        binding.queue_owner_widget_instance_id.as_deref(),
        Some("queue-1")
    );
    assert_eq!(binding.executor_widget_id, "queue-1");
    assert!(binding
        .execution_target_hash
        .starts_with("queue-execution-target-fnv1a64:"));
    let updated_task = service
        .get_agent_queue_task("workspace-1", &task.queue_item_id)
        .expect("get task")
        .expect("task");
    assert_eq!(
        updated_task.assigned_executor_widget_id.as_deref(),
        Some("queue-1")
    );

    let run = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: workflow_run.workflow_run_id.clone(),
        })
        .expect("get workflow")
        .expect("workflow");
    let slot_bindings: Value = serde_json::from_str(
        run.slot_bindings_json
            .as_deref()
            .expect("slot bindings json"),
    )
    .expect("slot bindings");
    assert_eq!(
        slot_bindings["upstream"]["executionTargetKind"].as_str(),
        Some("queue_local")
    );
    assert_eq!(
        slot_bindings["upstream"]["runSettings"]["executionTarget"]["kind"].as_str(),
        Some("queue_local")
    );
    assert_eq!(
        slot_bindings["upstream"]["runSettings"]["executionTarget"]["queueOwnerWidgetInstanceId"]
            .as_str(),
        Some("queue-1")
    );
}

#[test]
fn workflow_run_settings_queue_local_accepts_backend_owned_target_without_queue_widget() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    let service = WorkspaceService::new(store);
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let task = service
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
        .expect("task");
    let mut settings = queue_local_workflow_run_settings("queue-1");
    settings
        .execution_target
        .as_mut()
        .expect("target")
        .queue_owner_widget_instance_id = None;

    let result = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some(&task.queue_item_id),
            settings,
            None,
        ))
        .expect("backend-owned queue local settings apply");

    assert_eq!(result.status, QueueWorkflowApplyRunSettingsStatus::Applied);
    let binding = result.binding.expect("binding");
    assert_eq!(binding.execution_target_kind, "queue_local");
    assert_eq!(binding.provider_id, "codex");
    assert_eq!(binding.queue_owner_widget_instance_id, None);
    assert_eq!(binding.executor_widget_id, "");
    let updated_task = service
        .get_agent_queue_task("workspace-1", &task.queue_item_id)
        .expect("get task")
        .expect("task");
    assert_eq!(updated_task.assigned_executor_widget_id, None);

    let run = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: workflow_run.workflow_run_id.clone(),
        })
        .expect("get workflow")
        .expect("workflow");
    let slot_bindings: Value = serde_json::from_str(
        run.slot_bindings_json
            .as_deref()
            .expect("slot bindings json"),
    )
    .expect("slot bindings");
    assert!(slot_bindings["upstream"]["queueOwnerWidgetInstanceId"].is_null());
    assert!(slot_bindings["upstream"]["runSettings"]["executionTarget"]
        ["queueOwnerWidgetInstanceId"]
        .is_null());
}

#[test]
fn workflow_run_settings_queue_local_rejects_wrong_workspace_and_wrong_definition() {
    let store = initialized_store();
    create_workspace_with_queue(&store, "workspace-1", "workbench-1", "queue-1");
    create_workspace_with_queue(&store, "workspace-2", "workbench-2", "queue-2");
    let service = WorkspaceService::new(store);
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let task = service
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
        .expect("task");

    let wrong_workspace = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some(&task.queue_item_id),
            queue_local_workflow_run_settings("queue-2"),
            None,
        ))
        .expect_err("wrong workspace queue owner should fail storage validation");
    assert!(format!("{wrong_workspace:?}").contains("does not belong to workspace"));

    insert_executor_widget(&service.store, "workspace-1", "workbench-1", "executor-1");
    let wrong_definition = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some(&task.queue_item_id),
            queue_local_workflow_run_settings("executor-1"),
            None,
        ))
        .expect_err("wrong widget definition should fail storage validation");
    assert!(format!("{wrong_definition:?}").contains("not an Agent Queue widget"));
}

#[test]
fn workflow_run_settings_legacy_executor_still_requires_agent_run_widget() {
    let store = initialized_store();
    create_workspace_with_queue(&store, "workspace-1", "workbench-1", "queue-1");
    let service = WorkspaceService::new(store);
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let task = service
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
        .expect("task");

    let result = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some(&task.queue_item_id),
            workflow_run_settings("queue-1"),
            None,
        ))
        .expect_err("legacy executor target must be agent-run");

    assert!(format!("{result:?}").contains("not an Agent Executor"));
}

#[test]
fn workflow_run_settings_conflicts_on_changed_hash_and_task_id_mismatch_blocks() {
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

    service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            workflow_run_settings("executor-1"),
            None,
        ))
        .expect("apply settings");

    let mut changed = workflow_run_settings("executor-1");
    changed.codex_executable = "codex-nightly".to_owned();
    let conflict = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            changed,
            None,
        ))
        .expect("settings conflict");
    assert_eq!(
        conflict.status,
        QueueWorkflowApplyRunSettingsStatus::Conflict
    );
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "slot_settings_hash_conflict"
    );

    let mismatch = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            Some("other-task"),
            workflow_run_settings("executor-1"),
            None,
        ))
        .expect("task mismatch");
    assert_eq!(
        mismatch.status,
        QueueWorkflowApplyRunSettingsStatus::Blocked
    );
    assert_eq!(
        mismatch.blocker.expect("blocker").blocker_code,
        "task_id_mismatch"
    );
    assert_no_queue_workflow_side_effects(
        &service,
        "workspace-1",
        &materialized.task.expect("task").queue_item_id,
    );
}

#[test]
fn workflow_run_settings_blocks_existing_executor_assignment_mismatch() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    insert_executor_widget(&store, "workspace-1", "workbench-1", "executor-2");
    let service = WorkspaceService::new(store);
    let workflow_run = start_materialization_workflow(&service, "workspace-1", "request-1");
    let task = service
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
        .expect("task");
    service
        .store
        .assign_agent_queue_task_to_executor(
            "workspace-1",
            &task.queue_item_id,
            "executor-2",
            Some("assigned-elsewhere"),
        )
        .expect("assign executor")
        .expect("assigned task");

    let result = service
        .apply_agent_queue_workflow_run_settings(run_settings_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            workflow_run_settings("executor-1"),
            None,
        ))
        .expect("apply settings");

    assert_eq!(result.status, QueueWorkflowApplyRunSettingsStatus::Blocked);
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "executor_assignment_conflict"
    );
}
