use std::sync::{Arc, Mutex};

use super::run_observation::{
    current_reconciliation_timestamp, QueueRunnerFinalRunObservation,
    QueueRunnerReconciliationObservation,
};
use super::types::{
    QueueRunnerPolicy, QueueRunnerRuntimeConfig, QueueRunnerSessionId, QueueRunnerSnapshot,
    QueueRunnerStartRequest, QueueRunnerStatus, QueueRunnerStopReason,
};

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
        self.start_session_with_runtime_config(
            workspace_id,
            executor_widget_instance_id,
            policy,
            QueueRunnerRuntimeConfig::default(),
        )
    }

    pub(crate) fn start_session_with_runtime_config(
        &self,
        workspace_id: impl Into<String>,
        executor_widget_instance_id: impl Into<String>,
        policy: QueueRunnerPolicy,
        runtime_config: QueueRunnerRuntimeConfig,
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
        start_request.runtime_config = runtime_config;
        state.start_request = Some(start_request);
        state.snapshot = QueueRunnerSnapshot {
            session_id: Some(session_id),
            status: QueueRunnerStatus::Armed,
            policy,
            active_queue_item_id: None,
            waiting_run_id: None,
            final_run_status: None,
            last_reconciled_at: None,
            stop_reason: None,
        };

        Ok(state.snapshot.clone())
    }

    pub(crate) fn stop_session(&self) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.session_id.is_none() || state.snapshot.status == QueueRunnerStatus::Idle {
            state.snapshot = QueueRunnerSnapshot::default();
            state.start_request = None;
            state.active_tick_loop_session_id = None;
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
            state.active_tick_loop_session_id = None;
            return state.snapshot.clone();
        }

        state.snapshot.status = QueueRunnerStatus::Stopped;
        state.snapshot.stop_reason = Some(reason);
        state.snapshot.active_queue_item_id = None;
        state.snapshot.waiting_run_id = None;
        state.snapshot.final_run_status = None;
        state.snapshot.last_reconciled_at = None;
        state.snapshot.clone()
    }

    pub(crate) fn stop_after_final_status(
        &self,
        reason: QueueRunnerStopReason,
    ) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.session_id.is_none() {
            state.snapshot = QueueRunnerSnapshot::default();
            state.start_request = None;
            state.active_tick_loop_session_id = None;
            return state.snapshot.clone();
        }

        state.snapshot.status = QueueRunnerStatus::Stopped;
        state.snapshot.stop_reason = Some(reason);
        state.snapshot.active_queue_item_id = None;
        state.snapshot.waiting_run_id = None;
        state.snapshot.clone()
    }

    pub(crate) fn complete_without_continuation(
        &self,
        reason: QueueRunnerStopReason,
    ) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.session_id.is_none() {
            state.snapshot = QueueRunnerSnapshot::default();
            state.start_request = None;
            state.active_tick_loop_session_id = None;
            return state.snapshot.clone();
        }

        state.snapshot.status = QueueRunnerStatus::Completed;
        state.snapshot.stop_reason = Some(reason);
        state.snapshot.active_queue_item_id = None;
        state.snapshot.waiting_run_id = None;
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
        state.snapshot.last_reconciled_at = None;
        state.snapshot.stop_reason = None;
        state.snapshot.clone()
    }

    pub(crate) fn waiting_for_executor_after_continuation(
        &self,
        queue_item_id: impl Into<String>,
        run_id: impl Into<String>,
    ) -> QueueRunnerSnapshot {
        let mut state = self.state.lock().expect("queue runner session lock");
        state.snapshot.status = QueueRunnerStatus::WaitingForExecutor;
        state.snapshot.active_queue_item_id = Some(queue_item_id.into());
        state.snapshot.waiting_run_id = Some(run_id.into());
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

    pub(crate) fn observe_waiting_run_for_reconciliation(
        &self,
        run_id: &str,
        status: &str,
        is_finished: bool,
    ) -> QueueRunnerReconciliationObservation {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.status != QueueRunnerStatus::WaitingForExecutor
            || state.snapshot.waiting_run_id.as_deref() != Some(run_id)
        {
            return QueueRunnerReconciliationObservation {
                snapshot: state.snapshot.clone(),
                should_continue_after_success: false,
            };
        }

        state.snapshot.last_reconciled_at = Some(current_reconciliation_timestamp());
        let Some(observation) =
            QueueRunnerFinalRunObservation::from_run_status(status, is_finished)
        else {
            return QueueRunnerReconciliationObservation {
                snapshot: state.snapshot.clone(),
                should_continue_after_success: false,
            };
        };

        state.snapshot.final_run_status = Some(observation.safe_status.to_owned());
        state.snapshot.stop_reason = observation.stop_reason;
        let should_continue_after_success = observation.status == QueueRunnerStatus::Completed;
        state.snapshot.status = if should_continue_after_success {
            QueueRunnerStatus::SelectingTask
        } else {
            observation.status
        };

        QueueRunnerReconciliationObservation {
            snapshot: state.snapshot.clone(),
            should_continue_after_success,
        }
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
        state.snapshot.last_reconciled_at = Some(current_reconciliation_timestamp());
        state.snapshot.stop_reason = Some(QueueRunnerStopReason::UnknownFinalStatus);
        state.snapshot.clone()
    }

    pub(crate) fn try_mark_continuation_starting(
        &self,
        session_id: &QueueRunnerSessionId,
    ) -> Option<QueueRunnerSnapshot> {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.snapshot.session_id.as_ref() != Some(session_id)
            || state.snapshot.status != QueueRunnerStatus::SelectingTask
        {
            return None;
        }

        state.snapshot.status = QueueRunnerStatus::StartingTask;
        Some(state.snapshot.clone())
    }

    pub(crate) fn try_claim_tick_loop(&self) -> Option<QueueRunnerSessionId> {
        let mut state = self.state.lock().expect("queue runner session lock");
        let session_id = state.snapshot.session_id.clone()?;
        if !state.snapshot.status.is_active() {
            return None;
        }

        if state.active_tick_loop_session_id.as_ref() == Some(&session_id) {
            return None;
        }

        state.active_tick_loop_session_id = Some(session_id.clone());
        Some(session_id)
    }

    pub(crate) fn release_tick_loop(&self, session_id: &QueueRunnerSessionId) {
        let mut state = self.state.lock().expect("queue runner session lock");
        if state.active_tick_loop_session_id.as_ref() == Some(session_id) {
            state.active_tick_loop_session_id = None;
        }
    }

    pub(crate) fn tick_loop_should_continue(&self, session_id: &QueueRunnerSessionId) -> bool {
        let state = self.state.lock().expect("queue runner session lock");
        state.snapshot.session_id.as_ref() == Some(session_id) && state.snapshot.status.is_active()
    }

    pub(crate) fn snapshot(&self) -> QueueRunnerSnapshot {
        self.state
            .lock()
            .expect("queue runner session lock")
            .snapshot
            .clone()
    }

    pub(crate) fn start_request(&self) -> Option<QueueRunnerStartRequest> {
        self.state
            .lock()
            .expect("queue runner session lock")
            .start_request
            .clone()
    }
}

#[derive(Default)]
struct QueueRunnerSessionState {
    next_session_sequence: u64,
    snapshot: QueueRunnerSnapshot,
    start_request: Option<QueueRunnerStartRequest>,
    active_tick_loop_session_id: Option<QueueRunnerSessionId>,
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
