use hobit_storage_sqlite::{
    AgentQueueTaskUpdate, NewAgentQueueCompletionDecision, NewAgentQueueFailureDecision,
    NewAgentQueueReviewMessage, NewAgentQueueTask, NewAgentQueueTaskRunLink,
    NewAgentQueueWorkerEvidenceBundle, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun,
    NewWidgetInstance, NewWidgetRun, SqliteStore,
};
use serde_json::{json, Value};

use super::super::agent_queue_workflow::canonical_json_string;
use super::super::*;

pub(super) fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

pub(super) fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("initialize schema");
    store
}

pub(super) fn create_workspace(service: &WorkspaceService, workspace_id: &str) {
    service
        .store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

pub(super) fn create_workspace_in_store(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

pub(super) fn start_request(workspace_id: &str, request_id: &str) -> QueueWorkflowStartRequest {
    QueueWorkflowStartRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_id: "dependency_acceptance_smoke".to_owned(),
        request_id: request_id.to_owned(),
        phase: None,
        current_step: None,
        actor_id: Some("workspace-agent".to_owned()),
        inputs_snapshot: Some(json!({
            "taskIdsBySlot": {
                "upstream": "task-upstream",
                "downstream": "task-downstream"
            }
        })),
        grant_summary: Some(json!({
            "actorId": "workspace-agent",
            "mode": "queue_acceptance_smoke",
            "allowedRiskClasses": ["read", "review"],
            "constraints": {
                "noGit": true,
                "noValidationExecution": true,
                "noRollback": true,
                "noTerminal": true,
                "noDelete": true,
                "noDownstreamAutoStart": true
            },
            "scope": {
                "taskIds": ["task-upstream", "task-downstream"]
            },
            "issuedAt": "1",
            "expiresAt": "2",
            "restartPolicy": "regrant_mutations",
            "maxActions": 16,
            "consumedActionCount": 0,
            "ignoredUnsafeField": "not persisted"
        })),
        variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
        slot_bindings: Some(json!({"upstream": {"taskId": "task-upstream"}})),
        mutation_refs: Some(json!({})),
        idempotency_keys: Some(json!({})),
        action_log_summary: Some(json!([])),
    }
}

pub(super) fn workflow_evidence_request(
    workflow_run_id: &str,
    slot: &str,
    task_id: &str,
    run_id: &str,
    outcome: &str,
) -> QueueWorkflowRecordWorkerEvidenceRequest {
    QueueWorkflowRecordWorkerEvidenceRequest {
        workspace_id: "workspace-1".to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: slot.to_owned(),
        task_id: task_id.to_owned(),
        run_id: run_id.to_owned(),
        outcome: outcome.to_owned(),
        summary: Some("Worker evidence is durable.".to_owned()),
        changed_files: Vec::new(),
        changed_files_summary: None,
        validation_summary: None,
        error_summary: None,
        worker_id: Some("workspace-agent".to_owned()),
        source: Some("workspace_agent".to_owned()),
        metadata_json: None,
        finished_at: Some("4".to_owned()),
        actor_id: None,
        action_idempotency_key: None,
    }
}

pub(super) fn plan_request(
    workspace_id: &str,
    workflow_run_id: &str,
    expected_version: Option<i64>,
) -> QueueWorkflowPlanResumeRequest {
    QueueWorkflowPlanResumeRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        expected_version,
    }
}

pub(super) fn start_materialization_workflow(
    service: &WorkspaceService,
    workspace_id: &str,
    request_id: &str,
) -> QueueWorkflowRun {
    service
        .start_queue_workflow(QueueWorkflowStartRequest {
            workspace_id: workspace_id.to_owned(),
            workflow_id: "dependency_acceptance_smoke".to_owned(),
            request_id: request_id.to_owned(),
            phase: None,
            current_step: None,
            actor_id: Some("workspace-agent".to_owned()),
            inputs_snapshot: Some(json!({
                "tasks": [
                    {
                        "slot": "upstream",
                        "title": "Inspect contract",
                        "prompt": "Read the visible contract and summarize blockers.",
                        "dependsOnSlots": []
                    },
                    {
                        "slot": "downstream",
                        "title": "Implement follow-up",
                        "prompt": "Use the upstream result to implement the follow-up.",
                        "dependsOnSlots": ["upstream"]
                    }
                ]
            })),
            grant_summary: Some(json!({
                "actorId": "workspace-agent",
                "mode": "queue_acceptance_smoke",
                "allowedRiskClasses": ["read", "review"],
                "constraints": {
                    "noGit": true,
                    "noValidationExecution": true,
                    "noRollback": true,
                    "noTerminal": true,
                    "noDelete": true,
                    "noDownstreamAutoStart": true
                },
                "scope": {
                    "workflowRunId": request_id
                },
                "issuedAt": "1",
                "expiresAt": "9999999999",
                "restartPolicy": "regrant_mutations",
                "maxActions": 16,
                "consumedActionCount": 0
            })),
            variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
            slot_bindings: Some(json!({})),
            mutation_refs: Some(json!({})),
            idempotency_keys: Some(json!({})),
            action_log_summary: Some(json!([])),
        })
        .expect("start workflow")
        .workflow_run
        .expect("workflow run")
}

pub(super) fn materialize_request(
    workspace_id: &str,
    workflow_run_id: &str,
    slot: &str,
    title: &str,
    prompt: &str,
    depends_on_slots: Vec<&str>,
) -> QueueWorkflowMaterializeTaskSlotRequest {
    QueueWorkflowMaterializeTaskSlotRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: slot.to_owned(),
        task_spec: QueueWorkflowTaskSpec {
            title: title.to_owned(),
            prompt: prompt.to_owned(),
            description: None,
            status: None,
            priority: None,
        },
        task_spec_hash: None,
        depends_on_slots: depends_on_slots.into_iter().map(str::to_owned).collect(),
        actor_id: Some("workspace-agent".to_owned()),
        action_idempotency_key: None,
    }
}

pub(super) fn initialized_service_with_executor() -> WorkspaceService {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    WorkspaceService::new(store)
}

pub(super) fn workflow_run_settings(executor_widget_id: &str) -> QueueWorkflowRunSettings {
    QueueWorkflowRunSettings {
        execution_workspace: "C:/workspace/project".to_owned(),
        codex_executable: "codex".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        execution_policy: "manual".to_owned(),
        execution_target: None,
        executor_widget_id: executor_widget_id.to_owned(),
    }
}

pub(super) fn queue_local_workflow_run_settings(queue_widget_id: &str) -> QueueWorkflowRunSettings {
    QueueWorkflowRunSettings {
        execution_workspace: "C:/workspace/project".to_owned(),
        codex_executable: "codex".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        execution_policy: "manual".to_owned(),
        execution_target: Some(QueueWorkflowExecutionTarget {
            kind: "queue_local".to_owned(),
            provider_id: "codex".to_owned(),
            queue_owner_widget_instance_id: Some(queue_widget_id.to_owned()),
            executor_widget_id: None,
        }),
        executor_widget_id: String::new(),
    }
}

pub(super) fn run_settings_request(
    workspace_id: &str,
    workflow_run_id: &str,
    slot: &str,
    task_id: Option<&str>,
    run_settings: QueueWorkflowRunSettings,
    settings_hash: Option<&str>,
) -> QueueWorkflowApplyRunSettingsRequest {
    QueueWorkflowApplyRunSettingsRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: slot.to_owned(),
        task_id: task_id.map(str::to_owned),
        run_settings,
        settings_hash: settings_hash.map(str::to_owned),
        actor_id: Some("workspace-agent".to_owned()),
        action_idempotency_key: None,
    }
}

pub(super) fn promote_request(
    workspace_id: &str,
    workflow_run_id: &str,
    slot: &str,
    task_id: Option<&str>,
    task_spec_hash: &str,
    settings_hash: &str,
) -> QueueWorkflowPromoteTaskSlotRequest {
    QueueWorkflowPromoteTaskSlotRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        slot: slot.to_owned(),
        task_id: task_id.map(str::to_owned),
        task_spec_hash: task_spec_hash.to_owned(),
        settings_hash: settings_hash.to_owned(),
        actor_id: Some("workspace-agent".to_owned()),
        action_idempotency_key: None,
    }
}

pub(super) fn assert_no_queue_workflow_side_effects(
    service: &WorkspaceService,
    workspace_id: &str,
    task_id: &str,
) {
    assert!(
        service
            .store
            .list_agent_queue_task_run_links(workspace_id, task_id)
            .expect("list run links")
            .is_empty(),
        "task materialization must not start workers"
    );
    assert!(
        service
            .store
            .list_agent_queue_review_messages(workspace_id, task_id)
            .expect("list review messages")
            .is_empty(),
        "task materialization must not create reviews"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_worker_evidence_bundle(workspace_id, task_id)
            .expect("latest evidence")
            .is_none(),
        "task materialization must not record evidence"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_completion_decision(workspace_id, task_id)
            .expect("latest completion decision")
            .is_none(),
        "task materialization must not finalize completion"
    );
    assert!(
        service
            .store
            .get_latest_agent_queue_failure_decision(workspace_id, task_id)
            .expect("latest failure decision")
            .is_none(),
        "task materialization must not finalize failure"
    );
}

pub(super) fn runner_report_request(
    workspace_id: &str,
    workflow_run_id: &str,
) -> QueueWorkflowRecordRunnerReportRequest {
    QueueWorkflowRecordRunnerReportRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: workflow_run_id.to_owned(),
        status: "paused".to_owned(),
        phase: Some("review".to_owned()),
        current_step: Some("review_ack".to_owned()),
        pause_reason: Some("waiting_for_review_ack".to_owned()),
        blocker_reason: None,
        variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
        slot_bindings: Some(json!({"upstream": {"taskId": "task-1"}})),
        mutation_refs: Some(json!({"reviewMessageId": "message-1"})),
        idempotency_keys: Some(json!([format!(
            "{workflow_run_id}:queue.review.createMessage:task-1:run-1"
        )])),
        action_log_summary: Some(json!({
            "runnerStatus": "completed",
            "currentStep": "review_ack",
            "actions": 1
        })),
        actions: vec![QueueWorkflowRecordRunnerAction {
            step_id: "review.create".to_owned(),
            action_type: "queue.review.createMessage".to_owned(),
            idempotency_key: format!("{workflow_run_id}:queue.review.createMessage:task-1:run-1"),
            status: QueueWorkflowActionStatus::Completed.as_str().to_owned(),
            target_refs: Some(json!({"taskId": "task-1", "runId": "run-1"})),
            result_refs: Some(json!({"messageId": "message-1", "status": "created"})),
            blocker_code: None,
            blocker_message: None,
        }],
    }
}

pub(super) fn insert_resume_workflow(
    store: &SqliteStore,
    workflow_run_id: &str,
    workflow_id: &str,
    status: &str,
    phase: &str,
    current_step: Option<&str>,
    inputs_snapshot_json: Option<&str>,
    slot_bindings_json: Option<&str>,
    grant_summary_json: Option<&str>,
    version: Option<&str>,
) {
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id,
            workspace_id: "workspace-1",
            workflow_id,
            request_id: workflow_run_id,
            request_hash: "hash-1",
            status,
            phase,
            current_step,
            pause_reason: None,
            blocker_reason: None,
            actor_id: Some("workspace-agent"),
            inputs_snapshot_json,
            grant_summary_json,
            variables_json: Some("{}"),
            slot_bindings_json,
            mutation_refs_json: Some("{}"),
            idempotency_keys_json: Some("{}"),
            action_log_summary_json: Some("[]"),
            version: version
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(1),
            schema_version: 1,
            created_at: Some("1"),
            updated_at: Some("1"),
            completed_at: matches!(status, "completed" | "failed" | "cancelled").then_some("2"),
        })
        .expect("insert workflow run");
}

pub(super) fn service_update_slot_bindings_for_test(
    store: &SqliteStore,
    workflow_run_id: &str,
    slot_bindings_json: &str,
) {
    store
        .update_agent_queue_workflow_run_report(
            "workspace-1",
            workflow_run_id,
            hobit_storage_sqlite::AgentQueueWorkflowRunReportUpdate {
                status: "failed",
                phase: None,
                current_step: None,
                pause_reason: None,
                blocker_reason: None,
                variables_json: None,
                slot_bindings_json: Some(slot_bindings_json),
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                updated_at: Some("6"),
                completed_at: None,
            },
        )
        .expect("update workflow slot bindings")
        .expect("updated workflow run");
}

pub(super) fn insert_completed_start_worker_action(
    store: &SqliteStore,
    workflow_run_id: &str,
    action_id: &str,
    task_id: &str,
    slot: Option<&str>,
    run_id: &str,
) {
    let mut target_refs = json!({
        "executionTargetHash": "execution-target-hash-1",
        "executionTargetKind": "queue_local",
        "providerId": "codex",
        "settingsHash": "settings-hash-1",
        "taskId": task_id,
        "workflowRunId": workflow_run_id
    });
    if let Some(slot) = slot {
        target_refs
            .as_object_mut()
            .expect("target refs object")
            .insert("slot".to_owned(), json!(slot));
    }
    let target_refs = target_refs.to_string();
    let result_refs = json!({ "runId": run_id }).to_string();
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id,
            workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "start_worker",
            action_type: "start_worker",
            idempotency_key: &format!("{workflow_run_id}:start_worker:{action_id}"),
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: Some(&result_refs),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("2"),
            completed_at: Some("3"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert completed start_worker action");
}

pub(super) fn insert_retryable_worker_evidence_workflow(
    store: &SqliteStore,
    workflow_run_id: &str,
    workflow_status: &str,
    current_step: &str,
    task_id: &str,
    run_id: &str,
) {
    let settings_hash = retryable_queue_local_settings_hash();
    let execution_target_hash = retryable_queue_local_execution_target_hash();
    let slot_bindings_json = json!({
        "upstream": {
            "executionTargetHash": execution_target_hash,
            "executionTargetKind": "queue_local",
            "providerId": "codex",
            "runId": run_id,
            "settingsHash": settings_hash,
            "taskId": task_id
        }
    })
    .to_string();
    insert_resume_workflow(
        store,
        workflow_run_id,
        "dependency_failure_smoke",
        workflow_status,
        "worker_evidence",
        Some(current_step),
        Some(
            r#"{"tasks":[{"slot":"upstream","title":"Task","prompt":"Prompt"},{"slot":"downstream","title":"Downstream","prompt":"Prompt","dependsOnSlots":["upstream"]}],"failureReason":"typed failure reason"}"#,
        ),
        Some(&slot_bindings_json),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    insert_completed_start_worker_action_with_refs(
        store,
        workflow_run_id,
        &format!("start-worker-{workflow_run_id}"),
        task_id,
        Some("upstream"),
        run_id,
        &settings_hash,
        &execution_target_hash,
    );
    insert_failed_worker_evidence_runner_action(store, workflow_run_id);
}

pub(super) fn retryable_queue_local_settings_hash() -> String {
    QueueWorkerStartSettingsSnapshot {
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
    .stable_hash()
}

pub(super) fn retryable_queue_local_execution_target_hash() -> String {
    QueueExecutionTargetSnapshot {
        execution_target_kind: "queue_local".to_owned(),
        provider_id: "codex".to_owned(),
        queue_owner_widget_instance_id: None,
        executor_widget_id: None,
    }
    .stable_hash()
}

pub(super) fn insert_completed_start_worker_action_with_refs(
    store: &SqliteStore,
    workflow_run_id: &str,
    action_id: &str,
    task_id: &str,
    slot: Option<&str>,
    run_id: &str,
    settings_hash: &str,
    execution_target_hash: &str,
) {
    let mut target_refs = json!({
        "executionTargetHash": execution_target_hash,
        "executionTargetKind": "queue_local",
        "providerId": "codex",
        "settingsHash": settings_hash,
        "taskId": task_id,
        "workflowRunId": workflow_run_id
    });
    if let Some(slot) = slot {
        target_refs
            .as_object_mut()
            .expect("target refs object")
            .insert("slot".to_owned(), json!(slot));
    }
    let target_refs = target_refs.to_string();
    let result_refs = json!({ "runId": run_id }).to_string();
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id,
            workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "start_worker",
            action_type: "start_worker",
            idempotency_key: &format!("{workflow_run_id}:start_worker:{action_id}"),
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: Some(&result_refs),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("2"),
            completed_at: Some("3"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert completed start_worker action");
}

pub(super) fn insert_failed_worker_evidence_runner_action(
    store: &SqliteStore,
    workflow_run_id: &str,
) {
    let target_refs = json!({
        "phase": "worker_evidence",
        "requestId": "request-1",
        "workflowId": "dependency_failure_smoke"
    })
    .to_string();
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: &format!("runner-worker-evidence-{workflow_run_id}"),
            workflow_run_id,
            workspace_id: "workspace-1",
            step_id: "runner.worker_evidence",
            action_type: "queue.workflow.runner",
            idempotency_key: &format!(
                "{workflow_run_id}:queue.workflow.runner:worker_evidence:request-1"
            ),
            status: QueueWorkflowActionStatus::Failed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: None,
            blocker_code: Some("failed_unexpected"),
            blocker_message: Some("Queue workflow worker evidence failed unexpectedly."),
            attempt_count: 1,
            started_at: Some("4"),
            completed_at: Some("4"),
            created_at: Some("4"),
            updated_at: Some("4"),
        })
        .expect("insert failed worker evidence runner action");
}

pub(super) fn create_workspace_with_executor(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    executor_id: &str,
) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench(workbench_id, workspace_id, None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: executor_id,
            workspace_id,
            workbench_id,
            definition_id: "agent-run",
            title: "Agent Executor",
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
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert executor");
}

pub(super) fn create_workspace_with_queue(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    queue_widget_id: &str,
) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench(workbench_id, workspace_id, None)
        .expect("create workbench");
    insert_queue_widget(store, workspace_id, workbench_id, queue_widget_id);
}

pub(super) fn insert_executor_widget(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    executor_id: &str,
) {
    store
        .insert_widget_instance(NewWidgetInstance {
            id: executor_id,
            workspace_id,
            workbench_id,
            definition_id: "agent-run",
            title: "Agent Executor",
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
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert executor");
}

pub(super) fn insert_queue_widget(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    queue_widget_id: &str,
) {
    store
        .insert_widget_instance(NewWidgetInstance {
            id: queue_widget_id,
            workspace_id,
            workbench_id,
            definition_id: "agent-queue",
            title: "Agent Queue",
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
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert queue");
}

pub(super) fn create_task_row(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    status: &str,
    with_run_settings: bool,
    depends_on_json: Option<&str>,
) {
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: task_id,
            workspace_id,
            title: "Task",
            description: "",
            prompt: "Prompt",
            status,
            priority: 1,
            depends_on: depends_on_json,
            execution_policy: None,
            execution_workspace: with_run_settings.then_some("C:/workspace/project"),
            codex_executable: with_run_settings.then_some("codex"),
            sandbox: with_run_settings.then_some("workspace_write"),
            approval_policy: with_run_settings.then_some("never"),
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
}

pub(super) fn create_run_link(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    status: &str,
) {
    store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: "executor-1",
            status,
            command_kind: Some("codex_direct_work"),
            command_payload: Some("{}"),
            started_at: Some("2"),
            finished_at: (status != "running").then_some("3"),
            summary: Some("Worker summary"),
        })
        .expect("insert widget run");
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id,
            workspace_id,
            queue_task_id: task_id,
            executor_widget_id: "executor-1",
            direct_work_run_id: run_id,
            source: "manual",
            status,
            started_at: Some("2"),
            completed_at: (status != "running").then_some("3"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert run link");
}

pub(super) fn create_queue_local_run_link_without_widget_run(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    status: &str,
) {
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id,
            workspace_id,
            queue_task_id: task_id,
            executor_widget_id: "queue-local-codex",
            direct_work_run_id: run_id,
            source: "queue_local",
            status,
            started_at: Some("2"),
            completed_at: (status != "running").then_some("3"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert queue-local run link");
}

pub(super) fn create_evidence(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    bundle_id: &str,
    outcome: &str,
) {
    store
        .upsert_agent_queue_worker_evidence_bundle(NewAgentQueueWorkerEvidenceBundle {
            bundle_id,
            workspace_id,
            queue_task_id: task_id,
            run_id,
            run_link_id: Some(link_id),
            executor_widget_id: Some("executor-1"),
            worker_id: Some("workspace-agent"),
            source: "workspace_agent",
            outcome,
            summary: "Worker evidence is durable.",
            changed_files_json: "[]",
            changed_files_count: 0,
            changed_files_summary: None,
            validation_summary: None,
            error_summary: None,
            metadata_json: None,
            created_at: Some("4"),
            updated_at: Some("4"),
        })
        .expect("insert evidence");
}

pub(super) fn create_review_message(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    message_id: &str,
    status: &str,
) {
    store
        .insert_agent_queue_review_message(NewAgentQueueReviewMessage {
            message_id,
            workspace_id,
            queue_task_id: task_id,
            run_id: Some(run_id),
            run_link_id: Some(link_id),
            actor_id: "workspace-agent",
            message_body: "Review worker evidence.",
            status,
            created_at: Some("5"),
            acked_at: (status == "acknowledged").then_some("6"),
            ack_actor_id: (status == "acknowledged").then_some("workspace-agent"),
            metadata_json: None,
            updated_at: Some("6"),
        })
        .expect("insert review message");
}

pub(super) fn create_completion_decision(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    message_id: &str,
    decision_id: &str,
) {
    store
        .insert_agent_queue_completion_decision(NewAgentQueueCompletionDecision {
            decision_id,
            workspace_id,
            queue_task_id: task_id,
            run_id: Some(run_id),
            run_link_id: Some(link_id),
            review_message_id: Some(message_id),
            actor_id: "workspace-agent",
            decision: "accepted",
            reason: Some("Accepted."),
            metadata_json: None,
            created_at: Some("7"),
        })
        .expect("insert completion decision");
}

pub(super) fn create_failure_decision(
    store: &SqliteStore,
    workspace_id: &str,
    task_id: &str,
    run_id: &str,
    link_id: &str,
    bundle_id: &str,
    message_id: &str,
    decision_id: &str,
) {
    store
        .insert_agent_queue_failure_decision(NewAgentQueueFailureDecision {
            decision_id,
            workspace_id,
            queue_task_id: task_id,
            run_id: Some(run_id),
            run_link_id: Some(link_id),
            evidence_bundle_id: Some(bundle_id),
            review_message_id: Some(message_id),
            actor_id: "workspace-agent",
            decision: "failed",
            reason: "Rejected.",
            metadata_json: None,
            created_at: Some("7"),
        })
        .expect("insert failure decision");
}
