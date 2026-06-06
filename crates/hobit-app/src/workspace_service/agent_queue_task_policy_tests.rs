use super::*;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> WorkspaceSummary {
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
}

#[test]
fn agent_queue_task_execution_policy_defaults_persists_updates_and_validates() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let created = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Policy task".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: Some("auto".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task");

    assert_eq!(created.execution_policy, "auto");

    let preserved = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: created.queue_item_id.clone(),
            title: "Policy task preserved".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(preserved.execution_policy, "auto");

    let changed = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: created.queue_item_id,
            title: "Policy task changed".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: Some("after_previous_success".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(changed.execution_policy, "after_previous_success");

    let invalid = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id,
            title: "Invalid policy".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: Some("when_ready".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("invalid execution policy rejected");

    assert!(invalid
        .to_string()
        .contains("unsupported queue task execution policy: when_ready"));
}
