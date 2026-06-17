use super::*;

use std::path::PathBuf;

use hobit_storage_sqlite::SqliteStore;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn draft_task_with_missing_settings_reports_draft_blockers() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue aggregate workspace", None)
        .expect("create workspace");
    let task = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "draft",
            prompt: "",
            ..CreateTaskOptions::default()
        },
    );

    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(aggregate.ticket_state, QueueItemAggregateTicketState::Draft);
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::NotStarted
    );
    assert_blocker(&aggregate, "missing_prompt");
    assert_blocker(&aggregate, "missing_workspace");
    assert_blocker(&aggregate, "missing_codex_executable");
    assert_blocker(&aggregate, "task_is_draft");
    assert_action(&aggregate, "update_run_settings");
    assert!(aggregate.durable_flags.task_row);
    assert!(!aggregate.durable_flags.frontend_overlay_used);
}

#[test]
fn queued_task_with_run_settings_can_start() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue aggregate workspace", None)
        .expect("create workspace");
    let task = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );

    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Queued
    );
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::NotStarted
    );
    assert_eq!(
        aggregate.dependency_state,
        QueueItemAggregateDependencyState::None
    );
    assert_action(&aggregate, "start_run");
    assert!(aggregate.blockers.is_empty());
}

#[test]
fn running_task_and_run_link_report_running_state() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(
        &service,
        &workspace_id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start task");

    let aggregate = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Running
    );
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Running
    );
    assert_eq!(
        aggregate.latest_run.as_ref().expect("latest run").run_id,
        start.run_id
    );
    assert_blocker(&aggregate, "worker_running");
    assert_eq!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Pending
    );
}

#[test]
fn successful_completed_run_awaits_review_and_is_not_done() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(
        &service,
        &workspace_id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start task");
    service
        .store
        .finish_widget_run(
            &start.run_id,
            hobit_storage_sqlite::WidgetRunFinishUpdate {
                status: "completed",
                finished_at: Some("done-at"),
                summary: Some("Final response summary."),
            },
        )
        .expect("finish widget run");
    service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id,
            run_id: start.run_id,
            direct_work_status: "completed".to_owned(),
        })
        .expect("finish assigned run");

    let aggregate = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_ne!(aggregate.ticket_state, QueueItemAggregateTicketState::Done);
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    );
    assert_eq!(
        aggregate.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    );
    assert_eq!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::Available
    );
    assert_eq!(
        aggregate
            .evidence_summary
            .as_ref()
            .and_then(|summary| summary.summary.as_deref()),
        Some("Final response summary.")
    );
    assert_action(&aggregate, "create_review_message");
}

#[test]
fn failed_run_reports_failure_without_marking_done() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(
        &service,
        &workspace_id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start task");
    service
        .store
        .finish_widget_run(
            &start.run_id,
            hobit_storage_sqlite::WidgetRunFinishUpdate {
                status: "failed",
                finished_at: Some("failed-at"),
                summary: Some("Direct Work failed."),
            },
        )
        .expect("finish widget run");
    service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id,
            run_id: start.run_id,
            direct_work_status: "failed".to_owned(),
        })
        .expect("finish assigned run");

    let aggregate = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Failure
    );
    assert_ne!(aggregate.ticket_state, QueueItemAggregateTicketState::Done);
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::Failed
    );
    assert_eq!(
        aggregate.review_state,
        QueueItemAggregateReviewState::Failed
    );
    assert_blocker(&aggregate, "final_failed");
}

#[test]
fn raw_completed_task_without_accepted_state_is_awaiting_review_not_done() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue aggregate workspace", None)
        .expect("create workspace");
    let task = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "completed",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );

    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &task.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_ne!(aggregate.ticket_state, QueueItemAggregateTicketState::Done);
    assert_eq!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::NotDurable
    );
}

#[test]
fn dependency_waiting_does_not_treat_completed_worker_as_accepted_done() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue aggregate workspace", None)
        .expect("create workspace");
    let upstream = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "completed",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );
    let downstream = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            depends_on: vec![upstream.queue_item_id],
            ..CreateTaskOptions::default()
        },
    );

    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &downstream.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.dependency_state,
        QueueItemAggregateDependencyState::Waiting
    );
    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Queued
    );
    assert_blocker(&aggregate, "dependency_waiting");
}

#[test]
fn dependency_failed_upstream_blocks_queued_dependent() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue aggregate workspace", None)
        .expect("create workspace");
    let upstream = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "failed",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );
    let downstream = create_task(
        &service,
        &workspace.id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            depends_on: vec![upstream.queue_item_id],
            ..CreateTaskOptions::default()
        },
    );

    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &downstream.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(
        aggregate.dependency_state,
        QueueItemAggregateDependencyState::FailedUpstream
    );
    assert_eq!(
        aggregate.ticket_state,
        QueueItemAggregateTicketState::Blocked
    );
    assert_blocker(&aggregate, "dependency_failed");
}

#[test]
fn aggregate_queries_do_not_mutate_task_or_run_link_state() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(
        &service,
        &workspace_id,
        CreateTaskOptions {
            status: "queued",
            with_run_settings: true,
            ..CreateTaskOptions::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start task");
    let before_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get before task");
    let before_link = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &task.queue_item_id)
        .expect("get before link");

    let _ = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get aggregate");
    let _ = service
        .list_queue_item_aggregates(&workspace_id)
        .expect("list aggregates");

    let after_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get after task");
    let after_link = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &task.queue_item_id)
        .expect("get after link");
    assert_eq!(before_task, after_task);
    assert_eq!(before_link, after_link);
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue aggregate workspace", None)
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

#[derive(Clone)]
struct CreateTaskOptions {
    status: &'static str,
    prompt: &'static str,
    with_run_settings: bool,
    depends_on: Vec<String>,
}

impl Default for CreateTaskOptions {
    fn default() -> Self {
        Self {
            status: "queued",
            prompt: "Run this Queue task.",
            with_run_settings: false,
            depends_on: Vec::new(),
        }
    }
}

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    options: CreateTaskOptions,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: options.prompt.to_owned(),
            status: options.status.to_owned(),
            priority: 1,
            depends_on: Some(options.depends_on),
            execution_policy: None,
            execution_workspace: options
                .with_run_settings
                .then(|| "C:/workspace/project".to_owned()),
            codex_executable: options.with_run_settings.then(|| "codex".to_owned()),
            sandbox: options
                .with_run_settings
                .then(|| "workspace_write".to_owned()),
            approval_policy: options.with_run_settings.then(|| "never".to_owned()),
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

fn assert_action(aggregate: &QueueItemAggregate, code: &str) {
    assert!(
        aggregate
            .next_actions
            .iter()
            .any(|action| action.code == code),
        "expected action {code}, got {:?}",
        aggregate.next_actions
    );
}
