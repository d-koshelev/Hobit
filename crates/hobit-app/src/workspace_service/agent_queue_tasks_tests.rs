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

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    title: &str,
    status: &str,
    priority: i64,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: title.to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: status.to_owned(),
            priority,
        })
        .expect("create queue task")
}

#[test]
fn create_list_get_and_update_agent_queue_task() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let task = create_task(&service, &workspace.id, "Review API", "queued", 3);

    assert_eq!(task.workspace_id, workspace.id);
    assert_eq!(task.title, "Review API");
    assert_eq!(task.description, "Description");
    assert_eq!(task.prompt, "Prompt");
    assert_eq!(task.status, "queued");
    assert_eq!(task.priority, 3);
    assert!(!task.created_at.is_empty());
    assert_eq!(task.created_at, task.updated_at);

    let listed = service
        .list_agent_queue_tasks(&workspace.id)
        .expect("list queue tasks");
    assert_eq!(listed, vec![task.clone()]);

    let fetched = service
        .get_agent_queue_task(&workspace.id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    assert_eq!(fetched, task);

    std::thread::sleep(std::time::Duration::from_millis(1));

    let updated = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            title: "Updated API review".to_owned(),
            description: "Updated description".to_owned(),
            prompt: "Updated prompt".to_owned(),
            status: "completed".to_owned(),
            priority: 4,
        })
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(updated.title, "Updated API review");
    assert_eq!(updated.description, "Updated description");
    assert_eq!(updated.prompt, "Updated prompt");
    assert_eq!(updated.status, "completed");
    assert_eq!(updated.priority, 4);
    assert_ne!(updated.updated_at, task.updated_at);
}

#[test]
fn create_agent_queue_task_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: "missing-workspace".to_owned(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
        })
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn list_agent_queue_tasks_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .list_agent_queue_tasks("missing-workspace")
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn get_and_update_agent_queue_task_reject_cross_workspace_access() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let task = create_task(&service, &first.id, "First task", "queued", 2);

    let get_error = service
        .get_agent_queue_task(&second.id, &task.queue_item_id)
        .expect_err("cross-workspace get rejected");
    assert!(get_error.to_string().contains("queue task does not belong"));

    let update_error = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: second.id,
            queue_item_id: task.queue_item_id,
            title: "Other".to_owned(),
            description: "Other description".to_owned(),
            prompt: "Other prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
        })
        .expect_err("cross-workspace update rejected");
    assert!(update_error
        .to_string()
        .contains("queue task does not belong"));
}

#[test]
fn get_and_update_unknown_agent_queue_task_returns_none() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    assert!(service
        .get_agent_queue_task(&workspace.id, "missing-task")
        .expect("get unknown queue task")
        .is_none());
    assert!(service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: "missing-task".to_owned(),
            title: "Missing".to_owned(),
            description: "".to_owned(),
            prompt: "".to_owned(),
            status: "draft".to_owned(),
            priority: 0,
        })
        .expect("update unknown queue task")
        .is_none());
}

#[test]
fn create_agent_queue_task_rejects_empty_title_invalid_status_and_priority() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let empty_title = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "  ".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
        })
        .expect_err("empty title rejected");
    assert!(empty_title
        .to_string()
        .contains("queue task title must not be empty"));

    let invalid_status = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "running".to_owned(),
            priority: 1,
        })
        .expect_err("invalid status rejected");
    assert!(invalid_status
        .to_string()
        .contains("unsupported queue task status: running"));

    let invalid_priority = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id,
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 9,
        })
        .expect_err("invalid priority rejected");
    assert!(invalid_priority
        .to_string()
        .contains("queue task priority must be between 0 and 5"));
}

#[test]
fn non_draft_agent_queue_task_rejects_empty_prompt() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let error = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id,
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "  ".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
        })
        .expect_err("empty prompt rejected");

    assert!(error
        .to_string()
        .contains("queue task prompt must not be empty unless status is draft"));
}
