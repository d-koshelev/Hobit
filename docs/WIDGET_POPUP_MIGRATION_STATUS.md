# Widget Popup Migration Status

## Purpose

This document records the current status of the shared widget popup shell
migration.

It is a docs-only status record. It does not add frontend behavior,
backend/Tauri commands, storage/schema changes, runtime behavior, widget
migrations, tests, new widget insertion behavior, or product scope.

Authoritative implementation boundaries remain in
`docs/WIDGET_UNIFICATION_CONTRACT.md`, `docs/WIDGET_UNIFICATION_STATUS.md`,
and `docs/CURRENT_WIDGET_SURFACE.md`.

## Current Migration Summary

The concrete shared primitive is `WidgetPopupShell`, a widget-scoped wrapper
over the existing `PopupShell`.

`WidgetPopupShell` currently preserves the underlying shared popup mechanics:

- portal rendering outside the widget body;
- `role="dialog"` with caller-provided labelling;
- anchored placement by default, with a floating variant available;
- Escape close;
- outside-pointer close;
- focus return to the invoking control when a return-focus ref is provided;
- viewport-bounded height;
- internal popup scrolling through the shared shell styles;
- drag repositioning when popup content marks a header with
  `data-popup-drag-handle`.

### Logs Popup

Widget-local Logs now use `WidgetPopupShell` through `WidgetLogsPanel`.

Implemented status:

- Logs open from the widget frame Logs action and remain widget-scoped.
- Logs use the invoking Logs control as the anchor and focus-return target.
- Logs load only when opened and refresh through the existing widget log load
  path.
- Log rows and log messages remain capped with existing render memory guards.
- Empty, loading, and load-error states remain visible inside the popup.
- The popup title is draggable through the shared drag-handle marker.

No Terminal PTY transcript persistence, event-streamed Terminal log bridge,
raw uncapped logs, or cross-widget log access is added by this migration.

### Workspace Agent Examples And Settings Popups

Workspace Agent prompt examples and Codex settings now use
`WidgetPopupShell`.

Implemented status:

- Prompt examples are opened explicitly from the Workspace Agent status area.
- Selecting a prompt example fills the visible composer path and closes the
  popup.
- Codex settings are opened explicitly from the composer settings control.
- Settings remain domain-owned by Workspace Agent Direct Mode: working
  directory, browse/copy actions, and sandbox selection are not moved into the
  shell.
- Both examples and settings use anchored placement, Escape/outside close,
  focus return, and draggable popup headers.

No provider settings UI, secrets UI, hidden context access, new provider tools,
Terminal control, Git mutation, JDBC execution, Queue auto-creation, or Agent
Executor launch behavior is added by this migration.

### Workspace Agent Run Details Popup

Workspace Agent Run details now use `WidgetPopupShell`.

Implemented status:

- Run details open explicitly from the composer Run details control.
- Direct Work activity, bounded log rows, final-result preview, and Knowledge
  lookup details stay Workspace-Agent-owned.
- Visible log rows and final-result text remain capped by render memory guards.
- Raw/technical Knowledge lookup details remain behind a nested disclosure.
- The popup uses anchored placement, Escape/outside close, focus return, and a
  draggable header.

No raw uncapped Direct Work detail, automatic Queue creation, hidden Workspace
reads, or persisted activity history is added by this migration.

### Developer / Details Pilot Migration

The Queue selected-task Developer details pilot now uses `WidgetPopupShell`.

Implemented status:

- Developer details open explicitly from the selected-task details area.
- Advanced run, activity, raw, task metadata, Diff Review linkage, worker
  report, and submitted metadata remain Queue-owned content.
- Large raw report and Direct Work sections remain collapsed and capped.
- The popup has an explicit Close button in addition to shared Escape/outside
  close.
- The popup uses anchored placement, focus return, bounded shell height, and a
  draggable header.

This pilot does not change Queue task lifecycle, assignment, execution,
Autorun, worker reports, Diff Review creation, Workspace Chat handoff, or raw
run ownership.

## Shared Behavior Recorded

- Close: implemented through Escape and outside pointer close in `PopupShell`;
  migrated Queue Developer details also provides an explicit Close button.
- Focus: popup receives focus on open, and focus returns to the invoking
  control when the caller provides `returnFocusRef`.
- Bounded scroll: popup max height is bounded to the viewport by `PopupShell`;
  migrated content relies on existing popup/body styles and render caps to keep
  details bounded.
- Z-index: popups render through a portal and depend on the shared popup shell
  CSS stacking layer. No new z-index policy or Workbench z-order integration
  was introduced in this migration.
- Draggable: implemented by shared pointer handling when content includes
  `data-popup-drag-handle`; current migrated popups mark their headers.
- Layout lock: no layout-lock-specific popup behavior was introduced. Popup
  open, close, drag, and focus remain presentation-only and do not change
  widget geometry or persisted layout.

## Remaining Candidates

The following remain candidates for later focused migration blocks:

- Terminal settings outer shell.
- Knowledge import and draft review secondary surfaces.
- Queue developer/details follow-up hardening, including any remaining raw
  detail sections not yet behind the shared shell.
- Finder secondary actions, including preview/help/detail popups where they
  remain widget-scoped and bounded.
- Widget Catalog information/help surfaces.

These candidates are not authorized by this status record. Each should keep
domain state and actions in the owning widget and migrate only popup shell
mechanics unless a future block explicitly scopes behavior changes.

## Risks To Track

- Popup z-index: portal popups can conflict with Workbench floating widgets,
  drawers, catalog surfaces, or future Dock/overlay layers unless stacking is
  kept explicit and shared.
- Focus traps: current behavior focuses the dialog and returns focus, but it is
  not a full modal focus trap. Forms and detail popups should be tested for
  tab order and focus escape.
- Keyboard behavior: Escape close is shared, but unsaved-edit, destructive
  confirmation, and interrupting-action cases need explicit rules before
  migration.
- Layout lock interactions: popup dragging is independent of widget movement.
  Future work should confirm layout lock freezes widget geometry without
  accidentally disabling needed popup comparison/repositioning behavior.
- Raw details size and caps: Queue, Direct Work, logs, diffs, SQL results,
  import previews, provider payloads, and developer details must stay capped,
  redacted where needed, and collapsed by default when raw.
- Shell/domain leakage: shared popup code must not own domain behavior,
  execution, hidden reads, persistence, or approval policy.

## Recommended Next Block

Recommended next block: broader `WidgetInfo` migration.

Reasoning:

- The popup shell has already proven useful for Logs, Workspace Agent
  examples/settings/details, and Queue Developer details.
- `WidgetInfo` migration is lower risk than a `WidgetRuntimeContext` pilot
  because it stays in shell/help presentation and avoids broad prop, API,
  router, and domain ownership questions.
- Widget Catalog info/help and simple widget help surfaces are natural
  candidates if they preserve current copy, current limitations, and existing
  unsupported/error behavior.

Defer the `WidgetRuntimeContext` pilot until one more small WidgetInfo or
popup-info batch confirms the shared shell vocabulary across non-runtime
surfaces. When runtime context begins, start with identity plus one shell-level
API only, and keep existing props in place.

## Explicit Non-Goals

This status record does not implement or authorize:

- frontend code changes;
- backend/Rust/Tauri changes;
- test changes;
- storage/schema changes;
- new runtime behavior;
- new widget insertion behavior;
- all-widget popup migration;
- destructive confirmation migration;
- provider/tool settings;
- hidden context reads;
- hidden mutation or execution;
- Queue execution or Autorun changes;
- Terminal runtime changes;
- Finder root persistence or hidden scanning;
- Knowledge ingestion or automatic prompt injection.
