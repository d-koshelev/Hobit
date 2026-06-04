use super::types::{QueueRunnerSessionId, QueueRunnerStatus};
use super::*;
use hobit_app::AgentQueueTaskSummary;

#[test]
fn default_runner_snapshot_is_idle_and_session_only() {
    let snapshot = QueueRunnerSnapshot::default();

    assert_eq!(snapshot.status, QueueRunnerStatus::Idle);
    assert!(snapshot.is_session_only());
    assert!(!snapshot.status.is_active());
}

#[test]
fn explicit_start_armed_state_is_distinct_from_task_creation() {
    let request =
        QueueRunnerStartRequest::new(QueueRunnerSessionId::new("runner_1"), "ws_1", "wid_1");
    let snapshot = QueueRunnerSnapshot::armed(request.session_id.clone());

    assert!(request.is_explicit_operator_start());
    assert_eq!(snapshot.status, QueueRunnerStatus::Armed);
    assert_ne!(snapshot.status, QueueRunnerStatus::Idle);
    assert!(snapshot.status.is_active());
}

#[test]
fn default_policy_does_not_allow_hidden_execution_or_durable_resume() {
    let policy = QueueRunnerPolicy::default();

    assert!(policy.require_operator_start);
    assert!(policy.one_task_at_a_time);
    assert!(policy.stop_on_failure);
    assert!(policy.stop_on_review_needed);
    assert!(policy.stop_on_cancel);
    assert!(!policy.allow_hidden_execution);
    assert!(!policy.persists_runner_state());
}

#[test]
fn stop_reasons_cover_first_autorun_runner_boundaries() {
    let reasons = [
        QueueRunnerStopReason::OperatorStopped,
        QueueRunnerStopReason::NoRunnableTasks,
        QueueRunnerStopReason::ManualTaskRequiresOperator,
        QueueRunnerStopReason::PreviousSuccessRequired,
        QueueRunnerStopReason::PreviousTaskNotSuccessful,
        QueueRunnerStopReason::AssignedToDifferentExecutor,
        QueueRunnerStopReason::ExecutorBusy,
        QueueRunnerStopReason::MissingExecutor,
        QueueRunnerStopReason::MissingPrompt,
        QueueRunnerStopReason::InvalidConfig,
        QueueRunnerStopReason::TaskFailed,
        QueueRunnerStopReason::ReviewNeeded,
        QueueRunnerStopReason::TaskCancelled,
        QueueRunnerStopReason::TaskKilled,
        QueueRunnerStopReason::UnknownFinalStatus,
        QueueRunnerStopReason::AppSessionEnded,
    ];

    assert!(reasons.contains(&QueueRunnerStopReason::TaskFailed));
    assert!(reasons.contains(&QueueRunnerStopReason::ReviewNeeded));
    assert!(reasons.contains(&QueueRunnerStopReason::TaskCancelled));
    assert!(reasons.contains(&QueueRunnerStopReason::MissingExecutor));
    assert!(reasons.contains(&QueueRunnerStopReason::MissingPrompt));
    assert!(reasons.contains(&QueueRunnerStopReason::InvalidConfig));
    assert!(reasons.contains(&QueueRunnerStopReason::UnknownFinalStatus));
}

#[test]
fn snapshot_debug_output_does_not_expose_sensitive_runtime_text() {
    let snapshot = QueueRunnerSnapshot {
        session_id: Some(QueueRunnerSessionId::new("sk-secret-runner")),
        status: QueueRunnerStatus::WaitingForExecutor,
        policy: QueueRunnerPolicy::default(),
        active_queue_item_id: Some("prompt with sk-secret and stdout".to_owned()),
        waiting_run_id: Some("C:\\Users\\person\\repo --danger".to_owned()),
        final_run_status: Some("final response sk-secret".to_owned()),
        last_reconciled_at: Some("unix_ms:123".to_owned()),
        stop_reason: Some(QueueRunnerStopReason::TaskFailed),
    };

    let debug = format!("{snapshot:?}");

    assert!(!debug.contains("sk-secret"));
    assert!(!debug.contains("stdout"));
    assert!(!debug.contains("final response"));
    assert!(!debug.contains("C:\\Users"));
    assert!(!debug.contains("--danger"));
    assert!(debug.contains("<redacted>"));
    assert!(debug.contains("WaitingForExecutor"));
}

#[test]
fn start_request_debug_output_redacts_ids_and_paths() {
    let request = QueueRunnerStartRequest::new(
        QueueRunnerSessionId::new("runner-sk-secret"),
        "C:\\Users\\person\\workspace",
        "executor --arg",
    );

    let debug = format!("{request:?}");

    assert!(!debug.contains("runner-sk-secret"));
    assert!(!debug.contains("C:\\Users"));
    assert!(!debug.contains("--arg"));
    assert!(debug.contains("require_operator_start: true"));
}

#[test]
fn session_registry_starts_explicit_armed_session_without_task_state() {
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");

    assert_eq!(snapshot.status, QueueRunnerStatus::Armed);
    assert_eq!(
        snapshot
            .session_id
            .as_ref()
            .map(QueueRunnerSessionId::as_str),
        Some("queue_runner_session_1")
    );
    assert_eq!(snapshot.active_queue_item_id, None);
    assert_eq!(snapshot.waiting_run_id, None);
}

#[test]
fn session_registry_does_not_need_queue_task_or_persistence_to_start() {
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = registry
        .start_session(
            "workspace without storage",
            "executor without db lookup",
            QueueRunnerPolicy::default(),
        )
        .expect("start session without queue task");

    assert_eq!(snapshot.status, QueueRunnerStatus::Armed);
    assert!(snapshot.is_session_only());
}

#[test]
fn session_registry_stop_transitions_and_repeated_stop_is_safe() {
    let registry = QueueRunnerSessionRegistry::default();
    registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");

    let stopped = registry.stop_session();
    let stopped_again = registry.stop_session();

    assert_eq!(stopped.status, QueueRunnerStatus::Stopped);
    assert_eq!(
        stopped.stop_reason,
        Some(QueueRunnerStopReason::OperatorStopped)
    );
    assert_eq!(stopped_again, stopped);
}

#[test]
fn session_registry_observes_completed_run_without_starting_continuation() {
    let registry = QueueRunnerSessionRegistry::default();
    registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");
    registry.waiting_for_executor("queue_1", "run_1");

    let snapshot = registry.observe_waiting_run_status("run_1", "completed", true);

    assert_eq!(snapshot.status, QueueRunnerStatus::Completed);
    assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
    assert_eq!(snapshot.active_queue_item_id.as_deref(), Some("queue_1"));
    assert_eq!(snapshot.waiting_run_id.as_deref(), Some("run_1"));
    assert_eq!(snapshot.stop_reason, None);
    assert!(!snapshot.status.is_active());
}

#[test]
fn session_registry_observes_failed_cancelled_killed_and_unknown_final_statuses() {
    for (status, expected_status, expected_reason) in [
        ("failed", Some("failed"), QueueRunnerStopReason::TaskFailed),
        (
            "timed_out",
            Some("timed_out"),
            QueueRunnerStopReason::TaskFailed,
        ),
        (
            "cancelled",
            Some("cancelled"),
            QueueRunnerStopReason::TaskCancelled,
        ),
        (
            "force_killed",
            Some("force_killed"),
            QueueRunnerStopReason::TaskKilled,
        ),
        (
            "review_needed",
            Some("review_needed"),
            QueueRunnerStopReason::ReviewNeeded,
        ),
        (
            "secret final response sk-secret",
            Some("unknown"),
            QueueRunnerStopReason::UnknownFinalStatus,
        ),
    ] {
        let registry = QueueRunnerSessionRegistry::default();
        registry
            .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
            .expect("start runner session");
        registry.waiting_for_executor("queue_1", "run_1");

        let snapshot = registry.observe_waiting_run_status("run_1", status, true);

        assert_eq!(snapshot.status, QueueRunnerStatus::Stopped);
        assert_eq!(snapshot.final_run_status.as_deref(), expected_status);
        assert_eq!(snapshot.stop_reason, Some(expected_reason));
    }
}

#[test]
fn session_registry_ignores_nonfinal_waiting_status_and_mismatched_run() {
    let registry = QueueRunnerSessionRegistry::default();
    registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");
    registry.waiting_for_executor("queue_1", "run_1");

    let running = registry.observe_waiting_run_status("run_1", "running", false);
    let mismatched = registry.observe_waiting_run_status("other_run", "completed", true);

    assert_eq!(running.status, QueueRunnerStatus::WaitingForExecutor);
    assert_eq!(running.final_run_status, None);
    assert_eq!(mismatched.status, QueueRunnerStatus::WaitingForExecutor);
    assert_eq!(mismatched.final_run_status, None);
}

#[test]
fn stop_after_completed_observation_prevents_future_continuation() {
    let registry = QueueRunnerSessionRegistry::default();
    registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");
    registry.waiting_for_executor("queue_1", "run_1");
    registry.observe_waiting_run_status("run_1", "completed", true);

    let snapshot = registry.stop_session();

    assert_eq!(snapshot.status, QueueRunnerStatus::Stopped);
    assert_eq!(
        snapshot.stop_reason,
        Some(QueueRunnerStopReason::OperatorStopped)
    );
    assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
}

#[test]
fn reconciliation_claims_successful_run_once_for_continuation() {
    let registry = QueueRunnerSessionRegistry::default();
    registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");
    registry.waiting_for_executor("queue_1", "run_1");

    let first = registry.observe_waiting_run_for_reconciliation("run_1", "completed", true);
    let second = registry.observe_waiting_run_for_reconciliation("run_1", "completed", true);

    assert!(first.should_continue_after_success);
    assert_eq!(first.snapshot.status, QueueRunnerStatus::SelectingTask);
    assert!(!second.should_continue_after_success);
    assert_eq!(second.snapshot.status, QueueRunnerStatus::SelectingTask);
}

#[test]
fn tick_loop_claim_is_session_scoped_and_not_duplicated() {
    let registry = QueueRunnerSessionRegistry::default();
    assert_eq!(registry.try_claim_tick_loop(), None);

    let started = registry
        .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
        .expect("start runner session");
    let session_id = started.session_id.expect("session id");

    assert_eq!(registry.try_claim_tick_loop(), Some(session_id.clone()));
    assert_eq!(registry.try_claim_tick_loop(), None);
    assert!(registry.tick_loop_should_continue(&session_id));

    let stopped = registry.stop_session();
    assert_eq!(stopped.status, QueueRunnerStatus::Stopped);
    assert!(!registry.tick_loop_should_continue(&session_id));

    registry.release_tick_loop(&session_id);
    assert_eq!(registry.try_claim_tick_loop(), None);
}

#[test]
fn session_registry_rejects_non_operator_or_hidden_policy() {
    let registry = QueueRunnerSessionRegistry::default();
    let hidden_policy = QueueRunnerPolicy {
        allow_hidden_execution: true,
        ..QueueRunnerPolicy::default()
    };
    let durable_policy = QueueRunnerPolicy {
        durable_resume: true,
        ..QueueRunnerPolicy::default()
    };

    assert!(registry
        .start_session("ws_1", "executor_1", hidden_policy)
        .expect_err("hidden execution rejected")
        .contains("hidden execution"));
    assert!(registry
        .start_session("ws_1", "executor_1", durable_policy)
        .expect_err("durable resume rejected")
        .contains("not implemented"));
}

#[test]
fn autorun_selection_starts_one_auto_task_for_selected_executor() {
    let decision = select_next_autorun_task(
        &[task_summary(
            "queue_1",
            "ready",
            "auto",
            "Prompt",
            Some("executor_1"),
        )],
        "executor_1",
    );

    assert_eq!(
        decision,
        QueueAutorunTaskSelection::Start {
            queue_item_id: "queue_1".to_owned()
        }
    );
}

#[test]
fn autorun_selection_blocks_missing_prompt_without_exposing_prompt_text() {
    let decision = select_next_autorun_task(
        &[task_summary(
            "queue_1",
            "ready",
            "auto",
            "",
            Some("executor_1"),
        )],
        "executor_1",
    );

    assert_eq!(
        decision,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::MissingPrompt
        }
    );
}

#[test]
fn autorun_selection_does_not_run_manual_or_after_previous_success_first() {
    let manual = select_next_autorun_task(
        &[task_summary(
            "queue_1",
            "ready",
            "manual",
            "Prompt",
            Some("executor_1"),
        )],
        "executor_1",
    );
    let after_previous_success = select_next_autorun_task(
        &[task_summary(
            "queue_2",
            "ready",
            "after_previous_success",
            "Prompt",
            Some("executor_1"),
        )],
        "executor_1",
    );

    assert_eq!(
        manual,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::ManualTaskRequiresOperator
        }
    );
    assert_eq!(
        after_previous_success,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::PreviousSuccessRequired
        }
    );
}

#[test]
fn autorun_selection_blocks_missing_or_different_executor() {
    let missing = select_next_autorun_task(
        &[task_summary("queue_1", "ready", "auto", "Prompt", None)],
        "executor_1",
    );
    let different = select_next_autorun_task(
        &[task_summary(
            "queue_2",
            "ready",
            "auto",
            "Prompt",
            Some("executor_2"),
        )],
        "executor_1",
    );

    assert_eq!(
        missing,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::MissingExecutor
        }
    );
    assert_eq!(
        different,
        QueueAutorunTaskSelection::Stop {
            reason: QueueRunnerStopReason::AssignedToDifferentExecutor
        }
    );
}

fn task_summary(
    queue_item_id: &str,
    status: &str,
    execution_policy: &str,
    prompt: &str,
    assigned_executor_widget_id: Option<&str>,
) -> AgentQueueTaskSummary {
    AgentQueueTaskSummary {
        queue_item_id: queue_item_id.to_owned(),
        workspace_id: "workspace_1".to_owned(),
        title: "Task".to_owned(),
        description: String::new(),
        prompt: prompt.to_owned(),
        status: status.to_owned(),
        priority: 0,
        execution_policy: execution_policy.to_owned(),
        execution_workspace: None,
        codex_executable: None,
        sandbox: None,
        approval_policy: None,
        assigned_executor_widget_id: assigned_executor_widget_id.map(str::to_owned),
        created_at: "2026-05-21T00:00:00.000Z".to_owned(),
        updated_at: "2026-05-21T00:00:00.000Z".to_owned(),
    }
}
