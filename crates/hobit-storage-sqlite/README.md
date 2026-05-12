# hobit-storage-sqlite

SQLite persistence foundation for Hobit.

The current scope is an initial idempotent schema and small row-level storage primitives for resumable work.

It supports storage primitives for:

- Workspaces and WorkspaceSessions.
- Workspace Workbenches and Workbench Presets.
- Widget instances and widget layout/presentation state.
- Widget runs, widget-local logs, and widget results.
- Agent Queue proposal-review items.
- Shared State objects.
- Workbench event history.

## Belongs Here

- Persistence abstractions that depend on `hobit-core`.
- SQLite schema initialization.
- Local storage boundaries for Workspace, Widget, Agent Queue review item, Shared State, and Event rows.
- Small row-level CRUD/append helpers.

## Does Not Belong Here

- App runtime orchestration.
- Tauri commands.
- Frontend code.
- Agent runtime logic.
- Terminal execution.
- Concrete widget implementations.

## Current Limits

- No app runtime.
- No Tauri integration.
- No frontend integration.
- No migrations system beyond the idempotent initial schema yet.
- No complex domain mapping yet.
- Payload, config, and state fields are stored as text for now.
