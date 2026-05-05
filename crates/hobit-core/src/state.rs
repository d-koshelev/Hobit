//! Shared state contracts.
//!
//! Shared state objects are named pieces of Workspace/Workbench state made
//! available through the common state and event model. They are contracts only;
//! this module does not implement storage or synchronization.

use crate::widgets::WidgetInstanceId;

/// Identifier for a shared state object.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct SharedStateObjectId(pub String);

impl SharedStateObjectId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// A named state object available to the Workbench and relevant widgets.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedStateObject {
    pub id: SharedStateObjectId,
    pub name: String,
    pub summary: Option<String>,
    pub value: String,
    pub updated_at: Option<String>,
    pub linked_widget_ids: Vec<WidgetInstanceId>,
}
