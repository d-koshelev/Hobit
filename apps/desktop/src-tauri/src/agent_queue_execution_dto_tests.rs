use std::path::PathBuf;

use hobit_app::{
    AgentQueueTaskRunLink, AgentQueueTaskRunLinkId, AgentQueueTaskRunReviewStatus,
    AgentQueueTaskRunSource, AgentQueueTaskRunStatus, AssignedAgentQueueTaskStartSummary,
    RunCodexDirectWorkInput,
};

use crate::agent_queue_execution_dto::{
    AgentQueueTaskRunLinkDto, ListAgentQueueTaskRunLinksRequest, QueueWorkerStartContextRequest,
    StartAssignedAgentQueueTaskRequest, StartAssignedAgentQueueTaskResponseDto,
};

#[test]
fn maps_start_assigned_agent_queue_task_request_to_app_input() {
    let request = StartAssignedAgentQueueTaskRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
        queue_owner_widget_instance_id: Some("queue_widget_1".to_owned()),
        codex_executable: "codex.cmd".to_owned(),
        repo_root: "C:/work/repo".to_owned(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(10),
        stdout_cap_bytes: Some(11),
        stderr_cap_bytes: Some(12),
        workflow_start_context: Some(QueueWorkerStartContextRequest {
            workflow_run_id: "workflow-run-1".to_owned(),
            workflow_action_id: Some("workflow-action-1".to_owned()),
            action_idempotency_key: Some("workflow-key-1".to_owned()),
            task_id: "task_1".to_owned(),
            executor_widget_id: Some("executor_1".to_owned()),
            settings_hash: "queue-settings-fnv1a64:0000000000000001".to_owned(),
            execution_target_hash: Some(
                "queue-execution-target-fnv1a64:0000000000000002".to_owned(),
            ),
            expected_queue_control_version: Some(2),
            actor_id: Some("operator-1".to_owned()),
            confirmation_token: Some("operator-confirmed".to_owned()),
        }),
    };

    let input = hobit_app::StartAssignedAgentQueueTaskInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
    assert_eq!(
        input.queue_owner_widget_instance_id.as_deref(),
        Some("queue_widget_1")
    );
    assert_eq!(input.codex_executable, "codex.cmd");
    assert_eq!(input.repo_root, PathBuf::from("C:/work/repo"));
    assert_eq!(input.sandbox, "workspace_write");
    assert_eq!(input.approval_policy, "never");
    assert_eq!(input.timeout_ms, Some(10));
    assert_eq!(input.stdout_cap_bytes, Some(11));
    assert_eq!(input.stderr_cap_bytes, Some(12));
    let context = input
        .workflow_start_context
        .expect("workflow start context");
    assert_eq!(context.workflow_run_id, "workflow-run-1");
    assert_eq!(
        context.workflow_action_id.as_deref(),
        Some("workflow-action-1")
    );
    assert_eq!(
        context.action_idempotency_key.as_deref(),
        Some("workflow-key-1")
    );
    assert_eq!(context.task_id, "task_1");
    assert_eq!(context.executor_widget_id.as_deref(), Some("executor_1"));
    assert_eq!(
        context.execution_target_hash.as_deref(),
        Some("queue-execution-target-fnv1a64:0000000000000002")
    );
    assert_eq!(context.expected_queue_control_version, Some(2));
}

#[test]
fn legacy_materialized_prompt_field_is_ignored_at_tauri_boundary() {
    let request: StartAssignedAgentQueueTaskRequest = serde_json::from_value(serde_json::json!({
        "workspace_id": "ws_1",
        "queue_item_id": "task_1",
        "queue_owner_widget_instance_id": null,
        "materialized_operator_prompt": "caller supplied override",
        "codex_executable": "codex.cmd",
        "repo_root": "C:/work/repo",
        "sandbox": "workspace_write",
        "approval_policy": "never",
        "timeout_ms": 10,
        "stdout_cap_bytes": 11,
        "stderr_cap_bytes": 12,
        "workflow_start_context": null
    }))
    .expect("deserialize legacy request");

    let input = hobit_app::StartAssignedAgentQueueTaskInput::from(request);

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
    assert_eq!(input.codex_executable, "codex.cmd");
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
        workflow_run_id: Some("workflow-run-1".to_owned()),
        workflow_action_id: Some("workflow-action-1".to_owned()),
        action_idempotency_key: Some("workflow-key-1".to_owned()),
        settings_hash: Some("queue-settings-fnv1a64:0000000000000001".to_owned()),
        current_run_state: Some("running".to_owned()),
        blocker: None,
    });

    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.queue_item_id, "task_1");
    assert_eq!(dto.workbench_id, "wb_1");
    assert_eq!(dto.executor_widget_instance_id, "wid_1");
    assert_eq!(dto.run_id, "run_1");
    assert_eq!(dto.status, "started");
    assert_eq!(dto.workflow_run_id.as_deref(), Some("workflow-run-1"));
    assert_eq!(dto.workflow_action_id.as_deref(), Some("workflow-action-1"));
    assert_eq!(
        dto.action_idempotency_key.as_deref(),
        Some("workflow-key-1")
    );
    assert_eq!(dto.current_run_state.as_deref(), Some("running"));
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
