# Tauri Shell

This directory contains the minimal Tauri desktop shell for Hobit.

The shell hosts the existing frontend from `apps/desktop/frontend`. In
development it loads the Vite dev server at `http://127.0.0.1:5173`; in builds
it uses the frontend `dist` output.

## Current Scope

- Tauri application configuration.
- Minimal Rust entry point.
- Desktop window titled Hobit.
- Frontend hosting only.

## Not Implemented Yet

- WorkspaceService or Tauri workspace commands.
- SQLite initialization or database path handling.
- Persistence or workspace restore behavior.
- Widget runtime or widget insertion.
- Terminal execution.
- Agent runtime calls.
- Tool execution adapters.
