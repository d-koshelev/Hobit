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
fn plan_resume_failure_workflow_uses_failure_reason_after_completed_evidence() {
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
        "workflow-run-failure-finalization",
        "dependency_failure_smoke",
        "running",
        "decision",
        Some("decision"),
        Some(r#"{"failureReason":"Rejected after review"}"#),
        Some(
            r#"{"upstream":{"taskId":"task-1","runId":"run-1","evidenceBundleId":"bundle-1","messageId":"message-1"}}"#,
        ),
        None,
        Some("1"),
    );
    let service = WorkspaceService::new(store);

    let plan = service
        .plan_queue_workflow_resume(plan_request(
            "workspace-1",
            "workflow-run-failure-finalization",
            None,
        ))
        .expect("plan resume")
        .expect("plan");

    assert_eq!(
        plan.status,
        QueueWorkflowResumePlanStatus::BlockedMissingConfirmation
    );
    assert_eq!(plan.next_phase.as_deref(), Some("decision"));
    assert_eq!(plan.next_step.as_deref(), Some("fail_ready"));
    assert!(plan.required_fresh_grant);
    assert!(plan.required_confirmation);
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
