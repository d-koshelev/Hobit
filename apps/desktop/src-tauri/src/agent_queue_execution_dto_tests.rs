use std::path::PathBuf;

use hobit_app::{
    AgentQueueTaskRunLink, AgentQueueTaskRunLinkId, AgentQueueTaskRunReviewStatus,
    AgentQueueTaskRunSource, AgentQueueTaskRunStatus, AssignedAgentQueueTaskStartSummary,
    RunCodexDirectWorkInput,
};

use crate::agent_queue_execution_dto::{
    AgentQueueTaskRunLinkDto, ListAgentQueueTaskRunLinksRequest,
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
            codex_thread_id: None,
            sandbox: "workspace_write".to_owned(),
            approval_policy: "never".to_owned(),
            skip_git_repo_check: false,
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

#[test]
fn maps_run_link_summary_to_safe_dto_without_raw_payload_fields() {
    let dto = AgentQueueTaskRunLinkDto::from(AgentQueueTaskRunLink {
        link_id: AgentQueueTaskRunLinkId("link_1".to_owned()),
        workspace_id: "ws_1".to_owned(),
        queue_task_id: "task_1".to_owned(),
        executor_widget_id: "wid_1".to_owned(),
        direct_work_run_id: "run_1".to_owned(),
        source: AgentQueueTaskRunSource::Manual,
        status: AgentQueueTaskRunStatus::Completed,
        started_at: "2026-05-22T10:00:00.000Z".to_owned(),
        completed_at: Some("2026-05-22T10:01:00.000Z".to_owned()),
        validation_status: Some("not_run".to_owned()),
        review_status: Some(AgentQueueTaskRunReviewStatus::ReviewNeeded),
        created_at: "2026-05-22T10:00:00.000Z".to_owned(),
        updated_at: "2026-05-22T10:01:00.000Z".to_owned(),
    });

    assert_eq!(dto.link_id, "link_1");
    assert_eq!(dto.queue_task_id, "task_1");
    assert_eq!(dto.executor_widget_id, "wid_1");
    assert_eq!(dto.direct_work_run_id, "run_1");
    assert_eq!(dto.source, "manual");
    assert_eq!(dto.status, "completed");
    assert_eq!(dto.review_status.as_deref(), Some("review_needed"));

    let dto_json = serde_json::to_value(&dto).expect("serialize dto");
    let object = dto_json.as_object().expect("dto object");
    for forbidden_field in [
        "prompt",
        "operator_prompt",
        "stdout",
        "stderr",
        "final_response",
        "diff",
        "logs",
        "command_payload",
        "payload_json",
        "repo_root",
        "secrets",
    ] {
        assert!(
            !object.contains_key(forbidden_field),
            "run link DTO must not expose {forbidden_field}"
        );
    }
}

#[test]
fn list_run_links_request_uses_queue_task_identity_only() {
    let request = ListAgentQueueTaskRunLinksRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
    };

    assert_eq!(request.workspace_id, "ws_1");
    assert_eq!(request.queue_item_id, "task_1");
}
