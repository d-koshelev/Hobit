use super::agent_queue_lifecycle::{
    map_direct_work_final_status_to_queue_status, AgentQueueExecutionLifecycleStatus,
    AgentQueueTaskExecutionPolicy, AgentQueueTaskLifecycleStatus,
};

#[test]
fn queue_lifecycle_status_vocabulary_matches_current_persisted_values() {
    let statuses = [
        ("draft", AgentQueueTaskLifecycleStatus::Draft),
        ("queued", AgentQueueTaskLifecycleStatus::Queued),
        ("ready", AgentQueueTaskLifecycleStatus::Ready),
        ("running", AgentQueueTaskLifecycleStatus::Running),
        ("completed", AgentQueueTaskLifecycleStatus::Completed),
        ("failed", AgentQueueTaskLifecycleStatus::Failed),
        ("cancelled", AgentQueueTaskLifecycleStatus::Cancelled),
        ("review_needed", AgentQueueTaskLifecycleStatus::ReviewNeeded),
    ];

    for (value, status) in statuses {
        assert_eq!(
            Some(status),
            AgentQueueTaskLifecycleStatus::from_current_status(value)
        );
        assert_eq!(value, status.as_str());
    }

    assert_eq!(
        None,
        AgentQueueTaskLifecycleStatus::from_current_status("blocked")
    );
    assert_eq!(
        None,
        AgentQueueTaskLifecycleStatus::from_current_status("not_runnable")
    );
}

#[test]
fn queue_lifecycle_separates_durable_task_status_from_start_response_status() {
    assert_eq!(
        "started",
        AgentQueueExecutionLifecycleStatus::Started.as_str()
    );
    assert_eq!(
        None,
        AgentQueueTaskLifecycleStatus::from_current_status("started")
    );
}

#[test]
fn queue_lifecycle_assignment_and_start_rules_match_current_behavior() {
    for status in [
        AgentQueueTaskLifecycleStatus::Draft,
        AgentQueueTaskLifecycleStatus::Queued,
        AgentQueueTaskLifecycleStatus::Ready,
        AgentQueueTaskLifecycleStatus::ReviewNeeded,
    ] {
        assert!(status.allows_assignment());
    }

    for status in [
        AgentQueueTaskLifecycleStatus::Running,
        AgentQueueTaskLifecycleStatus::Completed,
        AgentQueueTaskLifecycleStatus::Failed,
        AgentQueueTaskLifecycleStatus::Cancelled,
    ] {
        assert!(!status.allows_assignment());
    }

    for status in [
        AgentQueueTaskLifecycleStatus::Queued,
        AgentQueueTaskLifecycleStatus::Ready,
        AgentQueueTaskLifecycleStatus::ReviewNeeded,
    ] {
        assert!(status.allows_explicit_assigned_start());
    }

    for status in [
        AgentQueueTaskLifecycleStatus::Draft,
        AgentQueueTaskLifecycleStatus::Running,
        AgentQueueTaskLifecycleStatus::Completed,
        AgentQueueTaskLifecycleStatus::Failed,
        AgentQueueTaskLifecycleStatus::Cancelled,
    ] {
        assert!(!status.allows_explicit_assigned_start());
    }
}

#[test]
fn queue_lifecycle_prompt_and_terminal_rules_match_current_behavior() {
    assert!(!AgentQueueTaskLifecycleStatus::Draft.requires_prompt());
    for status in [
        AgentQueueTaskLifecycleStatus::Queued,
        AgentQueueTaskLifecycleStatus::Ready,
        AgentQueueTaskLifecycleStatus::Running,
        AgentQueueTaskLifecycleStatus::Completed,
        AgentQueueTaskLifecycleStatus::Failed,
        AgentQueueTaskLifecycleStatus::Cancelled,
        AgentQueueTaskLifecycleStatus::ReviewNeeded,
    ] {
        assert!(status.requires_prompt());
    }

    for status in [
        AgentQueueTaskLifecycleStatus::Completed,
        AgentQueueTaskLifecycleStatus::Failed,
        AgentQueueTaskLifecycleStatus::Cancelled,
    ] {
        assert!(status.is_terminal());
    }
    assert!(!AgentQueueTaskLifecycleStatus::Running.is_terminal());
}

#[test]
fn queue_lifecycle_maps_direct_work_final_status_without_new_statuses() {
    assert_eq!(
        AgentQueueTaskLifecycleStatus::Completed,
        map_direct_work_final_status_to_queue_status("completed").expect("completed maps")
    );
    assert_eq!(
        AgentQueueTaskLifecycleStatus::Cancelled,
        map_direct_work_final_status_to_queue_status("cancelled").expect("cancelled maps")
    );
    assert_eq!(
        AgentQueueTaskLifecycleStatus::Failed,
        map_direct_work_final_status_to_queue_status("failed").expect("failed maps")
    );
    assert_eq!(
        AgentQueueTaskLifecycleStatus::Failed,
        map_direct_work_final_status_to_queue_status("timed_out").expect("timed out maps")
    );

    let error = map_direct_work_final_status_to_queue_status("running")
        .expect_err("non-final Direct Work status rejected");
    assert!(error
        .to_string()
        .contains("unsupported Direct Work final status for queue task: running"));
}

#[test]
fn queue_execution_policy_vocabulary_matches_current_values() {
    let policies = [
        ("manual", AgentQueueTaskExecutionPolicy::Manual),
        ("auto", AgentQueueTaskExecutionPolicy::Auto),
        (
            "after_previous_success",
            AgentQueueTaskExecutionPolicy::AfterPreviousSuccess,
        ),
    ];

    for (value, policy) in policies {
        assert_eq!(
            Some(policy),
            AgentQueueTaskExecutionPolicy::from_current_policy(value)
        );
        assert_eq!(value, policy.as_str());
    }

    assert_eq!(
        AgentQueueTaskExecutionPolicy::Manual,
        AgentQueueTaskExecutionPolicy::default_for_new_task()
    );
    assert_eq!(
        None,
        AgentQueueTaskExecutionPolicy::from_current_policy("when_ready")
    );
}
