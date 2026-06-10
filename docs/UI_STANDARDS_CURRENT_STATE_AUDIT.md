# UI Standards Current State Audit

## Purpose

This docs-only audit records the current Hobit UI consistency state and the
reusable frontend primitives that should become mandatory for future agent work.

It does not implement frontend UI, backend behavior, Tauri commands, storage,
schema changes, tests, or runtime behavior.

## Scope Inspected

Default contracts inspected:

- `AGENTS.md`
- `docs/ACTIVE_CONTRACT_INDEX.md`
- `docs/CURRENT_WIDGET_SURFACE.md`
- `docs/CODE_ORGANIZATION.md`
- `docs/ARCHITECTURE.md`

UI contracts inspected:

- `docs/DESIGN_SYSTEM_CONTRACT.md`
- `docs/PRODUCT_UI_DESIGN_CONTRACT.md`
- `docs/PRODUCT_UI_VISUAL_CONTRACT.md`

Frontend structure sampled:

- `apps/desktop/frontend/src/design-system/`
- `apps/desktop/frontend/src/styles/`
- `apps/desktop/frontend/src/workbench/`
- `apps/desktop/frontend/src/workbench/widgetV2/`

High-traffic surfaces sampled:

- Workspace Agent / `InteractiveAgentPlaceholderWidget`
- `WorkspaceAgentV2`
- Agent Queue / `QueueV2`
- `KnowledgeV2`
- Widget Catalog
- Notes
- Finder
- Terminal

## Current Shared UI Foundation

Hobit already has useful shared primitives. The main problem is not absence of
all primitives; it is uneven adoption and incomplete contracts for when agents
must use them.

Existing shared primitives that should become mandatory:

- `WidgetFrame` in `apps/desktop/frontend/src/design-system/WidgetFrame.tsx`
  owns the V1 widget shell, header, actions zone, body scroll, logs popover,
  move handling, and optional footer.
- `WidgetV2Shell` and slot primitives in
  `apps/desktop/frontend/src/workbench/widgetV2/WidgetV2Shell.tsx` own the V2
  shell, header, toolbar, primary surface, left rail, right inspector, and
  bottom drawer.
- `PopupShell` and `WidgetPopupShell` in
  `apps/desktop/frontend/src/design-system/PopupShell.tsx` and
  `apps/desktop/frontend/src/design-system/WidgetPopupShell.tsx` own bounded,
  focusable, closeable, scrollable, draggable overlay structure.
- `Button`, `Badge`, `StatusDot`, `Input`, `Select`, `Panel`, and `EmptyState`
  in `apps/desktop/frontend/src/design-system/` provide base controls and
  status/empty-state vocabulary.
- `components.css`, `widget-frame.css`, `widget-v2.css`, `tokens.css`, and
  `hobit-theme.css` provide shared tokens, component styles, widget frame
  styles, popup styles, status chips, scroll behavior, and theme variables.
- `renderMemoryGuards.ts` provides capping helpers for long raw text previews.

These primitives already address several recurring regressions:

- widget body padding and internal scrolling;
- widget-local logs and header action placement;
- popup max-height, viewport clamping, focus, Escape close, outside click close,
  and body/footer layout;
- shared button and badge variants;
- empty states with title plus short supporting text;
- bounded raw text previews.

## Consistency Gaps

### Shared Tokens

The token base exists, but enforcement is mostly social. Component and widget
CSS generally uses `var(--color-*)`, `var(--space-*)`, and `var(--text-*)`, but
large local stylesheets still define many one-off class families and special
layout rules per widget.

Gap:

- There is no single current UI standards contract that says which primitive is
  mandatory for a table row, action menu, popup, details panel, warning, empty
  state, or form.
- Agents can still create a local button, chip, panel, popup, details area, or
  status label when a shared primitive already exists.
- Some V2 CSS uses shared tokens but still creates local chips, local menus, and
  local facts grids instead of shared semantic primitives.

### Widget / Module Shell

`WidgetFrame` and `WidgetV2Shell` are the strongest shared primitives.
Workspace Agent, Notes, Finder, and Terminal use `WidgetFrame`. KnowledgeV2,
QueueV2, and WorkspaceAgentV2 use `WidgetV2Shell`.

Gap:

- V1 and V2 shells are both valid today, but their header/status/action
  contracts differ.
- `WidgetV2Shell` status supports `ready`, `working`, `warning`, `error`, and
  `neutral` tones, while `Badge` uses `neutral`, `info`, `success`, `warning`,
  and `error`.
- Widget headers can become crowded because frame actions, status controls,
  info controls, and local widget controls are not governed by one placement
  rule.

High-traffic examples:

- `InteractiveAgentPlaceholderWidget` places Workspace Agent status and prompt
  example controls in the `WidgetFrame` status area through
  `WorkspaceAgentHeaderStatus`.
- `WorkspaceAgentV2Widget` uses V2 toolbar, bottom drawer, transcript, and right
  inspector, but its subtitle still carries implementation-stage explanation.
- `QueueV2Widget` uses V2 slots, but it keeps a left rail plus bottom drawer
  that can squeeze the board in narrow widget sizes.
- `KnowledgeV2Widget` uses V2 shell and popup flows, but status text such as
  `Data sources: partial` is more implementation-facing than the common
  semantic status set.

### Popup Shell

`PopupShell` and `WidgetPopupShell` are good reusable foundations. KnowledgeV2
uses the standard popup layout for details, action, context picker, and delete
flows. QueueV2 uses `WidgetPopupShell`, but its task details popup passes raw
children and builds a custom internal header/body/tab layout.

Gap:

- Standard `WidgetPopupShell` header/body/footer is optional, so agents can
  bypass the common title, actions, scroll body, and sticky footer structure.
- Local anchored menus, confirmation popups, and action menus still exist
  outside `PopupShell`.
- Popup body max-height is sometimes defined locally, producing inconsistent
  scroll thresholds and resize behavior.

High-traffic examples:

- KnowledgeV2 details and context picker use bounded popup bodies and footer
  classes.
- QueueV2 task details uses a floating popup but recreates header, actions,
  tabs, and body internally.
- `WidgetFrame` remove confirmation and several local action confirmations use
  local absolute-positioned popup styles rather than `PopupShell`.

### Topbars And Toolbars

`WidgetV2Toolbar` exists and is used by WorkspaceAgentV2 and QueueV2.
KnowledgeV2 uses a local action/header pattern through `KnowledgeV2Actions`.
Workbench top-bar styles are separate under `workbench-shell.css`.

Gap:

- No shared command-bar primitive exists for filters, counts, mode toggles,
  primary actions, secondary actions, and overflow.
- Local topbars choose their own spacing, status placement, overflow behavior,
  and copy density.
- Repeated explanatory subtitles and safety copy appear in primary chrome where
  a compact status plus info popover would be better.

High-traffic examples:

- QueueV2 top bar mixes global state, counts, capacity, and placeholder
  controls.
- KnowledgeV2 has a dense filter toolbar and separate local actions cluster.
- WorkspaceAgentV2 top bar controls activity visibility and mode/provider
  context, but status copy lives in the shell subtitle and preflight blocks.

### Tables, Lists, And Cards

There is no shared `Table`, `ListRow`, `CardRow`, `FactGrid`, or `RowActions`
primitive. Mature widgets implement their own.

Gap:

- KnowledgeV2 dense list uses `role="table"` with local row, tag, status, and
  action-menu classes.
- QueueV2 board cards, lanes, worker lists, and activity rows are local.
- Finder uses local column/list rows, Git rows, commit rows, and preview facts.
- Notes uses local list/editor primitives.
- Row density, min widths, hidden columns, action placement, selected state, and
  disabled-action reasons vary per widget.

This is the main source of repeated row-action regressions: each agent can
invent a new tiny button, text action, local menu, or disabled reason layout.

### Action Menus

Action menus are not shared. KnowledgeV2 row actions use a local absolute
`role="menu"` span. Other widgets use local buttons, details sections, or
inline confirmations.

Gap:

- No mandatory overflow menu primitive exists for row actions.
- Menus can overflow their scroll container or viewport because they are not
  always portaled through `PopupShell`.
- Disabled actions sometimes expose long technical reasons inside rows or menus,
  increasing row height and clutter.
- Action labels vary between product language and implementation language.

### Badges And Status Chips

`Badge`, `StatusDot`, and `WidgetV2` status exist, but local badge/chip systems
also exist.

Gap:

- KnowledgeV2 has local `knowledge-v2-chip`, `knowledge-v2-type-badge`, and
  `KnowledgeV2StatusBadge`.
- QueueV2 uses local card action chips, lane tones, worker/tag swatches, and
  board-lane tones.
- Finder and Git use `Badge` in many places, but also have local status text,
  Git kind labels, and preview/error styles.
- Status vocabulary is not fully normalized. Examples include `Current`,
  `Experimental`, `Data sources: ready`, `Data sources: partial`,
  `not_started`, and raw Queue lifecycle strings.

### Empty, Unavailable, Partial, Loading, And Error States

`EmptyState` exists but is not universal. Local empty/error/unavailable states
are common.

Gap:

- KnowledgeV2 uses local `knowledge-v2-empty`, bridge notices, and action
  availability copy.
- QueueV2 uses local lane empty states, no-worker states, no-report states, and
  detail tab empty messages.
- Notes uses `NotesEmptyState`, separate from shared `EmptyState`.
- Finder uses local `finder-column-state`, `finder-empty`, and preview error
  patterns.
- Terminal uses local notices and fallback states.

The states are often honest, but the visual language and copy density vary.
The common missing rule is: primary empty state should be short, with technical
cause and bridge details behind info/developer details.

### Forms And Filters

`Input` and `Select` exist, but many widget forms use raw `input`, `select`,
and `textarea` with local classes.

Gap:

- KnowledgeV2 filters use local field wrappers and raw controls.
- Finder commit/push forms use mixed `Button`, `Badge`, raw inputs, local
  labels, and local validation text.
- Terminal and Direct Work settings use local panels and local field classes.
- Notes editor uses local editor controls.

There is no shared form field primitive for label, help text, error, disabled
reason, and compact layout.

### Details Panels And Details Popups

Details surfaces have improved, but remain inconsistent.

Gap:

- QueueV2 task details includes an explicit Developer tab, which is good, but
  some values still expose raw status strings such as `not_started` and raw IDs
  inside the same popup structure.
- KnowledgeV2 details popup has stronger product tabs and bounded raw/source
  sections, but still carries experimental bridge language in some primary
  status/info surfaces.
- Finder details and Git details are product-meaningful but rely on local fact
  grids and local warning lists.
- Workspace Agent message details hide provider metadata behind `details`, but
  this is local rather than a shared `DeveloperDetails` primitive.

## Existing Primitives To Make Mandatory

Future UI work should treat these as mandatory unless a task explicitly creates
or extends the primitive itself:

- Widget surfaces must use `WidgetFrame` or `WidgetV2Shell`; no direct widget
  body mounted without a shared shell.
- Widget V2 layouts must use `WidgetV2Toolbar`, `WidgetV2PanelLayout`,
  `WidgetV2LeftRail`, `WidgetV2RightInspector`, and `WidgetV2BottomDrawer`
  when those zones are needed.
- Popups, dialogs, anchored overlays, and floating details must use
  `WidgetPopupShell` / `PopupShell`, including standard header/body/footer
  whenever the popup has title, actions, scrollable content, or confirmation.
- Normal buttons must use `Button`; local raw button styling should be limited
  to a documented primitive gap such as table-row button or icon-only button.
- Product status must use `Badge`, `StatusDot`, or `WidgetV2Shell` status until
  a shared `StatusChip` unifies the variants.
- Empty, unavailable, loading, and no-results states must use `EmptyState` or a
  future shared `StateBlock`; local empty-state styles should be retired.
- Long raw output must use existing capping helpers and be placed behind
  details, tabs, or scrollable output surfaces.
- Widget-local logs must stay behind `WidgetFrame` logs unless the widget
  explicitly owns logs as its product object.

## One-Off Patterns To Forbid Or Discourage

Forbid in future production UI blocks:

- Raw JSON, stack traces, backend command names, internal IDs, raw payloads, or
  implementation enum values in primary UI.
- New popups or action menus that are not based on `PopupShell` /
  `WidgetPopupShell`.
- Absolute-positioned row menus inside scrollable rows when a popup shell can
  be used.
- Unbounded popup bodies, unbounded raw output, or fixed details panels that
  cannot scroll inside the widget/popup.
- New local color values outside theme/token files.
- New widget-specific button, badge, chip, empty-state, or popup visual systems
  when a shared primitive exists.
- Right inspectors or sidebars that are permanently visible when they squeeze
  the primary task surface below usability.
- Repeated safety paragraphs in primary chrome when a compact status, warning
  chip, info popover, or details section would preserve the boundary.
- Details panels that default to raw/debug data instead of product summary.

Discourage unless explicitly justified:

- Widget subtitles that explain implementation state instead of operator task
  context.
- Local facts grids, warning panels, and action footers that duplicate patterns
  in another widget.
- Long disabled-action reasons inline in row actions.
- Text-only action buttons for compact row actions where a shared icon/action
  primitive should exist later.
- Multiple local variants of `partial`, `unsupported`, `not configured`, and
  `unavailable` copy.
- Permanent right-side inspectors for catalog/list workflows; prefer explicit
  details popups or collapsible inspectors unless the inspector is central to
  the current task.

## High-Traffic Surface Notes

### Workspace Agent / WorkspaceAgentV2

Current strengths:

- V1 Workspace Agent uses `WidgetFrame`.
- V2 Workspace Agent uses `WidgetV2Shell`, toolbar, transcript primary surface,
  right inspector, and bottom composer drawer.
- Activity details and provider/run metadata are mostly separated from primary
  transcript flow.

Gaps:

- V1 status and prompt example controls are custom and can crowd the frame
  header.
- V2 uses extensive preflight and warning copy in the composer area; this is
  useful but should be governed by a shared preflight/approval primitive.
- `Experimental`, `Unsupported`, and direct-run capability language should map
  to a shared semantic status vocabulary.

### QueueV2

Current strengths:

- QueueV2 uses V2 shell slots.
- Task details are popup-based, not a permanent right rail.
- Developer details are separated in a dedicated tab and raw details are
  collapsed.

Gaps:

- Board lanes require wide minimum width, which can push horizontal scrolling
  and crowd smaller widgets.
- Task details popup recreates its own header/action/tabs/body instead of using
  the standard `WidgetPopupShell` layout.
- Some details still expose raw lifecycle/status strings.
- Board cards, lanes, chips, facts, tabs, and action rows are all local.

### KnowledgeV2

Current strengths:

- Uses `WidgetV2Shell`.
- Uses popup-only item details and context flows.
- Details, context, delete, and action popups are bounded and scrollable.
- Dense list is more product-oriented than the previous permanent preview rail.

Gaps:

- Local table/list/row action/menu/chip system is extensive.
- Row action menu is not portaled through `PopupShell`.
- Bridge and partial-state language is still visible in product chrome.
- Some local action availability messages are long enough to dominate popups or
  row menus.

### Widget Catalog

Current strengths:

- Widget Catalog is a drawer, not a new Workbench product screen.
- Catalog CSS provides grouped cards, unavailable reasons, and compact actions.
- It respects current product-facing widget inventory.

Gaps:

- Catalog card, group, unavailable, and capability styles are local rather than
  shared list/card primitives.
- Catalog width and canvas squeeze behavior are handled in shell CSS rather
  than through a reusable drawer/split primitive.
- Future catalog cards need stricter copy rules so unavailable/future behavior
  does not become noisy disabled UI.

### Notes

Current strengths:

- Uses `WidgetFrame`.
- Has dedicated list, toolbar, editor, status, and empty-state components.
- Keeps save/pin/create explicit.

Gaps:

- Notes has local `NotesEmptyState`, toolbar, pane rail, editor, status message,
  and promotion UI rather than shared state/form/detail primitives.
- Collapse/expand list rail uses local text symbols and local styling.
- Promotion-to-Knowledge actions should eventually use shared confirmation /
  action popup primitives.

### Finder

Current strengths:

- Uses `WidgetFrame`, `Button`, and `Badge`.
- Explicit root and Git review/commit/push actions are product-facing and
  approval-aware.
- Preview and Git details are bounded and mostly operator-facing.

Gaps:

- Finder is a large local component with local columns, preview panes, facts,
  errors, Git commit forms, history rows, and confirmations.
- Manual commit and push confirmations use local panels rather than a shared
  confirmation/action primitive.
- Finder Git review has several local status/error styles that should converge
  with shared state and badge primitives.

### Terminal

Current strengths:

- Uses `WidgetFrame` and `Badge`.
- Terminal output is correctly treated as the product object.
- PTY-first UI and fallback behavior are visually separated.

Gaps:

- Terminal has extensive local command/result/notice styles in shared
  `components.css` plus `terminal.css`.
- Stop/Kill/Close, fallback advanced settings, and unsupported states should
  use a shared action-risk and state-block contract.
- Terminal-specific output surfaces are appropriate, but surrounding forms and
  notices should share form/state primitives.

## Recommended Next Docs / Contracts

Create these follow-up docs before broad UI hardening:

1. `docs/UI_STANDARDS_CONTRACT.md`
   - Mandatory current UI standards for agents.
   - Maps surfaces to required primitives.
   - Defines primary/secondary/developer placement rules in implementation
     terms.

2. `docs/UI_PRIMITIVES_CONTRACT.md`
   - Canonical primitive inventory and allowed use cases.
   - Defines gaps for future primitives such as `StateBlock`, `ActionMenu`,
     `DataList`, `FactGrid`, `FormField`, `DetailsPanel`, and
     `ConfirmationPopup`.

3. `docs/UI_COPY_AND_STATE_LANGUAGE_CONTRACT.md`
   - Shared semantic state labels.
   - Rules for partial/unavailable/unsupported/not-configured/error copy.
   - Rules for moving verbose safety and bridge details out of primary UI.

4. `docs/UI_ACTION_PLACEMENT_CONTRACT.md`
   - Header actions, row actions, popup footers, destructive actions,
     confirmations, disabled reasons, and overflow menu behavior.

5. `docs/UI_DETAILS_AND_DEBUG_CONTRACT.md`
   - Product details versus developer details.
   - Raw output capping, disclosure labels, internal ID placement, and
     default-collapsed debug rules.

6. `docs/UI_LAYOUT_RESPONSIVENESS_CONTRACT.md`
   - Popup sizing, scroll behavior, side rail use, right inspector rules,
     small-widget behavior, and no-content-squeeze thresholds.

## Recommended Primitive Backlog

Implementation should remain separate from this audit. The likely primitive
backlog is:

- `StateBlock`: shared empty/loading/error/unavailable/partial/unsupported
  component.
- `ActionMenu`: popup-shell-backed row and toolbar overflow menu.
- `DataList` / `DataTable`: compact rows, selected state, hidden columns,
  row actions, no-results state, and small-widget behavior.
- `StatusChip`: unifies `Badge`, `WidgetV2StatusSummary`, and local V2 chips.
- `FormField`: label, help text, error, disabled reason, and compact field
  layout.
- `FactGrid`: bounded facts with consistent labels, values, wrapping, and
  monospace handling.
- `DetailsPanel`: product details with optional developer disclosure.
- `ConfirmationPopup`: mutation confirmation with risk badge, summary,
  affected objects, and explicit cancel/confirm footer.
- `PreflightPanel`: shared Workspace Agent / Queue / Executor readiness and
  approval summary.

## Acceptance Standard For Future UI Blocks

Future agent-created UI should be rejected or revised when:

- it bypasses existing shared primitives without naming a missing primitive;
- it creates a local popup/menu/confirmation instead of using
  `WidgetPopupShell`;
- it puts raw/debug details in primary UI;
- it adds row actions that do not fit, wrap, or explain disabled state cleanly;
- it adds permanent sidebars that reduce the primary surface below usability;
- it repeats verbose safety copy in primary chrome instead of compact status
  plus details;
- it introduces one-off chips, badges, action rows, forms, or empty states;
- it fails to keep popup and details content bounded and scrollable.

## Intentionally Not Implemented

This audit intentionally does not:

- change frontend code;
- change CSS;
- add or modify React components;
- add tests;
- change widget behavior;
- change backend, Rust, Tauri, storage, or schema code;
- update the active contract index;
- commit changes.
