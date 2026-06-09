# KnowledgeV2 Product Surface Regression Audit

## Purpose

This docs-only audit records current popup-only KnowledgeV2 product-surface
regressions and defines a strict correction path for the normal Knowledge /
Skills surface.

KnowledgeV2 remains the normal Knowledge / Skills surface through the retained
`skill-library` compatibility identity. This audit does not route Knowledge /
Skills back to the legacy surface.

## Scope

Inspected surface areas:

- KnowledgeV2 shell status, info/help popover, topbar actions, and filter row.
- Catalog list/table, card mode, row selection, row action menu, and warnings.
- Item details popup, content hierarchy, tabs, footer actions, and safety copy.
- Delete confirmation popup and Use as Context popup boundaries where they
  affect details/action presentation.
- KnowledgeV2 CSS sizing, popup width/height bounds, list layout, responsive
  behavior, and small-catalog helper state.

Inspected implementation files:

- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Widget.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2CatalogBrowser.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2CatalogList.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2ItemActions.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Actions.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2PreviewPanel.tsx`
- `apps/desktop/frontend/src/design-system/WidgetPopupShell.tsx`
- `apps/desktop/frontend/src/design-system/PopupShell.tsx`
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`
- `apps/desktop/frontend/src/styles/widget-frame.css`

## Current Regression Findings

### Topbar And Primary Chrome

- The visible shell still uses technical KnowledgeV2 language in product
  chrome: `KnowledgeV2`, `Data sources: ready`, `Data sources: partial`,
  `frontend data`, `frontend list actions`, `bridges`, and `experimental path`.
- The info popover is dense and implementation-facing. It explains the data
  bridge, unavailable sources, load bridge retry, and follow-up bridge wiring
  instead of providing product-level catalog help.
- The widget subtitle says the surface is a dense catalog review and that
  production Knowledge / Skills remains unchanged. Now that KnowledgeV2 is the
  normal Knowledge / Skills surface, this reads as transition/debug copy.
- Topbar actions are split across view toggle, primary actions, management
  actions, and More. At narrow and medium widths, these groups wrap and compete
  with the widget shell status instead of presenting one calm command area.
- Action popups repeat availability and bridge details in normal interaction
  paths, especially New, Import, Draft Review, and Manage Skills.

Correction target:

- Use product language: Knowledge / Skills, Catalog, New, Import, Review,
  Skills, Help.
- Keep bridge/readiness details out of primary chrome. Move implementation
  diagnostics behind an explicitly developer/debug-only path or remove them
  from normal UI.
- Harden the topbar into stable groups: view/search/filter controls as catalog
  controls, creation/import as primary actions, secondary management under one
  compact menu at constrained widths.

### Catalog List And Small Data Layout

- The dense table is technically structured but visually undersized when only
  one to three items are present. The table ends quickly and the rest of the
  widget becomes dead empty area.
- The current small-list helper only adds a short `1 item shown`/`N items
  shown` row with `84px` minimum height. It does not create a useful product
  state or meaningful scan area.
- The catalog table keeps a full header and seven columns even for very small
  datasets, which makes one-row catalogs feel like a cramped database grid in a
  mostly empty widget.
- Card mode exists, but the normal list mode still carries the small-catalog
  dead-space behavior.

Correction target:

- For small catalogs, keep the catalog area visually intentional: either give
  rows stronger height/content rhythm or show a compact next-step strip below
  the rows with product actions such as Import, New, or clear filters when
  applicable.
- Do not fill space with explanatory copy. Use layout density and useful
  affordances, not a long help panel.
- Keep dense table behavior for real lists, but avoid a tiny database-table
  island when the item count is low.

### Row Actions And Menu Labels

- The row action launcher is a text button labeled `Actions`, not an icon or a
  clean product command. The current label reads like generic UI plumbing.
- The table header includes `Actions`, adding another technical column label
  rather than a quiet command affordance.
- Disabled menu items render long disabled reasons inline inside the menu. This
  makes the menu tall, cramped, and technical.
- Disabled reasons mention bridges and callbacks:
  `no context action bridge is connected`, `no safe archive bridge is
  connected`, `no safe delete bridge is connected`, `KnowledgeV2 did not
  receive...`.
- The warning badge is a bare `!`, visually disconnected from the menu and not
  a product-quality status affordance.
- Archive and Delete are discoverable but mixed with routine actions in a
  cramped row menu. Delete is confirmation-gated, but the initial menu still
  mixes destructive and non-destructive actions without enough hierarchy.

Correction target:

- Replace row `Actions` text with a compact overflow/menu affordance and an
  accessible label.
- Use clean menu labels: Details, Use as context, Archive, Delete.
- Do not render bridge/callback explanations inline in the menu. Show disabled
  state tersely; expose longer reasons in a tooltip/title, details popup status
  area, or action-specific confirmation/error state.
- Separate destructive actions visually inside the menu.
- Replace `!` with a compact warning/status chip or integrate warning count
  into the status column.

### Details Popup Content

- The details popup header already shows the selected title, but the body
  repeats the type, title, status badges, summary, compact status, status grid,
  and a Status section before the tabs. This makes the popup feel like the old
  preview panel moved into a modal.
- Overview duplicates summary text: a top summary paragraph and an Overview
  tab `Summary` section both render the same summary source.
- The popup is text-heavy by default. Overview includes Summary, What it does,
  Use cases, and Tags, then Details/Source/Versions/Usage add more explanatory
  panels.
- Several panels expose implementation or absence language in primary popup
  content: `not wired`, `not being invented`, `not available`, `bounded popup`,
  `KnowledgeV2`, and source/ref metadata labels.
- The Versions and Usage tabs are mostly unavailable-state explanations. They
  add surface area without helping the operator inspect or use the item.
- Details/source sections expose raw metadata and reference text under product
  tabs but still read as diagnostics rather than task-focused details.

Correction target:

- Redesign the details popup as a purpose-built item sheet:
  title/header once, one concise summary, compact status row, primary actions,
  and a small set of meaningful tabs.
- Remove duplicate title/status/summary content from the body when it already
  exists in the popup header or summary.
- Collapse or remove unavailable placeholder tabs from the normal details
  popup. Do not show future/unsupported features as normal tabs.
- Keep source/raw/reference text available, but behind a clearly secondary
  section.

### Details Popup Sizing And Resizability

- The details popup width is `min(720px, calc(100vw - var(--space-xl)))`.
  That is narrower than the context picker (`820px`) and can feel constrained
  for metadata, source refs, and source preview.
- The shared popup shell has fixed viewport-bounded max width/height and body
  scrolling. It supports dragging through `data-popup-drag-handle`, but there
  is no resize handle or explicit resizable affordance.
- `popup-shell` sets a default `max-width: min(520px, calc(100vw - 24px))`;
  Knowledge-specific classes override width, but the global max-width still
  risks constraining popup variants unless explicitly overridden by cascade.
- The details body has `max-height: min(68vh, calc(100vh - 180px))`; the
  shell also has `max-height: min(520px, calc(100vh - 24px))`. This double
  bounding can make long content feel cramped even though it scrolls.
- The footer remains visible, but verbose footer text consumes vertical space
  that would be better used by the details body.

Correction target:

- Make details popup sizing intentionally larger and clearer: use a wider
  bounded sheet target, for example matching or approaching the context picker
  width, while preserving mobile viewport bounds.
- If resizability is expected, implement it in the shared popup shell as an
  explicit future UI primitive. Do not invent a Knowledge-only resize system in
  this correction block unless explicitly requested.
- For the near-term product-surface correction, improve perceived room by
  removing duplicated content and verbose footer copy before adding new shell
  behavior.

### Footer Actions And Safety Copy

- The details footer contains four actions plus a full-width explanatory
  paragraph.
- The paragraph repeats safety and implementation language:
  `opens explicit visible context targets only`, `explicit visible callbacks`,
  `existing Knowledge Document lifecycle update action`, `existing Knowledge /
  Skills delete action and asks for confirmation`.
- Disabled reasons are also verbose in the footer and often mention internal
  bridges or action plumbing.
- Archive/Delete are discoverable but mixed into the same cramped footer row as
  Use as context and Close, followed by dense explanatory text.

Correction target:

- Footer should contain only actions and terse disabled state, not explanatory
  safety prose.
- Primary footer action: Use as context.
- Secondary: Close.
- Destructive or lifecycle actions: place behind a More menu or separated
  footer group. Keep Delete confirmation-gated.
- Safety explanations should appear only when the operator attempts an
  unavailable/blocked action or opens a deeper help/diagnostic area.

### Verbose Copy Inventory

Primary UI and popup copy that should be removed or rewritten:

- `KnowledgeV2 is an experimental list-first catalog over existing Knowledge
  Documents and Skills data.`
- `Selection only updates the preview. New, import, draft review, Skill
  management, and context use stay explicit.`
- `KnowledgeV2 is reading existing Knowledge / Skills frontend data.`
- `KnowledgeV2 is using only available frontend bridges.`
- `KnowledgeV2 has no Knowledge / Skills data bridge in this experimental
  path. No production data is being faked.`
- `This experimental WidgetV2 path did not receive Knowledge / Skills list
  props or list actions. No production data is being faked.`
- `Opening this popup does not create a Knowledge item.`
- `Opening this popup does not read or import a file.`
- `Raw path import is not exposed in this popup.`
- `Full draft review and acceptance stay in the production Knowledge / Skills
  review surface.`
- `Skill CRUD is still owned by the current Knowledge / Skills widget.`
- `Where-used tracking is not wired in KnowledgeV2. No Workspace Agent, Queue,
  run, prompt, or widget usage data is being invented here.`
- `Use as context opens explicit visible context targets only. These controls
  only use explicit visible callbacks.`
- `Archive uses the existing Knowledge Document lifecycle update action.`
- `Delete uses an existing Knowledge / Skills delete action and asks for
  confirmation.`

Keep safety semantics, but express them through state and explicit controls
rather than paragraphs in the normal product surface.

## Recommended Implementation Path

### Block 1: Details Popup Product Redesign

- Keep the popup-only model.
- Widen the details popup within shared popup bounds.
- Remove duplicate body title/status/summary and make the body read like an
  item sheet, not a migrated preview panel.
- Reduce normal tabs to useful content only, such as Overview, Source, and
  Metadata. Hide unavailable Usage/Version-history placeholders from normal
  UI.
- Keep raw source/reference text secondary and bounded.
- No backend, storage, schema, Queue, Workspace Agent, or context behavior
  changes.

### Block 2: Footer And Primary Copy Cleanup

- Remove verbose footer explanatory paragraph.
- Replace technical bridge/callback copy in normal chrome with product labels.
- Keep longer unavailable reasons only in attempted-action notices, tooltips,
  or a non-primary diagnostic/help area.
- Preserve explicit operator control for context, archive, delete, import, and
  create.

### Block 3: Row Action Menu Cleanup

- Replace text `Actions` launcher with a compact overflow affordance.
- Keep menu items terse and product-facing.
- Separate destructive/lifecycle actions from Details and Use as context.
- Remove inline long disabled reasons from the menu body.
- Replace the bare warning `!` with a clearer compact status/warning affordance.

### Block 4: Catalog Small-Data Layout Cleanup

- Improve one-to-three item layout so the catalog does not become a tiny table
  in a large empty widget.
- Add a compact, useful small-data strip or stronger row rhythm without adding
  verbose help copy.
- Preserve dense table behavior for normal list sizes.

### Block 5: Topbar Grouping Hardening

- Normalize topbar groups and responsive collapse rules.
- Keep primary catalog controls stable at normal widget widths.
- Collapse secondary management actions earlier and avoid duplicate visible
  action groups.
- Remove transition/debug language from the normal product topbar.

## Risks And Follow-Ups

- Shared popup resizability is a platform primitive, not a Knowledge-only
  concern. Treat explicit popup resize as a later shared shell task unless the
  next implementation block explicitly requests it.
- Removing verbose copy must not remove safety behavior. Explicit action
  gating, disabled states, confirmation for Delete, and no automatic attach/run
  behavior must remain.
- Product copy should stop saying KnowledgeV2 is experimental in normal UI now
  that it is routed as the Knowledge / Skills surface, but compatibility names
  may remain in code and docs.
- Manual smoke remains important after implementation: topbar at narrow widths,
  details popup with long source content, row action menu with unavailable
  actions, small catalog with one item, and Delete confirmation.

## Explicit Non-Goals

- No backend, Rust, Tauri, storage, SQLite schema, or Knowledge data changes.
- No route back to the legacy Knowledge / Skills surface.
- No hidden context injection.
- No automatic create, import, attach, prompt send, Queue task creation, Queue
  run, Agent Executor launch, or auto-finalize behavior.
- No new Knowledge Catalog backend/store.
- No new widget identity or insertion behavior.
- No source code or test changes in this audit block.
