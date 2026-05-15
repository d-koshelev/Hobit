#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateAgentQueueTaskInput {
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateAgentQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssignAgentQueueTaskToExecutorInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub executor_widget_instance_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClearAgentQueueTaskAssignmentInput {
    pub workspace_id: String,
    pub queue_item_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskSummary {
    pub queue_item_id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    pub assigned_executor_widget_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
