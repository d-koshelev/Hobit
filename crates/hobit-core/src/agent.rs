//! Agent-facing contract aliases.
//!
//! Hobit core does not implement an agent runtime. Agent activity is modeled as
//! structured Workbench events so the operator can see what the agent is doing.

pub use crate::events::{AgentActivityEvent, AgentActivityEventId, AgentActivityStatus};
