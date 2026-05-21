use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{AssignAgentQueueTaskToExecutorInput, CreateAgentQueueTaskInput, WorkspaceService};
use hobit_storage_sqlite::{SqliteStore, WidgetRunFinishUpdate};

#[test]
fn default_runner_snapshot_is_idle_without_active_session() {
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = get_agent_queue_runner_snapshot_from_registry(registry);

    assert_eq!(snapshot.session_id, None);
    assert_eq!(snapshot.status, "idle");
    assert!(!snapshot.is_active);
    assert!(snapshot.is_session_only);
    assert_eq!(snapshot.active_queue_item_id, None);
    assert_eq!(snapshot.waiting_run_id, None);
}

#[test]
fn start_runner_session_creates_explicit_armed_session() {
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot =
        start_agent_queue_runner_session_in_registry(start_request("ws_1", "executor_1"), registry)
            .expect("start runner session");

    assert_eq!(
        snapshot.session_id.as_deref(),
        Some("queue_runner_session_1")
    );
    assert_eq!(snapshot.status, "armed");
    assert!(snapshot.is_active);
    assert!(snapshot.policy.require_operator_start);
    assert!(snapshot.policy.one_task_at_a_time);
    assert!(!snapshot.policy.allow_hidden_execution);
    assert!(!snapshot.policy.durable_resume);
}

#[test]
fn start_runner_session_does_not_need_task_creation_or_runtime_inputs() {
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = start_agent_queue_runner_session_in_registry(
        StartAgentQueueRunnerSessionRequest {
            workspace_id: "workspace-only".to_owned(),
            executor_widget_instance_id: "executor-only".to_owned(),
            codex_executable: "codex".to_owned(),
            repo_root: std::env::current_dir()
                .expect("current dir")
                .display()
                .to_string(),
            sandbox: "workspace_write".to_owned(),
            approval_policy: "never".to_owned(),
            timeout_ms: Some(10),
            stdout_cap_bytes: Some(11),
            stderr_cap_bytes: Some(12),
            policy: None,
        },
        registry,
    )
    .expect("start runner session");

    assert_eq!(snapshot.status, "armed");
    assert_eq!(snapshot.active_queue_item_id, None);
    assert_eq!(snapshot.waiting_run_id, None);
}

#[test]
fn stop_runner_session_transitions_safely_and_repeated_stop_is_noop() {
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_in_registry(
        start_request("ws_1", "executor_1"),
        registry.clone(),
    )
    .expect("start runner session");

    let stopped = stop_agent_queue_runner_session_in_registry(registry.clone());
    let stopped_again = stop_agent_queue_runner_session_in_registry(registry);

    assert_eq!(stopped.session_id, started.session_id);
    assert_eq!(stopped.status, "stopped");
    assert!(!stopped.is_active);
    assert_eq!(stopped.stop_reason.as_deref(), Some("operator_stopped"));
    assert_eq!(stopped_again, stopped);
}

#[test]
fn stop_without_active_session_returns_idle_snapshot() {
    let registry = QueueRunnerSessionRegistry::default();

    let stopped = stop_agent_queue_runner_session_in_registry(registry);

    assert_eq!(stopped.session_id, None);
    assert_eq!(stopped.status, "idle");
    assert_eq!(stopped.stop_reason, None);
}

#[test]
fn snapshot_response_does_not_echo_sensitive_request_text() {
    let registry = QueueRunnerSessionRegistry::default();
    let snapshot = start_agent_queue_runner_session_in_registry(
        start_request("C:\\Users\\person\\secret", "executor --danger sk-secret"),
        registry,
    )
    .expect("start runner session");
    let debug = format!("{snapshot:?}");

    assert!(!debug.contains("C:\\Users"));
    assert!(!debug.contains("--danger"));
    assert!(!debug.contains("sk-secret"));
    assert_eq!(snapshot.status, "armed");
}

#[test]
fn custom_policy_keeps_hidden_execution_and_durable_resume_disabled() {
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = start_agent_queue_runner_session_in_registry(
        StartAgentQueueRunnerSessionRequest {
            workspace_id: "ws_1".to_owned(),
            executor_widget_instance_id: "executor_1".to_owned(),
            codex_executable: "codex".to_owned(),
            repo_root: std::env::current_dir()
                .expect("current dir")
                .display()
                .to_string(),
            sandbox: "workspace_write".to_owned(),
            approval_policy: "never".to_owned(),
            timeout_ms: Some(10),
            stdout_cap_bytes: Some(11),
            stderr_cap_bytes: Some(12),
            policy: Some(StartAgentQueueRunnerPolicyRequest {
                stop_on_failure: Some(false),
                stop_on_review_needed: Some(true),
                stop_on_cancel: Some(true),
            }),
        },
        registry,
    )
    .expect("start runner session");

    assert!(!snapshot.policy.stop_on_failure);
    assert!(snapshot.policy.stop_on_review_needed);
    assert!(snapshot.policy.stop_on_cancel);
    assert!(snapshot.policy.require_operator_start);
    assert!(snapshot.policy.one_task_at_a_time);
    assert!(!snapshot.policy.allow_hidden_execution);
    assert!(!snapshot.policy.durable_resume);
}

#[test]
fn start_rejects_empty_workspace_or_executor_without_task_or_direct_work_calls() {
    let registry = QueueRunnerSessionRegistry::default();

    let workspace_error = start_agent_queue_runner_session_in_registry(
        start_request("", "executor_1"),
        registry.clone(),
    )
    .expect_err("empty workspace rejected");
    let executor_error =
        start_agent_queue_runner_session_in_registry(start_request("ws_1", ""), registry.clone())
            .expect_err("empty executor rejected");
    let snapshot = get_agent_queue_runner_snapshot_from_registry(registry);

    assert!(workspace_error.contains("workspace id"));
    assert!(executor_error.contains("executor widget instance id"));
    assert_eq!(snapshot.status, "idle");
}

#[test]
fn start_autorun_with_no_eligible_task_submits_nothing_and_reports_stop_reason() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry,
    )
    .expect("start autorun");

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.stop_reason.as_deref(), Some("no_runnable_tasks"));
    assert_eq!(snapshot.active_queue_item_id, None);
    assert_eq!(snapshot.waiting_run_id, None);
    assert!(list_widget_runs(&db_path, &executor_widget_id).is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn start_autorun_with_missing_runtime_config_submits_nothing() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let mut request = start_request(&workspace_id, &executor_widget_id);
    request.repo_root = String::new();

    let snapshot = start_agent_queue_runner_session_once_without_background(
        request,
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        QueueRunnerSessionRegistry::default(),
    )
    .expect("start autorun");

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.stop_reason.as_deref(), Some("invalid_config"));
    assert!(list_widget_runs(&db_path, &executor_widget_id).is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn start_autorun_with_missing_task_executor_submits_nothing() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(&db_path, &workspace_id, None, "ready", "auto", "Prompt", 1);

    let snapshot = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        QueueRunnerSessionRegistry::default(),
    )
    .expect("start autorun");

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.stop_reason.as_deref(), Some("missing_executor"));
    assert!(list_widget_runs(&db_path, &executor_widget_id).is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn start_autorun_with_eligible_task_uses_existing_start_path_once() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let queue_item_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );

    let snapshot = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        QueueRunnerSessionRegistry::default(),
    )
    .expect("start autorun");
    let runs = list_widget_runs(&db_path, &executor_widget_id);
    let task = get_task(&db_path, &workspace_id, &queue_item_id);

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(queue_item_id.as_str())
    );
    assert_eq!(
        snapshot.waiting_run_id.as_deref(),
        Some(runs[0].id.as_str())
    );
    assert_eq!(runs.len(), 1);
    assert_eq!(task.status, "running");
    remove_test_db_files(&db_path);
}

#[test]
fn tick_does_nothing_when_idle() {
    let db_path = unique_test_db_path();
    let (_workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = run_agent_queue_runner_tick_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "idle");
    assert!(list_widget_runs(&db_path, &executor_widget_id).is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn tick_observes_missing_active_run_and_stops_conservatively() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let registry = QueueRunnerSessionRegistry::default();
    registry
        .start_session_with_runtime_config(
            workspace_id,
            executor_widget_id,
            QueueRunnerPolicy::default(),
            runtime_config_from_request(&start_request("workspace", "executor")),
        )
        .expect("start runner session");
    registry.waiting_for_executor("queue_1", "missing_run");

    let snapshot = run_agent_queue_runner_tick_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(
        snapshot.stop_reason.as_deref(),
        Some("unknown_final_status")
    );
    assert_eq!(snapshot.final_run_status.as_deref(), Some("unknown"));
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_continues_after_completed_autorun_run_to_one_next_task() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let first_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );
    let runs = list_widget_runs(&db_path, &executor_widget_id);

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert!(snapshot.is_active);
    assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
    assert_eq!(snapshot.stop_reason, None);
    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(second_id.as_str())
    );
    assert_eq!(runs.len(), 2);
    assert_eq!(
        get_task(&db_path, &workspace_id, &first_id).status,
        "running"
    );
    assert_eq!(
        get_task(&db_path, &workspace_id, &second_id).status,
        "running"
    );
    remove_test_db_files(&db_path);
}

#[test]
fn tick_observes_completed_run_and_starts_one_next_task() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = run_agent_queue_runner_tick_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert!(snapshot
        .last_reconciled_at
        .as_deref()
        .unwrap_or_default()
        .starts_with("unix_ms:"));
    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(second_id.as_str())
    );
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 2);
    remove_test_db_files(&db_path);
}

#[test]
fn tick_keeps_long_running_executor_task_waiting() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");

    let snapshot = run_agent_queue_runner_tick_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert_eq!(snapshot.active_queue_item_id, started.active_queue_item_id);
    assert_eq!(snapshot.waiting_run_id, started.waiting_run_id);
    assert!(snapshot.last_reconciled_at.is_some());
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn tick_does_not_start_more_than_one_task_per_reconciliation() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        3,
    );
    let third_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Third",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = run_agent_queue_runner_tick_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(second_id.as_str())
    );
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 2);
    assert_eq!(get_task(&db_path, &workspace_id, &third_id).status, "ready");
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_completed_autorun_run_with_no_next_task_completes_safely() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "completed");
    assert!(!snapshot.is_active);
    assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
    assert_eq!(snapshot.stop_reason.as_deref(), Some("no_runnable_tasks"));
    assert_eq!(snapshot.active_queue_item_id, None);
    assert_eq!(snapshot.waiting_run_id, None);
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn tick_after_stop_does_not_continue() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");
    stop_agent_queue_runner_session_in_registry(registry.clone());

    let snapshot = run_agent_queue_runner_tick_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.stop_reason.as_deref(), Some("operator_stopped"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_observes_failed_autorun_run_and_stops_without_continuation() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "failed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.final_run_status.as_deref(), Some("failed"));
    assert_eq!(snapshot.stop_reason.as_deref(), Some("task_failed"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_observes_cancelled_and_killed_autorun_runs_without_continuation() {
    for (final_status, stop_reason) in [
        ("cancelled", "task_cancelled"),
        ("force_killed", "task_killed"),
    ] {
        let db_path = unique_test_db_path();
        let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
        create_task(
            &db_path,
            &workspace_id,
            Some(&executor_widget_id),
            "ready",
            "auto",
            "Prompt",
            1,
        );
        let registry = QueueRunnerSessionRegistry::default();
        let started = start_agent_queue_runner_session_once_without_background(
            start_request(&workspace_id, &executor_widget_id),
            db_path.clone(),
            DirectWorkActiveRunRegistry::default(),
            registry.clone(),
        )
        .expect("start autorun");
        let run_id = started.waiting_run_id.clone().expect("waiting run id");
        finish_widget_run_status(&db_path, &run_id, final_status);

        let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
            registry,
            &db_path,
            DirectWorkActiveRunRegistry::default(),
        );

        assert_eq!(snapshot.status, "stopped");
        assert_eq!(snapshot.final_run_status.as_deref(), Some(final_status));
        assert_eq!(snapshot.stop_reason.as_deref(), Some(stop_reason));
        assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
        remove_test_db_files(&db_path);
    }
}

#[test]
fn refresh_observes_review_needed_without_continuation() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "review_needed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.final_run_status.as_deref(), Some("review_needed"));
    assert_eq!(snapshot.stop_reason.as_deref(), Some("review_needed"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_observes_unknown_final_status_without_exposing_secret_like_status_or_continuing() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "final response token=secret");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );
    let debug = format!("{snapshot:?}");

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.final_run_status.as_deref(), Some("unknown"));
    assert_eq!(
        snapshot.stop_reason.as_deref(),
        Some("unknown_final_status")
    );
    assert!(!debug.contains("token=secret"));
    assert!(!debug.contains("final response"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_continues_after_success_to_after_previous_success_task() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "after_previous_success",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(second_id.as_str())
    );
    assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 2);
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_does_not_continue_to_manual_policy_task() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "manual",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "stopped");
    assert_eq!(
        snapshot.stop_reason.as_deref(),
        Some("manual_task_requires_operator")
    );
    assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn refresh_continuation_starts_at_most_one_next_task_per_call() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        3,
    );
    let third_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Third",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(snapshot.status, "waiting_for_executor");
    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(second_id.as_str())
    );
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 2);
    assert_eq!(get_task(&db_path, &workspace_id, &third_id).status, "ready");
    remove_test_db_files(&db_path);
}

#[test]
fn stop_autorun_prevents_successful_continuation() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");
    let run_id = started.waiting_run_id.clone().expect("waiting run id");
    finish_widget_run_status(&db_path, &run_id, "completed");
    let stopped = stop_agent_queue_runner_session_in_registry(registry.clone());

    let snapshot = reconcile_agent_queue_runner_snapshot_from_registry_without_background(
        registry,
        &db_path,
        DirectWorkActiveRunRegistry::default(),
    );

    assert_eq!(stopped.status, "stopped");
    assert_eq!(snapshot.status, "stopped");
    assert_eq!(snapshot.stop_reason.as_deref(), Some("operator_stopped"));
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn start_autorun_does_not_start_more_than_one_task() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    let first_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "First",
        5,
    );
    let second_id = create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Second",
        1,
    );

    let snapshot = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        QueueRunnerSessionRegistry::default(),
    )
    .expect("start autorun");
    let runs = list_widget_runs(&db_path, &executor_widget_id);

    assert_eq!(
        snapshot.active_queue_item_id.as_deref(),
        Some(first_id.as_str())
    );
    assert_eq!(runs.len(), 1);
    assert_eq!(
        get_task(&db_path, &workspace_id, &first_id).status,
        "running"
    );
    assert_eq!(
        get_task(&db_path, &workspace_id, &second_id).status,
        "ready"
    );
    remove_test_db_files(&db_path);
}

#[test]
fn task_creation_alone_does_not_start_autorun() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();

    let snapshot = get_agent_queue_runner_snapshot_from_registry(registry);

    assert_eq!(snapshot.status, "idle");
    assert!(list_widget_runs(&db_path, &executor_widget_id).is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn stop_autorun_preserves_running_task_metadata_without_killing_executor() {
    let db_path = unique_test_db_path();
    let (workspace_id, executor_widget_id) = create_workspace_with_executor(&db_path);
    create_task(
        &db_path,
        &workspace_id,
        Some(&executor_widget_id),
        "ready",
        "auto",
        "Prompt",
        1,
    );
    let registry = QueueRunnerSessionRegistry::default();
    let started = start_agent_queue_runner_session_once_without_background(
        start_request(&workspace_id, &executor_widget_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        registry.clone(),
    )
    .expect("start autorun");

    let stopped = stop_agent_queue_runner_session_in_registry(registry);

    assert_eq!(stopped.status, "stopped");
    assert_eq!(stopped.stop_reason.as_deref(), Some("operator_stopped"));
    assert_eq!(stopped.active_queue_item_id, started.active_queue_item_id);
    assert_eq!(stopped.waiting_run_id, started.waiting_run_id);
    assert_eq!(list_widget_runs(&db_path, &executor_widget_id).len(), 1);
    remove_test_db_files(&db_path);
}

fn start_request(
    workspace_id: &str,
    executor_widget_instance_id: &str,
) -> StartAgentQueueRunnerSessionRequest {
    StartAgentQueueRunnerSessionRequest {
        workspace_id: workspace_id.to_owned(),
        executor_widget_instance_id: executor_widget_instance_id.to_owned(),
        codex_executable: "codex".to_owned(),
        repo_root: std::env::current_dir()
            .expect("current dir")
            .display()
            .to_string(),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(10),
        stdout_cap_bytes: Some(11),
        stderr_cap_bytes: Some(12),
        policy: None,
    }
}

fn create_workspace_with_executor(db_path: &Path) -> (String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Queue Autorun command test", None)
        .expect("create workspace");
    let workbench_id = workspace.workbench_id.as_deref().expect("workbench id");
    let executor_widget_id = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workbench_id,
            "agent-run",
            "Agent Executor",
            "agent",
        )
        .expect("add executor")
        .expect("state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == "Agent Executor")
        .expect("executor widget")
        .id;

    (workspace.id, executor_widget_id)
}

fn create_task(
    db_path: &Path,
    workspace_id: &str,
    executor_widget_id: Option<&str>,
    status: &str,
    execution_policy: &str,
    prompt: &str,
    priority: i64,
) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let task = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: format!("Task {priority}"),
            description: String::new(),
            prompt: prompt.to_owned(),
            status: status.to_owned(),
            priority,
            execution_policy: Some(execution_policy.to_owned()),
        })
        .expect("create queue task");

    if let Some(executor_widget_id) = executor_widget_id {
        service
            .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
                workspace_id: workspace_id.to_owned(),
                queue_item_id: task.queue_item_id.clone(),
                executor_widget_instance_id: executor_widget_id.to_owned(),
            })
            .expect("assign queue task");
    }

    task.queue_item_id
}

fn get_task(
    db_path: &Path,
    workspace_id: &str,
    queue_item_id: &str,
) -> hobit_app::AgentQueueTaskSummary {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
        .get_agent_queue_task(workspace_id, queue_item_id)
        .expect("get task")
        .expect("task")
}

fn list_widget_runs(
    db_path: &Path,
    executor_widget_id: &str,
) -> Vec<hobit_storage_sqlite::WidgetRunRow> {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    store
        .list_widget_runs_for_widget(executor_widget_id)
        .expect("list widget runs")
}

fn finish_widget_run_status(db_path: &Path, run_id: &str, status: &str) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    store
        .finish_widget_run(
            run_id,
            WidgetRunFinishUpdate {
                status,
                finished_at: None,
                summary: Some("final status observed"),
            },
        )
        .expect("finish widget run");
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-agent-queue-autorun-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
