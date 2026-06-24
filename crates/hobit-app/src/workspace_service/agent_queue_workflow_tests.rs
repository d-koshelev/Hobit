use hobit_storage_sqlite::{
    AgentQueueTaskUpdate, NewAgentQueueCompletionDecision, NewAgentQueueFailureDecision,
    NewAgentQueueReviewMessage, NewAgentQueueTask, NewAgentQueueTaskRunLink,
    NewAgentQueueWorkerEvidenceBundle, NewAgentQueueWorkflowAction, NewAgentQueueWorkflowRun,
    NewWidgetInstance, NewWidgetRun, SqliteStore,
};
use serde_json::{json, Value};

use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(service: &WorkspaceService, workspace_id: &str) {
    service
        .store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_workspace_in_store(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn start_request(workspace_id: &str, request_id: &str) -> QueueWorkflowStartRequest {
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

fn workflow_evidence_request(
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

#[test]
fn start_queue_workflow_creates_persisted_workflow_run() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");

    let result = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow");
    let workflow_run = result.workflow_run.expect("workflow run");

    assert_eq!(result.status, QueueWorkflowStartStatus::Succeeded);
    assert_eq!(workflow_run.workspace_id, "workspace-1");
    assert_eq!(workflow_run.workflow_id, "dependency_acceptance_smoke");
    assert_eq!(workflow_run.status, "created");
    assert_eq!(workflow_run.phase, "intake");
    assert_eq!(workflow_run.current_step.as_deref(), Some("created"));
    assert_eq!(workflow_run.version, 1);
    assert_eq!(workflow_run.schema_version, 1);
    assert!(workflow_run.request_hash.starts_with("fnv1a64:"));
    assert!(workflow_run
        .grant_summary_json
        .as_deref()
        .expect("grant summary")
        .contains("queue_acceptance_smoke"));
    assert!(!workflow_run
        .grant_summary_json
        .as_deref()
        .expect("grant summary")
        .contains("ignoredUnsafeField"));
}

#[test]
fn start_queue_workflow_is_idempotent_for_same_request_hash() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");

    let first = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("first workflow run");
    let second = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start duplicate workflow");

    assert_eq!(second.status, QueueWorkflowStartStatus::AlreadyExists);
    assert_eq!(
        second
            .workflow_run
            .expect("existing workflow")
            .workflow_run_id,
        first.workflow_run_id
    );
}

#[test]
fn start_queue_workflow_same_request_id_different_hash_conflicts() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow");

    let mut request = start_request("workspace-1", "request-1");
    request.inputs_snapshot = Some(json!({"taskIdsBySlot": {"upstream": "changed"}}));
    let conflict = service
        .start_queue_workflow(request)
        .expect("start conflicting workflow");

    assert_eq!(conflict.status, QueueWorkflowStartStatus::Conflict);
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "request_id_hash_conflict"
    );
}

#[test]
fn same_request_id_is_allowed_in_different_workspaces() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    create_workspace(&service, "workspace-2");

    let first = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start first workflow");
    let second = service
        .start_queue_workflow(start_request("workspace-2", "request-1"))
        .expect("start second workflow");

    assert_eq!(first.status, QueueWorkflowStartStatus::Succeeded);
    assert_eq!(second.status, QueueWorkflowStartStatus::Succeeded);
}

#[test]
fn request_hash_is_stable_across_json_key_ordering() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let mut first = start_request("workspace-1", "request-1");
    first.inputs_snapshot = Some(serde_json::from_str(r#"{"b":2,"a":1}"#).expect("json"));
    let mut second = start_request("workspace-1", "request-1");
    second.inputs_snapshot = Some(serde_json::from_str(r#"{"a":1,"b":2}"#).expect("json"));

    let first = service
        .start_queue_workflow(first)
        .expect("start first")
        .workflow_run
        .expect("first run");
    let second = service.start_queue_workflow(second).expect("start second");

    assert_eq!(second.status, QueueWorkflowStartStatus::AlreadyExists);
    assert_eq!(
        second.workflow_run.expect("existing run").request_hash,
        first.request_hash
    );
}

#[test]
fn start_queue_workflow_rejects_confirmation_token_in_grant_summary() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let mut request = start_request("workspace-1", "request-1");
    request.grant_summary = Some(json!({
        "mode": "queue_acceptance_smoke",
        "confirmationToken": "operator-confirmed"
    }));

    let result = service
        .start_queue_workflow(request)
        .expect("start workflow");

    assert_eq!(result.status, QueueWorkflowStartStatus::InvalidInput);
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "confirmation_token_not_persistable"
    );
}

#[test]
fn start_queue_workflow_rejects_oversized_json_fields() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let oversized = Value::String("x".repeat(MAX_WORKFLOW_INPUTS_JSON_BYTES + 1));

    for (field, request) in [
        {
            let mut request = start_request("workspace-1", "inputs-too-large");
            request.inputs_snapshot = Some(oversized.clone());
            ("inputsSnapshot", request)
        },
        {
            let mut request = start_request("workspace-1", "grant-too-large");
            request.grant_summary =
                Some(json!({"mode": "x".repeat(MAX_WORKFLOW_GRANT_SUMMARY_JSON_BYTES + 1)}));
            ("grantSummary", request)
        },
        {
            let mut request = start_request("workspace-1", "variables-too-large");
            request.variables = Some(oversized.clone());
            ("variables", request)
        },
        {
            let mut request = start_request("workspace-1", "slots-too-large");
            request.slot_bindings = Some(oversized.clone());
            ("slotBindings", request)
        },
        {
            let mut request = start_request("workspace-1", "mutations-too-large");
            request.mutation_refs = Some(oversized.clone());
            ("mutationRefs", request)
        },
        {
            let mut request = start_request("workspace-1", "idempotency-too-large");
            request.idempotency_keys = Some(oversized.clone());
            ("idempotencyKeys", request)
        },
        {
            let mut request = start_request("workspace-1", "actions-too-large");
            request.action_log_summary = Some(oversized.clone());
            ("actionLogSummary", request)
        },
    ] {
        let result = service
            .start_queue_workflow(request)
            .expect("start workflow");
        assert_eq!(result.status, QueueWorkflowStartStatus::InvalidInput);
        assert_eq!(
            result
                .blocker
                .expect("blocker")
                .missing_required_field
                .as_deref(),
            Some(field)
        );
    }
}

#[test]
fn get_and_list_queue_workflow_runs_are_workspace_scoped() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    create_workspace(&service, "workspace-2");
    let run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("run");
    service
        .start_queue_workflow(start_request("workspace-2", "request-1"))
        .expect("start other workflow");

    let fetched = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: run.workflow_run_id.clone(),
        })
        .expect("get run")
        .expect("run");
    let cross_workspace = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-2".to_owned(),
            workflow_run_id: run.workflow_run_id,
        })
        .expect("get cross-workspace run");
    let listed = service
        .list_queue_workflow_runs(QueueWorkflowListRequest {
            workspace_id: "workspace-1".to_owned(),
            status: Some("created".to_owned()),
            workflow_id: Some("dependency_acceptance_smoke".to_owned()),
        })
        .expect("list workflow runs");

    assert_eq!(fetched.workspace_id, "workspace-1");
    assert!(cross_workspace.is_none());
    assert_eq!(listed.len(), 1);
}

#[test]
fn cancel_queue_workflow_run_is_non_destructive_and_idempotent() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("run");

    let cancelled = service
        .cancel_queue_workflow_run(QueueWorkflowCancelRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: run.workflow_run_id.clone(),
            actor_id: Some("operator".to_owned()),
            reason: Some("operator stopped workflow".to_owned()),
        })
        .expect("cancel workflow");
    let cancelled_again = service
        .cancel_queue_workflow_run(QueueWorkflowCancelRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: run.workflow_run_id,
            actor_id: Some("operator".to_owned()),
            reason: None,
        })
        .expect("cancel workflow again");

    assert_eq!(cancelled.status, QueueWorkflowCancelStatus::Cancelled);
    assert_eq!(
        cancelled.workflow_run.expect("cancelled run").status,
        "cancelled"
    );
    assert_eq!(
        cancelled_again.status,
        QueueWorkflowCancelStatus::AlreadyCancelled
    );
    assert!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list queue tasks")
            .is_empty(),
        "workflow cancel must not create or mutate Queue tasks"
    );
}

#[test]
fn cancel_queue_workflow_run_rejects_completed_and_failed_runs() {
    for (status, expected) in [
        ("completed", QueueWorkflowCancelStatus::AlreadyTerminal),
        ("failed", QueueWorkflowCancelStatus::AlreadyTerminal),
    ] {
        let store = initialized_store();
        create_workspace_in_store(&store, "workspace-1");
        store
            .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
                workflow_run_id: "workflow-run-1",
                workspace_id: "workspace-1",
                workflow_id: "dependency_acceptance_smoke",
                request_id: "request-1",
                request_hash: "hash-1",
                status,
                phase: "closed",
                current_step: None,
                pause_reason: None,
                blocker_reason: None,
                actor_id: None,
                inputs_snapshot_json: None,
                grant_summary_json: None,
                variables_json: None,
                slot_bindings_json: None,
                mutation_refs_json: None,
                idempotency_keys_json: None,
                action_log_summary_json: None,
                version: 1,
                schema_version: 1,
                created_at: Some("1"),
                updated_at: Some("1"),
                completed_at: Some("1"),
            })
            .expect("insert terminal workflow run");
        let service = WorkspaceService::new(store);

        let result = service
            .cancel_queue_workflow_run(QueueWorkflowCancelRequest {
                workspace_id: "workspace-1".to_owned(),
                workflow_run_id: "workflow-run-1".to_owned(),
                actor_id: None,
                reason: None,
            })
            .expect("cancel terminal workflow");

        assert_eq!(result.status, expected);
    }
}

#[test]
fn workflow_failed_status_is_workflow_execution_failure_not_queue_task_failure() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Task",
            description: "",
            prompt: "Prompt",
            status: "queued",
            priority: 1,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id: "workflow-run-failed",
            workspace_id: "workspace-1",
            workflow_id: "dependency_acceptance_smoke",
            request_id: "request-1",
            request_hash: "hash-1",
            status: QueueWorkflowRunStatus::Failed.as_str(),
            phase: "closed",
            current_step: None,
            pause_reason: None,
            blocker_reason: Some("workflow crashed"),
            actor_id: None,
            inputs_snapshot_json: None,
            grant_summary_json: None,
            variables_json: None,
            slot_bindings_json: None,
            mutation_refs_json: None,
            idempotency_keys_json: None,
            action_log_summary_json: None,
            version: 1,
            schema_version: 1,
            created_at: Some("1"),
            updated_at: Some("1"),
            completed_at: Some("1"),
        })
        .expect("insert failed workflow");
    let service = WorkspaceService::new(store);

    let workflow = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-failed".to_owned(),
        })
        .expect("get workflow")
        .expect("workflow");
    let aggregate = service
        .get_queue_item_aggregate("workspace-1", "task-1")
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(workflow.status, "failed");
    assert_ne!(aggregate.ticket_state.as_str(), "failure");
    assert!(!aggregate.durable_flags.failure_state);
}

#[test]
fn queue_workflow_report_returns_persisted_actions_and_no_resume_execution() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    store
        .insert_agent_queue_workflow_run(NewAgentQueueWorkflowRun {
            workflow_run_id: "workflow-run-1",
            workspace_id: "workspace-1",
            workflow_id: "dependency_acceptance_smoke",
            request_id: "request-1",
            request_hash: "hash-1",
            status: "created",
            phase: "intake",
            current_step: Some("created"),
            pause_reason: None,
            blocker_reason: None,
            actor_id: None,
            inputs_snapshot_json: None,
            grant_summary_json: None,
            variables_json: None,
            slot_bindings_json: None,
            mutation_refs_json: None,
            idempotency_keys_json: None,
            action_log_summary_json: None,
            version: 1,
            schema_version: 1,
            created_at: Some("1"),
            updated_at: Some("1"),
            completed_at: None,
        })
        .expect("insert workflow");
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-1",
            workflow_run_id: "workflow-run-1",
            workspace_id: "workspace-1",
            step_id: "read.aggregate",
            action_type: "queue.lifecycle.get",
            idempotency_key: "workflow-run-1:read:task-1",
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(r#"{"taskId":"task-1"}"#),
            result_refs_json: Some(r#"{"snapshot":"bounded"}"#),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("2"),
            completed_at: Some("2"),
            created_at: Some("2"),
            updated_at: Some("2"),
        })
        .expect("insert action");
    let service = WorkspaceService::new(store);

    let report = service
        .get_queue_workflow_report(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-1".to_owned(),
        })
        .expect("get report")
        .expect("report");

    assert!(report.resume_available);
    assert_eq!(report.resume_status, "plan_required");
    assert_eq!(report.actions.len(), 1);
    assert_eq!(report.actions[0].action_type, "queue.lifecycle.get");
    assert!(report
        .report_summary
        .contains("Persisted workflow actions: 1"));
}

#[test]
fn record_runner_report_updates_only_workflow_run_and_action_ledger() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review_create_ready"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_runner_report(runner_report_request("workspace-1", "workflow-run-1"))
        .expect("record runner report");
    let workflow_run = result.workflow_run.expect("workflow run");

    assert_eq!(
        result.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "review");
    assert_eq!(workflow_run.current_step.as_deref(), Some("review_ack"));
    assert!(workflow_run
        .action_log_summary_json
        .as_deref()
        .expect("action summary")
        .contains("review_ack"));
    assert_eq!(result.actions.len(), 1);
    assert_eq!(result.actions[0].action_type, "queue.review.createMessage");
    assert_eq!(
        service
            .store
            .list_agent_queue_review_messages("workspace-1", "task-1")
            .expect("list review messages")
            .len(),
        0,
        "report persistence must not create review messages"
    );
    assert!(service
        .store
        .get_latest_agent_queue_completion_decision("workspace-1", "task-1")
        .expect("latest completion")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_failure_decision("workspace-1", "task-1")
        .expect("latest failure")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_worker_evidence_bundle("workspace-1", "task-1")
        .expect("latest evidence")
        .is_none());
}

#[test]
fn record_runner_report_merges_minimal_slot_bindings_without_erasing_backend_refs() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "run_start",
        Some("start_worker_ready"),
        None,
        Some(
            r#"{"upstream":{"slot":"upstream","taskId":"task-1","taskSpecHash":"task-hash","dependencySpecHash":"dep-hash","dependencyEdgeHash":"edge-hash","dependsOnSlots":[],"dependencyTaskIds":[],"settingsHash":"settings-hash","runSettings":{"executionWorkspace":"C:/workspace/project","codexExecutable":"codex","sandbox":"workspace_write","approvalPolicy":"never","executionPolicy":"manual","executorWidgetId":"executor-1"},"executorWidgetId":"executor-1","promoted":true,"promotedTaskStatus":"queued","updateRunSettingsActionId":"action-settings","updateRunSettingsActionIdempotencyKey":"settings-key","promoteActionId":"action-promote","promoteActionIdempotencyKey":"promote-key"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);
    let mut request = runner_report_request("workspace-1", "workflow-run-1");
    request.slot_bindings = Some(json!({"upstream": {"taskId": "task-1", "runId": "run-1"}}));

    let result = service
        .record_queue_workflow_runner_report(request)
        .expect("record report");
    let workflow_run = result.workflow_run.expect("workflow run");
    let slot_bindings: Value = serde_json::from_str(
        workflow_run
            .slot_bindings_json
            .as_deref()
            .expect("slot bindings"),
    )
    .expect("slot bindings json");

    assert_eq!(
        result.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(slot_bindings["upstream"]["taskSpecHash"], "task-hash");
    assert_eq!(slot_bindings["upstream"]["dependencyEdgeHash"], "edge-hash");
    assert_eq!(slot_bindings["upstream"]["settingsHash"], "settings-hash");
    assert_eq!(
        slot_bindings["upstream"]["runSettings"]["executorWidgetId"],
        "executor-1"
    );
    assert_eq!(slot_bindings["upstream"]["promoted"], true);
    assert_eq!(
        slot_bindings["upstream"]["promoteActionId"],
        "action-promote"
    );
    assert_eq!(slot_bindings["upstream"]["runId"], "run-1");
}

#[test]
fn record_runner_report_rejects_conflicting_authoritative_slot_binding_refs() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "setup",
        Some("waiting_for_promote"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","settingsHash":"settings-hash"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);
    let mut request = runner_report_request("workspace-1", "workflow-run-1");
    request.slot_bindings =
        Some(json!({"upstream": {"taskId": "task-1", "settingsHash": "changed"}}));

    let result = service
        .record_queue_workflow_runner_report(request)
        .expect("record conflicting report");

    assert_eq!(
        result.status,
        QueueWorkflowRecordRunnerReportStatus::Conflict
    );
    assert_eq!(
        result.conflict.expect("conflict").conflict_code,
        "workflow_slot_binding_conflict"
    );
}

#[test]
fn record_runner_report_action_ledger_is_idempotent_and_conflicts_on_changed_refs() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");
    let mut request = runner_report_request("workspace-1", &workflow_run.workflow_run_id);
    request.slot_bindings = None;

    let first = service
        .record_queue_workflow_runner_report(request.clone())
        .expect("record first");
    let duplicate = service
        .record_queue_workflow_runner_report(request.clone())
        .expect("record duplicate");
    let mut changed = request;
    changed.actions[0].target_refs = Some(json!({"taskId": "changed"}));
    let conflict = service
        .record_queue_workflow_runner_report(changed)
        .expect("record conflict");

    assert_eq!(
        first.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(
        duplicate.status,
        QueueWorkflowRecordRunnerReportStatus::Recorded
    );
    assert_eq!(duplicate.actions.len(), 1);
    assert_eq!(
        conflict.status,
        QueueWorkflowRecordRunnerReportStatus::Conflict
    );
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "workflow_action_idempotency_conflict"
    );
}

#[test]
fn record_runner_report_rejects_confirmation_token_and_oversized_json() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    let workflow_run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");
    let mut token_request = runner_report_request("workspace-1", &workflow_run.workflow_run_id);
    token_request.action_log_summary = Some(json!({"confirmationToken": "operator-confirmed"}));
    let mut oversized_request = runner_report_request("workspace-1", &workflow_run.workflow_run_id);
    oversized_request.action_log_summary = Some(Value::String(
        "x".repeat(MAX_WORKFLOW_ACTION_LOG_SUMMARY_JSON_BYTES + 1),
    ));

    let token_result = service
        .record_queue_workflow_runner_report(token_request)
        .expect("record token");
    let oversized_result = service
        .record_queue_workflow_runner_report(oversized_request)
        .expect("record oversized");

    assert_eq!(
        token_result.status,
        QueueWorkflowRecordRunnerReportStatus::InvalidInput
    );
    assert_eq!(
        token_result.blocker.expect("token blocker").blocker_code,
        "confirmation_token_not_persistable"
    );
    assert_eq!(
        oversized_result.status,
        QueueWorkflowRecordRunnerReportStatus::InvalidInput
    );
    assert_eq!(
        oversized_result
            .blocker
            .expect("oversized blocker")
            .blocker_code,
        "workflow_json_too_large"
    );
}

#[test]
fn record_runner_report_is_workspace_scoped() {
    let service = initialized_service();
    create_workspace(&service, "workspace-1");
    create_workspace(&service, "workspace-2");
    let workflow_run = service
        .start_queue_workflow(start_request("workspace-1", "request-1"))
        .expect("start workflow")
        .workflow_run
        .expect("workflow run");

    let result = service
        .record_queue_workflow_runner_report(runner_report_request(
            "workspace-2",
            &workflow_run.workflow_run_id,
        ))
        .expect("record cross workspace");

    assert_eq!(
        result.status,
        QueueWorkflowRecordRunnerReportStatus::NotFound
    );
}

#[test]
fn plan_resume_reports_terminal_workflow_run_statuses() {
    for (status, expected) in [
        (
            "completed",
            QueueWorkflowResumePlanStatus::TerminalCompleted,
        ),
        ("failed", QueueWorkflowResumePlanStatus::TerminalFailed),
        (
            "cancelled",
            QueueWorkflowResumePlanStatus::TerminalCancelled,
        ),
    ] {
        let store = initialized_store();
        create_workspace_in_store(&store, "workspace-1");
        insert_resume_workflow(
            &store,
            "workflow-run-1",
            "dependency_acceptance_smoke",
            status,
            "closed",
            None,
            None,
            None,
            None,
            Some("1"),
        );
        let service = WorkspaceService::new(store);

        let plan = service
            .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
            .expect("plan resume")
            .expect("plan");

        assert_eq!(plan.status, expected);
        assert!(!plan.resume_available);
        assert_eq!(plan.terminal_status.as_deref(), Some(status));
    }
}

#[test]
fn plan_resume_created_workflow_without_slots_waits_for_explicit_task_creation() {
    let store = initialized_store();
    create_workspace_in_store(&store, "workspace-1");
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "created",
        "intake",
        Some("created"),
        Some(r#"{"operatorText":"task-1 is mentioned only as prose"}"#),
        None,
        None,
        Some("1"),
    );
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
    );
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_task_creation_phase")
    );
    assert!(
        plan.slot_reconciliations.is_empty(),
        "planner must not infer task ids from prose-only inputs"
    );
    assert_eq!(
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list tasks")
            .len(),
        1,
        "planning must not create or mutate Queue tasks"
    );
}

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
        super::agent_queue_workflow_materialization::normalize_queue_workflow_task_spec_for_hash(
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
fn plan_resume_recovers_backend_queue_local_start_worker_missing_slot_refs() {
    let store = initialized_store();
    store
        .create_workspace("workspace-1", "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
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
        "executionTargetHash": execution_target_hash,
        "settingsHash": settings_hash,
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
}

#[test]
fn record_workflow_worker_evidence_records_upstream_and_stops_before_review() {
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
        "workflow-run-evidence",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","executorWidgetId":"executor-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("record workflow evidence");

    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Recorded
    );
    let binding = result.binding.expect("binding");
    assert_eq!(binding.slot, "upstream");
    assert_eq!(binding.task_id, "task-1");
    assert_eq!(binding.run_id, "run-1");
    assert!(!binding.evidence_bundle_id.is_empty());
    assert_eq!(
        binding.evidence_action_idempotency_key,
        "workflow-run-evidence:record_worker_evidence:upstream:task-1:run-1"
    );
    let workflow_run = result.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "worker_evidence");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
    assert_eq!(
        workflow_run.pause_reason.as_deref(),
        Some("awaiting_review")
    );
    let slot_bindings: Value =
        serde_json::from_str(workflow_run.slot_bindings_json.as_deref().unwrap())
            .expect("slot bindings json");
    assert_eq!(
        slot_bindings["upstream"]["evidenceBundleId"].as_str(),
        Some(binding.evidence_bundle_id.as_str())
    );

    let actions = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", "workflow-run-evidence")
        .expect("workflow actions");
    assert_eq!(actions.len(), 1);
    assert_eq!(actions[0].action_type, "record_worker_evidence");
    assert_eq!(
        actions[0].idempotency_key,
        "workflow-run-evidence:record_worker_evidence:upstream:task-1:run-1"
    );
    assert!(service
        .store
        .list_agent_queue_review_messages("workspace-1", "task-1")
        .expect("review messages")
        .is_empty());
    assert!(service
        .store
        .get_latest_agent_queue_completion_decision("workspace-1", "task-1")
        .expect("completion decision")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_failure_decision("workspace-1", "task-1")
        .expect("failure decision")
        .is_none());
}

#[test]
fn record_workflow_worker_evidence_is_idempotent_for_same_task_run() {
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
        "workflow-run-evidence",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let first = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("first evidence");
    let second = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("second evidence");

    assert_eq!(
        second.status,
        QueueWorkflowRecordWorkerEvidenceStatus::AlreadyRecorded
    );
    assert_eq!(
        first.binding.unwrap().evidence_bundle_id,
        second.binding.unwrap().evidence_bundle_id
    );
    assert_eq!(
        service
            .store
            .list_agent_queue_workflow_actions("workspace-1", "workflow-run-evidence")
            .expect("actions")
            .len(),
        1
    );
}

#[test]
fn record_workflow_worker_evidence_reconciles_existing_matching_evidence() {
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
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-existing",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("reconcile evidence");

    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::AlreadyRecorded
    );
    assert_eq!(
        result.binding.unwrap().evidence_bundle_id,
        "bundle-existing"
    );
}

#[test]
fn record_workflow_worker_evidence_blocks_missing_bindings_and_running_worker() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "running",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-ambiguous",
        "link-ambiguous",
        "queued",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-missing-run",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-running",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-ambiguous",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-ambiguous"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let missing_run = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-missing-run",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("missing run binding");
    let running = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-running",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("running worker");
    let ambiguous = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-ambiguous",
            "upstream",
            "task-1",
            "run-ambiguous",
            "completed",
        ))
        .expect("ambiguous worker");

    assert_eq!(
        missing_run.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        missing_run.blocker.unwrap().blocker_code,
        "missing_run_binding"
    );
    assert_eq!(
        running.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(running.blocker.unwrap().blocker_code, "worker_not_complete");
    assert_eq!(
        ambiguous.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        ambiguous.blocker.unwrap().blocker_code,
        "ambiguous_worker_state"
    );
}

#[test]
fn record_workflow_worker_evidence_rejects_task_run_and_metadata_conflicts() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-2", "queued", true, None);
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
        "bundle-existing",
        "failed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-task-mismatch",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-2"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence-conflict",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(r#"{"upstream":{"taskId":"task-2","runId":"run-2"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let task_mismatch = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-task-mismatch",
            "upstream",
            "task-1",
            "run-2",
            "completed",
        ))
        .expect("task mismatch");
    let metadata_conflict = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence-conflict",
            "upstream",
            "task-2",
            "run-2",
            "completed",
        ))
        .expect("metadata conflict");

    assert_eq!(
        task_mismatch.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        task_mismatch.conflict.unwrap().conflict_code,
        "run_task_mismatch"
    );
    assert_eq!(
        metadata_conflict.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        metadata_conflict.conflict.unwrap().conflict_code,
        "evidence_metadata_conflict"
    );
}

#[test]
fn plan_resume_moves_from_evidence_to_review_create_or_ack() {
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
        "review_needed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
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
    create_review_message(
        &store,
        "workspace-1",
        "task-2",
        "run-2",
        "link-2",
        "message-2",
        "created",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-review-create",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1"}}"#),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-review-ack",
        "dependency_acceptance_smoke",
        "running",
        "review",
        Some("review"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-2","runId":"run-2","evidenceBundleId":"bundle-2","messageId":"message-2"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let create_plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-review-create",
            None,
        ))
        .expect("plan review create")
        .expect("plan");
    let ack_plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-review-ack", None))
        .expect("plan review ack")
        .expect("plan");

    assert_eq!(
        create_plan.status,
        QueueWorkflowResumePlanStatus::ResumeReady
    );
    assert_eq!(
        create_plan.next_step.as_deref(),
        Some("review_create_ready")
    );
    assert!(create_plan.required_fresh_grant);
    assert!(!create_plan.required_confirmation);
    assert_eq!(
        ack_plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingReviewAck
    );
    assert_eq!(ack_plan.next_step.as_deref(), Some("review_ack_ready"));
    assert!(ack_plan.required_fresh_grant);
    assert!(!ack_plan.required_confirmation);
}

#[test]
fn plan_resume_after_ack_requires_fresh_confirmation_for_finalization() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
        "completed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "message-1",
        "acknowledged",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "decision",
        Some("decision"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1","messageId":"message-1"}}"#,
        ),
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
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(plan.next_step.as_deref(), Some("mark_done_ready"));
    assert!(plan.required_fresh_grant);
    assert!(plan.required_confirmation);
    assert!(plan
        .report_summary
        .contains("No workflow steps were executed"));
}

#[test]
fn plan_resume_recognizes_idempotent_completion_and_failure_decisions() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-done", "queued", true, None);
    create_task_row(&store, "workspace-1", "task-failed", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "review_needed",
    );
    create_run_link(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "bundle-done",
        "completed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "bundle-failed",
        "failed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "message-done",
        "acknowledged",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "message-failed",
        "acknowledged",
    );
    create_completion_decision(
        &store,
        "workspace-1",
        "task-done",
        "run-done",
        "link-done",
        "message-done",
        "completion-1",
    );
    create_failure_decision(
        &store,
        "workspace-1",
        "task-failed",
        "run-failed",
        "link-failed",
        "bundle-failed",
        "message-failed",
        "failure-1",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-done",
        "dependency_acceptance_smoke",
        "running",
        "decision",
        Some("decision"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-done","runId":"run-done","evidenceBundleId":"bundle-done","messageId":"message-done","completionDecisionId":"completion-1"}}"#,
        ),
        None,
        Some("1"),
    );
    insert_resume_workflow(
        &store,
        "workflow-run-failed",
        "dependency_failure_smoke",
        "running",
        "decision",
        Some("decision"),
        Some(r#"{"failureReason":"Rejected by operator"}"#),
        Some(
            r#"{"upstream":{"taskId":"task-failed","runId":"run-failed","evidenceBundleId":"bundle-failed","messageId":"message-failed","failureDecisionId":"failure-1"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let done = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-done", None))
        .expect("plan done")
        .expect("plan");
    let failed = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-failed", None))
        .expect("plan failed")
        .expect("plan");

    assert_eq!(
        done.status,
        QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
    );
    assert_eq!(
        done.next_step.as_deref(),
        Some("completed_idempotent_acceptance")
    );
    assert_eq!(
        failed.status,
        QueueWorkflowResumePlanStatus::ResumeReadOnlyReady
    );
    assert_eq!(
        failed.next_step.as_deref(),
        Some("completed_idempotent_failure")
    );
}

#[test]
fn plan_resume_blocks_stale_grant_and_expected_version_conflict() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
        "completed",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "message-1",
        "acknowledged",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-1",
        "dependency_acceptance_smoke",
        "running",
        "decision",
        Some("decision"),
        None,
        Some(
            r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1","messageId":"message-1"}}"#,
        ),
        Some(
            r#"{"expiresAt":"expired","scope":{"taskIds":["task-1"],"runIds":["run-1"],"evidenceBundleIds":["bundle-1"],"messageIds":["message-1"]}}"#,
        ),
        Some("3"),
    );
    let service = WorkspaceService::new(store);

    let stale = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan stale")
        .expect("plan");
    let version_conflict = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", Some(2)))
        .expect("plan version")
        .expect("plan");

    assert_eq!(
        stale.status,
        QueueWorkflowResumePlanStatus::BlockedStaleGrant
    );
    assert!(stale
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "grant_expired"));
    assert_eq!(
        version_conflict.status,
        QueueWorkflowResumePlanStatus::VersionConflict
    );
}

#[test]
fn plan_resume_does_not_mutate_workflow_or_queue_facts() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "review_needed",
    );
    create_evidence(
        &store,
        "workspace-1",
        "task-1",
        "run-1",
        "link-1",
        "bundle-1",
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
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1"}}"#),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);
    let before_workflow = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-1".to_owned(),
        })
        .expect("get before")
        .expect("workflow");
    let before_task_count = service
        .list_agent_queue_tasks("workspace-1")
        .expect("list before")
        .len();

    let plan = service
        .plan_queue_workflow_resume(plan_request("workspace-1", "workflow-run-1", None))
        .expect("plan")
        .expect("plan");
    let after_workflow = service
        .get_queue_workflow_run(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-1".to_owned(),
        })
        .expect("get after")
        .expect("workflow");
    let review_messages = service
        .store
        .list_agent_queue_review_messages("workspace-1", "task-1")
        .expect("list review messages");

    assert_eq!(plan.next_step.as_deref(), Some("review_create_ready"));
    assert_eq!(before_workflow.version, after_workflow.version);
    assert_eq!(
        before_task_count,
        service
            .list_agent_queue_tasks("workspace-1")
            .expect("list after")
            .len()
    );
    assert!(
        review_messages.is_empty(),
        "planning must not create review messages"
    );
}

fn plan_request(
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

fn start_materialization_workflow(
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

fn materialize_request(
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

fn initialized_service_with_executor() -> WorkspaceService {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    WorkspaceService::new(store)
}

fn workflow_run_settings(executor_widget_id: &str) -> QueueWorkflowRunSettings {
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

fn queue_local_workflow_run_settings(queue_widget_id: &str) -> QueueWorkflowRunSettings {
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

fn run_settings_request(
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

fn promote_request(
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

fn assert_no_queue_workflow_side_effects(
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

fn runner_report_request(
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

fn insert_resume_workflow(
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

fn create_workspace_with_executor(
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

fn create_workspace_with_queue(
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

fn insert_executor_widget(
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

fn insert_queue_widget(
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

fn create_task_row(
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

fn create_run_link(
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

fn create_evidence(
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

fn create_review_message(
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

fn create_completion_decision(
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

fn create_failure_decision(
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
