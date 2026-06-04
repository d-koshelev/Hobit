use std::fmt;

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct QueueRunnerSessionId(String);

impl QueueRunnerSessionId {
    pub(crate) fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for QueueRunnerSessionId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("QueueRunnerSessionId(<redacted>)")
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum QueueRunnerStatus {
    Idle,
    Armed,
    SelectingTask,
    AssigningTask,
    StartingTask,
    WaitingForExecutor,
    Stopping,
    Stopped,
    Completed,
    Error,
}

impl Default for QueueRunnerStatus {
    fn default() -> Self {
        Self::Idle
    }
}

impl QueueRunnerStatus {
    pub(crate) fn is_active(self) -> bool {
        matches!(
            self,
            Self::Armed
                | Self::SelectingTask
                | Self::AssigningTask
                | Self::StartingTask
                | Self::WaitingForExecutor
                | Self::Stopping
        )
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Armed => "armed",
            Self::SelectingTask => "selecting_task",
            Self::AssigningTask => "assigning_task",
            Self::StartingTask => "starting_task",
            Self::WaitingForExecutor => "waiting_for_executor",
            Self::Stopping => "stopping",
            Self::Stopped => "stopped",
            Self::Completed => "completed",
            Self::Error => "error",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct QueueRunnerPolicy {
    pub(crate) require_operator_start: bool,
    pub(crate) one_task_at_a_time: bool,
    pub(crate) stop_on_failure: bool,
    pub(crate) stop_on_review_needed: bool,
    pub(crate) stop_on_cancel: bool,
    pub(crate) allow_hidden_execution: bool,
    pub(crate) durable_resume: bool,
}

impl Default for QueueRunnerPolicy {
    fn default() -> Self {
        Self {
            require_operator_start: true,
            one_task_at_a_time: true,
            stop_on_failure: true,
            stop_on_review_needed: true,
            stop_on_cancel: true,
            allow_hidden_execution: false,
            durable_resume: false,
        }
    }
}

impl QueueRunnerPolicy {
    pub(crate) fn is_operator_armed_only(self) -> bool {
        self.require_operator_start && !self.allow_hidden_execution
    }

    pub(crate) fn persists_runner_state(self) -> bool {
        self.durable_resume
    }
}

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct QueueRunnerRuntimeConfig {
    pub(crate) codex_executable: String,
    pub(crate) repo_root: String,
    pub(crate) sandbox: String,
    pub(crate) approval_policy: String,
    pub(crate) timeout_ms: Option<u64>,
    pub(crate) stdout_cap_bytes: Option<usize>,
    pub(crate) stderr_cap_bytes: Option<usize>,
}

impl QueueRunnerRuntimeConfig {
    pub(crate) fn new(
        codex_executable: impl Into<String>,
        repo_root: impl Into<String>,
        sandbox: impl Into<String>,
        approval_policy: impl Into<String>,
    ) -> Self {
        Self {
            codex_executable: codex_executable.into(),
            repo_root: repo_root.into(),
            sandbox: sandbox.into(),
            approval_policy: approval_policy.into(),
            timeout_ms: None,
            stdout_cap_bytes: None,
            stderr_cap_bytes: None,
        }
    }
}

impl Default for QueueRunnerRuntimeConfig {
    fn default() -> Self {
        Self::new("", "", "", "")
    }
}

impl fmt::Debug for QueueRunnerRuntimeConfig {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("QueueRunnerRuntimeConfig")
            .field("codex_executable", &RedactedIdentifier)
            .field("repo_root", &RedactedIdentifier)
            .field("sandbox", &RedactedIdentifier)
            .field("approval_policy", &RedactedIdentifier)
            .field("timeout_ms", &self.timeout_ms)
            .field("stdout_cap_bytes", &self.stdout_cap_bytes)
            .field("stderr_cap_bytes", &self.stderr_cap_bytes)
            .finish()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum QueueRunnerStopReason {
    OperatorStopped,
    NoRunnableTasks,
    ManualTaskRequiresOperator,
    PreviousSuccessRequired,
    PreviousTaskNotSuccessful,
    AssignedToDifferentExecutor,
    ExecutorBusy,
    MissingExecutor,
    MissingPrompt,
    InvalidConfig,
    TaskFailed,
    ReviewNeeded,
    TaskCancelled,
    TaskKilled,
    UnknownFinalStatus,
    AppSessionEnded,
}

impl QueueRunnerStopReason {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::OperatorStopped => "operator_stopped",
            Self::NoRunnableTasks => "no_runnable_tasks",
            Self::ManualTaskRequiresOperator => "manual_task_requires_operator",
            Self::PreviousSuccessRequired => "previous_success_required",
            Self::PreviousTaskNotSuccessful => "previous_task_not_successful",
            Self::AssignedToDifferentExecutor => "assigned_to_different_executor",
            Self::ExecutorBusy => "executor_busy",
            Self::MissingExecutor => "missing_executor",
            Self::MissingPrompt => "missing_prompt",
            Self::InvalidConfig => "invalid_config",
            Self::TaskFailed => "task_failed",
            Self::ReviewNeeded => "review_needed",
            Self::TaskCancelled => "task_cancelled",
            Self::TaskKilled => "task_killed",
            Self::UnknownFinalStatus => "unknown_final_status",
            Self::AppSessionEnded => "app_session_ended",
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct QueueRunnerStartRequest {
    pub(crate) session_id: QueueRunnerSessionId,
    pub(crate) workspace_id: String,
    pub(crate) executor_widget_instance_id: String,
    pub(crate) policy: QueueRunnerPolicy,
    pub(crate) runtime_config: QueueRunnerRuntimeConfig,
}

impl QueueRunnerStartRequest {
    pub(crate) fn new(
        session_id: QueueRunnerSessionId,
        workspace_id: impl Into<String>,
        executor_widget_instance_id: impl Into<String>,
    ) -> Self {
        Self {
            session_id,
            workspace_id: workspace_id.into(),
            executor_widget_instance_id: executor_widget_instance_id.into(),
            policy: QueueRunnerPolicy::default(),
            runtime_config: QueueRunnerRuntimeConfig::default(),
        }
    }

    pub(crate) fn is_explicit_operator_start(&self) -> bool {
        self.policy.is_operator_armed_only()
    }
}

impl fmt::Debug for QueueRunnerStartRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("QueueRunnerStartRequest")
            .field("session_id", &self.session_id)
            .field("workspace_id", &RedactedIdentifier)
            .field("executor_widget_instance_id", &RedactedIdentifier)
            .field("policy", &self.policy)
            .field("runtime_config", &self.runtime_config)
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct QueueRunnerSnapshot {
    pub(crate) session_id: Option<QueueRunnerSessionId>,
    pub(crate) status: QueueRunnerStatus,
    pub(crate) policy: QueueRunnerPolicy,
    pub(crate) active_queue_item_id: Option<String>,
    pub(crate) waiting_run_id: Option<String>,
    pub(crate) final_run_status: Option<String>,
    pub(crate) last_reconciled_at: Option<String>,
    pub(crate) stop_reason: Option<QueueRunnerStopReason>,
}

impl Default for QueueRunnerSnapshot {
    fn default() -> Self {
        Self {
            session_id: None,
            status: QueueRunnerStatus::Idle,
            policy: QueueRunnerPolicy::default(),
            active_queue_item_id: None,
            waiting_run_id: None,
            final_run_status: None,
            last_reconciled_at: None,
            stop_reason: None,
        }
    }
}

impl QueueRunnerSnapshot {
    pub(crate) fn armed(session_id: QueueRunnerSessionId) -> Self {
        Self {
            session_id: Some(session_id),
            status: QueueRunnerStatus::Armed,
            ..Self::default()
        }
    }

    pub(crate) fn is_session_only(&self) -> bool {
        !self.policy.persists_runner_state()
    }
}

impl fmt::Debug for QueueRunnerSnapshot {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("QueueRunnerSnapshot")
            .field("session_id", &self.session_id)
            .field("status", &self.status)
            .field("policy", &self.policy)
            .field(
                "active_queue_item_id",
                &self
                    .active_queue_item_id
                    .as_ref()
                    .map(|_| RedactedIdentifier),
            )
            .field(
                "waiting_run_id",
                &self.waiting_run_id.as_ref().map(|_| RedactedIdentifier),
            )
            .field(
                "final_run_status",
                &self.final_run_status.as_ref().map(|_| RedactedIdentifier),
            )
            .field("last_reconciled_at", &self.last_reconciled_at)
            .field("stop_reason", &self.stop_reason)
            .finish()
    }
}

struct RedactedIdentifier;

impl fmt::Debug for RedactedIdentifier {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("<redacted>")
    }
}
