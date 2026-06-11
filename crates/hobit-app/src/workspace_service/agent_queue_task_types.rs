#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateAgentQueueTaskInput {
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    pub depends_on: Option<Vec<String>>,
    pub execution_policy: Option<String>,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
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
    pub depends_on: Option<Vec<String>>,
    pub execution_policy: Option<String>,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttachKnowledgeToQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub knowledge_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DetachKnowledgeFromQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub knowledge_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttachSkillToQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub skill_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DetachSkillFromQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub skill_id: String,
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
pub struct AgentQueueValidationCommandSpecInput {
    pub command_id: String,
    pub title: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: std::path::PathBuf,
    pub timeout_ms: Option<u64>,
    pub stdout_cap_bytes: Option<usize>,
    pub stderr_cap_bytes: Option<usize>,
    pub allowed_exit_codes: Vec<i32>,
    pub safety_category: String,
    pub source: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunAgentQueueValidationSuiteInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub requested_by_surface: String,
    pub cwd: std::path::PathBuf,
    pub commands: Vec<AgentQueueValidationCommandSpecInput>,
    pub stop_on_first_failure: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueValidationCommandRunSummary {
    pub command_id: String,
    pub title: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub allowed_exit_codes: Vec<i32>,
    pub cwd: String,
    pub stdout_preview: String,
    pub stderr_preview: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueValidationCommandEvidenceSummary {
    pub evidence_id: String,
    pub validation_run_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub command_id: String,
    pub command_label: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout_preview: String,
    pub stderr_preview: String,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub duration_ms: u128,
    pub error_message: Option<String>,
    pub command_summary: Vec<String>,
    pub source: String,
    pub no_git_mutations: bool,
    pub no_commit_push: bool,
    pub ai_context_status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueValidationSuiteRunSummary {
    pub validation_run_id: String,
    pub workspace_id: String,
    pub queue_item_id: String,
    pub requested_by_surface: String,
    pub status: String,
    pub task_validation_status: String,
    pub command_results: Vec<AgentQueueValidationCommandRunSummary>,
    pub evidence: Vec<AgentQueueValidationCommandEvidenceSummary>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub duration_ms: u128,
    pub no_git_mutations: bool,
    pub no_commit_push: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StartAssignedAgentQueueTaskInput {
    pub workspace_id: String,
    pub queue_item_id: String,
    pub queue_owner_widget_instance_id: Option<String>,
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
    pub depends_on: Vec<String>,
    pub execution_policy: String,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
    pub context_json: Option<String>,
    pub assigned_executor_widget_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateAgentQueueWorkerInput {
    pub workspace_id: String,
    pub worker_id: Option<String>,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    pub queue_tag_id: Option<String>,
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateAgentQueueWorkerInput {
    pub workspace_id: String,
    pub worker_id: String,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    pub queue_tag_id: Option<String>,
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeleteAgentQueueWorkerInput {
    pub workspace_id: String,
    pub worker_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkerSummary {
    pub worker_id: String,
    pub workspace_id: String,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    pub queue_tag_id: Option<String>,
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
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
