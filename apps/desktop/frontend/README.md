# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a Workspace Start Screen shell built with Vite, React, and TypeScript.

The app starts on the Workspace Start Screen. In the Tauri desktop shell, creating or opening a workspace calls the Tauri workspace lifecycle commands, loads the Workbench state through `get_workspace_workbench_state`, maps it into `WorkbenchViewState`, and then opens the Empty Workbench shell.

In plain browser/Vite development, the workspace API uses an in-memory fallback so the frontend remains usable without Tauri. Browser fallback workspaces and Workbench states are local to the current page session and are lost on refresh.

The default preset intentionally renders no widgets. New workspaces still begin with an empty Workbench, and the current concrete catalog insertion paths are limited to persisted Notes, static Terminal placeholder, static Agent Chat placeholder, and Git placeholder widgets.

The Add Widget controls open a Widget Catalog shell. The catalog allows adding the Notes, Terminal placeholder, Agent Chat placeholder, and Git placeholder through the workspace API boundary. The Notes placeholder saves a single widget-state draft through `update_widget_instance_state` with the shape `{ "body": "..." }`; it is not a full Notes document model. The Terminal placeholder is static and does not execute commands, accept command input, or write widget state. The Agent Chat placeholder is static and does not accept chat input, execute agents, call LLMs, access Workspace context, persist chat messages, or stream responses. The Git placeholder includes a visible transient repository-root input. In the Tauri desktop path, the operator can manually refresh read-only Git status for that explicit repository root through `get_git_repository_status`; the result is shown as a visual status card with branch, clean/dirty state, counts, ahead/behind data when available, warnings, last commit data when available, and a read-only grouped changed-files summary. Changed files are grouped by staged, unstaged, untracked, conflicted, and unknown states, with lightweight UI-only hints for generated-looking, dependency, or schema-looking paths. The repository root and refreshed status are local React state only: they are not persisted, restored, polled, watched, validated into Workspace state, or reused after reopening. The Git placeholder renders explicit not-configured, browser-unsupported, clean, dirty, and common read-failure states without fake status data. The Git placeholder still does not show diffs, parse raw diff output, associate validation results, stage, unstage, commit, push, revert/reset, clean, stash, or run mutating Git operations. Docked widgets no longer expose the temporary Compact, Normal, and Wide controls. The Workbench top bar has a frontend-only layout mode control with locked and edit states; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final `dock_x`/`dock_y` position and `dock_width`/`dock_height` size persist through `update_widget_instance_layout`. Snapping, collision detection, auto-reflow, and floating overlay resize are not implemented. Widget frames include a frontend-only Float action that moves the same mounted widget into an in-app overlay and leaves a ghost placeholder with Dock back in the original slot; the floating frame exposes Move and Dock back actions. This floating state is transient, is not persisted, and does not use Tauri windows. Floating overlays can be repositioned inside the main Hobit window with an in-memory Move handle. Widget frames also include a local Logs toggle that performs bounded `list_widget_logs` reads when opened and refreshes an open panel after successful widget state/layout actions. Existing widget add/state/layout mutations emit basic persisted logs, but no runtime log emission, polling, or streaming exists yet. The Workbench canvas shows a compact Recent activity surface backed by workspace-scoped events returned from `get_workspace_workbench_state`; it is not a runtime log console. All other catalog templates remain planned and display-only. No preset persistence, terminal execution, agent runtime, chat runtime, full Git runtime, or general widget runtime behavior is implemented yet.

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

`WidgetHost` maps persisted widget instances to registered frontend components. The current registry contains the Notes, Terminal placeholder, Agent Chat placeholder, and Git placeholder renderers. The Widget Catalog template list remains separate metadata; only the Notes, Terminal placeholder, Agent Chat placeholder, and Git placeholder templates are currently available for insertion.

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
- Runtime widget behavior beyond placeholder insertion, the Notes state-save path, and generic frame/log/layout behavior.
- Real capability widget insertion beyond the Notes, Terminal placeholder, Agent Chat placeholder, and Git placeholder.
- Snapping, collision detection, auto-reflow, and floating overlay resize.
- True external Tauri/OS popout windows, persisted external popout geometry, and always-on-top behavior.
- Real terminal execution.
- Real agent calls, Agent Chat runtime, or workspace-context access from Agent Chat.
- Git behavior beyond manual desktop read-only status refresh for an explicit transient repository root.
- Repository-root persistence, status persistence, polling, background watching, diff view, raw diff parsing, validation association, staging, unstaging, commit, push, revert/reset, clean, stash, or other Git mutations.
- Preset persistence.
- Knowledge, Stages, Runbooks, Git, JDBC, Image Edit, or database UI.
