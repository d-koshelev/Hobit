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
