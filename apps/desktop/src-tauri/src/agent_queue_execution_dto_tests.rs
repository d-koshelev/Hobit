use std::path::PathBuf;

use hobit_app::{AssignedAgentQueueTaskStartSummary, RunCodexDirectWorkInput};

use crate::agent_queue_execution_dto::{
    StartAssignedAgentQueueTaskRequest, StartAssignedAgentQueueTaskResponseDto,
};

#[test]
fn maps_start_assigned_agent_queue_task_request_to_app_input() {
    let request = StartAssignedAgentQueueTaskRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
        codex_executable: "codex.cmd".to_owned(),
        repo_root: "C:/work/repo".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(10),
        stdout_cap_bytes: Some(11),
        stderr_cap_bytes: Some(12),
    };

    let input = hobit_app::StartAssignedAgentQueueTaskInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
    assert_eq!(input.codex_executable, "codex.cmd");
    assert_eq!(input.repo_root, PathBuf::from("C:/work/repo"));
    assert_eq!(input.sandbox, "workspace_write");
    assert_eq!(input.approval_policy, "never");
    assert_eq!(input.timeout_ms, Some(10));
    assert_eq!(input.stdout_cap_bytes, Some(11));
    assert_eq!(input.stderr_cap_bytes, Some(12));
}

#[test]
fn maps_start_assigned_agent_queue_task_summary_to_dto() {
    let dto = StartAssignedAgentQueueTaskResponseDto::from(AssignedAgentQueueTaskStartSummary {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
        workbench_id: "wb_1".to_owned(),
        executor_widget_instance_id: "wid_1".to_owned(),
        run_id: "run_1".to_owned(),
        status: "started".to_owned(),
        direct_work_input: RunCodexDirectWorkInput {
            workspace_id: "ws_1".to_owned(),
            workbench_id: "wb_1".to_owned(),
            widget_instance_id: "wid_1".to_owned(),
            codex_executable: "codex".to_owned(),
            repo_root: PathBuf::from("C:/work/repo"),
            operator_prompt: "Prompt".to_owned(),
            sandbox: "workspace_write".to_owned(),
            approval_policy: "never".to_owned(),
            timeout_ms: Some(10),
            stdout_cap_bytes: Some(11),
            stderr_cap_bytes: Some(12),
        },
    });

    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.queue_item_id, "task_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.executor_widget_instance_id, "wid_1");
    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "started");
}
