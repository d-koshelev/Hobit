# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a static Empty Workbench shell built with Vite, React, and TypeScript.

The default preset intentionally renders no widgets. The goal is to perfect the workbench shell, locked theme, spacing, and empty canvas before concrete widgets are added back through the widget catalog.

The UI is a frontend-only preview. It does not connect to Tauri, a backend, a terminal, or an agent runtime.

## Widget Registry And Preset Model

The workbench is rendered from a frontend-local preset model and an empty widget registry.

Current preset:

- Minimal Workbench: empty workbench surface

`WidgetHost` remains in place for future widget instances, but no concrete widget React components are registered in this milestone.

## Visual Direction

The Empty Workbench follows `docs/DESIGN_SYSTEM_CONTRACT.md`: dark blue-charcoal surfaces, a locked theme in `src/styles/hobit-theme.css`, no gradients, semantic state colors, and a unified shell/canvas surface.

Raw colors outside `src/styles/hobit-theme.css` are not allowed.

## Run Locally

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Intentionally Not Implemented Yet

- Concrete visible widgets.
- Widget catalog behavior.
- Real terminal execution.
- Real agent calls.
- Preset persistence.
- Tauri integration.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
