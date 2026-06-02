use super::*;

use hobit_storage_sqlite::{NewWidgetLog, NewWidgetResult, NewWidgetRun};

fn initialized_service() -> WorkspaceService {
    let store = SqliteStore::open_in_memory().expect("open in-memory sqlite");
    store.init_schema().expect("initialize schema");
    WorkspaceService::new(store)
}

fn create_workspace(service: &WorkspaceService, title: &str) -> WorkspaceSummary {
    service
        .create_empty_workspace(title, None)
        .expect("create workspace")
}

fn create_task(
    service: &WorkspaceService,
    workspace_id: &str,
    title: &str,
    status: &str,
    priority: i64,
) -> AgentQueueTaskSummary {
    service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace_id.to_owned(),
            title: title.to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: status.to_owned(),
            priority,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task")
}

fn add_widget(
    service: &WorkspaceService,
    workspace: &WorkspaceSummary,
    definition_id: &str,
    title: &str,
) -> String {
    service
        .add_widget_instance_to_workbench(
            &workspace.id,
            workspace.workbench_id.as_deref().expect("workbench id"),
            definition_id,
            title,
            "agent",
        )
        .expect("add widget")
        .expect("updated state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == title)
        .expect("added widget")
        .id
}

#[test]
fn create_list_get_and_update_agent_queue_task() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let task = create_task(&service, &workspace.id, "Review API", "queued", 3);

    assert_eq!(task.workspace_id, workspace.id);
    assert_eq!(task.title, "Review API");
    assert_eq!(task.description, "Description");
    assert_eq!(task.prompt, "Prompt");
    assert_eq!(task.status, "queued");
    assert_eq!(task.priority, 3);
    assert_eq!(task.execution_policy, "manual");
    assert_eq!(task.assigned_executor_widget_id, None);
    assert!(!task.created_at.is_empty());
    assert_eq!(task.created_at, task.updated_at);

    let listed = service
        .list_agent_queue_tasks(&workspace.id)
        .expect("list queue tasks");
    assert_eq!(listed, vec![task.clone()]);

    let fetched = service
        .get_agent_queue_task(&workspace.id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    assert_eq!(fetched, task);

    std::thread::sleep(std::time::Duration::from_millis(1));

    let updated = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            title: "Updated API review".to_owned(),
            description: "Updated description".to_owned(),
            prompt: "Updated prompt".to_owned(),
            status: "running".to_owned(),
            priority: 4,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(updated.title, "Updated API review");
    assert_eq!(updated.description, "Updated description");
    assert_eq!(updated.prompt, "Updated prompt");
    assert_eq!(updated.status, "running");
    assert_eq!(updated.priority, 4);
    assert_eq!(updated.execution_policy, "manual");
    assert_eq!(updated.assigned_executor_widget_id, None);
    assert_ne!(updated.updated_at, task.updated_at);
}

#[test]
fn agent_queue_task_execution_policy_defaults_persists_updates_and_validates() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let created = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Policy task".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: Some("auto".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create queue task");

    assert_eq!(created.execution_policy, "auto");

    let preserved = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: created.queue_item_id.clone(),
            title: "Policy task preserved".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(preserved.execution_policy, "auto");

    let changed = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: created.queue_item_id,
            title: "Policy task changed".to_owned(),
            description: "Description".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 2,
            execution_policy: Some("after_previous_success".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update queue task")
        .expect("updated queue task");

    assert_eq!(changed.execution_policy, "after_previous_success");

    let invalid = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id,
            title: "Invalid policy".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: Some("when_ready".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("invalid execution policy rejected");

    assert!(invalid
        .to_string()
        .contains("unsupported queue task execution policy: when_ready"));
}

#[test]
fn create_agent_queue_task_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: "missing-workspace".to_owned(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn list_agent_queue_tasks_rejects_unknown_workspace() {
    let service = initialized_service();

    let error = service
        .list_agent_queue_tasks("missing-workspace")
        .expect_err("unknown workspace rejected");

    assert!(error
        .to_string()
        .contains("workspace not found: missing-workspace"));
}

#[test]
fn get_and_update_agent_queue_task_reject_cross_workspace_access() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let task = create_task(&service, &first.id, "First task", "queued", 2);

    let get_error = service
        .get_agent_queue_task(&second.id, &task.queue_item_id)
        .expect_err("cross-workspace get rejected");
    assert!(get_error.to_string().contains("queue task does not belong"));

    let update_error = service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: second.id,
            queue_item_id: task.queue_item_id,
            title: "Other".to_owned(),
            description: "Other description".to_owned(),
            prompt: "Other prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("cross-workspace update rejected");
    assert!(update_error
        .to_string()
        .contains("queue task does not belong"));
}

#[test]
fn get_and_update_unknown_agent_queue_task_returns_none() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    assert!(service
        .get_agent_queue_task(&workspace.id, "missing-task")
        .expect("get unknown queue task")
        .is_none());
    assert!(service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id,
            queue_item_id: "missing-task".to_owned(),
            title: "Missing".to_owned(),
            description: "".to_owned(),
            prompt: "".to_owned(),
            status: "draft".to_owned(),
            priority: 0,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update unknown queue task")
        .is_none());
}

#[test]
fn create_agent_queue_task_rejects_empty_title_invalid_status_and_priority() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let empty_title = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "  ".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("empty title rejected");
    assert!(empty_title
        .to_string()
        .contains("queue task title must not be empty"));

    let invalid_status = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "blocked".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("invalid status rejected");
    assert!(invalid_status
        .to_string()
        .contains("unsupported queue task status: blocked"));

    let invalid_priority = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id,
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "Prompt".to_owned(),
            status: "queued".to_owned(),
            priority: 9,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("invalid priority rejected");
    assert!(invalid_priority
        .to_string()
        .contains("queue task priority must be between 0 and 5"));
}

#[test]
fn non_draft_agent_queue_task_rejects_empty_prompt() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let error = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id,
            title: "Task".to_owned(),
            description: "".to_owned(),
            prompt: "  ".to_owned(),
            status: "queued".to_owned(),
            priority: 1,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect_err("empty prompt rejected");

    assert!(error
        .to_string()
        .contains("queue task prompt must not be empty unless status is draft"));
}

#[test]
fn assign_agent_queue_task_to_executor_validates_slot_and_keeps_task_non_running() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id, "Assignable", "queued", 2);
    let executor_id = add_widget(
        &service,
        &workspace,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Executor",
    );
    let logs_before = service
        .store
        .list_widget_logs_for_widget(&executor_id, 100)
        .expect("list logs before assignment");

    std::thread::sleep(std::time::Duration::from_millis(1));

    let assigned = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id.clone(),
        })
        .expect("assign queue task");

    assert_eq!(
        assigned.assigned_executor_widget_id.as_deref(),
        Some(executor_id.as_str())
    );
    assert_eq!(assigned.status, "queued");
    assert_ne!(assigned.updated_at, task.updated_at);
    assert!(service
        .store
        .list_widget_runs_for_widget(&executor_id)
        .expect("list executor runs")
        .is_empty());
    assert_eq!(
        service
            .store
            .list_widget_logs_for_widget(&executor_id, 100)
            .expect("list logs after assignment"),
        logs_before
    );
}

#[test]
fn clear_agent_queue_task_assignment_clears_slot_without_status_change() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id, "Assignable", "review_needed", 2);
    let executor_id = add_widget(
        &service,
        &workspace,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Executor",
    );
    let assigned = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id,
        })
        .expect("assign queue task");

    let cleared = service
        .clear_agent_queue_task_assignment(ClearAgentQueueTaskAssignmentInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
        })
        .expect("clear assignment");

    assert!(assigned.assigned_executor_widget_id.is_some());
    assert_eq!(cleared.assigned_executor_widget_id, None);
    assert_eq!(cleared.status, "review_needed");
    assert_ne!(cleared.updated_at, assigned.updated_at);
}

#[test]
fn running_agent_queue_task_status_is_supported_as_data() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");

    let task = create_task(&service, &workspace.id, "Running task", "running", 2);

    assert_eq!(task.status, "running");
    let listed = service
        .list_agent_queue_tasks(&workspace.id)
        .expect("list queue tasks");
    assert_eq!(listed[0].status, "running");
    let fetched = service
        .get_agent_queue_task(&workspace.id, &task.queue_item_id)
        .expect("get queue task")
        .expect("queue task");
    assert_eq!(fetched.status, "running");
}

#[test]
fn assign_agent_queue_task_to_executor_rejects_non_executor_and_unknown_widget() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let task = create_task(&service, &workspace.id, "Assignable", "queued", 2);
    let notes_widget_id = add_widget(&service, &workspace, "notes", "Notes");

    let non_executor = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
            executor_widget_instance_id: notes_widget_id,
        })
        .expect_err("non-executor rejected");
    assert!(non_executor
        .to_string()
        .contains("assigned widget is not an Agent Executor"));

    let unknown_executor = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id,
            queue_item_id: task.queue_item_id,
            executor_widget_instance_id: "missing-widget".to_owned(),
        })
        .expect_err("unknown executor rejected");
    assert!(unknown_executor
        .to_string()
        .contains("executor widget not found: missing-widget"));
}

#[test]
fn assign_agent_queue_task_to_executor_rejects_cross_workspace_target() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let task = create_task(&service, &first.id, "Assignable", "ready", 2);
    let other_executor_id = add_widget(
        &service,
        &second,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Other Executor",
    );

    let error = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: first.id,
            queue_item_id: task.queue_item_id,
            executor_widget_instance_id: other_executor_id,
        })
        .expect_err("cross-workspace executor rejected");

    assert!(error
        .to_string()
        .contains("executor widget does not belong to workspace"));
}

#[test]
fn assign_agent_queue_task_to_executor_rejects_unknown_task_and_cross_workspace_task() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let task = create_task(&service, &first.id, "Assignable", "draft", 2);
    let executor_id = add_widget(&service, &first, AGENT_RUN_WIDGET_DEFINITION_ID, "Executor");

    let unknown_task = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: first.id.clone(),
            queue_item_id: "missing-task".to_owned(),
            executor_widget_instance_id: executor_id.clone(),
        })
        .expect_err("unknown task rejected");
    assert!(unknown_task
        .to_string()
        .contains("queue task not found: missing-task"));

    let cross_workspace_task = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: second.id,
            queue_item_id: task.queue_item_id,
            executor_widget_instance_id: executor_id,
        })
        .expect_err("cross-workspace task rejected");
    assert!(cross_workspace_task
        .to_string()
        .contains("queue task does not belong to workspace"));
}

#[test]
fn assign_agent_queue_task_to_executor_rejects_final_statuses() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let executor_id = add_widget(
        &service,
        &workspace,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Executor",
    );

    for status in ["completed", "failed", "cancelled"] {
        let task = create_task(&service, &workspace.id, status, status, 1);
        let error = service
            .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
                workspace_id: workspace.id.clone(),
                queue_item_id: task.queue_item_id,
                executor_widget_instance_id: executor_id.clone(),
            })
            .expect_err("final status rejected");

        assert!(error
            .to_string()
            .contains(&format!("queue task status cannot be assigned: {status}")));
    }
}

#[test]
fn running_task_assignment_and_clear_assignment_are_rejected() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let executor_id = add_widget(
        &service,
        &workspace,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Executor",
    );
    let running_task = create_task(&service, &workspace.id, "Running", "running", 1);

    let assign_error = service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: running_task.queue_item_id,
            executor_widget_instance_id: executor_id.clone(),
        })
        .expect_err("running status rejected for assignment");

    assert!(assign_error
        .to_string()
        .contains("queue task status cannot be assigned: running"));

    let assigned_task = create_task(&service, &workspace.id, "Assigned", "queued", 1);
    service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: assigned_task.queue_item_id.clone(),
            executor_widget_instance_id: executor_id,
        })
        .expect("assign queued task");
    service
        .update_agent_queue_task(UpdateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: assigned_task.queue_item_id.clone(),
            title: assigned_task.title,
            description: assigned_task.description,
            prompt: assigned_task.prompt,
            status: "running".to_owned(),
            priority: assigned_task.priority,
            execution_policy: None,
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("update to running")
        .expect("updated task");

    let clear_error = service
        .clear_agent_queue_task_assignment(ClearAgentQueueTaskAssignmentInput {
            workspace_id: workspace.id,
            queue_item_id: assigned_task.queue_item_id,
        })
        .expect_err("running status rejected for assignment clearing");

    assert!(clear_error
        .to_string()
        .contains("queue task assignment cannot be cleared while status is running"));
}

#[test]
fn delete_agent_queue_task_removes_task_without_deleting_executor_artifacts() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "Queue workspace");
    let executor_id = add_widget(
        &service,
        &workspace,
        AGENT_RUN_WIDGET_DEFINITION_ID,
        "Executor",
    );
    let task = create_task(&service, &workspace.id, "Delete me", "queued", 1);
    insert_widget_artifacts(&service, &executor_id);

    let deleted = service
        .delete_agent_queue_task(DeleteAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id.clone(),
        })
        .expect("delete queue task");

    assert!(deleted);
    assert!(service
        .get_agent_queue_task(&workspace.id, &task.queue_item_id)
        .expect("get deleted queue task")
        .is_none());
    assert!(service
        .store
        .get_widget_run("run-queue-delete")
        .expect("get executor run")
        .is_some());
    assert!(service
        .store
        .get_widget_result("result-queue-delete")
        .expect("get executor result")
        .is_some());
    assert!(service
        .store
        .get_widget_log("log-queue-delete")
        .expect("get executor log")
        .is_some());
}

#[test]
fn delete_agent_queue_task_rejects_running_and_cross_workspace_tasks() {
    let service = initialized_service();
    let first = create_workspace(&service, "First workspace");
    let second = create_workspace(&service, "Second workspace");
    let running_task = create_task(&service, &first.id, "Running", "running", 1);
    let other_task = create_task(&service, &first.id, "Other", "queued", 1);

    let running_error = service
        .delete_agent_queue_task(DeleteAgentQueueTaskInput {
            workspace_id: first.id.clone(),
            queue_item_id: running_task.queue_item_id,
        })
        .expect_err("running delete rejected");
    assert!(running_error
        .to_string()
        .contains("queue task cannot be deleted while status is running"));

    let cross_workspace_error = service
        .delete_agent_queue_task(DeleteAgentQueueTaskInput {
            workspace_id: second.id,
            queue_item_id: other_task.queue_item_id.clone(),
        })
        .expect_err("cross-workspace delete rejected");
    assert!(cross_workspace_error
        .to_string()
        .contains("queue task does not belong to workspace"));

    assert!(
        service
            .delete_agent_queue_task(DeleteAgentQueueTaskInput {
                workspace_id: first.id,
                queue_item_id: "missing-task".to_owned(),
            })
            .expect("unknown delete returns false")
            == false
    );
}

fn insert_widget_artifacts(service: &WorkspaceService, widget_id: &str) {
    service
        .store
        .insert_widget_run(NewWidgetRun {
            id: "run-queue-delete",
            widget_instance_id: widget_id,
            status: "completed",
            command_kind: Some("direct_work"),
            command_payload: Some("{}"),
            started_at: Some("1"),
            finished_at: Some("2"),
            summary: Some("Completed"),
        })
        .expect("insert widget run");
    service
        .store
        .insert_widget_result(NewWidgetResult {
            id: "result-queue-delete",
            run_id: "run-queue-delete",
            status: "completed",
            result_type: Some("direct_work_result"),
            summary: Some("Result"),
            content: Some("content"),
            payload: Some("{}"),
            created_at: Some("2"),
        })
        .expect("insert widget result");
    service
        .store
        .append_widget_log(NewWidgetLog {
            id: "log-queue-delete",
            widget_instance_id: widget_id,
            run_id: Some("run-queue-delete"),
            level: "info",
            message: "Run log",
            created_at: Some("2"),
            details: None,
        })
        .expect("append widget log");
}
