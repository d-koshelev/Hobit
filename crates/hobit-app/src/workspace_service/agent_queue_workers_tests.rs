use super::*;

use crate::{
    AssignAgentQueueTaskToExecutorInput, CreateAgentQueueTaskInput, CreateAgentQueueWorkerInput,
    DeleteAgentQueueWorkerInput, UpdateAgentQueueWorkerInput,
};

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

#[test]
fn agent_queue_worker_config_crud_is_workspace_scoped() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "worker-crud");

    let created = service
        .create_agent_queue_worker(CreateAgentQueueWorkerInput {
            workspace_id: workspace.id.clone(),
            worker_id: Some("worker-1".to_owned()),
            name: "Agent Worker 1".to_owned(),
            enabled: true,
            scope_kind: "all".to_owned(),
            queue_tag_id: None,
            queue_tag_name: None,
            display_order: 0,
        })
        .expect("create worker");

    assert_eq!(created.worker_id, "worker-1");
    assert_eq!(created.scope_kind, "all");

    let updated = service
        .update_agent_queue_worker(UpdateAgentQueueWorkerInput {
            workspace_id: workspace.id.clone(),
            worker_id: "worker-1".to_owned(),
            name: "Review Worker".to_owned(),
            enabled: false,
            scope_kind: "queue_tag".to_owned(),
            queue_tag_id: Some("review".to_owned()),
            queue_tag_name: Some("Review".to_owned()),
            display_order: 2,
        })
        .expect("update worker")
        .expect("updated worker");

    assert_eq!(updated.name, "Review Worker");
    assert!(!updated.enabled);
    assert_eq!(updated.queue_tag_id.as_deref(), Some("review"));

    let workers = service
        .list_agent_queue_workers(&workspace.id)
        .expect("list workers");
    assert_eq!(workers.len(), 1);
    assert_eq!(workers[0].display_order, 2);

    assert!(service
        .delete_agent_queue_worker(DeleteAgentQueueWorkerInput {
            workspace_id: workspace.id.clone(),
            worker_id: "worker-1".to_owned(),
        })
        .expect("delete worker"));
}

#[test]
fn deleting_worker_assigned_to_queue_task_is_blocked() {
    let service = initialized_service();
    let workspace = create_workspace(&service, "worker-delete-assigned");
    let workbench_id = workspace.workbench_id.expect("workbench id");
    let executor_widget_id = service
        .add_widget_instance_to_workbench(
            &workspace.id,
            &workbench_id,
            "agent-run",
            "Agent Executor",
            "workflow",
        )
        .expect("add executor")
        .expect("state")
        .widget_instances
        .into_iter()
        .find(|widget| widget.title == "Agent Executor")
        .expect("executor widget")
        .id;
    service
        .create_agent_queue_worker(CreateAgentQueueWorkerInput {
            workspace_id: workspace.id.clone(),
            worker_id: Some(executor_widget_id.clone()),
            name: "Agent Worker 1".to_owned(),
            enabled: true,
            scope_kind: "all".to_owned(),
            queue_tag_id: None,
            queue_tag_name: None,
            display_order: 0,
        })
        .expect("create worker");
    let task = service
        .create_agent_queue_task(CreateAgentQueueTaskInput {
            workspace_id: workspace.id.clone(),
            title: "Task".to_owned(),
            description: String::new(),
            prompt: "Do work".to_owned(),
            status: "queued".to_owned(),
            priority: 0,
            depends_on: None,
            execution_policy: Some("manual".to_owned()),
            execution_workspace: None,
            codex_executable: None,
            sandbox: None,
            approval_policy: None,
        })
        .expect("create task");
    service
        .assign_agent_queue_task_to_executor(AssignAgentQueueTaskToExecutorInput {
            workspace_id: workspace.id.clone(),
            queue_item_id: task.queue_item_id,
            executor_widget_instance_id: executor_widget_id.clone(),
        })
        .expect("assign task");

    let result = service.delete_agent_queue_worker(DeleteAgentQueueWorkerInput {
        workspace_id: workspace.id,
        worker_id: executor_widget_id,
    });

    assert!(result
        .expect_err("assigned worker delete should fail")
        .to_string()
        .contains("worker is assigned"));
}
