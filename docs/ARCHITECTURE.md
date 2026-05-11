# Architecture

This document describes the current repository structure and intended future architecture for Hobit.

The current repository contains a root Rust workspace that includes the core crates and the Tauri desktop shell, a Vite/React frontend, a minimal Tauri workspace bridge, and a SQLite workspace persistence foundation. Persisted Notes, a desktop-only one-shot Terminal command widget, static Agent Chat placeholder, static Agent Monitoring placeholder, static Agent Queue placeholder, Git placeholder, and static Template Library placeholder widgets exist as catalog insertion paths. The Git placeholder has a narrow manual desktop-only read-only status refresh path. The Terminal widget has a bounded one-shot command path for persisted Terminal widget instances only, but there is no shell mode, interactive terminal, streaming, PTY, cancellation, command history, agent runtime, Agent CLI runtime, chat execution, Agent Run runtime, Agent Queue runtime/storage, Template Library runtime, Git mutations/diff/log/show, or broad tool execution yet.

## Documentation Contracts

`PRODUCT_POSITIONING.md` defines Hobit's core positioning as an operator-controlled AI Workbench for precise, fast, and efficient work with AI agents. Future architecture must not drift toward a generic hidden automation or agent-runner system.

`DESIGN_SYSTEM_CONTRACT.md` defines the base visual language for future frontend and widget work.

`AGENT_OPERATING_MODEL.md` defines the future coordinator/executor operating model for agent-assisted block work. It is a contract only; no agent runtime, automatic execution, or response validation engine is implemented yet.

`WORKSPACE_COORDINATOR_AGENT_CONTRACT.md` defines the future Workspace-aware Coordinator Agent model for explicitly approved context reading and previewed cross-widget action proposals. It is a contract only; Agent Chat does not currently read Workspace context, propose actions, mutate widgets, create Queue Items, edit Notebook content, or execute actions.

`WORKSPACE_CONTRACT.md` defines Workspace as the durable isolation boundary for distinct problems and Workbench as a surface inside a Workspace. Future multi-open Workspace UI, Workspace tabs/sidebar/windows, and multiple Workbenches per Workspace must follow the rule: different problem = different Workspace; different surface for the same problem = additional Workbench.

`AGENT_QUEUE_CONTRACT.md` defines the future Agent Queue as an operator-controlled agent command queue, command history, and review inbox. The frontend has a static Agent Queue placeholder preview with queue groups, queue cards, frontend-local static item selection, selected item detail previews, linked surface summaries, and disabled planned actions; no queue storage, real queue item state, persisted item selection, background execution, response capture/parser/validator, executor integration, or automatic acceptance is implemented yet.

`AGENT_RUN_OBSERVABILITY_CONTRACT.md` defines future Raw Log, Overview Log, and Result Report views for agent/task execution. The frontend has a static insertable Agent Monitoring placeholder previewing those three views for one selected or active execution, but no agent execution log model, runtime log streaming, overview summarizer, result report persistence, response validation, executor integration, or real agent runtime UI is implemented yet.

`SCRIPT_RUNNER_WIDGET_CONTRACT.md` defines the future Script Runner Widget as an explicit operator-controlled configured local script action with visible script path, argv arguments, working directory, timeout, output caps, logs, results, and safety boundaries. Script Runner may appear as planned/display-only Widget Catalog metadata, but no Script Runner UI, widget insertion, backend execution, Tauri command, storage, or runtime behavior is implemented.

`GIT_WIDGET_CONTRACT.md` defines the future Git Widget / Git Plugin as a visual, approval-aware review/control surface for repository state after agent-assisted code work. An insertable frontend placeholder exists with a transient explicit repository-root input, manual desktop-only read-only status refresh, a visual status card, and grouped changed-files summary. Repository root/status persistence, polling, watching, diff/log/show, validation association, Git-response association, and mutating Git behavior are not implemented. Future Git reads must use an explicit operator-approved repository root; hidden parent traversal, Workspace-wide repository scanning, and network fetch during read-only status collection are forbidden by that contract.

`TEMPLATE_CONTRACT.md` defines the future product/domain contract for reusable Request Templates and Response Templates. Templates are not implemented yet; they are future Workspace/Project assets for creating concrete request snapshots and validating response shape. The frontend has a static insertable Template Library placeholder with Request Template, Response Template, and Coordinator Workflow previews, but no template storage, editing, request generation, response capture, response parsing, response validation, executor integration, Git-response association, or agent execution behavior is implemented.

`NOTES_WIDGET_CONTRACT.md` defines the future Notebook/Notes widget direction: legacy single-body Notes compatibility, multiple text tabs/documents inside one widget, Markdown source text, rendered Markdown and Mermaid fenced-block preview direction, explicit user-triggered text formatting actions, and operator-approved AI-assisted editing. The current frontend still only persists the minimal `{ "body": "..." }` Notes draft state.

`WIDGET_CONTRACT.md` defines future Dock and widget view mode rules. Dock is a Workspace-local perimeter surface for existing WidgetInstances in Indicator view. Clicking a Dock item should open future Compact view, while moving it to Canvas should open Full view. Real Dock behavior, Full/Compact/Indicator rendering behavior, persisted widget presence zones, and drag-and-drop between Canvas, Dock, Float, and future external windows are not implemented yet.

## Current Repository Skeleton

The implemented skeleton is:

```text
apps/
  desktop/
    README.md
    frontend/
      README.md
    src-tauri/
      README.md
      Cargo.toml
      tauri.conf.json

crates/
  hobit-core/
  hobit-storage-sqlite/
  hobit-agent/
  hobit-tools/
  hobit-app/
```

The root `Cargo.toml` defines a Rust workspace for `apps/desktop/src-tauri` and the five crates under `crates/`. Root workspace validation checks the Tauri desktop shell and the core crates together.

`hobit-core` contains minimal domain contract types.

`hobit-storage-sqlite` contains the initial idempotent SQLite schema and row-level storage primitives.

`hobit-agent` and `hobit-tools` are placeholder crates with package metadata and crate-level documentation. `hobit-app` contains the current Workspace application service foundation.

`apps/desktop/frontend` contains the current workspace/start screen and Empty Workbench frontend. `apps/desktop/src-tauri` contains a minimal Tauri 2 desktop shell that hosts the frontend and exposes workspace lifecycle/state commands.

## Current Frontend Milestone

A Vite, React, and TypeScript frontend scaffold exists under `apps/desktop/frontend`.

The current UI starts with a Workspace Start Screen shell. In the Tauri desktop shell, creating or opening a workspace calls the Tauri workspace lifecycle commands, loads the Workspace Workbench state through the workspace API facade, maps it into `WorkbenchViewState`, and then opens the Empty Workbench shell.

In plain browser/Vite development, the frontend uses an in-memory workspace API fallback so the start screen remains usable without Tauri. Browser fallback state is not persisted, and its Workbench state remains an in-memory empty surface.

The Empty Workbench shell intentionally renders no concrete widgets by default. New Workspaces still start with zero widget instances.

The frontend includes a Widget Catalog drawer opened from Add Widget controls. The Notes, Terminal, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder templates can be inserted through the workspace API as persisted WidgetInstances and rendered through `WidgetHost`. Script Runner and other future catalog templates remain planned/display-only metadata and are not registered widget definitions.

There is no shell execution, script execution, Script Runner widget beyond planned/display-only catalog metadata, agent runtime, chat execution, Workspace-aware Coordinator context/proposal behavior, Agent Queue behavior beyond the static placeholder preview, Agent Queue storage/runner/real command queue/history/review inbox, real agent run Raw Log/Overview Log/Result Report behavior beyond the static Agent Monitoring placeholder preview, Template Library runtime, template storage/editing/request generation/response validation, Git behavior beyond manual desktop-only read-only status refresh for an explicit transient repository root, real capability widget insertion beyond the Notes, Terminal one-shot command widget, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder, real Dock behavior, widget Full/Compact/Indicator view mode behavior, persisted presence zones beyond current canvas/floating presentation, preset editor, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or full Notebook/Notes document model yet.

## Current Desktop Shell Milestone

`apps/desktop/src-tauri` now contains a minimal Tauri 2 desktop shell for Hobit.

The shell loads the frontend dev server at `http://127.0.0.1:5173` during development and uses `apps/desktop/frontend/dist` for production frontend assets.

This milestone hosts the existing frontend and allows it to call the workspace lifecycle commands when running inside Tauri.

## Current Tauri Workspace Bridge Milestone

The Tauri shell initializes a local SQLite database at `hobit.sqlite3` in the Tauri app data directory.

On startup, the shell creates the app data directory if needed and runs the idempotent SQLite schema initialization.

The shell exposes WorkspaceService lifecycle and widget foundation commands over the Tauri bridge:

- `create_workspace`
- `list_workspaces`
- `get_workspace_summary`
- `open_workspace`
- `get_workspace_workbench_state`
- `add_widget_instance_to_workbench`
- `update_widget_instance_state`
- `update_widget_instance_layout`
- `list_widget_logs`
- `run_terminal_command`
- `get_git_repository_status`

The current Tauri bridge source keeps app state and SQLite initialization in `app_state.rs`, Workspace command handlers in `workspace_commands.rs`, and command DTO mapping in `workspace_dto.rs`.

The React frontend calls the workspace lifecycle, widget mutation/log read, Git status, and Terminal one-shot command paths through the workspace API facade when running inside Tauri. The browser/Vite path uses the same facade with an in-memory implementation; browser fallback throws a visible unsupported state for real Git status reads and Terminal command execution. The `run_terminal_command` Tauri command is called only from the Terminal widget UI and remains limited to persisted Terminal widget instances. There is no shell mode, interactive terminal, streaming, PTY, cancellation, command history, agent call, chat runtime, Agent Run runtime, Agent Queue runtime/storage, Template Library runtime, Git runtime beyond the narrow read-only status path, workspace restore runtime, log streaming/polling, or settings UI in this milestone.

## Current Workbench State Command Milestone

`hobit-app` can now return a canonical Workspace Workbench state summary for a Workspace. The summary includes the Workspace, current Workbench, persisted widget instance summaries, shared state object summaries, and stored Workbench event summaries.

The Tauri shell exposes this through `get_workspace_workbench_state`, backed by the existing local SQLite store and `WorkspaceService`.

The frontend consumes this command through its workspace API boundary and adapts the response into `WorkbenchViewState` before rendering the Workbench. There is still no event replay, runtime reconstruction, widget execution beyond the bounded Terminal one-shot command path, interactive terminal execution, or agent call behavior.

## Current Workspace Flow

The implemented desktop flow is:

```text
Create or open Workspace
  -> WorkspaceService creates or opens a WorkspaceSession
  -> frontend requests get_workspace_workbench_state
  -> Tauri bridge returns persisted Workspace/Workbench summary state
  -> frontend workspace API adapts it into WorkbenchViewState
  -> Empty Workbench renders from that view state
```

The browser/Vite flow keeps the same frontend boundary but uses in-memory Workspace and Workbench state instead of the Tauri bridge and SQLite store.

## Current Frontend Workspace Shell Milestone

The Workspace Start Screen reflects the intended user flow: open Hobit, create a local Workspace shell, then enter the Empty Workbench for the selected preset.

This milestone uses Tauri workspace commands in desktop mode and an in-memory frontend fallback in browser mode. It loads persisted Workbench summary state before entering the Workbench, but it does not implement runtime restoration, widget runtime reconstruction, real capability widget insertion beyond the Notes, Terminal one-shot command widget, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder, or persisted browser fallback state.

## Current Frontend Widget Milestone

The frontend now has a small `WidgetDefinition`, `WidgetInstance`, and `WorkbenchPreset` model.

The Empty Workbench is rendered from preset data and new Workspaces currently start with no visible widget instances.

`WidgetHost` remains the mapping layer from persisted widget instances to React components. The current frontend registry contains the Notes, Terminal, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder renderers.

The Widget Catalog has frontend-local template metadata for future capabilities. Only the Notes, Terminal, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder templates are currently available for insertion. Script Runner and all other future catalog templates remain planned/display-only. There is no runtime widget loading or real capability widget insertion beyond those available templates/placeholders through the Tauri bridge yet.

The Workbench top bar includes a compact global activity/idle indicator. It is current-session frontend state only: it shows `Idle - No active local runs` by default, switches to a running Terminal status while a Terminal one-shot command started from the current UI session is awaiting its backend response, and can show attention for failed or timed-out Terminal command requests. It does not poll SQLite run state, observe background work, monitor external processes, implement approvals, or imply that Agent Queue or Agent runtime execution exists.

The Notes placeholder persists a minimal draft through widget state using the shape `{ "body": "..." }`. This is not the full Notebook/Notes document model, multi-tab state, Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block preview system, text formatting tool surface, autosave flow, folder system, or AI-in-Notes implementation.

The Terminal widget accepts one explicit program, one argument per textarea line, an explicit working directory, timeout, and stdout/stderr caps. In the Tauri desktop path it calls `run_terminal_command`, creates widget run/log/result records through the backend, and renders the final stdout/stderr result. Browser/Vite fallback reports that local process execution is unsupported. It does not implement shell mode, interactive stdin, streaming, PTY, cancellation, command history, saved profiles, environment/secrets support, Agent-triggered execution, or Script Runner behavior.

The Agent Chat placeholder is static and does not accept chat input, execute agents, call LLMs, access Workspace context, propose actions, stream responses, or write widget state.

The Agent Monitoring placeholder is static and previews future Overview Log, Result Report, and Raw Log sections from `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` for one selected or active execution. It keeps the existing `agent-run` definition id for persistence compatibility and does not start runs, stream logs, persist run state, parse responses, validate results, summarize runtime events, integrate executor tasks, call agents, execute terminal commands, or write widget state.

The Agent Queue placeholder is static and previews future command queue/history/review inbox groups, queue item cards, frontend-local static card selection, selected item detail review surfaces, linked template/run/Git/notes context, and disabled planned operator actions. The local selection only swaps static preview data. It does not persist selected items or queue items, launch agents, run a background queue, capture responses, parse or validate responses, associate Git review, automatically accept work, or write widget state.

The Git placeholder has a transient explicit repository-root input. In the Tauri desktop path, it manually refreshes a read-only status snapshot through `get_git_repository_status`, backed by `hobit-tools`, and renders branch/clean-dirty/count/ahead-behind/warning/last-commit data plus grouped changed files. The repository root and refreshed status are local React state only. Browser/Vite fallback cannot read Git status. Repository root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented.

The Template Library placeholder is static and shows Request Template, Response Template, and Coordinator Workflow previews. It does not persist template data, edit templates, generate requests, capture responses, parse or validate responses, launch or integrate executor tasks, associate Git review with responses, call agents, or write widget state.

The frontend includes a layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final docked position and size persist through `update_widget_instance_layout`. Widgets can also be floated into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. This floating widget mode is not a separate OS window and is not persisted as external window geometry. The Workbench also includes a static frontend-only Dock placeholder preview with local rail toggles. There is no real Dock parking, Compact view rendering, Dock-to-Canvas movement, persisted presence zone model, full drag/drop layout editor, snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout window behavior, persisted external popout geometry, always-on-top behavior, or preset editor.

Widget frames include a widget-local Logs panel. It loads persisted widget-local logs through `list_widget_logs`, and open panels refresh after successful widget state/layout actions and Terminal one-shot command responses. Existing widget add/state/layout mutations emit basic persisted logs: `Widget added`, `Widget state saved`, and `Widget layout updated`. Terminal command runs emit bounded lifecycle logs. There is no runtime log streaming, polling, interactive terminal log stream, or real agent run Raw Log/Overview Log/Result Report model beyond the static Agent Monitoring placeholder preview.

The Workbench canvas includes a compact Recent activity surface backed by workspace-scoped events from `get_workspace_workbench_state`. This is not a runtime log console.

## Current Core Model Milestone

`hobit-core` now contains minimal Rust domain contracts for Workspace, Workbench, Presets, Widgets, Actions, Events, and Shared State.

These are pure domain contracts only. Persistence, frontend integration, and Tauri integration live outside `hobit-core`.

## Current SQLite Storage Milestone

`hobit-storage-sqlite` now has idempotent SQLite schema initialization.

It stores Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent primitives.

This storage layer is foundational only. It is wired through `hobit-app` and the Tauri workspace bridge for Workspace lifecycle, Workbench state loading, Notes, Terminal placeholder, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder insertion, Notes placeholder state, persisted widget layout fields, workspace activity events, widget-local logs, and Terminal one-shot run/result persistence. Git status refresh is read-only and does not write repository root/status into storage. The storage layer is not wired to agent runtime, interactive terminal sessions, chat runtime, Agent Run runtime, Agent Queue runtime/storage, Template Library runtime, Git runtime beyond the narrow status read path, real capability widgets beyond placeholders, runtime streaming, or agent run observability storage.

## Current Application Service Milestone

`hobit-app` now provides a minimal `WorkspaceService` over SQLite storage.

The service creates empty Workspaces with one associated empty Workbench, opens Workspaces by creating WorkspaceSession rows, appends basic Workbench events, returns simple Workspace and WorkspaceSession summaries, and supports the current widget foundation mutations for adding a WidgetInstance, updating widget state, updating widget layout, and listing widget-local logs.

This application layer is wired to the Tauri workspace bridge. It includes a bounded one-shot Terminal command orchestration path for persisted Terminal widget instances only, creating widget run/log/result records around the shared process adapter. It does not restore runtime state, execute non-Terminal widgets, run agents, provide shell mode, stream logs, or add agent behavior.

## Workspace Model Boundary

The current Workspace model foundation supports persisted Workspace records, WorkspaceSession records, Workbench records, widget instance summaries, widget state/layout fields, shared state summaries, widget-local logs, and Workbench event summaries.

The Workspace is the context-isolation boundary. Unrelated work such as Hobit development, a Vertica incident, VICO review, and personal planning should be separate Workspaces. Multiple Workbenches inside one Workspace are future surfaces for the same problem, not a way to mix unrelated contexts.

Full runtime restore is not implemented yet. There is no event replay, widget runtime reconstruction, preset editor, real Dock behavior, widget Full/Compact/Indicator view mode behavior, persisted presence zone model, full drag/drop layout editor, real capability widget insertion beyond the Notes, Terminal one-shot command widget, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder, shell or interactive terminal execution, chat execution, Agent Queue execution/storage/real command queue/history/review inbox, Agent Run execution, Template Library execution, Git behavior beyond manual read-only status refresh, or agent runtime behavior.

## Planned Notes Model

Future notes work will support Markdown documents organized in folders with global and workspace-local scopes. Future Notebook may also render Markdown-adjacent fenced blocks such as Mermaid diagrams, but source text remains the source of truth and rendering must not execute commands, load remote assets by default, or mutate note content.

The current app has a Notes placeholder widget that saves and restores one widget-state draft shaped as `{ "body": "..." }`, plus a Terminal one-shot command widget, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder widgets. The Agent Monitoring, Agent Queue, and Template Library placeholders only show static previews, and the Git placeholder supports only manual desktop read-only status refresh for a transient explicit repository root. Terminal supports only an explicit desktop one-shot command form, not shell mode or interactive terminal behavior. There is no notes document storage, Notebook tab model, text formatting tool surface, folder UI, Markdown editor, Markdown renderer, Mermaid or diagram renderer, rendered block preview system, autosave, sync, Knowledge ingestion flow, AI-in-Notes behavior, Agent Run runtime, Agent Queue storage/execution/response capture/validation, Template Library runtime, template storage/editing/request generation/response validation, Git mutations/diff/log/show, or agent chat runtime in the current repository.

## Intended Repository Layout

Future implementation may extend the skeleton into a structure similar to:

```text
apps/
  desktop/
    frontend/
      src/
        app/
        design-system/
        workbench/
        widgets/
        state/
    src-tauri/

crates/
  hobit-core/
  hobit-storage-sqlite/
  hobit-agent/
  hobit-tools/
  hobit-app/
```

## Intended Responsibilities

`apps/desktop` is intended to host the desktop shell when the app implementation begins.

`apps/desktop/frontend` is intended to hold the future frontend app, design system, workbench shell, widget UI, and frontend state coordination.

`apps/desktop/src-tauri` holds the current minimal Tauri desktop shell and future native bridge work.

`crates/hobit-core` is intended to hold core domain contracts and shared models.

`crates/hobit-storage-sqlite` owns the current local SQLite persistence foundation.

`crates/hobit-agent` is intended to hold agent runtime integration.

`crates/hobit-tools` is intended to hold structured tool capabilities and action execution boundaries.

`crates/hobit-app` is intended to hold application orchestration.

## Current Boundary

The current repository state is documentation, repository hygiene, a root Rust workspace including the Tauri shell, core Rust domain/storage/application crates, a frontend Workspace Start Screen and Empty Workbench shell, a Widget Catalog with persisted Notes, Terminal one-shot command widget, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder insertion paths, a minimal Tauri desktop host, SQLite-backed workspace/workbench state, widget state/layout, workspace event, widget-local log foundations in desktop mode, Terminal one-shot run/result persistence, and a narrow manual desktop-only read-only Git status path for the Git placeholder. Generated Tauri schema artifacts under `apps/desktop/src-tauri/gen/` are ignored.

Future feature implementation must preserve the Workbench-first, widget-first, approval-aware contracts while adding real widgets, runtime behavior, and editing capabilities intentionally.
