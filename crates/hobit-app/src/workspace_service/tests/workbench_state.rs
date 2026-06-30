use super::*;

#[test]
fn get_workbench_state_returns_none_for_missing_workspace() {
    let service = initialized_service();

    let state = service
        .get_workspace_workbench_state("missing")
        .expect("get workbench state");

    assert!(state.is_none());
}

#[test]
fn get_workbench_state_for_empty_workspace_has_empty_widgets() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(state.workspace, workspace);
    assert_eq!(
        state
            .workbench
            .as_ref()
            .map(|workbench| workbench.id.as_str()),
        state.workspace.workbench_id.as_deref()
    );
    assert!(state.widget_instances.is_empty());
    assert!(state.shared_state_objects.is_empty());
    assert_eq!(state.recent_events.len(), 1);
    assert_eq!(state.recent_events[0].kind, "workspace_created");
}

#[test]
fn get_workbench_state_includes_shared_state_and_recent_workspace_events() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");

    service
        .store
        .insert_shared_state_object(NewSharedStateObject {
            id: "shared-1",
            workspace_id: &workspace.id,
            key: "current_goal",
            value: "Investigate outage",
            value_kind: "text",
        })
        .expect("insert shared state");
    service
        .store
        .append_workbench_event(
            "event-1",
            &workspace.id,
            "shared_state_changed",
            "Shared state changed",
            Some("shared_state_id=shared-1"),
        )
        .expect("append event");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(
        state.shared_state_objects,
        vec![SharedStateObjectSummary {
            id: "shared-1".to_owned(),
            key: "current_goal".to_owned(),
            value: "Investigate outage".to_owned(),
            value_kind: "text".to_owned(),
        }]
    );
    assert!(state
        .recent_events
        .iter()
        .any(|event| event.kind == "shared_state_changed"));
}

#[test]
fn get_workbench_state_includes_widget_instances() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    service
        .store
        .create_workspace_workbench("zz-other-workbench", &workspace.id, None)
        .expect("create other workbench");

    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-1",
            workspace_id: &workspace.id,
            workbench_id,
            definition_id: "notes",
            title: "Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(120),
            popout_y: Some(140),
            popout_width: Some(640),
            popout_height: Some(480),
            always_on_top: true,
            is_visible: true,
            config: Some("{\"scope\":\"workspace\"}"),
            state: Some("{\"dirty\":false}"),
        })
        .expect("insert widget");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "widget-2",
            workspace_id: &workspace.id,
            workbench_id: "zz-other-workbench",
            definition_id: "notes",
            title: "Other Notes",
            category: "notes",
            layout_mode: "docked",
            dock_x: Some(0),
            dock_y: Some(0),
            dock_width: Some(320),
            dock_height: Some(240),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: true,
            config: None,
            state: None,
        })
        .expect("insert other workbench widget");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(
        state.widget_instances,
        vec![WidgetInstanceSummary {
            id: "widget-1".to_owned(),
            definition_id: "notes".to_owned(),
            title: "Notes".to_owned(),
            category: "notes".to_owned(),
            layout_mode: "docked".to_owned(),
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(480),
            dock_height: Some(320),
            popout_x: Some(120),
            popout_y: Some(140),
            popout_width: Some(640),
            popout_height: Some(480),
            always_on_top: true,
            is_visible: true,
            config: Some("{\"scope\":\"workspace\"}".to_owned()),
            state: Some("{\"dirty\":false}".to_owned()),
        }]
    );
}

#[test]
fn get_workbench_state_projects_queue_recovery_without_mounted_queue_view() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue Recovery", None)
        .expect("create workspace");
    let task = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Recover saved Queue".to_owned(),
            description: "Queue state should remain openable.".to_owned(),
            prompt: "Check Queue recovery projection.".to_owned(),
            status: "running".to_owned(),
            priority: 3,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task");

    let before_tasks = service
        .store
        .list_agent_queue_tasks(&workspace.id)
        .expect("list queue tasks before");
    assert!(service
        .store
        .get_agent_queue_control_state(&workspace.id)
        .expect("get control before")
        .is_none());

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(state.queue_recovery.workspace_id, workspace.id);
    assert_eq!(state.queue_recovery.queue_task_count, 1);
    assert_eq!(state.workspace.queue_task_count, 1);
    assert_eq!(state.queue_recovery.running_task_count, 1);
    assert_eq!(state.queue_recovery.stale_running_candidate_count, 0);
    assert!(!state.queue_recovery.has_visible_queue_view);
    assert_eq!(state.queue_recovery.canonical_queue_widget_id, None);
    assert_eq!(state.queue_recovery.control_state, None);
    assert!(state.widget_instances.is_empty());
    assert_eq!(
        service
            .store
            .list_agent_queue_tasks(&workspace.id)
            .expect("list queue tasks after"),
        before_tasks
    );
    assert!(service
        .store
        .get_agent_queue_control_state(&workspace.id)
        .expect("get control after")
        .is_none());
    assert!(service
        .list_agent_queue_task_run_links(&workspace.id, &task.queue_item_id)
        .expect("list run links")
        .is_empty());
}

#[test]
fn get_workbench_state_projects_hidden_queue_view_and_stale_queue_local_candidate() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue Recovery", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let task = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Recover running Queue".to_owned(),
            description: String::new(),
            prompt: "Project a backend-owned running run link.".to_owned(),
            status: "running".to_owned(),
            priority: 4,
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "queue-widget-hidden",
            workspace_id: &workspace.id,
            workbench_id,
            definition_id: AGENT_QUEUE_WIDGET_DEFINITION_ID,
            title: "Agent Queue",
            category: "workflow",
            layout_mode: "docked",
            dock_x: Some(12),
            dock_y: Some(24),
            dock_width: Some(1160),
            dock_height: Some(680),
            popout_x: None,
            popout_y: None,
            popout_width: None,
            popout_height: None,
            always_on_top: false,
            is_visible: false,
            config: Some("{}"),
            state: Some("{}"),
        })
        .expect("insert hidden queue widget");
    service
        .record_agent_queue_task_run_started(RecordAgentQueueTaskRunStartedInput {
            workspace_id: workspace.id.clone(),
            queue_task_id: task.queue_item_id.clone(),
            executor_widget_id: QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID.to_owned(),
            direct_work_run_id: "queue-local-run-1".to_owned(),
            source: AgentQueueTaskRunSource::Manual,
        })
        .expect("record queue-local run link");
    service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: workspace.id.clone(),
            status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned(),
            actor_id: Some("operator".to_owned()),
            reason: Some("manual recovery test".to_owned()),
            expected_version: None,
        })
        .expect("set control state");
    let before_tasks = service
        .store
        .list_agent_queue_tasks(&workspace.id)
        .expect("list queue tasks before");
    let before_links = service
        .store
        .list_agent_queue_task_run_links(&workspace.id, &task.queue_item_id)
        .expect("list run links before");

    let state = service
        .get_workspace_workbench_state(&workspace.id)
        .expect("get workbench state")
        .expect("workbench state");

    assert_eq!(state.queue_recovery.queue_task_count, 1);
    assert_eq!(state.queue_recovery.running_task_count, 1);
    assert_eq!(state.queue_recovery.stale_running_candidate_count, 1);
    assert!(!state.queue_recovery.has_visible_queue_view);
    assert_eq!(
        state.queue_recovery.canonical_queue_widget_id.as_deref(),
        Some("queue-widget-hidden")
    );
    assert_eq!(
        state
            .queue_recovery
            .control_state
            .as_ref()
            .map(|control| control.status.as_str()),
        Some(AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED)
    );
    assert_eq!(
        service
            .store
            .list_agent_queue_tasks(&workspace.id)
            .expect("list queue tasks after"),
        before_tasks
    );
    assert_eq!(
        service
            .store
            .list_agent_queue_task_run_links(&workspace.id, &task.queue_item_id)
            .expect("list run links after"),
        before_links
    );
}
