# Hobit Workspace Contract

## Purpose

Workspace is the durable unit of resumable work in Hobit.

Hobit must let a user start a piece of work, close the application, return later, and continue from the same place. The Workspace owns the saved work context, Workbench composition, widget state, shared state, results, logs, and event history needed for that resume behavior.

## Core Terms

### Workspace

A Workspace is a durable, persisted, user-facing container for a specific piece of work.

It represents what the user is working on, why it exists, what state has accumulated, and how the Workbench should be restored when the user returns.

### WorkspaceSession

A WorkspaceSession is the current runtime opening of a Workspace.

It represents the active application runtime state while the Workspace is open. It may include transient UI state, live tool connections, live agent runs, and runtime-only window details.

### Workbench

A Workbench is the configurable working surface inside a Workspace.

It hosts widget instances, layout, presentation state, context bindings, active preset origin, and the current UI composition for that Workspace.

### WorkbenchPreset / Preset

A WorkbenchPreset, or Preset, is a reusable saved Workbench layout and configuration.

Choosing a Preset instantiates or copies its recommended layout and configuration into a Workspace. The Workspace owns the actual widget instances and layout after the Preset is applied.

### WidgetInstance

A WidgetInstance is a configured, placed instance of a widget inside a Workspace Workbench.

The instance identity, configuration, layout, presentation state, inputs, logs, results, and current runtime state are part of the Workspace resume data.

### SharedState

SharedState is named state available to the Workbench and relevant widgets through the common state and event model.

SharedState that belongs to a Workspace is persisted with that Workspace for resume behavior.

### EventLog

EventLog is the ordered history of structured Workspace and Workbench events relevant to a piece of work.

The EventLog can support auditability, summarization, replay, restore behavior, and operator understanding when resuming work.

### CurrentFocus

CurrentFocus is the saved pointer to what the user was focused on inside the Workspace.

It may refer to an active widget, selected object, active decision, highlighted result, open note, or other durable focus target. It should be restored only when the target is still valid.

## Product Rule

A user does not just open Hobit.

A user opens an existing Workspace or creates a new Workspace.

Opening or creating a Workspace starts a WorkspaceSession.

## Current Implementation Foundation

The current implementation has the Workspace foundation in place, but not the full runtime restore system.

Implemented foundation:

- The Workspace Start Screen lets the user create a Workspace or open an existing Workspace.
- In the Tauri desktop shell, Workspace lifecycle and Workbench state loading use Tauri commands backed by `hobit-app` and `hobit-storage-sqlite`.
- In browser/Vite development, the same frontend workspace API boundary uses an in-memory fallback. Browser fallback state is not persisted.
- Creating or opening a Workspace starts a WorkspaceSession.
- The frontend loads `get_workspace_workbench_state`, adapts the returned summary into `WorkbenchViewState`, and renders the Empty Workbench.
- The current default Workbench has zero real widget instances.
- The Widget Catalog can insert the Notes, Terminal placeholder, and Agent Chat placeholder as persisted WidgetInstances; other catalog templates remain planned/display-only.
- The Notes placeholder persists a minimal widget-state draft shaped as `{ "body": "..." }`. Full notes document storage is not implemented.
- The Terminal placeholder is static. Terminal execution, command input, process lifecycle, stdout/stderr streaming, and terminal runtime behavior are not implemented.
- The Agent Chat placeholder is static. Chat input, agent execution, LLM calls, workspace-context access, action proposals, streaming, and chat message persistence are not implemented.
- Existing persisted docked widget sizes render, and a frontend-only layout lock/edit-mode foundation is in place. Docked drag/resize editing is not implemented.
- Recent activity shows workspace-scoped Workbench events returned with the Workbench state.
- Widget Logs panels load persisted widget-local logs, and existing widget add/state/layout mutations emit basic logs.
- SQLite storage can persist the foundation records for Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent.

Not implemented yet:

- runtime restore or event replay
- widget runtime reconstruction
- real capability widget insertion beyond the Notes, Terminal placeholder, and Agent Chat placeholder
- real Terminal, Agent CLI, operational agent chat, or other capability widgets
- drag-and-drop layout editing
- resize handles, Tauri separate-window popouts, persisted popout geometry, always-on-top behavior, and freeform layout editing
- log streaming or polling
- full Notes document model, Markdown editor, autosave, or AI-in-Notes behavior
- custom preset editor
- terminal execution
- agent runtime calls

## Workspace

A Workspace is the durable, persisted, user-facing work container.

A Workspace should persist:

- title/name
- goal/description
- status
- selected or instantiated workbench preset
- widget instances
- widget layout
- widget states
- widget inputs
- command/action history
- widget-local logs
- widget results
- shared state objects
- applied request snapshots when future template workflows exist
- selected response template references when future template workflows exist
- captured executor responses when future agent workflows exist
- validation results linked to requests/responses when future agent workflows exist
- Git commits linked to requests/responses when future Git review workflows exist
- block/task history following the future agent operating model
- workspace-local notes
- decisions
- current focus
- docked/popped-out state
- ghost placeholders
- event history
- enough state to resume from the same place

The Workspace is the user's durable product object. It is what appears in recent work, search, archive flows, restore flows, and future storage.

Workspace-local notes are part of Workspace resumable state and should be restored with the Workspace.

Global notes are outside a Workspace unless they are explicitly linked or attached to that Workspace.

## WorkspaceSession

A WorkspaceSession is the runtime/current opening of a Workspace.

It may contain:

- opened_at
- closed_at
- active widget
- transient UI state
- currently open drawer/popup
- live tool connections
- live agent runs
- popout window geometry for current runtime
- temporary non-persisted runtime details

Session is not the durable product object.

Workspace is.

## Workbench

A Workbench is the configurable working surface inside a Workspace.

The Workbench contains:

- widget instances
- layout
- presentation state
- context bindings
- active preset origin
- current UI composition

The Workbench is saved as part of the Workspace so the visible working surface can be restored. A Workspace may later support multiple workbench surfaces, but the current contract only requires one configurable Workbench per Workspace.

## Presets

A Preset is a reusable layout/configuration.

Rules:

- system presets and user presets are allowed
- users can create custom presets
- choosing a preset instantiates/copies it into a Workspace
- editing Workspace layout does not mutate a Preset
- user must explicitly choose Save as Preset or Update Preset
- preset may recommend widget templates/configuration but Workspace owns actual instances

Example presets:

- Empty Workbench
- Codebase Workbench
- Database Workbench
- Design Workbench
- Operations Workbench
- user custom presets

## User Flows

### New Workspace

The user creates a new Workspace, names or describes the work, and starts a new WorkspaceSession.

Current foundation: desktop mode persists the Workspace and associated empty Workbench through SQLite; browser/Vite mode uses in-memory fallback state.

### Open Existing Workspace

The user opens a durable Workspace and Hobit starts a new WorkspaceSession from saved Workspace state.

Current foundation: Hobit loads the persisted Workbench summary and renders it as frontend `WorkbenchViewState`. Full widget runtime restore, current focus restore, and event replay are future work.

### Continue Recent Workspace

The user selects a recent Workspace and Hobit starts a new WorkspaceSession from the saved Workspace state.

### Choose Preset

The user chooses a system or user Preset. Hobit copies the Preset's recommended layout and configuration into the Workspace.

Current foundation: the default Empty Workbench path exists. Full preset selection, preset instantiation UI, and preset editing are future work.

### Customize Workbench

The user adds, removes, moves, resizes, docks, pops out, or configures widgets inside the Workspace. These changes update the Workspace state, not the original Preset.

Current foundation: the data model, storage primitives, Notes, Terminal placeholder, and Agent Chat placeholder insertion, Notes widget-state save, persisted widget layout update plumbing, frontend-only layout lock/edit-mode foundation, frontend-only popout presentation state with ghost placeholder and Dock back behavior, workspace activity events, and widget-local log reads/writes exist. Real capability widget insertion beyond placeholders, drag-and-drop layout editing, resize handles, Tauri separate-window popouts, persisted popout geometry, always-on-top behavior, and preset editing are future work.

### Save Layout as Preset

The user explicitly saves the current Workspace Workbench layout/configuration as a new Preset for reuse.

### Update Existing Preset

The user explicitly chooses to update an existing Preset from the current Workspace Workbench layout/configuration.

### Archive Workspace

The user archives a Workspace when the work should no longer appear as active, while preserving durable history unless explicitly deleted by a future deletion flow.

## Resume Behavior

Expected resume:

1. Load Workspace.
2. Restore Workbench layout.
3. Restore widget instances/states.
4. Restore shared state/logs/results.
5. Restore current focus if valid.
6. Create new WorkspaceSession.
7. Continue from saved state.

Resume behavior should preserve enough state that the operator can understand what was happening, what decisions were made, what results exist, and what work should continue next.

## Distinction from Other Terms

- Workspace is not a browser/auth session.
- WorkspaceSession is not AgentSession.
- Workspace is not a Preset.
- Workbench is not a Workspace.
- Widget state is part of Workspace resume data.
- Global notes/global settings are not Workspace-local unless explicitly attached.

## Not Implemented Yet

The following are not implemented yet:

- workspace restore runtime
- event replay
- widget runtime reconstruction
- applied request/response snapshot history
- real capability widget insertion beyond the Notes, Terminal placeholder, and Agent Chat placeholder
- real capability widgets
- custom preset editor
- drag-and-drop layout editor
- resize handles, Tauri separate-window popouts, persisted popout geometry, and always-on-top behavior
- docked drag/resize layout editing and freeform layout persistence editing
- full notes document storage, Markdown editor, autosave, and AI-in-Notes behavior
- log streaming or polling
- multi-user sync
- cloud sync
