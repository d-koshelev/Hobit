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
fn resume_planner_tracks_settings_and_promote_setup_state() {
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
    let task_spec_hash = materialized
        .binding
        .as_ref()
        .expect("binding")
        .task_spec_hash
        .clone();

    let missing_settings = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan missing settings")
        .expect("plan");
    assert_eq!(
        missing_settings.status,
        QueueWorkflowResumePlanStatus::WaitingForRunSettings
    );
    assert_eq!(
        missing_settings.next_step.as_deref(),
        Some("waiting_for_run_settings")
    );

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
        .expect("settings")
        .settings_hash;
    let missing_promote = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan missing promote")
        .expect("plan");
    assert_eq!(
        missing_promote.status,
        QueueWorkflowResumePlanStatus::WaitingForPromote
    );
    assert_eq!(
        missing_promote.next_step.as_deref(),
        Some("waiting_for_promote")
    );

    service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            &task_spec_hash,
            &settings_hash,
        ))
        .expect("promote");
    let start_ready = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan start ready")
        .expect("plan");
    assert_eq!(
        start_ready.status,
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(start_ready.next_step.as_deref(), Some("start_worker_ready"));
}

#[test]
fn resume_planner_recovers_setup_state_from_completed_workflow_actions() {
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
        .expect("settings")
        .settings_hash;
    service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            &task_spec_hash,
            &settings_hash,
        ))
        .expect("promote");
    service
        .store
        .update_agent_queue_workflow_run_report(
            "workspace-1",
            &workflow_run.workflow_run_id,
            hobit_storage_sqlite::AgentQueueWorkflowRunReportUpdate {
                status: "running",
                phase: Some("run_start"),
                current_step: Some("start_worker_ready"),
                pause_reason: None,
                blocker_reason: None,
                variables_json: None,
                slot_bindings_json: Some(&format!(
                    r#"{{"upstream":{{"taskId":"{}"}}}}"#,
                    task.queue_item_id
                )),
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                updated_at: Some("after-corrupt-binding"),
                completed_at: None,
            },
        )
        .expect("corrupt slot binding")
        .expect("workflow updated");

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(plan.next_step.as_deref(), Some("start_worker_ready"));
    assert!(plan
        .slot_reconciliations
        .iter()
        .any(|slot| slot.slot == "upstream"
            && slot.task_id.as_deref() == Some(task.queue_item_id.as_str())
            && slot.executor_widget_id.as_deref() == Some("executor-1")));
}

#[test]
fn resume_planner_blocks_start_worker_action_without_run_id() {
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
        .expect("settings")
        .settings_hash;
    service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            &task_spec_hash,
            &settings_hash,
        ))
        .expect("promote");
    let target_refs_json = json!({
        "executorWidgetId": "executor-1",
        "settingsHash": settings_hash,
        "taskId": task.queue_item_id,
        "workflowActionId": null,
        "workflowRunId": workflow_run.workflow_run_id,
    })
    .to_string();
    service
        .store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-start-running",
            workflow_run_id: &workflow_run.workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "start_worker",
            action_type: "start_worker",
            idempotency_key: "workflow-run-1:start_worker:task:executor:settings",
            status: "running",
            target_refs_json: Some(&target_refs_json),
            result_refs_json: None,
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("start-window"),
            completed_at: None,
            created_at: Some("start-window"),
            updated_at: Some("start-window"),
        })
        .expect("insert running start action");

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs
    );
    assert!(plan
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "start_state_unknown"));
}

#[test]
fn resume_planner_blocks_settings_promote_and_executor_mismatches() {
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
        .expect("settings")
        .settings_hash;

    service
        .store
        .update_agent_queue_task(
            "workspace-1",
            &task.queue_item_id,
            AgentQueueTaskUpdate {
                title: &task.title,
                description: &task.description,
                prompt: &task.prompt,
                status: &task.status,
                priority: task.priority,
                depends_on: Some("[]"),
                execution_policy: Some("manual"),
                execution_workspace: Some("C:/workspace/project"),
                codex_executable: Some("codex-drift"),
                sandbox: Some("workspace_write"),
                approval_policy: Some("never"),
                context_json: None,
                updated_at: Some("settings-drift"),
            },
        )
        .expect("drift settings")
        .expect("updated");
    let settings_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan settings mismatch")
        .expect("plan");
    assert_eq!(
        settings_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedSettingsMismatch
    );

    service
        .store
        .update_agent_queue_task(
            "workspace-1",
            &task.queue_item_id,
            AgentQueueTaskUpdate {
                title: &task.title,
                description: &task.description,
                prompt: &task.prompt,
                status: &task.status,
                priority: task.priority,
                depends_on: Some("[]"),
                execution_policy: Some("manual"),
                execution_workspace: Some("C:/workspace/project"),
                codex_executable: Some("codex"),
                sandbox: Some("workspace_write"),
                approval_policy: Some("never"),
                context_json: None,
                updated_at: Some("settings-restored"),
            },
        )
        .expect("restore settings")
        .expect("updated");
    insert_executor_widget(&service.store, "workspace-1", "workbench-1", "executor-2");
    service
        .store
        .assign_agent_queue_task_to_executor(
            "workspace-1",
            &task.queue_item_id,
            "executor-2",
            Some("executor-drift"),
        )
        .expect("assign executor")
        .expect("assigned");
    let executor_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan executor mismatch")
        .expect("plan");
    assert_eq!(
        executor_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedExecutorMismatch
    );

    service
        .store
        .assign_agent_queue_task_to_executor(
            "workspace-1",
            &task.queue_item_id,
            "executor-1",
            Some("executor-restored"),
        )
        .expect("restore executor")
        .expect("assigned");
    service
        .promote_agent_queue_workflow_task_slot(promote_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "upstream",
            None,
            &task_spec_hash,
            &settings_hash,
        ))
        .expect("promote");
    service
        .store
        .update_agent_queue_task_status(
            "workspace-1",
            &task.queue_item_id,
            "draft",
            Some("promote-drift"),
        )
        .expect("draft")
        .expect("updated");
    let promote_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan promote mismatch")
        .expect("plan");
    assert_eq!(
        promote_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedPromoteStateMismatch
    );
}

#[test]
fn plan_resume_blocks_when_materialized_dependency_edge_is_missing() {
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
    let downstream = service
        .materialize_agent_queue_workflow_task_slot(materialize_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            "downstream",
            "Implement follow-up",
            "Use the upstream result to implement the follow-up.",
            vec!["upstream"],
        ))
        .expect("materialize downstream")
        .task
        .expect("downstream task");
    service
        .store
        .update_agent_queue_task(
            "workspace-1",
            &downstream.queue_item_id,
            AgentQueueTaskUpdate {
                title: &downstream.title,
                description: &downstream.description,
                prompt: &downstream.prompt,
                status: &downstream.status,
                priority: downstream.priority,
                depends_on: Some("[]"),
                execution_policy: Some(downstream.execution_policy.as_str()),
                execution_workspace: None,
                codex_executable: None,
                sandbox: None,
                approval_policy: None,
                context_json: None,
                updated_at: Some("edge-removed"),
            },
        )
        .expect("remove dependency edge")
        .expect("updated task");

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            &workflow_run.workflow_run_id,
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedDependencyEdgeMissing
    );
    assert!(plan
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "dependency_edge_missing"));
    assert_eq!(
        service
            .get_agent_queue_task("workspace-1", &downstream.queue_item_id)
            .expect("get downstream")
            .expect("downstream")
            .depends_on,
        Vec::<String>::new(),
        "resume planning must not repair dependency edges"
    );
    assert_eq!(upstream.status, "draft");
}

#[test]
fn plan_resume_blocks_missing_and_cross_workspace_tasks() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    create_workspace_in_store(&store, "workspace-2");
    create_task_row(
        &store,
        "workspace-2",
        "task-other-workspace",
        "queued",
        true,
        None,
    );
    insert_resume_workflow(
        &store,
        "workflow-run-missing",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-missing"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-mismatch",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-other-workspace"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let missing = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-missing", None))
        .expect("plan missing task")
        .expect("plan");
    let mismatch = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-mismatch", None))
        .expect("plan task mismatch")
        .expect("plan");

    assert_eq!(
        missing.status,
        QueueWorkflowResumePlanStatus::BlockedMissingTask
    );
    assert_eq!(
        missing.blockers[0].missing_required_field.as_deref(),
        Some("taskId")
    );
    assert_eq!(
        mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedStateMismatch
    );
    assert_eq!(mismatch.blockers[0].blocker_code, "task_workspace_mismatch");
}
