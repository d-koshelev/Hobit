use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace(store: &SqliteStore, workspace_id: &str) {
    store
        .create_workspace(workspace_id, "Workspace", None, "active")
        .expect("create workspace");
}

fn create_task(
    store: &SqliteStore,
    workspace_id: &str,
    queue_item_id: &str,
    title: &str,
    priority: i64,
    updated_at: &str,
) {
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id,
            workspace_id,
            title,
            description: "Description",
            prompt: "Prompt",
            status: "queued",
            priority,
            created_at: Some(updated_at),
            updated_at: Some(updated_at),
        })
        .expect("create queue task");
}

fn create_workbench_and_widget(
    store: &SqliteStore,
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) {
    store
        .create_workspace_workbench(workbench_id, workspace_id, None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: widget_id,
            workspace_id,
            workbench_id,
            definition_id: "agent-run",
            title: "Agent Executor",
            category: "agent",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(360),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert widget");
}

#[test]
fn create_agent_queue_task_stores_workspace_scoped_task() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    let task = store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Review changes",
            description: "Review the current patch",
            prompt: "Check the patch for regressions",
            status: "queued",
            priority: 3,
            created_at: Some("1"),
            updated_at: Some("2"),
        })
        .expect("create queue task");

    assert_eq!(task.queue_item_id, "task-1");
    assert_eq!(task.workspace_id, "workspace-1");
    assert_eq!(task.title, "Review changes");
    assert_eq!(task.description, "Review the current patch");
    assert_eq!(task.prompt, "Check the patch for regressions");
    assert_eq!(task.status, "queued");
    assert_eq!(task.priority, 3);
    assert_eq!(task.assigned_executor_widget_id, None);
    assert_eq!(task.created_at, "1");
    assert_eq!(task.updated_at, "2");
}

#[test]
fn list_agent_queue_tasks_returns_only_tasks_for_workspace() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_task(&store, "workspace-1", "task-1", "One", 1, "1");
    create_task(&store, "workspace-2", "task-2", "Two", 1, "2");

    let tasks = store
        .list_agent_queue_tasks("workspace-1")
        .expect("list queue tasks");

    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].queue_item_id, "task-1");
}

#[test]
fn get_agent_queue_task_rejects_cross_workspace_access() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_workspace(&store, "workspace-2");
    create_task(&store, "workspace-1", "task-1", "One", 1, "1");

    assert!(store
        .get_agent_queue_task("workspace-2", "task-1")
        .expect("get cross-workspace queue task")
        .is_none());
}

#[test]
fn update_agent_queue_task_updates_fields_and_updated_at() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_task(&store, "workspace-1", "task-1", "Original", 1, "1");

    let task = store
        .update_agent_queue_task(
            "workspace-1",
            "task-1",
            AgentQueueTaskUpdate {
                title: "Updated",
                description: "Updated description",
                prompt: "Updated prompt",
                status: "completed",
                priority: 4,
                updated_at: Some("2"),
            },
        )
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(task.title, "Updated");
    assert_eq!(task.description, "Updated description");
    assert_eq!(task.prompt, "Updated prompt");
    assert_eq!(task.status, "completed");
    assert_eq!(task.priority, 4);
    assert_eq!(task.assigned_executor_widget_id, None);
    assert_eq!(task.updated_at, "2");
}

#[test]
fn unknown_agent_queue_task_returns_none() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");

    assert!(store
        .get_agent_queue_task("workspace-1", "missing-task")
        .expect("get unknown queue task")
        .is_none());
    assert!(store
        .update_agent_queue_task(
            "workspace-1",
            "missing-task",
            AgentQueueTaskUpdate {
                title: "Missing",
                description: "",
                prompt: "",
                status: "draft",
                priority: 0,
                updated_at: Some("2"),
            },
        )
        .expect("update unknown queue task")
        .is_none());
}

#[test]
fn delete_workspace_deletes_queue_tasks_and_preserves_other_workspace_tasks() {
    let store = initialized_store();
    create_workspace(&store, "workspace-delete");
    create_workspace(&store, "workspace-keep");
    create_task(&store, "workspace-delete", "task-delete", "Delete", 1, "1");
    create_task(&store, "workspace-keep", "task-keep", "Keep", 1, "2");

    store
        .with_immediate_transaction(|store| {
            store.delete_workspace_and_local_data("workspace-delete")
        })
        .expect("delete workspace");

    assert!(store
        .get_agent_queue_task_by_id("task-delete")
        .expect("get deleted queue task")
        .is_none());
    assert!(store
        .get_agent_queue_task_by_id("task-keep")
        .expect("get kept queue task")
        .is_some());
}

#[test]
fn list_agent_queue_tasks_orders_priority_first_then_recently_updated() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_task(&store, "workspace-1", "task-low", "Low", 1, "3");
    create_task(&store, "workspace-1", "task-high-old", "High old", 5, "1");
    create_task(&store, "workspace-1", "task-high-new", "High new", 5, "2");

    let tasks = store
        .list_agent_queue_tasks("workspace-1")
        .expect("list queue tasks");

    let ids = tasks
        .into_iter()
        .map(|task| task.queue_item_id)
        .collect::<Vec<_>>();
    assert_eq!(ids, vec!["task-high-new", "task-high-old", "task-low"]);
}

#[test]
fn assign_agent_queue_task_to_executor_updates_assignment_and_updated_at() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_task(&store, "workspace-1", "task-1", "Task", 1, "1");
    create_workbench_and_widget(&store, "workspace-1", "workbench-1", "executor-1");

    let assigned = store
        .assign_agent_queue_task_to_executor("workspace-1", "task-1", "executor-1", Some("2"))
        .expect("assign executor")
        .expect("assigned task");

    assert_eq!(
        assigned.assigned_executor_widget_id.as_deref(),
        Some("executor-1")
    );
    assert_eq!(assigned.updated_at, "2");
    let fetched = store
        .get_agent_queue_task("workspace-1", "task-1")
        .expect("get assigned task")
        .expect("assigned task");
    let listed = store
        .list_agent_queue_tasks("workspace-1")
        .expect("list assigned task");

    assert_eq!(
        fetched.assigned_executor_widget_id.as_deref(),
        Some("executor-1")
    );
    assert_eq!(
        listed[0].assigned_executor_widget_id.as_deref(),
        Some("executor-1")
    );
}

#[test]
fn clear_agent_queue_task_assignment_removes_assignment() {
    let store = initialized_store();
    create_workspace(&store, "workspace-1");
    create_task(&store, "workspace-1", "task-1", "Task", 1, "1");
    create_workbench_and_widget(&store, "workspace-1", "workbench-1", "executor-1");
    store
        .assign_agent_queue_task_to_executor("workspace-1", "task-1", "executor-1", Some("2"))
        .expect("assign executor");

    let cleared = store
        .clear_agent_queue_task_assignment("workspace-1", "task-1", Some("3"))
        .expect("clear assignment")
        .expect("cleared task");

    assert_eq!(cleared.assigned_executor_widget_id, None);
    assert_eq!(cleared.updated_at, "3");
}
