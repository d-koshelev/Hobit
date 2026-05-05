//! Workbench event contracts.
//!
//! Events are explicit, typed records routed through Workbench state. The
//! durable Workspace owns persisted event history for resume behavior, but this
//! module does not implement replay, summarization, or storage.

use crate::actions::{ActionProposalId, DecisionRequestId};
use crate::state::SharedStateObjectId;
use crate::widgets::{WidgetInstanceId, WidgetRunId};
use crate::workbench::{WorkbenchId, WorkspaceId};

/// Identifier for a Workbench event.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkbenchEventId(pub String);

impl WorkbenchEventId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for structured agent activity.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct AgentActivityEventId(pub String);

impl AgentActivityEventId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Runtime status for agent activity visible through the Workbench.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgentActivityStatus {
    Proposed,
    Running,
    WaitingForDecision,
    Completed,
    Failed,
    Cancelled,
}

/// A structured description of agent activity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentActivityEvent {
    pub id: AgentActivityEventId,
    pub summary: String,
    pub status: AgentActivityStatus,
    pub details: String,
    pub occurred_at: Option<String>,
}

/// Typed Workbench event categories.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorkbenchEventKind {
    WorkspaceOpened(WorkspaceId),
    WorkspaceClosed(WorkspaceId),
    WidgetAdded(WidgetInstanceId),
    WidgetRemoved(WidgetInstanceId),
    WidgetMoved(WidgetInstanceId),
    WidgetPresentationChanged(WidgetInstanceId),
    WidgetRunStarted(WidgetRunId),
    WidgetRunCompleted(WidgetRunId),
    WidgetLogRecorded(WidgetInstanceId),
    WidgetResultRecorded(WidgetRunId),
    SharedStateChanged(SharedStateObjectId),
    ActionProposed(ActionProposalId),
    DecisionRequested(DecisionRequestId),
    AgentActivity(AgentActivityEvent),
    Other(String),
}

/// A structured event emitted within a Workspace Workbench.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchEvent {
    pub id: WorkbenchEventId,
    pub workspace_id: Option<WorkspaceId>,
    pub workbench_id: WorkbenchId,
    pub kind: WorkbenchEventKind,
    pub summary: String,
    pub occurred_at: Option<String>,
    pub references: Vec<String>,
}
