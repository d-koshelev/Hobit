# KnowledgeV2 Popup-Only Layout Audit

## Purpose

This docs-only audit records the current KnowledgeV2 layout, selection, popup,
context, and action wiring before a popup-only layout transition.

It does not add frontend behavior, backend/Rust/Tauri/storage/schema changes,
new execution behavior, hidden context injection, automatic import/create/
attach/run behavior, Queue/Workspace Agent auto-run behavior, or a route back
to the legacy Knowledge / Skills surface.

## Decision

KnowledgeV2 should not use a permanent right preview/sidebar by default.
The catalog/list is the primary surface. Item details and secondary flows
should open in bounded draggable popups.

KnowledgeV2 remains the normal Knowledge / Skills surface through the retained
`skill-library` identity. Legacy Knowledge / Skills panels remain compatibility
implementation for existing create/import/draft/skills flows where explicitly
opened, not the normal route.

## Current Layout And Data Flow

### Current Route

- `KnowledgeSkillsV2Widget` renders `KnowledgeV2Widget` inside the normal
  `WidgetFrame`.
- The wrapper keeps `skill-library` compatibility identity through the normal
  widget render path and passes existing Knowledge / Skills action callbacks
  into KnowledgeV2.
- New, Import, Draft Review, and Manage Skills callbacks currently set a local
  `legacyFlow` state and render `SkillLibraryDocumentsPanel` below KnowledgeV2
  as a compatibility flow.

### Data Bridge

- `KnowledgeV2Widget` builds a frontend-only data bridge from either supplied
  `documents`/`skills`/`draftReviews` props or list callbacks:
  `onListKnowledgeDocuments`, `onListSkills`, and
  `onListKnowledgeDraftReviews`.
- The bridge records ready/partial/unavailable/loading state and exposes
  missing bridge reasons for visible status and popup availability.
- Catalog data is normalized by `buildKnowledgeV2CatalogViewModel` in
  `knowledgeV2CatalogModel.ts`.
- No KnowledgeV2 data path creates, imports, deletes, archives, attaches, runs,
  or sends without a separate explicit action.

### Permanent Right Preview

Current permanent right preview/sidebar components:

- `KnowledgeV2CatalogBrowser` renders `.knowledge-v2-browser`.
- `.knowledge-v2-browser` uses two columns:
  `minmax(0, 1fr) minmax(320px, 38%)`.
- The left column is `KnowledgeV2CatalogList`.
- The right column is `WidgetV2RightInspector`.
- `WidgetV2RightInspector` wraps `KnowledgeV2PreviewPanel`.
- `KnowledgeV2PreviewPanel` owns tabs for Overview, Details, Versions, and
  Usage, plus embedded Use as Context controls.

This makes the right inspector a permanent layout consumer, not an on-demand
details surface. At ordinary widget widths it takes at least 320px and up to
38% of the content area, which squeezes the catalog columns and row actions.

## Selection And Details Behavior

Current item selection behavior:

- `KnowledgeV2CatalogBrowser` stores `selectedItemId`.
- Clicking a row title or row preview button calls `selectItem(item.id)`.
- Selection clears the context action notice and updates `selectedItemId`.
- `selectedItem` is derived from the filtered view model.
- If filters hide the selected item, the preview panel reports the selected
  item is unavailable.
- Details are not opened as a modal/popup today; selection updates the
  permanent right inspector.

Current row action behavior:

- Row title: select item.
- `...` button: select item / preview in the permanent inspector.
- `Use` button: opens Use as Context flow if not disabled.
- Warning badge: non-interactive count.

Current missing row action paths:

- No row actions menu exists.
- Archive is not exposed from KnowledgeV2 rows.
- Delete is not exposed from KnowledgeV2 rows.
- Details are represented by `...`, but it only selects the item and relies on
  the permanent inspector.

Existing safe frontend action paths available outside KnowledgeV2:

- Documents can be archived by calling `onUpdateKnowledgeDocument` with
  `lifecycleStatus: "archived"` through the existing compatibility document
  panel.
- Documents can be deleted through `onDeleteKnowledgeDocument` with
  confirmation in the existing compatibility document panel.
- Skills can be deleted through `onDeleteSkill` in the existing Skill panel.
- Skill archive is not an equivalent first-class path in the current Skill
  model; Skills use review statuses, not document lifecycle status.

## Shared Popup Shell Capabilities And Gaps

Current popup primitives:

- `PopupShell` portals dialogs to `document.body`.
- `WidgetPopupShell` is the widget-facing wrapper around `PopupShell`.
- Popups support anchored and floating variants.
- Floating popups center in the viewport with max height constrained to
  `min(520px, calc(100vh - 24px))`.
- Anchored popups calculate viewport-bounded top/right/max-height.
- Popups close on Escape, outside pointer down, and explicit close handlers.
- Popups return focus to the supplied trigger ref.
- Popups can be dragged from a descendant marked with
  `data-popup-drag-handle`.
- Drag clamps the popup inside the viewport edge gap.
- The shell itself uses `overflow: auto`, so a too-tall popup can scroll as a
  whole.

Gaps for popup-only KnowledgeV2:

- No shared header/body/footer layout contract exists for bounded widget
  popups.
- Scroll currently belongs to the whole `.popup-shell`, not a dedicated body
  region with fixed header/footer.
- There is no standard class/API for a sticky popup header, scrollable body,
  and pinned footer actions.
- Floating variant has no built-in width size options beyond CSS overrides.
- The shell does not expose an initial size/max-width/max-height prop.
- Nested popup content must provide its own internal overflow behavior if the
  footer must remain visible.

## Use As Context Overflow Cause

Current Use as Context flow:

- `KnowledgeV2PreviewPanel` renders `KnowledgeV2ContextActions`.
- `KnowledgeV2ContextActions` conditionally renders `KnowledgeV2ContextPicker`
  inline inside the preview section when `isContextPickerOpen` is true.
- `KnowledgeV2ContextPicker` is a large embedded grid with selectable items,
  selected item estimates, target radio controls, warnings, and footer.
- The picker is not wrapped in `WidgetPopupShell`.
- The permanent preview inspector is inside the two-column
  `.knowledge-v2-browser` layout.
- The picker has no max-height and no dedicated scroll region.

The overflow issue is therefore structural: opening Use as Context injects a
large multi-panel wizard into the already constrained right inspector. The
right inspector itself can scroll, but the picker footer is part of the inline
content and can be pushed below the visible widget/window. Because it is not a
viewport-bounded popup with a fixed footer and scrollable body, long item lists
or warning lists can make the action controls hard to reach.

## Current Action Popup Behavior

`KnowledgeV2Actions` owns the current top action popups:

- New
- Import
- Draft Review
- Manage Skills
- Help / Legend

Shared behavior:

- The top action bar stores `openAction`.
- Each action opens one `WidgetPopupShell` with `variant="floating"`.
- The popup uses `.knowledge-v2-action-popup-shell` with width
  `min(460px, calc(100vw - var(--space-xl)))`.
- The popup header is marked `data-popup-drag-handle`.
- Close is explicit through a Close button and shell close behavior.
- Availability is visible as available/partial/unavailable.
- Buttons invoke existing callbacks only when available.

Per-flow behavior:

- New: explains document/skill/runbook options and can call `onNew`, which
  opens the existing create flow.
- Import: explains that KnowledgeV2 has no direct file picker/raw path input
  and can call `onImport`, which opens the existing single-file import flow.
- Draft Review: shows visible summary counts and can call `onDraftReview`,
  which opens the existing draft review flow.
- Manage Skills: shows Skill count/options and can call `onManageSkills`,
  which opens the existing Skill flow.
- Help / Legend: replaces persistent helper rails with a bounded popup.

Current action popup gaps:

- The popup body is not split into shared bounded body/footer regions.
- Long availability details or future forms could scroll the whole shell,
  including the header and footer.
- The callbacks open a compatibility panel below the V2 catalog, not a bounded
  popup-only secondary flow.

## Top Controls And Row Controls

Current top controls:

- `WidgetV2Header` renders title/status/subtitle and header actions.
- `KnowledgeV2Actions` renders view toggle plus New, Import, Draft Review,
  Manage Skills, Help.
- `WidgetV2Toolbar` renders search/filter controls.
- `KnowledgeV2Filters` includes search, type, lifecycle/status,
  availability, tag, scope, sort, and result count.

Cramping causes:

- Header action controls wrap alongside the info popover inside
  `.widget-v2-header-actions`.
- View mode toggle and five action buttons all share one flex row.
- Search/filter toolbar uses many grid columns by default.
- The permanent preview column reduces remaining catalog width.

Current row controls:

- Dense list row grid reserves fixed columns for type/status/scope/tags/date/
  actions.
- Actions column is 78px by default.
- The visible action set is `...`, `Use`, and warning badge.
- There is no overflow menu to move secondary actions out of the row.

## Recommended Implementation Path

### 1. Remove Or Default-Hide Permanent Right Preview

- Change `KnowledgeV2CatalogBrowser` so the default body is catalog-only.
- Remove `WidgetV2RightInspector` from the default KnowledgeV2 layout.
- Keep selected item state for row highlight and action context, but do not
  spend a permanent column on details.
- Do not route back to the legacy Knowledge / Skills surface.

### 2. Open Item Details In A Popup

- Add a KnowledgeV2 details popup opened from row click, row Details action,
  Enter/double-click if desired, or selected item details command.
- Reuse `KnowledgeV2PreviewPanel` content where practical, but render it inside
  `WidgetPopupShell` instead of `WidgetV2RightInspector`.
- Keep Overview/Details/Versions/Usage tabs in the popup.
- Ensure selection still does not attach, create, import, run, or send.

### 3. Add Shared Bounded Popup Layout

- Introduce a small frontend-only popup layout component or CSS convention:
  header, scrollable body, footer.
- Keep using `WidgetPopupShell`/`PopupShell` for portal, escape, outside click,
  focus return, and drag behavior.
- Put overflow on the popup body, not the entire content stack, so footer
  actions remain reachable.
- Add width variants needed by KnowledgeV2, such as medium details and large
  context wizard, through CSS classes or a narrow prop.

### 4. Move Use As Context Into A Bounded Wizard Popup

- Stop rendering `KnowledgeV2ContextPicker` inline in
  `KnowledgeV2PreviewPanel`.
- Open it through `WidgetPopupShell` from the Use as Context action.
- Use a bounded body for selectable items and target controls.
- Keep Attach/Close in a pinned footer.
- Preserve current target availability rules:
  Workspace Agent current context, selected Queue task, copy reference, and
  unavailable next-run bridge.
- Preserve explicit operator attach only and visible warnings.

### 5. Keep New/Import/Draft Review/Manage Skills Popup-Only

- Keep the top action popups as the secondary-flow entry points.
- As a follow-up implementation slice, replace the compatibility panel rendered
  below KnowledgeV2 with popup-contained versions of the existing flows or
  popup launchers that do not expand the main catalog surface.
- Keep unavailable and partial bridge states honest.
- Do not add direct file picker/import behavior unless the existing safe
  frontend action is intentionally wired in a later block.

### 6. Replace Row Action Cluster With A Menu

- Use one compact row actions menu button.
- Menu entries should be:
  Details, Use as Context, Archive, Delete.
- Details opens the details popup.
- Use as Context opens the bounded context wizard popup when eligible.
- Archive should be shown for document items only when
  `onUpdateKnowledgeDocument` is available; it should call the existing safe
  update path with `lifecycleStatus: "archived"` and require clear operator
  intent.
- Delete should be shown only when the relevant delete callback exists:
  `onDeleteKnowledgeDocument` for documents, `onDeleteSkill` for Skills.
- Delete must be confirmation-gated, following existing compatibility behavior.
- Disabled menu items should explain unavailable bridges or item-type limits.

### 7. Regroup Top Bar Controls

- Keep primary actions visible: New and Import.
- Move Draft Review, Manage Skills, Help, and view mode into a compact
  secondary controls group or menu if width is constrained.
- Keep search and the most important filters on the toolbar.
- Move less-common filters such as tag/scope/sort behind the existing More
  filters affordance or a popup filter control.
- The catalog should receive the width currently consumed by the permanent
  preview/sidebar.

## Safest Slice Order

1. Add shared bounded popup body/footer CSS or component and tests around the
   existing popup shell behavior.
2. Move Use as Context picker into `WidgetPopupShell` with a scrollable body
   and pinned footer.
3. Move details from permanent inspector into a popup and remove/default-hide
   the right inspector.
4. Replace row `...`/`Use` cluster with a row actions menu.
5. Wire Archive/Delete only through existing frontend callbacks and explicit
   confirmation; keep unavailable states where callbacks are missing.
6. Tighten top action grouping and filter spacing.

## Risks And Follow-Ups

- Reusing `KnowledgeV2PreviewPanel` inside a popup may require small prop or
  layout changes so it does not assume inspector sizing.
- Moving details to a popup changes selection semantics; tests should assert
  that selection alone still has no side effects.
- Archive/Delete wiring must distinguish document lifecycle actions from Skill
  delete-only behavior.
- Compatibility flow popups should not reintroduce a large embedded legacy
  panel below the catalog.
- The popup shell needs a bounded layout convention before larger wizards are
  added, otherwise overflow regressions will repeat.

## Validation Scope

This was a docs-only audit. Requested validation is limited to:

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`

No source code, tests, backend, Rust, Tauri, storage, schema, runtime, Queue,
Workspace Agent, or persisted behavior changes are included.
