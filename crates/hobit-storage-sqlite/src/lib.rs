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
    AgentQueueReviewMessageAckUpdate, AgentQueueTaskRunLinkFinalUpdate, AgentQueueTaskUpdate,
    AgentQueueWorkerUpdate, JdbcConnectionProfileUpdate, JdbcConnectorUpdate,
    KnowledgeDocumentSearchFilters, KnowledgeDocumentUpdate, NewAgentQueueItem,
    NewAgentQueueReviewMessage, NewAgentQueueTask, NewAgentQueueTaskRunLink, NewAgentQueueWorker,
    NewAgentQueueWorkerEvidenceBundle, NewJdbcConnectionProfile, NewJdbcConnector,
    NewKnowledgeDocument, NewKnowledgeDraftReviewRecord, NewSharedStateObject, NewSkill,
    NewWidgetInstance, NewWidgetLog, NewWidgetResult, NewWidgetRun, NewWorkspaceNote,
    NewWorkspaceSession, SkillUpdate, WidgetInstanceLayoutUpdate, WidgetRunFinishUpdate,
    WorkspaceNoteUpdate,
};
pub use rows::{
    AgentQueueItemRow, AgentQueueReviewMessageRow, AgentQueueTaskRow, AgentQueueTaskRunLinkRow,
    AgentQueueWorkerEvidenceBundleRow, AgentQueueWorkerRow, JdbcConnectionProfileRow,
    JdbcConnectorRow, KnowledgeDocumentChunkRow, KnowledgeDocumentRow,
    KnowledgeDocumentSearchResultRow, KnowledgeDraftReviewRecordRow, SharedStateObjectRow,
    SkillRow, WidgetInstanceRow, WidgetLogRow, WidgetResultRow, WidgetRunRow, WorkbenchEventRow,
    WorkspaceNoteRow, WorkspaceRow, WorkspaceSessionRow, WorkspaceSummaryRow,
    WorkspaceWorkbenchRow,
};
pub use rusqlite::Error as StorageError;
pub use store::SqliteStore;
