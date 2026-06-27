use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    SetAgentQueueControlStateInput, WorkspaceService, AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED,
    QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
};
use hobit_storage_sqlite::SqliteStore;
use serde_json::{json, Value};

use crate::agent_queue_direct_work_launcher::{
    finish_queue_direct_work_launch_for_test, QueueDirectWorkLaunch, QueueDirectWorkLaunchStatus,
};
use crate::agent_queue_workflow_start_step_dto::ExecuteAgentQueueWorkflowCreateSetupStartStepRequest;
use crate::app_state::{DirectWorkActiveRun, DirectWorkActiveRunRegistry};

#[test]
fn workflow_create_setup_start_bridge_finishes_queue_local_run_without_widget_run() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_with_queue_control(&db_path);
    let mut launches = Vec::new();

    let result = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(&workspace_id, "request-1"),
        db_path.clone(),
        |intent, launch_db_path| {
            launches.push(intent.clone());
            let status = finish_queue_direct_work_launch_for_test(
                QueueDirectWorkLaunch {
                    workspace_id: intent.workspace_id,
                    queue_item_id: intent.queue_task_id,
                    run_id: intent.run_id,
                    direct_work_input: intent.direct_work_input,
                },
                launch_db_path,
                DirectWorkActiveRunRegistry::default(),
                "completed",
            )?;
            assert_eq!(status, QueueDirectWorkLaunchStatus::Spawned);
            Ok(())
        },
    )
    .expect("execute start step with bridge");

    assert_eq!(result.status, "executed");
    assert_eq!(launches.len(), 1);
    assert_eq!(launches[0].executor_target_kind, "queue_local");
    assert_eq!(launches[0].provider_id, "codex");
    assert_eq!(
        launches[0].direct_work_input.widget_instance_id.as_str(),
        QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    );

    let upstream_id = result.task_ids_by_slot["upstream"].clone();
    let run_id = result.run_ids_by_slot["upstream"].clone();
    let service = initialized_service(&db_path);
    let link = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &upstream_id)
        .expect("latest run link")
        .expect("run link");
    assert_eq!(link.direct_work_run_id, run_id);
    assert_eq!(link.status.as_str(), "completed");
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    assert!(store
        .get_widget_run(&run_id)
        .expect("widget run read")
        .is_none());
    assert!(store
        .get_latest_agent_queue_worker_evidence_bundle(&workspace_id, &upstream_id)
        .expect("evidence read")
        .is_none());

    let dto_json = serde_json::to_value(&result).expect("serialize result dto");
    for forbidden in [
        "direct_work_input",
        "directWorkInput",
        "operator_prompt",
        "operatorPrompt",
        "stdout",
        "stderr",
    ] {
        assert!(
            !json_object_contains_key(&dto_json, forbidden),
            "workflow step DTO must not expose {forbidden}"
        );
    }

    remove_test_db_files(&db_path);
}

#[test]
fn workflow_create_setup_start_repeated_request_does_not_launch_twice() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_with_queue_control(&db_path);
    let mut launch_count = 0usize;

    let first = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(&workspace_id, "request-repeat"),
        db_path.clone(),
        |_intent, _launch_db_path| {
            launch_count += 1;
            Ok(())
        },
    )
    .expect("first execute");
    let duplicate = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(&workspace_id, "request-repeat"),
        db_path.clone(),
        |_intent, _launch_db_path| {
            launch_count += 1;
            Ok(())
        },
    )
    .expect("duplicate execute");

    assert_eq!(first.status, "executed");
    assert_eq!(duplicate.status, "already_applied");
    assert_eq!(launch_count, 1);
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_launch_helper_duplicate_active_registry_does_not_finish_running_link() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_with_queue_control(&db_path);
    let active_runs = DirectWorkActiveRunRegistry::default();
    let mut launch_status = None;

    let result = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(&workspace_id, "request-active-registry"),
        db_path.clone(),
        |intent, launch_db_path| {
            active_runs.register(DirectWorkActiveRun::new(
                intent.run_id.clone(),
                intent.direct_work_input.workspace_id.clone(),
                intent.direct_work_input.workbench_id.clone(),
                intent.direct_work_input.widget_instance_id.clone(),
                hobit_app::CodexDirectStreamCancellationToken::new(),
            ));
            let status = finish_queue_direct_work_launch_for_test(
                QueueDirectWorkLaunch {
                    workspace_id: intent.workspace_id,
                    queue_item_id: intent.queue_task_id,
                    run_id: intent.run_id,
                    direct_work_input: intent.direct_work_input,
                },
                launch_db_path,
                active_runs.clone(),
                "completed",
            )?;
            launch_status = Some(status);
            Ok(())
        },
    )
    .expect("execute start step with active registry");

    assert_eq!(result.status, "executed");
    assert_eq!(
        launch_status,
        Some(QueueDirectWorkLaunchStatus::AlreadyActive)
    );
    let upstream_id = result.task_ids_by_slot["upstream"].clone();
    let service = initialized_service(&db_path);
    let link = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &upstream_id)
        .expect("latest run link")
        .expect("run link");
    assert_eq!(link.status.as_str(), "running");
    assert!(active_runs.has_active_run(&link.direct_work_run_id));
    remove_test_db_files(&db_path);
}

#[test]
fn workflow_launch_failure_bridge_moves_queue_local_run_link_to_failed() {
    let db_path = unique_test_db_path();
    let workspace_id = create_workspace_with_queue_control(&db_path);

    let result = execute_agent_queue_workflow_create_setup_start_step_with_test_launcher(
        create_setup_start_request(&workspace_id, "request-failed-launch"),
        db_path.clone(),
        |intent, launch_db_path| {
            finish_queue_direct_work_launch_for_test(
                QueueDirectWorkLaunch {
                    workspace_id: intent.workspace_id,
                    queue_item_id: intent.queue_task_id,
                    run_id: intent.run_id,
                    direct_work_input: intent.direct_work_input,
                },
                launch_db_path,
                DirectWorkActiveRunRegistry::default(),
                "failed",
            )?;
            Ok(())
        },
    )
    .expect("execute start step with failed launch");

    let upstream_id = result.task_ids_by_slot["upstream"].clone();
    let service = initialized_service(&db_path);
    let link = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &upstream_id)
        .expect("latest run link")
        .expect("run link");
    assert_eq!(link.status.as_str(), "failed");
    remove_test_db_files(&db_path);
}

fn create_workspace_with_queue_control(db_path: &Path) -> String {
    let service = initialized_service(db_path);
    let workspace = service
        .create_empty_workspace("Queue workflow launch bridge test", None)
        .expect("create workspace");
    service
        .set_agent_queue_control_state(SetAgentQueueControlStateInput {
            workspace_id: workspace.id.clone(),
            status: AGENT_QUEUE_CONTROL_STATUS_MANUAL_ENABLED.to_owned(),
            actor_id: Some("test".to_owned()),
            reason: Some("enable launch bridge test".to_owned()),
            expected_version: None,
        })
        .expect("enable queue control");
    workspace.id
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_setup_start_request(
    workspace_id: &str,
    request_id: &str,
) -> ExecuteAgentQueueWorkflowCreateSetupStartStepRequest {
    ExecuteAgentQueueWorkflowCreateSetupStartStepRequest {
        workspace_id: workspace_id.to_owned(),
        workflow_run_id: None,
        workflow_id: "dependency_acceptance_smoke".to_owned(),
        request_id: request_id.to_owned(),
        actor_id: Some("workspace-agent".to_owned()),
        inputs: Some(create_setup_start_inputs()),
        grant_summary: Some(json!({
            "actorId": "workspace-agent",
            "mode": "queue_acceptance_smoke",
            "constraints": {
                "noDownstreamAutoStart": true,
                "noGit": true,
                "noTerminal": true,
                "noValidationExecution": true
            },
            "maxActions": 16
        })),
        confirmation_token: Some("operator-confirmed".to_owned()),
        expected_version: None,
    }
}

fn create_setup_start_inputs() -> Value {
    json!({
        "runSettings": {
            "approvalPolicy": "never",
            "codexExecutable": "codex",
            "executionPolicy": "manual",
            "executionTarget": {
                "kind": "queue_local",
                "providerId": "codex"
            },
            "sandbox": "workspace_write",
            "workspaceRoot": std::env::current_dir()
                .expect("current dir")
                .to_string_lossy()
                .into_owned()
        },
        "tasks": [
            {
                "slot": "upstream",
                "title": "Inspect contract",
                "prompt": "Read visible context.",
                "dependsOnSlots": []
            },
            {
                "slot": "downstream",
                "title": "Apply follow-up",
                "prompt": "Use the upstream result.",
                "dependsOnSlots": ["upstream"]
            }
        ]
    })
}

fn json_object_contains_key(value: &Value, key: &str) -> bool {
    match value {
        Value::Object(object) => object
            .iter()
            .any(|(object_key, value)| object_key == key || json_object_contains_key(value, key)),
        Value::Array(values) => values
            .iter()
            .any(|value| json_object_contains_key(value, key)),
        _ => false,
    }
}

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-workflow-launch-{}-{nanos}.sqlite",
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
