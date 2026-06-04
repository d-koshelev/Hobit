use super::*;

use std::path::PathBuf;

use hobit_storage_sqlite::SqliteStore;
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
fn assigned_queue_task_start_creates_direct_work_run_and_marks_running() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", "Run this queue task.");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let plan = service
        .prepare_assigned_agent_queue_task_run(start_input(&workspace_id, &task.queue_item_id))
        .expect("prepare queue task run");
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start queue task");
    let stored_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    let run = service
        .store
        .get_widget_run(&start.run_id)
        .expect("get Direct Work run")
        .expect("Direct Work run");
    let command_payload: Value =
        serde_json::from_str(run.command_payload.as_deref().expect("command payload"))
            .expect("command payload JSON");

    assert_eq!(plan.executor_widget_instance_id, executor_id);
    assert_eq!(
        plan.direct_work_input.operator_prompt,
        "Run this queue task."
    );
    assert_eq!(start.status, "started");
    assert_eq!(start.executor_widget_instance_id, executor_id);
    assert_eq!(
        start.direct_work_input.operator_prompt,
        "Run this queue task."
    );
    assert_eq!(stored_task.status, "running");
    assert_eq!(run.status, "running");
    assert_eq!(run.command_kind.as_deref(), Some("codex_direct_work"));
    assert_eq!(command_payload["operator_prompt"], "Run this queue task.");
    assert_eq!(command_payload["no_auto_commit"], true);
    assert_eq!(command_payload["no_auto_push"], true);
    assert_eq!(command_payload["git_mutations_performed_by_hobit"], false);
}

#[test]
fn assigned_queue_task_start_uses_visible_materialized_prompt_override() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", "Stored task prompt.");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let mut input = start_input(&workspace_id, &task.queue_item_id);
    input.materialized_operator_prompt = Some(
        "Attached Queue Context\nVisible Skill Instructions\n\nStored task prompt.".to_owned(),
    );

    let plan = service
        .prepare_assigned_agent_queue_task_run(input.clone())
        .expect("prepare queue task run");
    let start = service
        .start_assigned_agent_queue_task(input)
        .expect("start queue task");
    let stored_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    let run = service
        .store
        .get_widget_run(&start.run_id)
        .expect("get Direct Work run")
        .expect("Direct Work run");
    let command_payload: Value =
        serde_json::from_str(run.command_payload.as_deref().expect("command payload"))
            .expect("command payload JSON");

    assert_eq!(
        plan.direct_work_input.operator_prompt,
        "Attached Queue Context\nVisible Skill Instructions\n\nStored task prompt."
    );
    assert_eq!(
        start.direct_work_input.operator_prompt,
        "Attached Queue Context\nVisible Skill Instructions\n\nStored task prompt."
    );
    assert_eq!(stored_task.prompt, "Stored task prompt.");
    assert_eq!(
        command_payload["operator_prompt"],
        "Attached Queue Context\nVisible Skill Instructions\n\nStored task prompt."
    );
}

#[test]
fn queue_owned_task_start_does_not_require_agent_executor_assignment() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue workspace", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let queue_widget_id = add_widget(
        &service,
        &workspace.id,
        workbench_id,
        AGENT_QUEUE_WIDGET_DEFINITION_ID,
        "Agent Queue",
    );
    let task = create_task(
        &service,
        &workspace.id,
        "queued",
        "Run this queue-owned task.",
    );
    let mut input = start_input(&workspace.id, &task.queue_item_id);
    input.queue_owner_widget_instance_id = Some(queue_widget_id.clone());

    let plan = service
        .prepare_assigned_agent_queue_task_run(input.clone())
        .expect("prepare queue-owned task run");
    let start = service
        .start_assigned_agent_queue_task(input)
        .expect("start queue-owned task");
    let stored_task = service
        .get_agent_queue_task(&workspace.id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    let run = service
        .store
        .get_widget_run(&start.run_id)
        .expect("get Direct Work run")
        .expect("Direct Work run");
    let link = service
        .get_latest_agent_queue_task_run_link(&workspace.id, &task.queue_item_id)
        .expect("get latest run link")
        .expect("latest run link");

    assert_eq!(plan.executor_widget_instance_id, queue_widget_id);
    assert_eq!(start.executor_widget_instance_id, queue_widget_id);
    assert_eq!(stored_task.assigned_executor_widget_id, None);
    assert_eq!(stored_task.status, "running");
    assert_eq!(run.widget_instance_id, queue_widget_id);
    assert_eq!(link.executor_widget_id, queue_widget_id);
    assert_eq!(link.direct_work_run_id, start.run_id);
}

#[test]
fn queue_owned_task_stream_uses_text_only_direct_work_request() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue workspace", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let queue_widget_id = add_widget(
        &service,
        &workspace.id,
        workbench_id,
        AGENT_QUEUE_WIDGET_DEFINITION_ID,
        "Agent Queue",
    );
    let task = create_task(
        &service,
        &workspace.id,
        "queued",
        "Say OK. Do not use tools.",
    );
    let mut input = start_input(&workspace.id, &task.queue_item_id);
    input.queue_owner_widget_instance_id = Some(queue_widget_id);
    input.sandbox = "danger_full_access".to_owned();
    input.approval_policy = "never".to_owned();

    let start = service
        .start_assigned_agent_queue_task(input)
        .expect("start queue-owned task");
    let summary = service
        .run_codex_direct_work_stream_with_runner(
            start.direct_work_input.clone(),
            &start.run_id,
            |request, on_event| {
                assert_eq!(request.program.as_deref(), Some("codex"));
                assert_eq!(request.prompt, "Say OK. Do not use tools.");
                assert_eq!(request.sandbox, CodexSandboxMode::DangerFullAccess);
                assert_eq!(request.approval_policy, CodexApprovalPolicy::Never);
                assert!(request.skip_git_repo_check);
                assert_eq!(request.resume_thread_id, None);
                assert!(request.output_last_message_path.is_none());

                stream_output(request, CodexDirectStreamStatus::Completed, on_event)
            },
            |_| {},
        )
        .expect("run queue-owned Direct Work stream")
        .expect("Direct Work summary");

    assert_eq!(summary.status, "completed");
    assert!(!summary
        .command_summary
        .iter()
        .any(|part| part.to_ascii_lowercase().contains("gpt-image")));
    assert!(!summary
        .command_summary
        .iter()
        .any(|part| part.to_ascii_lowercase().contains("image-generation")));
}

#[test]
fn assigned_queue_task_start_rejects_invalid_preconditions_without_run() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);

    let unassigned = create_task(&service, &workspace_id, "queued", "Prompt");
    assert_start_rejected(
        &service,
        &workspace_id,
        &unassigned.queue_item_id,
        "Queue-owned local executor",
    );

    for status in ["draft", "running", "completed", "failed", "cancelled"] {
        let task = create_task(&service, &workspace_id, status, "Prompt");
        if status == "draft" {
            assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
        } else {
            service
                .store
                .assign_agent_queue_task_to_executor(
                    &workspace_id,
                    &task.queue_item_id,
                    &executor_id,
                    Some("2"),
                )
                .expect("force assignment for final-status test");
        }

        assert_start_rejected(
            &service,
            &workspace_id,
            &task.queue_item_id,
            &format!("queue task status cannot be run: {status}"),
        );
    }

    let empty_prompt = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.clone(),
            title: "Empty prompt".to_owned(),
            description: "".to_owned(),
            prompt: "   ".to_owned(),
            status: "draft".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create draft task with empty prompt");
    assign_task(
        &service,
        &workspace_id,
        &empty_prompt.queue_item_id,
        &executor_id,
    );
    service
        .store
        .update_agent_queue_task_status(
            &workspace_id,
            &empty_prompt.queue_item_id,
            "queued",
            Some("3"),
        )
        .expect("force runnable status");

    assert_start_rejected(
        &service,
        &workspace_id,
        &empty_prompt.queue_item_id,
        "queue task prompt must not be empty",
    );

    assert!(service
        .store
        .list_widget_runs_for_widget(&executor_id)
        .expect("list executor runs")
        .is_empty());
}

#[test]
fn assigned_queue_task_start_rejects_bad_executor_and_workspace_targets() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue workspace", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let notes_widget_id = add_widget(&service, &workspace.id, workbench_id, "notes", "Notes");
    let task = create_task(&service, &workspace.id, "queued", "Prompt");
    service
        .store
        .assign_agent_queue_task_to_executor(
            &workspace.id,
            &task.queue_item_id,
            &notes_widget_id,
            Some("2"),
        )
        .expect("force non-executor assignment");

    assert_start_rejected(
        &service,
        &workspace.id,
        &task.queue_item_id,
        "assigned widget is not an Agent Executor",
    );

    let other = service
        .create_empty_workspace("Other workspace", None)
        .expect("create other workspace");
    let other_executor = add_widget(
        &service,
        &other.id,
        other.workbench_id.as_deref().expect("other workbench id"),
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Other Executor",
    );
    let cross_task = create_task(&service, &workspace.id, "queued", "Prompt");
    service
        .store
        .assign_agent_queue_task_to_executor(
            &workspace.id,
            &cross_task.queue_item_id,
            &other_executor,
            Some("3"),
        )
        .expect("force cross-workspace assignment");

    assert_start_rejected(
        &service,
        &workspace.id,
        &cross_task.queue_item_id,
        "executor widget does not belong to workspace",
    );
}

#[test]
fn assigned_queue_task_start_rejects_missing_repo_root_and_start_validation_failure() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", "Prompt");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let mut missing_repo_root = start_input(&workspace_id, &task.queue_item_id);
    missing_repo_root.repo_root = PathBuf::new();
    let missing_repo_root_error = service
        .start_assigned_agent_queue_task(missing_repo_root)
        .expect_err("missing repo root rejected");
    assert!(missing_repo_root_error
        .to_string()
        .contains("repo root must not be empty"));

    let mut invalid_sandbox = start_input(&workspace_id, &task.queue_item_id);
    invalid_sandbox.sandbox = "danger".to_owned();
    let invalid_sandbox_error = service
        .start_assigned_agent_queue_task(invalid_sandbox)
        .expect_err("invalid sandbox rejected");
    assert!(invalid_sandbox_error
        .to_string()
        .contains("unsupported direct work sandbox: danger"));

    let stored_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    assert_eq!(stored_task.status, "queued");
    assert!(service
        .store
        .list_widget_runs_for_widget(&executor_id)
        .expect("list executor runs")
        .is_empty());
}

#[test]
fn assigned_queue_task_start_accepts_danger_full_access_sandbox() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", "Prompt");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let mut input = start_input(&workspace_id, &task.queue_item_id);
    input.sandbox = "danger_full_access".to_owned();

    let start = service
        .start_assigned_agent_queue_task(input)
        .expect("danger_full_access is accepted for explicit queue run");

    assert_eq!(start.direct_work_input.sandbox, "danger_full_access");
    assert_eq!(
        service
            .store
            .list_widget_runs_for_widget(&executor_id)
            .expect("list executor runs")
            .len(),
        1
    );
}

#[test]
fn assigned_queue_task_finish_maps_direct_work_statuses_to_queue_statuses() {
    assert_queue_finish_status(CodexDirectStreamStatus::Completed, "completed");
    assert_queue_finish_status(CodexDirectStreamStatus::Failed, "failed");
    assert_queue_finish_status(CodexDirectStreamStatus::FailedToStart, "failed");
    assert_queue_finish_status(CodexDirectStreamStatus::TimedOut, "failed");
    assert_queue_finish_status(CodexDirectStreamStatus::Cancelled, "cancelled");
}

fn assert_queue_finish_status(stream_status: CodexDirectStreamStatus, expected_queue_status: &str) {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "ready", "Prompt");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start queue task");

    let summary = service
        .run_codex_direct_work_stream_with_runner(
            start.direct_work_input.clone(),
            &start.run_id,
            |request, on_event| stream_output(request, stream_status, on_event),
            |_| {},
        )
        .expect("run Direct Work stream")
        .expect("Direct Work summary");
    let task = service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id,
            queue_item_id: task.queue_item_id,
            executor_widget_instance_id: executor_id,
            run_id: start.run_id,
            direct_work_status: summary.status,
        })
        .expect("finish queue task");

    assert_eq!(task.status, expected_queue_status);
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue workspace", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("workbench id")
        .to_owned();
    let executor_id = add_widget(
        service,
        &workspace.id,
        &workbench_id,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Agent Executor",
    );

    (workspace.id, workbench_id, executor_id)
}

fn add_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    workbench_id: &str,
    definition_id: &str,
    title: &str,
) -> String {
    service
        .add_widget_instance_to_workbench(workspace_id, workbench_id, definition_id, title, "agent")
        .expect("add widget")
        .expect("updated state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("added widget")
        .id
}

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    status: &str,
    prompt: &str,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: "Description".to_owned(),
            prompt: prompt.to_owned(),
            status: status.to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task")
}

fn assign_task(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) {
    service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            executor_widget_instance_id: executor_id.to_owned(),
        })
        .expect("assign queue task");
}

fn start_input(workspace_id: &str, queue_item_id: &str) -> StartAssignedAgentQueueTaskInput {
    StartAssignedAgentQueueTaskInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        queue_owner_widget_instance_id: None,
        materialized_operator_prompt: None,
        codex_executable: "codex".to_owned(),
        repo_root: std::env::current_dir().expect("current dir"),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(2_000),
        stdout_cap_bytes: Some(16 * 1024),
        stderr_cap_bytes: Some(8 * 1024),
    }
}

fn assert_start_rejected(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    expected_message: &str,
) {
    let error = service
        .start_assigned_agent_queue_task(start_input(workspace_id, queue_item_id))
        .expect_err("queue task start rejected");
    assert!(
        error.to_string().contains(expected_message),
        "expected error containing {expected_message:?}, got {error}"
    );
}

fn stream_output(
    request: CodexDirectStreamRequest,
    status: CodexDirectStreamStatus,
    on_event: &mut dyn FnMut(CodexDirectStreamEvent),
) -> CodexDirectStreamOutput {
    let event_kind = match status {
        CodexDirectStreamStatus::Completed => CodexDirectStreamEventKind::Completed,
        CodexDirectStreamStatus::Cancelled => CodexDirectStreamEventKind::Cancelled,
        CodexDirectStreamStatus::TimedOut => CodexDirectStreamEventKind::TimedOut,
        CodexDirectStreamStatus::Failed | CodexDirectStreamStatus::FailedToStart => {
            CodexDirectStreamEventKind::Failed
        }
    };
    on_event(CodexDirectStreamEvent {
        kind: event_kind,
        elapsed_ms: 1,
        line: None,
        text: None,
        parsed_json: None,
        error_message: if status == CodexDirectStreamStatus::Completed {
            None
        } else {
            Some("stream stopped".to_owned())
        },
        stderr_preview: None,
        exit_code: if status == CodexDirectStreamStatus::Cancelled {
            None
        } else {
            Some(0)
        },
        final_status: Some(status.as_str().to_owned()),
        failed_stage: None,
    });

    CodexDirectStreamOutput {
        status,
        exit_code: if status == CodexDirectStreamStatus::Cancelled {
            None
        } else {
            Some(0)
        },
        command_summary: vec![request.program.unwrap_or_else(|| "codex".to_owned())],
        stdout_collected: "stdout".to_owned(),
        stderr_collected: "stderr".to_owned(),
        stdout_truncated: false,
        stderr_truncated: false,
        final_message: Some("final response".to_owned()),
        duration_ms: 1,
        error_message: if status == CodexDirectStreamStatus::Completed {
            None
        } else {
            Some("stream stopped".to_owned())
        },
        event_count: 1,
        force_killed: false,
    }
}
