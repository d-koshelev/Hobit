use crate::{
    AgentQueueControlStateUpdate, NewAgentQueueControlState, NewAgentQueueTask,
    NewAgentQueueTaskRunLink, NewWidgetInstance, NewWidgetRun, SqliteStore,
};

#[test]
fn agent_queue_control_state_insert_get_update_and_isolate_by_workspace() {
    let store = initialized_store();
    store
        .create_workspace("workspace-control-a", "Control A", None, "active")
        .expect("create workspace A");
    store
        .create_workspace("workspace-control-b", "Control B", None, "active")
        .expect("create workspace B");

    let control = store
        .insert_agent_queue_control_state(NewAgentQueueControlState {
            workspace_id: "workspace-control-a",
            status: "disabled",
            version: 1,
            updated_by_actor_id: Some("workspace-agent"),
            reason: Some("default"),
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("insert control");

    assert_eq!(control.workspace_id, "workspace-control-a");
    assert_eq!(control.status, "disabled");
    assert_eq!(control.version, 1);

    let updated = store
        .update_agent_queue_control_state(
            "workspace-control-a",
            AgentQueueControlStateUpdate {
                status: "manual_enabled",
                updated_by_actor_id: Some("operator"),
                reason: Some("manual enable"),
                updated_at: Some("2"),
            },
        )
        .expect("update control")
        .expect("updated control");

    assert_eq!(updated.status, "manual_enabled");
    assert_eq!(updated.version, 2);
    assert_eq!(updated.updated_by_actor_id.as_deref(), Some("operator"));
    assert_eq!(updated.reason.as_deref(), Some("manual enable"));
    assert!(store
        .get_agent_queue_control_state("workspace-control-b")
        .expect("get workspace B control")
        .is_none());
}

#[test]
fn agent_queue_control_state_ensure_is_idempotent() {
    let store = initialized_store();
    store
        .create_workspace("workspace-control", "Control", None, "active")
        .expect("create workspace");

    let first = store
        .ensure_agent_queue_control_state(NewAgentQueueControlState {
            workspace_id: "workspace-control",
            status: "disabled",
            version: 1,
            updated_by_actor_id: None,
            reason: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("ensure control");
    let second = store
        .ensure_agent_queue_control_state(NewAgentQueueControlState {
            workspace_id: "workspace-control",
            status: "manual_enabled",
            version: 99,
            updated_by_actor_id: Some("ignored"),
            reason: Some("ignored"),
            created_at: Some("2"),
            updated_at: Some("2"),
        })
        .expect("ensure existing control");

    assert_eq!(second, first);
}

#[test]
fn agent_queue_control_state_changes_do_not_mutate_task_or_run_link_rows() {
    let store = initialized_store();
    store
        .create_workspace("workspace-control", "Control", None, "active")
        .expect("create workspace");
    store
        .create_workspace_workbench("workbench-control", "workspace-control", None)
        .expect("create workbench");
    store
        .insert_widget_instance(NewWidgetInstance {
            id: "executor-control",
            workspace_id: "workspace-control",
            workbench_id: "workbench-control",
            definition_id: "agent-run",
            title: "Executor",
            category: "workflow",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(100),
            dock_height: Some(100),
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
    store
        .insert_widget_run(NewWidgetRun {
            id: "run-control",
            widget_instance_id: "executor-control",
            status: "running",
            command_kind: Some("codex_direct_work"),
            command_payload: Some("{}"),
            started_at: Some("1"),
            finished_at: None,
            summary: None,
        })
        .expect("insert run");
    store
        .create_agent_queue_task(NewAgentQueueTask {
            queue_item_id: "task-control",
            workspace_id: "workspace-control",
            title: "Task",
            description: "Description",
            prompt: "Prompt",
            status: "queued",
            priority: 1,
            depends_on: None,
            execution_policy: Some("manual"),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
            context_json: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("create task");

    store
        .ensure_agent_queue_control_state(NewAgentQueueControlState {
            workspace_id: "workspace-control",
            status: "disabled",
            version: 1,
            updated_by_actor_id: None,
            reason: None,
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("ensure control");
    store
        .update_agent_queue_control_state(
            "workspace-control",
            AgentQueueControlStateUpdate {
                status: "manual_enabled",
                updated_by_actor_id: Some("operator"),
                reason: Some("manual enable"),
                updated_at: Some("2"),
            },
        )
        .expect("update control");

    let task = store
        .get_agent_queue_task("workspace-control", "task-control")
        .expect("get task")
        .expect("task");
    assert_eq!(task.status, "queued");
    assert!(store
        .list_agent_queue_task_run_links("workspace-control", "task-control")
        .expect("list run links")
        .is_empty());

    store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: "link-control",
            workspace_id: "workspace-control",
            queue_task_id: "task-control",
            executor_widget_id: "executor-control",
            direct_work_run_id: "run-control",
            source: "manual",
            status: "running",
            started_at: Some("3"),
            completed_at: None,
            validation_status: None,
            review_status: None,
            created_at: Some("3"),
            updated_at: Some("3"),
        })
        .expect("insert run link");

    store
        .update_agent_queue_control_state(
            "workspace-control",
            AgentQueueControlStateUpdate {
                status: "disabled",
                updated_by_actor_id: Some("operator"),
                reason: Some("manual disable"),
                updated_at: Some("4"),
            },
        )
        .expect("disable control");

    assert_eq!(
        store
            .list_agent_queue_task_run_links("workspace-control", "task-control")
            .expect("list run links")
            .len(),
        1
    );
}

fn initialized_store() -> SqliteStore {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    store
}
