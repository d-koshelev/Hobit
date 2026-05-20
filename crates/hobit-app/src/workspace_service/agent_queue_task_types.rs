#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateAgentQueueTaskInput {
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    pub execution_policy: Option<String>,
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
    pub execution_policy: Option<String>,
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
pub struct StartAssignedAgentQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub codex_executable: String,
    pub repo_root: std::path::PathBuf,
    pub sandbox: String,
    pub approval_policy: String,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FinishAssignedAgentQueueTaskRunInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub executor_widget_instance_id: String,
    pub run_id: String,
    pub direct_work_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssignedAgentQueueTaskRunPlan {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub workbench_id: String,
    pub executor_widget_instance_id: String,
    pub direct_work_input: super::RunCodexDirectWorkInput,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssignedAgentQueueTaskStartSummary {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub workbench_id: String,
    pub executor_widget_instance_id: String,
    pub run_id: String,
    pub status: String,
    pub direct_work_input: super::RunCodexDirectWorkInput,
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
    pub execution_policy: String,
    pub assigned_executor_widget_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
