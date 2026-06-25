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
fn failed_worker_evidence_reentry_blocks_partial_evidence_review_and_decisions() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    for (task_id, run_id, link_id, workflow_run_id) in [
        (
            "task-evidence",
            "run-evidence",
            "link-evidence",
            "workflow-run-bound-evidence",
        ),
        (
            "task-action",
            "run-action",
            "link-action",
            "workflow-run-completed-action",
        ),
        (
            "task-review",
            "run-review",
            "link-review",
            "workflow-run-review-exists",
        ),
        (
            "task-decision",
            "run-decision",
            "link-decision",
            "workflow-run-decision-exists",
        ),
    ] {
        create_task_row(&store, "workspace-1", task_id, "queued", true, None);
        create_run_link(&store, "workspace-1", task_id, run_id, link_id, "completed");
        insert_retryable_worker_evidence_workflow(
            &store,
            workflow_run_id,
            "failed",
            "worker_evidence_failed_unexpected",
            task_id,
            run_id,
        );
    }
    create_evidence(
        &store,
        "workspace-1",
        "task-evidence",
        "run-evidence",
        "link-evidence",
        "bundle-evidence",
        "completed",
    );
    let evidence_binding = json!({
        "upstream": {
            "evidenceBundleId": "bundle-evidence",
            "executionTargetHash": "execution-target-hash-1",
            "executionTargetKind": "queue_local",
            "providerId": "codex",
            "runId": "run-evidence",
            "settingsHash": "settings-hash-1",
            "taskId": "task-evidence"
        }
    })
    .to_string();
    service_update_slot_bindings_for_test(&store, "workflow-run-bound-evidence", &evidence_binding);
    let target_refs = canonical_json_string(&json!({
        "runId": "run-action",
        "slot": "upstream",
        "taskId": "task-action",
        "workflowRunId": "workflow-run-completed-action"
    }));
    let result_refs = canonical_json_string(&json!({
        "evidenceBundleId": "bundle-action",
        "evidenceStatus": "available",
        "outcome": "completed",
        "runId": "run-action",
        "workerFinalStatus": "completed"
    }));
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "record-worker-evidence-completed-action",
            workflow_run_id: "workflow-run-completed-action",
            workspace_id: "workspace-1",
            step_id: "record_worker_evidence",
            action_type: "record_worker_evidence",
            idempotency_key:
                "workflow-run-completed-action:record_worker_evidence:upstream:task-action:run-action",
            status: QueueWorkflowActionStatus::Completed.as_str(),
            target_refs_json: Some(&target_refs),
            result_refs_json: Some(&result_refs),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("5"),
            completed_at: Some("5"),
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert completed record action");
    create_review_message(
        &store,
        "workspace-1",
        "task-review",
        "run-review",
        "link-review",
        "message-review",
        "created",
    );
    create_review_message(
        &store,
        "workspace-1",
        "task-decision",
        "run-decision",
        "link-decision",
        "message-decision",
        "acknowledged",
    );
    create_completion_decision(
        &store,
        "workspace-1",
        "task-decision",
        "run-decision",
        "link-decision",
        "message-decision",
        "decision-completed",
    );
    let service = WorkspaceService::new(store);

    let completed_action_plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-completed-action",
            None,
        ))
        .expect("plan completed evidence action")
        .expect("plan");
    assert_eq!(
        completed_action_plan.status,
        QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs
    );
    assert!(completed_action_plan.resume_available);
    assert_eq!(
        completed_action_plan.blockers[0].blocker_code,
        "completed_evidence_action_incomplete"
    );

    for (workflow_run_id, task_id, run_id, expected) in [
        (
            "workflow-run-bound-evidence",
            "task-evidence",
            "run-evidence",
            "worker_evidence_already_bound",
        ),
        (
            "workflow-run-completed-action",
            "task-action",
            "run-action",
            "completed_evidence_action_incomplete",
        ),
        (
            "workflow-run-review-exists",
            "task-review",
            "run-review",
            "review_already_exists",
        ),
        (
            "workflow-run-decision-exists",
            "task-decision",
            "run-decision",
            "terminal_decision_exists",
        ),
    ] {
        let result = service
            .record_queue_workflow_worker_evidence(workflow_evidence_request(
                workflow_run_id,
                "upstream",
                task_id,
                run_id,
                "completed",
            ))
            .expect("record partial-state evidence");
        assert_eq!(
            result.status,
            QueueWorkflowRecordWorkerEvidenceStatus::Blocked
        );
        assert_eq!(result.blocker.expect("blocker").blocker_code, expected);
    }
}

#[test]
fn failed_worker_evidence_reentry_blocks_unknown_evidence_mutation_state() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-unknown", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-unknown",
        "run-unknown",
        "link-unknown",
        "completed",
    );
    insert_retryable_worker_evidence_workflow(
        &store,
        "workflow-run-unknown-evidence-mutation",
        "blocked",
        "worker_evidence_blocked",
        "task-unknown",
        "run-unknown",
    );
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "record-worker-evidence-unknown-mutation",
            workflow_run_id: "workflow-run-unknown-evidence-mutation",
            workspace_id: "workspace-1",
            step_id: "record_worker_evidence",
            action_type: "record_worker_evidence",
            idempotency_key:
                "workflow-run-unknown-evidence-mutation:record_worker_evidence:upstream:task-unknown:run-unknown",
            status: QueueWorkflowActionStatus::Blocked.as_str(),
            target_refs_json: Some(
                r#"{"runId":"run-unknown","slot":"upstream","taskId":"task-unknown","workflowRunId":"workflow-run-unknown-evidence-mutation"}"#,
            ),
            result_refs_json: Some(r#"{"evidenceBundleId":"bundle-unknown"}"#),
            blocker_code: Some("incomplete_workflow_action_refs"),
            blocker_message: Some("Evidence mutation state is unknown."),
            attempt_count: 1,
            started_at: Some("5"),
            completed_at: None,
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert unknown evidence mutation action");
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-unknown-evidence-mutation",
            None,
        ))
        .expect("plan unknown mutation state")
        .expect("plan");
    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs
    );
    assert_eq!(
        plan.blockers[0].blocker_code,
        "evidence_mutation_state_unknown"
    );

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-unknown-evidence-mutation",
            "upstream",
            "task-unknown",
            "run-unknown",
            "completed",
        ))
        .expect("record unknown mutation evidence");
    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "evidence_mutation_state_unknown"
    );
    assert!(service
        .store
        .get_agent_queue_worker_evidence_bundle("workspace-1", "task-unknown", "run-unknown")
        .expect("evidence lookup")
        .is_none());
}

#[test]
fn failed_worker_evidence_reentry_blocks_conflicting_stale_action_refs() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(&store, "workspace-1", "task-conflict", "queued", true, None);
    create_run_link(
        &store,
        "workspace-1",
        "task-conflict",
        "run-conflict",
        "link-conflict",
        "completed",
    );
    insert_retryable_worker_evidence_workflow(
        &store,
        "workflow-run-conflicting-stale-action",
        "blocked",
        "worker_evidence_blocked",
        "task-conflict",
        "run-conflict",
    );
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "record-worker-evidence-conflicting-stale-action",
            workflow_run_id: "workflow-run-conflicting-stale-action",
            workspace_id: "workspace-1",
            step_id: "record_worker_evidence",
            action_type: "record_worker_evidence",
            idempotency_key:
                "workflow-run-conflicting-stale-action:record_worker_evidence:upstream:task-conflict:run-conflict",
            status: QueueWorkflowActionStatus::Blocked.as_str(),
            target_refs_json: Some(
                r#"{"runId":"run-other","slot":"upstream","taskId":"task-conflict","workflowRunId":"workflow-run-conflicting-stale-action"}"#,
            ),
            result_refs_json: Some(r#"{"commandStatus":"blocked"}"#),
            blocker_code: Some("incomplete_workflow_action_refs"),
            blocker_message: Some("Workflow action refs are incomplete."),
            attempt_count: 1,
            started_at: Some("5"),
            completed_at: None,
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert conflicting stale evidence action");
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-conflicting-stale-action",
            None,
        ))
        .expect("plan conflicting stale action")
        .expect("plan");
    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedIncompleteWorkflowActionRefs
    );
    assert_eq!(plan.blockers[0].blocker_code, "run_ref_mismatch");

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-conflicting-stale-action",
            "upstream",
            "task-conflict",
            "run-conflict",
            "completed",
        ))
        .expect("record conflicting stale evidence");
    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Conflict
    );
    assert_eq!(
        result.conflict.expect("conflict").conflict_code,
        "record_worker_evidence_action_ref_conflict"
    );
    assert!(service
        .store
        .get_agent_queue_worker_evidence_bundle("workspace-1", "task-conflict", "run-conflict")
        .expect("evidence lookup")
        .is_none());
}

#[test]
fn failed_worker_evidence_reentry_blocks_mismatched_running_and_orphan_workers() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    for (task_id, run_id, link_id, workflow_run_id, run_status) in [
        (
            "task-outcome",
            "run-outcome",
            "link-outcome",
            "workflow-run-outcome-mismatch",
            "completed",
        ),
        (
            "task-run-mismatch",
            "run-bound",
            "link-run-bound",
            "workflow-run-id-mismatch",
            "completed",
        ),
        (
            "task-running",
            "run-running",
            "link-running",
            "workflow-run-running-worker",
            "running",
        ),
    ] {
        create_task_row(&store, "workspace-1", task_id, "queued", true, None);
        create_run_link(&store, "workspace-1", task_id, run_id, link_id, run_status);
        insert_retryable_worker_evidence_workflow(
            &store,
            workflow_run_id,
            "failed",
            "worker_evidence_failed_unexpected",
            task_id,
            run_id,
        );
    }
    create_task_row(&store, "workspace-1", "task-orphan", "queued", true, None);
    insert_retryable_worker_evidence_workflow(
        &store,
        "workflow-run-orphan-worker",
        "failed",
        "worker_evidence_failed_unexpected",
        "task-orphan",
        "run-orphan",
    );
    let service = WorkspaceService::new(store);

    for (workflow_run_id, task_id, run_id, outcome, expected) in [
        (
            "workflow-run-outcome-mismatch",
            "task-outcome",
            "run-outcome",
            "failed",
            "worker_outcome_mismatch",
        ),
        (
            "workflow-run-id-mismatch",
            "task-run-mismatch",
            "run-requested",
            "completed",
            "run_id_mismatch",
        ),
        (
            "workflow-run-running-worker",
            "task-running",
            "run-running",
            "completed",
            "worker_run_not_complete",
        ),
        (
            "workflow-run-orphan-worker",
            "task-orphan",
            "run-orphan",
            "completed",
            "run_missing",
        ),
    ] {
        let result = service
            .record_queue_workflow_worker_evidence(workflow_evidence_request(
                workflow_run_id,
                "upstream",
                task_id,
                run_id,
                outcome,
            ))
            .expect("record unsafe worker evidence");
        assert_eq!(
            result.status,
            QueueWorkflowRecordWorkerEvidenceStatus::Blocked
        );
        assert_eq!(result.blocker.expect("blocker").blocker_code, expected);
        assert!(service
            .store
            .get_agent_queue_worker_evidence_bundle("workspace-1", task_id, run_id)
            .expect("evidence lookup")
            .is_none());
    }
}
