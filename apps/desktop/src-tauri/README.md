# Tauri Shell

This directory contains the minimal Tauri desktop shell and workspace command
bridge for Hobit.

The shell hosts the existing frontend from `apps/desktop/frontend`. In
development it loads the Vite dev server at `http://127.0.0.1:5173`; in builds
it uses the frontend `dist` output.

On startup the shell resolves the Tauri app data directory, creates it if
needed, initializes the idempotent SQLite schema, and stores the local database
at `hobit.sqlite3` inside that app data directory.

## Current Scope

- Tauri application configuration.
- Minimal Rust entry point.
- Desktop window titled Hobit.
- Frontend hosting.
- Local SQLite schema initialization.
- Workspace lifecycle commands:
  - `create_workspace`
  - `list_workspaces`
  - `get_workspace_summary`
  - `open_workspace`

## Not Implemented Yet

- Frontend calls to the workspace commands.
- Frontend persistence or workspace restore behavior.
- Widget runtime or widget insertion.
- Terminal execution.
- Agent runtime calls.
- Tool execution adapters.
