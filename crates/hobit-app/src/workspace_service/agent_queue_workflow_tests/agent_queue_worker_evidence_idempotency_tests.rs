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
fn record_workflow_worker_evidence_retries_blocked_mismatch_action() {
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
        Some("worker_evidence_blocked"),
        None,
        Some(r#"{"upstream":{"taskId":"task-1","runId":"run-1","executorWidgetId":"executor-1"}}"#),
        None,
        Some("1"),
    );
    let target_refs = canonical_json_string(&json!({
        "runId": "run-1",
        "slot": "upstream",
        "taskId": "task-1",
        "workflowRunId": "workflow-run-evidence"
    }));
    let result_refs = json!({
        "commandStatus": "blocked",
        "outcome": "failed",
        "status": "blocked_worker_outcome_mismatch"
    })
    .to_string();
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "workflow-action-record-worker-evidence",
            workflow_run_id: "workflow-run-evidence",
            workspace_id: "workspace-1",
            step_id: "record_worker_evidence",
            action_type: "record_worker_evidence",
            idempotency_key: "workflow-run-evidence:record_worker_evidence:upstream:task-1:run-1",
            status: QueueWorkflowActionStatus::Blocked.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: Some(&result_refs),
            blocker_code: Some("worker_outcome_mismatch"),
            blocker_message: Some("Worker evidence outcome did not match run status."),
            attempt_count: 1,
            started_at: Some("2"),
            completed_at: None,
            created_at: Some("2"),
            updated_at: Some("2"),
        })
        .expect("insert blocked record_worker_evidence action");
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-evidence",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("retry corrected evidence");

    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Recorded
    );
    let action = service
        .store
        .get_agent_queue_workflow_action_by_idempotency_key(
            "workflow-run-evidence",
            "workflow-run-evidence:record_worker_evidence:upstream:task-1:run-1",
        )
        .expect("action lookup")
        .expect("action");
    assert_eq!(action.status, QueueWorkflowActionStatus::Completed.as_str());
    assert_eq!(action.blocker_code, None);
    assert_eq!(action.blocker_message, None);
    assert!(action
        .result_refs_json
        .as_deref()
        .is_some_and(|refs| refs.contains("evidenceBundleId")));
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
fn worker_evidence_step_records_queue_local_run_without_widget_run() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_queue_local_run_link_without_widget_run(
        &store,
        "workspace-1",
        "task-1",
        "queue-local-run-1",
        "queue-local-link-1",
        "completed",
    );
    insert_resume_workflow(
        &store,
        "workflow-run-evidence-step",
        "dependency_acceptance_smoke",
        "paused",
        "worker_evidence",
        Some("awaiting_worker_completion"),
        None,
        Some(
            r#"{"upstream":{"executionTargetHash":"execution-target-hash-1","executionTargetKind":"queue_local","providerId":"codex","runId":"queue-local-run-1","settingsHash":"settings-hash-1","taskId":"task-1"}}"#,
        ),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-evidence-step",
        "start-worker-evidence-step",
        "task-1",
        Some("upstream"),
        "queue-local-run-1",
    );
    let service = WorkspaceService::new(store);

    assert!(service
        .store
        .get_widget_run("queue-local-run-1")
        .expect("widget run lookup")
        .is_none());
    let plan = service
        .plan_queue_workflow_worker_evidence_step(workflow_evidence_request(
            "workflow-run-evidence-step",
            "upstream",
            "task-1",
            "queue-local-run-1",
            "completed",
        ))
        .expect("plan worker evidence step");
    assert!(plan.executable);
    assert!(plan.safe_to_record_worker_evidence);
    assert_eq!(
        plan.idempotency_key.as_deref(),
        Some("workflow-run-evidence-step:record_worker_evidence:upstream:task-1:queue-local-run-1")
    );

    let result = service
        .execute_queue_workflow_worker_evidence_step(workflow_evidence_request(
            "workflow-run-evidence-step",
            "upstream",
            "task-1",
            "queue-local-run-1",
            "completed",
        ))
        .expect("execute worker evidence step");

    assert_eq!(
        result.status,
        QueueWorkflowWorkerEvidenceStepResultStatus::Executed
    );
    assert_eq!(result.next_phase.as_deref(), Some("review"));
    assert_eq!(result.next_step.as_deref(), Some("awaiting_review"));
    assert!(result.evidence_bundle.is_some());
    let workflow_run = result.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "worker_evidence");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
    let action = result.action.expect("action");
    assert_eq!(action.action_type, "record_worker_evidence");
    assert_eq!(action.status, QueueWorkflowActionStatus::Completed.as_str());
    assert!(action
        .result_refs_json
        .as_deref()
        .is_some_and(|refs| refs.contains("evidenceBundleId")));
    assert!(service
        .store
        .get_agent_queue_worker_evidence_bundle("workspace-1", "task-1", "queue-local-run-1")
        .expect("evidence lookup")
        .is_some());
    assert!(service
        .store
        .get_latest_agent_queue_review_message("workspace-1", "task-1")
        .expect("review lookup")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_completion_decision("workspace-1", "task-1")
        .expect("completion lookup")
        .is_none());
    assert!(service
        .store
        .get_latest_agent_queue_failure_decision("workspace-1", "task-1")
        .expect("failure lookup")
        .is_none());
}

#[test]
fn worker_evidence_step_repairs_clean_failed_runner_history() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-1", "queued", true, None);
    create_queue_local_run_link_without_widget_run(
        &store,
        "workspace-1",
        "task-1",
        "queue-local-run-clean-failure",
        "queue-local-link-clean-failure",
        "completed",
    );
    insert_retryable_worker_evidence_workflow(
        &store,
        "workflow-run-clean-failure",
        "failed",
        "worker_evidence_failed_unexpected",
        "task-1",
        "queue-local-run-clean-failure",
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-clean-failure",
            None,
        ))
        .expect("resume plan")
        .expect("resume plan");
    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::RetryableWorkerEvidenceFailure
    );
    assert_eq!(plan.next_phase.as_deref(), Some("worker_evidence"));
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_worker_evidence")
    );
    assert!(service
        .store
        .get_agent_queue_workflow_action_by_idempotency_key(
            "workflow-run-clean-failure",
            "workflow-run-clean-failure:record_worker_evidence:upstream:task-1:queue-local-run-clean-failure",
        )
        .expect("record action lookup before execute")
        .is_none());

    let result = service
        .execute_queue_workflow_worker_evidence_step(workflow_evidence_request(
            "workflow-run-clean-failure",
            "upstream",
            "task-1",
            "queue-local-run-clean-failure",
            "completed",
        ))
        .expect("execute clean failed worker evidence");

    assert_eq!(
        result.status,
        QueueWorkflowWorkerEvidenceStepResultStatus::Executed
    );
    assert_eq!(result.next_phase.as_deref(), Some("review"));
    let action = service
        .store
        .get_agent_queue_workflow_action_by_idempotency_key(
            "workflow-run-clean-failure",
            "workflow-run-clean-failure:record_worker_evidence:upstream:task-1:queue-local-run-clean-failure",
        )
        .expect("record action lookup after execute")
        .expect("record action");
    assert_eq!(action.status, QueueWorkflowActionStatus::Completed.as_str());
    assert_eq!(action.action_type, "record_worker_evidence");
    assert!(action
        .result_refs_json
        .as_deref()
        .is_some_and(|refs| refs.contains("evidenceBundleId")));
    let workflow_run = result.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
}
