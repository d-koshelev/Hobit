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
