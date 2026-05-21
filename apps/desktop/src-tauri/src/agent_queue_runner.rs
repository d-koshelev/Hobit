#![allow(dead_code)]

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

#[derive(Clone, Eq, PartialEq)]
pub(crate) struct QueueRunnerStartRequest {
    pub(crate) session_id: QueueRunnerSessionId,
    pub(crate) workspace_id: String,
    pub(crate) executor_widget_instance_id: String,
    pub(crate) policy: QueueRunnerPolicy,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_runner_snapshot_is_idle_and_session_only() {
        let snapshot = QueueRunnerSnapshot::default();

        assert_eq!(snapshot.status, QueueRunnerStatus::Idle);
        assert!(snapshot.is_session_only());
        assert!(!snapshot.status.is_active());
    }

    #[test]
    fn explicit_start_armed_state_is_distinct_from_task_creation() {
        let request =
            QueueRunnerStartRequest::new(QueueRunnerSessionId::new("runner_1"), "ws_1", "wid_1");
        let snapshot = QueueRunnerSnapshot::armed(request.session_id.clone());

        assert!(request.is_explicit_operator_start());
        assert_eq!(snapshot.status, QueueRunnerStatus::Armed);
        assert_ne!(snapshot.status, QueueRunnerStatus::Idle);
        assert!(snapshot.status.is_active());
    }

    #[test]
    fn default_policy_does_not_allow_hidden_execution_or_durable_resume() {
        let policy = QueueRunnerPolicy::default();

        assert!(policy.require_operator_start);
        assert!(policy.one_task_at_a_time);
        assert!(policy.stop_on_failure);
        assert!(policy.stop_on_review_needed);
        assert!(policy.stop_on_cancel);
        assert!(!policy.allow_hidden_execution);
        assert!(!policy.persists_runner_state());
    }

    #[test]
    fn stop_reasons_cover_first_overnight_runner_boundaries() {
        let reasons = [
            QueueRunnerStopReason::OperatorStopped,
            QueueRunnerStopReason::NoRunnableTasks,
            QueueRunnerStopReason::ManualTaskRequiresOperator,
            QueueRunnerStopReason::PreviousSuccessRequired,
            QueueRunnerStopReason::PreviousTaskNotSuccessful,
            QueueRunnerStopReason::AssignedToDifferentExecutor,
            QueueRunnerStopReason::ExecutorBusy,
            QueueRunnerStopReason::MissingExecutor,
            QueueRunnerStopReason::MissingPrompt,
            QueueRunnerStopReason::InvalidConfig,
            QueueRunnerStopReason::TaskFailed,
            QueueRunnerStopReason::ReviewNeeded,
            QueueRunnerStopReason::TaskCancelled,
            QueueRunnerStopReason::TaskKilled,
            QueueRunnerStopReason::UnknownFinalStatus,
            QueueRunnerStopReason::AppSessionEnded,
        ];

        assert!(reasons.contains(&QueueRunnerStopReason::TaskFailed));
        assert!(reasons.contains(&QueueRunnerStopReason::ReviewNeeded));
        assert!(reasons.contains(&QueueRunnerStopReason::TaskCancelled));
        assert!(reasons.contains(&QueueRunnerStopReason::MissingExecutor));
        assert!(reasons.contains(&QueueRunnerStopReason::MissingPrompt));
        assert!(reasons.contains(&QueueRunnerStopReason::InvalidConfig));
        assert!(reasons.contains(&QueueRunnerStopReason::UnknownFinalStatus));
    }

    #[test]
    fn snapshot_debug_output_does_not_expose_sensitive_runtime_text() {
        let snapshot = QueueRunnerSnapshot {
            session_id: Some(QueueRunnerSessionId::new("sk-secret-runner")),
            status: QueueRunnerStatus::WaitingForExecutor,
            policy: QueueRunnerPolicy::default(),
            active_queue_item_id: Some("prompt with sk-secret and stdout".to_owned()),
            waiting_run_id: Some("C:\\Users\\person\\repo --danger".to_owned()),
            stop_reason: Some(QueueRunnerStopReason::TaskFailed),
        };

        let debug = format!("{snapshot:?}");

        assert!(!debug.contains("sk-secret"));
        assert!(!debug.contains("stdout"));
        assert!(!debug.contains("C:\\Users"));
        assert!(!debug.contains("--danger"));
        assert!(debug.contains("<redacted>"));
        assert!(debug.contains("WaitingForExecutor"));
    }

    #[test]
    fn start_request_debug_output_redacts_ids_and_paths() {
        let request = QueueRunnerStartRequest::new(
            QueueRunnerSessionId::new("runner-sk-secret"),
            "C:\\Users\\person\\workspace",
            "executor --arg",
        );

        let debug = format!("{request:?}");

        assert!(!debug.contains("runner-sk-secret"));
        assert!(!debug.contains("C:\\Users"));
        assert!(!debug.contains("--arg"));
        assert!(debug.contains("require_operator_start: true"));
    }
}
