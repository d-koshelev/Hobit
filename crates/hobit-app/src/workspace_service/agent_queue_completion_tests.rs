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
fn mark_done_succeeds_after_completed_evidence_and_acked_review() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);
    let evidence = complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &task.queue_item_id,
        &executor_id,
    );
    let review = create_and_ack_review(&service, &workspace_id, &task.queue_item_id);

    let result = service
        .mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &task.queue_item_id,
            Some(evidence.run_id.as_str()),
            Some(review.message_id.as_str()),
        ))
        .expect("mark done");

    assert_eq!(result.status, AgentQueueCompletionCommandStatus::Succeeded);
    assert!(result.durable);
    assert!(result.decision_id.is_some());
    assert_eq!(result.run_id.as_deref(), Some(evidence.run_id.as_str()));
    assert_eq!(
        result.review_message_id.as_deref(),
        Some(review.message_id.as_str())
    );
    let aggregate = result.aggregate.expect("aggregate");
    assert_eq!(aggregate.ticket_state, QueueItemAggregateTicketState::Done);
    assert_eq!(aggregate.review_state, QueueItemAggregateReviewState::Done);
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    );
    assert_eq!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Available
    );
    assert_eq!(
        aggregate.validation_state,
        QueueItemAggregateValidationState::NotRequested
    );
    assert_eq!(aggregate.commit_state, QueueItemAggregateCommitState::None);
    assert!(aggregate.durable_flags.completion_state);
    assert!(aggregate.blockers.is_empty());
    assert_action_unavailable(&aggregate, "none", Some("final_done"));
}

#[test]
fn worker_completion_and_ack_alone_do_not_mark_done() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run_with_evidence(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let after_worker = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");
    assert_eq!(
        after_worker.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_ne!(
        after_worker.ticket_state,
        QueueItemAggregateTicketState::Done
    );

    create_and_ack_review(&service, &workspace_id, &task.queue_item_id);
    let after_ack = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");
    assert_eq!(
        after_ack.ticket_state,
        QueueItemAggregateTicketState::InReview
    );
    assert_eq!(
        after_ack.review_state,
        QueueItemAggregateReviewState::InReview
    );
    assert_ne!(after_ack.ticket_state, QueueItemAggregateTicketState::Done);
    assert_action_available(&after_ack, "mark_done");
}

#[test]
fn mark_done_rejects_draft_running_missing_evidence_and_missing_review() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue completion test", None)
        .expect("create workspace");
    let draft = create_task(&service, &workspace.id, "draft", false, vec![]);
    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace.id,
            &draft.queue_item_id,
            None,
            None,
        )),
        AgentQueueCompletionCommandStatus::PreconditionFailed,
        "task_is_draft",
        Some("draft"),
        Some("none"),
        Some("none"),
    );

    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let running = create_task(&service, &workspace_id, "queued", true, vec![]);
    assign_task(
        &service,
        &workspace_id,
        &running.queue_item_id,
        &executor_id,
    );
    service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &running.queue_item_id))
        .expect("start task");
    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &running.queue_item_id,
            None,
            None,
        )),
        AgentQueueCompletionCommandStatus::Blocked,
        "worker_running",
        Some("running"),
        Some("none"),
        Some("pending"),
    );

    let missing_evidence = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run(
        &service,
        &workspace_id,
        &missing_evidence.queue_item_id,
        &executor_id,
    );
    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &missing_evidence.queue_item_id,
            None,
            None,
        )),
        AgentQueueCompletionCommandStatus::Blocked,
        "durable_worker_evidence_required",
        Some("awaiting_review"),
        Some("awaiting_review"),
        Some("not_durable"),
    );

    let missing_review = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &missing_review.queue_item_id,
        &executor_id,
    );
    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &missing_review.queue_item_id,
            None,
            None,
        )),
        AgentQueueCompletionCommandStatus::Blocked,
        "review_message_required",
        Some("awaiting_review"),
        Some("awaiting_review"),
        Some("available"),
    );
}

#[test]
fn mark_done_rejects_unacked_review_failed_task_wrong_ids_and_missing_actor_or_confirmation() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run_with_evidence(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let create = service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
            run_id: None,
            evidence_bundle_id: None,
        })
        .expect("create review");

    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            None,
        )),
        AgentQueueCompletionCommandStatus::Blocked,
        "review_not_acked",
        Some("awaiting_review"),
        Some("review_message_created"),
        Some("available"),
    );

    service
        .ack_agent_queue_review_message(AckAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            message_id: create.message_id.expect("message id"),
            actor_id: "workspace-agent".to_owned(),
        })
        .expect("ack review");

    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &task.queue_item_id,
            Some("wrong-run"),
            None,
        )),
        AgentQueueCompletionCommandStatus::PreconditionFailed,
        "run_id_mismatch",
        Some("in_review"),
        Some("in_review"),
        Some("available"),
    );
    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            Some("wrong-message"),
        )),
        AgentQueueCompletionCommandStatus::PreconditionFailed,
        "review_message_id_mismatch",
        Some("in_review"),
        Some("in_review"),
        Some("available"),
    );

    let missing_actor = service
        .mark_agent_queue_item_done(MarkAgentQueueItemDoneInput {
            actor_id: " ".to_owned(),
            ..mark_done_input(&workspace_id, &task.queue_item_id, None, None)
        })
        .expect("typed invalid input");
    assert_eq!(
        missing_actor.status,
        AgentQueueCompletionCommandStatus::InvalidInput
    );
    assert_eq!(
        missing_actor
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("actorId")
    );

    let missing_confirmation = service
        .mark_agent_queue_item_done(MarkAgentQueueItemDoneInput {
            confirmation_token: "confirmed".to_owned(),
            ..mark_done_input(&workspace_id, &task.queue_item_id, None, None)
        })
        .expect("typed invalid input");
    assert_eq!(
        missing_confirmation.status,
        AgentQueueCompletionCommandStatus::InvalidInput
    );
    assert_eq!(
        missing_confirmation
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("confirmationToken")
    );

    let failed = create_task(&service, &workspace_id, "queued", true, vec![]);
    let failed_run = start_task(&service, &workspace_id, &failed.queue_item_id, &executor_id);
    service
        .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: failed.queue_item_id.clone(),
            run_id: failed_run,
            outcome: "failed".to_owned(),
            summary: Some("Failed.".to_owned()),
            changed_files: vec![],
            changed_files_summary: None,
            validation_summary: None,
            error_summary: Some("Failed.".to_owned()),
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("failed-at".to_owned()),
        })
        .expect("record failed evidence");
    assert_completion_blocker(
        service.mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &failed.queue_item_id,
            None,
            None,
        )),
        AgentQueueCompletionCommandStatus::PreconditionFailed,
        "task_failed",
        Some("failure"),
        Some("failed"),
        Some("available"),
    );
}

#[test]
fn mark_done_is_durable_and_idempotent() {
    let db_path = unique_test_db_path();
    let service = initialized_file_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run_with_evidence(&service, &workspace_id, &task.queue_item_id, &executor_id);
    create_and_ack_review(&service, &workspace_id, &task.queue_item_id);
    let first = service
        .mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            None,
        ))
        .expect("mark done");
    let first_decision = first.decision_id.clone();
    let second = service
        .mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            None,
        ))
        .expect("already done");
    assert_eq!(
        second.status,
        AgentQueueCompletionCommandStatus::AlreadyDone
    );
    assert_eq!(second.decision_id, first_decision);
    drop(service);

    let reloaded = initialized_file_service(&db_path);
    let aggregate = reloaded
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");
    assert_eq!(aggregate.ticket_state, QueueItemAggregateTicketState::Done);
    assert_eq!(aggregate.review_state, QueueItemAggregateReviewState::Done);
    assert!(aggregate.durable_flags.completion_state);
    remove_test_db_files(&db_path);
}

#[test]
fn dependency_ready_only_after_accepted_completion() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let upstream = create_task(&service, &workspace_id, "queued", true, vec![]);
    let downstream = create_task(
        &service,
        &workspace_id,
        "queued",
        true,
        vec![upstream.queue_item_id.clone()],
    );
    complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &upstream.queue_item_id,
        &executor_id,
    );
    create_and_ack_review(&service, &workspace_id, &upstream.queue_item_id);
    let before = service
        .get_queue_item_aggregate(&workspace_id, &downstream.queue_item_id)
        .expect("get downstream")
        .expect("downstream");
    assert_eq!(
        before.dependency_state,
        QueueItemAggregateDependencyState::Waiting
    );

    service
        .mark_agent_queue_item_done(mark_done_input(
            &workspace_id,
            &upstream.queue_item_id,
            None,
            None,
        ))
        .expect("mark upstream done");
    let after = service
        .get_queue_item_aggregate(&workspace_id, &downstream.queue_item_id)
        .expect("get downstream")
        .expect("downstream");
    assert_eq!(
        after.dependency_state,
        QueueItemAggregateDependencyState::Ready
    );
    assert_action_available(&after, "start_run");
}

#[test]
fn completion_command_source_does_not_execute_restricted_capabilities() {
    let source = include_str!("agent_queue_completion.rs");

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
            "completion command must not call {forbidden}"
        );
    }
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue completion test", None)
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
    depends_on: Vec<String>,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: "Run this Queue task.".to_owned(),
            status: status.to_owned(),
            priority: 1,
            depends_on: Some(depends_on),
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

fn start_task(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) -> String {
    assign_task(service, workspace_id, queue_item_id, executor_id);
    service
        .start_assigned_agent_queue_task(start_input(workspace_id, queue_item_id))
        .expect("start task")
        .run_id
}

fn complete_worker_run(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) {
    let run_id = start_task(service, workspace_id, queue_item_id, executor_id);
    service
        .store
        .finish_widget_run(
            &run_id,
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
            run_id,
            direct_work_status: "completed".to_owned(),
        })
        .expect("finish queue run");
}

fn complete_worker_run_with_evidence(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) -> AgentQueueWorkerFinishedCommandResult {
    let run_id = start_task(service, workspace_id, queue_item_id, executor_id);
    service
        .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            run_id,
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
        .expect("record worker evidence")
}

fn create_and_ack_review(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
) -> AgentQueueReviewCommandResult {
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
    service
        .ack_agent_queue_review_message(AckAgentQueueReviewMessageInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            message_id: create.message_id.expect("message id"),
            actor_id: "workspace-agent".to_owned(),
        })
        .expect("ack review")
}

fn mark_done_input(
    workspace_id: &str,
    queue_item_id: &str,
    run_id: Option<&str>,
    review_message_id: Option<&str>,
) -> MarkAgentQueueItemDoneInput {
    MarkAgentQueueItemDoneInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        actor_id: "workspace-agent".to_owned(),
        confirmation_token: AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN.to_owned(),
        reason: Some("Operator accepted completion.".to_owned()),
        run_id: run_id.map(str::to_owned),
        review_message_id: review_message_id.map(str::to_owned),
    }
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

fn assert_completion_blocker(
    result: Result<AgentQueueCompletionCommandResult, WorkspaceServiceError>,
    expected_status: AgentQueueCompletionCommandStatus,
    expected_code: &str,
    expected_ticket_state: Option<&str>,
    expected_review_state: Option<&str>,
    expected_evidence_state: Option<&str>,
) {
    let result = result.expect("typed blocker result");
    assert_eq!(result.status, expected_status);
    let blocker = result.blocker.expect("blocker");
    assert_eq!(blocker.blocker_code, expected_code);
    assert_eq!(blocker.ticket_state.as_deref(), expected_ticket_state);
    assert_eq!(blocker.review_state.as_deref(), expected_review_state);
    assert_eq!(blocker.evidence_state.as_deref(), expected_evidence_state);
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
        "hobit-queue-completion-test-{}-{nanos}.sqlite",
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
