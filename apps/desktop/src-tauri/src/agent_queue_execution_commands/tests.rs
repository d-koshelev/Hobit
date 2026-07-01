use super::*;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use hobit_app::{
    AckAgentQueueReviewMessageInput, AgentQueuePromptPackFileRequest,
    AgentQueuePromptPackMaterializeRequest, AssignAgentQueueTaskToExecutorInput,
    CreateAgentQueueReviewMessageInput, CreateAgentQueueTaskInput, MarkAgentQueueItemDoneInput,
    RecordAgentQueueWorkerFinishedInput, StartAssignedAgentQueueTaskInput,
    StartSelectedAgentQueueTaskLocalInput, UpdateAgentQueueTaskInput, WorkspaceService,
    AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN, QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
    QUEUE_LOCAL_BACKEND_WORKBENCH_ID,
};
use serde_json::{json, Value};

use crate::agent_queue_direct_work_launcher::{
    finish_queue_direct_work_launch_for_test, QueueDirectWorkLaunch, QueueDirectWorkLaunchStatus,
};
use crate::agent_queue_execution_dto::{
    GetAgentQueueTaskLatestRunLinkRequest, ListAgentQueueTaskRunLinksRequest,
    StartSelectedAgentQueueTaskLocalRequest,
};
use crate::agent_queue_prompt_pack_commands::{
    materialize_agent_queue_prompt_pack_blocking, materialize_agent_queue_prompt_pack_file_blocking,
};
use crate::app_state::{DirectWorkActiveRun, DirectWorkActiveRunRegistry};

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
fn start_assigned_agent_queue_task_command_helper_rejects_disabled_queue_control() {
    let db_path = unique_test_db_path();
    let (workspace_id, queue_item_id, executor_widget_id) =
        create_assigned_task(&db_path, "queued");
    {
        let store = SqliteStore::open(&db_path).expect("open sqlite test store");
        store.init_schema().expect("initialize schema");
        let service = WorkspaceService::new(store);
        service
            .disable_agent_queue_control(
                workspace_id.clone(),
                Some("test-operator".to_owned()),
                Some("disabled test".to_owned()),
                None,
            )
            .expect("disable queue control");
    }

    let error = start_assigned_agent_queue_task_blocking(
        request(&workspace_id, &queue_item_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
    )
    .expect_err("disabled queue control rejected");

    assert!(error.contains("blocked_control_disabled"));
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    assert!(store
        .list_widget_runs_for_widget(&executor_widget_id)
        .expect("list widget runs")
        .is_empty());
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

#[test]
fn selected_task_queue_local_start_accepts_materialized_prompt_pack_task_with_fake_launcher() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected task one");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-one",
            vec![json!({
                "id": "dogfood-status-checkpoint",
                "title": "Dogfood status checkpoint",
                "prompt": "Check the Queue dogfood status.",
                "tags": ["dogfood"],
                "priority": 3
            })],
        ),
    );
    let queue_task_id = materialized_queue_task_id(&materialized, "dogfood-status-checkpoint");
    let launches = Arc::new(Mutex::new(Vec::new()));

    let response = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &queue_task_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("start selected queue task");

    assert_eq!(response.status, "launched");
    assert_eq!(response.queue_item_id, queue_task_id);
    assert!(response.run_link_id.is_some());
    assert!(response.run_id.is_some());
    assert!(response.would_start_workers);
    assert!(response.created_run_link);
    assert!(!response.created_widget_run);
    assert!(!response.used_workflow_slot);
    assert!(!response.used_widget_identity);

    let launch = single_launch(&launches);
    assert_eq!(launch.workspace_id, workspace_id);
    assert_eq!(launch.queue_item_id, queue_task_id);
    assert_eq!(launch.run_id, response.run_id.as_deref().expect("run id"));
    assert_eq!(launch.run_link_id, response.run_link_id);
    assert_eq!(
        launch.direct_work_input.widget_instance_id,
        QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    );
    assert_eq!(
        launch.direct_work_input.workbench_id,
        QUEUE_LOCAL_BACKEND_WORKBENCH_ID
    );
    assert_eq!(launch.direct_work_input.codex_executable, "codex");
    assert_eq!(launch.direct_work_input.sandbox, "workspace_write");
    assert_eq!(launch.direct_work_input.approval_policy, "never");
    assert_eq!(
        launch.direct_work_input.operator_prompt,
        "Check the Queue dogfood status."
    );

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let task = store
        .get_agent_queue_task(&workspace_id, &queue_task_id)
        .expect("get queue task")
        .expect("queue task");
    let links = store
        .list_agent_queue_task_run_links(&workspace_id, &queue_task_id)
        .expect("list run links");

    assert_eq!(task.status, "running");
    assert_eq!(task.assigned_executor_widget_id, None);
    assert_eq!(links.len(), 1);
    assert_eq!(
        links[0].executor_widget_id,
        QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    );
    assert_eq!(links[0].direct_work_run_id, launch.run_id);
    assert_eq!(links[0].status, "running");
    assert!(store
        .list_widget_runs_for_widget(QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
        .expect("list widget runs")
        .is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_repeated_start_while_active_does_not_launch_twice() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected task duplicate");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-duplicate",
            vec![json!({
                "id": "run-once",
                "title": "Run once",
                "prompt": "Run once only.",
                "priority": 2
            })],
        ),
    );
    let queue_task_id = materialized_queue_task_id(&materialized, "run-once");
    let launches = Arc::new(Mutex::new(Vec::new()));

    let first = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &queue_task_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("first selected start");
    let second = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &queue_task_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("second selected start");

    assert_eq!(first.status, "launched");
    assert_eq!(second.status, "already_running");
    assert_eq!(second.run_id, first.run_id);
    assert_eq!(second.run_link_id, first.run_link_id);
    assert!(!second.would_start_workers);
    assert_eq!(launch_count(&launches), 1);
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_blocks_dependencies_until_accepted_completion_without_autodispatch() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected dependency");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-dependency",
            vec![
                json!({
                    "id": "upstream",
                    "title": "Upstream",
                    "prompt": "Complete upstream work.",
                    "priority": 3
                }),
                json!({
                    "id": "downstream",
                    "title": "Downstream",
                    "prompt": "Complete downstream work.",
                    "dependsOn": ["upstream"],
                    "priority": 3
                }),
            ],
        ),
    );
    let upstream_id = materialized_queue_task_id(&materialized, "upstream");
    let downstream_id = materialized_queue_task_id(&materialized, "downstream");
    let launches = Arc::new(Mutex::new(Vec::new()));

    let blocked = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &downstream_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("downstream blocked");
    assert_eq!(blocked.status, "blocked");
    assert_eq!(blocked.blocker_code.as_deref(), Some("dependency_waiting"));
    assert_eq!(launch_count(&launches), 0);

    let upstream = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &upstream_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("upstream selected start");
    assert_eq!(upstream.status, "launched");
    assert_eq!(launch_count(&launches), 1);
    let upstream_launch = launches_snapshot(&launches)
        .into_iter()
        .find(|launch| launch.queue_item_id == upstream_id)
        .expect("upstream launch");
    finish_queue_direct_work_launch_for_test(
        upstream_launch.clone(),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "completed",
    )
    .expect("complete upstream run");

    let still_blocked = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &downstream_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("downstream still blocked before accepted completion");
    assert_eq!(still_blocked.status, "blocked");
    assert_eq!(
        still_blocked.blocker_code.as_deref(),
        Some("dependency_waiting")
    );
    assert_eq!(launch_count(&launches), 1);

    accept_completed_task_for_dependency(
        &db_path,
        &workspace_id,
        &upstream_id,
        &upstream_launch.run_id,
    );

    let downstream = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &downstream_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("downstream selected start after accepted completion");
    assert_eq!(downstream.status, "launched");
    assert_eq!(launch_count(&launches), 2);

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    assert_eq!(
        store
            .list_agent_queue_task_run_links(&workspace_id, &downstream_id)
            .expect("downstream run links")
            .len(),
        1
    );
    remove_test_db_files(&db_path);
}

#[test]
fn dogfood_pack_file_selected_task_loop_uses_backend_queue_local_bridge() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Dogfood selected task loop");
    let created = materialize_dogfood_pack_file(&db_path, &workspace_id);
    let reused = materialize_dogfood_pack_file(&db_path, &workspace_id);
    assert_eq!(created.status, "created");
    assert_eq!(reused.status, "reused");
    assert_eq!(
        materialized_queue_task_id(&created, "dogfood-foundation-checkpoint"),
        materialized_queue_task_id(&reused, "dogfood-foundation-checkpoint")
    );

    let foundation_id = materialized_queue_task_id(&created, "dogfood-foundation-checkpoint");
    let hardening_id = materialized_queue_task_id(&created, "dogfood-file-import-hardening");
    let launches = Arc::new(Mutex::new(Vec::new()));

    let blocked = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &hardening_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("dependent dogfood task blocked");
    assert_eq!(blocked.status, "blocked");
    assert_eq!(blocked.blocker_code.as_deref(), Some("dependency_waiting"));
    assert_eq!(launch_count(&launches), 0);

    let foundation = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &foundation_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("start foundation dogfood task");
    assert_eq!(foundation.status, "launched");
    assert!(foundation.run_link_id.is_some());
    assert_eq!(launch_count(&launches), 1);
    let foundation_launch = single_launch(&launches);
    finish_queue_direct_work_launch_for_test(
        foundation_launch.clone(),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "completed",
    )
    .expect("complete foundation dogfood task");

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    assert!(store
        .list_agent_queue_task_run_links(&workspace_id, &hardening_id)
        .expect("hardening run links before manual start")
        .is_empty());

    accept_completed_task_for_dependency(
        &db_path,
        &workspace_id,
        &foundation_id,
        &foundation_launch.run_id,
    );

    let hardening = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &hardening_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("manual start hardening dogfood task");
    assert_eq!(hardening.status, "launched");
    assert_eq!(launch_count(&launches), 2);

    let store = SqliteStore::open(&db_path).expect("reopen sqlite test store");
    store.init_schema().expect("initialize schema");
    assert!(store
        .list_widget_runs_for_widget(QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
        .expect("queue local widget runs")
        .is_empty());
    assert_eq!(
        store
            .list_agent_queue_task_run_links(&workspace_id, &hardening_id)
            .expect("hardening run links")
            .len(),
        1
    );
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_completion_bridge_terminalizes_success_and_failure() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected completion");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-completion",
            vec![
                json!({
                    "id": "success-task",
                    "title": "Success task",
                    "prompt": "Complete successfully.",
                    "priority": 2
                }),
                json!({
                    "id": "failure-task",
                    "title": "Failure task",
                    "prompt": "Complete with failure.",
                    "priority": 2
                }),
            ],
        ),
    );
    let success_id = materialized_queue_task_id(&materialized, "success-task");
    let failure_id = materialized_queue_task_id(&materialized, "failure-task");
    let launches = Arc::new(Mutex::new(Vec::new()));

    start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &success_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("start success task");
    let success_launch = single_launch(&launches);
    finish_queue_direct_work_launch_for_test(
        success_launch.clone(),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "completed",
    )
    .expect("finish success task");

    start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &failure_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("start failure task");
    let failure_launch = launches_snapshot(&launches)
        .into_iter()
        .find(|launch| launch.queue_item_id == failure_id)
        .expect("failure launch");
    finish_queue_direct_work_launch_for_test(
        failure_launch.clone(),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "failed",
    )
    .expect("finish failure task");

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let success = store
        .get_agent_queue_task(&workspace_id, &success_id)
        .expect("success task")
        .expect("success task row");
    let failure = store
        .get_agent_queue_task(&workspace_id, &failure_id)
        .expect("failure task")
        .expect("failure task row");
    let success_link = store
        .get_latest_agent_queue_task_run_link(&workspace_id, &success_id)
        .expect("success link")
        .expect("success link row");
    let failure_link = store
        .get_latest_agent_queue_task_run_link(&workspace_id, &failure_id)
        .expect("failure link")
        .expect("failure link row");

    assert_eq!(success.status, "completed");
    assert_eq!(success_link.status, "completed");
    assert_eq!(failure.status, "failed");
    assert_eq!(failure_link.status, "failed");
    assert!(store
        .list_widget_runs_for_widget(QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
        .expect("widget runs")
        .is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_failed_task_can_be_retried_explicitly() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected retry failed");
    let pack = queue_local_pack(
        "selected-task-retry",
        vec![json!({
            "id": "retry-task",
            "title": "Retry task",
            "prompt": "Retry this failed task explicitly.",
            "priority": 2
        })],
    );
    let materialized = materialize_pack_value(&db_path, &workspace_id, pack.clone());
    let queue_task_id = materialized_queue_task_id(&materialized, "retry-task");
    let launches = Arc::new(Mutex::new(Vec::new()));

    let first = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &queue_task_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("first selected start");
    assert_eq!(first.status, "launched");
    let first_launch = single_launch(&launches);
    finish_queue_direct_work_launch_for_test(
        first_launch.clone(),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "failed",
    )
    .expect("finish first run failed");

    let rematerialized = materialize_pack_value(&db_path, &workspace_id, pack);
    assert_eq!(rematerialized.status, "reused");
    assert_eq!(
        materialized_queue_task_id(&rematerialized, "retry-task"),
        queue_task_id
    );

    let service = workspace_service_for_test(&db_path);
    let retry_start = service
        .retry_selected_agent_queue_task_local(StartSelectedAgentQueueTaskLocalInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: queue_task_id.clone(),
        })
        .expect("retry failed selected task");
    let retry = launch_selected_agent_queue_task_local_start(
        retry_start,
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("launch retry");

    assert_eq!(retry.status, "launched");
    assert_eq!(retry.queue_item_id, queue_task_id);
    assert!(retry.created_run_link);
    assert!(!retry.created_widget_run);
    assert!(!retry.used_widget_identity);
    assert_eq!(launch_count(&launches), 2);
    assert_ne!(retry.run_link_id, first.run_link_id);

    let retry_launch = launches_snapshot(&launches)
        .into_iter()
        .find(|launch| Some(launch.run_id.as_str()) == retry.run_id.as_deref())
        .expect("retry launch");
    finish_queue_direct_work_launch_for_test(
        retry_launch.clone(),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "completed",
    )
    .expect("finish retry completed");

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let task = store
        .get_agent_queue_task(&workspace_id, &queue_task_id)
        .expect("get task")
        .expect("task");
    let links = store
        .list_agent_queue_task_run_links(&workspace_id, &queue_task_id)
        .expect("run links");
    assert_eq!(task.status, "completed");
    assert_eq!(links.len(), 2);
    assert!(links.iter().any(
        |link| first.run_link_id.as_deref() == Some(link.link_id.as_str())
            && link.status == "failed"
    ));
    assert!(links.iter().any(
        |link| retry.run_link_id.as_deref() == Some(link.link_id.as_str())
            && link.status == "completed"
    ));
    assert!(store
        .list_widget_runs_for_widget(QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
        .expect("widget runs")
        .is_empty());
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_retry_rejects_completed_and_active_tasks() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected retry blocked");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-retry-blocked",
            vec![
                json!({
                    "id": "completed-task",
                    "title": "Completed retry block",
                    "prompt": "Completed tasks are not retried.",
                    "priority": 2
                }),
                json!({
                    "id": "active-task",
                    "title": "Active retry block",
                    "prompt": "Active tasks are not duplicated.",
                    "priority": 2
                }),
            ],
        ),
    );
    let completed_id = materialized_queue_task_id(&materialized, "completed-task");
    let active_id = materialized_queue_task_id(&materialized, "active-task");
    let launches = Arc::new(Mutex::new(Vec::new()));

    let completed = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &completed_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("start completed task");
    let completed_launch = single_launch(&launches);
    finish_queue_direct_work_launch_for_test(
        completed_launch,
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        "completed",
    )
    .expect("finish completed task");

    let service = workspace_service_for_test(&db_path);
    let completed_retry = service
        .retry_selected_agent_queue_task_local(StartSelectedAgentQueueTaskLocalInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: completed_id.clone(),
        })
        .expect("completed retry blocked");
    assert_eq!(completed_retry.status, "blocked");
    assert_eq!(
        completed_retry
            .blocker
            .as_ref()
            .map(|blocker| blocker.blocker_code.as_str()),
        Some("not_retryable_task_status")
    );
    assert_eq!(launch_count(&launches), 1);
    assert!(completed.run_link_id.is_some());

    let active = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &active_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        recording_fake_launcher(launches.clone()),
    )
    .expect("start active task");
    assert_eq!(active.status, "launched");
    let active_retry = service
        .retry_selected_agent_queue_task_local(StartSelectedAgentQueueTaskLocalInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: active_id.clone(),
        })
        .expect("active retry blocked");
    assert_eq!(active_retry.status, "already_running");
    assert_eq!(
        active_retry
            .blocker
            .as_ref()
            .map(|blocker| blocker.blocker_code.as_str()),
        Some("active_run_conflict")
    );
    assert_eq!(launch_count(&launches), 2);

    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    assert_eq!(
        store
            .list_agent_queue_task_run_links(&workspace_id, &completed_id)
            .expect("completed links")
            .len(),
        1
    );
    assert_eq!(
        store
            .list_agent_queue_task_run_links(&workspace_id, &active_id)
            .expect("active links")
            .len(),
        1
    );
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_launch_failure_marks_run_failed_without_zombie() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected launch failure");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-launch-failure",
            vec![json!({
                "id": "failure",
                "title": "Launch failure",
                "prompt": "Launch should fail before worker starts.",
                "priority": 2
            })],
        ),
    );
    let queue_task_id = materialized_queue_task_id(&materialized, "failure");

    let response = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, &queue_task_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        |_launch, _db_path, _active_runs| Err("fake launch failed".to_owned()),
    )
    .expect("launch failure response");

    assert_eq!(response.status, "failed");
    assert_eq!(response.blocker_code.as_deref(), Some("launch_failed"));
    assert!(!response.would_start_workers);
    let store = SqliteStore::open(&db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let task = store
        .get_agent_queue_task(&workspace_id, &queue_task_id)
        .expect("get task")
        .expect("task");
    let link = store
        .get_latest_agent_queue_task_run_link(&workspace_id, &queue_task_id)
        .expect("get link")
        .expect("link");
    assert_eq!(task.status, "failed");
    assert_eq!(link.status, "failed");
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_rejects_unknown_and_cross_workspace_task() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected validation");
    let other_workspace_id = create_queue_local_workspace(&db_path, "Selected other workspace");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        queue_local_pack(
            "selected-task-workspace",
            vec![json!({
                "id": "workspace-task",
                "title": "Workspace task",
                "prompt": "Task belongs to one workspace.",
                "priority": 2
            })],
        ),
    );
    let queue_task_id = materialized_queue_task_id(&materialized, "workspace-task");

    let missing = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&workspace_id, "missing-task"),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("missing task blocked");
    assert_eq!(missing.status, "blocked");
    assert_eq!(missing.blocker_code.as_deref(), Some("task_not_found"));

    let cross_workspace = start_selected_agent_queue_task_local_from_request_with_launcher(
        selected_task_request(&other_workspace_id, &queue_task_id),
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("cross workspace task blocked");
    assert_eq!(cross_workspace.status, "blocked");
    assert_eq!(
        cross_workspace.blocker_code.as_deref(),
        Some("workspace_mismatch")
    );
    remove_test_db_files(&db_path);
}

#[test]
fn selected_task_queue_local_requires_durable_runtime_settings_without_request_overrides() {
    let db_path = unique_test_db_path();
    let workspace_id = create_queue_local_workspace(&db_path, "Selected runtime settings");
    let materialized = materialize_pack_value(
        &db_path,
        &workspace_id,
        prompt_pack_without_run_settings(
            "selected-task-missing-settings",
            vec![json!({
                "id": "missing-settings",
                "title": "Missing settings",
                "prompt": "Runtime settings are intentionally missing.",
                "priority": 2
            })],
        ),
    );
    let queue_task_id = materialized_queue_task_id(&materialized, "missing-settings");

    let request = selected_task_request(&workspace_id, &queue_task_id);
    let request_json = serde_json::to_value(&request).expect("request json");
    let request_object = request_json.as_object().expect("request object");
    for forbidden in [
        "codexExecutable",
        "repoRoot",
        "workspaceRoot",
        "executionWorkspace",
        "sandbox",
        "approvalPolicy",
        "command",
        "shell",
    ] {
        assert!(!request_object.contains_key(forbidden));
    }

    let blocked = start_selected_agent_queue_task_local_from_request_with_launcher(
        request,
        db_path.clone(),
        DirectWorkActiveRunRegistry::default(),
        panic_if_launcher_called(),
    )
    .expect("missing settings blocked");

    assert_eq!(blocked.status, "blocked");
    assert_eq!(blocked.blocker_code.as_deref(), Some("missing_sandbox"));
    remove_test_db_files(&db_path);
}

fn create_queue_local_workspace(db_path: &Path, title: &str) -> String {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace_root = repo_root_for_test().display().to_string();
    let workspace = service
        .create_empty_workspace_with_root_path(title, None, Some(workspace_root))
        .expect("create workspace");
    service
        .enable_agent_queue_manual_control(
            workspace.id.clone(),
            Some("test-operator".to_owned()),
            Some("selected task start fixture".to_owned()),
            None,
        )
        .expect("enable queue manual control");
    workspace.id
}

fn workspace_service_for_test(db_path: &Path) -> WorkspaceService {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn queue_local_pack(pack_id: &str, tasks: Vec<Value>) -> Value {
    let mut pack = prompt_pack_without_run_settings(pack_id, tasks);
    pack.as_object_mut()
        .expect("pack object")
        .insert("runSettings".to_owned(), queue_local_run_settings());
    pack
}

fn prompt_pack_without_run_settings(pack_id: &str, tasks: Vec<Value>) -> Value {
    json!({
        "version": 1,
        "packId": pack_id,
        "title": format!("Prompt pack {pack_id}"),
        "description": "Selected Queue task start test pack.",
        "defaults": {
            "status": "draft",
            "priority": 3
        },
        "constraints": {
            "noAutoRun": true
        },
        "tasks": tasks
    })
}

fn queue_local_run_settings() -> Value {
    json!({
        "executionTarget": {
            "kind": "queue_local",
            "providerId": "codex"
        },
        "executionPolicy": "manual",
        "sandbox": "workspace_write",
        "approvalPolicy": "never"
    })
}

fn materialize_pack_value(
    db_path: &Path,
    workspace_id: &str,
    value: Value,
) -> hobit_app::AgentQueuePromptPackMaterializeResult {
    materialize_agent_queue_prompt_pack_blocking(
        AgentQueuePromptPackMaterializeRequest {
            workspace_id: workspace_id.to_owned(),
            json_payload: value.to_string(),
        },
        db_path.to_path_buf(),
    )
    .expect("materialize prompt pack")
}

fn materialize_dogfood_pack_file(
    db_path: &Path,
    workspace_id: &str,
) -> hobit_app::AgentQueuePromptPackMaterializeResult {
    materialize_agent_queue_prompt_pack_file_blocking(
        AgentQueuePromptPackFileRequest {
            workspace_id: workspace_id.to_owned(),
            workspace_relative_path:
                "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json".to_owned(),
        },
        db_path.to_path_buf(),
    )
    .expect("materialize dogfood prompt pack file")
}

fn materialized_queue_task_id(
    result: &hobit_app::AgentQueuePromptPackMaterializeResult,
    pack_task_id: &str,
) -> String {
    result
        .tasks
        .iter()
        .find(|task| task.pack_task_id == pack_task_id)
        .and_then(|task| task.queue_task_id.clone())
        .unwrap_or_else(|| panic!("missing queue task id for {pack_task_id}"))
}

fn repo_root_for_test() -> PathBuf {
    let mut current = std::env::current_dir().expect("current dir");
    loop {
        if current.join("AGENTS.md").is_file() && current.join("Cargo.toml").is_file() {
            return current;
        }
        current = current
            .parent()
            .unwrap_or_else(|| panic!("repo root not found from current dir"))
            .to_path_buf();
    }
}

fn selected_task_request(
    workspace_id: &str,
    queue_item_id: &str,
) -> StartSelectedAgentQueueTaskLocalRequest {
    StartSelectedAgentQueueTaskLocalRequest {
        workspace_id: workspace_id.to_owned(),
        queue_item_id: queue_item_id.to_owned(),
    }
}

fn recording_fake_launcher(
    launches: Arc<Mutex<Vec<QueueDirectWorkLaunch>>>,
) -> impl FnOnce(
    QueueDirectWorkLaunch,
    PathBuf,
    DirectWorkActiveRunRegistry,
) -> Result<QueueDirectWorkLaunchStatus, String> {
    move |launch, _db_path, _active_runs| {
        launches.lock().expect("launches lock").push(launch);
        Ok(QueueDirectWorkLaunchStatus::Spawned)
    }
}

fn panic_if_launcher_called() -> impl FnOnce(
    QueueDirectWorkLaunch,
    PathBuf,
    DirectWorkActiveRunRegistry,
) -> Result<QueueDirectWorkLaunchStatus, String> {
    |_launch, _db_path, _active_runs| panic!("fake launcher should not be called")
}

fn launch_count(launches: &Arc<Mutex<Vec<QueueDirectWorkLaunch>>>) -> usize {
    launches.lock().expect("launches lock").len()
}

fn launches_snapshot(
    launches: &Arc<Mutex<Vec<QueueDirectWorkLaunch>>>,
) -> Vec<QueueDirectWorkLaunch> {
    launches.lock().expect("launches lock").clone()
}

fn single_launch(launches: &Arc<Mutex<Vec<QueueDirectWorkLaunch>>>) -> QueueDirectWorkLaunch {
    let launches = launches.lock().expect("launches lock");
    assert_eq!(launches.len(), 1);
    launches[0].clone()
}

fn accept_completed_task_for_dependency(
    db_path: &Path,
    workspace_id: &str,
    queue_item_id: &str,
    run_id: &str,
) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let evidence = service
        .record_agent_queue_worker_finished(RecordAgentQueueWorkerFinishedInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            run_id: run_id.to_owned(),
            outcome: "completed".to_owned(),
            summary: Some("Worker evidence is durable.".to_owned()),
            changed_files: vec![],
            changed_files_summary: None,
            validation_summary: Some("validation not run".to_owned()),
            error_summary: None,
            worker_id: Some("workspace-agent".to_owned()),
            source: Some("workspace_agent".to_owned()),
            metadata_json: None,
            finished_at: Some("completed-at".to_owned()),
        })
        .expect("record worker evidence");
    let review = service
        .create_agent_queue_review_message(CreateAgentQueueReviewMessageInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            actor_id: "workspace-agent".to_owned(),
            message_body: None,
            run_id: Some(run_id.to_owned()),
            evidence_bundle_id: Some(evidence.bundle_id.clone()),
        })
        .expect("create review");
    let message_id = review.message_id.expect("review message id");
    service
        .ack_agent_queue_review_message(AckAgentQueueReviewMessageInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            message_id: message_id.clone(),
            actor_id: "workspace-agent".to_owned(),
        })
        .expect("ack review");
    let accepted = service
        .mark_agent_queue_item_done(MarkAgentQueueItemDoneInput {
            workspace_id: workspace_id.to_owned(),
            queue_item_id: queue_item_id.to_owned(),
            actor_id: "workspace-agent".to_owned(),
            confirmation_token: AGENT_QUEUE_ACCEPTED_COMPLETION_CONFIRMATION_TOKEN.to_owned(),
            reason: Some("Operator accepted completion.".to_owned()),
            run_id: Some(run_id.to_owned()),
            review_message_id: Some(message_id),
        })
        .expect("mark done");
    assert_eq!(accepted.status.as_str(), "succeeded");
}

fn create_assigned_task(db_path: &Path, status: &str) -> (String, String, String) {
    let store = SqliteStore::open(db_path).expect("open sqlite test store");
    store.init_schema().expect("initialize schema");
    let service = WorkspaceService::new(store);
    let workspace = service
        .create_empty_workspace("Queue execution command test", None)
        .expect("create workspace");
    service
        .enable_agent_queue_manual_control(
            workspace.id.clone(),
            Some("test-operator".to_owned()),
            Some("test start fixture".to_owned()),
            None,
        )
        .expect("enable queue manual control");
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
            depends_on: None,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
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
                depends_on: None,
                execution_policy: None,
                execution_workspace: None,
                codex_executable: None,
                sandbox: None,
                approval_policy: None,
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
        workflow_start_context: None,
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
        workflow_start_context: None,
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
