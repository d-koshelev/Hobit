#![allow(dead_code)]

mod run_observation;
mod selection;
mod state;
mod types;

pub(crate) use selection::{
    select_next_autorun_task, select_next_autorun_task_after_success, QueueAutorunTaskSelection,
};
pub(crate) use state::QueueRunnerSessionRegistry;
pub(crate) use types::{
    QueueRunnerPolicy, QueueRunnerRuntimeConfig, QueueRunnerSnapshot, QueueRunnerStartRequest,
    QueueRunnerStopReason,
};

#[cfg(test)]
mod tests;
