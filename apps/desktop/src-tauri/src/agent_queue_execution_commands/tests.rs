use super::*;

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AssignAgentQueueTaskToExecutorInput, CreateAgentQueueTaskInput,
    StartAssignedAgentQueueTaskInput, UpdateAgentQueueTaskInput,
};

use crate::agent_queue_execution_dto::{
    GetAgentQueueTaskLatestRunLinkRequest, ListAgentQueueTaskRunLinksRequest,
};

#[test]
fn start_assigned_agent_queue_task_command_helper_starts_direct_work_run() {
    let db_path = unique_test_db_path();
    let (workspace_id, queue_item_id, executor_widget_id) = create_assigned_task(&db_path, "ready");

    let start = start_assigned_agent_queue_task_blocking(
        request(&workspace_id, &queue_item_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect("start assigned queue task");

    assert_eq!(start.workspace_id, workspace_id);
    assert_eq!(start.queue_item_id, queue_item_id);
    assert_eq!(start.executor_widget_instance_id, executor_widget_id);
    assert_eq!(start.status, "started");
    assert_eq!(start.direct_work_input.operator_prompt, "Prompt");

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let task = store
        .get_agent_queue_task(&workspace_id, &queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    let runs = store
        .list_widget_runs_for_widget(&executor_widget_id)
        .expect("list widget runs");

    assert_eq!(task.status, "running");
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].id, start.run_id);
    assert_eq!(runs[0].status, "running");
    assert_eq!(runs[0].command_kind.as_deref(), Some("codex_direct_work"));
    remove_test_db_files(&db_path);
}

#[test]
fn latest_run_link_command_helper_returns_safe_metadata() {
    let db_path = unique_test_db_path();
    let (workspace_id, queue_item_id, executor_widget_id) = create_assigned_task(&db_path, "ready");

    let start = start_assigned_agent_queue_task_blocking(
        request(&workspace_id, &queue_item_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect("start assigned queue task");

    let link = get_agent_queue_task_latest_run_link_blocking(
        GetAgentQueueTaskLatestRunLinkRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: queue_item_id.clone(),
        },
        db_path.clone(),
    )
    .expect("get latest run link")
    .expect("latest run link");

    assert_eq!(link.workspace_id, workspace_id);
    assert_eq!(link.queue_task_id, queue_item_id);
    assert_eq!(link.executor_widget_id, executor_widget_id);
    assert_eq!(link.direct_work_run_id, start.run_id);
    assert_eq!(link.source, "manual");
    assert_eq!(link.status, "running");
    assert_eq!(link.completed_at, None);

    let link_json = serde_json::to_value(&link).expect("serialize link");
    let object = link_json.as_object().expect("link object");
    assert!(!object.contains_key("prompt"));
    assert!(!object.contains_key("stdout"));
    assert!(!object.contains_key("stderr"));
    assert!(!object.contains_key("final_response"));
    assert!(!object.contains_key("diff"));
    assert!(!object.contains_key("payload_json"));
    assert!(!object.contains_key("repo_root"));
    remove_test_db_files(&db_path);
}

#[test]
fn list_run_links_command_helper_returns_safe_metadata() {
    let db_path = unique_test_db_path();
    let (workspace_id, queue_item_id, executor_widget_id) = create_assigned_task(&db_path, "ready");

    let start = start_assigned_agent_queue_task_blocking(
        request(&workspace_id, &queue_item_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect("start assigned queue task");

    let links = list_agent_queue_task_run_links_blocking(
        ListAgentQueueTaskRunLinksRequest {
            workspace_id: workspace_id.clone(),
            queue_item_id: queue_item_id.clone(),
        },
        db_path.clone(),
    )
    .expect("list run links");

    assert_eq!(links.len(), 1);
    let link = &links[0];
    assert_eq!(link.workspace_id, workspace_id);
    assert_eq!(link.queue_task_id, queue_item_id);
    assert_eq!(link.executor_widget_id, executor_widget_id);
    assert_eq!(link.direct_work_run_id, start.run_id);
    assert_eq!(link.source, "manual");
    assert_eq!(link.status, "running");

    let link_json = serde_json::to_value(link).expect("serialize link");
    let object = link_json.as_object().expect("link object");
    for forbidden_field in [
        "prompt",
        "operator_prompt",
        "stdout",
        "stderr",
        "final_response",
        "diff",
        "logs",
        "command_payload",
        "payload_json",
        "repo_root",
        "secrets",
    ] {
        assert!(
            !object.contains_key(forbidden_field),
            "run link list DTO must not expose {forbidden_field}"
        );
    }
    remove_test_db_files(&db_path);
}

#[test]
fn start_assigned_agent_queue_task_command_helper_rejects_active_executor() {
    let db_path = unique_test_db_path();
    let (workspace_id, queue_item_id, executor_widget_id) =
        create_assigned_task(&db_path, "queued");
    let workbench_id = workbench_id_for_workspace(&db_path, &workspace_id);
    let active_runs = DirectWorkActiveRunRegistry::default();
    active_runs.register(DirectWorkActiveRun::new(
        "run_1".to_owned(),
        workspace_id.clone(),
        workbench_id,
        executor_widget_id.clone(),
        hobit_app::CodexDirectStreamCancellationToken::new(),
    ));

    let error = start_assigned_agent_queue_task_blocking(
        request(&workspace_id, &queue_item_id),
        db_path.clone(),
        active_runs,
    )
    .expect_err("active executor rejected");

    assert!(error.contains("active Direct Work run"));
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let task = store
        .get_agent_queue_task(&workspace_id, &queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    let runs = store
        .list_widget_runs_for_widget(&executor_widget_id)
        .expect("list widget runs");

    assert_eq!(task.status, "queued");
    assert!(runs.is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn start_assigned_agent_queue_task_command_helper_rejects_non_runnable_task() {
    let db_path = unique_test_db_path();
    let (workspace_id, queue_item_id, executor_widget_id) =
        create_assigned_task(&db_path, "completed");

    let error = start_assigned_agent_queue_task_blocking(
        request(&workspace_id, &queue_item_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect_err("completed task rejected");

    assert!(error.contains("queue task status cannot be run: completed"));
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    assert!(store
        .list_widget_runs_for_widget(&executor_widget_id)
        .expect("list widget runs")
        .is_empty());
    remove_test_db_files(&db_path);
}

fn create_assigned_task(db_path: &Path, status: &str) -> (String, String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Queue execution command test", None)
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
    let task = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: if status == "completed" {
                "queued".to_owned()
            } else {
                status.to_owned()
            },
            priority: 1,
            execution_policy: None,
        })
        .expect("create queue task");
    service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_widget_id.clone(),
        })
        .expect("assign task");
    if status == "completed" {
        service
            .update_agent_queue_task(UpdateAgentQueueTaskInput {
                workspace_id: workspace.id.clone(),
                queue_item_id: task.queue_item_id.clone(),
                title: task.title,
                description: task.description,
                prompt: task.prompt,
                status: "completed".to_owned(),
                priority: task.priority,
                execution_policy: None,
            })
            .expect("force final status");
    }
    drop(service);

    (workspace.id, task.queue_item_id, executor_widget_id)
}

fn workbench_id_for_workspace(db_path: &Path, workspace_id: &str) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    service
        .get_workspace_summary(workspace_id)
        .expect("get workspace summary")
        .expect("workspace summary")
        .workbench_id
        .expect("workbench id")
}

fn request(workspace_id: &str, queue_item_id: &str) -> StartAssignedAgentQueueTaskRequest {
    let input = StartAssignedAgentQueueTaskInput {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
        queue_owner_widget_instance_id: None,
        codex_executable: "codex".to_owned(),
        repo_root: std::env::current_dir().expect("current dir"),
        sandbox: "workspace_write".to_owned(),
        approval_policy: "never".to_owned(),
        timeout_ms: Some(10),
        stdout_cap_bytes: Some(11),
        stderr_cap_bytes: Some(12),
    };

    StartAssignedAgentQueueTaskRequest {
        workspace_id: input.workspace_id,
        queue_item_id: input.queue_item_id,
        queue_owner_widget_instance_id: input.queue_owner_widget_instance_id,
        codex_executable: input.codex_executable,
        repo_root: input.repo_root.display().to_string(),
        sandbox: input.sandbox,
        approval_policy: input.approval_policy,
        timeout_ms: input.timeout_ms,
        stdout_cap_bytes: input.stdout_cap_bytes,
        stderr_cap_bytes: input.stderr_cap_bytes,
    }
}

fn unique_test_db_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after unix epoch")
        .as_nanos();

    std::env::temp_dir().join(format!(
        "hobit-agent-queue-execution-command-test-{}-{nanos}.sqlite3",
        std::process::id()
    ))
}

fn remove_test_db_files(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
}
