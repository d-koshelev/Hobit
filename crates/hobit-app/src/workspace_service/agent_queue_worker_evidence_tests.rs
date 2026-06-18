use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::WorkspaceServiceError;
use hobit_storage_sqlite::SqliteStore;

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
fn record_worker_finished_requires_explicit_task_and_run_ids() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let missing_task = service.record_agent_queue_worker_finished(record_input(
        &workspace_id,
        "  ",
        &run_id,
        "completed",
        "Done.",
    ));
    assert_invalid_state(missing_task, "queue item id must not be empty");

    let missing_run = service.record_agent_queue_worker_finished(record_input(
        &workspace_id,
        &task.queue_item_id,
        "  ",
        "completed",
        "Done.",
    ));
    assert_invalid_state(missing_run, "worker run id must not be empty");
}

#[test]
fn record_worker_finished_rejects_unknown_task() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue worker evidence test", None)
        .expect("create workspace");

    let result = service.record_agent_queue_worker_finished(record_input(
        &workspace.id,
        "missing-task",
        "missing-run",
        "completed",
        "Do not infer task identity from this text.",
    ));

    assert_invalid_state(result, "queue task not found: missing-task");
}

#[test]
fn record_worker_finished_rejects_run_id_for_another_task() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let first = create_task(&service, &workspace_id);
    let second = create_task(&service, &workspace_id);
    let first_run_id = start_task(&service, &workspace_id, &first.queue_item_id, &executor_id);

    let result = service.record_agent_queue_worker_finished(record_input(
        &workspace_id,
        &second.queue_item_id,
        &first_run_id,
        "completed",
        "This message mentions the first task but must not retarget the command.",
    ));

    assert_invalid_state(result, "run link does not belong to task");
}

#[test]
fn record_successful_worker_evidence_updates_aggregate_without_marking_done() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let result = service
        .record_agent_queue_worker_finished(record_input(
            &workspace_id,
            &task.queue_item_id,
            &run_id,
            "completed",
            "Worker finished the implementation.",
        ))
        .expect("record worker evidence");

    assert!(result.durable);
    assert_eq!(result.run_id, run_id);
    assert_eq!(result.evidence_bundle.outcome, "completed");
    assert_eq!(
        result.aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_eq!(
        result.aggregate.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    );
    assert_eq!(
        result.aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    );
    assert_eq!(
        result.aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Available
    );
    assert_ne!(
        result.aggregate.ticket_state,
        QueueItemAggregateTicketState::Done
    );
    assert_eq!(
        result
            .aggregate
            .evidence_summary
            .as_ref()
            .map(|summary| summary.source.as_str()),
        Some("durable_worker_evidence_bundle")
    );
    assert_action_available(&result.aggregate, "create_review_message");
}

#[test]
fn record_failed_worker_evidence_is_durable_without_marking_done() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let mut input = record_input(
        &workspace_id,
        &task.queue_item_id,
        &run_id,
        "failed",
        "Worker could not finish.",
    );
    input.error_summary = Some("Build failed before review.".to_owned());
    let result = service
        .record_agent_queue_worker_finished(input)
        .expect("record failed worker evidence");

    assert_eq!(result.evidence_bundle.outcome, "failed");
    assert_eq!(
        result.evidence_bundle.error_summary.as_deref(),
        Some("Build failed before review.")
    );
    assert_eq!(
        result.aggregate.ticket_state,
        QueueItemAggregateTicketState::Failure
    );
    assert_eq!(
        result.aggregate.review_state,
        QueueItemAggregateReviewState::Failed
    );
    assert_eq!(
        result.aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Available
    );
    assert_ne!(
        result.aggregate.ticket_state,
        QueueItemAggregateTicketState::Done
    );
}

#[test]
fn repeated_worker_evidence_for_same_task_and_run_updates_same_bundle() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let first = service
        .record_agent_queue_worker_finished(record_input(
            &workspace_id,
            &task.queue_item_id,
            &run_id,
            "completed",
            "First summary.",
        ))
        .expect("first evidence");
    let second = service
        .record_agent_queue_worker_finished(record_input(
            &workspace_id,
            &task.queue_item_id,
            &run_id,
            "completed",
            "Updated summary.",
        ))
        .expect("second evidence");

    assert_eq!(first.bundle_id, second.bundle_id);
    assert_eq!(second.evidence_bundle.summary, "Updated summary.");
    let read = service
        .get_agent_queue_worker_evidence_bundle(GetAgentQueueWorkerEvidenceBundleInput {
            workspace_id,
            queue_item_id: task.queue_item_id,
            run_id: Some(run_id),
        })
        .expect("read evidence");
    assert_eq!(read.state, AgentQueueWorkerEvidenceQueryState::Available);
    assert_eq!(
        read.evidence_bundle
            .as_ref()
            .expect("evidence bundle")
            .bundle_id,
        first.bundle_id
    );
}

#[test]
fn get_worker_evidence_returns_no_evidence_and_not_found_states() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue worker evidence test", None)
        .expect("create workspace");
    let task = create_task(&service, &workspace.id);

    let no_evidence = service
        .get_agent_queue_worker_evidence_bundle(GetAgentQueueWorkerEvidenceBundleInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id,
            run_id: None,
        })
        .expect("get no evidence");
    assert_eq!(
        no_evidence.state,
        AgentQueueWorkerEvidenceQueryState::NoEvidence
    );
    assert!(!no_evidence.durable);
    assert!(no_evidence.evidence_bundle.is_none());

    let not_found = service
        .get_agent_queue_worker_evidence_bundle(GetAgentQueueWorkerEvidenceBundleInput {
            workspace_id: workspace.id,
            queue_item_id: "missing-task".to_owned(),
            run_id: None,
        })
        .expect("get missing task");
    assert_eq!(
        not_found.state,
        AgentQueueWorkerEvidenceQueryState::NotFound
    );
    assert!(not_found.aggregate.is_none());
}

#[test]
fn worker_evidence_survives_service_reload_and_review_create_uses_aggregate_state() {
    let db_path = unique_test_db_path();
    let service = initialized_file_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let record = service
        .record_agent_queue_worker_finished(record_input(
            &workspace_id,
            &task.queue_item_id,
            &run_id,
            "completed",
            "Worker evidence is durable.",
        ))
        .expect("record evidence");
    drop(service);

    let reloaded = initialized_file_service(&db_path);
    let read = reloaded
        .get_agent_queue_worker_evidence_bundle(GetAgentQueueWorkerEvidenceBundleInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            run_id: Some(run_id.clone()),
        })
        .expect("read reloaded evidence");
    assert_eq!(read.state, AgentQueueWorkerEvidenceQueryState::Available);
    assert_eq!(
        read.evidence_bundle
            .as_ref()
            .expect("reloaded evidence")
            .bundle_id,
        record.bundle_id
    );

    let review = reloaded
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id,
            queue_item_id: task.queue_item_id,
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
        })
        .expect("create review from aggregate state");
    assert_eq!(
        review.aggregate.review_state,
        QueueItemAggregateReviewState::ReviewMessageCreated
    );
    remove_test_db_files(&db_path);
}

#[test]
fn worker_evidence_command_source_does_not_execute_restricted_capabilities() {
    let source = include_str!("agent_queue_worker_evidence.rs");

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
            "worker evidence command must not call {forbidden}"
        );
    }
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue worker evidence test", None)
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

fn create_task(service: &WorkspaceService, workspace_id: &str) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: "Run this Queue task.".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            depends_on: Some(vec![]),
            execution_policy: None,
            execution_workspace: Some("C:/workspace/project".to_owned()),
            codex_executable: Some("codex".to_owned()),
            sandbox: Some("workspace_write".to_owned()),
            approval_policy: Some("never".to_owned()),
        })
        .expect("create queue task")
}

fn start_task(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) -> String {
    service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            executor_widget_instance_id: executor_id.to_owned(),
        })
        .expect("assign task");
    service
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
        })
        .expect("start task")
        .run_id
}

fn record_input(
    workspace_id: &str,
    queue_item_id: &str,
    run_id: &str,
    outcome: &str,
    summary: &str,
) -> RecordAgentQueueWorkerFinishedInput {
    RecordAgentQueueWorkerFinishedInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        run_id: run_id.to_owned(),
        outcome: outcome.to_owned(),
        summary: Some(summary.to_owned()),
        changed_files: vec!["src/lib.rs".to_owned()],
        changed_files_summary: Some("1 changed file".to_owned()),
        validation_summary: Some("Validation not run by worker evidence command.".to_owned()),
        error_summary: None,
        worker_id: Some("workspace-agent".to_owned()),
        source: Some("workspace_agent".to_owned()),
        metadata_json: None,
        finished_at: Some("worker-finished-at".to_owned()),
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

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-queue-worker-evidence-test-{}-{nanos}.sqlite",
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
