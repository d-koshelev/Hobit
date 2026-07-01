use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AssignAgentQueueTaskToExecutorInput, CreateAgentQueueTaskInput,
    FinishAssignedAgentQueueTaskRunInput, RecordAgentQueueWorkerFinishedInput,
    StartAssignedAgentQueueTaskInput, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;

#[test]
fn create_review_message_command_serializes_no_evidence_blocker() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run(&service, &workspace_id, &task.queue_item_id, &executor_id);
    drop(service);

    let result = create_agent_queue_review_message_blocking(
        CreateAgentQueueReviewMessageRequest {
            workspace_id,
            task_id: task.queue_item_id,
            actor_id: "workspace-agent".to_owned(),
            message_body: Some("Ready for review.".to_owned()),
            run_id: None,
            evidence_bundle_id: None,
        },
        db_path.clone(),
    )
    .expect("create review message");

    assert_eq!(result.status, "blocked");
    assert_eq!(
        result.blocker.as_ref().expect("blocker").blocker_code,
        "durable_worker_evidence_required"
    );
    remove_test_db_files(&db_path);
}

#[test]
fn create_review_message_command_serializes_successful_backend_result() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run_with_evidence(&service, &workspace_id, &task.queue_item_id, &executor_id);
    drop(service);

    let result = create_agent_queue_review_message_blocking(
        CreateAgentQueueReviewMessageRequest {
            workspace_id,
            task_id: task.queue_item_id,
            actor_id: "workspace-agent".to_owned(),
            message_body: Some("Ready for review.".to_owned()),
            run_id: None,
            evidence_bundle_id: None,
        },
        db_path.clone(),
    )
    .expect("create review message");

    assert_eq!(result.status, "succeeded");
    assert!(result.durable);
    assert!(result.evidence_bundle_id.is_some());
    let review_message = result.review_message.as_ref().expect("review message");
    assert_eq!(review_message.status, "created");
    assert_eq!(review_message.actor_id, "workspace-agent");
    let aggregate = result.aggregate.as_ref().expect("aggregate");
    assert_eq!(aggregate.review_state, "review_message_created");
    assert_eq!(aggregate.next_actions[0].code, "ack_review");
    assert!(aggregate.next_actions[0].available);
    remove_test_db_files(&db_path);
}

#[test]
fn create_review_message_command_serializes_backend_blocker_details() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue review command test", None)
        .expect("create workspace");
    enable_queue_manual(&service, &workspace.id);
    let draft = create_task(&service, &workspace.id, "draft", false);
    drop(service);

    let result = create_agent_queue_review_message_blocking(
        CreateAgentQueueReviewMessageRequest {
            workspace_id: workspace.id,
            task_id: draft.queue_item_id,
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
            run_id: None,
            evidence_bundle_id: None,
        },
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
    assert!(blocker.durable_evidence_required);
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
fn review_commands_validate_actor_and_ack_updates_aggregate() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run_with_evidence(&service, &workspace_id, &task.queue_item_id, &executor_id);
    drop(service);

    let missing_actor = create_agent_queue_review_message_blocking(
        CreateAgentQueueReviewMessageRequest {
            workspace_id: workspace_id.clone(),
            task_id: task.queue_item_id.clone(),
            actor_id: " ".to_owned(),
            message_body: None,
            run_id: None,
            evidence_bundle_id: None,
        },
        db_path.clone(),
    );
    assert_eq!(missing_actor.expect("actor default").status, "succeeded");

    let create = create_agent_queue_review_message_blocking(
        CreateAgentQueueReviewMessageRequest {
            workspace_id: workspace_id.clone(),
            task_id: task.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
            run_id: None,
            evidence_bundle_id: None,
        },
        db_path.clone(),
    )
    .expect("duplicate review message");
    assert_eq!(create.status, "already_exists");
    let message_id = create.message_id.expect("existing message id");
    let ack = ack_agent_queue_review_message_blocking(
        AckAgentQueueReviewMessageRequest {
            workspace_id,
            task_id: task.queue_item_id,
            message_id,
            actor_id: "workspace-agent".to_owned(),
        },
        db_path.clone(),
    )
    .expect("ack review message");

    assert_eq!(ack.review_message.status, "acknowledged");
    assert_eq!(
        ack.review_message.ack_actor_id.as_deref(),
        Some("workspace-agent")
    );
    assert_eq!(ack.aggregate.review_state, "in_review");
    assert_eq!(ack.aggregate.ticket_state, "in_review");
    remove_test_db_files(&db_path);
}

#[test]
fn review_command_source_is_independent_from_frontend_and_execution_paths() {
    let source = include_str!("../agent_queue_review_commands.rs");

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
            "review command must not call {forbidden}"
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
        .create_empty_workspace("Queue review command test", None)
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
        .expect("assign task");
}

fn complete_worker_run(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) {
    assign_task(service, workspace_id, queue_item_id, executor_id);
    enable_queue_manual(service, workspace_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(workspace_id, queue_item_id))
        .expect("start task");
    service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            executor_widget_instance_id: executor_id.to_owned(),
            run_id: start.run_id,
            direct_work_status: "completed".to_owned(),
        })
        .expect("finish queue run");
}

fn complete_worker_run_with_evidence(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) {
    assign_task(service, workspace_id, queue_item_id, executor_id);
    enable_queue_manual(service, workspace_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(workspace_id, queue_item_id))
        .expect("start task");
    service
        .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            run_id: start.run_id,
            outcome: "completed".to_owned(),
            summary: Some("Worker evidence is durable.".to_owned()),
            changed_files: vec!["src/lib.rs".to_owned()],
            changed_files_summary: Some("src/lib.rs".to_owned()),
            validation_summary: Some("validation not run".to_owned()),
            error_summary: None,
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("completed-at".to_owned()),
        })
        .expect("record worker evidence");
}

fn start_input(workspace_id: &str, queue_item_id: &str) -> StartAssignedAgentQueueTaskInput {
    StartAssignedAgentQueueTaskInput {
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
    }
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-review-command-test-{}-{nanos}.sqlite",
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
