use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::SqliteStore;

#[test]
fn queue_control_commands_get_set_conflict_and_disable() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue control command test", None)
        .expect("create workspace");
    drop(service);

    let initial = get_agent_queue_control_state_blocking(
        GetAgentQueueControlStateRequest {
            workspace_id: workspace.id.clone(),
        },
        db_path.clone(),
    )
    .expect("get control")
    .expect("control");

    assert_eq!(initial.status, "disabled");
    assert_eq!(initial.version, 1);

    let enabled = set_agent_queue_control_state_blocking(
        SetAgentQueueControlStateRequest {
            workspace_id: workspace.id.clone(),
            status: "manual_enabled".to_owned(),
            actor_id: Some("workspace-agent".to_owned()),
            reason: Some("typed manual enable".to_owned()),
            expected_version: Some(initial.version),
        },
        db_path.clone(),
    )
    .expect("enable control");
    let enabled_state = enabled.control_state.expect("enabled state");

    assert_eq!(enabled.status, "succeeded");
    assert_eq!(enabled_state.status, "manual_enabled");
    assert_eq!(enabled_state.version, initial.version + 1);

    let duplicate = set_agent_queue_control_state_blocking(
        SetAgentQueueControlStateRequest {
            workspace_id: workspace.id.clone(),
            status: "manual_enabled".to_owned(),
            actor_id: Some("workspace-agent".to_owned()),
            reason: Some("same state".to_owned()),
            expected_version: Some(enabled_state.version),
        },
        db_path.clone(),
    )
    .expect("duplicate enable");
    assert_eq!(duplicate.status, "already_in_state");

    let conflict = set_agent_queue_control_state_blocking(
        SetAgentQueueControlStateRequest {
            workspace_id: workspace.id.clone(),
            status: "disabled".to_owned(),
            actor_id: Some("workspace-agent".to_owned()),
            reason: Some("disable stale".to_owned()),
            expected_version: Some(initial.version),
        },
        db_path.clone(),
    )
    .expect("version conflict");
    assert_eq!(conflict.status, "version_conflict");
    assert_eq!(
        conflict.blocker.expect("conflict blocker").actual_version,
        Some(enabled_state.version)
    );

    let disabled = set_agent_queue_control_state_blocking(
        SetAgentQueueControlStateRequest {
            workspace_id: workspace.id,
            status: "disabled".to_owned(),
            actor_id: Some("workspace-agent".to_owned()),
            reason: Some("typed manual disable".to_owned()),
            expected_version: Some(enabled_state.version),
        },
        db_path.clone(),
    )
    .expect("disable control")
    .control_state
    .expect("disabled state");
    assert_eq!(disabled.status, "disabled");
    assert_eq!(disabled.version, enabled_state.version + 1);

    remove_test_db_files(&db_path);
}

#[test]
fn queue_control_commands_return_typed_invalid_and_missing_workspace_results() {
    let db_path = unique_test_db_path();
    initialized_service(&db_path);

    let invalid = set_agent_queue_control_state_blocking(
        SetAgentQueueControlStateRequest {
            workspace_id: "workspace-control".to_owned(),
            status: "auto".to_owned(),
            actor_id: None,
            reason: None,
            expected_version: None,
        },
        db_path.clone(),
    )
    .expect("invalid status");
    assert_eq!(invalid.status, "invalid_input");
    assert_eq!(
        invalid.blocker.expect("invalid blocker").blocker_code,
        "unsupported_status"
    );

    let missing_workspace = set_agent_queue_control_state_blocking(
        SetAgentQueueControlStateRequest {
            workspace_id: "missing-workspace".to_owned(),
            status: "manual_enabled".to_owned(),
            actor_id: Some("workspace-agent".to_owned()),
            reason: None,
            expected_version: None,
        },
        db_path.clone(),
    )
    .expect("missing workspace");
    assert_eq!(missing_workspace.status, "workspace_not_found");

    remove_test_db_files(&db_path);
}

#[test]
fn queue_control_command_source_has_no_worker_scheduler_or_lifecycle_calls() {
    let source = include_str!("../agent_queue_control_commands.rs");

    for forbidden in [
        "start_assigned_agent_queue_task",
        "start_agent_queue_runner_session",
        "record_agent_queue_worker_finished",
        "create_agent_queue_task",
        "update_agent_queue_task",
        "mark_agent_queue_item_done",
        "fail_agent_queue_item",
        "run_queue_validation",
        "terminal_",
        "get_git_",
        "create_git_",
        "rollback",
        "shell",
    ] {
        assert!(
            !source.contains(forbidden),
            "control commands must not call {forbidden}"
        );
    }
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-control-command-test-{}-{nanos}.sqlite",
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
