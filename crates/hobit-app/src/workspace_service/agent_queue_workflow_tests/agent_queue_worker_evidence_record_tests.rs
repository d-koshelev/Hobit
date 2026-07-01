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
fn retryable_failed_worker_evidence_reenters_and_records_completed_evidence() {
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
        "workflow-run-retryable-evidence-record",
        "failed",
        "worker_evidence_failed_unexpected",
        "task-1",
        "run-1",
    );
    let service = WorkspaceService::new(store);

    let result = service
        .record_queue_workflow_worker_evidence(workflow_evidence_request(
            "workflow-run-retryable-evidence-record",
            "upstream",
            "task-1",
            "run-1",
            "completed",
        ))
        .expect("record retryable failed evidence");

    assert_eq!(
        result.status,
        QueueWorkflowRecordWorkerEvidenceStatus::Recorded
    );
    let workflow_run = result.workflow_run.expect("workflow run");
    assert_eq!(workflow_run.status, "paused");
    assert_eq!(workflow_run.phase, "worker_evidence");
    assert_eq!(
        workflow_run.current_step.as_deref(),
        Some("awaiting_review")
    );
    assert_eq!(workflow_run.blocker_reason, None);
    assert_eq!(workflow_run.completed_at, None);
    let binding = result.binding.expect("binding");
    assert!(!binding.evidence_bundle_id.is_empty());
    let report = service
        .get_queue_workflow_report(QueueWorkflowGetRequest {
            workspace_id: "workspace-1".to_owned(),
            workflow_run_id: "workflow-run-retryable-evidence-record".to_owned(),
        })
        .expect("get report")
        .expect("report");
    assert!(report
        .workflow_run
        .slot_bindings_json
        .as_deref()
        .is_some_and(|json| json.contains(&binding.evidence_bundle_id)));
    let action_log = service
        .store
        .list_agent_queue_workflow_actions("workspace-1", "workflow-run-retryable-evidence-record")
        .expect("action log");
    let evidence_action = action_log
        .iter()
        .find(|action| action.action_type == "record_worker_evidence")
        .expect("record evidence action");
    assert_eq!(
        evidence_action.status,
        QueueWorkflowActionStatus::Completed.as_str()
    );
    assert!(evidence_action
        .result_refs_json
        .as_deref()
        .is_some_and(|refs| refs.contains("evidenceBundleId")));
    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-retryable-evidence-record",
            None,
        ))
        .expect("plan after evidence")
        .expect("plan");
    assert_eq!(plan.next_phase.as_deref(), Some("review"));
    assert_eq!(plan.next_step.as_deref(), Some("review_create_ready"));
    assert!(!plan.blockers.iter().any(|blocker| blocker.blocker_code
        == "retryable_worker_evidence_failure"
        || blocker.blocker_code == "retryable_worker_evidence_action_repair"));
    assert!(service
        .store
        .list_agent_queue_review_messages("workspace-1", "task-1")
        .expect("review messages")
        .is_empty());
}
