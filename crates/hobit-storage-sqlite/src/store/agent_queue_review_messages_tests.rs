use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace_and_workbench(store: &SqliteStore) {
    store
        .create_workspace("workspace-1", "Incident", Some("Investigate"), "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
}

#[test]
fn review_message_accepts_queue_local_run_link_without_widget_run() {
    let store = initialized_store();
    create_workspace_and_workbench(&store);
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Task",
            description: "",
            prompt: "Prompt",
            status: "queued",
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
    assert!(store
        .get_widget_run("queue-local-run-1")
        .expect("widget run lookup")
        .is_none());

    let message = store
        .insert_agent_queue_review_message(NewAgentQueueReviewMessage {
            message_id: "message-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            run_id: Some("queue-local-run-1"),
            run_link_id: Some("run-link-1"),
            actor_id: "workspace-agent",
            message_body: "Review worker evidence.",
            status: "created",
            created_at: Some("4"),
            acked_at: None,
            ack_actor_id: None,
            metadata_json: None,
            updated_at: Some("4"),
        })
        .expect("insert review message without widget run");

    assert_eq!(message.run_id.as_deref(), Some("queue-local-run-1"));
    assert_eq!(message.run_link_id.as_deref(), Some("run-link-1"));
}
