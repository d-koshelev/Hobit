use super::*;

use std::cell::RefCell;
use std::env;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use hobit_tools::process::{ProcessRunOutput, ProcessRunRequest, ProcessRunStatus};
use serde_json::Value;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn terminal_command_for_valid_widget_creates_run_logs_result_and_response() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_terminal_widget(&service);

    let summary = service
        .run_terminal_command(terminal_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            current_test_exe(),
            vec!["--help".to_owned()],
        ))
        .expect("run terminal command")
        .expect("terminal command summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let payload = terminal_result_payload(&service, &summary.run_id);
    let command_payload: Value =
        serde_json::from_str(run.command_payload.as_deref().expect("command payload"))
            .expect("command payload json");

    assert_eq!(summary.status, "completed");
    assert_eq!(summary.exit_code, Some(0));
    assert!(summary.stdout.contains("Usage") || summary.stdout.contains("USAGE"));
    assert_eq!(run.status, "completed");
    assert_eq!(run.command_kind.as_deref(), Some("terminal_command"));
    assert_eq!(command_payload["program"], current_test_exe());
    assert_eq!(command_payload["args"][0], "--help");
    assert_eq!(payload["process_status"], "completed");
    assert_eq!(payload["exit_code"], 0);
    assert_eq!(payload["stdout"], summary.stdout);
    assert_eq!(payload["stderr"], summary.stderr);
    assert_eq!(
        widget_log_messages(&logs),
        vec![
            "Widget added",
            "Terminal command received",
            "Terminal process started",
            "Terminal process completed",
        ]
    );
    assert!(logs
        .iter()
        .skip(1)
        .all(|log| log.run_id.as_deref() == Some(summary.run_id.as_str())));
}

#[test]
fn terminal_command_nonzero_exit_is_completed_with_exit_code() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_terminal_widget(&service);

    let summary = service
        .run_terminal_command(terminal_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            current_test_exe(),
            vec!["--bad-hobit-test-flag".to_owned()],
        ))
        .expect("run terminal command")
        .expect("terminal command summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = terminal_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "completed");
    assert_ne!(summary.exit_code, Some(0));
    assert_eq!(run.status, "completed");
    assert_eq!(payload["process_status"], "completed");
    assert_eq!(payload["exit_code"], summary.exit_code.unwrap());
}

#[test]
fn terminal_command_failed_to_start_maps_to_failed_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_terminal_widget(&service);

    let summary = service
        .run_terminal_command(terminal_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            format!("hobit-missing-process-{}", unique_test_suffix()),
            Vec::new(),
        ))
        .expect("run terminal command")
        .expect("terminal command summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let payload = terminal_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "failed");
    assert_eq!(summary.exit_code, None);
    assert!(summary.error_message.is_some());
    assert_eq!(run.status, "failed");
    assert_eq!(payload["process_status"], "failed_to_start");
    assert_eq!(
        logs.last()
            .map(|log| (log.level.as_str(), log.message.as_str())),
        Some(("error", "Terminal process failed_to_start"))
    );
}

#[test]
fn terminal_command_timeout_maps_to_timed_out_run_status() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_terminal_widget(&service);
    let mut input = terminal_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_test_exe(),
        vec![
            "--exact".to_owned(),
            "workspace_service::terminal_tests::timeout_helper_sleeps".to_owned(),
            "--nocapture".to_owned(),
        ],
    );
    input.timeout_ms = Some(20);

    let summary = service
        .run_terminal_command(input)
        .expect("run terminal command")
        .expect("terminal command summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = terminal_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "timed_out");
    assert_eq!(summary.exit_code, None);
    assert!(summary
        .error_message
        .as_deref()
        .is_some_and(|message| message.contains("timed out")));
    assert_eq!(run.status, "timed_out");
    assert_eq!(payload["process_status"], "timed_out");
}

#[test]
fn terminal_command_rejects_non_terminal_widget_without_run_log_or_result() {
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
        .run_terminal_command_with_runner(
            terminal_input(
                &workspace.id,
                workbench_id,
                &widget_id,
                current_test_exe(),
                vec!["--help".to_owned()],
            ),
            |_| panic!("process runner should not be called for non-Terminal widgets"),
        )
        .expect("reject non-terminal widget");
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
fn terminal_command_rejects_cross_workbench_widget_without_run_log_or_result() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Incident", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    service
        .store
        .create_workspace_workbench("other-workbench", &workspace.id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-terminal",
            workspace_id: &workspace.id,
            workbench_id: "other-workbench",
            definition_id: TERMINAL_WIDGET_DEFINITION_ID,
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
        .expect("insert other terminal widget");

    let summary = service
        .run_terminal_command_with_runner(
            terminal_input(
                &workspace.id,
                workbench_id,
                "other-terminal",
                current_test_exe(),
                vec!["--help".to_owned()],
            ),
            |_| panic!("process runner should not be called for cross-workbench widgets"),
        )
        .expect("reject cross-workbench widget");
    let runs = service
        .store
        .list_widget_runs_for_widget("other-terminal")
        .expect("list runs");
    let logs = service
        .store
        .list_widget_logs_for_widget("other-terminal", 20)
        .expect("list logs");

    assert!(summary.is_none());
    assert!(runs.is_empty());
    assert!(logs.is_empty());
}

#[test]
fn terminal_command_result_json_records_truncation_flags() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_terminal_widget(&service);
    let mut input = terminal_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_test_exe(),
        vec!["--help".to_owned()],
    );
    input.stdout_cap_bytes = Some(8);

    let summary = service
        .run_terminal_command(input)
        .expect("run terminal command")
        .expect("terminal command summary");
    let payload = terminal_result_payload(&service, &summary.run_id);

    assert!(summary.stdout_truncated);
    assert_eq!(summary.stdout.len(), 8);
    assert_eq!(payload["stdout_truncated"], true);
    assert_eq!(payload["stderr_truncated"], false);
    assert_eq!(payload["stdout"].as_str().expect("stdout").len(), 8);
}

#[test]
fn terminal_process_runs_after_pre_run_transaction_is_committed() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_terminal_widget(&service);
    let observed_pre_run_records = RefCell::new(false);

    let summary = service
        .run_terminal_command_with_runner(
            terminal_input(
                &workspace_id,
                &workbench_id,
                &widget_id,
                "test-program".to_owned(),
                vec!["literal&&arg".to_owned()],
            ),
            |request: ProcessRunRequest| {
                assert_eq!(request.program, "test-program");
                assert_eq!(request.args, vec!["literal&&arg"]);

                let runs = service
                    .store
                    .list_widget_runs_for_widget(&widget_id)
                    .expect("list runs before process output");
                let logs = service
                    .store
                    .list_widget_logs_for_widget(&widget_id, 20)
                    .expect("list logs before process output");

                assert_eq!(runs.len(), 1);
                assert_eq!(runs[0].status, "running");
                assert!(logs
                    .iter()
                    .map(|log| log.message.as_str())
                    .any(|message| message == "Terminal process started"));
                *observed_pre_run_records.borrow_mut() = true;

                ProcessRunOutput {
                    status: ProcessRunStatus::Completed,
                    exit_code: Some(0),
                    stdout: "ok".to_owned(),
                    stderr: String::new(),
                    stdout_truncated: false,
                    stderr_truncated: false,
                    duration_ms: 1,
                    error_message: None,
                }
            },
        )
        .expect("run terminal command")
        .expect("terminal command summary");

    assert!(*observed_pre_run_records.borrow());
    assert_eq!(summary.status, "completed");
    assert_eq!(summary.stdout, "ok");
}

#[test]
fn timeout_helper_sleeps() {
    thread::sleep(Duration::from_millis(250));
}

fn add_terminal_widget(service: &WorkspaceService) -> (String, String, String) {
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
            TERMINAL_WIDGET_DEFINITION_ID,
            "Terminal",
            "tool",
        )
        .expect("add terminal widget")
        .expect("state after add");
    let widget_id = state.widget_instances[0].id.clone();

    (workspace.id, workbench_id, widget_id)
}

fn terminal_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
    program: String,
    args: Vec<String>,
) -> RunTerminalCommandInput {
    RunTerminalCommandInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        program,
        args,
        working_directory: env::current_dir().expect("current dir"),
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(16 * 1024),
    }
}

fn terminal_result_payload(service: &WorkspaceService, run_id: &str) -> Value {
    let results = service
        .store
        .list_widget_results(run_id)
        .expect("list widget results");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].result_type, "terminal_command_result");

    serde_json::from_str(results[0].payload.as_deref().expect("result payload"))
        .expect("result payload json")
}

fn current_test_exe() -> String {
    env::current_exe()
        .expect("current test exe")
        .to_string_lossy()
        .into_owned()
}

fn unique_test_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    format!("{}-{nanos}", std::process::id())
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}
