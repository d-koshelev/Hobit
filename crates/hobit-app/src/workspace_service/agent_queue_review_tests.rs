use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::WorkspaceServiceError;
use hobit_storage_sqlite::{SqliteStore, WidgetRunFinishUpdate};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn initialized_file_service(path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(path).expect("open sqlite file");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn create_review_message_allowed_after_completed_worker_run() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let result = service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: Some("Ready for review.".to_owned()),
        })
        .expect("create review message");

    assert_eq!(result.workspace_id, workspace_id);
    assert_eq!(result.queue_item_id, task.queue_item_id);
    assert!(result.durable);
    assert_eq!(result.review_message.actor_id, "workspace-agent");
    assert_eq!(result.review_message.status, "created");
    assert_eq!(
        result.aggregate.review_state,
        QueueItemAggregateReviewState::ReviewMessageCreated
    );
    assert_eq!(
        result.aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_action_available(&result.aggregate, "ack_review");
}

#[test]
fn create_review_message_rejects_draft_and_running_states() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue review test", None)
        .expect("create workspace");
    let draft = create_task(&service, &workspace.id, "draft", false);
    let draft_result =
        service.create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: draft.queue_item_id,
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
        });
    assert_invalid_state(draft_result, "ticket_state=draft");

    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let running = create_task(&service, &workspace_id, "queued", true);
    assign_task(
        &service,
        &workspace_id,
        &running.queue_item_id,
        &executor_id,
    );
    service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &running.queue_item_id))
        .expect("start task");
    let running_result =
        service.create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id,
            queue_item_id: running.queue_item_id,
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
        });
    assert_invalid_state(running_result, "ticket_state=running");
}

#[test]
fn create_review_message_requires_explicit_task_and_actor_ids() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue review test", None)
        .expect("create workspace");
    let result = service.create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
        workspace_id: workspace.id,
        queue_item_id: "   ".to_owned(),
        actor_id: "workspace-agent".to_owned(),
        message_body: Some("Do not infer task id from this prompt.".to_owned()),
    });
    assert_invalid_state(result, "queue item id must not be empty");

    let result = service.create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
        workspace_id: "workspace-id".to_owned(),
        queue_item_id: "task-id".to_owned(),
        actor_id: "  ".to_owned(),
        message_body: None,
    });
    assert_invalid_state(result, "review actor id must not be empty");
}

#[test]
fn create_review_message_does_not_infer_or_mutate_unrelated_tasks() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let first = create_task(&service, &workspace_id, "queued", true);
    let second = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run(&service, &workspace_id, &first.queue_item_id, &executor_id);
    complete_worker_run(&service, &workspace_id, &second.queue_item_id, &executor_id);

    service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: second.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: Some(format!(
                "This message mentions {} but must not target it.",
                first.queue_item_id
            )),
        })
        .expect("create review message");

    let first_aggregate = service
        .get_queue_item_aggregate(&workspace_id, &first.queue_item_id)
        .expect("get first aggregate")
        .expect("first aggregate");
    let second_aggregate = service
        .get_queue_item_aggregate(&workspace_id, &second.queue_item_id)
        .expect("get second aggregate")
        .expect("second aggregate");

    assert_eq!(
        first_aggregate.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    );
    assert_eq!(
        second_aggregate.review_state,
        QueueItemAggregateReviewState::ReviewMessageCreated
    );
}

#[test]
fn ack_review_message_updates_aggregate_to_in_review() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let create = service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
        })
        .expect("create review message");

    let ack = service
        .ack_agent_queue_review_message(AckAgentQueueReviewMessageInput {
            workspace_id,
            queue_item_id: task.queue_item_id,
            message_id: create.message_id,
            actor_id: "workspace-agent".to_owned(),
        })
        .expect("ack review message");

    assert_eq!(ack.review_message.status, "acknowledged");
    assert_eq!(
        ack.aggregate.review_state,
        QueueItemAggregateReviewState::InReview
    );
    assert_eq!(
        ack.aggregate.ticket_state,
        QueueItemAggregateTicketState::InReview
    );
    assert_action_unavailable(&ack.aggregate, "none", Some("in_review"));
}

#[test]
fn review_message_survives_service_reload() {
    let db_path = unique_test_db_path();
    let service = initialized_file_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true);
    complete_worker_run(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let create = service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
        })
        .expect("create review message");
    drop(service);

    let reloaded = initialized_file_service(&db_path);
    let aggregate = reloaded
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get reloaded aggregate")
        .expect("reloaded aggregate");
    let messages = reloaded
        .store
        .list_agent_queue_review_messages(&workspace_id, &task.queue_item_id)
        .expect("list review messages");

    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].message_id, create.message_id);
    assert_eq!(
        aggregate.review_state,
        QueueItemAggregateReviewState::ReviewMessageCreated
    );
    remove_test_db_files(&db_path);
}

#[test]
fn review_command_source_does_not_execute_restricted_capabilities() {
    let source = include_str!("agent_queue_review.rs");

    for forbidden in [
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

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue review test", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("workbench id")
        .to_owned();
    let executor_id = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            AGENT_RUN_WIDGET_DEFINITION_ID,
            "Agent Executor",
            "agent",
        )
        .expect("add executor")
        .expect("state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == "Agent Executor")
        .expect("executor")
        .id;

    (workspace.id, workbench_id, executor_id)
}

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    status: &str,
    with_run_settings: bool,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: "Run this Queue task.".to_owned(),
            status: status.to_owned(),
            priority: 1,
            depends_on: Some(vec![]),
            execution_policy: None,
            execution_workspace: with_run_settings.then(|| "C:/workspace/project".to_owned()),
            codex_executable: with_run_settings.then(|| "codex".to_owned()),
            sandbox: with_run_settings.then(|| "workspace_write".to_owned()),
            approval_policy: with_run_settings.then(|| "never".to_owned()),
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
        .expect("assign task");
}

fn complete_worker_run(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) {
    assign_task(service, workspace_id, queue_item_id, executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(workspace_id, queue_item_id))
        .expect("start task");
    service
        .store
        .finish_widget_run(
            &start.run_id,
            WidgetRunFinishUpdate {
                status: "completed",
                finished_at: Some("completed-at"),
                summary: Some("Worker final report summary."),
            },
        )
        .expect("finish widget run");
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
    }
}

fn assert_invalid_state<T: std::fmt::Debug>(
    result: Result<T, WorkspaceServiceError>,
    expected: &str,
) {
    let message = result.expect_err("expected invalid state").to_string();
    assert!(
        message.contains(expected),
        "expected message to contain {expected:?}, got {message:?}"
    );
}

fn assert_action_available(aggregate: &QueueItemAggregate, code: &str) {
    let action = aggregate
        .next_actions
        .iter()
        .find(|action| action.code == code)
        .expect("next action");
    assert!(action.available, "expected action {code} to be available");
}

fn assert_action_unavailable(aggregate: &QueueItemAggregate, code: &str, reason: Option<&str>) {
    let action = aggregate
        .next_actions
        .iter()
        .find(|action| action.code == code)
        .expect("next action");
    assert!(
        !action.available,
        "expected action {code} to be unavailable"
    );
    assert_eq!(action.unavailable_reason.as_deref(), reason);
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-queue-review-test-{}-{nanos}.sqlite",
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
