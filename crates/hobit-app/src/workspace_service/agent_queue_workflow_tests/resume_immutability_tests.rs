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
