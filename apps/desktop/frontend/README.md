# Desktop Frontend

This directory contains the future Hobit desktop frontend.

## Current State

The current milestone is a Workspace Start Screen shell built with Vite, React, and TypeScript.

The app starts on the Workspace Start Screen. In the Tauri desktop shell, creating or opening a workspace calls the Tauri workspace lifecycle commands, loads the Workbench state through `get_workspace_workbench_state`, maps it into `WorkbenchViewState`, and then opens the Empty Workbench shell.

In plain browser/Vite development, the workspace API uses an in-memory fallback so the frontend remains usable without Tauri. Browser fallback workspaces and Workbench states are local to the current page session and are lost on refresh.

The default preset intentionally renders no widgets. New workspaces still begin with an empty Workbench, and the current concrete catalog insertion paths are limited to persisted Notes, static Terminal placeholder, static Agent Chat placeholder, static Agent Monitoring placeholder, static Agent Queue placeholder, Git placeholder, and Template Library placeholder widgets. Script Runner appears in the Widget Catalog as a planned/display-only item only; it follows `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md` and is not implemented, insertable, or available for script execution.

The Add Widget controls open a Widget Catalog shell. The catalog allows adding the Notes, Terminal placeholder, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder through the workspace API boundary. The Notes placeholder saves a single widget-state draft through `update_widget_instance_state` with the shape `{ "body": "..." }`; it is not a full Notebook/Notes document model and does not implement tabs, Markdown rendering, Mermaid or diagram rendering, formatting tools, checklists, todos, or AI-assisted editing. The Terminal placeholder is static and does not execute commands, accept command input, or write widget state. The Agent Chat placeholder is static and does not accept chat input, execute agents, call LLMs, access Workspace context, persist chat messages, or stream responses. The Agent Monitoring placeholder is static and previews future Overview Log, Result Report, and Raw Log sections for one selected or active execution only; it keeps the existing `agent-run` definition id for persistence compatibility and cannot start runs, stream logs, persist run state, parse responses, validate results, or integrate executor tasks. The Agent Queue placeholder is static and previews future command queue/history/review inbox groups, queue item cards, frontend-local static card selection, selected item detail previews, linked template/run/Git/notes context, and disabled planned operator actions; selection only swaps static preview data and is not persisted. It cannot persist queue items, launch agents, run a background queue, capture executor responses, parse or validate responses, associate Git review, mutate Git, automatically accept work, or write widget state. The Git placeholder includes a visible transient repository-root input. In the Tauri desktop path, the operator can manually refresh read-only Git status for that explicit repository root through `get_git_repository_status`; the result is shown as a visual status card with branch, clean/dirty state, counts, ahead/behind data when available, warnings, last commit data when available, and a read-only grouped changed-files summary. Changed files are grouped by staged, unstaged, untracked, conflicted, and unknown states, with lightweight UI-only hints for generated-looking, dependency, or schema-looking paths. The repository root and refreshed status are local React state only: they are not persisted, restored, polled, watched, validated into Workspace state, or reused after reopening. The Git placeholder renders explicit not-configured, browser-unsupported, clean, dirty, and common read-failure states without fake status data. The Git placeholder still does not show diffs, parse raw diff output, associate validation results, stage, unstage, commit, push, revert/reset, clean, stash, or run mutating Git operations. The Template Library placeholder includes static Request Template, Response Template, and Coordinator Workflow previews for future executor block work, plus a local-only generated executor request preview built from transient React state and the static Codex implementation block preview data. The generated preview is not persisted, copied, sent, or connected to an executor; it does not add a template engine, template storage, response capture, response validation, agent calls, or Git-response association. The Workbench canvas includes a compact Dock placeholder surface that previews independently enabled top, right, bottom, and left perimeter rails with static Indicator-style examples only; its controls are local UI state and it does not park widgets, move widgets, open Compact views, persist Dock state, implement drag-and-drop, or add presence-zone behavior. Future Script Runner, JIRA, and Confluence catalog entries are planned/display-only candidates; Script Runner is planned for explicit operator-controlled configured local script execution, but no Script Runner UI, widget insertion, backend runtime, Tauri command, storage, or script execution exists. Docked widgets no longer expose the temporary Compact, Normal, and Wide controls. The Workbench top bar has a frontend-only layout mode control with locked and edit states; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final `dock_x`/`dock_y` position and `dock_width`/`dock_height` size persist through `update_widget_instance_layout`. Snapping, collision detection, auto-reflow, and floating overlay resize are not implemented. Widget frames include a frontend-only Float action that moves the same mounted widget into an in-app overlay and leaves a ghost placeholder with Dock back in the original slot; the floating frame exposes Move and Dock back actions. This floating state is transient, is not persisted, and does not use Tauri windows. Floating overlays can be repositioned inside the main Hobit window with an in-memory Move handle. Widget frames also include a local Logs toggle that performs bounded `list_widget_logs` reads when opened and refreshes an open panel after successful widget state/layout actions. Existing widget add/state/layout mutations emit basic persisted logs, but no runtime log emission, polling, or streaming exists yet. The Workbench canvas shows a compact Recent activity surface backed by workspace-scoped events returned from `get_workspace_workbench_state`; it is not a runtime log console. All other catalog templates remain planned and display-only. No preset persistence, terminal execution, script execution, agent runtime, chat runtime, Agent Run runtime, Agent Queue storage/runtime, full Git runtime, Template Library runtime, JIRA integration, Confluence integration, or general widget runtime behavior is implemented yet.

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

`WidgetHost` maps persisted widget instances to registered frontend components. The current registry contains the Notes, Terminal placeholder, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder renderers. The Widget Catalog template list remains separate metadata; only the Notes, Terminal placeholder, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder templates are currently available for insertion. Script Runner is listed only as a planned/display-only catalog item and is not registered or insertable.

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
- Full Notebook/Notes editing, note document storage, multi-tab state, Markdown rendering, Mermaid or diagram rendering, checklist/todo structure, text formatting tools, or AI-assisted editing.
- Runtime widget behavior beyond placeholder insertion, the Notes state-save path, Git manual read-only status refresh, and generic frame/log/layout behavior.
- Script Runner UI, widget insertion, script execution, backend execution, Tauri commands, storage, or runtime behavior beyond the planned/display-only catalog item.
- Real capability widget insertion beyond the Notes, Terminal placeholder, Agent Chat placeholder, Agent Monitoring placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder.
- Real Dock widget parking, Compact views from Dock items, Dock persistence, drag-and-drop, presence-zone storage, or per-widget Indicator status providers.
- Snapping, collision detection, auto-reflow, and floating overlay resize.
- True external Tauri/OS popout windows, persisted external popout geometry, and always-on-top behavior.
- Real terminal execution.
- Real agent calls, Agent Chat runtime, or workspace-context access from Agent Chat.
- Agent Run runtime, streaming logs, run storage, response parsing, response validation, overview summarization, or executor integration beyond the static Agent Monitoring preview.
- Agent Queue persisted selection, storage, queue item persistence, background queue running, automatic launch, automatic acceptance, response capture/parser/validator, Git association, or executor integration.
- Git behavior beyond manual desktop read-only status refresh for an explicit transient repository root.
- Repository-root persistence, status persistence, polling, background watching, diff view, raw diff parsing, validation association, staging, unstaging, commit, push, revert/reset, clean, stash, or other Git mutations.
- Template storage, template editing, real variable filling, a template generation engine, persisted request generation, copy/send behavior, response capture, response parsing, response validation, executor launch/integration, Git-response association, or agent execution from the Template Library placeholder.
- Preset persistence.
- Knowledge, Stages, Runbooks, JIRA, Confluence, JDBC, Image Edit, or database UI.
- Full Git review/control UI beyond the current placeholder status surface.
