//! Reusable Workbench layout templates.
//!
//! Presets describe reusable Workbench compositions. Applying a preset copies
//! its layout/configuration into a Workspace; later Workspace layout changes do
//! not mutate the original preset unless an explicit save/update flow does so.

use crate::state::SharedStateObject;
use crate::widgets::WidgetInstance;

/// Identifier for a reusable Workbench preset.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WorkbenchPresetId(pub String);

impl WorkbenchPresetId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Backward-compatible alias for earlier placeholder naming.
pub type PresetId = WorkbenchPresetId;

/// Preset ownership/source.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PresetKind {
    System,
    User,
}

/// Reference to the preset copied into a Workspace Workbench.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PresetOrigin {
    pub preset_id: WorkbenchPresetId,
    pub kind: PresetKind,
    pub instantiated_at: Option<String>,
}

/// Reusable saved Workbench layout/configuration.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchPreset {
    pub id: WorkbenchPresetId,
    pub title: String,
    pub description: Option<String>,
    pub kind: PresetKind,
    pub widget_instances: Vec<WidgetInstance>,
    pub shared_state: Vec<SharedStateObject>,
}

impl WorkbenchPreset {
    pub fn new(id: WorkbenchPresetId, title: impl Into<String>, kind: PresetKind) -> Self {
        Self {
            id,
            title: title.into(),
            description: None,
            kind,
            widget_instances: Vec::new(),
            shared_state: Vec::new(),
        }
    }
}
