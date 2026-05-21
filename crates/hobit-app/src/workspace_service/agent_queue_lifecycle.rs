use crate::WorkspaceServiceError;

pub(super) const AGENT_QUEUE_TASK_STATUS_DRAFT: &str = "draft";
pub(super) const AGENT_QUEUE_TASK_STATUS_QUEUED: &str = "queued";
pub(super) const AGENT_QUEUE_TASK_STATUS_READY: &str = "ready";
pub(super) const AGENT_QUEUE_TASK_STATUS_RUNNING: &str = "running";
pub(super) const AGENT_QUEUE_TASK_STATUS_COMPLETED: &str = "completed";
pub(super) const AGENT_QUEUE_TASK_STATUS_FAILED: &str = "failed";
pub(super) const AGENT_QUEUE_TASK_STATUS_CANCELLED: &str = "cancelled";
pub(super) const AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED: &str = "review_needed";

pub(super) const AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL: &str = "manual";
pub(super) const AGENT_QUEUE_TASK_EXECUTION_POLICY_AUTO: &str = "auto";
pub(super) const AGENT_QUEUE_TASK_EXECUTION_POLICY_AFTER_PREVIOUS_SUCCESS: &str =
    "after_previous_success";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum AgentQueueTaskLifecycleStatus {
    Draft,
    Queued,
    Ready,
    Running,
    Completed,
    Failed,
    Cancelled,
    ReviewNeeded,
}

impl AgentQueueTaskLifecycleStatus {
    pub(super) fn from_current_status(value: &str) -> Option<Self> {
        match value {
            AGENT_QUEUE_TASK_STATUS_DRAFT => Some(Self::Draft),
            AGENT_QUEUE_TASK_STATUS_QUEUED => Some(Self::Queued),
            AGENT_QUEUE_TASK_STATUS_READY => Some(Self::Ready),
            AGENT_QUEUE_TASK_STATUS_RUNNING => Some(Self::Running),
            AGENT_QUEUE_TASK_STATUS_COMPLETED => Some(Self::Completed),
            AGENT_QUEUE_TASK_STATUS_FAILED => Some(Self::Failed),
            AGENT_QUEUE_TASK_STATUS_CANCELLED => Some(Self::Cancelled),
            AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED => Some(Self::ReviewNeeded),
            _ => None,
        }
    }

    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Draft => AGENT_QUEUE_TASK_STATUS_DRAFT,
            Self::Queued => AGENT_QUEUE_TASK_STATUS_QUEUED,
            Self::Ready => AGENT_QUEUE_TASK_STATUS_READY,
            Self::Running => AGENT_QUEUE_TASK_STATUS_RUNNING,
            Self::Completed => AGENT_QUEUE_TASK_STATUS_COMPLETED,
            Self::Failed => AGENT_QUEUE_TASK_STATUS_FAILED,
            Self::Cancelled => AGENT_QUEUE_TASK_STATUS_CANCELLED,
            Self::ReviewNeeded => AGENT_QUEUE_TASK_STATUS_REVIEW_NEEDED,
        }
    }

    pub(super) fn requires_prompt(self) -> bool {
        self != Self::Draft
    }

    pub(super) fn allows_assignment(self) -> bool {
        !self.is_terminal() && self != Self::Running
    }

    pub(super) fn allows_assignment_clear(self) -> bool {
        self != Self::Running
    }

    pub(super) fn allows_explicit_assigned_start(self) -> bool {
        matches!(self, Self::Queued | Self::Ready | Self::ReviewNeeded)
    }

    pub(super) fn allows_deletion(self) -> bool {
        self != Self::Running
    }

    pub(super) fn is_terminal(self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::Cancelled)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum AgentQueueTaskExecutionPolicy {
    Manual,
    Auto,
    AfterPreviousSuccess,
}

impl AgentQueueTaskExecutionPolicy {
    pub(super) fn from_current_policy(value: &str) -> Option<Self> {
        match value {
            AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL => Some(Self::Manual),
            AGENT_QUEUE_TASK_EXECUTION_POLICY_AUTO => Some(Self::Auto),
            AGENT_QUEUE_TASK_EXECUTION_POLICY_AFTER_PREVIOUS_SUCCESS => {
                Some(Self::AfterPreviousSuccess)
            }
            _ => None,
        }
    }

    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Manual => AGENT_QUEUE_TASK_EXECUTION_POLICY_MANUAL,
            Self::Auto => AGENT_QUEUE_TASK_EXECUTION_POLICY_AUTO,
            Self::AfterPreviousSuccess => AGENT_QUEUE_TASK_EXECUTION_POLICY_AFTER_PREVIOUS_SUCCESS,
        }
    }

    pub(super) fn default_for_new_task() -> Self {
        Self::Manual
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum AgentQueueExecutionLifecycleStatus {
    Started,
}

impl AgentQueueExecutionLifecycleStatus {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Started => "started",
        }
    }
}

pub(super) fn map_direct_work_final_status_to_queue_status(
    direct_work_status: &str,
) -> Result<AgentQueueTaskLifecycleStatus, WorkspaceServiceError> {
    match direct_work_status {
        AGENT_QUEUE_TASK_STATUS_COMPLETED => Ok(AgentQueueTaskLifecycleStatus::Completed),
        AGENT_QUEUE_TASK_STATUS_CANCELLED => Ok(AgentQueueTaskLifecycleStatus::Cancelled),
        AGENT_QUEUE_TASK_STATUS_FAILED | "timed_out" => Ok(AgentQueueTaskLifecycleStatus::Failed),
        value => Err(WorkspaceServiceError::InvalidInput(format!(
            "unsupported Direct Work final status for queue task: {value}"
        ))),
    }
}
