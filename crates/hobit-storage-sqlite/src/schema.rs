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
"#;
