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
`workspace_dto.rs` owns bridge request/response DTO mapping. This is an
organization boundary only; command behavior is unchanged.

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
- Manual read-only Git status command for the Git widget placeholder:
  - `get_git_repository_status`
- Generated Tauri schema artifacts under `apps/desktop/src-tauri/gen/` are ignored.

## Not Implemented Yet

- Frontend persistence beyond current workspace/workbench state loading and widget mutation/log foundations.
- Runtime restore, event replay, or widget runtime reconstruction.
- Widget runtime beyond placeholder insertion and mutation/log foundations.
- Terminal execution.
- Agent runtime calls.
- Tool execution adapters beyond the narrow read-only Git status path.
- Git diff/log/show, repository root/status persistence, polling, watching, or Git mutations.
