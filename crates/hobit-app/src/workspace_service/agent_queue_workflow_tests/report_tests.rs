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
