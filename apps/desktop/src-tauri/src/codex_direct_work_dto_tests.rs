use std::path::PathBuf;

use hobit_app::{
    CancelCodexDirectWorkRunInput, CodexDirectWorkCancellationSummary,
    CodexDirectWorkForceKillSummary, CodexDirectWorkRunSummary, CodexDirectWorkStreamEventSummary,
    CodexDirectWorkStreamStartSummary, DirectWorkValidationRunSummary,
    ForceKillCodexDirectWorkRunInput, RunCodexDirectWorkInput, RunDirectWorkValidationInput,
};

use crate::codex_direct_work_dto::{
    CancelCodexDirectWorkRunRequest, CancelCodexDirectWorkRunResponseDto, DirectWorkStreamEventDto,
    ForceKillCodexDirectWorkRunRequest, ForceKillCodexDirectWorkRunResponseDto,
    RunCodexDirectWorkRequest, RunCodexDirectWorkResponseDto, RunDirectWorkValidationRequest,
    RunDirectWorkValidationResponseDto, StartCodexDirectWorkStreamRequest,
    StartCodexDirectWorkStreamResponseDto, DIRECT_WORK_STREAM_EVENT_NAME,
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
        skip_git_repo_check: false,
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
    assert!(!input.skip_git_repo_check);
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
        skip_git_repo_check: true,
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
    assert!(input.skip_git_repo_check);
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
fn resolves_direct_work_home_alias_for_stream_request() {
    let request = StartCodexDirectWorkStreamRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "coordinator_1".to_owned(),
        codex_executable: "codex".to_owned(),
        repo_root: "~".to_owned(),
        operator_prompt: "Run from home.".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        skip_git_repo_check: true,
        timeout_ms: None,
        stdout_cap_bytes: None,
        stderr_cap_bytes: None,
    };

    let input = RunCodexDirectWorkInput::from(request);

    assert_ne!(input.repo_root, PathBuf::from("~"));
    assert!(input.repo_root.is_absolute());
    assert!(input.skip_git_repo_check);
}

#[test]
fn resolves_direct_work_home_alias_with_explicit_home_helper() {
    let home = PathBuf::from("C:/Users/Dmitry");

    assert_eq!(
        crate::codex_direct_work_dto::resolve_direct_work_path_with_home("~", Some(home.clone()),),
        home,
    );
    assert_eq!(
        crate::codex_direct_work_dto::resolve_direct_work_path_with_home(
            "~/project",
            Some(PathBuf::from("C:/Users/Dmitry")),
        ),
        PathBuf::from("C:/Users/Dmitry").join("project"),
    );
}

#[test]
fn maps_run_direct_work_validation_request_to_app_input() {
    let request = RunDirectWorkValidationRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        repo_root: "C:/work/repo".to_owned(),
        validation_profile: "changed".to_owned(),
        timeout_ms: Some(30),
        stdout_cap_bytes: Some(31),
        stderr_cap_bytes: Some(32),
    };

    let input = RunDirectWorkValidationInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.repo_root, PathBuf::from("C:/work/repo"));
    assert_eq!(input.validation_profile, "changed");
    assert_eq!(input.timeout_ms, Some(30));
    assert_eq!(input.stdout_cap_bytes, Some(31));
    assert_eq!(input.stderr_cap_bytes, Some(32));
}

#[test]
fn maps_cancel_codex_direct_work_run_request_to_app_input() {
    let request = CancelCodexDirectWorkRunRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
    };

    let input = CancelCodexDirectWorkRunInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.run_id, "run_1");
}

#[test]
fn maps_force_kill_codex_direct_work_run_request_to_app_input() {
    let request = ForceKillCodexDirectWorkRunRequest {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
    };

    let input = ForceKillCodexDirectWorkRunInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.workbench_id, "wb_1");
    assert_eq!(input.widget_instance_id, "wid_1");
    assert_eq!(input.run_id, "run_1");
}

#[test]
fn maps_run_direct_work_validation_response_to_dto() {
    let summary = DirectWorkValidationRunSummary {
        run_id: "run_1".to_owned(),
        result_id: "result_1".to_owned(),
        result_type: "direct_work_validation_result".to_owned(),
        profile: "full".to_owned(),
        status: "failed".to_owned(),
        run_status: "completed".to_owned(),
        exit_code: Some(17),
        stdout: "out".to_owned(),
        stderr: "err".to_owned(),
        stdout_truncated: false,
        stderr_truncated: true,
        duration_ms: 8,
        error_message: Some("validation failed".to_owned()),
        command_summary: vec!["powershell".to_owned(), "-File".to_owned()],
        repo_root: "C:/work/repo".to_owned(),
        no_git_mutations: true,
        no_commit_push: true,
        git_mutations_performed_by_hobit: false,
    };

    let dto = RunDirectWorkValidationResponseDto::from(summary);

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.result_id, "result_1");
    assert_eq!(dto.result_type, "direct_work_validation_result");
    assert_eq!(dto.profile, "full");
    assert_eq!(dto.status, "failed");
    assert_eq!(dto.run_status, "completed");
    assert_eq!(dto.exit_code, Some(17));
    assert_eq!(dto.stdout, "out");
    assert_eq!(dto.stderr, "err");
    assert!(!dto.stdout_truncated);
    assert!(dto.stderr_truncated);
    assert_eq!(dto.duration_ms, 8);
    assert_eq!(dto.error_message.as_deref(), Some("validation failed"));
    assert_eq!(dto.command_summary, vec!["powershell", "-File"]);
    assert_eq!(dto.repo_root, "C:/work/repo");
    assert!(dto.no_git_mutations);
    assert!(dto.no_commit_push);
    assert!(!dto.git_mutations_performed_by_hobit);
}

#[test]
fn maps_cancel_codex_direct_work_run_response_to_dto() {
    let dto = CancelCodexDirectWorkRunResponseDto::from(CodexDirectWorkCancellationSummary {
        run_id: "run_1".to_owned(),
        status: "cancellation_requested".to_owned(),
        message: "Direct Work cancellation requested".to_owned(),
        cancellation_requested: true,
    });

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "cancellation_requested");
    assert_eq!(dto.message, "Direct Work cancellation requested");
    assert!(dto.cancellation_requested);
}

#[test]
fn maps_force_kill_codex_direct_work_run_response_to_dto() {
    let dto = ForceKillCodexDirectWorkRunResponseDto::from(CodexDirectWorkForceKillSummary {
        run_id: "run_1".to_owned(),
        status: "force_kill_requested".to_owned(),
        message: "Direct Work force kill requested".to_owned(),
        force_kill_requested: true,
    });

    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "force_kill_requested");
    assert_eq!(dto.message, "Direct Work force kill requested");
    assert!(dto.force_kill_requested);
}

#[test]
fn maps_direct_work_stream_event_to_tauri_payload() {
    let dto = DirectWorkStreamEventDto::from(CodexDirectWorkStreamEventSummary {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
        event_kind: "failed".to_owned(),
        line: None,
        text: None,
        parsed_codex_event_type: None,
        status: Some("failed".to_owned()),
        elapsed_ms: 12,
        is_final: true,
        error_message: Some("codex stream failed".to_owned()),
        stderr_preview: Some("stderr tail".to_owned()),
        exit_code: Some(2),
        final_status: Some("failed".to_owned()),
        failed_stage: Some("codex_exit".to_owned()),
    });

    assert_eq!(DIRECT_WORK_STREAM_EVENT_NAME, "direct-work://event");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.widget_instance_id, "wid_1");
    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.event_kind, "failed");
    assert_eq!(dto.status.as_deref(), Some("failed"));
    assert_eq!(dto.parsed_codex_event_type, None);
    assert_eq!(dto.elapsed_ms, 12);
    assert!(dto.is_final);
    assert_eq!(dto.error_message.as_deref(), Some("codex stream failed"));
    assert_eq!(dto.stderr_preview.as_deref(), Some("stderr tail"));
    assert_eq!(dto.exit_code, Some(2));
    assert_eq!(dto.final_status.as_deref(), Some("failed"));
    assert_eq!(dto.failed_stage.as_deref(), Some("codex_exit"));
}

#[test]
fn maps_cancelled_direct_work_stream_event_to_tauri_payload() {
    let dto = DirectWorkStreamEventDto::from(CodexDirectWorkStreamEventSummary {
        workspace_id: "ws_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
        event_kind: "cancelled".to_owned(),
        line: None,
        text: None,
        parsed_codex_event_type: None,
        status: Some("cancelled".to_owned()),
        elapsed_ms: 14,
        is_final: true,
        error_message: Some("codex exec --json cancelled by operator request".to_owned()),
        stderr_preview: None,
        exit_code: None,
        final_status: Some("cancelled".to_owned()),
        failed_stage: None,
    });

    assert_eq!(dto.event_kind, "cancelled");
    assert_eq!(dto.status.as_deref(), Some("cancelled"));
    assert!(dto.is_final);
    assert_eq!(dto.final_status.as_deref(), Some("cancelled"));
    assert_eq!(dto.failed_stage, None);
}
