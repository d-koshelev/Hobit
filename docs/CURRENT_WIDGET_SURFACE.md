# Current Widget Surface

## Purpose

This document is the source of truth for current implemented Hobit widget
behavior during Phase 1 stabilization.

It is an inventory and boundary document only. It does not add runtime
behavior, backend commands, storage, schema, queue execution, Git mutation,
widget renames, persistence migrations, or new widgets.

Contract-reading navigation is defined in
`docs/ACTIVE_CONTRACT_INDEX.md`.

## Status Model

- Current: implemented behavior that exists in the shipped codebase and is safe
  to rely on.
- Preview: implemented behavior that is visible, intentionally limited, and not
  yet a complete product surface.
- Planned: approved next-step behavior, but not necessarily implemented.
- Deferred: future behavior that must not be implemented unless explicitly
  requested.
- Compatibility: legacy names, persistence IDs, old component names, old state
  shapes, or old code paths that still exist but are not preferred
  product/domain names.
- Deprecated: old behavior or terminology that should not be used for new work.

If this document conflicts with broader or older contracts, this document and
`docs/ACTIVE_CONTRACT_INDEX.md` are authoritative for current implemented
widget behavior.

## Current User-Facing Catalog

Current ready surfaces:

- Agent Executor
- Git
- Terminal
- Notes

Current preview surfaces:

- Agent Queue
- Coordinator Chat
- Database / JDBC
- Runbook

The current catalog uses these preferred user-facing names. Compatibility IDs
and component keys may still appear in code and persistence.

## Current Ready Surfaces

### Agent Executor

- Current explicit Codex Direct Work execution surface.
- Uses the existing `agent-run` widget definition id for persistence
  compatibility.
- Starts one operator-provided task from visible inputs: prompt, execution
  workspace path, sandbox, approval policy, and Codex executable options.
- Shows run state, live logs/streaming where available, stop/cancel/force-kill
  controls, final result output, changed-files summary, Git read-only handoff,
  validation capture, and read-only run/detail/history views.
- Provides read-only backend/Tauri APIs for stored Direct Work runs,
  validation runs, and explicit diff summaries.
- Queue tasks can be assigned to visible Executor slots and explicitly started
  through the Agent Queue preview path.
- Does not auto-dispatch Queue items, auto-commit, auto-push, mutate Git, run
  hidden background work, provide a shell mode, or become a general agent
  runtime.

### Git

- Current desktop Git review/control widget for an explicit operator-provided
  repository root.
- Reads a manual read-only status snapshot and grouped changed-file data in the
  Tauri desktop shell.
- Supports explicit selected-file local commit with an operator-provided
  message and operator confirmation.
- Browser/Vite fallback keeps the widget insertable but cannot perform real
  Git reads.
- Does not persist repository roots, poll, watch, fetch, push, reset, clean,
  stash, show log/history UI, revert files, auto-commit Agent Executor output,
  or mutate Git outside the explicit local commit path.

### Terminal

- Current desktop-only Terminal widget with a PTY-first manual shell UI plus a
  collapsed legacy one-shot command fallback.
- PTY UI accepts an explicit shell executable, optional shell argv, explicit
  working directory, cols/rows, stdin sends, manual refresh/polling, resize,
  Stop, Kill with confirmation, and Close.
- PTY output is a bounded session-only buffer. It is not persisted as widget
  logs/results and is not sent to Coordinator Chat, Queue, Agent Executor,
  Git, Notes, JDBC, or Evidence/Sources.
- PTY session support is currently Windows-only in shipped backend code.
  Non-Windows desktop builds compile but live PTY creation returns an
  unsupported-platform error. Treat non-Windows live PTY sessions as
  unsupported until platform support or catalog gating is implemented.
- Browser/Vite fallback cannot run local processes.
- The legacy one-shot fallback is a Compatibility path. It remains available
  only behind the collapsed fallback UI, uses explicit program, argv, working
  directory, timeout, and output caps, creates widget run/log/result records,
  and shows final stdout/stderr output.
- Terminal does not implement tabs, split panes, persistent command history,
  persistent transcripts, shell profiles, environment/secrets support,
  Agent-triggered execution, Queue-triggered execution, Coordinator control, or
  Script Runner behavior.

### Notes

- Current workspace-local Notes widget supports list, filter, create, select,
  edit, explicit save, and pin flows through workspace Notes APIs when
  available.
- Desktop/Tauri persists Notes through local SQLite-backed Workspace Notes
  APIs. Browser/Vite fallback keeps the widget insertable but returns visible
  unsupported-runtime errors for Notes persistence reads and writes.
- Notes stores source text fields as plain title/body/pinned data. It does not
  render a Notebook document model.
- `docs/NOTES_WIDGET_CONTRACT.md` is authoritative for the current Notes widget
  boundary. `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md` is authoritative for Notes
  product planning and next-slice boundaries.
- Coordinator Chat can create a new workspace-local Note only from an approved
  visible create-Note proposal and a separate explicit Create Note action.
  Existing Notes content is not read, searched, summarized, or sent to agents.
- The older widget-local draft state shaped as `{ "body": "..." }` may still be
  relevant for Compatibility/Deprecated persisted data, but it is not the
  preferred current product model for new work.
- Full Notebook behavior is Deferred: tabs, Markdown rendering, Mermaid or
  diagram rendering, checklists/todos, snippets, review notes, rich formatting,
  autosave, sync/import/export, archive/delete UI, tags, AI-in-Notes, and
  hidden agent access are not implemented.

## Current Preview Surfaces

### Agent Queue

- Current preview manual task organization surface.
- Uses the `agent-queue` widget definition id.
- Provides workspace-local task create, list, read, update, filter, select, and
  explicit save flows for title, description, prompt, status, and priority.
- Supports visible manual assignment/clear of a task to an Agent Executor slot
  when assignment APIs are available.
- Supports explicit start of an assigned task in its assigned Agent Executor
  with an operator-provided execution workspace path.
- Queue-to-Executor handoff and final-status auto-refresh are current-session
  frontend behavior. Agent Executor owns live logs and final results.
- Existing duplicate persisted Queue widgets are not deleted or migrated.
- Does not schedule, auto-dispatch, automatically accept tasks, launch runs
  without an explicit operator action, capture responses outside Direct Work
  artifacts, validate responses, mutate Notes, launch Terminal, or mutate Git.

### Coordinator Chat

- Current preview operator chat surface shown as Coordinator Chat.
- Uses the existing `interactive-agent` widget definition id/component key for
  compatibility.
- Keeps chat messages and proposal card state in local React state for the
  current widget session.
- Can generate deterministic local proposal cards for safe preview types:
  create Agent Queue task, create Note, and prepare JDBC query suggestion text.
- In the Tauri desktop shell, explicit sends can use a backend-owned
  Coordinator provider response path. Mock/local is the default provider; a
  configured HTTP JSON provider can be selected by backend environment
  variables. Requests include visible current-session chat, visible proposal
  draft summaries, compact safety instructions, and `allowed_tools: []`.
- Provider credentials stay backend-only. Browser/Vite fallback does not call a
  provider directly.
- Provider/local drafts are validated before rendering. Queue task creation and
  Note creation require approval plus a separate explicit create action. JDBC
  suggestions remain review/copy text only and do not execute SQL.
- Coordinator Chat does not persist chat sessions, read hidden Workspace
  context, inspect widget state, read Notes, read Terminal output, read Git
  diffs, read JDBC metadata, launch Agent Executor, auto-dispatch Queue items,
  mutate files, mutate Git, run SQL, call JDBC connectors, run Terminal
  commands, or execute broad widget capability tools.

### Database / JDBC

- Current preview Database / JDBC widget.
- Provides workspace-local connector metadata create, list, read, update, and
  selection flows.
- Connector metadata is non-secret: display name, database kind, driver kind,
  masked JDBC URL metadata, environment, read-only default, status, and notes.
- A read-only SQL validation/execution UI is shipped and wired through
  frontend, Tauri command, backend adapter, and tests.
- The current product execution path is bounded mock/safe execution: it
  validates conservative read-only SQL, applies row/timeout caps, and renders
  deterministic bounded mock results or sanitized validation/runtime errors.
- A backend adapter boundary, runtime config loader, Java sidecar scaffold, and
  JDK-gated tests exist for future opt-in sidecar work. The default product
  runtime remains mock-only.
- The current widget does not collect credentials, store passwords or tokens,
  test real database connections, run SQL against external systems, run
  `EXPLAIN`, format SQL, provide AI query assistance, expose a Coordinator
  JDBC execution tool, launch Terminal, mutate Git, or affect Agent Queue or
  Agent Executor behavior.
- This bounded mock/safe read-only path is accepted as Current Preview
  behavior. Production JDBC execution, credential expansion, write SQL,
  `EXPLAIN` workflows, broad database automation, production sidecar runtime,
  and hidden Coordinator-triggered SQL execution remain Deferred.

### Runbook

- Current preview local/manual procedural step widget.
- Provides a built-in local sample runbook, selectable step details, step
  states, and local notes/evidence text for the current widget session.
- Step states are `pending`, `running`, `done`, `failed`, `skipped`, and
  `blocked`.
- Does not persist runbooks, edit/build templates, execute steps, launch Agent
  Executor, create Queue items, integrate with Coordinator Chat, execute
  Terminal commands, mutate files, or mutate Git.

## Compatibility / Deprecated Surfaces

- `agent-run` remains the internal Agent Executor definition id for persisted
  compatibility. Do not rename it in cleanup tasks.
- `interactive-agent` remains the internal Coordinator Chat definition id and
  component key for persisted compatibility. Do not rename it in cleanup tasks.
- Placeholder-named components such as `AgentRunPlaceholderWidget`,
  `AgentQueuePlaceholderWidget`, `InteractiveAgentPlaceholderWidget`, and
  `NotesPlaceholderWidget` may contain current product UI. The names are
  Compatibility implementation details, not preferred product names.
- Retired persisted widget ids are filtered from the current canvas render path
  when they are not in the user-facing widget registry. This cleanup does not
  migrate, delete, or rewrite retired widget data.
- Legacy Agent Executor titles such as Agent Run, Agent Monitoring, and Direct
  Work / Codex may be normalized in the visible frame title, but the preferred
  current product name is Agent Executor.
- Agent Chat, Agent Monitoring, and proposal-era backend/frontend APIs are not
  preferred current user-facing widgets. Some commands and frontend API modules
  remain wired as Compatibility or pending-retirement code paths, including
  proposal persistence, proposal generation, monitoring snapshots, and
  proposal-to-Queue-item creation. See
  `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md` for the compatibility
  boundary and cleanup options.
- The Terminal one-shot command runner is a Compatibility fallback, not the
  normal Terminal surface and not Script Runner.
- The older Notes widget-local `{ "body": "..." }` state is
  Compatibility/Deprecated for new product work.

## Deferred / Future Surfaces

These surfaces are not current user-facing widgets and must not be implemented
or surfaced unless explicitly requested by a future task:

- Agent Chat as a separate preferred widget
- Agent Monitoring as a separate preferred widget
- Template Library
- Dock
- Agent CLI
- Script Runner
- JIRA
- Confluence
- Image Edit
- separate legacy Coordinator preview surface
- Knowledge Catalog
- Stages
- full Notebook
- real Runbook engine
- real JDBC connector runtime with credentials or external database execution
- real Coordinator widget capability execution
- Evidence/Sources capture and AI context packs
- true external OS/Tauri widget popout windows
- Dock rails, Compact/Indicator modes, presence-zone persistence, snapping,
  collision detection, auto-reflow, and preset editing

## Dev / Smoke Entry Points

Smoke HTML files under the frontend Vite root are development/smoke entry
points, not current product surfaces or user-facing widgets.

Known smoke entry points include:

- `apps/desktop/frontend/coordinator-provider-product-smoke.html`
- `apps/desktop/frontend/jdbc-read-only-ui-smoke.html`
- `apps/desktop/frontend/queue-executor-ui-smoke.html`

Their placement at the Vite root remains a follow-up cleanup decision.

## Known Drift / Follow-Up Decisions

- Agent Chat / Agent Monitoring / proposal-era commands and frontend APIs:
  compatibility alignment is documented in
  `docs/AGENT_CHAT_MONITORING_COMPATIBILITY_CONTRACT.md`; future cleanup should
  either retire/delete the old paths or keep narrowed compatibility APIs.
- JDBC read-only execution: completed for Phase 1 docs. The shipped bounded
  mock/safe read-only query UI is Current Preview; production JDBC execution
  and hidden Coordinator-triggered SQL remain Deferred.
- Terminal platform support: decide whether to add non-Windows catalog gating
  or keep the docs-only limitation until cross-platform PTY support exists.
- Smoke HTML root cleanup: decide whether smoke files move under a dev/smoke
  location or are explicitly gated in Vite config.
- Coordinator / Queue / Executor naming and responsibility cleanup remains
  deferred until current codebase cleanup and Notes stabilization are complete.
