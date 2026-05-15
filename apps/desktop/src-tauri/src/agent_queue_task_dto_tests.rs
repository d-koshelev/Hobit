use hobit_app::AgentQueueTaskSummary;

use crate::agent_queue_task_dto::{
    AgentQueueTaskDto, CreateAgentQueueTaskRequest, UpdateAgentQueueTaskRequest,
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
    };

    let input: hobit_app::CreateAgentQueueTaskInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.title, "Task");
    assert_eq!(input.description, "Description");
    assert_eq!(input.prompt, "Prompt");
    assert_eq!(input.status, "queued");
    assert_eq!(input.priority, 3);
}

#[test]
fn maps_update_agent_queue_task_request_to_app_input() {
    let request = UpdateAgentQueueTaskRequest {
        workspace_id: "ws_1".to_owned(),
        queue_item_id: "task_1".to_owned(),
        title: "Updated".to_owned(),
        description: "Updated description".to_owned(),
        prompt: "Updated prompt".to_owned(),
        status: "completed".to_owned(),
        priority: 4,
    };

    let input: hobit_app::UpdateAgentQueueTaskInput = request.into();

    assert_eq!(input.workspace_id, "ws_1");
    assert_eq!(input.queue_item_id, "task_1");
    assert_eq!(input.title, "Updated");
    assert_eq!(input.description, "Updated description");
    assert_eq!(input.prompt, "Updated prompt");
    assert_eq!(input.status, "completed");
    assert_eq!(input.priority, 4);
}

#[test]
fn maps_agent_queue_task_summary_to_dto() {
    let summary = AgentQueueTaskSummary {
        queue_item_id: "task_1".to_owned(),
        workspace_id: "ws_1".to_owned(),
        title: "Task".to_owned(),
        description: "Description".to_owned(),
        prompt: "Prompt".to_owned(),
        status: "queued".to_owned(),
        priority: 3,
        created_at: "1".to_owned(),
        updated_at: "2".to_owned(),
    };

    let dto = AgentQueueTaskDto::from(summary);

    assert_eq!(dto.queue_item_id, "task_1");
    assert_eq!(dto.workspace_id, "ws_1");
    assert_eq!(dto.title, "Task");
    assert_eq!(dto.description, "Description");
    assert_eq!(dto.prompt, "Prompt");
    assert_eq!(dto.status, "queued");
    assert_eq!(dto.priority, 3);
    assert_eq!(dto.created_at, "1");
    assert_eq!(dto.updated_at, "2");
}
