# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a frontend-only Workspace Start Screen shell built with Vite, React, and TypeScript.

The app starts on the Workspace Start Screen. Creating a workspace is local React state only and opens the Empty Workbench shell for the selected preset. This state is not persisted and is lost on refresh.

The default preset intentionally renders no widgets. The goal is to keep the workbench shell, locked theme, spacing, and empty canvas correct before concrete widgets are added back through the widget catalog.

The Add Widget controls open a Widget Catalog shell. The catalog is UI-only: no widget templates, widget insertion, preset persistence, backend integration, or runtime widget behavior are implemented yet.

The UI remains local React state only. The Tauri desktop shell exposes backend workspace commands, but this frontend does not call them yet. The frontend still makes no backend calls, terminal execution, or agent runtime calls.

## Widget Registry And Preset Model

The workbench is rendered from a frontend-local preset model and an empty widget registry.

Current preset:

- Empty Workbench: empty workbench surface

`WidgetHost` remains in place for future widget instances, but no concrete widget React components are registered in this milestone.

## Visual Direction

The Empty Workbench follows `docs/DESIGN_SYSTEM_CONTRACT.md`: dark blue-charcoal surfaces, a locked theme in `src/styles/hobit-theme.css`, no gradients, semantic state colors, and a unified shell/canvas surface.

Raw colors outside `src/styles/hobit-theme.css` are not allowed.

## Run Frontend-Only Dev

```powershell
npm install
npm run dev
```

## Run Tauri Dev

The Tauri shell lives in the sibling `apps/desktop/src-tauri` directory and hosts this frontend.

```powershell
npm run tauri:dev
```

## Build

```powershell
npm run build
```

## Build Tauri Shell

```powershell
npm run tauri:build
```

## Intentionally Not Implemented Yet

- Workspace persistence.
- Real recent workspace loading.
- Tauri workspace commands or backend workspace wiring.
- Concrete visible widgets.
- Runtime widget catalog behavior.
- Real terminal execution.
- Real agent calls.
- Preset persistence.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
