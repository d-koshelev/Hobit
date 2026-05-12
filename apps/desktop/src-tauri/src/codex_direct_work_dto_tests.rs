use std::path::PathBuf;

use hobit_app::{CodexDirectWorkRunSummary, RunCodexDirectWorkInput};

use crate::codex_direct_work_dto::{RunCodexDirectWorkRequest, RunCodexDirectWorkResponseDto};

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
