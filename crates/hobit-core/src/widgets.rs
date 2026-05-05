//! First-class widget runtime contract types.
//!
//! Widgets are durable Workbench entities, not only frontend components. This
//! module models their definition/instance split, input-command-run-log-result
//! lifecycle, local console output, and presentation state for docked,
//! minimized, and popped-out widgets.

/// Identifier for a reusable widget definition.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetDefinitionId(pub String);

impl WidgetDefinitionId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for a reusable widget template.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetTemplateId(pub String);

impl WidgetTemplateId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for a configured widget instance in a Workbench.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetInstanceId(pub String);

impl WidgetInstanceId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Identifier for a single widget command/action run.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetRunId(pub String);

impl WidgetRunId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
}

/// Widget categories are broad product capability groups, not concrete widgets.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetCategory {
    Core,
    Tool,
    Codebase,
    Database,
    Design,
    Knowledge,
    Workflow,
    Notes,
    Other(String),
}

/// A reusable widget type available to the Workbench.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetDefinition {
    pub id: WidgetDefinitionId,
    pub title: String,
    pub category: WidgetCategory,
    pub description: String,
    pub default_title: String,
    pub default_config: Vec<(String, String)>,
}

/// A reusable starting point for creating a widget instance.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetTemplate {
    pub id: WidgetTemplateId,
    pub definition_id: WidgetDefinitionId,
    pub title: String,
    pub description: Option<String>,
    pub default_config: Vec<(String, String)>,
    pub default_layout: Option<WidgetLayout>,
}

/// A configured widget placed in a Workspace Workbench.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstance {
    pub id: WidgetInstanceId,
    pub definition_id: WidgetDefinitionId,
    pub template_id: Option<WidgetTemplateId>,
    pub title: String,
    pub config: Vec<(String, String)>,
    pub input: WidgetInput,
    pub layout: WidgetLayout,
    pub presentation: WidgetPresentationState,
    pub state: Vec<(String, String)>,
}

/// Presentation mode for a widget instance.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetLayoutMode {
    Docked,
    PoppedOut,
    Minimized,
}

/// Pixel geometry for resizable/repositionable widget surfaces.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub min_width: Option<u32>,
    pub min_height: Option<u32>,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

impl WidgetGeometry {
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
            min_width: None,
            min_height: None,
            max_width: None,
            max_height: None,
        }
    }
}

/// Layout state for a widget docked inside the Workbench surface.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DockedWidgetLayout {
    pub area: String,
    pub order: u32,
    pub geometry: WidgetGeometry,
}

/// Layout/window state for a popped-out widget.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PopoutWidgetLayout {
    pub geometry: WidgetGeometry,
    pub screen: Option<String>,
    pub always_on_top: bool,
}

/// Layout state that survives presentation changes.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLayout {
    pub docked: DockedWidgetLayout,
    pub popout: Option<PopoutWidgetLayout>,
}

/// Placeholder shown where a popped-out widget remains anchored in the Workbench.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetGhostState {
    pub widget_instance_id: WidgetInstanceId,
    pub title: String,
    pub docked_layout: DockedWidgetLayout,
    pub last_status: Option<WidgetRunStatus>,
}

/// Current presentation state for a widget instance.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetPresentationState {
    pub mode: WidgetLayoutMode,
    pub ghost: Option<WidgetGhostState>,
}

impl WidgetPresentationState {
    pub fn docked() -> Self {
        Self {
            mode: WidgetLayoutMode::Docked,
            ghost: None,
        }
    }

    pub fn popped_out(ghost: WidgetGhostState) -> Self {
        Self {
            mode: WidgetLayoutMode::PoppedOut,
            ghost: Some(ghost),
        }
    }

    pub fn minimized() -> Self {
        Self {
            mode: WidgetLayoutMode::Minimized,
            ghost: None,
        }
    }
}

/// Input data and context currently available to a widget.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInput {
    pub data: Vec<(String, String)>,
    pub context: Vec<String>,
}

/// Source that requested a widget command/action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetCommandSource {
    Operator,
    Agent,
    System,
}

/// Risk level attached to a widget command/action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetRiskLevel {
    Low,
    Medium,
    High,
    Destructive,
}

/// Command or action submitted to a widget.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetCommand {
    pub id: String,
    pub command_type: String,
    pub payload: String,
    pub source: WidgetCommandSource,
    pub requires_approval: bool,
    pub risk: WidgetRiskLevel,
}

/// Runtime status of a widget command/action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetRunStatus {
    Idle,
    InputReady,
    WaitingForApproval,
    Running,
    ResultReady,
    Completed,
    Failed,
    Cancelled,
}

/// A single execution of a widget command/action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRun {
    pub id: WidgetRunId,
    pub widget_instance_id: WidgetInstanceId,
    pub input: WidgetInput,
    pub command: WidgetCommand,
    pub status: WidgetRunStatus,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
}

/// Severity level for widget-local console output.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetLogLevel {
    Debug,
    Info,
    Warning,
    Error,
}

/// Widget-local console/log entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLogEntry {
    pub id: String,
    pub widget_instance_id: WidgetInstanceId,
    pub run_id: Option<WidgetRunId>,
    pub level: WidgetLogLevel,
    pub message: String,
    pub timestamp: Option<String>,
    pub details: String,
}

/// Status of structured output produced by a widget run.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetResultStatus {
    Pending,
    Ready,
    Completed,
    Failed,
}

/// Structured final output produced by a widget run.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetResult {
    pub id: String,
    pub run_id: WidgetRunId,
    pub status: WidgetResultStatus,
    pub result_type: String,
    pub summary: String,
    pub content: String,
    pub payload: Vec<(String, String)>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn popped_out_presentation_keeps_ghost_anchor() {
        let instance_id = WidgetInstanceId::new("widget-1");
        let docked_layout = DockedWidgetLayout {
            area: "main".to_owned(),
            order: 0,
            geometry: WidgetGeometry::new(0, 0, 480, 320),
        };

        let ghost = WidgetGhostState {
            widget_instance_id: instance_id,
            title: "Notes".to_owned(),
            docked_layout,
            last_status: Some(WidgetRunStatus::Idle),
        };

        let presentation = WidgetPresentationState::popped_out(ghost);

        assert_eq!(presentation.mode, WidgetLayoutMode::PoppedOut);
        assert!(presentation.ghost.is_some());
    }
}
