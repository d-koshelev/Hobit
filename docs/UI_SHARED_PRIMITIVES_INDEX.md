# UI Shared Primitives Index

Status: docs-only component inventory.

## Purpose

This index documents the shared UI primitives agents should reuse before
building local widget-specific UI patterns.

It does not implement frontend UI, CSS, behavior, backend commands, Tauri
commands, storage/schema changes, widget behavior, tests, or new widgets.

Authoritative UI rules remain in `docs/UI_DESIGN_SYSTEM_CONTRACT.md`,
`docs/PRODUCT_UI_DESIGN_CONTRACT.md`,
`docs/PRODUCT_UI_VISUAL_CONTRACT.md`,
`docs/FRONTEND_STRUCTURE_CONTRACT.md`, and current widget/domain contracts.
This file is the reuse map for current frontend primitives and high-traffic
surfaces.

## Fallback Rule

Before adding UI, check `docs/FRONTEND_STRUCTURE_CONTRACT.md` for canonical
placement, then search for a shared primitive in
`apps/desktop/frontend/src/design-system/`,
`apps/desktop/frontend/src/workbench/widgetV2/`, and nearby high-traffic
widget implementations.

Implementation and import guidance:
- New shared UI primitives should be added under canonical category folders under
  `apps/desktop/frontend/src/design-system/` (for example `actions/`, `forms/`,
  `feedback/`, `layout/`, `overlays/`, `widget/`).
- New code should prefer importing shared UI from the canonical barrel
  `apps/desktop/frontend/src/design-system/index.ts`.
- Existing direct imports like `design-system/Button` and other root-level direct
  primitive imports remain supported for compatibility.

If a shared primitive exists, reuse it. Do not copy-paste local versions of
frames, popups, buttons, badges, status chips, empty states, action groups, row
actions, context pickers, tables, lists, cards, or confirmation flows.

If no shared primitive exists, the implementation block must do one of these:

- Add a deliberate shared primitive in the design-system or widget platform
  layer, with focused scope and tests where behavior is non-trivial.
- Document a follow-up when the current block is not allowed to add code or the
  primitive design is not ready.
- Use a tightly scoped local pattern only when the domain shape is unique,
  explain why it is not shared yet, and keep it aligned with theme tokens and
  spacing rules.

Local one-off CSS is allowed only when it is scoped to domain content, not when
it recreates shared chrome, popup, list, table, button, badge, status, or empty
state behavior.

## Current Shared Primitive Inventory

### Shell / Module / Widget Frame

Current primitives:

- `WidgetFrame` in `apps/desktop/frontend/src/design-system/WidgetFrame.tsx`
- `WidgetV2Shell`, `WidgetV2Header`, `WidgetV2Toolbar`, and panel slots in
  `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx`
- `WidgetV2Shell` uses title + `InfoTip` for short explanatory copy.
  `subtitle` is a compatibility path and is routed to `InfoTip` when `info` is not
  already supplied. Status chips are rendered only for current semantic state;
  avoid static labels such as `Experimental`, `Preview`, `MVP`, `Executor`, or
  `Current` as default header status.
- `Panel` in `apps/desktop/frontend/src/design-system/Panel.tsx`
- `WidgetHost` remains the registry/component mapping layer, not a visual
  primitive to bypass.

Purpose: provide one continuous widget surface with header/title, status,
actions, content, optional footer, widget-local logs where supported, and V2
layout slots for primary surface, rails, inspectors, and drawers.

Use when building or hardening widget/module chrome, V2 widget surfaces,
shared top-level widget composition, and surfaces that need consistent header,
status, actions, and content rhythm.

Do not use for small repeated row cards, inline controls, menu contents, or
domain-specific detail sections that already live inside an owning widget
shell. Do not hardcode widget components directly into Workbench canvas paths.

Required behavior conceptually: title, optional `info` explanatory text and
compact status, body content, optional footer, theme-token styling, accessible
labels,
and no detached header block. `WidgetFrame` also owns widget logs and optional
move start behavior. V2 shell owns display structure only; domain state and
actions stay with the owning widget/controller.

Known limitations and follow-ups: V1 and V2 shells coexist. `WidgetFrame` is
current shared chrome for many V1 surfaces; `WidgetV2Shell` is the newer V2
surface vocabulary. Future unification should avoid broad `WidgetHost` rewrites
unless explicitly planned.

### Bounded Draggable Popup Shell

Current primitives:

- `PopupShell` in `apps/desktop/frontend/src/design-system/PopupShell.tsx`
- `WidgetPopupShell` in
  `apps/desktop/frontend/src/design-system/WidgetPopupShell.tsx`
- `WidgetInfoPopover` for compact informational popovers

Purpose: bounded, closable, viewport-aware popups with anchored or floating
placement, Escape/outside close behavior, optional drag handle, and standard
header/body/footer layout.

Use for task details popups, item details, action review, context pickers,
confirmation-like review flows, compact settings, and informational popovers
that need to stay visually connected to the workbench.

Do not use for permanent sidebars, unbounded inspectors, raw debug dumps, or
behavior that would lose unsaved/risky state on Escape without explicit
handling. Do not create new modal shells for ordinary widget popups.

Required behavior conceptually: explicit `isOpen`, stable `id`, accessible
label/title id, visible close path, bounded body scroll, sticky footer for final
actions, safe focus return where applicable, and drag handles only on header
regions that ignore interactive children.

Known limitations and follow-ups: the current popup shell closes on Escape and
outside pointer by default. Flows with unsaved input, destructive choices, or
active operations need a deliberate guard or confirmation layer rather than raw
`PopupShell` defaults.

Current guidance (InfoTip migration):

- Use `Title + InfoTip` for short user-facing explanatory copy on titles,
  labels, controls, and empty states.
- `InfoTip` is the canonical short context primitive for persistent explanatory
  text in these places; avoid using subtitle text as the primary explanatory
  channel.
- Keep implementation/debug text out of `InfoTip`; route it to dedicated debug
  detail popups.

### Widget Debug Popup

Current primitive:

- `WidgetDebugPopup` in
  `apps/desktop/frontend/src/design-system/widget/WidgetDebugPopup.tsx`

Purpose: provide the shared widget-level shell for debug, runtime,
developer, internal, raw, and diagnostic information that should not occupy
the polished default widget surface.

Use for widget-owned developer details, raw payload previews, runtime bridge
diagnostics, internal action traces, troubleshooting metadata, bounded log/raw
views, and copyable diagnostic bundles. The popup should be opened from a
secondary or developer affordance, not from the primary workflow path.

Do not show debug details in the default widget surface. Do not put raw JSON,
stack traces, backend command names, internal IDs, bridge payloads, or
developer-only runtime fields in product overview rows, headers, empty states,
or primary action areas when `WidgetDebugPopup` can hold them instead.

Required behavior conceptually: title, open/close state, composable body,
optional footer, optional copy diagnostics action, consistent debug popup
chrome, scrollable body, and bounded popup behavior inherited from
`WidgetPopupShell`. The primitive must remain domain-agnostic and must not
know about Queue, Knowledge, Workspace Agent, Terminal, Finder, or any
widget-specific state.

### InfoTip

Current primitive:

- `InfoTip` in
  `apps/desktop/frontend/src/design-system/overlays/InfoTip.tsx`

Purpose: small, subtle, keyboard-reachable explanatory overlays for short
operator-facing guidance.

Use for:

- title/label/helper context that should stay concise and easy to scan;
- control hints, section helpers, and short empty-state guidance.

Do not use for:

- long technical payloads;
- implementation/debug text that requires explicit developer detail context.

### Tabs

Current primitives:

- `Tabs` in `apps/desktop/frontend/src/design-system/layout/Tabs.tsx`
- Local tab-like patterns still exist in several domains (Knowledge / Skills
  documents/skills, Direct Work detail sections, Queue detail sections, Git
  sections), but new shared work should start from the shared control first.

Purpose: switch between peer views inside one widget responsibility.

Use only when the active contract permits multiple peer views and the current
workflow benefits from stable labeled sections.

Do not use tabs to hide primary actions, hide failures, expose raw developer
details by default, or imply deferred multi-view behavior exists. Notes
Notebook tabs, Terminal tabs, Dock view modes, and multi-Workbench tabs remain
outside current behavior unless explicitly requested.

Required behavior conceptually: selected tab state, semantic labels, keyboard
and focus behavior when implemented as real tabs, no action execution on tab
change, and distinct empty/error states per tab.

Known limitations and follow-ups: domain-specific variations may still be needed
for deeply customized surfaces, but they should remain local to a product
surface and still follow `Tabs` accessibility patterns.

### Form Fields

Current primitives:

- `Field` in `apps/desktop/frontend/src/design-system/forms/Field.tsx`
- `Textarea` in `apps/desktop/frontend/src/design-system/forms/Textarea.tsx`
- `CheckboxField` in `apps/desktop/frontend/src/design-system/forms/CheckboxField.tsx`
- `SelectField` in `apps/desktop/frontend/src/design-system/forms/SelectField.tsx`

Purpose: standardize compact field composition with shared labels, helper text,
validation signaling, and control wiring.

### Layout Containers

Current primitives:

- `Section` in `apps/desktop/frontend/src/design-system/layout/Section.tsx`
- `SectionHeader` in `apps/desktop/frontend/src/design-system/layout/SectionHeader.tsx`
- `KeyValueList` in `apps/desktop/frontend/src/design-system/layout/KeyValueList.tsx`
- `MetaRow` in `apps/desktop/frontend/src/design-system/layout/MetaRow.tsx`

Purpose: keep shared content containers, headers, and key/value metadata rows
consistent and compact across widgets.

### Feedback

Current primitives:

- `Notice` in `apps/desktop/frontend/src/design-system/feedback/Notice.tsx`
- `InlineError` in
  `apps/desktop/frontend/src/design-system/feedback/InlineError.tsx`

Purpose: keep short status/error copy in a shared visual language with compact
padding and semantic tone.

### Topbar / Action Group

Current primitives:

- `Toolbar` in `apps/desktop/frontend/src/design-system/actions/Toolbar.tsx`
- `ToolbarGroup` in `apps/desktop/frontend/src/design-system/actions/ToolbarGroup.tsx`
- `WidgetV2Toolbar` in `WidgetV2Shell.tsx`
- `Button`, `Input`, and `Select` in `apps/desktop/frontend/src/design-system/`
- Local topbars such as `WorkbenchTopBar`, `QueueV2TopBar`,
  `WorkspaceAgentV2TopBar`, `KnowledgeV2Header`, `KnowledgeV2Filters`,
  `NotesToolbar`, and Terminal settings/action clusters.

Purpose: group the primary command, secondary controls, filters, refresh, view,
and mode controls into a compact, readable operator control row.

Use for widget header actions, command bars, filter rows, and grouped controls
where the operator must scan available actions quickly.

Do not use for repeated row-level action clusters when a row action menu would
be clearer. Do not mix search/filter controls into row action menus. Do not
spread many always-visible buttons across every list row.

Required behavior conceptually: one visible primary action when the workflow
has one, quieter secondary actions, disabled reasons where needed, no touching
controls, no hidden execution on render/selection, and theme-token button/input
classes.

Known limitations and follow-ups: reuse `Toolbar` + `ToolbarGroup` before
introducing another local action row primitive.

### Table / List / Card Components

Current primitives:

- No generic shared table, list, or card component is established.
- Reusable CSS classes and patterns exist through `components.css`,
  `workbench-shell.css`, V2 shell classes, `EmptyState`, `Badge`, `StatusDot`,
  and domain implementations such as `KnowledgeV2CatalogList`,
  `QueueV2TaskCard`, `AgentActivityPanel`, `NotesList`,
  `AgentExecutorRunHistoryList`, `JdbcQueryResultTable`, `GitChangesPanel`,
  and Finder columns.

Purpose: present dense, readable records with clear selection/details paths and
bounded metadata.

Use existing domain patterns as references when building similar surfaces:
catalog/table rows for Knowledge-like records, board cards for Queue tasks,
timeline rows for activity, editor/list split for Notes, result tables for
JDBC, and column navigation for Finder.

Do not create decorative cards as page sections, nest cards inside cards,
trigger mutation on row click, or put many inline buttons on every row.

Required behavior conceptually: readable row height, stable selection/details
behavior, compact metadata, row action menu when multiple actions exist, empty,
loading, filtered-empty, partial, unavailable, and error states.

Known limitations and follow-ups: a shared dense list/table/card primitive is a
valid future extraction target. Until then, agents should reuse the closest
current pattern and document any deliberate local deviation.

### Badge / Status / Chip Patterns

Current primitives:

- `Badge` in `apps/desktop/frontend/src/design-system/Badge.tsx`
- `StatusDot` in `apps/desktop/frontend/src/design-system/StatusDot.tsx`
- Local status/chip components including `AgentQueueWidgetStatusBadge`,
  `KnowledgeV2StatusBadge`, `KnowledgeV2PreviewStatus`, and Queue/Agent
  status label helpers.

Purpose: provide compact semantic status, lifecycle, warning, scope, and
availability signals.

Use for record status, lifecycle state, review state, availability, warnings,
scope labels, selected/default markers, and compact run/activity status.

Do not use badges as primary content, decorative color accents, or replacements
for required warning/detail text. Do not invent widget-local color vocabularies.

Required behavior conceptually: semantic tone, short label, optional
discoverable detail/title, theme-token styling, and alignment that does not
increase row height unnecessarily.

Known limitations and follow-ups: local chip classes still exist in several
widgets. Future work should converge status labels and chip classes where the
same semantics recur across Queue, Knowledge, Agent, and Activity surfaces.

### Action Menu / Menu Button

Current primitives:

- No generic shared action menu/menu button primitive is established.
- Local row action patterns exist in QueueV2 task cards, KnowledgeV2 item
  actions, Finder/Git action areas, and several Direct Work/Workspace Agent
  cards.

Purpose: expose secondary or item-specific actions without crowding dense
lists, tables, cards, and boards.

Use when an item has multiple secondary actions, when row width is constrained,
or when actions need disabled/unavailable reasons.

Do not hide the primary workflow action inside a menu. Do not put destructive
or external-effect actions in a menu without confirmation. Do not use menus to
advertise deferred behavior.

Required behavior conceptually: stable trigger label/icon, accessible menu
name, item labels in operator language, disabled reasons, confirmation for
destructive/external actions, close-on-select behavior, and no execution on
hover/focus.

Known limitations and follow-ups: a shared `ActionMenu` / `MenuButton`
primitive is needed before further row-action expansion. New local menu
implementations should be treated as temporary and documented.

### Confirmation Dialog

Current primitives:

- No generic shared confirmation dialog primitive is established.
- Local confirmation flows exist for widget removal, Queue task delete/stop
  flows, Terminal kill/close-like controls, Git local commit confirmation, and
  popup footer approval/review flows.
- `WidgetPopupShell` is the preferred shell foundation for future shared
  confirmations.

Purpose: require explicit operator confirmation before destructive,
irreversible, external, or high-risk mutation.

Use before delete, stop, kill, discard, reset, clean, push, publish, commit, or
other irreversible/external effects.

Do not use confirmations for ordinary selection, details opening, copying, or
non-mutating review. Do not silently downgrade a destructive action to a local
`window.confirm` pattern when a product popup is needed.

Required behavior conceptually: clear title, affected object identity, risk
statement, primary destructive/confirm action, cancel action, disabled/pending
state, and no mutation until the explicit confirm action.

Known limitations and follow-ups: a shared confirmation primitive should be
extracted over `WidgetPopupShell` when another confirmation flow is changed.
Existing local confirmations should migrate opportunistically.

### Empty / Unavailable State

Current primitives:

- `EmptyState` in `apps/desktop/frontend/src/design-system/EmptyState.tsx`
- Local states such as `AgentQueueEmptySelection`, `NotesEmptyState`,
  executor log empty states, KnowledgeV2 unavailable/partial warnings, Finder
  unsupported listing states, Terminal browser unsupported state, and JDBC
  not-configured/unsupported states.

Purpose: provide compact, honest explanations for empty, filtered-empty,
loading, partial, unavailable, unsupported, blocked, failed, and warning states.

Use whenever the primary content area has no usable content or the runtime/API
is unavailable.

Do not use raw exceptions, stack traces, fake sample data, or future-looking
buttons as normal empty states. Do not hide failures only in logs or developer
details.

Required behavior conceptually: short title, short explanation, optional safe
next action when implemented, visible unsupported/unavailable reason, and no
overclaiming.

Known limitations and follow-ups: `EmptyState` is intentionally small. Complex
partial/unavailable states may need a shared extension that supports tone,
action, and details while preserving compact layout.

### Context Picker

Current primitives:

- `KnowledgeV2ContextPicker` in
  `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2ContextPicker.tsx`
  is the current concrete context-picker pattern.
- Workspace Agent visible context panels and Queue task context sections are
  related target/review surfaces, not a generic picker.

Purpose: require explicit target selection and visible review before context is
attached to Workspace Agent, Queue task, copy-reference, or future targets.

Use when more than one possible target can receive context or when selected
context needs eligibility, warnings, estimates, or disabled reasons.

Do not attach context silently, default to a hidden/global target, send/run
after attach, create Queue work, mutate Git, query databases, launch Terminal,
or treat selected context as approval.

Required behavior conceptually: selectable source items, explicit target,
disabled reasons, warnings, size/token estimate when relevant, visible attach
result path, cancel action, and bounded popup layout.

Known limitations and follow-ups: the current picker is KnowledgeV2-specific.
A shared context-picker primitive should be extracted only after at least one
additional surface needs the same target-selection behavior.

## High-Traffic Surface Reuse Map

### Workspace Agent

Reuse:

- `WidgetFrame` / current compatibility frame for V1 widget chrome.
- `WidgetV2Shell`, `WidgetV2Toolbar`, and V2 result/card patterns for
  experimental Workspace Agent V2 work.
- `WidgetPopupShell` for composer popups, details, visible context review, and
  result/review popups.
- `Button`, `Input`, `Select`, `Badge`, `StatusDot`, `EmptyState`, and
  `WidgetInfoPopover`.
- Existing Workspace Agent card patterns for proposals, Queue draft/result
  cards, message bubbles, visible context panels, and run status panels.

Avoid:

- Hidden context controls, automatic Queue creation, provider/tool execution
  affordances, raw debug-first panels, and new local popup/menu/button systems.

Follow-ups:

- Consolidate repeated proposal/result card action layouts into shared card or
  action-group primitives when another Workspace Agent card is changed.

### QueueV2

Reuse:

- `WidgetV2Shell`, `WidgetV2Toolbar`, `WidgetV2PanelLayout`, `WidgetV2LeftRail`,
  `WidgetV2BottomDrawer`, and `WidgetPopupShell`.
- QueueV2 board/card/details popup patterns for board-first task operations.
- `Badge` / status helpers for task lifecycle, worker, dependency, review, and
  run status.
- Shared buttons/inputs/selects for topbar and details actions.

Avoid:

- Reintroducing old dense V1 visual structure, hidden Autorun/scheduler
  controls, permanent debug rails, local modal shells, and row mutations on
  selection.

Follow-ups:

- Extract a shared row/card action menu before adding more QueueV2 per-card
  actions.

### KnowledgeV2

Reuse:

- `WidgetV2Shell`, `WidgetV2Toolbar`, `WidgetPopupShell`, `Button`, `Badge`,
  `EmptyState`, and existing KnowledgeV2 catalog/list/status/action/popup
  patterns.
- `KnowledgeV2ContextPicker` as the current concrete target-picker model for
  explicit context attachment.

Avoid:

- Permanent right preview as the default product surface unless explicitly
  requested, hidden Knowledge injection, local chip color forks, and new
  context attach behavior that bypasses the picker rules.

Follow-ups:

- Consider extracting generic catalog list, status chip, action menu, and
  context picker primitives only after another surface needs the same behavior.

### Widget Catalog

Reuse:

- Existing `WidgetCatalogShell` structure, `Button`, `Badge`, `EmptyState`,
  and shared popup/drawer rules if catalog presentation changes.
- Current product-facing widget inventory from `docs/CURRENT_WIDGET_SURFACE.md`.

Avoid:

- Adding catalog entries for deferred/compatibility surfaces unless explicitly
  scoped, local card-heavy redesigns, or buttons that imply unimplemented
  insertion behavior.

Follow-ups:

- If catalog item rows/cards are redesigned, create or document a reusable
  catalog/list item pattern rather than a catalog-only visual fork.

### Notes

Reuse:

- `WidgetFrame`, `Button`, `Input`, `EmptyState`, and existing Notes toolbar,
  list, status, and editor patterns.
- Shared popup shell if future Notes actions need confirmation or details.

Avoid:

- Notebook tabs, Markdown rendering, formatting tools, autosave controls,
  hidden AI-in-Notes affordances, and local confirmation/dialog patterns for
  future destructive flows.

Follow-ups:

- If Notes adds delete/archive or richer unavailable states, use a shared
  confirmation and extended empty/unavailable primitive rather than local
  one-offs.

### Finder

Reuse:

- Existing Finder column/list/preview patterns for explicit root navigation.
- `WidgetFrame`, `Button`, `Badge`/status chips, `WidgetPopupShell` for
  floating preview or future bounded details, and confirmation patterns for
  any future risky Git/file action.

Avoid:

- Hidden workspace scanning, Terminal launch controls, broad IDE panels,
  unbounded file previews, or local Git mutation controls outside current
  Finder Git rules.

Follow-ups:

- Finder's column navigation is domain-specific; do not force it into a generic
  list primitive until another surface genuinely needs column navigation.

### Terminal

Reuse:

- `WidgetFrame`, shared buttons/inputs/selects, existing Terminal PTY session
  panels, `WidgetPopupShell`/`WidgetInfoPopover` for settings and compact
  runtime information, and honest unavailable states for browser or unsupported
  platform paths.

Avoid:

- Terminal tabs, split panes, persistent transcripts/history controls, Script
  Runner-like action prompts, Agent/Queue-triggered execution affordances, and
  raw local popup implementations.

Follow-ups:

- Terminal output/editor surfaces are specialized. Shared primitives should own
  surrounding chrome and states, not xterm rendering internals.

## Agent Checklist

Before adding or changing UI:

- Search for existing primitives in `apps/desktop/frontend/src/design-system/`
  and `apps/desktop/frontend/src/workbench/widgetV2/`.
- Search nearby high-traffic surfaces for an established pattern before adding
  local CSS or markup.
- Reuse shared tokens, theme variables, button/input/select classes, badge and
  status classes, popup shell layout, widget shell structure, and empty-state
  patterns.
- Confirm row click, tab change, selection, hover, popup open, or render does
  not execute, mutate, persist, attach context, dispatch, or delete.
- Use `WidgetPopupShell` for bounded popup/detail/review flows unless a task
  explicitly requires another shell.
- Use explicit disabled reasons, unavailable states, or omit unavailable future
  controls; do not advertise deferred behavior.
- Avoid local one-off CSS unless it is domain-content-specific, scoped, and
  justified in the implementation report or follow-up docs.
- If a missing primitive blocks clean reuse, add a deliberate shared primitive
  in a focused implementation block or document the follow-up here.
