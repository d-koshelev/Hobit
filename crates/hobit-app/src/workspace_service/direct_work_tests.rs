use super::*;

use std::cell::RefCell;
use std::env;
use std::path::PathBuf;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use hobit_tools::codex_cli::{
    CodexApprovalPolicy, CodexDirectRunOutput, CodexDirectRunRequest, CodexDirectRunStatus,
    CodexSandboxMode,
};
use serde_json::Value;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn codex_direct_work_for_valid_widget_creates_run_logs_result_and_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "Implement the focused block.",
                "workspace_write",
                "on_request",
            ),
            |request| {
                assert_eq!(request.program.as_deref(), Some("codex"));
                assert_eq!(request.prompt, "Implement the focused block.");
                assert_eq!(request.sandbox, CodexSandboxMode::WorkspaceWrite);
                assert_eq!(request.approval_policy, CodexApprovalPolicy::OnRequest);
                assert!(!request.skip_git_repo_check);
                assert_eq!(request.timeout_ms, Some(2_000));
                assert_eq!(request.stdout_cap_bytes, Some(16 * 1024));
                assert_eq!(request.stderr_cap_bytes, Some(8 * 1024));
                completed_output(&request)
            },
        )
        .expect("run direct work")
        .expect("direct work summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let result_payload = direct_work_result_payload(&service, &summary.run_id);
    let command_payload: Value =
        serde_json::from_str(run.command_payload.as_deref().expect("command payload"))
            .expect("command payload json");

    assert_eq!(summary.status, "completed");
    assert_eq!(summary.result_type, "codex_direct_work_result");
    assert_eq!(summary.executor_kind, "codex_cli");
    assert_eq!(summary.mode, "direct_work");
    assert_eq!(summary.exit_code, Some(0));
    assert_eq!(summary.stdout, "codex stdout");
    assert_eq!(summary.stderr, "codex stderr");
    assert_eq!(summary.final_message.as_deref(), Some("Final response"));
    assert!(summary.no_auto_commit);
    assert!(summary.no_auto_push);
    assert!(!summary.git_mutations_performed_by_hobit);
    assert_eq!(run.status, "completed");
    assert_eq!(run.command_kind.as_deref(), Some("codex_direct_work"));
    assert_eq!(command_payload["executor_kind"], "codex_cli");
    assert_eq!(command_payload["mode"], "direct_work");
    assert_eq!(
        command_payload["operator_prompt"],
        "Implement the focused block."
    );
    assert_eq!(result_payload["status"], "completed");
    assert_eq!(result_payload["stdout"], "codex stdout");
    assert_eq!(result_payload["stderr"], "codex stderr");
    assert_eq!(
        widget_log_messages(&logs),
        vec![
            "Widget added",
            "Direct Work requested",
            "Codex process starting",
            "Codex process completed",
            "No commit/push performed",
        ]
    );
    assert!(logs
        .iter()
        .skip(1)
        .all(|log| log.run_id.as_deref() == Some(summary.run_id.as_str())));
}

#[test]
fn codex_direct_work_for_coordinator_widget_creates_run_without_queue_or_git_mutation() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_coordinator_widget(&service);
    let mut input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Implement directly from Coordinator.",
        "workspace_write",
        "never",
    );
    input.skip_git_repo_check = true;

    let summary = service
        .run_codex_direct_work_with_runner(input, |request| {
            assert!(request.skip_git_repo_check);
            completed_output(&request)
        })
        .expect("run coordinator direct work")
        .expect("coordinator direct work summary");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");

    assert_eq!(summary.status, "completed");
    assert_eq!(summary.mode, "direct_work");
    assert!(summary.no_auto_commit);
    assert!(summary.no_auto_push);
    assert!(!summary.git_mutations_performed_by_hobit);
    assert_eq!(
        widget_log_messages(&logs),
        vec![
            "Widget added",
            "Direct Work requested",
            "Codex process starting",
            "Codex process completed",
            "No commit/push performed",
        ]
    );
}

#[test]
fn codex_direct_work_rejects_non_allowed_widget_without_run_log_or_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let state = service
        .add_widget_instance_to_workbench(&workspace.id, workbench_id, "notes", "Notes", "notes")
        .expect("add notes widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace.id,
                workbench_id,
                &widget_id,
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |_| panic!("codex runner should not be called for non-allowed widgets"),
        )
        .expect("reject non-allowed widget");
    let runs = service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("list runs");
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");

    assert!(summary.is_none());
    assert!(runs.is_empty());
    assert_eq!(widget_log_messages(&logs), vec!["Widget added"]);
}

#[test]
fn codex_direct_work_rejects_cross_workspace_and_cross_workbench_widgets_without_leaks() {
    let service = initialized_service();
    let (workspace_id, workbench_id, _widget_id) = add_direct_work_widget(&service);
    let (other_workspace_id, _other_workbench_id, other_widget_id) =
        add_direct_work_widget(&service);

    let cross_workspace_summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &other_widget_id,
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |_| panic!("codex runner should not be called for cross-workspace widgets"),
        )
        .expect("reject cross-workspace widget");
    let cross_workspace_runs = service
        .store
        .list_widget_runs_for_widget(&other_widget_id)
        .expect("list cross-workspace widget runs");

    assert_ne!(workspace_id, other_workspace_id);
    assert!(cross_workspace_summary.is_none());
    assert!(cross_workspace_runs.is_empty());

    service
        .store
        .create_workspace_workbench("other-workbench", &workspace_id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-agent-run",
            workspace_id: &workspace_id,
            workbench_id: "other-workbench",
            definition_id: AGENT_RUN_WIDGET_DEFINITION_ID,
            title: "Other Agent Monitoring",
            category: "core",
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

    let cross_workbench_summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                "other-agent-run",
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |_| panic!("codex runner should not be called for cross-workbench widgets"),
        )
        .expect("reject cross-workbench widget");
    let cross_workbench_runs = service
        .store
        .list_widget_runs_for_widget("other-agent-run")
        .expect("list cross-workbench runs");
    let cross_workbench_logs = service
        .store
        .list_widget_logs_for_widget("other-agent-run", 20)
        .expect("list cross-workbench logs");

    assert!(cross_workbench_summary.is_none());
    assert!(cross_workbench_runs.is_empty());
    assert!(cross_workbench_logs.is_empty());
}

#[test]
fn codex_direct_work_failed_to_start_maps_to_failed_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |request| codex_output(&request, CodexDirectRunStatus::FailedToStart),
        )
        .expect("run direct work")
        .expect("direct work summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = direct_work_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "failed");
    assert_eq!(run.status, "failed");
    assert_eq!(payload["status"], "failed");
    assert_eq!(payload["codex_status"], "failed_to_start");
    assert_eq!(
        last_widget_log(&service, &widget_id).as_deref(),
        Some("No commit/push performed")
    );
}

#[test]
fn codex_direct_work_timeout_maps_to_timed_out_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |request| codex_output(&request, CodexDirectRunStatus::TimedOut),
        )
        .expect("run direct work")
        .expect("direct work summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = direct_work_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "timed_out");
    assert_eq!(run.status, "timed_out");
    assert_eq!(payload["status"], "timed_out");
    assert_eq!(payload["codex_status"], "timed_out");
}

#[test]
fn codex_direct_work_completed_maps_to_completed_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |request| codex_output(&request, CodexDirectRunStatus::Completed),
        )
        .expect("run direct work")
        .expect("direct work summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");

    assert_eq!(summary.status, "completed");
    assert_eq!(run.status, "completed");
}

#[test]
fn codex_direct_work_result_json_records_executor_mode_safety_and_policy_fields() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "Run Codex with read-only sandbox.",
                "read_only",
                "untrusted",
            ),
            |request| {
                assert_eq!(request.sandbox, CodexSandboxMode::ReadOnly);
                assert_eq!(request.approval_policy, CodexApprovalPolicy::Untrusted);
                completed_output(&request)
            },
        )
        .expect("run direct work")
        .expect("direct work summary");
    let payload = direct_work_result_payload(&service, &summary.run_id);

    assert_eq!(payload["executor_kind"], "codex_cli");
    assert_eq!(payload["mode"], "direct_work");
    assert_eq!(payload["sandbox"], "read_only");
    assert_eq!(payload["approval_policy"], "untrusted");
    assert_eq!(payload["skip_git_repo_check"], false);
    assert_eq!(
        payload["operator_prompt"],
        "Run Codex with read-only sandbox."
    );
    assert_eq!(payload["command_summary"][0], "codex");
    assert_eq!(payload["no_auto_commit"], true);
    assert_eq!(payload["no_auto_push"], true);
    assert_eq!(payload["git_mutations_performed_by_hobit"], false);
}

#[test]
fn codex_direct_work_runner_is_called_after_pre_run_transaction_is_committed() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let observed_pre_run_records = RefCell::new(false);

    let summary = service
        .run_codex_direct_work_with_runner(
            direct_work_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                current_repo_root(),
                "Run Codex.",
                "workspace_write",
                "never",
            ),
            |request| {
                service
                    .store
                    .with_immediate_transaction(|store| {
                        let runs = store.list_widget_runs_for_widget(&widget_id)?;
                        let logs = store.list_widget_logs_for_widget(&widget_id, 20)?;

                        assert_eq!(runs.len(), 1);
                        assert_eq!(runs[0].status, "running");
                        assert!(logs
                            .iter()
                            .map(|log| log.message.as_str())
                            .any(|message| message == "Codex process starting"));
                        Ok(())
                    })
                    .expect("runner can start its own transaction");

                *observed_pre_run_records.borrow_mut() = true;
                completed_output(&request)
            },
        )
        .expect("run direct work")
        .expect("direct work summary");

    assert!(*observed_pre_run_records.borrow());
    assert_eq!(summary.status, "completed");
}

fn add_direct_work_widget(service: &WorkspaceService) -> (String, String, String) {
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
            "Agent Monitoring",
            "core",
        )
        .expect("add agent monitoring widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn add_coordinator_widget(service: &WorkspaceService) -> (String, String, String) {
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
            COORDINATOR_CHAT_WIDGET_DEFINITION_ID,
            "Coordinator Chat",
            "core",
        )
        .expect("add coordinator widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn direct_work_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
    repo_root: PathBuf,
    operator_prompt: &str,
    sandbox: &str,
    approval_policy: &str,
) -> RunCodexDirectWorkInput {
    RunCodexDirectWorkInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        codex_executable: "codex".to_owned(),
        repo_root,
        operator_prompt: operator_prompt.to_owned(),
        sandbox: sandbox.to_owned(),
        approval_policy: approval_policy.to_owned(),
        skip_git_repo_check: false,
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn completed_output(request: &CodexDirectRunRequest) -> CodexDirectRunOutput {
    codex_output(request, CodexDirectRunStatus::Completed)
}

fn codex_output(
    request: &CodexDirectRunRequest,
    status: CodexDirectRunStatus,
) -> CodexDirectRunOutput {
    CodexDirectRunOutput {
        status,
        exit_code: if status == CodexDirectRunStatus::Completed {
            Some(0)
        } else {
            None
        },
        stdout: "codex stdout".to_owned(),
        stderr: "codex stderr".to_owned(),
        final_message: if status == CodexDirectRunStatus::Completed {
            Some("Final response".to_owned())
        } else {
            None
        },
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 42,
        error_message: match status {
            CodexDirectRunStatus::Completed => None,
            CodexDirectRunStatus::FailedToStart => Some("could not start codex exec".to_owned()),
            CodexDirectRunStatus::TimedOut => Some("codex exec timed out".to_owned()),
            CodexDirectRunStatus::Failed => Some("codex exec failed".to_owned()),
        },
        command_summary: vec![
            "codex".to_owned(),
            "exec".to_owned(),
            "--cd".to_owned(),
            request.repo_root.display().to_string(),
            "<operator-prompt>".to_owned(),
        ],
        repo_root: request.repo_root.clone(),
        sandbox: request.sandbox,
        approval_policy: request.approval_policy,
    }
}

fn direct_work_result_payload(service: &WorkspaceService, run_id: &str) -> Value {
    let results = service
        .store
        .list_widget_results(run_id)
        .expect("list widget results");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].result_type, "codex_direct_work_result");

    serde_json::from_str(results[0].payload.as_deref().expect("result payload"))
        .expect("result payload json")
}

fn last_widget_log(service: &WorkspaceService, widget_id: &str) -> Option<String> {
    service
        .store
        .list_widget_logs_for_widget(widget_id, 20)
        .expect("list logs")
        .last()
        .map(|log| log.message.clone())
}

fn current_repo_root() -> PathBuf {
    env::current_dir().expect("current dir")
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}
