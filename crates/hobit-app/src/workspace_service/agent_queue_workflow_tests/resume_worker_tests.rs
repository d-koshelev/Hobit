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
fn plan_resume_reconciles_run_and_evidence_binding_mismatches() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-2", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "completed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "completed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "bundle-2",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-run-mismatch",
        "dependency_acceptance_smoke",
        "running",
        "worker_evidence",
        Some("worker_evidence"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-2"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence-mismatch",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-2"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let run_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-run-mismatch",
            None,
        ))
        .expect("plan run mismatch")
        .expect("plan");
    let evidence_mismatch = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-evidence-mismatch",
            None,
        ))
        .expect("plan evidence mismatch")
        .expect("plan");

    assert_eq!(
        run_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedStateMismatch
    );
    assert_eq!(run_mismatch.blockers[0].blocker_code, "run_task_mismatch");
    assert_eq!(
        evidence_mismatch.status,
        QueueWorkflowResumePlanStatus::BlockedStateMismatch
    );
    assert!(evidence_mismatch
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "evidence_task_mismatch"));
}

#[test]
fn plan_resume_waits_for_worker_evidence_for_finished_run() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::WaitingForWorkerEvidence
    );
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_worker_evidence")
    );
    assert_eq!(plan.next_phase.as_deref(), Some("worker_evidence"));
    assert!(!plan.required_confirmation);
}

#[test]
fn plan_resume_recovers_retryable_worker_evidence_runner_failure_shape() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "completed",
    );
    let settings_hash = retryable_queue_local_settings_hash();
    let execution_target_hash = retryable_queue_local_execution_target_hash();
    let retryable_slot_bindings = json!({
        "upstream": {
            "executionTargetHash": execution_target_hash,
            "executionTargetKind": "queue_local",
            "providerId": "codex",
            "settingsHash": settings_hash,
            "taskId": "task-1",
            "runId": "run-1"
        }
    })
    .to_string();
    insert_resume_workflow(
        &store,
        "workflow-run-retryable-evidence",
        "dependency_failure_smoke",
        "failed",
        "worker_evidence",
        Some("worker_evidence_failed_unexpected"),
        Some(
            r#"{"tasks":[{"slot":"upstream","title":"Task","prompt":"Prompt"},{"slot":"downstream","title":"Downstream","prompt":"Prompt","dependsOnSlots":["upstream"]}]}"#,
        ),
        Some(&retryable_slot_bindings),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    insert_completed_start_worker_action_with_refs(
        &store,
        "workflow-run-retryable-evidence",
        "start-worker-retryable-evidence",
        "task-1",
        Some("upstream"),
        "run-1",
        &settings_hash,
        &execution_target_hash,
    );
    let target_refs = json!({
        "phase": "worker_evidence",
        "requestId": "request-1",
        "workflowId": "dependency_failure_smoke"
    })
    .to_string();
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-runner-worker-evidence",
            workflow_run_id: "workflow-run-retryable-evidence",
            workspace_id: "workspace-1",
            step_id: "runner.worker_evidence",
            action_type: "queue.workflow.runner",
            idempotency_key:
                "workflow-run-retryable-evidence:queue.workflow.runner:worker_evidence:request-1",
            status: QueueWorkflowActionStatus::Failed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: None,
            blocker_code: Some("failed_unexpected"),
            blocker_message: Some("Queue workflow worker evidence recording failed unexpectedly"),
            attempt_count: 1,
            started_at: Some("4"),
            completed_at: Some("4"),
            created_at: Some("4"),
            updated_at: Some("4"),
        })
        .expect("insert failed runner action");
    insert_resume_workflow(
        &store,
        "workflow-run-arbitrary-failed",
        "review_acceptance",
        "failed",
        "worker_evidence",
        Some("worker_evidence_failed_unexpected"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-retryable-evidence",
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::RetryableWorkerEvidenceFailure
    );
    assert!(plan.resume_available);
    assert_eq!(plan.next_phase.as_deref(), Some("worker_evidence"));
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_worker_evidence")
    );
    assert!(plan.blockers.iter().any(|blocker| {
        blocker.blocker_code == "retryable_worker_evidence_failure"
            && blocker.missing_required_field.as_deref() == Some("workerEvidence")
    }));
    assert!(plan.slot_reconciliations.iter().any(|slot| {
        slot.slot == "upstream"
            && slot.task_id.as_deref() == Some("task-1")
            && slot.run_id.as_deref() == Some("run-1")
            && slot.evidence_bundle_id.is_none()
    }));

    let arbitrary = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-arbitrary-failed",
            None,
        ))
        .expect("plan arbitrary failed")
        .expect("plan");
    assert_eq!(
        arbitrary.status,
        QueueWorkflowResumePlanStatus::TerminalFailed
    );
    assert!(!arbitrary.resume_available);
}

#[test]
fn plan_resume_recovers_backend_queue_local_start_worker_missing_slot_refs() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
            definition_id: "agent-queue-worker",
            title: "Queue Local Worker",
            category: "agent",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: false,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert queue-local worker owner");
    create_task_row(
        &store,
        "workspace-1",
        "queue_task_wf_44a095e817b585b5",
        "running",
        true,
        None,
    );
    create_task_row(
        &store,
        "workspace-1",
        "queue_task_wf_50bf4534e054bec3",
        "draft",
        false,
        Some(r#"["queue_task_wf_44a095e817b585b5"]"#),
    );
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: "queue-run-link-live-failure",
            workspace_id: "workspace-1",
            queue_task_id: "queue_task_wf_44a095e817b585b5",
            executor_widget_id: QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
            direct_work_run_id: "queue-run_1782257290066506600_169",
            source: "manual",
            status: "completed",
            started_at: Some("2"),
            completed_at: Some("3"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert queue-local run link");
    store
        .insert_widget_run(NewWidgetRun {
            id: "queue-run_1782257290066506600_169",
            widget_instance_id: QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
            status: "completed",
            command_kind: Some("codex_direct_work"),
            command_payload: Some("{}"),
            started_at: Some("2"),
            finished_at: Some("3"),
            summary: Some("Worker summary"),
        })
        .expect("insert queue-local widget run");
    let settings_hash = QueueWorkerStartSettingsSnapshot {
        execution_workspace: "C:/workspace/project".to_owned(),
        codex_executable: "codex".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        execution_policy: "manual".to_owned(),
        execution_target_kind: "queue_local".to_owned(),
        provider_id: "codex".to_owned(),
        queue_owner_widget_instance_id: None,
        executor_widget_id: String::new(),
    }
    .stable_hash();
    let execution_target_hash = QueueExecutionTargetSnapshot {
        execution_target_kind: "queue_local".to_owned(),
        provider_id: "codex".to_owned(),
        queue_owner_widget_instance_id: None,
        executor_widget_id: None,
    }
    .stable_hash();
    let slot_bindings_json = json!({
        "upstream": {
            "executionTargetHash": execution_target_hash.clone(),
            "executionTargetKind": "queue_local",
            "executorWidgetId": "",
            "providerId": "codex",
            "queueOwnerWidgetInstanceId": Value::Null,
            "runSettings": {
                "approvalPolicy": "never",
                "codexExecutable": "codex",
                "executionPolicy": "manual",
                "executionTarget": {
                    "kind": "queue_local",
                    "providerId": "codex",
                    "queueOwnerWidgetInstanceId": Value::Null
                },
                "executorWidgetId": "",
                "executionWorkspace": "C:/workspace/project",
                "sandbox": "workspace_write"
            },
            "settingsHash": settings_hash.clone(),
            "taskId": "queue_task_wf_44a095e817b585b5",
            "taskSpecHash": "task-spec-hash-upstream"
        },
        "downstream": {
            "taskId": "queue_task_wf_50bf4534e054bec3",
            "taskSpecHash": "task-spec-hash-downstream"
        }
    })
    .to_string();
    insert_resume_workflow(
        &store,
        "queue-workflow-run-1782257290023621100_163",
        "dependency_failure_smoke",
        "paused",
        "run_start",
        Some("awaiting_worker_completion"),
        None,
        Some(&slot_bindings_json),
        None,
        Some("1"),
    );
    let start_target_refs = json!({
        "executionTargetHash": execution_target_hash.clone(),
        "settingsHash": settings_hash.clone(),
        "taskId": "queue_task_wf_44a095e817b585b5",
        "workflowRunId": "queue-workflow-run-1782257290023621100_163"
    })
    .to_string();
    let start_result_refs = json!({
        "runId": "queue-run_1782257290066506600_169"
    })
    .to_string();
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "workflow-action-start-worker",
            workflow_run_id: "queue-workflow-run-1782257290023621100_163",
            workspace_id: "workspace-1",
            step_id: "start_worker",
            action_type: "start_worker",
            idempotency_key: "queue-workflow-run-1782257290023621100_163:start_worker:queue_task_wf_44a095e817b585b5:target:settings",
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(&start_target_refs),
            result_refs_json: Some(&start_result_refs),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("2"),
            completed_at: Some("3"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert start action");
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "queue-workflow-run-1782257290023621100_163",
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::WaitingForWorkerEvidence
    );
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_worker_evidence")
    );
    assert!(plan.blockers.is_empty());
    assert!(plan.slot_reconciliations.iter().any(|slot| {
        slot.slot == "upstream"
            && slot.task_id.as_deref() == Some("queue_task_wf_44a095e817b585b5")
            && slot.run_id.as_deref() == Some("queue-run_1782257290066506600_169")
            && slot.executor_widget_id.is_none()
    }));

    let mismatch = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "queue-workflow-run-1782257290023621100_163",
            "upstream",
            "queue_task_wf_44a095e817b585b5",
            "queue-run_1782257290066506600_169",
            "failed",
        ))
        .expect("record mismatched queue-local evidence");

    assert_eq!(
        mismatch.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        mismatch.blocker.expect("blocker").blocker_code,
        "worker_outcome_mismatch"
    );
    assert!(mismatch.binding.is_none());
    assert!(service
        .store
        .get_agent_queue_worker_evidence_bundle(
            "workspace-1",
            "queue_task_wf_44a095e817b585b5",
            "queue-run_1782257290066506600_169",
        )
        .expect("evidence bundle lookup")
        .is_none());
    assert_eq!(
        service
            .store
            .list_agent_queue_workflow_actions(
                "workspace-1",
                "queue-workflow-run-1782257290023621100_163",
            )
            .expect("workflow actions after mismatch")
            .iter()
            .filter(|action| action.action_type == "record_worker_evidence")
            .count(),
        0
    );

    let evidence = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "queue-workflow-run-1782257290023621100_163",
            "upstream",
            "queue_task_wf_44a095e817b585b5",
            "queue-run_1782257290066506600_169",
            "completed",
        ))
        .expect("record corrected queue-local evidence");

    assert_eq!(
        evidence.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Recorded
    );
    let binding = evidence.binding.expect("binding");
    assert_eq!(binding.slot, "upstream");
    assert_eq!(binding.task_id, "queue_task_wf_44a095e817b585b5");
    assert_eq!(binding.run_id, "queue-run_1782257290066506600_169");
    assert!(!binding.evidence_bundle_id.is_empty());
    let workflow_run = evidence.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "worker_evidence");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
    let slot_bindings: Value =
        serde_json::from_str(workflow_run.slot_bindings_json.as_deref().unwrap())
            .expect("slot bindings json");
    assert_eq!(
        slot_bindings["upstream"]["runId"].as_str(),
        Some("queue-run_1782257290066506600_169")
    );
    assert_eq!(
        slot_bindings["upstream"]["evidenceBundleId"].as_str(),
        Some(binding.evidence_bundle_id.as_str())
    );
    assert_eq!(
        slot_bindings["upstream"]["settingsHash"].as_str(),
        Some(settings_hash.as_str())
    );
    assert_eq!(
        slot_bindings["upstream"]["executionTargetHash"].as_str(),
        Some(execution_target_hash.as_str())
    );
    assert_eq!(
        slot_bindings["upstream"]["taskSpecHash"].as_str(),
        Some("task-spec-hash-upstream")
    );

    let actions = service
        .store
        .list_agent_queue_workflow_actions(
            "workspace-1",
            "queue-workflow-run-1782257290023621100_163",
        )
        .expect("workflow actions");
    assert_eq!(
        actions
            .iter()
            .filter(|action| action.action_type == "start_worker")
            .count(),
        1
    );
    assert_eq!(
        actions
            .iter()
            .filter(|action| action.action_type == "record_worker_evidence")
            .count(),
        1
    );
    assert!(service
        .store
        .list_agent_queue_review_messages("workspace-1", "queue_task_wf_44a095e817b585b5")
        .expect("review messages")
        .is_empty());
    assert!(
        service
            .store
            .get_latest_agent_queue_completion_decision(
                "workspace-1",
                "queue_task_wf_44a095e817b585b5",
            )
            .expect("completion decision")
            .is_none()
    );
    assert!(service
        .store
        .get_latest_agent_queue_failure_decision("workspace-1", "queue_task_wf_44a095e817b585b5",)
        .expect("failure decision")
        .is_none());
    let downstream = service
        .store
        .get_agent_queue_task("workspace-1", "queue_task_wf_50bf4534e054bec3")
        .expect("get downstream")
        .expect("downstream task");
    assert_eq!(downstream.status, "draft");
}
