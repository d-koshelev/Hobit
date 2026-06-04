use hobit_app::AgentQueueTaskSummary;

use super::types::QueueRunnerStopReason;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum QueueAutorunTaskSelection {
    Start { queue_item_id: String },
    Stop { reason: QueueRunnerStopReason },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum QueueAutorunSelectionMode {
    InitialStart,
    AfterSuccessfulTask,
}

pub(crate) fn select_next_autorun_task(
    tasks: &[AgentQueueTaskSummary],
    executor_widget_instance_id: &str,
) -> QueueAutorunTaskSelection {
    select_next_autorun_task_for_mode(
        tasks,
        executor_widget_instance_id,
        QueueAutorunSelectionMode::InitialStart,
    )
}

pub(crate) fn select_next_autorun_task_after_success(
    tasks: &[AgentQueueTaskSummary],
    executor_widget_instance_id: &str,
) -> QueueAutorunTaskSelection {
    select_next_autorun_task_for_mode(
        tasks,
        executor_widget_instance_id,
        QueueAutorunSelectionMode::AfterSuccessfulTask,
    )
}

fn select_next_autorun_task_for_mode(
    tasks: &[AgentQueueTaskSummary],
    executor_widget_instance_id: &str,
    mode: QueueAutorunSelectionMode,
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
                if mode != QueueAutorunSelectionMode::AfterSuccessfulTask {
                    return QueueAutorunTaskSelection::Stop {
                        reason: QueueRunnerStopReason::PreviousSuccessRequired,
                    };
                }
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
