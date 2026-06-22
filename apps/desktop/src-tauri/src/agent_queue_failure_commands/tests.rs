use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AckAgentQueueReviewMessageInput, AssignAgentQueueTaskToExecutorInput,
    CreateAgentQueueReviewMessageInput, CreateAgentQueueTaskInput,
    RecordAgentQueueWorkerFinishedInput, StartAssignedAgentQueueTaskInput, WorkspaceService,
    AGENT_QUEUE_FAILURE_CONFIRMATION_TOKEN,
};
use hobit_storage_sqlite::SqliteStore;

use crate::agent_queue_failure_dto::FailAgentQueueItemRequest;

#[test]
fn fail_command_serializes_successful_backend_result_with_default_actor() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run_with_evidence(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let message_id = create_and_ack_review(&service, &workspace_id, &task.queue_item_id);
    drop(service);

    let result = fail_agent_queue_item_blocking(
        request(
            &workspace_id,
            &task.queue_item_id,
            Some(message_id.as_str()),
        ),
        db_path.clone(),
    )
    .expect("fail item");

    assert_eq!(result.status, "succeeded");
    assert!(result.durable);
    assert!(result.decision_id.is_some());
    assert_eq!(
        result.review_message_id.as_deref(),
        Some(message_id.as_str())
    );
    let decision = result.failure_decision.as_ref().expect("decision");
    assert_eq!(decision.actor_id, "workspace-agent");
    assert_eq!(decision.reason, "Operator rejected completion.");
    let aggregate = result.aggregate.as_ref().expect("aggregate");
    assert_eq!(aggregate.ticket_state, "failure");
    assert_eq!(aggregate.review_state, "failed");
    assert_eq!(aggregate.worker_run_state, "failed");
    assert_eq!(aggregate.evidence_state, "available");
    assert_eq!(aggregate.validation_state, "not_requested");
    assert_eq!(aggregate.commit_state, "none");
    assert!(aggregate.durable_flags.failure_state);
    assert!(!aggregate.durable_flags.completion_state);
    remove_test_db_files(&db_path);
}

#[test]
fn fail_command_serializes_backend_blocker_details() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue failure command test", None)
        .expect("create workspace");
    enable_queue_manual(&service, &workspace.id);
    let draft = create_task(&service, &workspace.id, "draft", false);
    drop(service);

    let result = fail_agent_queue_item_blocking(
        request(&workspace.id, &draft.queue_item_id, None),
        db_path.clone(),
    )
    .expect("blocked result");

    assert_eq!(result.status, "precondition_failed");
    let blocker = result.blocker.expect("blocker");
    assert_eq!(blocker.blocker_code, "task_is_draft");
    assert_eq!(blocker.ticket_state.as_deref(), Some("draft"));
    assert_eq!(blocker.worker_run_state.as_deref(), Some("not_started"));
    assert_eq!(blocker.review_state.as_deref(), Some("none"));
    assert_eq!(blocker.evidence_state.as_deref(), Some("none"));
    remove_test_db_files(&db_path);
}

fn enable_queue_manual(service: &WorkspaceService, workspace_id: &str) {
    service
        .enable_agent_queue_manual_control(
            workspace_id.to_owned(),
            Some("test-operator".to_owned()),
            Some("test start fixture".to_owned()),
            None,
        )
        .expect("enable queue manual control");
}

#[test]
fn fail_command_rejects_missing_confirmation_and_reason_with_typed_result() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue failure command test", None)
        .expect("create workspace");
    let task = create_task(&service, &workspace.id, "queued", true);
    drop(service);

    let missing_confirmation = fail_agent_queue_item_blocking(
        FailAgentQueueItemRequest {
            confirmation_token: "operator said yes".to_owned(),
            ..request(&workspace.id, &task.queue_item_id, None)
        },
        db_path.clone(),
    )
    .expect("typed invalid result");
    assert_eq!(missing_confirmation.status, "invalid_input");
    assert_eq!(
        missing_confirmation
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("confirmationToken")
    );

    let missing_reason = fail_agent_queue_item_blocking(
        FailAgentQueueItemRequest {
            reason: " ".to_owned(),
            ..request(&workspace.id, &task.queue_item_id, None)
        },
        db_path.clone(),
    )
    .expect("typed invalid result");
    assert_eq!(missing_reason.status, "invalid_input");
    assert_eq!(
        missing_reason
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("reason")
    );
    remove_test_db_files(&db_path);
}

#[test]
fn failure_command_source_is_independent_from_frontend_and_execution_paths() {
    let source = include_str!("../agent_queue_failure_commands.rs");

    for forbidden in [
        "frontend",
        "run_codex",
        "run_direct_work",
        "start_assigned_agent_queue_task",
        "run_queue_validation",
        "validation_runner",
        "get_git_",
        "create_git_",
        "terminal_",
        "rollback",
        "shell",
    ] {
        assert!(
            !source.contains(forbidden),
            "failure command must not call {forbidden}"
        );
    }
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue failure command test", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("workbench id")
        .to_owned();
    let executor_id = add_widget(service, &workspace.id, "agent-run", "Agent Executor");

    (workspace.id, workbench_id, executor_id)
}

fn add_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    definition_id: &str,
    title: &str,
) -> String {
    let workbench_id = service
        .get_workspace_workbench_state(workspace_id)
        .expect("get state")
        .expect("workspace state")
        .workbench
        .expect("workbench")
        .id;
    service
        .add_widget_instance_to_workbench(
            workspace_id,
            &workbench_id,
            definition_id,
            title,
            "agent",
        )
        .expect("add widget")
        .expect("state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("widget")
        .id
}

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    status: &str,
    with_run_settings: bool,
) -> hobit_app::AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: "Prompt".to_owned(),
            status: status.to_owned(),
            priority: 1,
            depends_on: Some(vec![]),
            execution_policy: None,
            execution_workspace: with_run_settings.then(|| "C:/repo".to_owned()),
            codex_executable: with_run_settings.then(|| "codex".to_owned()),
            sandbox: with_run_settings.then(|| "workspace_write".to_owned()),
            approval_policy: with_run_settings.then(|| "never".to_owned()),
        })
        .expect("create task")
}

fn complete_worker_run_with_evidence(
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
        .expect("assign task");
    enable_queue_manual(service, workspace_id);
    let start = service
        .start_assigned_agent_queue_task(StartAssignedAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            queue_owner_widget_instance_id: None,
            codex_executable: "codex".to_owned(),
            repo_root: PathBuf::from("."),
            sandbox: "workspace_write".to_owned(),
            approval_policy: "never".to_owned(),
            timeout_ms: Some(10),
            stdout_cap_bytes: Some(11),
            stderr_cap_bytes: Some(12),
            workflow_start_context: None,
        })
        .expect("start task");
    service
        .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            run_id: start.run_id,
            outcome: "failed".to_owned(),
            summary: Some("Worker evidence is durable.".to_owned()),
            changed_files: vec!["src/lib.rs".to_owned()],
            changed_files_summary: Some("src/lib.rs".to_owned()),
            validation_summary: Some("validation not run".to_owned()),
            error_summary: Some("Worker failed.".to_owned()),
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("completed-at".to_owned()),
        })
        .expect("record worker evidence");
}

fn create_and_ack_review(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
) -> String {
    let create = service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
            run_id: None,
            evidence_bundle_id: None,
        })
        .expect("create review");
    let message_id = create.message_id.expect("message id");
    service
        .ack_agent_queue_review_message(AckAgentQueueReviewMessageInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            message_id: message_id.clone(),
            actor_id: "workspace-agent".to_owned(),
        })
        .expect("ack review");
    message_id
}

fn request(
    workspace_id: &str,
    task_id: &str,
    review_message_id: Option<&str>,
) -> FailAgentQueueItemRequest {
    FailAgentQueueItemRequest {
        workspace_id: workspace_id.to_owned(),
        task_id: task_id.to_owned(),
        actor_id: None,
        confirmation_token: AGENT_QUEUE_FAILURE_CONFIRMATION_TOKEN.to_owned(),
        reason: "Operator rejected completion.".to_owned(),
        run_id: None,
        evidence_bundle_id: None,
        review_message_id: review_message_id.map(str::to_owned),
    }
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-failure-command-test-{}-{nanos}.sqlite",
        std::process::id()
    ));
    path
}

fn remove_test_db_files(path: &Path) {
    let _ = std::fs::remove_file(path);
    let wal = path.with_extension("sqlite-wal");
    let shm = path.with_extension("sqlite-shm");
    let _ = std::fs::remove_file(wal);
    let _ = std::fs::remove_file(shm);
}
