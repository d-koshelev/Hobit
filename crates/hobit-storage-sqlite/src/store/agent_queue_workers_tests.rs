use crate::{AgentQueueWorkerUpdate, NewAgentQueueWorker, SqliteStore};

#[test]
fn agent_queue_workers_create_update_list_and_delete() {
    let store = SqliteStore::open_in_memory().expect("open store");
    store.init_schema().expect("init schema");
    store
        .create_workspace("workspace-workers", "Workers", None, "active")
        .expect("create workspace");

    let worker = store
        .create_agent_queue_worker(NewAgentQueueWorker {
            worker_id: "worker-1",
            workspace_id: "workspace-workers",
            name: "Agent Worker 1",
            enabled: true,
            scope_kind: "all",
            queue_tag_id: None,
            queue_tag_name: None,
            display_order: 0,
            created_at: Some("2026-01-01T00:00:00Z"),
            updated_at: Some("2026-01-01T00:00:00Z"),
        })
        .expect("create worker");

    assert_eq!(worker.worker_id, "worker-1");
    assert!(worker.enabled);
    assert_eq!(worker.scope_kind, "all");

    let workers = store
        .list_agent_queue_workers("workspace-workers")
        .expect("list workers");
    assert_eq!(workers.len(), 1);

    let updated = store
        .update_agent_queue_worker(
            "workspace-workers",
            "worker-1",
            AgentQueueWorkerUpdate {
                name: "Review Worker",
                enabled: false,
                scope_kind: "queue_tag",
                queue_tag_id: Some("review"),
                queue_tag_name: Some("Review"),
                display_order: 3,
                updated_at: Some("2026-01-01T00:01:00Z"),
            },
        )
        .expect("update worker")
        .expect("updated worker");

    assert_eq!(updated.name, "Review Worker");
    assert!(!updated.enabled);
    assert_eq!(updated.queue_tag_id.as_deref(), Some("review"));
    assert_eq!(updated.display_order, 3);

    assert!(store
        .delete_agent_queue_worker("workspace-workers", "worker-1")
        .expect("delete worker"));
    assert!(store
        .list_agent_queue_workers("workspace-workers")
        .expect("list workers")
        .is_empty());
}
