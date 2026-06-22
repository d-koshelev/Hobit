//! Input structs accepted by SQLite store mutation methods.

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWorkspaceSession<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub status: &'a str,
    pub opened_at: Option<&'a str>,
    pub closed_at: Option<&'a str>,
    pub active_widget_id: Option<&'a str>,
    pub current_focus_kind: Option<&'a str>,
    pub current_focus_ref: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetInstance<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub workbench_id: &'a str,
    pub definition_id: &'a str,
    pub title: &'a str,
    pub category: &'a str,
    pub layout_mode: &'a str,
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
    pub config: Option<&'a str>,
    pub state: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetInstanceLayoutUpdate<'a> {
    pub layout_mode: &'a str,
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
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetRun<'a> {
    pub id: &'a str,
    pub widget_instance_id: &'a str,
    pub status: &'a str,
    pub command_kind: Option<&'a str>,
    pub command_payload: Option<&'a str>,
    pub started_at: Option<&'a str>,
    pub finished_at: Option<&'a str>,
    pub summary: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WidgetRunFinishUpdate<'a> {
    pub status: &'a str,
    pub finished_at: Option<&'a str>,
    pub summary: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetLog<'a> {
    pub id: &'a str,
    pub widget_instance_id: &'a str,
    pub run_id: Option<&'a str>,
    pub level: &'a str,
    pub message: &'a str,
    pub created_at: Option<&'a str>,
    pub details: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWidgetResult<'a> {
    pub id: &'a str,
    pub run_id: &'a str,
    pub status: &'a str,
    pub result_type: Option<&'a str>,
    pub summary: Option<&'a str>,
    pub content: Option<&'a str>,
    pub payload: Option<&'a str>,
    pub created_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueItem<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub workbench_id: &'a str,
    pub source_run_id: &'a str,
    pub source_result_id: &'a str,
    pub source_widget_instance_id: &'a str,
    pub title: &'a str,
    pub status: &'a str,
    pub payload_json: &'a str,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueTask<'a> {
    pub queue_item_id: &'a str,
    pub workspace_id: &'a str,
    pub title: &'a str,
    pub description: &'a str,
    pub prompt: &'a str,
    pub status: &'a str,
    pub priority: i64,
    pub depends_on: Option<&'a str>,
    pub execution_policy: Option<&'a str>,
    pub execution_workspace: Option<&'a str>,
    pub codex_executable: Option<&'a str>,
    pub sandbox: Option<&'a str>,
    pub approval_policy: Option<&'a str>,
    pub context_json: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskUpdate<'a> {
    pub title: &'a str,
    pub description: &'a str,
    pub prompt: &'a str,
    pub status: &'a str,
    pub priority: i64,
    pub depends_on: Option<&'a str>,
    pub execution_policy: Option<&'a str>,
    pub execution_workspace: Option<&'a str>,
    pub codex_executable: Option<&'a str>,
    pub sandbox: Option<&'a str>,
    pub approval_policy: Option<&'a str>,
    pub context_json: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueTaskRunLink<'a> {
    pub link_id: &'a str,
    pub workspace_id: &'a str,
    pub queue_task_id: &'a str,
    pub executor_widget_id: &'a str,
    pub direct_work_run_id: &'a str,
    pub source: &'a str,
    pub status: &'a str,
    pub started_at: Option<&'a str>,
    pub completed_at: Option<&'a str>,
    pub validation_status: Option<&'a str>,
    pub review_status: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueTaskRunLinkFinalUpdate<'a> {
    pub status: &'a str,
    pub completed_at: Option<&'a str>,
    pub validation_status: Option<&'a str>,
    pub review_status: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueReviewMessage<'a> {
    pub message_id: &'a str,
    pub workspace_id: &'a str,
    pub queue_task_id: &'a str,
    pub run_id: Option<&'a str>,
    pub run_link_id: Option<&'a str>,
    pub actor_id: &'a str,
    pub message_body: &'a str,
    pub status: &'a str,
    pub created_at: Option<&'a str>,
    pub acked_at: Option<&'a str>,
    pub ack_actor_id: Option<&'a str>,
    pub metadata_json: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueWorkerEvidenceBundle<'a> {
    pub bundle_id: &'a str,
    pub workspace_id: &'a str,
    pub queue_task_id: &'a str,
    pub run_id: &'a str,
    pub run_link_id: Option<&'a str>,
    pub executor_widget_id: Option<&'a str>,
    pub worker_id: Option<&'a str>,
    pub source: &'a str,
    pub outcome: &'a str,
    pub summary: &'a str,
    pub changed_files_json: &'a str,
    pub changed_files_count: i64,
    pub changed_files_summary: Option<&'a str>,
    pub validation_summary: Option<&'a str>,
    pub error_summary: Option<&'a str>,
    pub metadata_json: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueCompletionDecision<'a> {
    pub decision_id: &'a str,
    pub workspace_id: &'a str,
    pub queue_task_id: &'a str,
    pub run_id: Option<&'a str>,
    pub run_link_id: Option<&'a str>,
    pub review_message_id: Option<&'a str>,
    pub actor_id: &'a str,
    pub decision: &'a str,
    pub reason: Option<&'a str>,
    pub metadata_json: Option<&'a str>,
    pub created_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueFailureDecision<'a> {
    pub decision_id: &'a str,
    pub workspace_id: &'a str,
    pub queue_task_id: &'a str,
    pub run_id: Option<&'a str>,
    pub run_link_id: Option<&'a str>,
    pub evidence_bundle_id: Option<&'a str>,
    pub review_message_id: Option<&'a str>,
    pub actor_id: &'a str,
    pub decision: &'a str,
    pub reason: &'a str,
    pub metadata_json: Option<&'a str>,
    pub created_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueReviewMessageAckUpdate<'a> {
    pub actor_id: &'a str,
    pub status: &'a str,
    pub acked_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueWorker<'a> {
    pub worker_id: &'a str,
    pub workspace_id: &'a str,
    pub name: &'a str,
    pub enabled: bool,
    pub scope_kind: &'a str,
    pub queue_tag_id: Option<&'a str>,
    pub queue_tag_name: Option<&'a str>,
    pub display_order: i64,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkerUpdate<'a> {
    pub name: &'a str,
    pub enabled: bool,
    pub scope_kind: &'a str,
    pub queue_tag_id: Option<&'a str>,
    pub queue_tag_name: Option<&'a str>,
    pub display_order: i64,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueWorkflowRun<'a> {
    pub workflow_run_id: &'a str,
    pub workspace_id: &'a str,
    pub workflow_id: &'a str,
    pub request_id: &'a str,
    pub request_hash: &'a str,
    pub status: &'a str,
    pub phase: &'a str,
    pub current_step: Option<&'a str>,
    pub pause_reason: Option<&'a str>,
    pub blocker_reason: Option<&'a str>,
    pub actor_id: Option<&'a str>,
    pub inputs_snapshot_json: Option<&'a str>,
    pub grant_summary_json: Option<&'a str>,
    pub variables_json: Option<&'a str>,
    pub slot_bindings_json: Option<&'a str>,
    pub mutation_refs_json: Option<&'a str>,
    pub idempotency_keys_json: Option<&'a str>,
    pub action_log_summary_json: Option<&'a str>,
    pub version: i64,
    pub schema_version: i64,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
    pub completed_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkflowRunStatusUpdate<'a> {
    pub status: &'a str,
    pub phase: Option<&'a str>,
    pub current_step: Option<&'a str>,
    pub pause_reason: Option<&'a str>,
    pub blocker_reason: Option<&'a str>,
    pub updated_at: Option<&'a str>,
    pub completed_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewAgentQueueWorkflowAction<'a> {
    pub action_id: &'a str,
    pub workflow_run_id: &'a str,
    pub workspace_id: &'a str,
    pub step_id: &'a str,
    pub action_type: &'a str,
    pub idempotency_key: &'a str,
    pub status: &'a str,
    pub target_refs_json: Option<&'a str>,
    pub result_refs_json: Option<&'a str>,
    pub blocker_code: Option<&'a str>,
    pub blocker_message: Option<&'a str>,
    pub attempt_count: i64,
    pub started_at: Option<&'a str>,
    pub completed_at: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentQueueWorkflowActionUpdate<'a> {
    pub status: &'a str,
    pub result_refs_json: Option<&'a str>,
    pub blocker_code: Option<&'a str>,
    pub blocker_message: Option<&'a str>,
    pub attempt_count: Option<i64>,
    pub started_at: Option<&'a str>,
    pub completed_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewWorkspaceNote<'a> {
    pub note_id: &'a str,
    pub workspace_id: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub pinned: bool,
    pub archived: bool,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkspaceNoteUpdate<'a> {
    pub title: &'a str,
    pub body: &'a str,
    pub pinned: bool,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewSkill<'a> {
    pub skill_id: &'a str,
    pub workspace_id: &'a str,
    pub title: &'a str,
    pub when_to_use: &'a str,
    pub prerequisites: &'a str,
    pub steps: &'a str,
    pub validation: &'a str,
    pub risks: &'a str,
    pub tags: &'a str,
    pub review_status: &'a str,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SkillUpdate<'a> {
    pub title: &'a str,
    pub when_to_use: &'a str,
    pub prerequisites: &'a str,
    pub steps: &'a str,
    pub validation: &'a str,
    pub risks: &'a str,
    pub tags: &'a str,
    pub review_status: &'a str,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewKnowledgeDocument<'a> {
    pub knowledge_document_id: &'a str,
    pub workspace_id: &'a str,
    pub scope: Option<&'a str>,
    pub catalog_item_type: Option<&'a str>,
    pub quick_summary: Option<&'a str>,
    pub lifecycle_status: Option<&'a str>,
    pub title: &'a str,
    pub source_label: &'a str,
    pub source_kind: Option<&'a str>,
    pub source_ref: Option<&'a str>,
    pub source_refs: Option<&'a str>,
    pub relations: Option<&'a str>,
    pub content: &'a str,
    pub tags: &'a str,
    pub enabled: bool,
    pub searchable: bool,
    pub version_summary: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
    pub reviewed_at: Option<&'a str>,
    pub created_by_task_id: Option<&'a str>,
    pub created_from_run_id: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KnowledgeDocumentUpdate<'a> {
    pub scope: Option<&'a str>,
    pub catalog_item_type: Option<&'a str>,
    pub quick_summary: Option<&'a str>,
    pub lifecycle_status: Option<&'a str>,
    pub title: &'a str,
    pub source_label: &'a str,
    pub source_kind: Option<&'a str>,
    pub source_ref: Option<&'a str>,
    pub source_refs: Option<&'a str>,
    pub relations: Option<&'a str>,
    pub content: &'a str,
    pub tags: &'a str,
    pub enabled: bool,
    pub searchable: bool,
    pub version_summary: Option<&'a str>,
    pub updated_at: Option<&'a str>,
    pub reviewed_at: Option<&'a str>,
    pub created_by_task_id: Option<&'a str>,
    pub created_from_run_id: Option<&'a str>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct KnowledgeDocumentSearchFilters {
    pub scopes: Vec<String>,
    pub catalog_item_types: Vec<String>,
    pub lifecycle_statuses: Vec<String>,
    pub tags: Vec<String>,
    pub source_kinds: Vec<String>,
    pub updated_after: Option<String>,
    pub updated_within_days: Option<u32>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewKnowledgeDraftReviewRecord<'a> {
    pub review_id: &'a str,
    pub workspace_id: &'a str,
    pub draft_pack_id: &'a str,
    pub source_fingerprint: &'a str,
    pub source_queue_item_id: Option<&'a str>,
    pub source_run_id: Option<&'a str>,
    pub proposed_item_id: &'a str,
    pub proposed_item_key: &'a str,
    pub action: &'a str,
    pub reviewed_at: Option<&'a str>,
    pub accepted_knowledge_document_id: Option<&'a str>,
    pub accepted_skill_id: Option<&'a str>,
    pub rejection_reason: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewJdbcConnector<'a> {
    pub connector_id: &'a str,
    pub workspace_id: &'a str,
    pub display_name: &'a str,
    pub database_kind: &'a str,
    pub driver_kind: &'a str,
    pub jdbc_url_masked: &'a str,
    pub environment: &'a str,
    pub read_only_default: bool,
    pub status: &'a str,
    pub notes: &'a str,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
    pub last_used_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcConnectorUpdate<'a> {
    pub display_name: &'a str,
    pub database_kind: &'a str,
    pub driver_kind: &'a str,
    pub jdbc_url_masked: &'a str,
    pub environment: &'a str,
    pub read_only_default: bool,
    pub status: &'a str,
    pub notes: &'a str,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewJdbcConnectionProfile<'a> {
    pub profile_id: &'a str,
    pub workspace_id: &'a str,
    pub name: &'a str,
    pub driver_jar_path: &'a str,
    pub driver_class_name: &'a str,
    pub jdbc_url: &'a str,
    pub username: Option<&'a str>,
    pub password_env_var_name: Option<&'a str>,
    pub max_rows: i64,
    pub timeout_ms: i64,
    pub max_result_bytes: i64,
    pub read_only: bool,
    pub description: &'a str,
    pub created_at: Option<&'a str>,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JdbcConnectionProfileUpdate<'a> {
    pub name: &'a str,
    pub driver_jar_path: &'a str,
    pub driver_class_name: &'a str,
    pub jdbc_url: &'a str,
    pub username: Option<&'a str>,
    pub password_env_var_name: Option<&'a str>,
    pub max_rows: i64,
    pub timeout_ms: i64,
    pub max_result_bytes: i64,
    pub read_only: bool,
    pub description: &'a str,
    pub updated_at: Option<&'a str>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewSharedStateObject<'a> {
    pub id: &'a str,
    pub workspace_id: &'a str,
    pub key: &'a str,
    pub value: &'a str,
    pub value_kind: &'a str,
}
