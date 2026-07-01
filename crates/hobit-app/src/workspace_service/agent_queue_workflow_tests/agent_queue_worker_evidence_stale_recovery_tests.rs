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
fn current_live_blocked_terminal_guard_shape_reenters_and_updates_evidence_action() {
    let store = initialized_store();
    create_workspace_with_executor(&store, "workspace-1", "workbench-1", "executor-1");
    create_task_row(
        &store,
        "workspace-1",
        "queue_task_wf_44a095e817b585b5",
        "queued",
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
    create_run_link(
        &store,
        "workspace-1",
        "queue_task_wf_44a095e817b585b5",
        "queue-run_1782257290066506600_169",
        "queue-run-link-live-failure",
        "completed",
    );
    insert_retryable_worker_evidence_workflow(
        &store,
        "queue-workflow-run-1782257290023621100_163",
        "blocked",
        "worker_evidence_blocked",
        "queue_task_wf_44a095e817b585b5",
        "queue-run_1782257290066506600_169",
    );
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "record-worker-evidence-live-incomplete-refs",
            workflow_run_id: "queue-workflow-run-1782257290023621100_163",
            workspace_id: "workspace-1",
            step_id: "record_worker_evidence",
            action_type: "record_worker_evidence",
            idempotency_key:
                "queue-workflow-run-1782257290023621100_163:record_worker_evidence:upstream:queue_task_wf_44a095e817b585b5:queue-run_1782257290066506600_169",
            status: QueueWorkflowActionStatus::Blocked.as_str(),
            target_refs_json: Some(r#"{"workflowRunId":"queue-workflow-run-1782257290023621100_163"}"#),
            result_refs_json: Some(r#"{"commandStatus":"blocked"}"#),
            blocker_code: Some("incomplete_workflow_action_refs"),
            blocker_message: Some(
                "Workflow action refs are incomplete; worker evidence cannot be recorded yet.",
            ),
            attempt_count: 1,
            started_at: Some("5"),
            completed_at: None,
            created_at: Some("5"),
            updated_at: Some("5"),
        })
        .expect("insert stale incomplete record_worker_evidence action");
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "queue-workflow-run-1782257290023621100_163",
            None,
        ))
        .expect("plan live blocked evidence retry")
        .expect("plan");
    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::RetryableWorkerEvidenceActionRepair
    );
    assert_eq!(plan.next_phase.as_deref(), Some("worker_evidence"));
    assert_eq!(
        plan.next_step.as_deref(),
        Some("waiting_for_worker_evidence")
    );
    assert!(!plan
        .blockers
        .iter()
        .any(|blocker| blocker.blocker_code == "incomplete_workflow_action_refs"));
    assert!(plan.blockers.iter().any(|blocker| {
        blocker.blocker_code == "retryable_worker_evidence_action_repair"
            && blocker.missing_required_field.as_deref() == Some("workerEvidence")
    }));

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "queue-workflow-run-1782257290023621100_163",
            "upstream",
            "queue_task_wf_44a095e817b585b5",
            "queue-run_1782257290066506600_169",
            "completed",
        ))
        .expect("record live blocked evidence");

    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Recorded
    );
    let workflow_run = result.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
    assert_eq!(workflow_run.blocker_reason, None);
    let action = service
        .store
        .get_agent_queue_workflow_action_by_idempotency_key(
            "queue-workflow-run-1782257290023621100_163",
            "queue-workflow-run-1782257290023621100_163:record_worker_evidence:upstream:queue_task_wf_44a095e817b585b5:queue-run_1782257290066506600_169",
        )
        .expect("action lookup")
        .expect("action");
    assert_eq!(action.status, QueueWorkflowActionStatus::Completed.as_str());
    assert_eq!(action.blocker_code, None);
    assert_eq!(action.attempt_count, 2);
    assert!(action
        .result_refs_json
        .as_deref()
        .is_some_and(|refs| refs.contains("evidenceBundleId")));
    assert!(action.target_refs_json.as_deref().is_some_and(|refs| {
        refs.contains(r#""taskId":"queue_task_wf_44a095e817b585b5""#)
            && refs.contains(r#""runId":"queue-run_1782257290066506600_169""#)
            && refs.contains(r#""settingsHash":"#)
            && refs.contains(r#""executionTargetHash":"#)
    }));
    let downstream = service
        .store
        .get_agent_queue_task("workspace-1", "queue_task_wf_50bf4534e054bec3")
        .expect("get downstream")
        .expect("downstream");
    assert_eq!(downstream.status, "draft");
    let plan_after_repair = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "queue-workflow-run-1782257290023621100_163",
            None,
        ))
        .expect("plan after repair")
        .expect("plan");
    assert_eq!(plan_after_repair.next_phase.as_deref(), Some("review"));
    assert_eq!(
        plan_after_repair.next_step.as_deref(),
        Some("review_create_ready")
    );
    assert!(!plan_after_repair.blockers.iter().any(|blocker| {
        blocker.blocker_code == "incomplete_workflow_action_refs"
            || blocker.blocker_code == "retryable_worker_evidence_action_repair"
    }));
}

#[test]
fn plan_resume_ignores_stale_non_mutating_record_worker_evidence_history() {
    for (workflow_run_id, stale_status, blocker_code, result_refs_json) in [
        (
            "workflow-run-stale-blocked-evidence",
            QueueWorkflowActionStatus::Blocked.as_str(),
            "precondition_failed",
            r#"{"commandStatus":"precondition_failed"}"#,
        ),
        (
            "workflow-run-stale-failed-evidence",
            QueueWorkflowActionStatus::Failed.as_str(),
            "failed_unexpected",
            r#"{"commandStatus":"failed_unexpected"}"#,
        ),
    ] {
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
        insert_retryable_worker_evidence_workflow(
            &store,
            workflow_run_id,
            "blocked",
            "worker_evidence_blocked",
            "task-1",
            "run-1",
        );
        store
            .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
                action_id: &format!("stale-record-evidence-{workflow_run_id}"),
                workflow_run_id,
                workspace_id: "workspace-1",
                step_id: "record_worker_evidence",
                action_type: "record_worker_evidence",
                idempotency_key: &format!(
                    "{workflow_run_id}:record_worker_evidence:upstream:task-1:run-1"
                ),
                status: stale_status,
                target_refs_json: None,
                result_refs_json: Some(result_refs_json),
                blocker_code: Some(blocker_code),
                blocker_message: Some("Stale non-mutating worker evidence attempt."),
                attempt_count: 1,
                started_at: Some("5"),
                completed_at: Some("5"),
                created_at: Some("5"),
                updated_at: Some("5"),
            })
            .expect("insert stale record_worker_evidence action");
        let service = WorkspaceService::new(store);

        let plan = service
            .plan_queue_workflow_resume(plan_request("workspace-1", workflow_run_id, None))
            .expect("plan stale evidence retry")
            .expect("plan");

        assert_eq!(
            plan.status,
            QueueWorkflowResumePlanStatus::RetryableWorkerEvidenceActionRepair
        );
        assert_eq!(plan.next_phase.as_deref(), Some("worker_evidence"));
        assert_eq!(
            plan.next_step.as_deref(),
            Some("waiting_for_worker_evidence")
        );
        assert!(plan
            .blockers
            .iter()
            .all(|blocker| blocker.blocker_code != "incomplete_workflow_action_refs"));
        assert!(service
            .store
            .get_agent_queue_worker_evidence_bundle("workspace-1", "task-1", "run-1")
            .expect("evidence lookup before retry")
            .is_none());

        let evidence = service
            .record_queue_workflow_worker_evidence(workflow_evidence_request(
                workflow_run_id,
                "upstream",
                "task-1",
                "run-1",
                "completed",
            ))
            .expect("record corrected evidence");

        assert_eq!(
            evidence.status,
            QueueWorkflowRecordWorkerEvidenceStatus::Recorded
        );
        let action = service
            .store
            .get_agent_queue_workflow_action_by_idempotency_key(
                workflow_run_id,
                &format!("{workflow_run_id}:record_worker_evidence:upstream:task-1:run-1"),
            )
            .expect("action lookup")
            .expect("action");
        assert_eq!(action.status, QueueWorkflowActionStatus::Completed.as_str());
        assert_eq!(action.blocker_code, None);
        assert_eq!(action.blocker_message, None);
        assert_eq!(action.attempt_count, 2);
        assert!(action.target_refs_json.as_deref().is_some_and(|refs| refs
            .contains(r#""taskId":"task-1""#)
            && refs.contains(r#""runId":"run-1""#)));
        assert!(action
            .result_refs_json
            .as_deref()
            .is_some_and(|refs| refs.contains("evidenceBundleId")));
    }
}

#[test]
fn terminal_completed_and_cancelled_workflows_cannot_reenter_worker_evidence() {
    for (status, workflow_run_id) in [
        ("completed", "workflow-run-completed"),
        ("cancelled", "workflow-run-cancelled"),
    ] {
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
        insert_retryable_worker_evidence_workflow(
            &store,
            workflow_run_id,
            status,
            "worker_evidence_failed_unexpected",
            "task-1",
            "run-1",
        );
        let service = WorkspaceService::new(store);

        let result = service
            .record_queue_workflow_worker_evidence(workflow_evidence_request(
                workflow_run_id,
                "upstream",
                "task-1",
                "run-1",
                "completed",
            ))
            .expect("record terminal evidence");

        assert_eq!(
            result.status,
            QueueWorkflowRecordWorkerEvidenceStatus::Blocked
        );
        assert_eq!(
            result.blocker.expect("blocker").blocker_code,
            "workflow_run_terminal"
        );
        assert!(service
            .store
            .get_agent_queue_worker_evidence_bundle("workspace-1", "task-1", "run-1")
            .expect("evidence lookup")
            .is_none());
    }
}

#[test]
fn arbitrary_failed_workflow_cannot_reenter_worker_evidence() {
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
        "workflow-run-arbitrary-failed-evidence",
        "dependency_failure_smoke",
        "failed",
        "review",
        Some("review_failed_unexpected"),
        Some(r#"{"tasks":[{"slot":"upstream","title":"Task","prompt":"Prompt"}]}"#),
        Some(
            r#"{"upstream":{"executionTargetHash":"execution-target-hash-1","settingsHash":"settings-hash-1","taskId":"task-1","runId":"run-1"}}"#,
        ),
        Some(r#"{"constraints":{"noDownstreamAutoStart":true}}"#),
        Some("1"),
    );
    insert_completed_start_worker_action(
        &store,
        "workflow-run-arbitrary-failed-evidence",
        "start-worker-arbitrary",
        "task-1",
        Some("upstream"),
        "run-1",
    );
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-arbitrary-failed-evidence",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("arbitrary failed record");

    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Blocked
    );
    assert_eq!(
        result.blocker.expect("blocker").blocker_code,
        "worker_evidence_reentry_not_retryable"
    );
}
