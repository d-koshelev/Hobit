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
pub struct AgentQueueTaskSummary {
    pub queue_item_id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    pub created_at: String,
    pub updated_at: String,
}
