use super::*;

use std::path::PathBuf;

use hobit_storage_sqlite::SqliteStore;

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

#[test]
fn app_run_link_start_record_stores_safe_metadata_only() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", "Prompt");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start assigned task");

    let links = service
        .list_agent_queue_task_run_links(&workspace_id, &task.queue_item_id)
        .expect("list run links");

    assert_eq!(links.len(), 1);
    assert_eq!(links[0].workspace_id, workspace_id);
    assert_eq!(links[0].queue_task_id, task.queue_item_id);
    assert_eq!(links[0].executor_widget_id, executor_id);
    assert_eq!(links[0].direct_work_run_id, start.run_id);
    assert_eq!(links[0].source, AgentQueueTaskRunSource::Manual);
    assert_eq!(links[0].status, AgentQueueTaskRunStatus::Running);
    assert_eq!(links[0].validation_status, None);
    assert_eq!(links[0].review_status, None);
}

#[test]
fn app_run_link_final_status_update_works() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "ready", "Prompt");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);
    let start = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start assigned task");
    service
        .store
        .finish_widget_run(
            &start.run_id,
            hobit_storage_sqlite::WidgetRunFinishUpdate {
                status: "completed",
                finished_at: Some("done-at"),
                summary: Some("completed"),
            },
        )
        .expect("finish widget run");

    let task = service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: workspace_id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id,
            run_id: start.run_id.clone(),
            direct_work_status: "completed".to_owned(),
        })
        .expect("finish assigned task");
    let latest = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &task.queue_item_id)
        .expect("get latest link")
        .expect("latest link");

    assert_eq!(task.status, "completed");
    assert_eq!(latest.status, AgentQueueTaskRunStatus::Completed);
    assert_eq!(latest.completed_at.as_deref(), Some("done-at"));
    assert_eq!(
        latest.review_status,
        Some(AgentQueueTaskRunReviewStatus::ReviewNeeded)
    );
}

#[test]
fn one_queue_task_can_have_multiple_run_links_and_latest_can_be_derived() {
    let service = initialized_service();
    let (workspace_id, _workbench_id, executor_id) = add_executor(&service);
    let task = create_task(&service, &workspace_id, "queued", "Prompt");
    assign_task(&service, &workspace_id, &task.queue_item_id, &executor_id);

    let first = service
        .start_assigned_agent_queue_task(start_input(&workspace_id, &task.queue_item_id))
        .expect("start first run");
    service
        .store
        .update_agent_queue_task_status(&workspace_id, &task.queue_item_id, "review_needed", None)
        .expect("force retryable status");
    let second = service
        .start_assigned_agent_queue_task_with_run_source(
            start_input(&workspace_id, &task.queue_item_id),
            AgentQueueTaskRunSource::Autorun,
        )
        .expect("start second run");

    let links = service
        .list_agent_queue_task_run_links(&workspace_id, &task.queue_item_id)
        .expect("list run links");
    let latest = service
        .get_latest_agent_queue_task_run_link(&workspace_id, &task.queue_item_id)
        .expect("get latest link")
        .expect("latest link");

    assert_eq!(links.len(), 2);
    assert!(links
        .iter()
        .any(|link| link.direct_work_run_id == first.run_id
            && link.source == AgentQueueTaskRunSource::Manual));
    assert!(links
        .iter()
        .any(|link| link.direct_work_run_id == second.run_id
            && link.source == AgentQueueTaskRunSource::Autorun));
    assert_eq!(latest.direct_work_run_id, second.run_id);
}

#[test]
fn run_link_model_has_no_raw_prompt_output_final_response_or_diff_fields() {
    let link = AgentQueueTaskRunLink {
        link_id: AgentQueueTaskRunLinkId("link-1".to_owned()),
        workspace_id: "workspace-1".to_owned(),
        queue_task_id: "task-1".to_owned(),
        executor_widget_id: "executor-1".to_owned(),
        direct_work_run_id: "run-1".to_owned(),
        source: AgentQueueTaskRunSource::Manual,
        status: AgentQueueTaskRunStatus::Running,
        started_at: "1".to_owned(),
        completed_at: None,
        validation_status: None,
        review_status: None,
        created_at: "1".to_owned(),
        updated_at: "1".to_owned(),
    };

    assert_eq!(link.direct_work_run_id, "run-1");
    assert_eq!(link.validation_status, None);
    assert_eq!(link.review_status, None);
}

#[test]
fn manual_and_autorun_sources_are_represented() {
    assert_eq!(AgentQueueTaskRunSource::Manual.as_str(), "manual");
    assert_eq!(AgentQueueTaskRunSource::Autorun.as_str(), "autorun");
    assert_eq!(
        AgentQueueTaskRunSource::SequentialRunner.as_str(),
        "sequential_runner"
    );
    assert_eq!(AgentQueueTaskRunSource::Unknown.as_str(), "unknown");
}

fn add_executor(service: &WorkspaceService) -> (String, String, String) {
    let workspace = service
        .create_empty_workspace("Queue run link workspace", None)
        .expect("create workspace");
    let workbench_id = workspace
        .workbench_id
        .as_deref()
        .expect("workbench id")
        .to_owned();
    let executor_id = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            AGENT_RUN_WIDGET_DEFINITION_ID,
            "Agent Executor",
            "agent",
        )
        .expect("add executor")
        .expect("state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == "Agent Executor")
        .expect("executor")
        .id;

    (workspace.id, workbench_id, executor_id)
}

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    status: &str,
    prompt: &str,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: "Queue task".to_owned(),
            description: String::new(),
            prompt: prompt.to_owned(),
            status: status.to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task")
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
