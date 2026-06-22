use super::*;

use std::path::PathBuf;

use hobit_storage_sqlite::{
    NewAgentQueueTaskRunLink, NewWidgetRun, SqliteStore, WidgetRunFinishUpdate,
};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn headless_list_get_and_readiness_use_backend_aggregate_only() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue headless contract", None)
        .expect("create workspace");
    enable_queue_manual(&service, &workspace.id);
    let draft = create_task(
        &service,
        &workspace.id,
        QueueTaskSeed {
            status: "draft",
            prompt: "",
            with_run_settings: false,
            ..QueueTaskSeed::default()
        },
    );

    let listed = service
        .list_queue_item_aggregates(&workspace.id)
        .expect("list aggregates");
    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &draft.queue_item_id)
        .expect("get aggregate")
        .expect("aggregate");

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].task_id, draft.queue_item_id);
    assert_eq!(aggregate.ticket_state, QueueItemAggregateTicketState::Draft);
    assert_eq!(
        aggregate.worker_run_state,
        QueueItemAggregateWorkerRunState::NotStarted
    );
    assert_eq!(aggregate.review_state, QueueItemAggregateReviewState::None);
    assert_eq!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::None
    );
    assert_eq!(
        aggregate.validation_state,
        QueueItemAggregateValidationState::NotRequested
    );
    assert_eq!(aggregate.commit_state, QueueItemAggregateCommitState::None);
    assert_eq!(
        aggregate.dependency_state,
        QueueItemAggregateDependencyState::None
    );
    assert_blocker(&aggregate, "missing_prompt");
    assert_blocker(&aggregate, "missing_workspace");
    assert_blocker(&aggregate, "missing_codex_executable");
    assert_blocker(&aggregate, "missing_sandbox");
    assert_blocker(&aggregate, "missing_approval_policy");
    assert_blocker(&aggregate, "task_is_draft");
    assert_action(&aggregate, "update_run_settings");
    assert!(aggregate.durable_flags.task_row);
    assert!(!aggregate.durable_flags.latest_run_link);
    assert!(!aggregate.durable_flags.frontend_overlay_used);

    let queued = promote_draft_with_run_settings(&service, &draft);
    let aggregate = service
        .get_queue_item_aggregate(&workspace.id, &queued.queue_item_id)
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
    assert!(aggregate.blockers.is_empty());
    assert_action(&aggregate, "start_run");
    assert_eq!(
        aggregate.run_settings.execution_workspace.as_deref(),
        Some("C:/workspace/project")
    );
    assert_eq!(
        aggregate.run_settings.codex_executable.as_deref(),
        Some("codex")
    );
    assert_eq!(
        aggregate.run_settings.sandbox.as_deref(),
        Some("workspace_write")
    );
    assert_eq!(
        aggregate.run_settings.approval_policy.as_deref(),
        Some("never")
    );
    assert!(!aggregate.durable_flags.frontend_overlay_used);
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
fn headless_running_and_completed_run_links_drive_awaiting_review_not_done() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(
        &service,
        &workspace_id,
        QueueTaskSeed {
            status: "queued",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start task rows");
    let running = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get running aggregate")
        .expect("running aggregate");

    assert_eq!(running.ticket_state, QueueItemAggregateTicketState::Running);
    assert_eq!(
        running.worker_run_state,
        QueueItemAggregateWorkerRunState::Running
    );
    assert_eq!(
        running.evidence_state,
        QueueItemAggregateEvidenceState::Pending
    );
    assert_eq!(
        running.latest_run.as_ref().expect("latest run").run_id,
        start.run_id
    );
    assert_blocker(&running, "worker_running");
    assert!(!running.durable_flags.frontend_overlay_used);

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
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id,
            run_id: start.run_id,
            direct_work_status: "completed".to_owned(),
        })
        .expect("finish queue run");

    let completed = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get completed aggregate")
        .expect("completed aggregate");

    assert_eq!(
        completed.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_ne!(completed.ticket_state, QueueItemAggregateTicketState::Done);
    assert_eq!(
        completed.worker_run_state,
        QueueItemAggregateWorkerRunState::Completed
    );
    assert_eq!(
        completed.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    );
    assert_eq!(
        completed.evidence_state,
        QueueItemAggregateEvidenceState::NotDurable
    );
    assert_eq!(
        completed.validation_state,
        QueueItemAggregateValidationState::NotRequested
    );
    assert_eq!(completed.commit_state, QueueItemAggregateCommitState::None);
    assert_eq!(
        completed
            .evidence_summary
            .as_ref()
            .and_then(|summary| summary.not_durable_reason.as_deref()),
        Some("Queue worker evidence bundle has not been recorded durably yet.")
    );
    assert_action(&completed, "create_review_message");
    assert!(completed.next_actions[0].available);
    assert_eq!(
        completed.next_actions[0].unavailable_reason.as_deref(),
        None
    );
    assert!(!completed.durable_flags.frontend_overlay_used);
}

#[test]
fn headless_failed_run_link_awaits_review_without_terminal_failure() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(
        &service,
        &workspace_id,
        QueueTaskSeed {
            status: "queued",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start task rows");
    service
        .store
        .finish_widget_run(
            &start.run_id,
            WidgetRunFinishUpdate {
                status: "failed",
                finished_at: Some("failed-at"),
                summary: Some("Worker failed."),
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
        .expect("finish queue run");

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
        QueueItemAggregateWorkerRunState::Failed
    );
    assert_eq!(
        aggregate.review_state,
        QueueItemAggregateReviewState::AwaitingReview
    );
    assert_eq!(
        aggregate.evidence_state,
        QueueItemAggregateEvidenceState::NotDurable
    );
    assert_blocker(&aggregate, "awaiting_review");
    assert_action(&aggregate, "create_review_message");
    assert_eq!(
        aggregate.next_actions[0].unavailable_reason.as_deref(),
        None
    );
}

#[test]
fn headless_dependency_gate_waits_for_accepted_completion_not_worker_completion() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue headless dependencies", None)
        .expect("create workspace");
    let upstream = create_task(
        &service,
        &workspace.id,
        QueueTaskSeed {
            status: "completed",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    let downstream = create_task(
        &service,
        &workspace.id,
        QueueTaskSeed {
            status: "queued",
            with_run_settings: true,
            depends_on: vec![upstream.queue_item_id.clone()],
            ..QueueTaskSeed::default()
        },
    );

    let upstream_aggregate = service
        .get_queue_item_aggregate(&workspace.id, &upstream.queue_item_id)
        .expect("get upstream")
        .expect("upstream");
    let downstream_aggregate = service
        .get_queue_item_aggregate(&workspace.id, &downstream.queue_item_id)
        .expect("get downstream")
        .expect("downstream");

    assert_eq!(
        upstream_aggregate.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_ne!(
        upstream_aggregate.ticket_state,
        QueueItemAggregateTicketState::Done
    );
    assert_eq!(
        downstream_aggregate.dependency_state,
        QueueItemAggregateDependencyState::Waiting
    );
    assert_eq!(
        downstream_aggregate.ticket_state,
        QueueItemAggregateTicketState::Queued
    );
    assert_blocker(&downstream_aggregate, "dependency_waiting");
    assert_eq!(
        downstream_aggregate.next_actions[0]
            .unavailable_reason
            .as_deref(),
        Some("dependencies_not_ready")
    );
}

#[test]
fn headless_raw_failed_upstream_without_failure_decision_keeps_dependency_waiting() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue headless dependencies", None)
        .expect("create workspace");
    let upstream = create_task(
        &service,
        &workspace.id,
        QueueTaskSeed {
            status: "failed",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    let downstream = create_task(
        &service,
        &workspace.id,
        QueueTaskSeed {
            status: "queued",
            with_run_settings: true,
            depends_on: vec![upstream.queue_item_id],
            ..QueueTaskSeed::default()
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
    assert_eq!(
        aggregate.next_actions[0].unavailable_reason.as_deref(),
        Some("dependencies_not_ready")
    );
}

#[test]
fn headless_queries_are_read_only_and_use_explicit_task_identity() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let referenced = create_task(
        &service,
        &workspace_id,
        QueueTaskSeed {
            title: "Referenced task",
            status: "queued",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    let task = create_task(
        &service,
        &workspace_id,
        QueueTaskSeed {
            title: "Please start Referenced task",
            prompt:
                "Natural-language text says start Referenced task, but the API requires task id.",
            status: "queued",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let before_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get task before");
    let before_links = service
        .list_agent_queue_task_run_links(&workspace_id, &task.queue_item_id)
        .expect("list links before");

    let by_title = service
        .get_queue_item_aggregate(&workspace_id, "Please start Referenced task")
        .expect("get by title");
    let by_prompt_target = service
        .get_queue_item_aggregate(&workspace_id, &referenced.title)
        .expect("get by referenced title");
    let _by_id = service
        .get_queue_item_aggregate(&workspace_id, &task.queue_item_id)
        .expect("get by id");
    let _list = service
        .list_queue_item_aggregates(&workspace_id)
        .expect("list aggregates");

    let after_task = service
        .get_agent_queue_task(&workspace_id, &task.queue_item_id)
        .expect("get task after");
    let after_links = service
        .list_agent_queue_task_run_links(&workspace_id, &task.queue_item_id)
        .expect("list links after");

    assert!(by_title.is_none());
    assert!(by_prompt_target.is_none());
    assert_eq!(before_task, after_task);
    assert_eq!(before_links, after_links);
    assert!(after_links.is_empty());
}

#[test]
fn headless_not_durable_and_unknown_states_are_explicit() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let not_durable_task = create_task(
        &service,
        &workspace_id,
        QueueTaskSeed {
            status: "completed",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    let unknown_task = create_task(
        &service,
        &workspace_id,
        QueueTaskSeed {
            status: "queued",
            with_run_settings: true,
            ..QueueTaskSeed::default()
        },
    );
    assign_task(
        &service,
        &workspace_id,
        &unknown_task.queue_item_id,
        &executor_id,
    );
    seed_unknown_run_link(
        &service,
        &workspace_id,
        &unknown_task.queue_item_id,
        &executor_id,
    );

    let not_durable = service
        .get_queue_item_aggregate(&workspace_id, &not_durable_task.queue_item_id)
        .expect("get not durable")
        .expect("not durable aggregate");
    let unknown = service
        .get_queue_item_aggregate(&workspace_id, &unknown_task.queue_item_id)
        .expect("get unknown")
        .expect("unknown aggregate");

    assert_eq!(
        not_durable.ticket_state,
        QueueItemAggregateTicketState::AwaitingReview
    );
    assert_eq!(
        not_durable.evidence_state,
        QueueItemAggregateEvidenceState::NotDurable
    );
    assert_eq!(
        not_durable
            .evidence_summary
            .as_ref()
            .and_then(|summary| summary.not_durable_reason.as_deref()),
        Some("Queue worker evidence bundle has not been recorded durably yet.")
    );
    assert!(!not_durable.durable_flags.evidence_state);
    assert!(!not_durable.durable_flags.frontend_overlay_used);

    assert_eq!(
        unknown.worker_run_state,
        QueueItemAggregateWorkerRunState::Unknown
    );
    assert_eq!(
        unknown.evidence_state,
        QueueItemAggregateEvidenceState::Unknown
    );
    assert_eq!(
        unknown.validation_state,
        QueueItemAggregateValidationState::Unknown
    );
    assert!(!unknown.durable_flags.evidence_state);
    assert!(!unknown.durable_flags.validation_state);
    assert!(!unknown.durable_flags.frontend_overlay_used);
    assert_eq!(
        unknown.latest_run.as_ref().expect("latest run").status,
        "mystery"
    );
}

#[test]
fn headless_backend_queue_sources_do_not_add_prompt_regex_routing() {
    let sources = [
        include_str!("agent_queue_aggregate.rs"),
        include_str!("agent_queue_tasks.rs"),
        include_str!("agent_queue_execution.rs"),
        include_str!("agent_queue_run_links.rs"),
        include_str!("agent_queue_task_dependencies.rs"),
    ];

    for source in sources {
        for forbidden in [
            "regex::",
            "Regex::new",
            "hobit.action.request",
            "prompt_regex",
            "phrase route",
        ] {
            assert!(
                !source.contains(forbidden),
                "Queue backend/headless API must not add prompt routing marker {forbidden}"
            );
        }
    }
}

#[derive(Clone)]
struct QueueTaskSeed {
    title: &'static str,
    status: &'static str,
    prompt: &'static str,
    with_run_settings: bool,
    depends_on: Vec<String>,
}

impl Default for QueueTaskSeed {
    fn default() -> Self {
        Self {
            title: "Queue task",
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
    seed: QueueTaskSeed,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: seed.title.to_owned(),
            description: String::new(),
            prompt: seed.prompt.to_owned(),
            status: seed.status.to_owned(),
            priority: 1,
            depends_on: Some(seed.depends_on),
            execution_policy: None,
            execution_workspace: seed
                .with_run_settings
                .then(|| "C:/workspace/project".to_owned()),
            codex_executable: seed.with_run_settings.then(|| "codex".to_owned()),
            sandbox: seed.with_run_settings.then(|| "workspace_write".to_owned()),
            approval_policy: seed.with_run_settings.then(|| "never".to_owned()),
        })
        .expect("create queue task")
}

fn promote_draft_with_run_settings(
    service: &WorkspaceService,
    task: &AgentQueueTaskSummary,
) -> AgentQueueTaskSummary {
    service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: task.workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            title: task.title.clone(),
            description: task.description.clone(),
            prompt: "Run this Queue task.".to_owned(),
            status: "queued".to_owned(),
            priority: task.priority,
            depends_on: Some(task.depends_on.clone()),
            execution_policy: Some("manual".to_owned()),
            execution_workspace: Some("C:/workspace/project".to_owned()),
            codex_executable: Some("codex".to_owned()),
            sandbox: Some("workspace_write".to_owned()),
            approval_policy: Some("never".to_owned()),
        })
        .expect("update task")
        .expect("updated task")
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue headless contract", None)
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
        workflow_start_context: None,
    }
}

fn seed_unknown_run_link(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) {
    service
        .store
        .insert_widget_run(NewWidgetRun {
            id: "run_unknown",
            widget_instance_id: executor_id,
            status: "running",
            command_kind: Some(direct_work::CODEX_DIRECT_WORK_COMMAND_KIND),
            command_payload: Some("{}"),
            started_at: Some("1"),
            finished_at: None,
            summary: Some("Unknown status fixture"),
        })
        .expect("insert widget run");
    service
        .store
        .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
            link_id: "link_unknown",
            workspace_id,
            queue_task_id: queue_item_id,
            executor_widget_id: executor_id,
            direct_work_run_id: "run_unknown",
            source: "manual",
            status: "mystery",
            started_at: Some("1"),
            completed_at: None,
            validation_status: Some("mystery"),
            review_status: Some("mystery"),
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("insert run link");
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
