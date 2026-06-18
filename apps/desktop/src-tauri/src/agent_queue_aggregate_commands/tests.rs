use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AssignAgentQueueTaskToExecutorInput, CreateAgentQueueTaskInput,
    FinishAssignedAgentQueueTaskRunInput, StartAssignedAgentQueueTaskInput, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;

#[test]
fn aggregate_command_helpers_list_and_get_backend_read_model() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue aggregate command test", None)
        .expect("create workspace");
    let task = create_task(&service, &workspace.id);
    drop(service);

    let listed = list_agent_queue_item_aggregates_blocking(
        ListQueueItemAggregatesRequest {
            workspace_id: workspace.id.clone(),
        },
        db_path.clone(),
    )
    .expect("list aggregates");
    let fetched = get_agent_queue_item_aggregate_blocking(
        GetQueueItemAggregateRequest {
            workspace_id: workspace.id,
            task_id: task.queue_item_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get aggregate")
    .expect("aggregate");

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].task_id, task.queue_item_id);
    assert_eq!(listed[0].ticket_state, "queued");
    assert_eq!(fetched.worker_run_state, "not_started");
    assert_eq!(fetched.next_actions[0].code, "start_run");
    remove_test_db_files(&db_path);
}

#[test]
fn aggregate_command_helper_does_not_start_or_mutate_work() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue aggregate command test", None)
        .expect("create workspace");
    let executor_widget_id = add_widget(&service, &workspace.id, "agent-run", "Agent Executor");
    let task = create_task(&service, &workspace.id);
    assign_task(
        &service,
        &workspace.id,
        &task.queue_item_id,
        &executor_widget_id,
    );
    drop(service);

    let before = list_agent_queue_item_aggregates_blocking(
        ListQueueItemAggregatesRequest {
            workspace_id: workspace.id.clone(),
        },
        db_path.clone(),
    )
    .expect("list before");
    let _ = get_agent_queue_item_aggregate_blocking(
        GetQueueItemAggregateRequest {
            workspace_id: workspace.id.clone(),
            task_id: task.queue_item_id,
        },
        db_path.clone(),
    )
    .expect("get aggregate");
    let after = list_agent_queue_item_aggregates_blocking(
        ListQueueItemAggregatesRequest {
            workspace_id: workspace.id,
        },
        db_path.clone(),
    )
    .expect("list after");

    assert_eq!(before, after);
    assert_eq!(after[0].latest_run, None);
    assert_eq!(after[0].ticket_state, "queued");
    remove_test_db_files(&db_path);
}

#[test]
fn aggregate_command_helper_reads_latest_run_link_after_start() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue aggregate command test", None)
        .expect("create workspace");
    let executor_widget_id = add_widget(&service, &workspace.id, "agent-run", "Agent Executor");
    let task = create_task(&service, &workspace.id);
    assign_task(
        &service,
        &workspace.id,
        &task.queue_item_id,
        &executor_widget_id,
    );
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace.id, &task.queue_item_id))
        .expect("start task");
    drop(service);

    let aggregate = get_agent_queue_item_aggregate_blocking(
        GetQueueItemAggregateRequest {
            workspace_id: workspace.id,
            task_id: task.queue_item_id,
        },
        db_path.clone(),
    )
    .expect("get aggregate")
    .expect("aggregate");

    assert_eq!(aggregate.ticket_state, "running");
    assert_eq!(aggregate.worker_run_state, "running");
    assert_eq!(
        aggregate.latest_run.as_ref().expect("latest run").run_id,
        start.run_id
    );
    remove_test_db_files(&db_path);
}

#[test]
fn aggregate_command_helper_serializes_completed_run_as_awaiting_review_read_model() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue aggregate command test", None)
        .expect("create workspace");
    let executor_widget_id = add_widget(&service, &workspace.id, "agent-run", "Agent Executor");
    let task = create_task(&service, &workspace.id);
    assign_task(
        &service,
        &workspace.id,
        &task.queue_item_id,
        &executor_widget_id,
    );
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace.id, &task.queue_item_id))
        .expect("start task");
    service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_widget_id.clone(),
            run_id: start.run_id.clone(),
            direct_work_status: "completed".to_owned(),
        })
        .expect("finish queue run");
    drop(service);

    let aggregate = get_agent_queue_item_aggregate_blocking(
        GetQueueItemAggregateRequest {
            workspace_id: workspace.id,
            task_id: task.queue_item_id,
        },
        db_path.clone(),
    )
    .expect("get aggregate")
    .expect("aggregate");

    assert_eq!(aggregate.ticket_state, "awaiting_review");
    assert_eq!(aggregate.worker_run_state, "completed");
    assert_eq!(aggregate.review_state, "awaiting_review");
    assert_eq!(aggregate.evidence_state, "not_durable");
    assert_eq!(aggregate.validation_state, "not_requested");
    assert_eq!(aggregate.commit_state, "none");
    assert_eq!(aggregate.dependency_state, "none");
    assert_eq!(
        aggregate.latest_run.as_ref().expect("latest run").run_id,
        start.run_id
    );
    assert_eq!(aggregate.next_actions[0].code, "create_review_message");
    assert!(aggregate.next_actions[0].available);
    assert_eq!(
        aggregate.next_actions[0].unavailable_reason.as_deref(),
        None
    );
    assert!(aggregate.durable_flags.task_row);
    assert!(aggregate.durable_flags.latest_run_link);
    assert!(!aggregate.durable_flags.frontend_overlay_used);
    remove_test_db_files(&db_path);
}

#[test]
fn aggregate_command_source_stays_read_only_and_headless() {
    let source = include_str!("../agent_queue_aggregate_commands.rs");

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
            "aggregate commands must not call {forbidden}"
        );
    }
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_task(service: &WorkspaceService, workspace_id: &str) -> hobit_app::AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            depends_on: Some(vec![]),
            execution_policy: None,
            execution_workspace: Some("C:/repo".to_owned()),
            codex_executable: Some("codex".to_owned()),
            sandbox: Some("workspace_write".to_owned()),
            approval_policy: Some("never".to_owned()),
        })
        .expect("create task")
}

fn add_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    definition_id: &str,
    title: &str,
) -> String {
    let workbench_id = service
        .get_workspace_summary(workspace_id)
        .expect("get workspace summary")
        .expect("workspace summary")
        .workbench_id
        .expect("workbench id");
    service
        .add_widget_instance_to_workbench(
            workspace_id,
            &workbench_id,
            definition_id,
            title,
            "agent",
        )
        .expect("add widget")
        .expect("updated state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("added widget")
        .id
}

fn assign_task(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_widget_id: &str,
) {
    service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            executor_widget_instance_id: executor_widget_id.to_owned(),
        })
        .expect("assign task");
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

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-agent-queue-aggregate-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
