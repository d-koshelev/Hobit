use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace_and_task(store: &SqliteStore) {
    store
        .create_workspace("workspace-1", "Incident", Some("Investigate"), "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Task",
            description: "",
            prompt: "Prompt",
            status: "review_needed",
            priority: 1,
            depends_on: None,
            execution_policy: Some("manual"),
            execution_workspace: Some("C:/workspace/project"),
            codex_executable: Some("codex"),
            sandbox: Some("workspace_write"),
            approval_policy: Some("never"),
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: "run-link-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            executor_widget_id: "queue-local-codex",
            direct_work_run_id: "queue-local-run-1",
            source: "queue_local",
            status: "completed",
            started_at: Some("2"),
            completed_at: Some("3"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("2"),
            updated_at: Some("3"),
        })
        .expect("insert queue-local run link");
    store
        .upsert_agent_queue_worker_evidence_bundle(NewAgentQueueWorkerEvidenceBundle {
            bundle_id: "evidence-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            run_id: "queue-local-run-1",
            run_link_id: Some("run-link-1"),
            executor_widget_id: None,
            worker_id: Some("workspace-agent"),
            source: "workspace_agent",
            outcome: "completed",
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
    store
        .insert_agent_queue_review_message(NewAgentQueueReviewMessage {
            message_id: "message-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            run_id: Some("queue-local-run-1"),
            run_link_id: Some("run-link-1"),
            actor_id: "workspace-agent",
            message_body: "Review worker evidence.",
            status: "acknowledged",
            created_at: Some("5"),
            acked_at: Some("6"),
            ack_actor_id: Some("workspace-agent"),
            metadata_json: None,
            updated_at: Some("6"),
        })
        .expect("insert review message");
}

#[test]
fn completion_and_failure_decisions_accept_queue_local_run_without_widget_run() {
    let completion_store = initialized_store();
    create_workspace_and_task(&completion_store);

    assert!(completion_store
        .get_widget_run("queue-local-run-1")
        .expect("widget run lookup")
        .is_none());
    let completion = completion_store
        .insert_agent_queue_completion_decision(NewAgentQueueCompletionDecision {
            decision_id: "completion-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            run_id: Some("queue-local-run-1"),
            run_link_id: Some("run-link-1"),
            review_message_id: Some("message-1"),
            actor_id: "workspace-agent",
            decision: "accepted",
            reason: Some("Accepted."),
            metadata_json: None,
            created_at: Some("7"),
        })
        .expect("insert completion decision without widget run");
    assert_eq!(completion.run_id.as_deref(), Some("queue-local-run-1"));

    let failure_store = initialized_store();
    create_workspace_and_task(&failure_store);

    assert!(failure_store
        .get_widget_run("queue-local-run-1")
        .expect("widget run lookup")
        .is_none());
    let failure = failure_store
        .insert_agent_queue_failure_decision(NewAgentQueueFailureDecision {
            decision_id: "failure-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            run_id: Some("queue-local-run-1"),
            run_link_id: Some("run-link-1"),
            evidence_bundle_id: Some("evidence-1"),
            review_message_id: Some("message-1"),
            actor_id: "workspace-agent",
            decision: "failed",
            reason: "Typed failure reason.",
            metadata_json: None,
            created_at: Some("7"),
        })
        .expect("insert failure decision without widget run");
    assert_eq!(failure.run_id.as_deref(), Some("queue-local-run-1"));
}
