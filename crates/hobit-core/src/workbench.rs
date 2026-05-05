//! Workspace and Workbench resumable work domain.
//!
//! A Workspace is the durable user-facing unit of resumable work. A
//! WorkspaceSession is the current runtime opening of that Workspace. A
//! Workbench is the configurable surface inside a Workspace.

use crate::actions::DecisionRequestId;
use crate::events::WorkbenchEventId;
use crate::presets::PresetOrigin;
use crate::state::{SharedStateObject, SharedStateObjectId};
use crate::widgets::{WidgetInstance, WidgetInstanceId};

/// Identifier for a durable Workspace.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkspaceId(pub String);

impl WorkspaceId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for a runtime opening of a Workspace.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkspaceSessionId(pub String);

impl WorkspaceSessionId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for a Workbench surface inside a Workspace.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkbenchId(pub String);

impl WorkbenchId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Backward-compatible alias for earlier placeholder naming.
pub type WorkbenchSessionId = WorkspaceSessionId;

/// Durable Workspace lifecycle status.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WorkspaceStatus {
    Active,
    Paused,
    Archived,
}

/// Durable user-facing container for a specific piece of work.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Workspace {
    pub id: WorkspaceId,
    pub title: String,
    pub description: Option<String>,
    pub status: WorkspaceStatus,
    pub workbench: Workbench,
}

impl Workspace {
    pub fn new(id: WorkspaceId, title: impl Into<String>, workbench: Workbench) -> Self {
        Self {
            id,
            title: title.into(),
            description: None,
            status: WorkspaceStatus::Active,
            workbench,
        }
    }
}

/// Runtime/current opening of a Workspace.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSession {
    pub id: WorkspaceSessionId,
    pub workspace_id: WorkspaceId,
    pub active_widget_id: Option<WidgetInstanceId>,
    pub current_focus: Option<CurrentFocus>,
    pub opened_at: Option<String>,
    pub closed_at: Option<String>,
}

/// Configurable working surface inside a Workspace.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Workbench {
    pub id: WorkbenchId,
    pub preset_origin: Option<PresetOrigin>,
    pub widget_instances: Vec<WidgetInstance>,
    pub shared_state: Vec<SharedStateObject>,
}

impl Workbench {
    pub fn empty(id: WorkbenchId) -> Self {
        Self {
            id,
            preset_origin: None,
            widget_instances: Vec::new(),
            shared_state: Vec::new(),
        }
    }
}

/// Saved pointer to the operator's current focus inside a Workspace.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CurrentFocus {
    Widget(WidgetInstanceId),
    SharedState(SharedStateObjectId),
    Decision(DecisionRequestId),
    Event(WorkbenchEventId),
    Note(String),
    Other(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_can_be_constructed_with_empty_workbench() {
        let workbench = Workbench::empty(WorkbenchId::new("workbench-1"));
        let workspace = Workspace::new(WorkspaceId::new("workspace-1"), "Incident", workbench);

        assert_eq!(workspace.status, WorkspaceStatus::Active);
        assert!(workspace.workbench.widget_instances.is_empty());
        assert!(workspace.workbench.shared_state.is_empty());
    }
}
