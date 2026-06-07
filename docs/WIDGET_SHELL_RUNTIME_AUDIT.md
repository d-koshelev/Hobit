# Widget Shell Runtime Audit

## Purpose

Inspect-only audit of the current shared widget shell, popup, info, logs, and
layout primitives before a future unification block.

This document records current implementation shape only. It does not add
frontend behavior, backend/Tauri commands, storage/schema, widget migrations,
new popup behavior, or new widget insertion behavior.

## Scope Inspected

- `apps/desktop/frontend/src/workbench/WidgetHost.tsx`
- `apps/desktop/frontend/src/workbench/widgetHostRenderProps.ts`
- `apps/desktop/frontend/src/workbench/widgetRenderProps.ts`
- `apps/desktop/frontend/src/workbench/widgetRegistry.ts`
- `apps/desktop/frontend/src/workbench/catalogTemplates.ts`
- `apps/desktop/frontend/src/workbench/WorkbenchCanvas.tsx`
- `apps/desktop/frontend/src/workbench/*` popup, popover, info, logs, and settings components found during targeted inspection
- `apps/desktop/frontend/src/design-system/WidgetFrame.tsx`
- `apps/desktop/frontend/src/design-system/PopupShell.tsx`
- `apps/desktop/frontend/src/design-system/WidgetLogsPanel.tsx`
- `apps/desktop/frontend/src/styles/components.css`
- `apps/desktop/frontend/src/styles/layout.css`
- `apps/desktop/frontend/src/styles/widget-frame.css`, reached through `layout.css` imports because it owns the current widget-frame and popup styles

## Existing Shared Widget Shell Primitives

- `WidgetFrame` is the main shared widget chrome. It owns the continuous widget surface, header, title row, optional status, header actions, content area, optional footer, Logs button, and move-start behavior.
- `WidgetHost` is the registry-to-component mapping layer. It resolves the widget definition, normalizes compatibility titles for Workspace Agent, Agent Executor, and Knowledge / Skills, computes frame actions, computes docked frame styles, loads widget logs, and passes frame props into each widget.
- `WidgetRenderProps` is the broad render contract. It already carries shell-facing props such as `frameActions`, `frameMoveEnabled`, `frameStyle`, `logRefreshToken`, `onLoadLogs`, `onStartFrameMove`, `title`, `instance`, `definition`, and `config`.
- `widgetHostRenderProps` centralizes per-widget capability prop wiring. It is not a shell primitive, but it is the current adapter boundary between shared host state/actions and widget bodies.
- `widgetRegistry` owns current widget definitions, component keys, layout defaults, min sizes, compatibility/internal widget filtering, and user-facing registry filtering.
- `catalogTemplates` is a separate product catalog model for user-facing insertion text, readiness, availability, and default layout sizing.
- `WorkbenchCanvas` owns docked layout rendering, resize handles, frontend-only popout state, ghost placeholders, z-order/focus behavior, and the repeated `WidgetHost` calls for docked and popped-out presentations.
- `WidgetLogsPanel` is a shared widget-local logs panel loaded through `WidgetFrame` and backed by the shared popup primitive.
- Styles for `WidgetFrame`, `WidgetLogsPanel`, and `PopupShell` are centralized in `widget-frame.css`, which is imported by `layout.css`.

## Existing Popup And Popover System

- `PopupShell` is the strongest shared popup primitive. It renders into a portal, uses `role="dialog"`, supports anchored and floating variants, computes viewport-aware anchored placement, closes on Escape and outside pointer down, returns focus to the trigger, focuses the popup on open, supports bounded scrolling, and supports drag repositioning through `[data-popup-drag-handle]`.
- `WidgetLogsPanel` is the main production use of `PopupShell`.
- Several widget-owned popups/dialogs do not use `PopupShell`:
  - `WidgetRemoveAction` renders an absolute-positioned `role="alertdialog"` confirmation inside the frame action area.
  - `AgentQueueNewTaskDialog` renders a custom modal-like layer and dialog.
  - `TerminalPtySettingsPopover` renders a custom `terminal-settings-popover` dialog shell.
  - `SkillLibraryWidget` renders a custom `skill-library-info-popover` help dialog.
  - `CodexDirectWorkStopPanel` renders a custom force-kill confirmation dialog.
  - `WidgetCatalogShell` renders its own catalog drawer dialog.
  - Workspace Agent direct-mode run details use custom `interactive-agent-popup` styling.
- Current popup styling is split between shared `popup-shell` CSS and widget-specific CSS classes in `components.css` and catalog/layout styles.

## Existing Info And Help Pattern

- There is no general `WidgetInfo` or `InfoPopover` primitive.
- The closest current shared pattern is a `WidgetFrame` `status` slot, but the slot is generic React content and not specifically an info/help affordance.
- Knowledge / Skills uses a custom `i` button in the `status` slot plus an inline custom popover with explanatory text.
- Many widgets render help/boundary copy inline inside their bodies using widget-specific classes, for example Runbook local-only copy, Terminal advanced/fallback copy, Direct Work settings notes, Queue boundaries, and Workspace Agent direct-mode help text.
- Collapsed disclosure is commonly implemented directly with native `details`/`summary`, not through a shared disclosure primitive.

## Widget-Owned Headers, Settings, Logs, And Help

- Most widgets already use `WidgetFrame`, but several own secondary header zones inside their body:
  - Agent Activity has its own internal widget header and event count badge.
  - Agent Queue owns a large internal layout, sidebar, details panel, task run settings, worker controls, and multiple `details` sections.
  - Finder owns complex pane headers, preview/git/history surfaces, and Finder-owned floating preview state.
  - Notes owns `NotesToolbar`, list collapse rail, editor header/status behavior, and promotion controls.
  - Database / JDBC owns connector/profile/query section headers, runtime details, diagnostics, and many inline notices.
  - Workspace Agent owns composer settings, Direct Work settings, visible context, proposal cards, run details, and custom popup styles.
  - Terminal owns PTY settings, legacy fallback settings, terminal notice/status copy, and a custom settings popover.
  - Knowledge / Skills owns the current help/info popover and catalog panel headers.
- Shared logs exist at the frame level, but runtime-specific logs/details still exist inside widgets, especially Agent Executor, Agent Queue, Terminal, Workspace Agent, and Agent Activity. These are domain views, not replacements for widget-local logs.
- Settings are not shared. They appear as native `details`, custom popovers, inline panels, or widget-specific action areas depending on the widget.

## Safe Pilot Migrations

- Best first pilot: Knowledge / Skills info popover. It is small, local, non-runtime, already anchored in the `WidgetFrame` status slot, and currently duplicates popup behavior that `PopupShell` can supply.
- Second pilot: Terminal PTY settings popover shell only. It has real settings content, but the outer shell is isolated in `TerminalPtySettingsPopover`; migrate only the shell after the Knowledge / Skills info pilot.
- Third pilot: widget remove confirmation. It is shared chrome-adjacent and belongs near the shell, but it is destructive and uses `alertdialog`, so it should follow a simpler non-destructive popup pilot.
- Avoid using Agent Queue, Finder, Workspace Agent, or JDBC as the first pilot. Their surfaces are large, stateful, and already mix product-specific layout with runtime/status/detail behavior.

## Files Too Risky To Touch First

- `WorkbenchCanvas.tsx`: owns layout, resize, popout, ghost placeholders, z-order, focus, and cross-widget handoff state. A shell unification block should not start here.
- `WidgetHost.tsx`: central mapping and frame prop adapter. Touch only after a primitive has been proven in a leaf widget.
- `widgetRenderProps.ts`: broad shared contract with many widget capabilities. Changes amplify quickly across the widget surface.
- `widgetHostRenderProps.ts`: central capability wiring; useful for later cleanup, risky for first popup/shell primitive work.
- `AgentQueuePlaceholderWidget.tsx` and Queue detail/sidebar/run panels: high complexity and heavy settings/details usage.
- `FinderWidget.tsx`: large stateful widget with file preview/edit and Git plugin behavior.
- `InteractiveAgentPlaceholderWidget.tsx`, `WorkspaceAgentComposer.tsx`, and `WorkspaceAgentDirectModePanel.tsx`: foreground agent workflow, provider/direct-work state, settings, visible context, and custom run detail popups.
- `JdbcConnectorWidget.tsx`: large preview/runtime boundary surface with connector/profile/query/diagnostic state.
- Broad edits to `components.css`: many unrelated widget-specific selectors are co-located there.

## Minimal Primitive To Add First

Add a small shared `WidgetInfoPopover` wrapper around `PopupShell`.

Minimal shape:

- Trigger: icon/text button supplied by the caller or a default compact `i` button.
- Content: title plus plain children.
- Behavior: uses `PopupShell` anchored mode, Escape/outside close, focus return, and optional drag handle through the title.
- Scope: informational/help copy only; no settings forms, no destructive confirmations, no runtime logs, no command execution, no cross-widget reads.
- First migration target: replace the custom Knowledge / Skills `skill-library-info-popover` shell while preserving the same copy and visibility behavior.

This keeps the first addition below `WidgetHost` and `WorkbenchCanvas`, proves reuse on a low-risk widget, and avoids changing widget layout, registry, runtime, or persistence.

## Explicitly Avoid

- Do not rewrite `WidgetHost`, `WorkbenchCanvas`, or `WidgetRenderProps` as the first unification step.
- Do not migrate all widget settings/logs/help at once.
- Do not turn widget runtime detail views into shared logs.
- Do not add new widget behavior, new catalog entries, new runtime actions, new Tauri commands, or storage/schema changes.
- Do not make hidden settings, hidden context, or hidden execution paths.
- Do not replace domain-specific panels with generic shell primitives when the panel owns product behavior.
- Do not make `PopupShell` responsible for destructive confirmation policy before an `alertdialog` wrapper is explicitly designed.
- Do not use this audit as permission to implement Planned or Deferred widget shell behavior such as real external popout windows, Dock, view modes, snapping, auto-reflow, or persisted presence zones.

