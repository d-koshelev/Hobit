# hobit-app

Application orchestration layer for Hobit.

The current milestone provides `WorkspaceService`, a thin application service
over SQLite storage. It creates empty Workspaces, creates WorkspaceSessions
when Workspaces are opened, lists or loads simple Workspace summaries, returns
a canonical Workspace Workbench state summary for frontend rendering, supports
the current widget add/state/layout/log foundation, and exposes the narrow
read-only Git status read for Git widget instances.

## Belongs Here

- Application-level coordination between core, storage, agent, and tools crates.
- Future bridge boundaries for the desktop shell.
- Workbench session orchestration once implementation begins.
- Product-level use cases composed from row-level storage primitives.

## Current Limits

- Tauri commands.
- Frontend integration.
- Runtime or widget execution beyond current placeholder mutations and read-only Git status reads.
- Product feature implementation.
- Terminal execution.
- Agent provider calls.
- Git mutations, diff/log/show, polling, watching, or repository root/status persistence.
- Database schemas.
- Widget UI.
