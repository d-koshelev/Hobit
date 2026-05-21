use hobit_app::AgentQueueTaskSummary;

use crate::agent_queue_task_dto::{
    AgentQueueTaskDto, AssignAgentQueueTaskToExecutorRequest, ClearAgentQueueTaskAssignmentRequest,
    CreateAgentQueueTaskRequest, DeleteAgentQueueTaskRequest, UpdateAgentQueueTaskRequest,
};

#[test]
fn maps_create_agent_queue_task_request_to_app_input() {
    let request = CreateAgentQueueTaskRequest {
        workspace_id: "ws_1".to_owned(),
        title: "Task".to_owned(),
        description: "Description".to_owned(),
        prompt: "Prompt".to_owned(),
        status: "queued".to_owned(),
        priority: 3,
        execution_policy: Some("auto".to_owned()),
    };

    let input: hobit_app::CreateAgentQueueTaskInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.title, "Task");
    assert_eq!(input.description, "Description");
    assert_eq!(input.prompt, "Prompt");
    assert_eq!(input.status, "queued");
    assert_eq!(input.priority, 3);
    assert_eq!(input.execution_policy.as_deref(), Some("auto"));
}

#[test]
fn maps_update_agent_queue_task_request_to_app_input() {
    let request = UpdateAgentQueueTaskRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
        title: "Updated".to_owned(),
        description: "Updated description".to_owned(),
        prompt: "Updated prompt".to_owned(),
        status: "running".to_owned(),
        priority: 4,
        execution_policy: Some("after_previous_success".to_owned()),
    };

    let input: hobit_app::UpdateAgentQueueTaskInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
    assert_eq!(input.title, "Updated");
    assert_eq!(input.description, "Updated description");
    assert_eq!(input.prompt, "Updated prompt");
    assert_eq!(input.status, "running");
    assert_eq!(input.priority, 4);
    assert_eq!(
        input.execution_policy.as_deref(),
        Some("after_previous_success")
    );
}

#[test]
fn maps_assign_agent_queue_task_to_executor_request_to_app_input() {
    let request = AssignAgentQueueTaskToExecutorRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
        executor_widget_instance_id: "executor_1".to_owned(),
    };

    let input: hobit_app::AssignAgentQueueTaskToExecutorInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
    assert_eq!(input.executor_widget_instance_id, "executor_1");
}

#[test]
fn maps_clear_agent_queue_task_assignment_request_to_app_input() {
    let request = ClearAgentQueueTaskAssignmentRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
    };

    let input: hobit_app::ClearAgentQueueTaskAssignmentInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
}

#[test]
fn maps_delete_agent_queue_task_request_to_app_input() {
    let request = DeleteAgentQueueTaskRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
    };

    let input: hobit_app::DeleteAgentQueueTaskInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
}

#[test]
fn maps_agent_queue_task_summary_to_dto() {
    let summary = AgentQueueTaskSummary {
        queue_item_id: "task_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        title: "Task".to_owned(),
        description: "Description".to_owned(),
        prompt: "Prompt".to_owned(),
        status: "running".to_owned(),
        priority: 3,
        execution_policy: "manual".to_owned(),
        assigned_executor_widget_id: Some("executor_1".to_owned()),
        created_at: "1".to_owned(),
        updated_at: "2".to_owned(),
    };

    let dto = AgentQueueTaskDto::from(summary);

    assert_eq!(dto.queue_item_id, "task_1");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.title, "Task");
    assert_eq!(dto.description, "Description");
    assert_eq!(dto.prompt, "Prompt");
    assert_eq!(dto.status, "running");
    assert_eq!(dto.priority, 3);
    assert_eq!(dto.execution_policy, "manual");
    assert_eq!(
        dto.assigned_executor_widget_id.as_deref(),
        Some("executor_1")
    );
    assert_eq!(dto.created_at, "1");
    assert_eq!(dto.updated_at, "2");
}
