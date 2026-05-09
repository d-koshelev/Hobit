# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a Workspace Start Screen shell built with Vite, React, and TypeScript.

The app starts on the Workspace Start Screen. In the Tauri desktop shell, creating or opening a workspace calls the Tauri workspace lifecycle commands, loads the Workbench state through `get_workspace_workbench_state`, maps it into `WorkbenchViewState`, and then opens the Empty Workbench shell.

In plain browser/Vite development, the workspace API uses an in-memory fallback so the frontend remains usable without Tauri. Browser fallback workspaces and Workbench states are local to the current page session and are lost on refresh.

The default preset intentionally renders no widgets. New workspaces still begin with an empty Workbench, and the first concrete catalog insertion path is limited to a persisted Notes placeholder widget.

The Add Widget controls open a Widget Catalog shell. The catalog allows adding the Notes placeholder through the workspace API boundary. The Notes placeholder saves a single widget-state draft through `update_widget_instance_state` with the shape `{ "body": "..." }`; it is not a full Notes document model. Docked widgets expose Compact, Normal, and Wide size preset controls that persist through `update_widget_instance_layout`. The Workbench canvas shows a compact Recent activity surface backed by workspace-scoped events returned from `get_workspace_workbench_state`; it is not a runtime log console. All other catalog templates remain planned and display-only. No preset persistence, terminal execution, agent runtime, or widget runtime behavior is implemented yet.

Recent workspaces are loaded from Tauri in desktop mode and from the in-memory fallback in browser mode. The frontend still has no terminal execution or agent runtime calls.

The workspace frontend flow is split by responsibility: `workspaceApi.ts` is the
public facade, `tauriWorkspaceApi.ts` invokes Tauri commands,
`memoryWorkspaceApi.ts` provides the browser/Vite in-memory fallback, and
`useWorkspaceFlow.ts` owns the start-screen lifecycle state. Workspace API DTOs
stay separate from UI selection state for opening the Workbench.

Workbench rendering consumes a frontend `WorkbenchViewState` boundary. Current
Tauri or memory Workbench state is adapted into that view state before
rendering, which keeps backend DTOs out of `WorkbenchShell`, `WorkbenchCanvas`,
and widget rendering.

## Widget Registry And Preset Model

The workbench is rendered from a frontend-local preset model and widget registry.

Current preset:

- Empty Workbench: empty workbench surface

`WidgetHost` maps persisted widget instances to registered frontend components. The current registry contains only the Notes placeholder renderer. The Widget Catalog template list remains separate metadata; only the Notes template is currently available for insertion.

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
- Full Notes editing or note document storage.
- Runtime widget behavior beyond the Notes placeholder insertion and state-save path.
- Non-Notes widget insertion.
- Real terminal execution.
- Real agent calls.
- Preset persistence.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
