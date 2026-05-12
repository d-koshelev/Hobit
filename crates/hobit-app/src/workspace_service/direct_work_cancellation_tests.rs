use super::*;

use std::cell::RefCell;
use std::env;
use std::path::PathBuf;

use hobit_storage_sqlite::SqliteStore;
use hobit_tools::codex_cli::{
    CodexDirectStreamEvent, CodexDirectStreamEventKind, CodexDirectStreamOutput,
    CodexDirectStreamRequest, CodexDirectStreamStatus,
};
use serde_json::Value;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn direct_work_cancellation_records_request_and_cancelled_final_result() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run until cancelled.",
    );
    let start = service
        .start_codex_direct_work_stream(input.clone())
        .expect("start stream")
        .expect("stream start summary");
    let cancellation_input = cancel_input(&workspace_id, &workbench_id, &widget_id, &start.run_id);

    let inspection = service
        .inspect_codex_direct_work_cancellation(cancellation_input.clone())
        .expect("inspect cancellation");
    assert_eq!(inspection.status, "active");

    let requested = service
        .record_codex_direct_work_cancellation_requested(cancellation_input)
        .expect("record cancellation request");
    assert_eq!(requested.status, "cancellation_requested");
    assert!(requested.cancellation_requested);

    let emitted_events = RefCell::new(Vec::new());
    let summary = service
        .run_codex_direct_work_stream_with_runner(
            input,
            &start.run_id,
            |request, on_event| {
                on_event(cancelled_event());
                cancelled_output(&request)
            },
            |event| emitted_events.borrow_mut().push(event),
        )
        .expect("run cancelled stream")
        .expect("cancelled stream summary");

    let run = service
        .store
        .get_widget_run(&summary.run_id)
        .expect("get run")
        .expect("run row");
    let results = service
        .store
        .list_widget_results(&summary.run_id)
        .expect("list widget results");
    let payload: Value =
        serde_json::from_str(results[0].payload.as_deref().expect("result payload"))
            .expect("result payload json");
    let logs = service
        .list_widget_logs(&workspace_id, &workbench_id, &widget_id, 20)
        .expect("list logs")
        .expect("widget logs");
    let events = emitted_events.borrow();

    assert_eq!(summary.status, "cancelled");
    assert_eq!(run.status, "cancelled");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].status, "cancelled");
    assert_eq!(payload["status"], "cancelled");
    assert_eq!(payload["codex_status"], "cancelled");
    assert_eq!(payload["cancellation_requested"], true);
    assert_eq!(payload["no_auto_commit"], true);
    assert_eq!(payload["no_auto_push"], true);
    assert_eq!(payload["git_mutations_performed_by_hobit"], false);
    assert!(widget_log_messages(&logs).contains(&"Direct Work cancellation requested"));
    assert!(widget_log_messages(&logs).contains(&"Codex stream cancelled"));
    assert!(events
        .iter()
        .any(|event| event.event_kind == "cancelled" && event.is_final));
}

#[test]
fn direct_work_cancellation_unknown_run_returns_not_found() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);

    let summary = service
        .inspect_codex_direct_work_cancellation(cancel_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            "missing-run",
        ))
        .expect("inspect missing run");

    assert_eq!(summary.status, "not_found");
    assert!(!summary.cancellation_requested);
}

#[test]
fn direct_work_cancellation_already_completed_run_returns_already_finished() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run once.",
    );
    let start = service
        .start_codex_direct_work_stream(input.clone())
        .expect("start stream")
        .expect("stream start summary");

    service
        .run_codex_direct_work_stream_with_runner(
            input,
            &start.run_id,
            |request, _on_event| completed_output(&request),
            |_| {},
        )
        .expect("run completed stream")
        .expect("completed summary");

    let summary = service
        .inspect_codex_direct_work_cancellation(cancel_input(
            &workspace_id,
            &workbench_id,
            &widget_id,
            &start.run_id,
        ))
        .expect("inspect completed run");

    assert_eq!(summary.status, "already_finished");
    assert!(summary.message.contains("completed"));
    assert!(!summary.cancellation_requested);
}

#[test]
fn direct_work_cancellation_rejects_cross_workspace_without_logs() {
    let service = initialized_service();
    let (workspace_id, workbench_id, widget_id) = add_direct_work_widget(&service);
    let (other_workspace_id, other_workbench_id, other_widget_id) =
        add_direct_work_widget(&service);
    let input = direct_work_input(
        &workspace_id,
        &workbench_id,
        &widget_id,
        current_repo_root(),
        "Run until cancelled.",
    );
    let start = service
        .start_codex_direct_work_stream(input)
        .expect("start stream")
        .expect("stream start summary");

    let summary = service
        .record_codex_direct_work_cancellation_requested(cancel_input(
            &other_workspace_id,
            &other_workbench_id,
            &other_widget_id,
            &start.run_id,
        ))
        .expect("reject cross-workspace cancellation");
    let logs = service
        .list_widget_logs(
            &other_workspace_id,
            &other_workbench_id,
            &other_widget_id,
            20,
        )
        .expect("list logs")
        .expect("widget logs");

    assert_eq!(summary.status, "not_found");
    assert_eq!(widget_log_messages(&logs), vec!["Widget added"]);
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
) -> RunCodexDirectWorkInput {
    RunCodexDirectWorkInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        codex_executable: "codex".to_owned(),
        repo_root,
        operator_prompt: operator_prompt.to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn cancel_input(
    workspace_id: &str,
    workbench_id: &str,
    widget_id: &str,
    run_id: &str,
) -> CancelCodexDirectWorkRunInput {
    CancelCodexDirectWorkRunInput {
        workspace_id: workspace_id.to_owned(),
        workbench_id: workbench_id.to_owned(),
        widget_instance_id: widget_id.to_owned(),
        run_id: run_id.to_owned(),
    }
}

fn cancelled_event() -> CodexDirectStreamEvent {
    CodexDirectStreamEvent {
        kind: CodexDirectStreamEventKind::Cancelled,
        elapsed_ms: 17,
        line: None,
        text: None,
        parsed_json: None,
        error_message: Some("codex exec --json cancelled by operator request".to_owned()),
        stderr_preview: None,
        exit_code: None,
        final_status: Some("cancelled".to_owned()),
        failed_stage: None,
    }
}

fn cancelled_output(request: &CodexDirectStreamRequest) -> CodexDirectStreamOutput {
    stream_output(request, CodexDirectStreamStatus::Cancelled)
}

fn completed_output(request: &CodexDirectStreamRequest) -> CodexDirectStreamOutput {
    stream_output(request, CodexDirectStreamStatus::Completed)
}

fn stream_output(
    request: &CodexDirectStreamRequest,
    status: CodexDirectStreamStatus,
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
            "<operator-prompt-stdin>".to_owned(),
        ],
        event_count: 1,
    }
}

fn current_repo_root() -> PathBuf {
    env::current_dir().expect("current dir")
}

fn widget_log_messages(logs: &[WidgetLogSummary]) -> Vec<&str> {
    logs.iter().map(|log| log.message.as_str()).collect()
}
