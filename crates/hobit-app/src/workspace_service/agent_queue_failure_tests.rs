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
fn fail_succeeds_after_durable_evidence_acked_review_reason_and_confirmation() {
    let db_path = unique_test_db_path();
    let service = initialized_file_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);
    let evidence = complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &task.queue_item_id,
        &executor_id,
        "completed",
    );
    let review = create_and_ack_review(&service, &workspace_id, &task.queue_item_id);

    let result = service
        .fail_agent_queue_item(fail_input(
            &workspace_id,
            &task.queue_item_id,
            Some(evidence.run_id.as_str()),
            Some(evidence.bundle_id.as_str()),
            Some(review.message_id.as_str()),
        ))
        .expect("fail queue item");

    assert_eq!(result.status, AgentQueueFailureCommandStatus::Succeeded);
    assert!(result.durable);
    assert_eq!(result.run_id.as_deref(), Some(evidence.run_id.as_str()));
    assert_eq!(
        result.evidence_bundle_id.as_deref(),
        Some(evidence.bundle_id.as_str())
    );
    assert_eq!(
        result.review_message_id.as_deref(),
        Some(review.message_id.as_str())
    );
    let decision = result.failure_decision.as_ref().expect("decision");
    assert_eq!(decision.decision, AGENT_QUEUE_FAILURE_DECISION_FAILED);
    assert_eq!(decision.actor_id, "workspace-agent");
    assert_eq!(decision.reason, "Operator rejected completion.");

    let aggregate = result.aggregate.as_ref().expect("aggregate");
    assert_terminal_failure_aggregate(aggregate);
    assert!(aggregate.durable_flags.failure_state);
    assert!(!aggregate.durable_flags.completion_state);

    drop(service);
    let reloaded = initialized_file_service(&db_path);
    let aggregate = reloaded
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");
    assert_terminal_failure_aggregate(&aggregate);
    assert!(aggregate.durable_flags.failure_state);
    remove_test_db_files(&db_path);
}

#[test]
fn durable_failure_decision_propagates_failed_upstream_to_dependents() {
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
        "failed",
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
    assert_no_action(&before, "start_run");

    service
        .fail_agent_queue_item(fail_input(
            &workspace_id,
            &upstream.queue_item_id,
            None,
            None,
            None,
        ))
        .expect("fail upstream");
    let after = service
        .get_queue_item_aggregate(&workspace_id, &downstream.queue_item_id)
        .expect("get downstream")
        .expect("downstream");

    assert_eq!(
        after.dependency_state,
        QueueItemAggregateDependencyState::FailedUpstream
    );
    assert_eq!(after.ticket_state, QueueItemAggregateTicketState::Blocked);
    assert_blocker(&after, "dependency_failed");
    assert_action_unavailable(&after, "none", Some("dependency_failed"));
    assert_no_action(&after, "start_run");
}

#[test]
fn worker_failure_evidence_alone_does_not_mark_terminal_failure() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);

    complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &task.queue_item_id,
        &executor_id,
        "failed",
    );
    let after_evidence = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");
    assert_eq!(
        after_evidence.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_eq!(
        after_evidence.worker_run_state,
        QueueItemAggregateWorkerRunState::Failed
    );
    assert_eq!(
        after_evidence.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    );
    assert_eq!(
        after_evidence.evidence_state,
        QueueItemAggregateEvidenceState::Available
    );
    assert!(!after_evidence.durable_flags.failure_state);
    assert_no_blocker(&after_evidence, "final_failed");
    assert_action_available(&after_evidence, "create_review_message");

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
    assert!(!after_ack.durable_flags.failure_state);
    assert_no_blocker(&after_ack, "final_failed");
}

#[test]
fn fail_rejects_draft_queued_running_missing_evidence_review_and_unacked_review() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue failure test", None)
        .expect("create workspace");
    enable_queue_manual(&service, &workspace.id);
    let draft = create_task(&service, &workspace.id, "draft", false, vec![]);
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace.id,
            &draft.queue_item_id,
            None,
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::PreconditionFailed,
        "task_is_draft",
        Some("draft"),
        Some("none"),
        Some("none"),
    );

    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let queued = create_task(&service, &workspace_id, "queued", true, vec![]);
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &queued.queue_item_id,
            None,
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::Blocked,
        "task_is_queued",
        Some("queued"),
        Some("none"),
        Some("none"),
    );

    let running = create_task(&service, &workspace_id, "queued", true, vec![]);
    start_task(
        &service,
        &workspace_id,
        &running.queue_item_id,
        &executor_id,
    );
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &running.queue_item_id,
            None,
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::Blocked,
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
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &missing_evidence.queue_item_id,
            None,
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::Blocked,
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
        "failed",
    );
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &missing_review.queue_item_id,
            None,
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::Blocked,
        "review_message_required",
        Some("awaiting_review"),
        Some("awaiting_review"),
        Some("available"),
    );

    let unacked = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &unacked.queue_item_id,
        &executor_id,
        "failed",
    );
    service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: unacked.queue_item_id.clone(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
            run_id: None,
            evidence_bundle_id: None,
        })
        .expect("create review");
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &unacked.queue_item_id,
            None,
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::Blocked,
        "review_not_acked",
        Some("awaiting_review"),
        Some("review_message_created"),
        Some("available"),
    );
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
fn fail_rejects_wrong_guards_missing_required_fields_done_and_already_failed() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", true, vec![]);
    let evidence = complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &task.queue_item_id,
        &executor_id,
        "failed",
    );
    let review = create_and_ack_review(&service, &workspace_id, &task.queue_item_id);

    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &task.queue_item_id,
            Some("wrong-run"),
            None,
            None,
        )),
        AgentQueueFailureCommandStatus::PreconditionFailed,
        "run_id_mismatch",
        Some("in_review"),
        Some("in_review"),
        Some("available"),
    );
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            Some("wrong-evidence"),
            None,
        )),
        AgentQueueFailureCommandStatus::PreconditionFailed,
        "evidence_bundle_id_mismatch",
        Some("in_review"),
        Some("in_review"),
        Some("available"),
    );
    assert_failure_blocker(
        service.fail_agent_queue_item(fail_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            None,
            Some("wrong-message"),
        )),
        AgentQueueFailureCommandStatus::PreconditionFailed,
        "message_id_mismatch",
        Some("in_review"),
        Some("in_review"),
        Some("available"),
    );

    let missing_actor = service
        .fail_agent_queue_item(FailAgentQueueItemInput {
            actor_id: " ".to_owned(),
            ..fail_input(&workspace_id, &task.queue_item_id, None, None, None)
        })
        .expect("typed invalid input");
    assert_eq!(
        missing_actor.status,
        AgentQueueFailureCommandStatus::InvalidInput
    );
    assert_eq!(
        missing_actor
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("actorId")
    );

    let missing_confirmation = service
        .fail_agent_queue_item(FailAgentQueueItemInput {
            confirmation_token: "operator said yes".to_owned(),
            ..fail_input(&workspace_id, &task.queue_item_id, None, None, None)
        })
        .expect("typed invalid input");
    assert_eq!(
        missing_confirmation.status,
        AgentQueueFailureCommandStatus::InvalidInput
    );
    assert_eq!(
        missing_confirmation
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("confirmationToken")
    );

    let missing_reason = service
        .fail_agent_queue_item(FailAgentQueueItemInput {
            reason: "  ".to_owned(),
            ..fail_input(&workspace_id, &task.queue_item_id, None, None, None)
        })
        .expect("typed invalid input");
    assert_eq!(
        missing_reason.status,
        AgentQueueFailureCommandStatus::InvalidInput
    );
    assert_eq!(
        missing_reason
            .blocker
            .as_ref()
            .and_then(|blocker| blocker.missing_required_field.as_deref()),
        Some("reason")
    );

    let first = service
        .fail_agent_queue_item(fail_input(
            &workspace_id,
            &task.queue_item_id,
            Some(evidence.run_id.as_str()),
            Some(evidence.bundle_id.as_str()),
            Some(review.message_id.as_str()),
        ))
        .expect("fail item");
    let second = service
        .fail_agent_queue_item(fail_input(
            &workspace_id,
            &task.queue_item_id,
            None,
            None,
            None,
        ))
        .expect("already failed");
    assert_eq!(second.status, AgentQueueFailureCommandStatus::AlreadyFailed);
    assert_eq!(second.decision_id, first.decision_id);

    let done = create_task(&service, &workspace_id, "queued", true, vec![]);
    complete_worker_run_with_evidence(
        &service,
        &workspace_id,
        &done.queue_item_id,
        &executor_id,
        "completed",
    );
    create_and_ack_review(&service, &workspace_id, &done.queue_item_id);
    service
        .mark_agent_queue_item_done(mark_done_input(&workspace_id, &done.queue_item_id))
        .expect("mark done");
    let already_done = service
        .fail_agent_queue_item(fail_input(
            &workspace_id,
            &done.queue_item_id,
            None,
            None,
            None,
        ))
        .expect("already done");
    assert_eq!(
        already_done.status,
        AgentQueueFailureCommandStatus::AlreadyDone
    );
    assert_eq!(
        already_done
            .aggregate
            .as_ref()
            .expect("aggregate")
            .ticket_state,
        QueueItemAggregateTicketState::Done
    );
}

#[test]
fn failure_command_source_does_not_execute_restricted_capabilities() {
    let source = include_str!("agent_queue_failure.rs");

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
            "failure command must not call {forbidden}"
        );
    }
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue failure test", None)
        .expect("create workspace");
    enable_queue_manual(service, &workspace.id);
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
    enable_queue_manual(service, workspace_id);
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
    outcome: &str,
) -> AgentQueueWorkerFinishedCommandResult {
    let run_id = start_task(service, workspace_id, queue_item_id, executor_id);
    service
        .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            run_id,
            outcome: outcome.to_owned(),
            summary: Some("Worker evidence is durable.".to_owned()),
            changed_files: vec!["src/lib.rs".to_owned()],
            changed_files_summary: Some("src/lib.rs".to_owned()),
            validation_summary: Some("validation not run".to_owned()),
            error_summary: (outcome == "failed").then(|| "Worker failed.".to_owned()),
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

fn fail_input(
    workspace_id: &str,
    queue_item_id: &str,
    run_id: Option<&str>,
    evidence_bundle_id: Option<&str>,
    review_message_id: Option<&str>,
) -> FailAgentQueueItemInput {
    FailAgentQueueItemInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        actor_id: "workspace-agent".to_owned(),
        confirmation_token: AGENT_QUEUE_FAILURE_CONFIRMATION_TOKEN.to_owned(),
        reason: "Operator rejected completion.".to_owned(),
        run_id: run_id.map(str::to_owned),
        evidence_bundle_id: evidence_bundle_id.map(str::to_owned),
        review_message_id: review_message_id.map(str::to_owned),
    }
}

fn mark_done_input(workspace_id: &str, queue_item_id: &str) -> MarkAgentQueueItemDoneInput {
    MarkAgentQueueItemDoneInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        actor_id: "workspace-agent".to_owned(),
        confirmation_token: AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN.to_owned(),
        reason: Some("Operator accepted completion.".to_owned()),
        run_id: None,
        review_message_id: None,
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
        workflow_start_context: None,
    }
}

fn assert_terminal_failure_aggregate(aggregate: &QueueItemAggregate) {
    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Failure
    );
    assert_eq!(
        aggregate.review_state,
        QueueItemAggregateReviewState::Failed
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
    assert_blocker(aggregate, "final_failed");
    assert_action_unavailable(aggregate, "none", Some("final_failed"));
}

fn assert_failure_blocker(
    result: Result<AgentQueueFailureCommandResult, WorkspaceServiceError>,
    expected_status: AgentQueueFailureCommandStatus,
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

fn assert_blocker(aggregate: &QueueItemAggregate, code: &str) {
    assert!(
        aggregate
            .blockers
            .iter()
            .any(|blocker| blocker.code == code),
        "expected blocker {code}, got {:?}",
        aggregate.blockers
    );
}

fn assert_no_blocker(aggregate: &QueueItemAggregate, code: &str) {
    assert!(
        aggregate
            .blockers
            .iter()
            .all(|blocker| blocker.code != code),
        "expected no blocker {code}, got {:?}",
        aggregate.blockers
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

fn assert_no_action(aggregate: &QueueItemAggregate, code: &str) {
    assert!(
        aggregate
            .next_actions
            .iter()
            .all(|action| action.code != code),
        "expected no action {code}, got {:?}",
        aggregate.next_actions
    );
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-queue-failure-test-{}-{nanos}.sqlite",
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
