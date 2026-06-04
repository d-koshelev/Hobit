use std::time::{SystemTime, UNIX_EPOCH};

use super::types::{QueueRunnerSnapshot, QueueRunnerStatus, QueueRunnerStopReason};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct QueueRunnerReconciliationObservation {
    pub(crate) snapshot: QueueRunnerSnapshot,
    pub(crate) should_continue_after_success: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct QueueRunnerFinalRunObservation {
    pub(super) status: QueueRunnerStatus,
    pub(super) safe_status: &'static str,
    pub(super) stop_reason: Option<QueueRunnerStopReason>,
}

impl QueueRunnerFinalRunObservation {
    pub(super) fn from_run_status(status: &str, is_finished: bool) -> Option<Self> {
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

pub(super) fn current_reconciliation_timestamp() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("unix_ms:{millis}")
}
