# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a Workspace Start Screen shell built with Vite, React, and TypeScript.

The app starts on the Workspace Start Screen. In the Tauri desktop shell, creating or opening a workspace calls the Tauri workspace lifecycle commands and then opens the Empty Workbench shell for the selected preset.

In plain browser/Vite development, the workspace API uses an in-memory fallback so the frontend remains usable without Tauri. Browser fallback workspaces are local to the current page session and are lost on refresh.

The default preset intentionally renders no widgets. The goal is to keep the workbench shell, locked theme, spacing, and empty canvas correct before concrete widgets are added back through the widget catalog.

The Add Widget controls open a Widget Catalog shell. The catalog is UI-only: no widget templates, widget insertion, preset persistence, backend integration, or runtime widget behavior are implemented yet.

Recent workspaces are loaded from Tauri in desktop mode and from the in-memory fallback in browser mode. The frontend still has no terminal execution or agent runtime calls.

The workspace frontend flow is split by responsibility: `workspaceApi.ts` is the
public facade, `tauriWorkspaceApi.ts` invokes Tauri commands,
`memoryWorkspaceApi.ts` provides the browser/Vite in-memory fallback, and
`useWorkspaceFlow.ts` owns the start-screen lifecycle state. Workspace API DTOs
stay separate from UI selection state for opening the Workbench. This does not
add Workbench state loading yet.

## Widget Registry And Preset Model

The workbench is rendered from a frontend-local preset model and an empty widget registry.

Current preset:

- Empty Workbench: empty workbench surface

`WidgetHost` remains in place for future widget instances, but no concrete widget React components are registered in this milestone.

## Visual Direction

The Workspace Start Screen and Empty Workbench follow `docs/DESIGN_SYSTEM_CONTRACT.md`: dark blue-charcoal surfaces, a locked theme in `src/styles/hobit-theme.css`, no gradients, semantic state colors, and a unified shell/canvas surface.

Raw colors outside `src/styles/hobit-theme.css` are not allowed.

## Run Frontend-Only Dev

This mode uses the in-memory workspace API fallback.

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

- Frontend persistence outside the Tauri workspace commands.
- Concrete visible widgets.
- Runtime widget catalog behavior.
- Real terminal execution.
- Real agent calls.
- Preset persistence.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
