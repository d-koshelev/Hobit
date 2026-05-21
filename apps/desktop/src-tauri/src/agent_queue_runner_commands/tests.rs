use super::*;

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

fn start_request(
    workspace_id: &str,
    executor_widget_instance_id: &str,
) -> StartAgentQueueRunnerSessionRequest {
    StartAgentQueueRunnerSessionRequest {
        workspace_id: workspace_id.to_owned(),
        executor_widget_instance_id: executor_widget_instance_id.to_owned(),
        policy: None,
    }
}
