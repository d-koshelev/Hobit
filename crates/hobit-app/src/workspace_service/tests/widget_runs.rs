use super::*;

#[test]
fn create_widget_run_for_owned_widget_persists_running_run() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "terminal",
            "Terminal",
            "tool",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();

    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: Some("{\"kind\":\"dry\"}".to_owned()),
                summary: Some("Preview lifecycle only".to_owned()),
            },
        )
        .expect("create widget run")
        .expect("widget run");
    let stored_runs = service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("list widget runs");

    assert!(run.id.starts_with("wrun_"));
    assert_eq!(run.widget_instance_id, widget_id);
    assert_eq!(run.status, "running");
    assert_eq!(run.command_kind.as_deref(), Some("preview"));
    assert_eq!(run.command_payload.as_deref(), Some("{\"kind\":\"dry\"}"));
    assert_eq!(run.summary.as_deref(), Some("Preview lifecycle only"));
    assert_eq!(run.finished_at, None);
    assert_eq!(stored_runs.len(), 1);
    assert_eq!(stored_runs[0].id, run.id);
}

#[test]
fn widget_run_lifecycle_rejects_unowned_widget_or_run_without_mutation() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "terminal",
            "Terminal",
            "tool",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace.id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-widget",
            workspace_id: &workspace.id,
            workbench_id: "other-workbench",
            definition_id: "terminal",
            title: "Other Terminal",
            category: "tool",
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
        .expect("insert other widget");
    let other_run = service
        .create_widget_run(
            &workspace.id,
            "other-workbench",
            "other-widget",
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("create other run")
        .expect("other run");

    let invalid_create = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            "other-widget",
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("reject create");
    let invalid_log = service
        .append_widget_run_log(
            &workspace.id,
            workbench_id,
            &widget_id,
            &other_run.id,
            "info",
            "Should not leak",
            Some("{\"leak\":true}".to_owned()),
        )
        .expect("reject append log");
    let invalid_finish = service
        .finish_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            &other_run.id,
            WidgetRunStatus::Completed,
            Some("Should not finish".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("test".to_owned()),
                summary: Some("Leaked result".to_owned()),
                content: None,
                payload: None,
            }),
        )
        .expect("reject finish");
    let other_runs = service
        .store
        .list_widget_runs_for_widget("other-widget")
        .expect("list other runs");
    let widget_logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list widget logs")
        .expect("widget logs");
    let other_logs = service
        .list_widget_logs(&workspace.id, "other-workbench", "other-widget", 20)
        .expect("list other logs")
        .expect("other logs");
    let other_results = service
        .store
        .list_widget_results(&other_run.id)
        .expect("list other results");
    let stored_other_run = service
        .store
        .get_widget_run(&other_run.id)
        .expect("get other run")
        .expect("other run row");

    assert!(invalid_create.is_none());
    assert!(invalid_log.is_none());
    assert!(invalid_finish.is_none());
    assert_eq!(other_runs.len(), 1);
    assert_eq!(other_runs[0].id, other_run.id);
    assert_eq!(
        widget_log_messages(&widget_logs),
        vec![WIDGET_LOG_WIDGET_ADDED]
    );
    assert!(other_logs.is_empty());
    assert!(other_results.is_empty());
    assert_eq!(stored_other_run.status, "running");
    assert_eq!(stored_other_run.finished_at, None);
}

#[test]
fn append_widget_run_log_persists_run_scoped_widget_log() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "terminal",
            "Terminal",
            "tool",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("create run")
        .expect("run");

    let log = service
        .append_widget_run_log(
            &workspace.id,
            workbench_id,
            &widget_id,
            &run.id,
            "info",
            "Run lifecycle recorded",
            Some("{\"phase\":\"running\"}".to_owned()),
        )
        .expect("append run log")
        .expect("run log");
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("logs");

    assert!(log.id.starts_with("wlog_"));
    assert_eq!(log.widget_instance_id, widget_id);
    assert_eq!(log.run_id.as_deref(), Some(run.id.as_str()));
    assert_eq!(log.level, "info");
    assert_eq!(log.message, "Run lifecycle recorded");
    assert_eq!(log.payload.as_deref(), Some("{\"phase\":\"running\"}"));
    assert!(logs.iter().any(|saved| saved.id == log.id));
}

#[test]
fn finish_widget_run_persists_final_status_and_structured_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-run",
            "Agent Monitoring",
            "agent",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("executor_preview".to_owned()),
                command_payload: Some("{\"block\":108}".to_owned()),
                summary: None,
            },
        )
        .expect("create run")
        .expect("run");

    let finished = service
        .finish_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            &run.id,
            WidgetRunStatus::Completed,
            Some("Lifecycle completed".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("result_report".to_owned()),
                summary: Some("Result ready".to_owned()),
                content: Some("No runtime was executed.".to_owned()),
                payload: Some("{\"ok\":true}".to_owned()),
            }),
        )
        .expect("finish run")
        .expect("finished run");
    let read_back = service
        .get_widget_run(&workspace.id, workbench_id, &widget_id, &run.id)
        .expect("read run")
        .expect("run read model");

    assert_eq!(finished.run.id, run.id);
    assert_eq!(finished.run.status, "completed");
    assert!(finished.run.finished_at.is_some());
    assert_eq!(finished.run.summary.as_deref(), Some("Lifecycle completed"));
    assert_eq!(finished.results.len(), 1);
    assert!(finished.results[0].id.starts_with("wres_"));
    assert_eq!(finished.results[0].run_id, run.id);
    assert_eq!(finished.results[0].status, "completed");
    assert_eq!(finished.results[0].result_type, "result_report");
    assert_eq!(finished.results[0].summary.as_deref(), Some("Result ready"));
    assert_eq!(
        finished.results[0].content.as_deref(),
        Some("No runtime was executed.")
    );
    assert_eq!(read_back, finished);
}

#[test]
fn finish_widget_run_rejects_non_final_status_without_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id");
    let state_after_add = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-run",
            "Agent Monitoring",
            "agent",
        )
        .expect("add widget")
        .expect("state after add");
    let widget_id = state_after_add.widget_instances[0].id.clone();
    let run = service
        .create_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            WidgetRunCommandInput {
                command_kind: Some("executor_preview".to_owned()),
                command_payload: None,
                summary: None,
            },
        )
        .expect("create run")
        .expect("run");

    let error = service
        .finish_widget_run(
            &workspace.id,
            workbench_id,
            &widget_id,
            &run.id,
            WidgetRunStatus::Running,
            Some("Should not finish".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("result_report".to_owned()),
                summary: Some("Should not persist".to_owned()),
                content: None,
                payload: None,
            }),
        )
        .expect_err("reject non-final status");
    let stored_run = service
        .store
        .get_widget_run(&run.id)
        .expect("get run")
        .expect("run row");
    let results = service
        .store
        .list_widget_results(&run.id)
        .expect("list results");

    assert!(matches!(error, WorkspaceServiceError::InvalidInput(_)));
    assert_eq!(stored_run.status, "running");
    assert_eq!(stored_run.finished_at, None);
    assert!(results.is_empty());
}
