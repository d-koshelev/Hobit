#![allow(dead_code)]

use hobit_app::AgentQueueTaskSummary;
use std::fmt;
use std::sync::{Arc, Mutex};

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
    pub(crate) final_run_status: Option<String>,
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

#[derive(Clone, Default)]
pub(crate) struct QueueRunnerSessionRegistry {
    state: Arc<Mutex<QueueRunnerSessionState>>,
}

impl QueueRunnerSessionRegistry {
    pub(crate) fn start_session(
        &self,
        workspace_id: impl Into<String>,
        executor_widget_instance_id: impl Into<String>,
        policy: QueueRunnerPolicy,
    ) -> Result<QueueRunnerSnapshot, String> {
        let workspace_id = required_value(workspace_id.into(), "workspace id")?;
        let executor_widget_instance_id = required_value(
            executor_widget_instance_id.into(),
            "executor widget instance id",
        )?;
        validate_start_policy(policy)?;

        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.status.is_active() {
            return Err(
                "Queue runner session is already active. Stop it before arming another session."
                    .to_owned(),
            );
        }

        let session_id = state.next_session_id();
        let mut start_request = QueueRunnerStartRequest::new(
            session_id.clone(),
            workspace_id,
            executor_widget_instance_id,
        );
        start_request.policy = policy;
        state.start_request = Some(start_request);
        state.snapshot = QueueRunnerSnapshot {
            session_id: Some(session_id),
            status: QueueRunnerStatus::Armed,
            policy,
            active_queue_item_id: None,
            waiting_run_id: None,
            final_run_status: None,
            stop_reason: None,
        };

        Ok(state.snapshot.clone())
    }

    pub(crate) fn stop_session(&self) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.session_id.is_none() || state.snapshot.status == QueueRunnerStatus::Idle {
            state.snapshot = QueueRunnerSnapshot::default();
            state.start_request = None;
            return state.snapshot.clone();
        }

        if state.snapshot.status != QueueRunnerStatus::Stopped {
            state.snapshot.status = QueueRunnerStatus::Stopped;
            state.snapshot.stop_reason = Some(QueueRunnerStopReason::OperatorStopped);
        }

        state.snapshot.clone()
    }

    pub(crate) fn stop_with_reason(&self, reason: QueueRunnerStopReason) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.session_id.is_none() {
            state.snapshot = QueueRunnerSnapshot::default();
            state.start_request = None;
            return state.snapshot.clone();
        }

        state.snapshot.status = QueueRunnerStatus::Stopped;
        state.snapshot.stop_reason = Some(reason);
        state.snapshot.active_queue_item_id = None;
        state.snapshot.waiting_run_id = None;
        state.snapshot.final_run_status = None;
        state.snapshot.clone()
    }

    pub(crate) fn waiting_for_executor(
        &self,
        queue_item_id: impl Into<String>,
        run_id: impl Into<String>,
    ) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        state.snapshot.status = QueueRunnerStatus::WaitingForExecutor;
        state.snapshot.active_queue_item_id = Some(queue_item_id.into());
        state.snapshot.waiting_run_id = Some(run_id.into());
        state.snapshot.final_run_status = None;
        state.snapshot.stop_reason = None;
        state.snapshot.clone()
    }

    pub(crate) fn observe_waiting_run_status(
        &self,
        run_id: &str,
        status: &str,
        is_finished: bool,
    ) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.status != QueueRunnerStatus::WaitingForExecutor
            || state.snapshot.waiting_run_id.as_deref() != Some(run_id)
        {
            return state.snapshot.clone();
        }

        let Some(observation) =
            QueueRunnerFinalRunObservation::from_run_status(status, is_finished)
        else {
            return state.snapshot.clone();
        };

        state.snapshot.final_run_status = Some(observation.safe_status.to_owned());
        state.snapshot.status = observation.status;
        state.snapshot.stop_reason = observation.stop_reason;
        state.snapshot.clone()
    }

    pub(crate) fn observe_missing_waiting_run(&self, run_id: &str) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.status != QueueRunnerStatus::WaitingForExecutor
            || state.snapshot.waiting_run_id.as_deref() != Some(run_id)
        {
            return state.snapshot.clone();
        }

        state.snapshot.status = QueueRunnerStatus::Stopped;
        state.snapshot.final_run_status = Some("unknown".to_owned());
        state.snapshot.stop_reason = Some(QueueRunnerStopReason::UnknownFinalStatus);
        state.snapshot.clone()
    }

    pub(crate) fn snapshot(&self) -> QueueRunnerSnapshot {
        self.state
            .lock()
            .expect("queue runner session lock")
            .snapshot
            .clone()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct QueueRunnerFinalRunObservation {
    status: QueueRunnerStatus,
    safe_status: &'static str,
    stop_reason: Option<QueueRunnerStopReason>,
}

impl QueueRunnerFinalRunObservation {
    fn from_run_status(status: &str, is_finished: bool) -> Option<Self> {
        match status {
            "completed" | "succeeded" => Some(Self {
                status: QueueRunnerStatus::Completed,
                safe_status: "completed",
                stop_reason: None,
            }),
            "failed" | "timed_out" => Some(Self {
                status: QueueRunnerStatus::Stopped,
                safe_status: status_label(status),
                stop_reason: Some(QueueRunnerStopReason::TaskFailed),
            }),
            "cancelled" => Some(Self {
                status: QueueRunnerStatus::Stopped,
                safe_status: "cancelled",
                stop_reason: Some(QueueRunnerStopReason::TaskCancelled),
            }),
            "force_killed" => Some(Self {
                status: QueueRunnerStatus::Stopped,
                safe_status: "force_killed",
                stop_reason: Some(QueueRunnerStopReason::TaskKilled),
            }),
            "review_needed" => Some(Self {
                status: QueueRunnerStatus::Stopped,
                safe_status: "review_needed",
                stop_reason: Some(QueueRunnerStopReason::ReviewNeeded),
            }),
            "running" | "started" if !is_finished => None,
            _ if is_finished => Some(Self {
                status: QueueRunnerStatus::Stopped,
                safe_status: "unknown",
                stop_reason: Some(QueueRunnerStopReason::UnknownFinalStatus),
            }),
            _ => None,
        }
    }
}

fn status_label(status: &str) -> &'static str {
    match status {
        "failed" => "failed",
        "timed_out" => "timed_out",
        _ => "unknown",
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum QueueAutorunTaskSelection {
    Start { queue_item_id: String },
    Stop { reason: QueueRunnerStopReason },
}

pub(crate) fn select_next_autorun_task(
    tasks: &[AgentQueueTaskSummary],
    executor_widget_instance_id: &str,
) -> QueueAutorunTaskSelection {
    for task in tasks {
        if !is_autorun_runnable_status(&task.status) {
            continue;
        }

        if task.prompt.trim().is_empty() {
            return QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::MissingPrompt,
            };
        }

        match task.execution_policy.as_str() {
            "manual" => {
                return QueueAutorunTaskSelection::Stop {
                    reason: QueueRunnerStopReason::ManualTaskRequiresOperator,
                };
            }
            "after_previous_success" => {
                return QueueAutorunTaskSelection::Stop {
                    reason: QueueRunnerStopReason::PreviousSuccessRequired,
                };
            }
            "auto" => {}
            _ => {
                return QueueAutorunTaskSelection::Stop {
                    reason: QueueRunnerStopReason::InvalidConfig,
                };
            }
        }

        let Some(assigned_executor_widget_id) = task.assigned_executor_widget_id.as_deref() else {
            return QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::MissingExecutor,
            };
        };

        if assigned_executor_widget_id != executor_widget_instance_id {
            return QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::AssignedToDifferentExecutor,
            };
        }

        return QueueAutorunTaskSelection::Start {
            queue_item_id: task.queue_item_id.clone(),
        };
    }

    QueueAutorunTaskSelection::Stop {
        reason: QueueRunnerStopReason::NoRunnableTasks,
    }
}

fn is_autorun_runnable_status(status: &str) -> bool {
    matches!(status, "queued" | "ready" | "review_needed")
}

#[derive(Default)]
struct QueueRunnerSessionState {
    next_session_sequence: u64,
    snapshot: QueueRunnerSnapshot,
    start_request: Option<QueueRunnerStartRequest>,
}

impl QueueRunnerSessionState {
    fn next_session_id(&mut self) -> QueueRunnerSessionId {
        self.next_session_sequence = self.next_session_sequence.saturating_add(1);
        QueueRunnerSessionId::new(format!(
            "queue_runner_session_{}",
            self.next_session_sequence
        ))
    }
}

fn required_value(value: String, label: &str) -> Result<String, String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(format!("{label} must not be empty"));
    }

    Ok(value)
}

fn validate_start_policy(policy: QueueRunnerPolicy) -> Result<(), String> {
    if !policy.require_operator_start {
        return Err("Queue runner requires explicit operator start".to_owned());
    }

    if !policy.one_task_at_a_time {
        return Err("Queue runner must run one task at a time".to_owned());
    }

    if policy.allow_hidden_execution {
        return Err("Queue runner cannot allow hidden execution".to_owned());
    }

    if policy.durable_resume {
        return Err("Queue runner durable resume is not implemented".to_owned());
    }

    Ok(())
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
    fn stop_reasons_cover_first_autorun_runner_boundaries() {
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
            final_run_status: Some("final response sk-secret".to_owned()),
            stop_reason: Some(QueueRunnerStopReason::TaskFailed),
        };

        let debug = format!("{snapshot:?}");

        assert!(!debug.contains("sk-secret"));
        assert!(!debug.contains("stdout"));
        assert!(!debug.contains("final response"));
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

    #[test]
    fn session_registry_starts_explicit_armed_session_without_task_state() {
        let registry = QueueRunnerSessionRegistry::default();

        let snapshot = registry
            .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
            .expect("start runner session");

        assert_eq!(snapshot.status, QueueRunnerStatus::Armed);
        assert_eq!(
            snapshot
                .session_id
                .as_ref()
                .map(QueueRunnerSessionId::as_str),
            Some("queue_runner_session_1")
        );
        assert_eq!(snapshot.active_queue_item_id, None);
        assert_eq!(snapshot.waiting_run_id, None);
    }

    #[test]
    fn session_registry_does_not_need_queue_task_or_persistence_to_start() {
        let registry = QueueRunnerSessionRegistry::default();

        let snapshot = registry
            .start_session(
                "workspace without storage",
                "executor without db lookup",
                QueueRunnerPolicy::default(),
            )
            .expect("start session without queue task");

        assert_eq!(snapshot.status, QueueRunnerStatus::Armed);
        assert!(snapshot.is_session_only());
    }

    #[test]
    fn session_registry_stop_transitions_and_repeated_stop_is_safe() {
        let registry = QueueRunnerSessionRegistry::default();
        registry
            .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
            .expect("start runner session");

        let stopped = registry.stop_session();
        let stopped_again = registry.stop_session();

        assert_eq!(stopped.status, QueueRunnerStatus::Stopped);
        assert_eq!(
            stopped.stop_reason,
            Some(QueueRunnerStopReason::OperatorStopped)
        );
        assert_eq!(stopped_again, stopped);
    }

    #[test]
    fn session_registry_observes_completed_run_without_starting_continuation() {
        let registry = QueueRunnerSessionRegistry::default();
        registry
            .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
            .expect("start runner session");
        registry.waiting_for_executor("queue_1", "run_1");

        let snapshot = registry.observe_waiting_run_status("run_1", "completed", true);

        assert_eq!(snapshot.status, QueueRunnerStatus::Completed);
        assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
        assert_eq!(snapshot.active_queue_item_id.as_deref(), Some("queue_1"));
        assert_eq!(snapshot.waiting_run_id.as_deref(), Some("run_1"));
        assert_eq!(snapshot.stop_reason, None);
        assert!(!snapshot.status.is_active());
    }

    #[test]
    fn session_registry_observes_failed_cancelled_killed_and_unknown_final_statuses() {
        for (status, expected_status, expected_reason) in [
            ("failed", Some("failed"), QueueRunnerStopReason::TaskFailed),
            (
                "timed_out",
                Some("timed_out"),
                QueueRunnerStopReason::TaskFailed,
            ),
            (
                "cancelled",
                Some("cancelled"),
                QueueRunnerStopReason::TaskCancelled,
            ),
            (
                "force_killed",
                Some("force_killed"),
                QueueRunnerStopReason::TaskKilled,
            ),
            (
                "review_needed",
                Some("review_needed"),
                QueueRunnerStopReason::ReviewNeeded,
            ),
            (
                "secret final response sk-secret",
                Some("unknown"),
                QueueRunnerStopReason::UnknownFinalStatus,
            ),
        ] {
            let registry = QueueRunnerSessionRegistry::default();
            registry
                .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
                .expect("start runner session");
            registry.waiting_for_executor("queue_1", "run_1");

            let snapshot = registry.observe_waiting_run_status("run_1", status, true);

            assert_eq!(snapshot.status, QueueRunnerStatus::Stopped);
            assert_eq!(snapshot.final_run_status.as_deref(), expected_status);
            assert_eq!(snapshot.stop_reason, Some(expected_reason));
        }
    }

    #[test]
    fn session_registry_ignores_nonfinal_waiting_status_and_mismatched_run() {
        let registry = QueueRunnerSessionRegistry::default();
        registry
            .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
            .expect("start runner session");
        registry.waiting_for_executor("queue_1", "run_1");

        let running = registry.observe_waiting_run_status("run_1", "running", false);
        let mismatched = registry.observe_waiting_run_status("other_run", "completed", true);

        assert_eq!(running.status, QueueRunnerStatus::WaitingForExecutor);
        assert_eq!(running.final_run_status, None);
        assert_eq!(mismatched.status, QueueRunnerStatus::WaitingForExecutor);
        assert_eq!(mismatched.final_run_status, None);
    }

    #[test]
    fn stop_after_completed_observation_prevents_future_continuation() {
        let registry = QueueRunnerSessionRegistry::default();
        registry
            .start_session("ws_1", "executor_1", QueueRunnerPolicy::default())
            .expect("start runner session");
        registry.waiting_for_executor("queue_1", "run_1");
        registry.observe_waiting_run_status("run_1", "completed", true);

        let snapshot = registry.stop_session();

        assert_eq!(snapshot.status, QueueRunnerStatus::Stopped);
        assert_eq!(
            snapshot.stop_reason,
            Some(QueueRunnerStopReason::OperatorStopped)
        );
        assert_eq!(snapshot.final_run_status.as_deref(), Some("completed"));
    }

    #[test]
    fn session_registry_rejects_non_operator_or_hidden_policy() {
        let registry = QueueRunnerSessionRegistry::default();
        let hidden_policy = QueueRunnerPolicy {
            allow_hidden_execution: true,
            ..QueueRunnerPolicy::default()
        };
        let durable_policy = QueueRunnerPolicy {
            durable_resume: true,
            ..QueueRunnerPolicy::default()
        };

        assert!(registry
            .start_session("ws_1", "executor_1", hidden_policy)
            .expect_err("hidden execution rejected")
            .contains("hidden execution"));
        assert!(registry
            .start_session("ws_1", "executor_1", durable_policy)
            .expect_err("durable resume rejected")
            .contains("not implemented"));
    }

    #[test]
    fn autorun_selection_starts_one_auto_task_for_selected_executor() {
        let decision = select_next_autorun_task(
            &[task_summary(
                "queue_1",
                "ready",
                "auto",
                "Prompt",
                Some("executor_1"),
            )],
            "executor_1",
        );

        assert_eq!(
            decision,
            QueueAutorunTaskSelection::Start {
                queue_item_id: "queue_1".to_owned()
            }
        );
    }

    #[test]
    fn autorun_selection_blocks_missing_prompt_without_exposing_prompt_text() {
        let decision = select_next_autorun_task(
            &[task_summary(
                "queue_1",
                "ready",
                "auto",
                "",
                Some("executor_1"),
            )],
            "executor_1",
        );

        assert_eq!(
            decision,
            QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::MissingPrompt
            }
        );
    }

    #[test]
    fn autorun_selection_does_not_run_manual_or_after_previous_success_first() {
        let manual = select_next_autorun_task(
            &[task_summary(
                "queue_1",
                "ready",
                "manual",
                "Prompt",
                Some("executor_1"),
            )],
            "executor_1",
        );
        let after_previous_success = select_next_autorun_task(
            &[task_summary(
                "queue_2",
                "ready",
                "after_previous_success",
                "Prompt",
                Some("executor_1"),
            )],
            "executor_1",
        );

        assert_eq!(
            manual,
            QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::ManualTaskRequiresOperator
            }
        );
        assert_eq!(
            after_previous_success,
            QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::PreviousSuccessRequired
            }
        );
    }

    #[test]
    fn autorun_selection_blocks_missing_or_different_executor() {
        let missing = select_next_autorun_task(
            &[task_summary("queue_1", "ready", "auto", "Prompt", None)],
            "executor_1",
        );
        let different = select_next_autorun_task(
            &[task_summary(
                "queue_2",
                "ready",
                "auto",
                "Prompt",
                Some("executor_2"),
            )],
            "executor_1",
        );

        assert_eq!(
            missing,
            QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::MissingExecutor
            }
        );
        assert_eq!(
            different,
            QueueAutorunTaskSelection::Stop {
                reason: QueueRunnerStopReason::AssignedToDifferentExecutor
            }
        );
    }

    fn task_summary(
        queue_item_id: &str,
        status: &str,
        execution_policy: &str,
        prompt: &str,
        assigned_executor_widget_id: Option<&str>,
    ) -> AgentQueueTaskSummary {
        AgentQueueTaskSummary {
            queue_item_id: queue_item_id.to_owned(),
            workspace_id: "workspace_1".to_owned(),
            title: "Task".to_owned(),
            description: String::new(),
            prompt: prompt.to_owned(),
            status: status.to_owned(),
            priority: 0,
            execution_policy: execution_policy.to_owned(),
            assigned_executor_widget_id: assigned_executor_widget_id.map(str::to_owned),
            created_at: "2026-05-21T00:00:00.000Z".to_owned(),
            updated_at: "2026-05-21T00:00:00.000Z".to_owned(),
        }
    }
}
