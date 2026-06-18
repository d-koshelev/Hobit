use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AssignAgentQueueTaskToExecutorInput, CreateAgentQueueTaskInput,
    StartAssignedAgentQueueTaskInput, WorkspaceService,
};
use hobit_storage_sqlite::SqliteStore;

#[test]
fn record_worker_finished_command_serializes_backend_result() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    drop(service);

    let result = record_agent_queue_worker_finished_blocking(
        RecordAgentQueueWorkerFinishedRequest {
            workspace_id: workspace_id.clone(),
            task_id: task.queue_item_id.clone(),
            run_id: run_id.clone(),
            outcome: "completed".to_owned(),
            summary: Some("Worker final report.".to_owned()),
            changed_files: Some(vec!["src/lib.rs".to_owned()]),
            changed_files_summary: Some("1 changed file".to_owned()),
            validation_summary: Some("Validation not run.".to_owned()),
            error_summary: None,
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("worker-finished-at".to_owned()),
        },
        db_path.clone(),
    )
    .expect("record worker evidence");

    assert!(result.durable);
    assert_eq!(result.task_id, task.queue_item_id);
    assert_eq!(result.run_id, run_id);
    assert_eq!(result.evidence_bundle.outcome, "completed");
    assert_eq!(result.evidence_bundle.changed_files, vec!["src/lib.rs"]);
    assert_eq!(result.aggregate.evidence_state, "available");
    assert_eq!(result.aggregate.review_state, "awaiting_review");
    assert_eq!(result.aggregate.ticket_state, "awaiting_review");
    remove_test_db_files(&db_path);
}

#[test]
fn get_worker_evidence_bundle_command_serializes_backend_result() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    let run_id = start_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    service
        .record_agent_queue_worker_finished(hobit_app::RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            run_id: run_id.clone(),
            outcome: "failed".to_owned(),
            summary: Some("Worker failed.".to_owned()),
            changed_files: vec![],
            changed_files_summary: None,
            validation_summary: None,
            error_summary: Some("Failure summary.".to_owned()),
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("worker-finished-at".to_owned()),
        })
        .expect("record failed evidence");
    drop(service);

    let result = get_agent_queue_worker_evidence_bundle_blocking(
        GetAgentQueueWorkerEvidenceBundleRequest {
            workspace_id,
            task_id: task.queue_item_id,
            run_id: Some(run_id.clone()),
        },
        db_path.clone(),
    )
    .expect("get worker evidence");

    assert_eq!(result.state, "available");
    assert!(result.durable);
    assert_eq!(
        result
            .evidence_bundle
            .as_ref()
            .expect("evidence bundle")
            .run_id,
        run_id
    );
    assert_eq!(
        result
            .evidence_bundle
            .as_ref()
            .expect("evidence bundle")
            .error_summary
            .as_deref(),
        Some("Failure summary.")
    );
    assert_eq!(
        result.aggregate.as_ref().expect("aggregate").evidence_state,
        "available"
    );
    remove_test_db_files(&db_path);
}

#[test]
fn worker_evidence_commands_require_explicit_run_id_and_task_id() {
    let db_path = unique_test_db_path();
    let service = initialized_service(&db_path);
    let (workspace_id, _workbench_id, _executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id);
    drop(service);

    let missing_run = record_agent_queue_worker_finished_blocking(
        RecordAgentQueueWorkerFinishedRequest {
            workspace_id: workspace_id.clone(),
            task_id: task.queue_item_id.clone(),
            run_id: " ".to_owned(),
            outcome: "completed".to_owned(),
            summary: Some("Do not infer run identity.".to_owned()),
            changed_files: None,
            changed_files_summary: None,
            validation_summary: None,
            error_summary: None,
            worker_id: None,
            source: None,
            metadata_json: None,
            finished_at: None,
        },
        db_path.clone(),
    );
    assert!(missing_run
        .expect_err("run id required")
        .contains("worker run id must not be empty"));

    let missing_task = get_agent_queue_worker_evidence_bundle_blocking(
        GetAgentQueueWorkerEvidenceBundleRequest {
            workspace_id,
            task_id: " ".to_owned(),
            run_id: None,
        },
        db_path.clone(),
    );
    assert!(missing_task
        .expect_err("task id required")
        .contains("queue item id must not be empty"));
    remove_test_db_files(&db_path);
}

#[test]
fn worker_evidence_command_source_is_independent_from_frontend_and_execution_paths() {
    let source = include_str!("../agent_queue_worker_evidence_commands.rs");

    for forbidden in [
        "frontend",
        "run_codex",
        "run_direct_work",
        "start_assigned_agent_queue_task",
        "run_queue_validation",
        "validation_runner",
        "get_git_",
        "create_git_",
        "terminal_",
        "rollback",
        "shell",
    ] {
        assert!(
            !source.contains(forbidden),
            "worker evidence command must not call {forbidden}"
        );
    }
}

fn initialized_service(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue worker evidence command test", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("workbench id")
        .to_owned();
    let executor_id = add_widget(service, &workspace.id, "agent-run", "Agent Executor");

    (workspace.id, workbench_id, executor_id)
}

fn add_widget(
    service: &WorkspaceService,
    workspace_id: &str,
    definition_id: &str,
    title: &str,
) -> String {
    let workbench_id = service
        .get_workspace_workbench_state(workspace_id)
        .expect("get state")
        .expect("workspace state")
        .workbench
        .expect("workbench")
        .id;
    service
        .add_widget_instance_to_workbench(
            workspace_id,
            &workbench_id,
            definition_id,
            title,
            "agent",
        )
        .expect("add widget")
        .expect("state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("widget")
        .id
}

fn create_task(service: &WorkspaceService, workspace_id: &str) -> hobit_app::AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            depends_on: Some(vec![]),
            execution_policy: None,
            execution_workspace: Some("C:/repo".to_owned()),
            codex_executable: Some("codex".to_owned()),
            sandbox: Some("workspace_write".to_owned()),
            approval_policy: Some("never".to_owned()),
        })
        .expect("create task")
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

fn start_task(
    service: &WorkspaceService,
    workspace_id: &str,
    queue_item_id: &str,
    executor_id: &str,
) -> String {
    assign_task(service, workspace_id, queue_item_id, executor_id);
    service
        .start_assigned_agent_queue_task(start_input(workspace_id, queue_item_id))
        .expect("start task")
        .run_id
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

fn unique_test_db_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    path.push(format!(
        "hobit-tauri-queue-worker-evidence-command-test-{}-{nanos}.sqlite",
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
