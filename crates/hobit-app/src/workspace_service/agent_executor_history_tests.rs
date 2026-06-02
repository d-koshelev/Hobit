use super::*;

use std::env;
use std::path::PathBuf;

use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{
    NewAgentQueueTaskRunLink, NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun,
    SqliteStore,
};
use hobit_tools::codex_cli::{
    CodexApprovalPolicy, CodexDirectRunOutput, CodexDirectRunRequest, CodexDirectRunStatus,
    CodexSandboxMode,
};
use hobit_tools::toolbelt::{
    ToolbeltValidationOutput, ToolbeltValidationProfile, ToolbeltValidationRequest,
    ToolbeltValidationStatus,
};

use crate::WorkspaceServiceError;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn list_agent_executor_runs_returns_direct_work_and_validation_only() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let direct = run_direct_work(&service, &workspace_id, &workbench_id, &widget_id);
    let validation = run_validation(&service, &workspace_id, &workbench_id, &widget_id);
    let terminal_widget_id = add_terminal_widget(&service, &workspace_id, &workbench_id);
    service
        .store
        .append_widget_log(NewWidgetLog {
            id: "cross-widget-history-log",
            widget_instance_id: &terminal_widget_id,
            run_id: Some(&direct.run_id),
            level: "info",
            message: "Wrong widget for same run id",
            created_at: Some("999"),
            details: None,
        })
        .expect("append cross-widget history log");
    let proposal_run_id =
        create_legacy_proposal_artifact(&service, &workspace_id, &workbench_id, &widget_id);
    let terminal_run_id = create_terminal_artifact(&service, &workspace_id, &workbench_id);

    let history = service
        .list_agent_executor_runs(&workspace_id, &workbench_id, &widget_id, Some(10))
        .expect("list agent executor runs")
        .expect("history");
    let run_ids = run_ids(&history.runs);

    assert_eq!(history.workspace_id, workspace_id);
    assert_eq!(history.workbench_id, workbench_id);
    assert_eq!(history.widget_instance_id, widget_id);
    assert_eq!(history.runs.len(), 2);
    assert!(run_ids.contains(&direct.run_id.as_str()));
    assert!(run_ids.contains(&validation.run_id.as_str()));
    assert!(!run_ids.contains(&proposal_run_id.as_str()));
    assert!(!run_ids.contains(&terminal_run_id.as_str()));
    assert!(history
        .runs
        .iter()
        .any(|run| run.mode.as_deref() == Some("direct_work")
            && run.repo_root.as_deref() == Some(current_repo_root_string().as_str())
            && run.has_result
            && run.log_count == Some(4)));
    assert!(history.runs.iter().any(|run| {
        run.mode.as_deref() == Some("direct_work_validation")
            && run.validation_profile.as_deref() == Some("fast")
            && run.validation_status.as_deref() == Some("passed")
            && run.has_result
    }));
}

#[test]
fn list_agent_executor_runs_preserves_order_and_missing_result_behavior() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);

    insert_agent_executor_run(
        &service,
        "history-old",
        &widget_id,
        "completed",
        Some("codex_direct_work"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/old"}"#),
        "100",
        Some("101"),
        Some("Old run"),
    );
    insert_agent_executor_result(
        &service,
        "history-old-result",
        "history-old",
        "completed",
        "codex_direct_work_result",
        Some("Old result"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/old","duration_ms":7,"status":"completed"}"#),
        "102",
    );
    insert_agent_executor_run(
        &service,
        "history-missing-result",
        &widget_id,
        "running",
        Some("codex_direct_work"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/missing"}"#),
        "200",
        None,
        Some("Missing result still running"),
    );
    insert_agent_executor_run(
        &service,
        "history-new-validation",
        &widget_id,
        "completed",
        Some("direct_work_validation"),
        Some(r#"{"mode":"direct_work_validation","repo_root":"C:/new","profile":"changed"}"#),
        "300",
        Some("301"),
        Some("Validation run"),
    );
    insert_agent_executor_result(
        &service,
        "history-new-validation-result",
        "history-new-validation",
        "completed",
        "direct_work_validation_result",
        Some("Validation failed"),
        Some(
            r#"{"mode":"direct_work_validation","repo_root":"C:/new","profile":"changed","status":"failed","duration_ms":9}"#,
        ),
        "302",
    );

    let history = service
        .list_agent_executor_runs(&workspace_id, &workbench_id, &widget_id, Some(10))
        .expect("list history")
        .expect("history");

    assert_eq!(
        run_ids(&history.runs),
        vec![
            "history-new-validation",
            "history-missing-result",
            "history-old"
        ]
    );
    let missing = history
        .runs
        .iter()
        .find(|run| run.run_id == "history-missing-result")
        .expect("missing-result run");
    assert_eq!(missing.status, "running");
    assert_eq!(missing.result_type, None);
    assert_eq!(missing.title, "Missing result still running");
    assert_eq!(missing.repo_root.as_deref(), Some("C:/missing"));
    assert_eq!(missing.mode.as_deref(), Some("direct_work"));
    assert!(!missing.has_result);
    assert_eq!(missing.log_count, Some(0));

    let validation = history
        .runs
        .iter()
        .find(|run| run.run_id == "history-new-validation")
        .expect("validation run");
    assert_eq!(validation.title, "Validation failed");
    assert_eq!(validation.duration_ms, Some(9));
    assert_eq!(validation.validation_profile.as_deref(), Some("changed"));
    assert_eq!(validation.validation_status.as_deref(), Some("failed"));
}

#[test]
fn list_agent_executor_runs_scans_additional_pages_when_newest_runs_are_filtered() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);

    insert_agent_executor_run(
        &service,
        "paged-old",
        &widget_id,
        "completed",
        Some("codex_direct_work"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/old"}"#),
        "100",
        Some("101"),
        Some("Old paged run"),
    );
    insert_agent_executor_result(
        &service,
        "paged-old-result",
        "paged-old",
        "completed",
        "codex_direct_work_result",
        Some("Old paged result"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/old","duration_ms":7}"#),
        "102",
    );
    insert_agent_executor_run(
        &service,
        "paged-new",
        &widget_id,
        "completed",
        Some("codex_direct_work"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/new"}"#),
        "110",
        Some("111"),
        Some("New paged run"),
    );
    insert_agent_executor_result(
        &service,
        "paged-new-result",
        "paged-new",
        "completed",
        "codex_direct_work_result",
        Some("New paged result"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/new","duration_ms":9}"#),
        "112",
    );
    for index in 0..25 {
        insert_non_executor_run(
            &service,
            &format!("paged-filtered-{index:02}"),
            &widget_id,
            &format!("2{index:02}"),
        );
    }

    let history = service
        .list_agent_executor_runs(&workspace_id, &workbench_id, &widget_id, Some(2))
        .expect("list history")
        .expect("history");
    let limited_history = service
        .list_agent_executor_runs(&workspace_id, &workbench_id, &widget_id, Some(1))
        .expect("list limited history")
        .expect("history");

    assert_eq!(run_ids(&history.runs), vec!["paged-new", "paged-old"]);
    assert_eq!(history.runs[0].title, "New paged result");
    assert_eq!(history.runs[1].title, "Old paged result");
    assert_eq!(run_ids(&limited_history.runs), vec!["paged-new"]);
}

#[test]
fn list_agent_executor_runs_rejects_non_agent_executor_widget() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes")
        .expect("state");
    let widget_id = state.widget_instances[0].id.clone();

    let error = service
        .list_agent_executor_runs(&workspace.id, workbench_id, &widget_id, None)
        .expect_err("reject non-Agent Executor");

    assert!(
        matches!(error, WorkspaceServiceError::InvalidInput(message) if message.contains("Agent Executor"))
    );
}

#[test]
fn agent_executor_history_is_scoped_to_requested_workspace_workbench_and_widget() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let direct = run_direct_work(&service, &workspace_id, &workbench_id, &widget_id);
    let (other_workspace_id, other_workbench_id, other_widget_id) =
        add_agent_executor_widget(&service);
    let other_direct = run_direct_work(
        &service,
        &other_workspace_id,
        &other_workbench_id,
        &other_widget_id,
    );
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace_id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-workbench-agent-executor",
            workspace_id: &workspace_id,
            workbench_id: "other-workbench",
            definition_id: AGENT_RUN_WIDGET_DEFINITION_ID,
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
        .expect("insert other workbench widget");

    let history = service
        .list_agent_executor_runs(&workspace_id, &workbench_id, &widget_id, None)
        .expect("list first history")
        .expect("history");
    let cross_workbench = service
        .list_agent_executor_runs(
            &workspace_id,
            &workbench_id,
            "other-workbench-agent-executor",
            None,
        )
        .expect("reject cross-workbench widget");
    let run_ids = run_ids(&history.runs);

    assert_ne!(workspace_id, other_workspace_id);
    assert!(run_ids.contains(&direct.run_id.as_str()));
    assert!(!run_ids.contains(&other_direct.run_id.as_str()));
    assert!(cross_workbench.is_none());
}

#[test]
fn get_agent_executor_run_detail_returns_result_and_run_scoped_logs() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let direct = run_direct_work(&service, &workspace_id, &workbench_id, &widget_id);
    let terminal_widget_id = add_terminal_widget(&service, &workspace_id, &workbench_id);
    service
        .store
        .append_widget_log(NewWidgetLog {
            id: "cross-widget-run-log",
            widget_instance_id: &terminal_widget_id,
            run_id: Some(&direct.run_id),
            level: "info",
            message: "Wrong widget for same run id",
            created_at: Some("999"),
            details: None,
        })
        .expect("append cross-widget run log");

    let detail = service
        .get_agent_executor_run_detail(&workspace_id, &workbench_id, &widget_id, &direct.run_id)
        .expect("get run detail")
        .expect("detail");

    assert_eq!(detail.summary.run_id, direct.run_id);
    assert_eq!(detail.summary.mode.as_deref(), Some("direct_work"));
    assert_eq!(
        detail.summary.result_type.as_deref(),
        Some("codex_direct_work_result")
    );
    assert_eq!(detail.final_message.as_deref(), Some("Final response"));
    assert_eq!(detail.stdout_preview.as_deref(), Some("codex stdout"));
    assert_eq!(detail.stderr_preview.as_deref(), Some("codex stderr"));
    assert!(detail
        .result_payload
        .as_deref()
        .is_some_and(|payload| payload.contains("\"mode\":\"direct_work\"")));
    assert!(detail.logs.iter().all(|log| {
        log.widget_instance_id == widget_id && log.run_id.as_deref() == Some(direct.run_id.as_str())
    }));
    assert!(!detail
        .logs
        .iter()
        .any(|log| log.id == "cross-widget-run-log"));
}

#[test]
fn get_agent_executor_run_detail_preserves_preview_caps_and_error_fields() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let stdout = "s".repeat(16 * 1024 + 8);
    let stderr = "e".repeat(16 * 1024 + 4);
    let payload = serde_json::json!({
        "mode": "direct_work",
        "repo_root": "C:/failing",
        "status": "failed",
        "stdout": stdout,
        "stderr": stderr,
        "duration_ms": 11,
        "error_message": "codex failed visibly"
    })
    .to_string();

    insert_agent_executor_run(
        &service,
        "history-detail-failed",
        &widget_id,
        "failed",
        Some("codex_direct_work"),
        Some(r#"{"mode":"direct_work","repo_root":"C:/failing"}"#),
        "400",
        Some("401"),
        Some("Failed run"),
    );
    insert_agent_executor_result(
        &service,
        "history-detail-failed-result",
        "history-detail-failed",
        "failed",
        "codex_direct_work_result",
        Some("Codex Direct Work failed"),
        Some(&payload),
        "402",
    );

    let detail = service
        .get_agent_executor_run_detail(
            &workspace_id,
            &workbench_id,
            &widget_id,
            "history-detail-failed",
        )
        .expect("get detail")
        .expect("detail");

    assert_eq!(detail.summary.status, "failed");
    assert_eq!(detail.summary.duration_ms, Some(11));
    assert_eq!(detail.result_status.as_deref(), Some("failed"));
    assert_eq!(
        detail.error_message.as_deref(),
        Some("codex failed visibly")
    );
    assert_eq!(
        detail.stdout_preview.as_ref().expect("stdout").len(),
        16 * 1024
    );
    assert_eq!(
        detail.stderr_preview.as_ref().expect("stderr").len(),
        16 * 1024
    );
    assert!(detail
        .result_payload
        .as_deref()
        .is_some_and(|payload| payload.contains("codex failed visibly")));
}

#[test]
fn get_agent_executor_run_detail_preserves_recent_log_cap_and_total_count() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let direct = run_direct_work(&service, &workspace_id, &workbench_id, &widget_id);

    for index in 0..105 {
        service
            .store
            .append_widget_log(NewWidgetLog {
                id: &format!("extra-log-{index:03}"),
                widget_instance_id: &widget_id,
                run_id: Some(&direct.run_id),
                level: "info",
                message: &format!("extra log {index}"),
                created_at: Some(&format!("9000000{index:03}")),
                details: None,
            })
            .expect("append extra run log");
    }

    let detail = service
        .get_agent_executor_run_detail(&workspace_id, &workbench_id, &widget_id, &direct.run_id)
        .expect("get run detail")
        .expect("detail");

    assert_eq!(detail.summary.log_count, Some(109));
    assert_eq!(detail.logs.len(), 100);
    assert_eq!(detail.logs[0].id, "extra-log-005");
    assert_eq!(detail.logs.last().expect("last log").id, "extra-log-104");
}

#[test]
fn queue_run_links_keep_raw_executor_payload_owned_by_executor_detail() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let direct = run_direct_work(&service, &workspace_id, &workbench_id, &widget_id);
    let task = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.clone(),
            title: "Review run".to_owned(),
            description: String::new(),
            prompt: "Review Executor output".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task");
    service
        .store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: "link-executor-owned-payload",
            workspace_id: &workspace_id,
            queue_task_id: &task.queue_item_id,
            executor_widget_id: &widget_id,
            direct_work_run_id: &direct.run_id,
            source: "manual",
            status: "completed",
            started_at: Some("9000000000"),
            completed_at: Some("9000000001"),
            validation_status: None,
            review_status: Some("review_needed"),
            created_at: Some("9000000000"),
            updated_at: Some("9000000001"),
        })
        .expect("insert run link");

    let links = service
        .list_agent_queue_task_run_links(&workspace_id, &task.queue_item_id)
        .expect("list queue run links");
    let detail = service
        .get_agent_executor_run_detail(&workspace_id, &workbench_id, &widget_id, &direct.run_id)
        .expect("get executor detail")
        .expect("executor detail");

    assert_eq!(links.len(), 1);
    assert_eq!(links[0].direct_work_run_id, direct.run_id);
    assert_eq!(links[0].executor_widget_id, widget_id);
    assert_eq!(links[0].status, AgentQueueTaskRunStatus::Completed);
    assert_eq!(
        links[0].review_status,
        Some(AgentQueueTaskRunReviewStatus::ReviewNeeded)
    );
    assert!(detail
        .result_payload
        .as_deref()
        .is_some_and(|payload| payload.contains("\"final_message\":\"Final response\"")));
}

#[test]
fn get_agent_executor_run_detail_reads_queue_owned_direct_work_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue owned detail", None)
        .expect("create workspace");
    let workspace_id = workspace.id;
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id")
        .to_owned();
    let state = service
        .add_widget_instance_to_workbench(
            &workspace_id,
            &workbench_id,
            AGENT_QUEUE_WIDGET_DEFINITION_ID,
            "Agent Queue",
            "agent",
        )
        .expect("add queue")
        .expect("state after add");
    let queue_widget_id = state.widget_instances[0].id.clone();
    let direct = run_direct_work(&service, &workspace_id, &workbench_id, &queue_widget_id);

    let detail = service
        .get_agent_executor_run_detail(
            &workspace_id,
            &workbench_id,
            &queue_widget_id,
            &direct.run_id,
        )
        .expect("get queue-owned Direct Work detail")
        .expect("detail");

    assert_eq!(detail.summary.run_id, direct.run_id);
    assert_eq!(
        detail.summary.result_type.as_deref(),
        Some("codex_direct_work_result")
    );
    assert_eq!(detail.final_message.as_deref(), Some("Final response"));
    assert!(detail
        .logs
        .iter()
        .all(|log| log.widget_instance_id == queue_widget_id));
}

#[test]
fn get_agent_executor_run_detail_returns_none_for_unknown_or_retired_artifacts() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_agent_executor_widget(&service);
    let proposal_run_id =
        create_legacy_proposal_artifact(&service, &workspace_id, &workbench_id, &widget_id);

    let missing = service
        .get_agent_executor_run_detail(&workspace_id, &workbench_id, &widget_id, "missing-run")
        .expect("missing run is clean");
    let retired = service
        .get_agent_executor_run_detail(&workspace_id, &workbench_id, &widget_id, &proposal_run_id)
        .expect("retired proposal run is filtered");

    assert!(missing.is_none());
    assert!(retired.is_none());
}

fn add_agent_executor_widget(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("created workbench id")
        .to_owned();
    let state = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            AGENT_RUN_WIDGET_DEFINITION_ID,
            "Agent Executor",
            "agent",
        )
        .expect("add agent executor")
        .expect("state after add");

    (
        workspace.id,
        workbench_id,
        state.widget_instances[0].id.clone(),
    )
}

fn add_terminal_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
) -> String {
    let state = service
        .add_widget_instance_to_workbench(
            workspace_id,
            workbench_id,
            TERMINAL_WIDGET_DEFINITION_ID,
            "Terminal",
            "tool",
        )
        .expect("add terminal")
        .expect("state after add");

    state
        .widget_instances
        .last()
        .expect("terminal widget")
        .id
        .clone()
}

#[allow(clippy::too_many_arguments)]
fn insert_agent_executor_run(
    service: &WorkspaceService,
    run_id: &str,
    widget_id: &str,
    status: &str,
    command_kind: Option<&str>,
    command_payload: Option<&str>,
    started_at: &str,
    finished_at: Option<&str>,
    summary: Option<&str>,
) {
    service
        .store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: widget_id,
            status,
            command_kind,
            command_payload,
            started_at: Some(started_at),
            finished_at,
            summary,
        })
        .expect("insert Agent Executor run");
}

#[allow(clippy::too_many_arguments)]
fn insert_agent_executor_result(
    service: &WorkspaceService,
    result_id: &str,
    run_id: &str,
    status: &str,
    result_type: &str,
    summary: Option<&str>,
    payload: Option<&str>,
    created_at: &str,
) {
    service
        .store
        .insert_widget_result(NewWidgetResult {
            id: result_id,
            run_id,
            status,
            result_type: Some(result_type),
            summary,
            content: None,
            payload,
            created_at: Some(created_at),
        })
        .expect("insert Agent Executor result");
}

fn insert_non_executor_run(
    service: &WorkspaceService,
    run_id: &str,
    widget_id: &str,
    started_at: &str,
) {
    service
        .store
        .insert_widget_run(NewWidgetRun {
            id: run_id,
            widget_instance_id: widget_id,
            status: "completed",
            command_kind: Some("legacy_non_executor"),
            command_payload: Some("{}"),
            started_at: Some(started_at),
            finished_at: None,
            summary: Some("Filtered non-executor run"),
        })
        .expect("insert non-Executor run");
}

fn run_direct_work(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> CodexDirectWorkRunSummary {
    service
        .run_codex_direct_work_with_runner(
            direct_work_input(workspace_id, workbench_id, widget_id),
            |request| codex_output(&request, CodexDirectRunStatus::Completed),
        )
        .expect("run direct work")
        .expect("direct work summary")
}

fn run_validation(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> DirectWorkValidationRunSummary {
    service
        .run_direct_work_validation_with_runner(
            validation_input(workspace_id, workbench_id, widget_id),
            |request| validation_output(&request, ToolbeltValidationStatus::Passed),
        )
        .expect("run validation")
        .expect("validation summary")
}

fn create_legacy_proposal_artifact(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> String {
    let run = service
        .create_widget_run(
            workspace_id,
            workbench_id,
            widget_id,
            WidgetRunCommandInput {
                command_kind: Some(AGENT_CHAT_PROPOSAL_COMMAND_KIND.to_owned()),
                command_payload: Some("{\"mode\":\"proposal_only_mock\"}".to_owned()),
                summary: Some("Legacy proposal artifact".to_owned()),
            },
        )
        .expect("create legacy proposal run")
        .expect("proposal run");

    service
        .finish_widget_run(
            workspace_id,
            workbench_id,
            widget_id,
            &run.id,
            WidgetRunStatus::Completed,
            Some("Legacy proposal completed".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some(AGENT_CHAT_PROPOSAL_RESULT_TYPE.to_owned()),
                summary: Some("Proposal".to_owned()),
                content: Some("proposal content".to_owned()),
                payload: Some("{\"runtime_status\":\"proposal_only_mock\"}".to_owned()),
            }),
        )
        .expect("finish legacy proposal run");

    run.id
}

fn create_terminal_artifact(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
) -> String {
    let terminal_widget_id = add_terminal_widget(service, workspace_id, workbench_id);
    let run = service
        .create_widget_run(
            workspace_id,
            workbench_id,
            &terminal_widget_id,
            WidgetRunCommandInput {
                command_kind: Some("terminal_command".to_owned()),
                command_payload: None,
                summary: Some("Terminal command".to_owned()),
            },
        )
        .expect("create terminal run")
        .expect("terminal run");

    service
        .finish_widget_run(
            workspace_id,
            workbench_id,
            &terminal_widget_id,
            &run.id,
            WidgetRunStatus::Completed,
            Some("Terminal completed".to_owned()),
            Some(WidgetRunResultInput {
                result_type: Some("terminal_command_result".to_owned()),
                summary: Some("Terminal result".to_owned()),
                content: None,
                payload: Some("{\"process_status\":\"completed\"}".to_owned()),
            }),
        )
        .expect("finish terminal run");

    run.id
}

fn direct_work_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> RunCodexDirectWorkInput {
    RunCodexDirectWorkInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        codex_executable: "codex".to_owned(),
        repo_root: current_repo_root(),
        operator_prompt: "Summarize the current block.".to_owned(),
        codex_thread_id: None,
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        skip_git_repo_check: false,
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn validation_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
) -> RunDirectWorkValidationInput {
    RunDirectWorkValidationInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        repo_root: current_repo_root(),
        validation_profile: "fast".to_owned(),
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn codex_output(
    request: &CodexDirectRunRequest,
    status: CodexDirectRunStatus,
) -> CodexDirectRunOutput {
    CodexDirectRunOutput {
        status,
        exit_code: Some(0),
        stdout: "codex stdout".to_owned(),
        stderr: "codex stderr".to_owned(),
        final_message: Some("Final response".to_owned()),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 42,
        error_message: None,
        command_summary: vec![
            "codex".to_owned(),
            "exec".to_owned(),
            "--cd".to_owned(),
            request.repo_root.display().to_string(),
            "<operator-prompt>".to_owned(),
        ],
        repo_root: request.repo_root.clone(),
        sandbox: CodexSandboxMode::WorkspaceWrite,
        approval_policy: CodexApprovalPolicy::Never,
    }
}

fn validation_output(
    request: &ToolbeltValidationRequest,
    status: ToolbeltValidationStatus,
) -> ToolbeltValidationOutput {
    ToolbeltValidationOutput {
        status,
        profile: ToolbeltValidationProfile::Fast,
        exit_code: Some(0),
        stdout: "validation stdout".to_owned(),
        stderr: "validation stderr".to_owned(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 24,
        error_message: None,
        command_summary: vec![
            "toolbelt".to_owned(),
            request.profile.as_cli_arg().to_owned(),
        ],
        repo_root: request.repo_root.clone(),
    }
}

fn current_repo_root() -> PathBuf {
    env::current_dir().expect("current dir")
}

fn current_repo_root_string() -> String {
    current_repo_root().display().to_string()
}

fn run_ids(runs: &[AgentExecutorRunSummary]) -> Vec<&str> {
    runs.iter().map(|run| run.run_id.as_str()).collect()
}
