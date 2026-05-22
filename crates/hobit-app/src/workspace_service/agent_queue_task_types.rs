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
pub struct DeleteAgentQueueTaskInput {
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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskRunLinkId(pub String);

impl AgentQueueTaskRunLinkId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentQueueTaskRunSource {
    Manual,
    Autorun,
    SequentialRunner,
    Unknown,
}

impl AgentQueueTaskRunSource {
    pub fn from_current_source(value: &str) -> Self {
        match value {
            "manual" => Self::Manual,
            "autorun" => Self::Autorun,
            "sequential_runner" => Self::SequentialRunner,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Autorun => "autorun",
            Self::SequentialRunner => "sequential_runner",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentQueueTaskRunStatus {
    Running,
    Completed,
    Failed,
    TimedOut,
    Cancelled,
    ReviewNeeded,
    Unknown,
}

impl AgentQueueTaskRunStatus {
    pub fn from_current_status(value: &str) -> Self {
        match value {
            "running" => Self::Running,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            "timed_out" => Self::TimedOut,
            "cancelled" => Self::Cancelled,
            "review_needed" => Self::ReviewNeeded,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::TimedOut => "timed_out",
            Self::Cancelled => "cancelled",
            Self::ReviewNeeded => "review_needed",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentQueueTaskRunReviewStatus {
    ReviewNeeded,
    Unknown,
}

impl AgentQueueTaskRunReviewStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ReviewNeeded => "review_needed",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecordAgentQueueTaskRunStartedInput {
    pub workspace_id: String,
    pub queue_task_id: String,
    pub executor_widget_id: String,
    pub direct_work_run_id: String,
    pub source: AgentQueueTaskRunSource,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecordAgentQueueTaskRunFinalStatusInput {
    pub workspace_id: String,
    pub queue_task_id: String,
    pub executor_widget_id: String,
    pub direct_work_run_id: String,
    pub status: String,
    pub completed_at: Option<String>,
    pub validation_status: Option<String>,
    pub review_status: Option<AgentQueueTaskRunReviewStatus>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskRunLink {
    pub link_id: AgentQueueTaskRunLinkId,
    pub workspace_id: String,
    pub queue_task_id: String,
    pub executor_widget_id: String,
    pub direct_work_run_id: String,
    pub source: AgentQueueTaskRunSource,
    pub status: AgentQueueTaskRunStatus,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub validation_status: Option<String>,
    pub review_status: Option<AgentQueueTaskRunReviewStatus>,
    pub created_at: String,
    pub updated_at: String,
}

pub type AgentQueueTaskRunSummary = AgentQueueTaskRunLink;
