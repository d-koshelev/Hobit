# Current Widget Surface

## Purpose

This document captures the current simplified Hobit widget surface after the
agent surface cleanup and first local MVP widget slices.

It is an inventory and boundary document only. It does not add runtime
behavior, backend commands, storage, schema, queue execution, Git mutation, or
new widgets.

## Current User-Facing Widgets

Ready:

- Agent Executor
- Git
- Terminal
- Notes

Preview:

- Agent Queue
- Coordinator Chat
- Runbook

Coordinator-centered direction is defined in
`docs/COORDINATOR_CENTERED_WORKBENCH_CONTRACT.md`. Coordinator Chat currently
uses the existing `interactive-agent` widget id/component as a compatibility
local-chat foundation rather than adding a second separate chat surface.
Coordinator-visible widget capability boundaries are defined in
`docs/WIDGET_CAPABILITY_TOOL_CONTRACT.md`; the current UI does not implement a
Coordinator capability registry or widget tool execution.

Future product polish for these surfaces should follow
`docs/PRODUCT_UI_VISUAL_CONTRACT.md`: dark dotted Workbench canvas, grid-aware
widget placement direction, thin top bar, shared dark/glass widget card
language, compact controls, semantic status chips, and no overclaiming of
future widget capability.

## Current Widget Status

### Agent Executor

- Implemented Direct Work execution surface.
- Uses the Codex CLI Direct Work path.
- Reuses the internal `agent-run` widget id for persistence compatibility.
- Each Agent Executor widget instance is shown as an execution slot using a
  compact label derived from its stable widget instance id.
- Shows run state, live logs, stop run, result output, changed-files summary,
  Git read-only handoff, and validation capture.
- Provides a read-only backend/Tauri API for stored Direct Work and Direct Work
  validation run history, with a compact read-only frontend history/detail UI.
- Provides a read-only backend/Tauri diff summary API for an explicit repository
  root, with a compact read-only frontend diff summary UI.
- Does not auto-commit, auto-push, execute queue items, mutate Git, or run as a
  hidden background scheduler. Queue assignment can target Executor slots, and
  explicit Queue-started runs are governed by
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.

### Git

- Read-only repository status surface for an explicit transient repository
  root.
- Visible Git Widget UI does not stage, commit, push, reset, clean, stash,
  fetch, poll, watch, or mutate repositories.
- Backend/Tauri/frontend API foundation exists for explicit local commit
  creation owned by Git Widget, with selected files and an operator-provided
  message only. Frontend commit UI is pending.
- Explicit local commit support is governed by
  `docs/GIT_COMMIT_SUPPORT_CONTRACT.md`; push, reset, clean, auto-commit, and
  Agent Executor auto-commit are not implemented.

### Terminal

- Desktop-only one-shot command runner for persisted Terminal widget
  instances.
- Uses explicit program, argv, working directory, timeout, and output caps.
- Is not a shell, PTY, interactive terminal, stdin session, streaming console,
  command history, or Script Runner runtime.
- Future interactive shell behavior is governed by
  `docs/TERMINAL_PTY_WIDGET_CONTRACT.md` and remains unimplemented.

### Notes

- Persists a minimal widget-state body draft shaped as `{ "body": "..." }`.
- Uses explicit save.
- Future multi-note product direction is governed by
  `docs/NOTES_WIDGET_PRODUCT_CONTRACT.md`.
- Backend/storage/Tauri/frontend API foundation exists for workspace-local
  create/list/read/update notes, but no product UI consumes it yet.
- Does not implement the full Notebook model, tabs, Markdown rendering,
  diagrams, checklists, snippets, review notes, formatting tools, note list,
  search UI, autosave, archive/delete UI, tags, or AI-in-Notes.

### Agent Queue

- Preview manual task queue surface.
- Singleton per Workspace for new Agent Queue widget insertion.
- Existing persisted duplicates are not deleted or migrated.
- Manual queue task backend/storage/Tauri/frontend API foundation exists for
  create, list, read, and update.
- Manual Queue-to-Executor assignment backend/storage/Tauri/frontend API
  foundation exists for assigning and clearing an Agent Executor slot.
- Manual Queue-to-Executor execution backend/Tauri/frontend API foundation
  exists for starting an assigned task in its assigned Agent Executor with an
  explicit repository root.
- Queue-to-Executor handoff and final-status auto-refresh are frontend-owned
  current-session behavior. Agent Executor owns live logs and final results;
  Queue refreshes task status and does not duplicate execution output.
- Frontend product UI can create, list, select, edit, and explicitly save
  workspace queue tasks with title, description, prompt, status, and priority.
  It supports `running` as task status data and can also manually assign or
  clear a visible Agent Executor slot when the task is not running.
- Future task, dependency, and executor capacity model is governed by
  `docs/AGENT_QUEUE_PRODUCT_MODEL_CONTRACT.md`. Manual assignment to Executor
  slots is governed by `docs/QUEUE_TO_EXECUTOR_ASSIGNMENT_CONTRACT.md`.
  Manual run of an assigned task is governed by
  `docs/QUEUE_ITEM_EXECUTION_CONTRACT.md`.
- Does not dispatch, schedule, approve/apply, automatically run assigned tasks,
  capture responses outside normal Direct Work artifacts, validate responses,
  mutate Notes, launch Terminal, or mutate Git.

### Coordinator Chat / Interactive Agent Compatibility

- Preview local chat MVP currently using the existing `interactive-agent`
  widget id/component for compatibility.
- Near-term direction is Coordinator Chat, not a separate freeform Interactive
  Agent plus Coordinator.
- Keeps messages in local React state for the current widget session.
- Shows local placeholder assistant responses.
- Does not connect to a provider, call Codex, execute tools, persist sessions,
  read hidden context, create queue items, launch Agent Executor, integrate with
  Runbook, mutate files, mutate Git, run SQL, or run Terminal commands.

### Runbook

- Preview local/manual steps MVP for procedural work.
- Provides a built-in local sample runbook, selected step details, step states,
  and local notes/evidence.
- Step states are `pending`, `running`, `done`, `failed`, `skipped`, and
  `blocked`.
- Does not persist runbooks, edit/build templates, execute steps, launch Agent
  Executor, create queue items, integrate with Coordinator Chat, execute
  Terminal commands, mutate files, or mutate Git.

## Retired And Hidden Surfaces

These old or future surfaces are not visible in the current Widget Catalog or
current Workbench surface:

- Agent Chat
- Agent Monitoring
- Template Library
- Dock
- Agent CLI
- Script Runner
- Database/JDBC
- JIRA
- Confluence
- Image Edit
- separate legacy Coordinator preview surface

Database/JDBC is not a current catalog surface, but it is now a first-version
scope candidate for the Coordinator-centered database investigation scenario.
The contract is defined in `docs/JDBC_WIDGET_CONTRACT.md`; implementation must
preserve read-only defaults, connector secret isolation, explicit approval,
capped results, and explicit AI context sharing.

## Compatibility Notes

- `agent-run` remains the internal Agent Executor id for persisted compatibility.
- Retired persisted widget ids are filtered from the current canvas render path.
- This cleanup does not migrate, delete, or rewrite retired widget data.
- Some backend proposal/review compatibility paths still exist, but they are not
  current catalog surfaces.

## Recommended Next Blocks

- Git commit UI with confirmation after the backend/API foundation.
- Terminal PTY backend foundation after `docs/TERMINAL_PTY_WIDGET_CONTRACT.md`.
- Notes product UI after the storage/API foundation.
- Block 208 - JDBC connector model/API foundation.
- Block 209 - JDBC query UI MVP.
- Runbook persistence and edit mode later.
- Agent Queue dependency blocks later.
