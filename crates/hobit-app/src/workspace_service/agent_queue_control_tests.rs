use super::*;

use hobit_storage_sqlite::SqliteStore;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn agent_queue_control_state_defaults_to_disabled_for_new_workspace() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue control", None)
        .expect("create workspace");

    let control = service
        .get_agent_queue_control_state(&workspace.id)
        .expect("get control state")
        .expect("control state");

    assert_eq!(control.workspace_id, workspace.id);
    assert_eq!(control.status, AGENT_QUEUE_CONTROL_STATUS_DISABLED);
    assert_eq!(control.version, 1);
}

#[test]
fn agent_queue_control_state_enable_disable_and_expected_version() {
    let service = initialized_service();
    let workspace = service
        .create_empty_workspace("Queue control", None)
        .expect("create workspace");

    let initial = service
        .get_agent_queue_control_state(&workspace.id)
        .expect("get initial control")
        .expect("initial control");

    let enabled = service
        .enable_agent_queue_manual_control(
            workspace.id.clone(),
            Some("workspace-agent".to_owned()),
            Some("manual typed enable".to_owned()),
            Some(initial.version),
        )
        .expect("enable queue control");
    let enabled_state = enabled.control_state.expect("enabled state");

    assert_eq!(enabled.status, AgentQueueControlCommandStatus::Succeeded);
    assert_eq!(
        enabled_state.status,
        AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED
    );
    assert_eq!(enabled_state.version, initial.version + 1);
    assert_eq!(
        enabled_state.updated_by_actor_id.as_deref(),
        Some("workspace-agent")
    );
    assert_eq!(enabled_state.reason.as_deref(), Some("manual typed enable"));

    let duplicate = service
        .enable_agent_queue_manual_control(
            workspace.id.clone(),
            Some("workspace-agent".to_owned()),
            Some("ignored duplicate reason".to_owned()),
            Some(enabled_state.version),
        )
        .expect("duplicate enable");
    assert_eq!(
        duplicate.status,
        AgentQueueControlCommandStatus::AlreadyInState
    );
    assert_eq!(
        duplicate.control_state.expect("duplicate state").version,
        enabled_state.version
    );

    let conflict = service
        .disable_agent_queue_control(
            workspace.id.clone(),
            Some("workspace-agent".to_owned()),
            Some("disable".to_owned()),
            Some(initial.version),
        )
        .expect("version conflict");
    assert_eq!(
        conflict.status,
        AgentQueueControlCommandStatus::VersionConflict
    );
    assert_eq!(
        conflict.blocker.expect("conflict blocker").actual_version,
        Some(enabled_state.version)
    );

    let disabled = service
        .disable_agent_queue_control(
            workspace.id,
            Some("workspace-agent".to_owned()),
            Some("typed disable".to_owned()),
            Some(enabled_state.version),
        )
        .expect("disable queue control")
        .control_state
        .expect("disabled state");
    assert_eq!(disabled.status, AGENT_QUEUE_CONTROL_STATUS_DISABLED);
    assert_eq!(disabled.version, enabled_state.version + 1);
}

#[test]
fn agent_queue_control_state_reports_invalid_input_and_missing_workspace() {
    let service = initialized_service();

    let invalid = service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: "workspace-control".to_owned(),
            status: "automatic".to_owned(),
            actor_id: None,
            reason: None,
            expected_version: None,
        })
        .expect("invalid status result");
    assert_eq!(invalid.status, AgentQueueControlCommandStatus::InvalidInput);
    assert_eq!(
        invalid
            .blocker
            .expect("invalid status blocker")
            .blocker_code,
        "unsupported_status"
    );

    let too_long_reason = service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: "workspace-control".to_owned(),
            status: AGENT_QUEUE_CONTROL_STATUS_DISABLED.to_owned(),
            actor_id: None,
            reason: Some("x".repeat(513)),
            expected_version: None,
        })
        .expect("too long reason");
    assert_eq!(
        too_long_reason.status,
        AgentQueueControlCommandStatus::InvalidInput
    );
    assert_eq!(
        too_long_reason
            .blocker
            .expect("reason blocker")
            .blocker_code,
        "input_too_large"
    );

    let missing_workspace = service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: "missing-workspace".to_owned(),
            status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned(),
            actor_id: Some("workspace-agent".to_owned()),
            reason: None,
            expected_version: None,
        })
        .expect("missing workspace");
    assert_eq!(
        missing_workspace.status,
        AgentQueueControlCommandStatus::WorkspaceNotFound
    );
}

#[test]
fn agent_queue_control_state_is_workspace_isolated_and_has_no_queue_side_effects() {
    let service = initialized_service();
    let workspace_a = service
        .create_empty_workspace("Queue control A", None)
        .expect("create workspace A");
    let workspace_b = service
        .create_empty_workspace("Queue control B", None)
        .expect("create workspace B");

    service
        .enable_agent_queue_manual_control(
            workspace_a.id.clone(),
            Some("workspace-agent".to_owned()),
            Some("manual typed enable".to_owned()),
            None,
        )
        .expect("enable workspace A");

    let control_a = service
        .get_agent_queue_control_state(&workspace_a.id)
        .expect("get workspace A control")
        .expect("workspace A control");
    let control_b = service
        .get_agent_queue_control_state(&workspace_b.id)
        .expect("get workspace B control")
        .expect("workspace B control");

    assert_eq!(control_a.status, AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED);
    assert_eq!(control_b.status, AGENT_QUEUE_CONTROL_STATUS_DISABLED);
    assert!(service
        .list_agent_queue_tasks(&workspace_a.id)
        .expect("list workspace A tasks")
        .is_empty());
    assert!(service
        .list_queue_workflow_runs(QueueWorkflowListRequest {
            workspace_id: workspace_a.id,
            status: None,
            workflow_id: None,
        })
        .expect("list workflow runs")
        .is_empty());
}
