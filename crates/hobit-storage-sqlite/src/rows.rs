//! Row structs returned by SQLite store query methods.

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceRow {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSummaryRow {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
    pub widget_count: i64,
    pub workspace_agent_count: i64,
    pub note_count: i64,
    pub skill_count: i64,
    pub knowledge_document_count: i64,
    pub queue_task_count: i64,
    pub workbench_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceWorkbenchRow {
    pub id: String,
    pub workspace_id: String,
    pub preset_origin_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceSessionRow {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub active_widget_id: Option<String>,
    pub current_focus_kind: Option<String>,
    pub current_focus_ref: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstanceRow {
    pub id: String,
    pub workspace_id: String,
    pub workbench_id: String,
    pub definition_id: String,
    pub title: String,
    pub category: String,
    pub layout_mode: String,
    pub dock_x: Option<i64>,
    pub dock_y: Option<i64>,
    pub dock_width: Option<i64>,
    pub dock_height: Option<i64>,
    pub popout_x: Option<i64>,
    pub popout_y: Option<i64>,
    pub popout_width: Option<i64>,
    pub popout_height: Option<i64>,
    pub always_on_top: bool,
    pub is_visible: bool,
    pub config: Option<String>,
    pub state: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunRow {
    pub id: String,
    pub widget_instance_id: String,
    pub status: String,
    pub command_kind: Option<String>,
    pub command_payload: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub summary: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetLogRow {
    pub id: String,
    pub widget_instance_id: String,
    pub run_id: Option<String>,
    pub level: String,
    pub message: String,
    pub created_at: String,
    pub details: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetResultRow {
    pub id: String,
    pub run_id: String,
    pub status: String,
    pub result_type: String,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueItemRow {
    pub id: String,
    pub workspace_id: String,
    pub workbench_id: String,
    pub source_run_id: String,
    pub source_result_id: String,
    pub source_widget_instance_id: String,
    pub title: String,
    pub status: String,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskRow {
    pub queue_item_id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: String,
    pub prompt: String,
    pub status: String,
    pub priority: i64,
    pub depends_on: String,
    pub execution_policy: String,
    pub execution_workspace: Option<String>,
    pub codex_executable: Option<String>,
    pub sandbox: Option<String>,
    pub approval_policy: Option<String>,
    pub context_json: Option<String>,
    pub assigned_executor_widget_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskRunLinkRow {
    pub link_id: String,
    pub workspace_id: String,
    pub queue_task_id: String,
    pub executor_widget_id: String,
    pub direct_work_run_id: String,
    pub source: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub validation_status: Option<String>,
    pub review_status: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueReviewMessageRow {
    pub message_id: String,
    pub workspace_id: String,
    pub queue_task_id: String,
    pub run_id: Option<String>,
    pub run_link_id: Option<String>,
    pub actor_id: String,
    pub message_body: String,
    pub status: String,
    pub created_at: String,
    pub acked_at: Option<String>,
    pub ack_actor_id: Option<String>,
    pub metadata_json: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkerRow {
    pub worker_id: String,
    pub workspace_id: String,
    pub name: String,
    pub enabled: bool,
    pub scope_kind: String,
    pub queue_tag_id: Option<String>,
    pub queue_tag_name: Option<String>,
    pub display_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceNoteRow {
    pub note_id: String,
    pub workspace_id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SkillRow {
    pub skill_id: String,
    pub workspace_id: String,
    pub title: String,
    pub when_to_use: String,
    pub prerequisites: String,
    pub steps: String,
    pub validation: String,
    pub risks: String,
    pub tags: String,
    pub review_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDocumentRow {
    pub knowledge_document_id: String,
    pub workspace_id: String,
    pub scope: String,
    pub catalog_item_type: String,
    pub quick_summary: String,
    pub lifecycle_status: String,
    pub title: String,
    pub source_label: String,
    pub source_kind: String,
    pub source_ref: String,
    pub source_refs: String,
    pub relations: String,
    pub content: String,
    pub tags: String,
    pub enabled: bool,
    pub searchable: bool,
    pub version: i64,
    pub version_summary: String,
    pub created_at: String,
    pub updated_at: String,
    pub reviewed_at: Option<String>,
    pub created_by_task_id: Option<String>,
    pub created_from_run_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDocumentChunkRow {
    pub chunk_id: String,
    pub knowledge_document_id: String,
    pub workspace_id: String,
    pub scope: String,
    pub chunk_index: i64,
    pub text: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDocumentSearchResultRow {
    pub knowledge_document_id: String,
    pub document_title: String,
    pub scope: String,
    pub catalog_item_type: String,
    pub lifecycle_status: String,
    pub source_label: String,
    pub source_kind: String,
    pub tags: String,
    pub updated_at: String,
    pub chunk_id: String,
    pub chunk_index: i64,
    pub text: String,
    pub score: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDraftReviewRecordRow {
    pub review_id: String,
    pub workspace_id: String,
    pub draft_pack_id: String,
    pub source_fingerprint: String,
    pub source_queue_item_id: Option<String>,
    pub source_run_id: Option<String>,
    pub proposed_item_id: String,
    pub proposed_item_key: String,
    pub action: String,
    pub reviewed_at: String,
    pub accepted_knowledge_document_id: Option<String>,
    pub accepted_skill_id: Option<String>,
    pub rejection_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcConnectorRow {
    pub connector_id: String,
    pub workspace_id: String,
    pub display_name: String,
    pub database_kind: String,
    pub driver_kind: String,
    pub jdbc_url_masked: String,
    pub environment: String,
    pub read_only_default: bool,
    pub status: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcConnectionProfileRow {
    pub profile_id: String,
    pub workspace_id: String,
    pub name: String,
    pub driver_jar_path: String,
    pub driver_class_name: String,
    pub jdbc_url: String,
    pub username: Option<String>,
    pub password_env_var_name: Option<String>,
    pub max_rows: i64,
    pub timeout_ms: i64,
    pub max_result_bytes: i64,
    pub read_only: bool,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedStateObjectRow {
    pub id: String,
    pub workspace_id: String,
    pub key: String,
    pub value: String,
    pub value_kind: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkbenchEventRow {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    pub summary: String,
    pub payload: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TableColumn {
    pub(crate) name: String,
    pub(crate) not_null: bool,
}
