# Tauri Shell

This directory contains the minimal Tauri desktop shell and workspace command
bridge for Hobit.

The shell hosts the existing frontend from `apps/desktop/frontend`. In
development it loads the Vite dev server at `http://127.0.0.1:5173`; in builds
it uses the frontend `dist` output.

On startup the shell resolves the Tauri app data directory, creates it if
needed, initializes the idempotent SQLite schema, and stores the local database
at `hobit.sqlite3` inside that app data directory.

The Tauri source is split by responsibility: `app_state.rs` owns app data and
SQLite initialization, `workspace_commands.rs` owns command handlers, and
`workspace_dto.rs` owns bridge request/response DTO mapping.

## Current Scope

- Tauri application configuration.
- Minimal Rust entry point.
- Desktop window titled Hobit.
- Frontend hosting.
- Local SQLite schema initialization.
- Workspace Start Screen frontend calls to the workspace lifecycle commands.
- Workspace lifecycle commands:
  - `create_workspace`
  - `list_workspaces`
  - `get_workspace_summary`
  - `open_workspace`
- Workspace Workbench state command:
  - `get_workspace_workbench_state`
- Widget foundation commands:
  - `add_widget_instance_to_workbench`
  - `update_widget_instance_state`
  - `update_widget_instance_layout`
  - `list_widget_logs`
- Terminal one-shot command for persisted Terminal widgets:
  - `run_terminal_command`
- Agent Chat proposal-only persistence for persisted Agent Chat widgets:
  - `persist_agent_chat_proposal`
- Agent Monitoring read-only proposal artifact snapshot:
  - `get_agent_monitoring_snapshot`
- Agent Queue proposal-review item persistence and snapshot:
  - `create_agent_queue_item_from_proposal`
  - `get_agent_queue_snapshot`
- Manual read-only Git status command for the Git widget placeholder:
  - `get_git_repository_status`
- Generated Tauri schema artifacts under `apps/desktop/src-tauri/gen/` are ignored.

## Not Implemented Yet

- Frontend persistence beyond current workspace/workbench state loading and widget mutation/log foundations.
- Runtime restore, event replay, or widget runtime reconstruction.
- Widget runtime beyond placeholder insertion, mutation/log foundations, Terminal one-shot command runs, Agent Chat proposal-only result persistence, Agent Monitoring read-only proposal artifact viewing, and explicit Agent Queue review-item creation from valid proposal results.
- Interactive Terminal execution.
- Agent runtime calls.
- Tool execution adapters beyond Terminal one-shot command execution and the narrow read-only Git status path.
- Agent Monitoring runtime execution, streaming, Terminal result monitoring, arbitrary widget result monitoring, response parsing, response validation, overview summarization, proposal approval/apply behavior, queue execution, or executor integration.
- Git diff/log/show, repository root/status persistence, polling, watching, or Git mutations.
