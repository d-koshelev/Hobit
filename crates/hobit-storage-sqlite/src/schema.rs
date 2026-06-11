//! Idempotent SQLite schema for Hobit storage.

pub const INIT_SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    status TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT NULL,
    active_widget_id TEXT NULL,
    current_focus_kind TEXT NULL,
    current_focus_ref TEXT NULL
);

CREATE TABLE IF NOT EXISTS workbench_presets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_workbenches (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    preset_origin_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS widget_instances (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    workbench_id TEXT NOT NULL REFERENCES workspace_workbenches(id),
    definition_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    layout_mode TEXT NOT NULL,
    dock_x INTEGER NULL,
    dock_y INTEGER NULL,
    dock_width INTEGER NULL,
    dock_height INTEGER NULL,
    popout_x INTEGER NULL,
    popout_y INTEGER NULL,
    popout_width INTEGER NULL,
    popout_height INTEGER NULL,
    always_on_top INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1,
    config TEXT NULL,
    state TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS widget_runs (
    id TEXT PRIMARY KEY,
    widget_instance_id TEXT NOT NULL REFERENCES widget_instances(id),
    status TEXT NOT NULL,
    command_kind TEXT NULL,
    command_payload TEXT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT NULL,
    summary TEXT NULL
);

CREATE TABLE IF NOT EXISTS widget_logs (
    id TEXT PRIMARY KEY,
    widget_instance_id TEXT NOT NULL REFERENCES widget_instances(id),
    run_id TEXT NULL REFERENCES widget_runs(id),
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    details TEXT NULL
);

CREATE TABLE IF NOT EXISTS widget_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES widget_runs(id),
    status TEXT NOT NULL,
    result_type TEXT NOT NULL DEFAULT 'generic',
    summary TEXT NULL,
    content TEXT NULL,
    payload TEXT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_queue_items (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    workbench_id TEXT NOT NULL REFERENCES workspace_workbenches(id),
    source_run_id TEXT NOT NULL REFERENCES widget_runs(id),
    source_result_id TEXT NOT NULL REFERENCES widget_results(id),
    source_widget_instance_id TEXT NOT NULL REFERENCES widget_instances(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_queue_tasks (
    queue_item_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    priority INTEGER NOT NULL,
    depends_on TEXT NOT NULL DEFAULT '[]',
    execution_policy TEXT NOT NULL DEFAULT 'manual',
    execution_workspace TEXT NULL,
    codex_executable TEXT NULL,
    sandbox TEXT NULL,
    approval_policy TEXT NULL,
    context_json TEXT NULL,
    assigned_executor_widget_id TEXT NULL REFERENCES widget_instances(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_queue_task_run_links (
    link_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    queue_task_id TEXT NOT NULL REFERENCES agent_queue_tasks(queue_item_id) ON DELETE CASCADE,
    executor_widget_id TEXT NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
    direct_work_run_id TEXT NOT NULL UNIQUE REFERENCES widget_runs(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NULL,
    validation_status TEXT NULL,
    review_status TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_queue_workers (
    worker_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    scope_kind TEXT NOT NULL,
    queue_tag_id TEXT NULL,
    queue_tag_name TEXT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    note_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
    skill_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    when_to_use TEXT NOT NULL,
    prerequisites TEXT NOT NULL,
    steps TEXT NOT NULL,
    validation TEXT NOT NULL,
    risks TEXT NOT NULL,
    tags TEXT NOT NULL,
    review_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    knowledge_document_id TEXT PRIMARY KEY,
    workspace_id TEXT NULL REFERENCES workspaces(id),
    scope TEXT NOT NULL DEFAULT 'workspace',
    catalog_item_type TEXT NOT NULL DEFAULT 'documentation_knowledge',
    quick_summary TEXT NOT NULL DEFAULT '',
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    title TEXT NOT NULL,
    source_label TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'operator_authored',
    source_ref TEXT NOT NULL DEFAULT '',
    source_refs TEXT NOT NULL DEFAULT '[]',
    relations TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL,
    tags TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    searchable INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    version_summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    reviewed_at TEXT NULL,
    created_by_task_id TEXT NULL,
    created_from_run_id TEXT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_document_versions (
    knowledge_document_version_id TEXT PRIMARY KEY,
    knowledge_document_id TEXT NOT NULL REFERENCES knowledge_documents(knowledge_document_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    version_summary TEXT NOT NULL DEFAULT '',
    lifecycle_status TEXT NOT NULL,
    source_refs TEXT NOT NULL DEFAULT '[]',
    relations TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
    chunk_id TEXT PRIMARY KEY,
    knowledge_document_id TEXT NOT NULL REFERENCES knowledge_documents(knowledge_document_id) ON DELETE CASCADE,
    workspace_id TEXT NULL REFERENCES workspaces(id),
    scope TEXT NOT NULL DEFAULT 'workspace',
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_draft_review_ledger (
    review_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    draft_pack_id TEXT NOT NULL,
    source_fingerprint TEXT NOT NULL DEFAULT '',
    source_queue_item_id TEXT NULL,
    source_run_id TEXT NULL,
    proposed_item_id TEXT NOT NULL,
    proposed_item_key TEXT NOT NULL,
    action TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    accepted_knowledge_document_id TEXT NULL REFERENCES knowledge_documents(knowledge_document_id) ON DELETE SET NULL,
    accepted_skill_id TEXT NULL REFERENCES skills(skill_id) ON DELETE SET NULL,
    rejection_reason TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(workspace_id, draft_pack_id, proposed_item_id)
);

CREATE TABLE IF NOT EXISTS jdbc_connectors (
    connector_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    display_name TEXT NOT NULL,
    database_kind TEXT NOT NULL,
    driver_kind TEXT NOT NULL,
    jdbc_url_masked TEXT NOT NULL,
    environment TEXT NOT NULL,
    read_only_default INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_used_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS jdbc_connection_profiles (
    profile_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    driver_jar_path TEXT NOT NULL,
    driver_class_name TEXT NOT NULL,
    jdbc_url TEXT NOT NULL,
    username TEXT NULL,
    password_env_var_name TEXT NULL,
    max_rows INTEGER NOT NULL,
    timeout_ms INTEGER NOT NULL,
    max_result_bytes INTEGER NOT NULL,
    read_only INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_state_objects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    "key" TEXT NOT NULL,
    value TEXT NOT NULL,
    value_kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workbench_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload TEXT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_sessions_workspace_id
    ON workspace_sessions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_workbenches_workspace_id
    ON workspace_workbenches(workspace_id);

CREATE INDEX IF NOT EXISTS idx_widget_instances_workspace_id
    ON widget_instances(workspace_id);

CREATE INDEX IF NOT EXISTS idx_widget_instances_workbench_id
    ON widget_instances(workbench_id);

CREATE INDEX IF NOT EXISTS idx_widget_runs_widget_instance_id
    ON widget_runs(widget_instance_id);

CREATE INDEX IF NOT EXISTS idx_widget_results_run_id
    ON widget_results(run_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_items_workspace_id
    ON agent_queue_items(workspace_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_items_workbench_id
    ON agent_queue_items(workbench_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_items_source_result_id
    ON agent_queue_items(source_result_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_tasks_workspace_id
    ON agent_queue_tasks(workspace_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_tasks_workspace_ordering
    ON agent_queue_tasks(workspace_id, priority, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_notes_workspace_id
    ON notes(workspace_id);

CREATE INDEX IF NOT EXISTS idx_notes_workspace_ordering
    ON notes(workspace_id, archived, pinned, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_skills_workspace_id
    ON skills(workspace_id);

CREATE INDEX IF NOT EXISTS idx_skills_workspace_ordering
    ON skills(workspace_id, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace_id
    ON knowledge_documents(workspace_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace_ordering
    ON knowledge_documents(workspace_id, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_document_id
    ON knowledge_document_chunks(knowledge_document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_versions_document_id
    ON knowledge_document_versions(knowledge_document_id, version);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_workspace_id
    ON knowledge_document_chunks(workspace_id);

CREATE INDEX IF NOT EXISTS idx_jdbc_connectors_workspace_id
    ON jdbc_connectors(workspace_id);

CREATE INDEX IF NOT EXISTS idx_jdbc_connectors_workspace_ordering
    ON jdbc_connectors(workspace_id, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_jdbc_connection_profiles_workspace_id
    ON jdbc_connection_profiles(workspace_id);

CREATE INDEX IF NOT EXISTS idx_jdbc_connection_profiles_workspace_ordering
    ON jdbc_connection_profiles(workspace_id, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_shared_state_objects_workspace_id
    ON shared_state_objects(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workbench_events_workspace_id
    ON workbench_events(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workbench_events_workspace_created_at
    ON workbench_events(workspace_id, created_at);
"#;

pub const POST_INIT_SCHEMA: &str = r#"
CREATE INDEX IF NOT EXISTS idx_widget_logs_widget_instance_id
    ON widget_logs(widget_instance_id);

CREATE INDEX IF NOT EXISTS idx_widget_logs_run_id
    ON widget_logs(run_id);

CREATE INDEX IF NOT EXISTS idx_widget_logs_widget_instance_created_at
    ON widget_logs(widget_instance_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_queue_tasks_assigned_executor_widget_id
    ON agent_queue_tasks(assigned_executor_widget_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_tasks_dependencies
    ON agent_queue_tasks(workspace_id, depends_on);

CREATE INDEX IF NOT EXISTS idx_agent_queue_task_run_links_task_started
    ON agent_queue_task_run_links(workspace_id, queue_task_id, started_at);

CREATE INDEX IF NOT EXISTS idx_agent_queue_task_run_links_run_id
    ON agent_queue_task_run_links(direct_work_run_id);

CREATE INDEX IF NOT EXISTS idx_agent_queue_workers_workspace_order
    ON agent_queue_workers(workspace_id, display_order, created_at);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_scope
    ON knowledge_documents(scope);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_chunks_scope
    ON knowledge_document_chunks(scope);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_searchable
    ON knowledge_documents(searchable);

CREATE INDEX IF NOT EXISTS idx_knowledge_draft_review_ledger_workspace_pack
    ON knowledge_draft_review_ledger(workspace_id, draft_pack_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_draft_review_ledger_workspace_source
    ON knowledge_draft_review_ledger(workspace_id, source_fingerprint);
"#;
