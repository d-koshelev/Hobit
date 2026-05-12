use std::path::PathBuf;

use hobit_app::{
    CodexDirectWorkRunSummary, CodexDirectWorkStreamEventSummary,
    CodexDirectWorkStreamStartSummary, RunCodexDirectWorkInput,
};

use crate::codex_direct_work_dto::{
    DirectWorkStreamEventDto, RunCodexDirectWorkRequest, RunCodexDirectWorkResponseDto,
    StartCodexDirectWorkStreamRequest, StartCodexDirectWorkStreamResponseDto,
    DIRECT_WORK_STREAM_EVENT_NAME,
};

#[test]
fn maps_run_codex_direct_work_request_to_app_input() {
    let request = RunCodexDirectWorkRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        codex_executable: "codex".to_owned(),
        repo_root: "C:/work/repo".to_owned(),
        operator_prompt: "Implement block.".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "on_request".to_owned(),
        timeout_ms: Some(10),
        stdout_cap_bytes: Some(11),
        stderr_cap_bytes: Some(12),
    };

    let input = RunCodexDirectWorkInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.codex_executable, "codex");
    assert_eq!(input.repo_root, PathBuf::from("C:/work/repo"));
    assert_eq!(input.operator_prompt, "Implement block.");
    assert_eq!(input.sandbox, "workspace_write");
    assert_eq!(input.approval_policy, "on_request");
    assert_eq!(input.timeout_ms, Some(10));
    assert_eq!(input.stdout_cap_bytes, Some(11));
    assert_eq!(input.stderr_cap_bytes, Some(12));
}

#[test]
fn maps_run_codex_direct_work_response_to_dto() {
    let summary = CodexDirectWorkRunSummary {
        run_id: "run_1".to_owned(),
        result_id: "result_1".to_owned(),
        result_type: "codex_direct_work_result".to_owned(),
        executor_kind: "codex_cli".to_owned(),
        mode: "direct_work".to_owned(),
        repo_root: "C:/work/repo".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        command_summary: vec!["codex".to_owned(), "exec".to_owned()],
        status: "completed".to_owned(),
        exit_code: Some(0),
        stdout: "out".to_owned(),
        stderr: "err".to_owned(),
        stdout_truncated: false,
        stderr_truncated: true,
        final_message: Some("Done".to_owned()),
        duration_ms: 7,
        error_message: None,
        no_auto_commit: true,
        no_auto_push: true,
        git_mutations_performed_by_hobit: false,
    };

    let dto = RunCodexDirectWorkResponseDto::from(summary);

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.result_id, "result_1");
    assert_eq!(dto.result_type, "codex_direct_work_result");
    assert_eq!(dto.executor_kind, "codex_cli");
    assert_eq!(dto.mode, "direct_work");
    assert_eq!(dto.repo_root, "C:/work/repo");
    assert_eq!(dto.sandbox, "workspace_write");
    assert_eq!(dto.approval_policy, "never");
    assert_eq!(dto.command_summary, vec!["codex", "exec"]);
    assert_eq!(dto.status, "completed");
    assert_eq!(dto.exit_code, Some(0));
    assert_eq!(dto.stdout, "out");
    assert_eq!(dto.stderr, "err");
    assert!(!dto.stdout_truncated);
    assert!(dto.stderr_truncated);
    assert_eq!(dto.final_message.as_deref(), Some("Done"));
    assert_eq!(dto.duration_ms, 7);
    assert_eq!(dto.error_message, None);
    assert!(dto.no_auto_commit);
    assert!(dto.no_auto_push);
    assert!(!dto.git_mutations_performed_by_hobit);
}

#[test]
fn maps_start_codex_direct_work_stream_request_to_app_input() {
    let request = StartCodexDirectWorkStreamRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        codex_executable: "codex.cmd".to_owned(),
        repo_root: "C:/work/repo".to_owned(),
        operator_prompt: "Stream block.".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(20),
        stdout_cap_bytes: Some(21),
        stderr_cap_bytes: Some(22),
    };

    let input = RunCodexDirectWorkInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.codex_executable, "codex.cmd");
    assert_eq!(input.repo_root, PathBuf::from("C:/work/repo"));
    assert_eq!(input.operator_prompt, "Stream block.");
    assert_eq!(input.sandbox, "workspace_write");
    assert_eq!(input.approval_policy, "never");
    assert_eq!(input.timeout_ms, Some(20));
    assert_eq!(input.stdout_cap_bytes, Some(21));
    assert_eq!(input.stderr_cap_bytes, Some(22));
}

#[test]
fn maps_start_codex_direct_work_stream_response_to_dto() {
    let dto = StartCodexDirectWorkStreamResponseDto::from(CodexDirectWorkStreamStartSummary {
        run_id: "run_1".to_owned(),
        status: "started".to_owned(),
    });

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "started");
}

#[test]
fn maps_direct_work_stream_event_to_tauri_payload() {
    let dto = DirectWorkStreamEventDto::from(CodexDirectWorkStreamEventSummary {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
        event_kind: "codex_json_event".to_owned(),
        line: Some(r#"{"type":"thread.started"}"#.to_owned()),
        text: None,
        parsed_codex_event_type: Some("thread.started".to_owned()),
        status: None,
        elapsed_ms: 12,
        is_final: false,
    });

    assert_eq!(DIRECT_WORK_STREAM_EVENT_NAME, "direct-work://event");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.widget_instance_id, "wid_1");
    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.event_kind, "codex_json_event");
    assert_eq!(
        dto.parsed_codex_event_type.as_deref(),
        Some("thread.started")
    );
    assert_eq!(dto.elapsed_ms, 12);
    assert!(!dto.is_final);
}
