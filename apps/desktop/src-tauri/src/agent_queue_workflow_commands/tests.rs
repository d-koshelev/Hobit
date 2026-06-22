use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::WorkspaceService;
use hobit_storage_sqlite::{NewAgentQueueWorkflowAction, SqliteStore};
use serde_json::json;

#[test]
fn workflow_commands_start_get_list_cancel_and_report() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);

    let start = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow");
    let run = start.workflow_run.expect("workflow run");

    assert_eq!(start.status, "succeeded");
    assert_eq!(run.workspace_id, workspace.id);
    assert_eq!(run.status, "created");
    assert!(run.request_hash.starts_with("fnv1a64:"));

    let get = get_agent_queue_workflow_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get workflow")
    .expect("workflow run");
    let list = list_agent_queue_workflows_blocking(
        ListAgentQueueWorkflowsRequest {
            workspace_id: workspace.id.clone(),
            status: Some("created".to_owned()),
            workflow_id: Some("dependency_acceptance_smoke".to_owned()),
        },
        db_path.clone(),
    )
    .expect("list workflows");

    assert_eq!(get.workflow_run_id, run.workflow_run_id);
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].workflow_run_id, run.workflow_run_id);

    let cancel = cancel_agent_queue_workflow_blocking(
        CancelAgentQueueWorkflowRequest {
            workspace_id: workspace.id.clone(),
            workflow_run_id: run.workflow_run_id.clone(),
            actor_id: Some("operator".to_owned()),
            reason: Some("operator cancelled".to_owned()),
        },
        db_path.clone(),
    )
    .expect("cancel workflow");

    assert_eq!(cancel.status, "cancelled");
    assert_eq!(
        cancel.workflow_run.expect("cancelled run").status,
        "cancelled"
    );

    let report = get_agent_queue_workflow_report_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace.id,
            workflow_run_id: run.workflow_run_id,
        },
        db_path.clone(),
    )
    .expect("get report")
    .expect("report");

    assert!(!report.resume_available);
    assert_eq!(report.resume_status, "not_implemented");
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_start_command_is_idempotent_and_conflicts_on_different_hash() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);

    let first = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");
    let duplicate = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start duplicate");
    let mut changed = start_request(&workspace.id, "request-1");
    changed.inputs_snapshot = Some(json!({"taskIdsBySlot": {"upstream": "changed"}}));
    let conflict = start_agent_queue_workflow_blocking(changed, db_path.clone())
        .expect("start conflicting workflow");

    assert_eq!(duplicate.status, "already_exists");
    assert_eq!(
        duplicate
            .workflow_run
            .expect("existing workflow")
            .workflow_run_id,
        first.workflow_run_id
    );
    assert_eq!(conflict.status, "conflict");
    assert_eq!(
        conflict.conflict.expect("conflict").conflict_code,
        "request_id_hash_conflict"
    );
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_commands_enforce_workspace_isolation() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace_one = service
        .create_empty_workspace("Workspace one", None)
        .expect("create workspace one");
    let workspace_two = service
        .create_empty_workspace("Workspace two", None)
        .expect("create workspace two");
    drop(service);

    let run = start_agent_queue_workflow_blocking(
        start_request(&workspace_one.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");

    let cross_workspace_get = get_agent_queue_workflow_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace_two.id,
            workflow_run_id: run.workflow_run_id,
        },
        db_path.clone(),
    )
    .expect("cross workspace get");

    assert!(cross_workspace_get.is_none());
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_report_command_serializes_action_ledger_without_resume_execution() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow command test", None)
        .expect("create workspace");
    drop(service);
    let run = start_agent_queue_workflow_blocking(
        start_request(&workspace.id, "request-1"),
        db_path.clone(),
    )
    .expect("start workflow")
    .workflow_run
    .expect("workflow run");
    let store = SqliteStore::open(&db_path).expect("open store");
    store
        .insert_agent_queue_workflow_action(NewAgentQueueWorkflowAction {
            action_id: "action-1",
            workflow_run_id: &run.workflow_run_id,
            workspace_id: &workspace.id,
            step_id: "read.aggregate",
            action_type: "queue.lifecycle.get",
            idempotency_key: "workflow-run-1:read:task-1",
            status: "completed",
            target_refs_json: Some(r#"{"taskId":"task-1"}"#),
            result_refs_json: Some(r#"{"snapshot":"bounded"}"#),
            blocker_code: None,
            blocker_message: None,
            attempt_count: 1,
            started_at: Some("1"),
            completed_at: Some("1"),
            created_at: Some("1"),
            updated_at: Some("1"),
        })
        .expect("insert action");

    let report = get_agent_queue_workflow_report_blocking(
        GetAgentQueueWorkflowRequest {
            workspace_id: workspace.id,
            workflow_run_id: run.workflow_run_id,
        },
        db_path.clone(),
    )
    .expect("get report")
    .expect("report");

    assert_eq!(report.actions.len(), 1);
    assert_eq!(report.actions[0].action_type, "queue.lifecycle.get");
    assert!(!report.resume_available);
    assert_eq!(report.resume_status, "not_implemented");
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_command_source_has_no_execution_or_queue_lifecycle_calls() {
    let source = include_str!("../agent_queue_workflow_commands.rs");

    for forbidden in [
        "start_assigned_agent_queue_task",
        "record_agent_queue_worker_finished",
        "create_agent_queue_review_message",
        "ack_agent_queue_review_message",
        "mark_agent_queue_item_done",
        "fail_agent_queue_item",
        "run_queue_validation",
        "validation_runner",
        "get_git_",
        "create_git_",
        "terminal_",
        "rollback",
        "shell",
        "run_codex",
    ] {
        assert!(
            !source.contains(forbidden),
            "workflow commands must not call {forbidden}"
        );
    }
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn start_request(workspace_id: &str, request_id: &str) -> StartAgentQueueWorkflowRequest {
    StartAgentQueueWorkflowRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_id: "dependency_acceptance_smoke".to_owned(),
        request_id: request_id.to_owned(),
        phase: None,
        current_step: None,
        actor_id: Some("workspace-agent".to_owned()),
        inputs_snapshot: Some(json!({
            "taskIdsBySlot": {
                "upstream": "task-upstream",
                "downstream": "task-downstream"
            }
        })),
        grant_summary: Some(json!({
            "actorId": "workspace-agent",
            "mode": "queue_acceptance_smoke",
            "allowedRiskClasses": ["read", "review"],
            "constraints": {
                "noGit": true,
                "noValidationExecution": true,
                "noRollback": true,
                "noTerminal": true,
                "noDelete": true,
                "noDownstreamAutoStart": true
            },
            "scope": {
                "taskIds": ["task-upstream", "task-downstream"]
            },
            "issuedAt": "1",
            "expiresAt": "2",
            "restartPolicy": "regrant_mutations",
            "maxActions": 16,
            "consumedActionCount": 0
        })),
        variables: Some(json!({"workflowId": "dependency_acceptance_smoke"})),
        slot_bindings: Some(json!({"upstream": {"taskId": "task-upstream"}})),
        mutation_refs: Some(json!({})),
        idempotency_keys: Some(json!({})),
        action_log_summary: Some(json!([])),
    }
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-workflow-command-test-{}-{nanos}.sqlite",
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
