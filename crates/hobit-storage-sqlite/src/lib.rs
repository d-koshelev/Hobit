//! SQLite persistence foundation for Hobit.
//!
//! This crate owns the initial local storage schema and small row-level storage
//! primitives for Workspace, Workbench, Widget runtime state, Shared State, and
//! Workbench events. It does not implement an app runtime, Tauri integration,
//! frontend behavior, or concrete widgets.

#![forbid(unsafe_code)]

pub mod schema;
pub mod store;

mod inputs;
mod mappers;
mod rows;
mod time;

pub use inputs::{
    AgentQueueTaskRunLinkFinalUpdate, AgentQueueTaskUpdate, JdbcConnectorUpdate, NewAgentQueueItem,
    NewAgentQueueTask, NewAgentQueueTaskRunLink, NewJdbcConnector, NewSharedStateObject, NewSkill,
    NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun, NewWorkspaceNote,
    NewWorkspaceSession, SkillUpdate, WidgetInstanceLayoutUpdate, WidgetRunFinishUpdate,
    WorkspaceNoteUpdate,
};
pub use rows::{
    AgentQueueItemRow, AgentQueueTaskRow, AgentQueueTaskRunLinkRow, JdbcConnectorRow,
    SharedStateObjectRow, SkillRow, WidgetInstanceRow, WidgetLogRow, WidgetResultRow, WidgetRunRow,
    WorkbenchEventRow, WorkspaceNoteRow, WorkspaceRow, WorkspaceSessionRow, WorkspaceSummaryRow,
    WorkspaceWorkbenchRow,
};
pub use rusqlite::Error as StorageError;
pub use store::SqliteStore;
