# hobit-app

Application orchestration layer for Hobit.

The current milestone provides `WorkspaceService`, a thin application service
over SQLite storage. It creates empty Workspaces, creates WorkspaceSessions
when Workspaces are opened, lists or loads simple Workspace summaries, and
returns a canonical Workspace Workbench state summary for future frontend
restore wiring.

## Belongs Here

- Application-level coordination between core, storage, agent, and tools crates.
- Future bridge boundaries for the desktop shell.
- Workbench session orchestration once implementation begins.
- Product-level use cases composed from row-level storage primitives.

## Current Limits

- Tauri commands.
- Frontend integration.
- Runtime or widget execution.
- Product feature implementation.
- Terminal execution.
- Agent provider calls.
- Database schemas.
- Widget UI.
