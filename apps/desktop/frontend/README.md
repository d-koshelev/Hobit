# Desktop Frontend

This directory contains the Hobit desktop frontend.

## Current State

The frontend is a Vite, React, and TypeScript workbench shell.

The app starts on the Workspace Start Screen. In the Tauri desktop shell,
creating or opening a workspace calls the Tauri workspace lifecycle commands,
loads Workbench state through `get_workspace_workbench_state`, maps it into
`WorkbenchViewState`, and opens the Workbench shell.

In browser/Vite development, the workspace API uses an in-memory fallback so
the frontend remains usable without Tauri. Browser fallback workspaces and
Workbench states are local to the current page session and are lost on refresh.
Desktop-only actions report unsupported fallback errors instead of inventing
local behavior.

New workspaces open into the Workspace Agent workspace by default. Empty
Workbench remains available as an advanced/manual start mode. The Widget
Catalog currently exposes these user-facing surfaces:

Ready:

- Workspace Agent
- Agent Activity
- Knowledge / Skills
- Terminal
- Notes

Preview:

- Agent Queue
- Database / JDBC
- Runbook

Retired or hidden surfaces such as old Agent Chat, old Agent Monitoring,
Template Library, Dock / Docking Station, Agent CLI, Script Runner, JIRA,
Confluence, Image Edit, and separate legacy Coordinator preview surfaces are
not current insertable catalog surfaces.

Workspace Agent uses the existing `interactive-agent` widget id/component as a
compatibility foundation. It has visible current-session chat, proposal, and
Codex Direct Work paths. It has no hidden widget tool execution, file mutation,
Git mutation, SQL execution, Terminal execution, or hidden runtime.

Agent Executor reuses the existing `agent-run` widget id for persistence
compatibility and remains internal/supporting Direct Work infrastructure. It
is not a normal Widget Catalog product entry. Queue-owned local executor flows
can still start explicit assigned tasks through the Direct Work path. It does
not auto-commit, auto-push, mutate Git, run hidden background work, or
auto-dispatch Queue tasks.

Agent Queue is a Preview manual task organization surface. It supports
workspace-scoped task create/list/read/update, visible assignment to an Agent
Executor slot, explicit Run assigned task, Queue-to-Executor handoff, and
final-status auto-refresh. It does not schedule, auto-dispatch, approve/apply
proposals, launch Terminal, mutate Notes, mutate Git, or show live execution
logs.

Git remains a supporting/compatibility surface for explicit transient
repository-root review and selected-file local commit where already wired. It
is not a normal Widget Catalog product entry. It does not push, reset, clean,
stash, fetch, poll, watch, or auto-commit.

Terminal supports a desktop-only one-shot command form for persisted Terminal
widget instances. It uses explicit program, argv, working directory, timeout,
and output caps. It is not a shell, PTY, streaming session, stdin session,
command history, Script Runner, or Agent-triggered execution path.

Notes uses workspace-local notes storage/API and a product UI for list, filter,
new, edit, save, and pin flows. It does not implement autosave, delete, tags,
the full Notebook model, Markdown rendering, Mermaid rendering, or AI-in-Notes
behavior.

Database / JDBC is a Preview connector metadata shell. It manages non-secret
workspace-local connector descriptors only. It does not store credentials, test
connections, execute SQL, run `EXPLAIN`, format SQL, show query results, call
AI, or expose Coordinator tools.

Runbook is a Preview local/manual steps surface. It has no persistence, edit
mode, builder, Queue integration, step execution, Terminal execution, or
agent-assisted steps.

The Workbench includes layout lock/edit-mode behavior for persisted docked
position and size, plus frontend-only in-app floating widgets with ghost
placeholders and Dock back behavior. Real Dock rails, Compact/Indicator view
modes, drag-and-drop between zones, external Tauri/OS popout windows,
persisted external geometry, always-on-top, snapping, collision detection,
auto-reflow, and preset editing are not implemented.

Widget frames include a widget-local Logs panel backed by persisted widget
logs. Existing widget add/state/layout mutations, Terminal one-shot commands,
and Codex Direct Work runs emit bounded lifecycle logs. Polling, arbitrary
runtime log streaming UI, interactive terminal logs, and full agent run
observability are not implemented.

## Frontend Organization

The workspace frontend flow is split by responsibility:

- `workspaceApi.ts` is the public compatibility facade.
- `workspaceApiTypes.ts` owns the public `WorkspaceApi` type.
- `workspaceApiRuntime.ts` selects the Tauri or memory implementation.
- focused `workspaceApi*.ts` modules expose domain wrappers for callers.
- `tauriWorkspaceApi.ts` owns core workspace/widget Tauri calls and imports
  focused Tauri domain adapters.
- `memoryWorkspaceApi.ts` owns supported browser fallback behavior.
- `memoryUnsupportedWorkspaceApi.ts` owns unsupported desktop-only fallback
  methods.
- `useWorkspaceFlow.ts` owns the start-screen lifecycle state.

Workbench rendering consumes a frontend `WorkbenchViewState` boundary. Current
Tauri or memory Workbench state is adapted into that view state before
rendering, which keeps backend DTOs out of `WorkbenchShell`, `WorkbenchCanvas`,
and widget rendering.

## Widget Registry And Preset Model

The Workbench is rendered from a frontend-local preset model and widget
registry.

Current preset:

- Workspace Agent Workspace: Workspace Agent plus Notes
- Empty Workbench: advanced/manual empty workbench surface

`WidgetHost` maps persisted widget instances to registered frontend
components. The current registry contains Workspace Agent through the existing
`interactive-agent` renderer, Agent Activity, Agent Queue, Knowledge / Skills,
Database / JDBC, Runbook, Terminal, and Notes renderers, plus retained
compatibility renderers for Agent Executor (`agent-run`) and Git.

The Widget Catalog template list remains separate metadata. Only Agent
Workspace Agent, Agent Activity, Agent Queue, Knowledge / Skills, Database /
JDBC, Runbook, Terminal, and Notes are current insertion paths.

## Visual Direction

The Workspace Start Screen and Workbench follow
`docs/DESIGN_SYSTEM_CONTRACT.md`: dark blue-charcoal surfaces, a locked theme in
`src/styles/hobit-theme.css`, no gradients, semantic state colors, and a
unified shell/canvas surface.

Raw colors outside `src/styles/hobit-theme.css` are not allowed.

## Run Frontend-Only Dev

This mode uses the in-memory workspace API fallback.

```powershell
npm install
npm run dev
```

## Run Tauri Dev

The Tauri shell lives in the sibling `apps/desktop/src-tauri` directory and
hosts this frontend.

```powershell
npm run tauri:dev
```

For desktop smoke runs in constrained environments, set
`HOBIT_DATABASE_PATH` to an explicit writable SQLite file path if the default
Tauri app-data path is inaccessible.

## Build

```powershell
npm run build
```

## Build Tauri Shell

```powershell
npm run tauri:build
```

## Intentionally Not Implemented Yet

- Evidence/Sources storage/API, capture UI, review UI, citations, or AI context
  packs.
- Coordinator provider/runtime/tools, hidden context access, or automatic AI
  context inclusion.
- JDBC credentials, SQL execution, Java sidecar, `EXPLAIN`, result grid, SQL
  formatter, or AI assistance.
- Terminal PTY, shell mode, stdin, streaming sessions, cancellation, command
  history, environment/secrets support, or Agent-triggered execution.
- Queue scheduler, dependencies, auto-dispatch, approval/apply behavior,
  response parser/validator, Git association, Notes mutation, or Terminal
  launch.
- Git push, reset, clean, stash, fetch, polling, watching, automatic commit,
  or hidden repository discovery.
- Notes autosave, delete, tags, full Notebook model, Markdown rendering,
  Mermaid rendering, or AI-in-Notes behavior.
- Runbook persistence, edit mode, builder, Queue integration, step execution,
  Terminal execution, or agent-assisted steps.
- Script Runner UI, widget insertion, script execution, backend execution,
  Tauri commands, storage, or runtime behavior.
- Real Dock rails, Compact/Indicator view modes, persisted presence zones,
  full drag-and-drop layout editor, snapping, collision detection, auto-reflow,
  floating overlay resize, true external popout windows, persisted external
  geometry, always-on-top, or preset editing.
- JIRA, Confluence, Image Edit, Knowledge Catalog, Stages, YouTube Analyst, or
  medical/healthcare workflow scope.
