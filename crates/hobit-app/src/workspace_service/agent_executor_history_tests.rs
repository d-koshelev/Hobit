use super::*;

use std::env;
use std::path::PathBuf;

use hobit_core::widgets::WidgetRunStatus;
use hobit_storage_sqlite::{NewWidgetInstance, NewWidgetLog, SqliteStore};
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
            && run.has_result));
    assert!(history.runs.iter().any(|run| {
        run.mode.as_deref() == Some("direct_work_validation")
            && run.validation_profile.as_deref() == Some("fast")
            && run.validation_status.as_deref() == Some("passed")
            && run.has_result
    }));
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
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
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
