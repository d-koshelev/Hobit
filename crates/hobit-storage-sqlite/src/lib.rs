//! SQLite persistence foundation for Hobit.
//!
//! This crate owns the initial local storage schema and small row-level storage
//! primitives for Workspace, Workbench, Widget runtime state, Shared State, and
//! Workbench events. It does not implement an app runtime, Tauri integration,
//! frontend behavior, or concrete widgets.

#![forbid(unsafe_code)]

pub mod schema;
pub mod store;

pub use rusqlite::Error as StorageError;
pub use store::{
    NewSharedStateObject, NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun,
    NewWorkspaceSession, SharedStateObjectRow, SqliteStore, WidgetInstanceRow, WidgetLogRow,
    WidgetResultRow, WidgetRunRow, WorkbenchEventRow, WorkspaceRow, WorkspaceSessionRow,
    WorkspaceWorkbenchRow,
};
