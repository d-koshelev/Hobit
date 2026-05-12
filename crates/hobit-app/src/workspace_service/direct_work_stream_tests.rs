use super::*;

use std::cell::RefCell;
use std::env;
use std::path::PathBuf;

use hobit_storage_sqlite::{NewWidgetInstance, SqliteStore};
use hobit_tools::codex_cli::{
    CodexApprovalPolicy, CodexDirectStreamEvent, CodexDirectStreamEventKind,
    CodexDirectStreamOutput, CodexDirectStreamRequest, CodexDirectStreamStatus, CodexSandboxMode,
};
use serde_json::Value;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn codex_direct_work_stream_start_creates_running_run_and_initial_logs() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let start = service
        .start_codex_direct_work_stream(direct_work_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            current_repo_root(),
            "Stream Codex.",
            "workspace_write",
            "never",
        ))
        .expect("start direct work stream")
        .expect("stream start summary");
    let run = service
        .store
        .get_widget_run(&start.run_id)
        .expect("get run")
        .expect("run row");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let command_payload: Value =
        serde_json::from_str(run.command_payload.as_deref().expect("command payload"))
            .expect("command payload json");

    assert_eq!(start.status, "started");
    assert_eq!(run.status, "running");
    assert_eq!(run.command_kind.as_deref(), Some("codex_direct_work"));
    assert_eq!(command_payload["streaming"], true);
    assert_eq!(command_payload["operator_prompt"], "Stream Codex.");
    assert_eq!(
        widget_log_messages(&logs),
        vec![
            "Widget added",
            "Direct Work stream requested",
            "Codex process starting",
        ]
    );
}

#[test]
fn codex_direct_work_stream_start_rejects_non_allowed_widget_without_leaks() {
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

    let start = service
        .start_codex_direct_work_stream(direct_work_input(
            &workspace.id,
            workbench_id,
            &widget_id,
            current_repo_root(),
            "Run Codex.",
            "workspace_write",
            "never",
        ))
        .expect("reject non-allowed widget");
    let runs = service
        .store
        .list_widget_runs_for_widget(&widget_id)
        .expect("list runs");
    let logs = service
        .list_widget_logs(&workspace.id, workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");

    assert!(start.is_none());
    assert!(runs.is_empty());
    assert_eq!(widget_log_messages(&logs), vec!["Widget added"]);
}

#[test]
fn codex_direct_work_stream_start_rejects_cross_workspace_and_workbench_without_leaks() {
    let service = initialized_service();
    let (workspace_id, workbench_id, _widget_id) = add_direct_work_widget(&service);
    let (other_workspace_id, _other_workbench_id, other_widget_id) =
        add_direct_work_widget(&service);

    let cross_workspace_start = service
        .start_codex_direct_work_stream(direct_work_input(
            &workspace_id,
            &workbench_id,
            &other_widget_id,
            current_repo_root(),
            "Run Codex.",
            "workspace_write",
            "never",
        ))
        .expect("reject cross-workspace widget");
    let cross_workspace_runs = service
        .store
        .list_widget_runs_for_widget(&other_widget_id)
        .expect("list cross-workspace widget runs");

    assert_ne!(workspace_id, other_workspace_id);
    assert!(cross_workspace_start.is_none());
    assert!(cross_workspace_runs.is_empty());

    service
        .store
        .create_workspace_workbench("other-workbench-stream", &workspace_id, None)
        .expect("create other workbench");
    service
        .store
        .insert_widget_instance(NewWidgetInstance {
            id: "other-agent-run-stream",
            workspace_id: &workspace_id,
            workbench_id: "other-workbench-stream",
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

    let cross_workbench_start = service
        .start_codex_direct_work_stream(direct_work_input(
            &workspace_id,
            &workbench_id,
            "other-agent-run-stream",
            current_repo_root(),
            "Run Codex.",
            "workspace_write",
            "never",
        ))
        .expect("reject cross-workbench widget");
    let cross_workbench_runs = service
        .store
        .list_widget_runs_for_widget("other-agent-run-stream")
        .expect("list cross-workbench runs");
    let cross_workbench_logs = service
        .store
        .list_widget_logs_for_widget("other-agent-run-stream", 20)
        .expect("list cross-workbench logs");

    assert!(cross_workbench_start.is_none());
    assert!(cross_workbench_runs.is_empty());
    assert!(cross_workbench_logs.is_empty());
}

#[test]
fn codex_direct_work_stream_events_append_logs_and_emit_tauri_ready_payloads() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run Codex stream.",
        "workspace_write",
        "never",
    );
    let start = service
        .start_codex_direct_work_stream(input.clone())
        .expect("start stream")
        .expect("stream start summary");
    let emitted_events = RefCell::new(Vec::new());

    let summary = service
        .run_codex_direct_work_stream_with_runner(
            input,
            &start.run_id,
            |request, on_event| {
                assert_eq!(request.program.as_deref(), Some("codex"));
                assert_eq!(request.prompt, "Run Codex stream.");
                assert_eq!(request.sandbox, CodexSandboxMode::WorkspaceWrite);
                assert_eq!(request.approval_policy, CodexApprovalPolicy::Never);

                emit_completed_stream_events(on_event);
                completed_stream_output(&request, 6)
            },
            |event| emitted_events.borrow_mut().push(event),
        )
        .expect("run direct work stream")
        .expect("direct work stream summary");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let messages = widget_log_messages(&logs);
    let events = emitted_events.borrow();

    assert_eq!(summary.status, "completed");
    assert!(messages.contains(&"Codex stdout"));
    assert!(messages.contains(&"Codex stderr"));
    assert!(messages.contains(&"Codex JSON event"));
    assert!(messages.contains(&"Codex final message received"));
    assert!(messages.contains(&"Codex stream completed"));
    assert_eq!(events.len(), 6);
    assert_eq!(events[0].run_id, start.run_id);
    assert_eq!(
        events
            .iter()
            .find(|event| event.event_kind == "codex_json_event")
            .and_then(|event| event.parsed_codex_event_type.as_deref()),
        Some("thread.started")
    );
    assert!(events
        .iter()
        .any(|event| event.event_kind == "completed" && event.is_final));
}

#[test]
fn codex_direct_work_stream_completion_finishes_run_and_stores_result_payload() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run Codex stream.",
        "workspace_write",
        "never",
    );
    let start = service
        .start_codex_direct_work_stream(input.clone())
        .expect("start stream")
        .expect("stream start summary");

    let summary = service
        .run_codex_direct_work_stream_with_runner(
            input,
            &start.run_id,
            |request, on_event| {
                emit_completed_stream_events(on_event);
                completed_stream_output(&request, 6)
            },
            |_| {},
        )
        .expect("run direct work stream")
        .expect("direct work stream summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = stream_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, "completed");
    assert_eq!(summary.stdout, "codex stdout");
    assert_eq!(summary.stderr, "codex stderr");
    assert_eq!(summary.final_message.as_deref(), Some("Final response"));
    assert!(summary.no_auto_commit);
    assert!(summary.no_auto_push);
    assert!(!summary.git_mutations_performed_by_hobit);
    assert_eq!(run.status, "completed");
    assert_eq!(payload["streaming"], true);
    assert_eq!(payload["event_count"], 6);
    assert_eq!(payload["stdout"], "codex stdout");
    assert_eq!(payload["stderr"], "codex stderr");
    assert_eq!(payload["no_auto_commit"], true);
    assert_eq!(payload["no_auto_push"], true);
    assert_eq!(payload["git_mutations_performed_by_hobit"], false);
}

#[test]
fn codex_direct_work_stream_runner_is_called_after_start_transaction_is_committed() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run Codex stream.",
        "workspace_write",
        "never",
    );
    let start = service
        .start_codex_direct_work_stream(input.clone())
        .expect("start stream")
        .expect("stream start summary");
    let observed_pre_run_records = RefCell::new(false);

    let summary = service
        .run_codex_direct_work_stream_with_runner(
            input,
            &start.run_id,
            |request, on_event| {
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
                emit_completed_stream_events(on_event);
                completed_stream_output(&request, 6)
            },
            |_| {},
        )
        .expect("run direct work stream")
        .expect("direct work stream summary");

    assert!(*observed_pre_run_records.borrow());
    assert_eq!(summary.status, "completed");
}

#[test]
fn codex_direct_work_stream_failed_and_timed_out_outputs_map_final_run_statuses() {
    assert_stream_status_mapping(CodexDirectStreamStatus::Failed, "failed");
    assert_stream_status_mapping(CodexDirectStreamStatus::FailedToStart, "failed");
    assert_stream_status_mapping(CodexDirectStreamStatus::TimedOut, "timed_out");
    assert_stream_status_mapping(CodexDirectStreamStatus::Cancelled, "cancelled");
}

fn assert_stream_status_mapping(status: CodexDirectStreamStatus, expected_run_status: &str) {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run Codex stream.",
        "workspace_write",
        "never",
    );
    let start = service
        .start_codex_direct_work_stream(input.clone())
        .expect("start stream")
        .expect("stream start summary");
    let emitted_events = RefCell::new(Vec::new());

    let summary = service
        .run_codex_direct_work_stream_with_runner(
            input,
            &start.run_id,
            |request, on_event| {
                let event_kind = match status {
                    CodexDirectStreamStatus::TimedOut => CodexDirectStreamEventKind::TimedOut,
                    CodexDirectStreamStatus::Cancelled => CodexDirectStreamEventKind::Cancelled,
                    _ => CodexDirectStreamEventKind::Failed,
                };
                on_event(CodexDirectStreamEvent {
                    kind: event_kind,
                    elapsed_ms: 11,
                    line: None,
                    text: None,
                    parsed_json: None,
                    error_message: Some("stream stopped".to_owned()),
                    stderr_preview: Some("stream stderr detail".to_owned()),
                    exit_code: if status == CodexDirectStreamStatus::Cancelled {
                        None
                    } else {
                        Some(22)
                    },
                    final_status: Some(status.as_str().to_owned()),
                    failed_stage: direct_work_stream_failed_stage(status).map(ToOwned::to_owned),
                });
                stream_output(&request, status, 1)
            },
            |event| emitted_events.borrow_mut().push(event),
        )
        .expect("run direct work stream")
        .expect("direct work stream summary");
    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let payload = stream_result_payload(&service, &summary.run_id);

    assert_eq!(summary.status, expected_run_status);
    assert_eq!(run.status, expected_run_status);
    assert_eq!(payload["status"], expected_run_status);
    assert_eq!(payload["codex_status"], status.as_str());
    assert_eq!(
        payload["failed_stage"].as_str(),
        direct_work_stream_failed_stage(status)
    );
    let events = emitted_events.borrow();
    let final_event = events
        .iter()
        .find(|event| event.is_final)
        .expect("final failure event");
    assert_eq!(final_event.error_message.as_deref(), Some("stream stopped"));
    assert_eq!(
        final_event.stderr_preview.as_deref(),
        Some("stream stderr detail")
    );
    assert_eq!(
        final_event.exit_code,
        if status == CodexDirectStreamStatus::Cancelled {
            None
        } else {
            Some(22)
        }
    );
    assert_eq!(final_event.final_status.as_deref(), Some(status.as_str()));
    assert_eq!(
        final_event.failed_stage.as_deref(),
        direct_work_stream_failed_stage(status)
    );
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
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn emit_completed_stream_events(on_event: &mut dyn FnMut(CodexDirectStreamEvent)) {
    on_event(CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::Started,
        elapsed_ms: 1,
        line: None,
        text: None,
        parsed_json: None,
        error_message: None,
        stderr_preview: None,
        exit_code: None,
        final_status: None,
        failed_stage: None,
    });
    on_event(CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::StdoutLine,
        elapsed_ms: 2,
        line: Some("plain stdout".to_owned()),
        text: None,
        parsed_json: None,
        error_message: None,
        stderr_preview: None,
        exit_code: None,
        final_status: None,
        failed_stage: None,
    });
    on_event(CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::StderrLine,
        elapsed_ms: 3,
        line: Some("plain stderr".to_owned()),
        text: None,
        parsed_json: None,
        error_message: None,
        stderr_preview: None,
        exit_code: None,
        final_status: None,
        failed_stage: None,
    });
    on_event(CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::CodexJsonEvent,
        elapsed_ms: 4,
        line: Some(r#"{"type":"thread.started"}"#.to_owned()),
        text: None,
        parsed_json: Some(r#"{"type":"thread.started"}"#.to_owned()),
        error_message: None,
        stderr_preview: None,
        exit_code: None,
        final_status: None,
        failed_stage: None,
    });
    on_event(CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::FinalMessage,
        elapsed_ms: 5,
        line: None,
        text: Some("Final response".to_owned()),
        parsed_json: None,
        error_message: None,
        stderr_preview: None,
        exit_code: None,
        final_status: None,
        failed_stage: None,
    });
    on_event(CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::Completed,
        elapsed_ms: 6,
        line: None,
        text: None,
        parsed_json: None,
        error_message: None,
        stderr_preview: None,
        exit_code: Some(0),
        final_status: Some("completed".to_owned()),
        failed_stage: None,
    });
}

fn completed_stream_output(
    request: &CodexDirectStreamRequest,
    event_count: usize,
) -> CodexDirectStreamOutput {
    stream_output(request, CodexDirectStreamStatus::Completed, event_count)
}

fn stream_output(
    request: &CodexDirectStreamRequest,
    status: CodexDirectStreamStatus,
    event_count: usize,
) -> CodexDirectStreamOutput {
    CodexDirectStreamOutput {
        status,
        exit_code: match status {
            CodexDirectStreamStatus::Completed => Some(0),
            CodexDirectStreamStatus::Cancelled => None,
            _ => Some(1),
        },
        final_message: if status == CodexDirectStreamStatus::Completed {
            Some("Final response".to_owned())
        } else {
            None
        },
        stdout_collected: "codex stdout".to_owned(),
        stderr_collected: "codex stderr".to_owned(),
        stdout_truncated: false,
        stderr_truncated: false,
        duration_ms: 42,
        error_message: match status {
            CodexDirectStreamStatus::Completed => None,
            CodexDirectStreamStatus::FailedToStart => Some("could not start codex exec".to_owned()),
            CodexDirectStreamStatus::TimedOut => Some("codex exec timed out".to_owned()),
            CodexDirectStreamStatus::Failed => Some("codex exec failed".to_owned()),
            CodexDirectStreamStatus::Cancelled => Some("codex exec cancelled".to_owned()),
        },
        command_summary: vec![
            "codex".to_owned(),
            "--cd".to_owned(),
            request.repo_root.display().to_string(),
            "exec".to_owned(),
            "--json".to_owned(),
            "--output-last-message".to_owned(),
            "<temp-file>".to_owned(),
            "<operator-prompt>".to_owned(),
        ],
        event_count,
    }
}

fn stream_result_payload(service: &WorkspaceService, run_id: &str) -> Value {
    let results = service
        .store
        .list_widget_results(run_id)
        .expect("list widget results");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].result_type, "codex_direct_work_result");

    serde_json::from_str(results[0].payload.as_deref().expect("result payload"))
        .expect("result payload json")
}

fn current_repo_root() -> PathBuf {
    env::current_dir().expect("current dir")
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}

fn direct_work_stream_failed_stage(status: CodexDirectStreamStatus) -> Option<&'static str> {
    match status {
        CodexDirectStreamStatus::Completed => None,
        CodexDirectStreamStatus::FailedToStart => Some("process_start"),
        CodexDirectStreamStatus::TimedOut => Some("codex_stream"),
        CodexDirectStreamStatus::Failed => Some("codex_exit"),
        CodexDirectStreamStatus::Cancelled => None,
    }
}
