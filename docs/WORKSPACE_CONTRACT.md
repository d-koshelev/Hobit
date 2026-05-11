# Hobit Workspace Contract

## Purpose

Workspace is the durable unit of resumable work in Hobit.

Hobit must let a user start a piece of work, close the application, return later, and continue from the same place. The Workspace owns the saved work context, Workbench composition, widget state, shared state, results, logs, and event history needed for that resume behavior.

## Core Terms

### Workspace

A Workspace is a durable, persisted, user-facing container for a distinct problem, project, incident, review, plan, or other work context.

It represents what the user is working on, why it exists, what state has accumulated, and how one or more Workbenches should be restored when the user returns.

A Workspace owns the context, widgets, Agent Queue, Agent Runs, Notes/Notebook content, Git roots/reviews, Template snapshots, logs, activity, artifacts, and decisions for that distinct work context.

### WorkspaceSession

A WorkspaceSession is the current runtime opening of a Workspace.

It represents the active application runtime state while the Workspace is open. It may include the active Workbench, transient UI state, view preferences, frontend-only floating widget state, live tool connections, live agent runs, and runtime-only window details.

Future UI may allow multiple WorkspaceSessions to be open at once through tabs, a sidebar, a switcher, or separate app windows. Each session remains tied to exactly one Workspace.

### Workbench

A Workbench is a visual and operational surface inside a Workspace.

It hosts widget instances, layout, presentation state, context bindings, active preset origin, and a specific UI composition for that Workspace.

A Workspace may have multiple Workbenches when they represent different surfaces for the same problem. A Workbench must not be used as a substitute for a separate Workspace when the work context is unrelated.

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

Core modeling rule:

- Different problem = different Workspace.
- Different surface for the same problem = additional Workbench.

Examples:

- Hobit development and a Vertica incident are separate Workspaces.
- VICO review and personal planning are separate Workspaces.
- A Hobit implementation board and a Hobit Git review board may be separate Workbenches inside the Hobit Workspace.
- A Vertica incident investigation surface and a Vertica incident review surface may be separate Workbenches inside the Vertica incident Workspace.

The boundary exists to prevent unrelated state, context, queues, notes, logs, Git roots, and agent work from mixing.

## Current Implementation Foundation

The current implementation has the Workspace foundation in place, but not the full runtime restore system.

Implemented foundation:

- The Workspace Start Screen lets the user create a Workspace or open an existing Workspace.
- In the Tauri desktop shell, Workspace lifecycle and Workbench state loading use Tauri commands backed by `hobit-app` and `hobit-storage-sqlite`.
- In browser/Vite development, the same frontend workspace API boundary uses an in-memory fallback. Browser fallback state is not persisted.
- Creating or opening a Workspace starts a WorkspaceSession.
- The frontend loads `get_workspace_workbench_state`, adapts the returned summary into `WorkbenchViewState`, and renders the Empty Workbench.
- The current default Workbench has zero real widget instances.
- The current product opens one selected Workspace into one rendered Workbench surface at a time. Full multi-open Workspace UI, Workspace tabs/sidebar, separate Workspace windows, and mature multiple-Workbench UI for one Workspace are not implemented.
- The Widget Catalog can insert the Notes, Terminal placeholder, Agent Chat placeholder, Agent Run placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder as persisted WidgetInstances; other catalog templates remain planned/display-only.
- The Notes placeholder persists a minimal widget-state draft shaped as `{ "body": "..." }`. Full notes document storage is not implemented.
- The Terminal placeholder is static. Terminal execution, command input, process lifecycle, stdout/stderr streaming, and terminal runtime behavior are not implemented.
- The Agent Chat placeholder is static. Chat input, agent execution, LLM calls, workspace-context access, action proposals, streaming, and chat message persistence are not implemented.
- The Agent Run placeholder is static and previews future Overview Log, Result Report, and Raw Log sections. Run start, agent execution, terminal execution, streaming, run storage, response parsing, response validation, overview summarization, and executor integration are not implemented.
- The Agent Queue placeholder is static and previews future queue/review inbox cards with frontend-local static card selection and selected item detail review surfaces. Persisted queue item selection, queue storage, real queue item persistence, background queue running, automatic launch, automatic acceptance, response capture/parser/validator, Git association, and executor integration are not implemented.
- The Git widget placeholder has a transient explicit repository-root input. In the Tauri desktop path, it can manually refresh a read-only Git status snapshot for that root through `get_git_repository_status`, then render a status card and grouped changed-files summary. Repository root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented. Browser/Vite fallback cannot read Git status.
- The Template Library placeholder is static and shows Request Template, Response Template, and Coordinator Workflow previews. Template storage, template editing, request generation, response capture, response parsing, response validation, executor launch/integration, Git-response association, and agent execution are not implemented.
- Existing persisted docked widget sizes and positions render, and a frontend-only layout lock/edit-mode foundation is in place. Docked widgets can be moved by header drag and resized with right, bottom, and bottom-right handles in edit mode.
- Recent activity shows workspace-scoped Workbench events returned with the Workbench state.
- Widget Logs panels load persisted widget-local logs, and existing widget add/state/layout mutations emit basic logs.
- Agent run observability views defined in `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` exist only as a static Agent Run placeholder preview; real run observability is not implemented.
- SQLite storage can persist the foundation records for Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent.

Not implemented yet:

- runtime restore or event replay
- widget runtime reconstruction
- real capability widget insertion beyond the Notes, Terminal placeholder, Agent Chat placeholder, Agent Run placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder
- real Terminal, Agent CLI, operational agent chat, or other capability widgets
- Docking Station, widget presence zones beyond canvas/floating, and Full/Compact/Indicator view mode behavior
- full drag-and-drop layout editing
- floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, always-on-top behavior, snapping, collision detection, auto-reflow, and freeform layout editing
- log streaming or polling
- full Notebook/Notes document model, multi-tab state, text formatting tools, Markdown editor, autosave, or AI-in-Notes behavior
- custom preset editor
- terminal execution
- agent runtime calls
- real agent run Raw Log, Overview Log, and Result Report views beyond the static Agent Run placeholder preview
- Git behavior beyond manual desktop-only read-only status refresh for an explicit transient repository root; repository root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations

## Workspace

A Workspace is the durable, persisted, user-facing work container.

A Workspace should persist:

- title/name
- goal/description
- status
- selected or instantiated workbench preset
- Workbench records for one or more visual/operational surfaces when multi-Workbench support exists
- widget instances
- widget layout
- widget presence zones and future Docking Station rail placement
- widget states
- widget inputs
- command/action history
- widget-local logs
- widget results
- shared state objects
- applied request snapshots when future template workflows exist
- selected response template references when future template workflows exist
- captured executor responses when future agent workflows exist
- agent run Raw Logs, Overview Logs, and Result Reports when future agent workflows exist
- validation results linked to requests/responses when future agent workflows exist
- Git commits linked to requests/responses when future Git review workflows exist
- approved repository roots used by future Git review artifacts, preserving the root associated with each captured status, validation, or commit record
- block/task history following the future agent operating model
- Agent Queue items and operator decisions when future Agent Queue support exists
- workspace-local notes
- Git roots, Git status snapshots, Git review artifacts, and Git decisions when future Workspace-approved roots or Git review history exist
- approved context packs and sensitive context references when future context management exists
- decisions
- current focus
- docked/floating presentation state and future true external popout state
- ghost placeholders
- event history
- enough state to resume from the same place

The Workspace is the user's durable product object. It is what appears in recent work, search, archive flows, restore flows, and future storage.

Workspace-local notes are part of Workspace resumable state and should be restored with the Workspace.

Global notes are outside a Workspace unless they are explicitly linked or attached to that Workspace.

## Workspace And Workbench Boundary

The Workspace is the isolation boundary for distinct work.

The Workbench is a surface inside that boundary.

Use a new Workspace when:

- the problem, customer, system, incident, review, or personal context is different
- the operator would not want Agent Queue items, Agent Runs, notes, Git state, artifacts, decisions, or activity to appear together
- context sharing would be surprising, risky, or noisy
- secrets or sensitive context belong to a different operational boundary

Use another Workbench inside the same Workspace when:

- the work is the same problem but needs another visual arrangement
- the operator wants a focused surface for Git review, Agent Queue review, planning, notes, validation, or incident review
- the same Workspace history, Queue Items, Agent Runs, artifacts, notes, and decisions should remain visible across surfaces

Possible future Workbenches inside one Workspace include:

- Main Workbench
- Git Review Workbench
- Agent Queue Workbench
- Notes / Planning Workbench
- Incident Review Workbench

Multiple Workbenches in one Workspace may share Workspace-scoped context, Agent Queue, activity, artifacts, and decisions. They must not be used to mix unrelated problems into one Workspace.

## Docking Station Scope

Future Docking Station behavior is Workspace-scoped. Station items are existing WidgetInstances parked in Workspace-local perimeter rails using Indicator view; they are not new templates or duplicate widget instances.

Widgets parked in one Workspace's Docking Station must not appear in another Workspace. Shared WidgetDefinitions and WidgetTemplates do not imply shared WidgetInstances, station placement, widget state, logs, or status. Moving a widget between Canvas, Docking Station, in-app Float, and future external windows must preserve the same WidgetInstance identity and Workspace ownership.

For the full Docking Station, widget view mode, presence zone, and future drag-and-drop contract, see `docs/WIDGET_CONTRACT.md`.

## Context Isolation Between Workspaces

Separate Workspaces must not accidentally share:

- Agent Queue items
- Agent Runs
- Raw Logs, Overview Logs, and Result Reports
- applied Request snapshots
- captured Responses
- response validation results
- Git repository roots, status snapshots, reviews, commits, push state, or recovery decisions
- Notes/Notebook tabs or review notes
- widget instances, state, layout, inputs, results, or widget-local logs
- Workspace Activity
- artifacts
- operator decisions
- approved context packs
- secrets or sensitive context

Cross-Workspace sharing, copying, moving, linking, or duplication must be explicit and operator-visible when implemented. Copying a Queue Item, note, request, response, artifact, or Git review into another Workspace should create or attach a new Workspace-owned record rather than silently reusing mutable work history from the original Workspace.

## Allowed Shared Assets

Some reusable assets may be global or shared by explicit reference:

- Request Template definitions
- Response Template definitions
- generic WidgetDefinitions
- WidgetTemplates
- product/system contracts
- reusable tool definitions
- theme and design-system primitives
- user-level settings
- global notes when explicitly linked or attached

Reusable definitions are not the same as applied work history.

Applied Request snapshots, selected Response Template revisions for a block, captured Responses, Agent Runs, Queue Items, Git reviews, artifacts, decisions, widget state, logs, and Workspace Activity belong to the Workspace where the work happened.

Template edits must not mutate historical snapshots in any Workspace.

## Multiple Open Workspace Sessions

Future UI may support multiple open Workspaces through:

- a Workspace switcher
- recent/open Workspace tabs
- a sidebar of open Workspaces
- separate app windows later
- active Workspace indicators
- unsaved, running, blocked, failed, or review-needed badges per Workspace

The UI must make the active Workspace obvious before showing context, queue state, agent runs, Git state, notes, actions, or approvals.

Rules:

- actions apply to the active Workspace unless explicitly targeting another visible Workspace
- agent requests must identify the Workspace context they use
- Queue review, Git review, notes, and Agent Run views must show which Workspace they belong to when opened from cross-Workspace navigation
- switching Workspaces must not merge transient session state or hidden context
- notifications about running or review-needed work should identify the owning Workspace

## Agent Queue, Agent Runs, Git, Notes, Templates, And Activity

Agent Queue is Workspace-scoped.

Queue Items belong to one Workspace. A Queue Item may be shown in multiple Workbenches of the same Workspace if useful. It must not appear in unrelated Workspaces unless the operator explicitly copies or duplicates it as a new item.

Agent Runs belong to one Workspace and usually one Queue Item. Raw Log, Overview Log, and Result Report are scoped to that run and Workspace. Results must not be mixed across Workspaces.

Git roots and Git review state are Workspace/widget-scoped unless future Workspace-approved roots are implemented. Git review state for one Workspace must not appear in another Workspace by default. Future shared repository roots across Workspaces must be explicit and operator-approved, and historical Git review artifacts must preserve the Workspace and repository root they used.

Notes/Notebook content is widget/Workspace-scoped unless explicitly global. Review notes for one Workspace must not leak into another Workspace. Future copy/move/link behavior between Workspaces must be explicit.

Template definitions may be global or reusable. Applied Request snapshots, selected Response Template revisions, captured Responses, and response validation results are Workspace history. Template edits must not mutate historical snapshots in any Workspace.

Workspace Activity is scoped to one Workspace. Widget-local logs are scoped to widget instances within a Workspace/Workbench. Global app logs may exist separately for diagnostics, but they must not be confused with work history.

## Mobile And Server Direction

Future mobile or server-backed UI may list multiple Workspaces and their Agent Queue review states.

Mobile should act as a remote operator console across Workspaces, not as a context mixer. Opening a Queue Item, Agent Run, Git review, note, artifact, or decision from mobile/server UI must clearly show which Workspace it belongs to.

This is future product direction only. Mobile UI, server sync, multi-user operation, and remote execution are not implemented.

## WorkspaceSession

A WorkspaceSession is the runtime/current opening of a Workspace.

It may contain:

- opened_at
- closed_at
- active Workbench
- active widget
- transient UI state
- view preferences
- currently open drawer/popup
- live tool connections
- live agent runs
- future external popout window geometry for current runtime
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

When multiple Workbenches are implemented, each Workbench should remain a surface over the same Workspace-owned work history and context. Creating a new Workbench must not create a new Workspace, and moving between Workbenches must not change the owning Workspace.

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

The user adds, removes, moves, resizes, docks, floats in the workspace, or configures widgets inside the Workspace. A future true external popout may move a widget into a separate Tauri/OS window. These changes update the Workspace state, not the original Preset.

Current foundation: the data model, storage primitives, Notes, Terminal placeholder, Agent Chat placeholder, Agent Run placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder insertion, Notes widget-state save, Git manual desktop-only read-only status refresh, persisted widget layout update plumbing, frontend-only layout lock/edit-mode foundation with docked header-drag move and right/bottom/corner resize handles, frontend-only in-app floating widget mode with ghost placeholder and Dock back behavior, workspace activity events, and widget-local log reads/writes exist. The current floating mode is not a separate OS window and is not persisted as external popout geometry. Real capability widget insertion beyond placeholders, full drag-and-drop layout editing, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, always-on-top behavior, and preset editing are future work.

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
- template storage, editing, request generation, response capture, response parsing, response validation, executor integration, or Git-response association
- Agent Queue behavior beyond the static placeholder UI, storage, queue runner, automatic launch, automatic acceptance, response capture/parser/validator, Git association, or executor integration
- real agent run Raw Log, Overview Log, Result Report, log parser, overview summarizer, or response validator beyond the static Agent Run placeholder preview
- real capability widget insertion beyond the Notes, Terminal placeholder, Agent Chat placeholder, Agent Run placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder
- real capability widgets
- custom preset editor
- full drag-and-drop layout editor
- Docking Station rails, widget view modes, persisted widget presence zones, and drag-and-drop between Canvas, Docking Station, Float, or future external windows
- floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, and always-on-top behavior
- snapping, collision detection, auto-reflow, and freeform layout persistence editing
- full Notebook/Notes document storage, multi-tab state, text formatting tools, Markdown editor, autosave, and AI-in-Notes behavior
- log streaming or polling
- repository root persistence or approved Workspace-level repository roots beyond the transient Git widget input
- multi-open Workspace UI, Workspace tabs/sidebar, or separate Workspace windows
- mature multiple-Workbench UI for one Workspace
- cross-Workspace copy/move/link behavior
- server or mobile Workspace console
- automatic context sharing across Workspaces
- multi-user sync
- cloud sync
