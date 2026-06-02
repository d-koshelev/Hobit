use super::*;

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}

fn create_workspace_task_and_executor(store: &SqliteStore) {
    store
        .create_workspace("workspace-1", "Workspace", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-1", "workspace-1", None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "executor-1",
            workspace_id: "workspace-1",
            workbench_id: "workbench-1",
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
        .expect("insert executor");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-1",
            workspace_id: "workspace-1",
            title: "Task",
            description: "Description",
            prompt: "Prompt",
            status: "queued",
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create queue task");
}

fn create_widget_run(store: &SqliteStore, run_id: &str, started_at: &str) {
    store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: "executor-1",
            status: "running",
            command_kind: Some("codex_direct_work"),
            command_payload: Some("{\"operator_prompt\":\"raw prompt stays in executor run\"}"),
            started_at: Some(started_at),
            finished_at: None,
            summary: Some("running"),
        })
        .expect("insert widget run");
}

fn insert_link(store: &SqliteStore, link_id: &str, run_id: &str, source: &str, started_at: &str) {
    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id,
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            executor_widget_id: "executor-1",
            direct_work_run_id: run_id,
            source,
            status: "running",
            started_at: Some(started_at),
            completed_at: None,
            validation_status: None,
            review_status: None,
            created_at: Some(started_at),
            updated_at: Some(started_at),
        })
        .expect("insert run link");
}

#[test]
fn run_link_start_record_stores_safe_metadata_only() {
    let store = initialized_store();
    create_workspace_task_and_executor(&store);
    create_widget_run(&store, "run-1", "2");

    let link = store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: "link-1",
            workspace_id: "workspace-1",
            queue_task_id: "task-1",
            executor_widget_id: "executor-1",
            direct_work_run_id: "run-1",
            source: "manual",
            status: "running",
            started_at: Some("2"),
            completed_at: None,
            validation_status: None,
            review_status: None,
            created_at: Some("2"),
            updated_at: Some("2"),
        })
        .expect("insert run link");

    assert_eq!(link.link_id, "link-1");
    assert_eq!(link.queue_task_id, "task-1");
    assert_eq!(link.executor_widget_id, "executor-1");
    assert_eq!(link.direct_work_run_id, "run-1");
    assert_eq!(link.source, "manual");
    assert_eq!(link.status, "running");
    assert_eq!(link.validation_status, None);
    assert_eq!(link.review_status, None);
}

#[test]
fn run_link_final_status_update_works() {
    let store = initialized_store();
    create_workspace_task_and_executor(&store);
    create_widget_run(&store, "run-1", "2");
    insert_link(&store, "link-1", "run-1", "manual", "2");

    let link = store
        .update_agent_queue_task_run_link_final_status(
            "workspace-1",
            "task-1",
            "run-1",
            AgentQueueTaskRunLinkFinalUpdate {
                status: "completed",
                completed_at: Some("3"),
                validation_status: Some("passed"),
                review_status: Some("review_needed"),
                updated_at: Some("4"),
            },
        )
        .expect("update final status")
        .expect("updated link");

    assert_eq!(link.status, "completed");
    assert_eq!(link.completed_at.as_deref(), Some("3"));
    assert_eq!(link.validation_status.as_deref(), Some("passed"));
    assert_eq!(link.review_status.as_deref(), Some("review_needed"));
    assert_eq!(link.updated_at, "4");
}

#[test]
fn one_queue_task_can_have_multiple_run_links_and_latest_can_be_derived() {
    let store = initialized_store();
    create_workspace_task_and_executor(&store);
    create_widget_run(&store, "run-1", "2");
    create_widget_run(&store, "run-2", "3");
    insert_link(&store, "link-1", "run-1", "manual", "2");
    insert_link(&store, "link-2", "run-2", "autorun", "3");

    let links = store
        .list_agent_queue_task_run_links("workspace-1", "task-1")
        .expect("list links");
    let latest = store
        .get_latest_agent_queue_task_run_link("workspace-1", "task-1")
        .expect("latest link")
        .expect("latest link");

    assert_eq!(links.len(), 2);
    assert_eq!(links[0].direct_work_run_id, "run-2");
    assert_eq!(links[1].direct_work_run_id, "run-1");
    assert_eq!(latest.link_id, "link-2");
}

#[test]
fn run_link_storage_has_no_raw_prompt_output_final_response_or_diff_columns() {
    let store = initialized_store();
    let mut statement = store
        .connection
        .prepare("PRAGMA table_info(agent_queue_task_run_links)")
        .expect("prepare table info");
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .expect("query columns")
        .collect::<Result<Vec<_>>>()
        .expect("collect columns");

    for forbidden in [
        "prompt",
        "stdout",
        "stderr",
        "final_response",
        "final_message",
        "diff",
        "payload",
        "command_payload",
    ] {
        assert!(
            !columns.iter().any(|column| column.contains(forbidden)),
            "run-link table must not contain raw column {forbidden}"
        );
    }
}

#[test]
fn manual_and_autorun_sources_are_represented() {
    let store = initialized_store();
    create_workspace_task_and_executor(&store);
    create_widget_run(&store, "run-1", "2");
    create_widget_run(&store, "run-2", "3");
    insert_link(&store, "link-1", "run-1", "manual", "2");
    insert_link(&store, "link-2", "run-2", "autorun", "3");

    let links = store
        .list_agent_queue_task_run_links("workspace-1", "task-1")
        .expect("list links");
    let sources = links
        .into_iter()
        .map(|link| link.source)
        .collect::<Vec<_>>();

    assert!(sources.contains(&"manual".to_owned()));
    assert!(sources.contains(&"autorun".to_owned()));
}
