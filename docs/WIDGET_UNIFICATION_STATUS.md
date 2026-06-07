# Widget Unification Status

## Purpose

This document records the status after the first widget unification foundation
block.

It is a docs-only status record. It does not add frontend behavior,
backend/Tauri commands, storage/schema changes, runtime behavior, widget
migrations, WidgetHost rewrites, WorkbenchCanvas rewrites, WorkspaceApi splits,
new widget insertion behavior, or tests.

Authoritative future implementation boundaries remain in
`docs/WIDGET_UNIFICATION_CONTRACT.md`,
`docs/WIDGET_SHELL_RUNTIME_AUDIT.md`, and
`docs/WIDGET_RUNTIME_CONTEXT_DESIGN.md`, together with the current widget
inventory in `docs/CURRENT_WIDGET_SURFACE.md`.

## Foundation Status

### Widget Unification Contract

`docs/WIDGET_UNIFICATION_CONTRACT.md` established the shared widget shell and
layout contract.

The contract defines:

- a shared `WidgetFrame` responsibility model for title, compact status, info,
  logs, settings, removal, focus, z-order, movement, resize, floating/dock-back
  affordances, and visible unsupported/error summary;
- shared layout-zone vocabulary: Header, Toolbar / Command Row, Primary
  Surface, optional Left Rail, optional Right Inspector, optional Bottom
  Drawer, and Popups / Overlays;
- `WidgetInfo` as the shared help/explanation pattern behind an info action;
- `WidgetPopupShell` as the widget-scoped popup shell for logs, settings,
  examples, developer details, import flows, draft review, bounded details, and
  confirmation flows;
- the widget responsibility rule: widgets render state and send explicit
  actions, while Workspace APIs and domain services own behavior;
- a staged migration order: shared primitives first, Queue first consumer,
  Knowledge second, Workspace Agent third, Terminal and Finder later.

The contract explicitly does not authorize broad WidgetHost rewrites,
WorkbenchCanvas rewrites, WorkspaceApi splits, runtime changes, visual redesign
of all widgets, storage/schema changes, new widgets, Dock/view-mode behavior,
external popouts, hidden context access, hidden mutation, or hidden execution.

### Shell / Runtime Audit

`docs/WIDGET_SHELL_RUNTIME_AUDIT.md` recorded the current shell and runtime
shape before migration.

The audit established:

- `WidgetFrame` already owns the main continuous widget chrome, header, title
  row, optional status, actions, content, optional footer, Logs button, and
  move-start behavior.
- `WidgetHost` is the registry-to-component mapping layer and frame prop
  adapter. It also currently normalizes compatibility titles, computes frame
  actions/styles, loads logs, and passes broad render props.
- `WorkbenchCanvas` owns docked layout rendering, resize handles,
  frontend-only popout state, ghost placeholders, z-order/focus behavior, and
  repeated `WidgetHost` calls for docked and popped-out presentations.
- `PopupShell` is the strongest shared popup primitive. It uses a portal,
  dialog role, anchored/floating variants, viewport-aware placement, Escape and
  outside-close behavior, focus return, initial focus, bounded scrolling, and
  drag repositioning through `[data-popup-drag-handle]`.
- `WidgetLogsPanel` already uses `PopupShell` as the main production shared
  popup consumer.
- Several widget-owned popups still use custom shells, including remove
  confirmation, Queue new task, Terminal PTY settings, Knowledge / Skills info,
  Direct Work stop confirmation, Widget Catalog, and Workspace Agent run
  details.

The audit identified Knowledge / Skills info as the safest first pilot, then
Terminal PTY settings shell, then widget remove confirmation. It also marked
WorkbenchCanvas, WidgetHost, broad render props, Queue, Finder, Workspace
Agent, JDBC, and broad component CSS edits as risky first-touch areas.

### Info / Popup Primitive Pilot

The first primitive pilot has been implemented in the frontend codebase.

Observed current implementation:

- `apps/desktop/frontend/src/design-system/WidgetInfoPopover.tsx` provides a
  shared info wrapper around `PopupShell`.
- `apps/desktop/frontend/src/design-system/WidgetInfoPopover.test.tsx` covers
  the shared info popup behavior.
- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.tsx` uses
  `WidgetInfoPopover` for the Knowledge / Skills header explanation.
- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.test.tsx` covers
  keeping Knowledge / Skills explanation behind the shared info popup.

This pilot is intentionally narrow. It proves a low-risk `WidgetInfo` path
through the existing `PopupShell` without changing widget layout, registry,
runtime behavior, persistence, Workspace APIs, or broad host/canvas logic.

`WidgetPopupShell` remains a product contract name. The current concrete
frontend primitive is `PopupShell`; future work can either continue adapting
`PopupShell` directly or introduce a widget-named wrapper when a migration
needs that naming clarity.

### WidgetRuntimeContext Design

`docs/WIDGET_RUNTIME_CONTEXT_DESIGN.md` established the target staged migration
away from broad `widgetHostRenderProps` / `WidgetHost` prop coupling.

The design defines `WidgetRuntimeContext` as a per-widget runtime object
supplied beside existing props during migration. The illustrative target shape
includes:

- identity: widget instance, definition, workbench, Workspace, and compatibility
  component key when needed;
- logs API: widget-local log load/refresh/status while preserving Terminal PTY
  session-only output boundaries;
- popup API: shared popup presentation mechanics without domain policy,
  execution, hidden reads, or destructive confirmation policy;
- focus/z-order API: frontend presentation requests only;
- settings API: narrow existing widget settings paths only, with no secrets or
  hidden runtime discovery;
- event/handoff router: typed, bounded, current-session visible handoff
  requests instead of direct cross-widget callback threading;
- optional narrow domain capabilities such as `queue`, `knowledge`,
  `workspaceAgent`, `terminal`, and `finder`.

The design keeps `WidgetHost` as the registry/component mapping layer and
requires context adoption to happen alongside existing props first. It warns
against making context another global bag, turning router events into hidden
automation, over-abstracting popup/settings policy, or combining host, canvas,
router, and domain migrations in one block.

## Safe To Migrate Next

The next migrations should stay below the broad host/canvas/API hotspots and
preserve current widget behavior.

Safe candidates:

- More `WidgetInfoPopover` migrations for simple informational help copy that
  currently lives in widget-specific popovers or persistent banners.
- A `WidgetPopupShell` naming wrapper or adapter over `PopupShell`, if a future
  block needs the widget-scoped terminology while preserving current popup
  behavior.
- Terminal PTY settings outer shell only, keeping all Terminal settings state,
  PTY lifecycle, and fallback behavior domain-owned.
- A non-destructive developer/details popup shell migration where content is
  already visible, bounded, and operator-opened.
- A minimal `WidgetRuntimeContext` pilot with identity plus one shell-level API
  such as popup or logs, passed alongside existing props with no required
  consumers at first.
- A narrow Knowledge / Skills capability adapter for Skill and Knowledge
  Document CRUD/search/import calls, if it avoids draft review, Queue context,
  provider paths, and broad WorkspaceApi splitting.
- A small Queue runtime-context pilot only after the context constructor and
  router/event boundary are explicit, and only for one capability at a time.

## Must Not Be Touched Yet

The following remain out of scope until explicitly requested by a focused
implementation block:

- full `WidgetHost` rewrite;
- full `WorkbenchCanvas` rewrite;
- full `WorkspaceApi` split;
- broad `WidgetRenderProps` or `widgetHostRenderProps` rewrite;
- all-widget visual redesign;
- all-widget popup/settings/log migration;
- Queue v2 behavior, hidden dispatch, hidden execution, automatic acceptance,
  or backend scheduling;
- Workspace Agent hidden context access, provider tools, direct widget
  execution, Terminal control, Git mutation, JDBC execution, or automatic Queue
  creation;
- Terminal tabs, split panes, persistent transcripts/history, Script Runner
  behavior, or PTY output persistence;
- Finder root persistence, recursive scanning, broad indexing, hidden context
  attachment, Terminal launch, Queue creation, or unsupported Git operations;
- Knowledge hidden ingestion, embeddings, team/server sharing, automatic prompt
  injection, or full Knowledge Catalog behavior;
- Dock, Compact/Indicator modes, presence-zone persistence, external OS/Tauri
  popouts, snapping, collision detection, auto-reflow, or preset editing;
- backend/Tauri commands, SQLite schema changes, storage migrations, new
  runtime behavior, or new widget catalog entries.

## Risks To Track

### WidgetHost

`WidgetHost` is still a necessary mapping and compatibility adapter. It is
risky because it currently combines component lookup, compatibility title
normalization, frame props, logs, style/action assembly, and domain prop
wiring.

Risk controls:

- keep `WidgetHost` as the registry-to-component mapping layer;
- add context beside existing props before removing any prop path;
- move domain-specific prop assembly into per-widget adapters only after a
  proven small consumer exists;
- do not rename compatibility ids or component keys during shell migration.

### WorkbenchCanvas

`WorkbenchCanvas` owns layout, resize, popout, ghost placeholders, z-order,
focus, and cross-widget handoff state. Shell work can accidentally change
presentation identity or layout persistence if it starts here.

Risk controls:

- avoid canvas edits for popup/info leaf migrations;
- extract handoff routing separately from layout/rendering work;
- preserve widget instance identity across docked/floating/popup presentation;
- keep resize, layout lock, and persisted geometry semantics unchanged.

### WorkspaceApi

`WorkspaceApi` remains broad and crosses many domains. A premature split can
cause churn across widgets, browser memory fallback, Tauri adapter, tests, and
handoff paths.

Risk controls:

- create narrow views/adapters over the existing composed API first;
- split by one domain at a time only after an adapter is proven;
- keep unsupported browser fallback behavior honest;
- avoid exposing broad Workspace reads, hidden mutations, provider tools, or
  cross-widget action shortcuts through the runtime context.

## Recommended Next Implementation Blocks

### 1. WidgetInfo Migration Batch

Target: migrate low-risk informational help popovers or inline help banners to
`WidgetInfoPopover`.

Scope:

- choose two or three simple widgets or panels with informational-only copy;
- preserve copy, visibility, and current unsupported/error behavior;
- avoid settings forms, destructive confirmations, runtime details, and domain
  action changes;
- run design-system/widget tests plus frontend typecheck.

Do not touch `WidgetHost`, `WorkbenchCanvas`, broad render props, or domain
APIs in this block.

### 2. WidgetPopupShell Migration Batch

Target: introduce or standardize a widget-scoped popup wrapper over the current
`PopupShell`, then migrate one or two shell-only secondary surfaces.

Scope:

- decide whether the wrapper is a naming adapter or a richer widget-scoped
  primitive;
- keep `PopupShell` behavior: explicit open, bounded size, Escape/outside
  close where safe, focus return, draggable handle where appropriate;
- migrate Terminal PTY settings outer shell or another non-destructive
  shell-only popup;
- keep all settings state and domain actions inside the owning widget.

Do not migrate destructive confirmations until an explicit `alertdialog`
wrapper is designed.

### 3. WidgetRuntimeContext Pilot For Queue Or Knowledge

Target: add a minimal context provider/constructor beside existing props and
pilot one narrow consumer.

Preferred first shape:

- identity plus one shell API, such as popup or logs; or
- identity plus a narrow `knowledge` API adapter for one low-risk Knowledge /
  Skills path.

Queue is higher value but higher risk. If Queue is chosen, start with one
non-execution capability and preserve existing controller tests. Avoid Queue
execution, autorun, run-link history, Knowledge context materialization, and
report-card handoffs in the first context pilot.

Do not remove old props in the pilot block.

### 4. Workbench Handoff Router Extraction

Target: move direct cross-widget handoff callbacks into a typed current-session
router.

Scope:

- define typed visible request events with source identity, target surface or
  widget id, bounded payload summary, and correlation id;
- start with one existing handoff path and preserve behavior exactly;
- test invalid payloads, bounded payloads, and ignored unsupported events.

The router must not become an automation bus, hidden scheduler, provider tool
layer, or cross-widget mutation shortcut.

Do not combine this with WidgetHost render-prop cleanup or major Queue /
Workspace Agent UI changes.

### 5. WorkspaceApi Split

Target: reduce broad frontend API coupling after narrow adapters and router
patterns exist.

Scope:

- split one domain API facade at a time, beginning with the narrowest proven
  adapter;
- keep the composed `WorkspaceApi` available until all consumers of that domain
  are migrated;
- update memory, unsupported, and Tauri adapters together for that domain;
- preserve browser fallback limitations and current desktop behavior.

Do not attempt a whole-API split in one block.

## Current Recommended Order

1. WidgetInfo migration batch.
2. WidgetPopupShell migration batch.
3. Minimal WidgetRuntimeContext pilot in Knowledge / Skills.
4. Workbench handoff router extraction for one current handoff.
5. Queue-specific runtime-context pilot.
6. WorkspaceApi split by one proven domain facade.

This order keeps the first implementation work in low-risk shell primitives,
then introduces runtime context and router boundaries before touching the
highest-coupling Queue, Workspace Agent, WorkbenchCanvas, and WorkspaceApi
areas.
