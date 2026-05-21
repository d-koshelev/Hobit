use super::*;

use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn agent_queue_task_command_helpers_create_list_get_and_update() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);

    let created = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Queue task".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 3,
            execution_policy: Some("auto".to_owned()),
        },
        db_path.clone(),
    )
    .expect("create queue task");

    assert_eq!(created.workspace_id, workspace_id);
    assert_eq!(created.title, "Queue task");
    assert_eq!(created.description, "Description");
    assert_eq!(created.prompt, "Prompt");
    assert_eq!(created.status, "queued");
    assert_eq!(created.priority, 3);
    assert_eq!(created.execution_policy, "auto");
    assert_eq!(created.assigned_executor_widget_id, None);

    let listed = list_agent_queue_tasks_blocking(
        ListAgentQueueTasksRequest {
            workspace_id: workspace_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list queue tasks");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].queue_item_id, created.queue_item_id);

    let fetched = get_agent_queue_task_blocking(
        GetAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: created.queue_item_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get queue task")
    .expect("queue task");
    assert_eq!(fetched, created);

    let updated = update_agent_queue_task_blocking(
        UpdateAgentQueueTaskRequest {
            workspace_id,
            queue_item_id: created.queue_item_id,
            title: "Updated".to_owned(),
            description: "Updated description".to_owned(),
            prompt: "Updated prompt".to_owned(),
            status: "running".to_owned(),
            priority: 4,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("update queue task")
    .expect("updated queue task");

    assert_eq!(updated.title, "Updated");
    assert_eq!(updated.description, "Updated description");
    assert_eq!(updated.prompt, "Updated prompt");
    assert_eq!(updated.status, "running");
    assert_eq!(updated.priority, 4);
    assert_eq!(updated.execution_policy, "auto");
    assert_eq!(updated.assigned_executor_widget_id, None);
    remove_test_db_files(&db_path);
}

#[test]
fn create_agent_queue_task_command_helper_rejects_unknown_workspace() {
    let db_path = unique_test_db_path();
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    drop(store);

    let error = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: "missing-workspace".to_owned(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect_err("unknown workspace rejected");

    assert!(error.contains("workspace not found: missing-workspace"));
    remove_test_db_files(&db_path);
}

#[test]
fn get_agent_queue_task_command_helper_rejects_cross_workspace_access() {
    let db_path = unique_test_db_path();
    let first_workspace_id = create_workspace_in_test_db(&db_path);
    let second_workspace_id = create_workspace_in_test_db(&db_path);
    let created = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: first_workspace_id,
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create queue task");

    let error = get_agent_queue_task_blocking(
        GetAgentQueueTaskRequest {
            workspace_id: second_workspace_id,
            queue_item_id: created.queue_item_id,
        },
        db_path.clone(),
    )
    .expect_err("cross-workspace access rejected");

    assert!(error.contains("queue task does not belong"));
    remove_test_db_files(&db_path);
}

#[test]
fn assignment_command_helpers_assign_and_clear_executor() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);
    let executor_widget_id =
        add_widget_in_test_db(&db_path, &workspace_id, "agent-run", "Agent Executor");
    let created = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create queue task");

    let assigned = assign_agent_queue_task_to_executor_blocking(
        AssignAgentQueueTaskToExecutorRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: created.queue_item_id.clone(),
            executor_widget_instance_id: executor_widget_id.clone(),
        },
        db_path.clone(),
    )
    .expect("assign executor");

    assert_eq!(
        assigned.assigned_executor_widget_id.as_deref(),
        Some(executor_widget_id.as_str())
    );
    assert_eq!(assigned.status, "queued");

    let cleared = clear_agent_queue_task_assignment_blocking(
        ClearAgentQueueTaskAssignmentRequest {
            workspace_id,
            queue_item_id: created.queue_item_id,
        },
        db_path.clone(),
    )
    .expect("clear assignment");

    assert_eq!(cleared.assigned_executor_widget_id, None);
    assert_eq!(cleared.status, "queued");
    remove_test_db_files(&db_path);
}

#[test]
fn assignment_command_helper_rejects_non_executor_widget() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);
    let notes_widget_id = add_widget_in_test_db(&db_path, &workspace_id, "notes", "Notes");
    let created = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create queue task");

    let error = assign_agent_queue_task_to_executor_blocking(
        AssignAgentQueueTaskToExecutorRequest {
            workspace_id,
            queue_item_id: created.queue_item_id,
            executor_widget_instance_id: notes_widget_id,
        },
        db_path.clone(),
    )
    .expect_err("non-executor rejected");

    assert!(error.contains("assigned widget is not an Agent Executor"));
    remove_test_db_files(&db_path);
}

#[test]
fn assignment_command_helper_rejects_running_task_assignment_changes() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);
    let executor_widget_id =
        add_widget_in_test_db(&db_path, &workspace_id, "agent-run", "Agent Executor");
    let running = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Running task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "running".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create running queue task");

    let assign_error = assign_agent_queue_task_to_executor_blocking(
        AssignAgentQueueTaskToExecutorRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: running.queue_item_id,
            executor_widget_instance_id: executor_widget_id.clone(),
        },
        db_path.clone(),
    )
    .expect_err("running assignment rejected");
    assert!(assign_error.contains("queue task status cannot be assigned: running"));

    let queued = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Queued task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create queued queue task");
    assign_agent_queue_task_to_executor_blocking(
        AssignAgentQueueTaskToExecutorRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: queued.queue_item_id.clone(),
            executor_widget_instance_id: executor_widget_id,
        },
        db_path.clone(),
    )
    .expect("assign queued queue task");
    update_agent_queue_task_blocking(
        UpdateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: queued.queue_item_id.clone(),
            title: queued.title,
            description: queued.description,
            prompt: queued.prompt,
            status: "running".to_owned(),
            priority: queued.priority,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("update task to running");

    let clear_error = clear_agent_queue_task_assignment_blocking(
        ClearAgentQueueTaskAssignmentRequest {
            workspace_id,
            queue_item_id: queued.queue_item_id,
        },
        db_path.clone(),
    )
    .expect_err("running clear assignment rejected");
    assert!(clear_error.contains("queue task assignment cannot be cleared while status is running"));
    remove_test_db_files(&db_path);
}

#[test]
fn delete_agent_queue_task_command_helper_deletes_non_running_task() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);
    let created = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create queue task");

    let deleted = delete_agent_queue_task_blocking(
        DeleteAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: created.queue_item_id.clone(),
        },
        db_path.clone(),
    )
    .expect("delete queue task");

    assert!(deleted);
    assert!(get_agent_queue_task_blocking(
        GetAgentQueueTaskRequest {
            workspace_id,
            queue_item_id: created.queue_item_id,
        },
        db_path.clone(),
    )
    .expect("get deleted task")
    .is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn delete_agent_queue_task_command_helper_rejects_running_task() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_in_test_db(&db_path);
    let running = create_agent_queue_task_blocking(
        CreateAgentQueueTaskRequest {
            workspace_id: workspace_id.clone(),
            title: "Running task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "running".to_owned(),
            priority: 1,
            execution_policy: None,
        },
        db_path.clone(),
    )
    .expect("create running queue task");

    let error = delete_agent_queue_task_blocking(
        DeleteAgentQueueTaskRequest {
            workspace_id,
            queue_item_id: running.queue_item_id,
        },
        db_path.clone(),
    )
    .expect_err("running delete rejected");

    assert!(error.contains("queue task cannot be deleted while status is running"));
    remove_test_db_files(&db_path);
}

fn create_workspace_in_test_db(db_path: &Path) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Queue command test", None)
        .expect("create workspace");
    let workspace_id = workspace.id;
    drop(service);

    workspace_id
}

fn add_widget_in_test_db(
    db_path: &Path,
    workspace_id: &str,
    definition_id: &str,
    title: &str,
) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workbench_id = service
        .get_workspace_summary(workspace_id)
        .expect("get workspace summary")
        .expect("workspace summary")
        .workbench_id
        .expect("workbench id");
    let widget_id = service
        .add_widget_instance_to_workbench(
            workspace_id,
            &workbench_id,
            definition_id,
            title,
            "agent",
        )
        .expect("add widget")
        .expect("updated state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("added widget")
        .id;
    drop(service);

    widget_id
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-agent-queue-task-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
