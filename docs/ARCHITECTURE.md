# Architecture

This document describes the current repository structure and intended future architecture for Hobit.

The current repository contains a root Rust workspace that includes the core crates and the Tauri desktop shell, a Vite/React frontend, a minimal Tauri workspace bridge, and a SQLite workspace persistence foundation. A persisted Notes placeholder widget exists as the first catalog insertion path. No agents, Terminal or Agent widgets, runtime execution, or tool implementations exist yet.

## Documentation Contracts

`DESIGN_SYSTEM_CONTRACT.md` defines the base visual language for future frontend and widget work.

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

The frontend includes a Widget Catalog drawer opened from Add Widget controls. The Notes placeholder template can be inserted through the workspace API as a persisted WidgetInstance and rendered through `WidgetHost`. Other catalog templates remain planned/display-only metadata and are not registered widget definitions.

There is no terminal execution, agent runtime, non-Notes widget insertion behavior, preset editor, drag/drop layout editor, resize handles, popout UI, or full Notes document model yet.

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

The current Tauri bridge source keeps app state and SQLite initialization in `app_state.rs`, Workspace command handlers in `workspace_commands.rs`, and command DTO mapping in `workspace_dto.rs`.

The React frontend calls these commands through the workspace API facade when running inside Tauri. The browser/Vite path uses the same facade with an in-memory implementation. There is no widget runtime behavior, non-Notes widget insertion, terminal execution, agent call, workspace restore runtime, log streaming/polling, or settings UI in this milestone.

## Current Workbench State Command Milestone

`hobit-app` can now return a canonical Workspace Workbench state summary for a Workspace. The summary includes the Workspace, current Workbench, persisted widget instance summaries, shared state object summaries, and stored Workbench event summaries.

The Tauri shell exposes this through `get_workspace_workbench_state`, backed by the existing local SQLite store and `WorkspaceService`.

The frontend consumes this command through its workspace API boundary and adapts the response into `WorkbenchViewState` before rendering the Workbench. There is still no event replay, runtime reconstruction, widget execution, terminal execution, or agent call behavior.

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

This milestone uses Tauri workspace commands in desktop mode and an in-memory frontend fallback in browser mode. It loads persisted Workbench summary state before entering the Workbench, but it does not implement runtime restoration, widget runtime reconstruction, non-Notes widget insertion, or persisted browser fallback state.

## Current Frontend Widget Milestone

The frontend now has a small `WidgetDefinition`, `WidgetInstance`, and `WorkbenchPreset` model.

The Empty Workbench is rendered from preset data and new Workspaces currently start with no visible widget instances.

`WidgetHost` remains the mapping layer from persisted widget instances to React components. The current frontend registry contains the Notes placeholder renderer.

The Widget Catalog has frontend-local template metadata for future capabilities. Only the Notes template is currently available for insertion; all other catalog templates remain planned/display-only. There is no runtime widget loading or non-Notes widget insertion through the Tauri bridge yet.

The Notes placeholder persists a minimal draft through widget state using the shape `{ "body": "..." }`. This is not the full Notes document model, Markdown editor, autosave flow, folder system, or AI-in-Notes implementation.

Docked widget size presets update persisted layout through `update_widget_instance_layout`. There is no drag/drop layout editor, resize handle UI, popout UI, or preset editor.

Widget frames include a widget-local Logs panel. It loads persisted widget-local logs through `list_widget_logs`, and open panels refresh after successful widget state/layout actions. Existing widget add/state/layout mutations emit basic persisted logs: `Widget added`, `Widget state saved`, and `Widget layout updated`. There is no runtime log streaming, polling, or widget execution.

The Workbench canvas includes a compact Recent activity surface backed by workspace-scoped events from `get_workspace_workbench_state`. This is not a runtime log console.

## Current Core Model Milestone

`hobit-core` now contains minimal Rust domain contracts for Workspace, Workbench, Presets, Widgets, Actions, Events, and Shared State.

These are pure domain contracts only. Persistence, frontend integration, and Tauri integration live outside `hobit-core`.

## Current SQLite Storage Milestone

`hobit-storage-sqlite` now has idempotent SQLite schema initialization.

It stores Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent primitives.

This storage layer is foundational only. It is wired through `hobit-app` and the Tauri workspace bridge for Workspace lifecycle, Workbench state loading, Notes placeholder insertion/state, docked layout size presets, workspace activity events, and widget-local logs. It is not wired to agent runtime, terminal execution, non-Notes widgets, runtime execution, or log streaming.

## Current Application Service Milestone

`hobit-app` now provides a minimal `WorkspaceService` over SQLite storage.

The service creates empty Workspaces with one associated empty Workbench, opens Workspaces by creating WorkspaceSession rows, appends basic Workbench events, returns simple Workspace and WorkspaceSession summaries, and supports the current widget foundation mutations for adding a WidgetInstance, updating widget state, updating widget layout, and listing widget-local logs.

This application layer is wired to the Tauri workspace bridge. It does not restore runtime state, execute widgets, run agents, execute terminal commands, stream logs, or add UI behavior.

## Workspace Model Boundary

The current Workspace model foundation supports persisted Workspace records, WorkspaceSession records, Workbench records, widget instance summaries, widget state/layout fields, shared state summaries, widget-local logs, and Workbench event summaries.

Full runtime restore is not implemented yet. There is no event replay, widget runtime reconstruction, preset editor, drag/drop layout editor, non-Notes widget insertion, terminal execution, or agent runtime behavior.

## Planned Notes Model

Future notes work will support Markdown documents organized in folders with global and workspace-local scopes.

The current app has only a Notes placeholder widget that saves and restores one widget-state draft shaped as `{ "body": "..." }`. There is no notes document storage, folder UI, Markdown editor, autosave, sync, Knowledge ingestion flow, or AI-in-Notes implementation in the current repository.

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

The current repository state is documentation, repository hygiene, a root Rust workspace including the Tauri shell, core Rust domain/storage/application crates, a frontend Workspace Start Screen and Empty Workbench shell, a Widget Catalog with a persisted Notes placeholder insertion path, a minimal Tauri desktop host, and SQLite-backed workspace/workbench state, widget state/layout, workspace event, and widget-local log foundations in desktop mode.

Future feature implementation must preserve the Workbench-first, widget-first, approval-aware contracts while adding real widgets, runtime behavior, and editing capabilities intentionally.
