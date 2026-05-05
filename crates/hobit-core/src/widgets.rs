//! Widget contract types.
//!
//! A widget is a first-class workbench entity. It is not only a frontend
//! component: it has input data, receives commands/actions, emits local logs,
//! and produces structured results while preserving identity across layout
//! changes such as pop-out and dock/return.

/// Identifier for a reusable widget definition.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetDefinitionId(pub String);

/// Identifier for a configured widget instance in a workbench session.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetInstanceId(pub String);

/// Identifier for a reusable widget template.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetTemplateId(pub String);

/// Identifier for a widget run/action execution.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct WidgetRunId(pub String);

/// Source that requested a widget command/action.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetCommandSource {
    Operator,
    Agent,
    System,
}

/// Presentation mode for a widget instance.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WidgetLayoutMode {
    Docked,
    PoppedOut,
    Minimized,
}

/// Pixel geometry for docked or popped-out widget placement.
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

/// Window-level state for a popped-out widget.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetPopoutState {
    pub geometry: WidgetGeometry,
    pub screen: Option<String>,
    pub always_on_top: bool,
}

/// Layout and presentation state for a widget instance.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLayout {
    pub mode: WidgetLayoutMode,
    pub docked: WidgetGeometry,
    pub popout: Option<WidgetPopoutState>,
    pub original_slot: Option<String>,
}

/// Input data currently available to a widget.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInput {
    pub data: Vec<(String, String)>,
    pub context: Vec<(String, String)>,
}

/// Command or action submitted to a widget.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetCommand {
    pub id: String,
    pub command_type: String,
    pub payload: Vec<(String, String)>,
    pub source: WidgetCommandSource,
    pub requires_approval: bool,
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

/// A single widget command/action run.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRun {
    pub id: WidgetRunId,
    pub widget_instance_id: WidgetInstanceId,
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
    pub run_id: WidgetRunId,
    pub level: WidgetLogLevel,
    pub message: String,
    pub timestamp: String,
    pub details: Vec<(String, String)>,
}

/// Structured final result produced by a widget run.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetResult {
    pub id: String,
    pub run_id: WidgetRunId,
    pub result_type: String,
    pub summary: String,
    pub payload: Vec<(String, String)>,
}
