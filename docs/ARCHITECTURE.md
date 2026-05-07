# Architecture

This document describes the current repository skeleton and intended future architecture for Hobit.

The current repository contains a Rust workspace skeleton, a minimal Tauri desktop shell, a static frontend scaffold, and an initial SQLite storage schema. No backend integration, agents, real widgets, terminal execution, or tool implementations exist yet.

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

The root `Cargo.toml` defines a Rust workspace for the five crates under `crates/`.

`hobit-core` contains minimal domain contract types.

`hobit-storage-sqlite` contains the initial idempotent SQLite schema and row-level storage primitives.

`hobit-agent`, `hobit-tools`, and `hobit-app` are placeholder crates with package metadata and crate-level documentation.

`apps/desktop/frontend` contains the first static frontend scaffold. `apps/desktop/src-tauri` contains a minimal Tauri 2 desktop shell that hosts the frontend.

## Current Frontend Milestone

A Vite, React, and TypeScript frontend scaffold exists under `apps/desktop/frontend`.

The current UI starts with a frontend-only Workspace Start Screen shell. Creating a workspace uses local React state only and opens the static Empty Workbench shell.

The Empty Workbench shell intentionally renders no concrete widgets by default.

The frontend includes a Widget Catalog shell opened from Add Widget controls. The catalog is currently a UI-only surface with no runtime widget insertion, template registration, backend integration, or persistence.

There is no backend integration, Tauri command integration, terminal execution, agent runtime, or preset persistence yet.

## Current Desktop Shell Milestone

`apps/desktop/src-tauri` now contains a minimal Tauri 2 desktop shell for Hobit.

The shell loads the frontend dev server at `http://127.0.0.1:5173` during development and uses `apps/desktop/frontend/dist` for production frontend assets.

This milestone only hosts the existing frontend. It is not wired to `hobit-app`, SQLite storage, WorkspaceService commands, workspace lifecycle commands, widget runtime behavior, terminal execution, or agent calls.

## Current Frontend Workspace Shell Milestone

The Workspace Start Screen reflects the intended user flow: open Hobit, create a local Workspace shell, then enter the Empty Workbench for the selected preset.

This milestone is frontend-local state only. It is not wired to `hobit-app`, Tauri commands, SQLite storage, runtime restoration, real recent workspaces, or persistence.

## Current Frontend Widget Milestone

The frontend now has a small `WidgetDefinition`, `WidgetInstance`, and `WorkbenchPreset` model.

The Empty Workbench is rendered from preset data and currently contains no visible widget instances.

`WidgetHost` remains the single future mapping layer from widget instances to React components. The current frontend registry is intentionally empty.

The registry is frontend-local for now. There is no backend persistence, runtime widget loading, or Tauri bridge integration yet.

## Current Core Model Milestone

`hobit-core` now contains minimal Rust domain contracts for Workspace, Workbench, Presets, Widgets, Actions, Events, and Shared State.

These are contracts only. They are not persistence, runtime execution, frontend integration, Tauri integration, or concrete widget implementation.

## Current SQLite Storage Milestone

`hobit-storage-sqlite` now has idempotent SQLite schema initialization.

It stores Workspace, WorkspaceSession, Workbench/Preset, WidgetInstance, WidgetRun/Log/Result, SharedState, and WorkbenchEvent primitives.

This storage layer is foundational only. It is not wired to the frontend, Tauri, agent runtime, terminal execution, or concrete widget behavior yet.

## Current Application Service Milestone

`hobit-app` now provides a minimal `WorkspaceService` over SQLite storage.

The service creates empty Workspaces with one associated empty Workbench, opens Workspaces by creating WorkspaceSession rows, appends basic Workbench events, and returns simple Workspace and WorkspaceSession summaries.

This application layer is not wired to desktop/Tauri/frontend yet. It does not restore runtime state, execute widgets, run agents, execute terminal commands, or add UI behavior.

## Planned Workspace Model

Future Workspace model and storage work will support resumable work. A Workspace will be the durable user-facing container for a specific piece of work, and a WorkspaceSession will represent the current runtime opening of that Workspace.

Full Workspace application persistence is not implemented yet. There is no restore runtime, preset editor, or frontend/Tauri wiring in the current repository.

## Planned Notes Model

Future notes work will support Markdown documents organized in folders with global and workspace-local scopes.

This is not implemented yet. There is no notes storage, notes widget implementation, folder UI, Markdown editor, sync, or Knowledge ingestion flow in the current repository.

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

`crates/hobit-storage-sqlite` is intended to hold local persistence when storage is introduced.

`crates/hobit-agent` is intended to hold agent runtime integration.

`crates/hobit-tools` is intended to hold structured tool capabilities and action execution boundaries.

`crates/hobit-app` is intended to hold application orchestration.

## Current Boundary

The current repository state is documentation, repository hygiene, workspace package metadata, placeholder Rust modules, a frontend-only Workbench shell, and a minimal Tauri desktop host.

Feature implementation should begin in later phases when the contracts are ready to be exercised by real code.
