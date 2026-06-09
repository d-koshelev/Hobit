# KnowledgeV2 Surface Polish Audit

## Purpose

This docs-only audit records current KnowledgeV2 product-surface polish gaps
found after manual smoke. It does not add frontend behavior, backend behavior,
Rust or Tauri commands, storage/schema changes, Knowledge data changes,
Workspace Agent behavior, Queue behavior, automatic import/create/attach/run
behavior, or hidden context injection.

KnowledgeV2 remains the normal Knowledge / Skills surface through the
saved-compatible `skill-library` identity. The findings below are limited to
UI/component polish and recommended frontend-only follow-up slices.

## Inspected Surface

Inspected files:

- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2CatalogList.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2PreviewPanel.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/knowledgeV2CatalogModel.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/knowledgeV2ItemStatus.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Actions.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2CatalogBrowser.tsx`
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Widget.test.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/knowledgeV2CatalogModel.test.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Actions.unavailable.test.tsx`

Related contracts/status read:

- `docs/KNOWLEDGE_V2_VISUAL_TARGET_CONTRACT.md`
- `docs/KNOWLEDGE_V2_EXPOSURE_STATUS.md`
- `docs/KNOWLEDGE_V2_BRIDGE_CLEANUP_STATUS.md`

## Findings

### 1. Row Actions Can Collapse Into Broken Text

`KnowledgeV2CatalogList.tsx` renders the Actions cell with three inline
elements:

- preview button text `...`
- optional `Use` button
- optional warning counter such as `2w`

`widget-v2-knowledge.css` gives the desktop actions column a fixed `64px`
track and keeps `.knowledge-v2-row-actions` as `inline-flex` with
`flex-wrap: nowrap`. With preview + Use + warning count present, the visible
text can visually concatenate or clip into strings such as `Use2w`.

The mobile breakpoints reduce visible metadata columns, but they still leave
actions as a compact row. The problem is not data-specific; any item with an
enabled Use action and warnings can reproduce it.

Minimal polish target:

- Replace text-heavy row action controls with compact icon-like buttons or a
  single row action affordance plus accessible labels.
- Keep warning count visually separated from actions, preferably as a small
  status chip/dot outside the clickable action cluster.
- Avoid making the row wider through horizontal scroll.

### 2. Type, Status, And Tags Are Raw Or Cramped

The dense table shows Type, Status, Scope, Tags, Updated, and Actions in fixed
tracks. Type is formatted from raw tokens with `formatToken`, status can render
multiple full chips, tags show up to two full tag chips plus `+N`, and the
Updated column is always present.

The current CSS intentionally compresses:

- Type into `58px`
- Status into `88px`
- Tags into `104px`
- Updated into `78px`
- Actions into `64px`

This keeps the list dense, but the combined effect makes normal metadata feel
like a debug table instead of a product catalog. Status labels such as
`Unavailable` and multiple status chips are especially cramped.

Minimal polish target:

- Prioritize title/summary, item kind, primary state, and one action.
- Collapse secondary status details into preview/details or a hover/title.
- Use compact, stable status labels in the row while keeping full reasons in
  the preview.
- Treat tags as optional metadata: show a small count or first tag only in
  the row, and show full tags in preview.

### 3. Empty Tags Render As `None`

Rows with no tags render `<span className="knowledge-v2-muted">None</span>`.
This reads as raw data and adds visual noise to a secondary metadata column.

The preview already uses the more human `No tags supplied.` text. The row
should be quieter than the preview.

Minimal polish target:

- In the table, render an empty dash, blank muted placeholder, or omit the
  tags cell content when tags are absent.
- Keep `No tags supplied.` only in the preview where explanatory empty-state
  text is useful.

### 4. Updated Is Always Visible And Can Dominate With Unknown Values

The table always renders an Updated column. Invalid timestamps render
`Unknown`; missing timestamps render `Not available`. Tests currently assert
that invalid metadata displays `Unknown` rather than `Invalid`.

If data bridges return missing or invalid timestamps widely, the table becomes
dominated by repeated low-value metadata. Sorting by updated date still exists,
but normal scan value is poor when most rows say `Unknown`.

Minimal polish target:

- Do not make Updated a default high-priority row column when the value is
  missing or invalid for most records.
- Prefer hiding unavailable dates in the row, showing them only in preview
  metadata, or replacing the visible row value with a quiet dash.
- Keep invalid-date handling honest in preview/details.

### 5. Overview Can Render Raw Source/Code Content

`knowledgeV2CatalogModel.ts` normalizes documents with:

- `summary = quickSummary || firstUsefulLine(content) || "No quick summary yet."`
- `description = content.trim() || summary`

`KnowledgeV2PreviewPanel.tsx` renders the Overview tab with:

- Summary from `item.summary`
- What it does from `item.description || item.summary`

For Knowledge Documents without `quickSummary`, the first content line becomes
the row summary and Overview Summary. The full trimmed document content becomes
the Overview `What it does` text, capped but still raw source/code content.
That matches the manual smoke gap where Overview shows raw source/code.

Minimal polish target:

- Do not use document body/source content as Overview description.
- For documents with no quick summary, show a neutral product placeholder such
  as `Summary not supplied yet.` and a compact metadata hint rather than raw
  body text.
- Keep raw/bounded reference text only behind explicit Details disclosure.

### 6. Missing Summary Fallback Promotes Raw Content

The missing-summary fallback is explicitly implemented in
`normalizeKnowledgeV2DocumentItem` through `firstUsefulLine(document.content)`.
The warning text also says `Document has no quick summary; using the first
content line.`

This makes the fallback honest, but it still turns raw source content into
primary catalog copy. The problem is presentation quality, not storage.

Minimal polish target:

- Preserve the warning condition, but stop using the first raw content line as
  product copy.
- Use a stable placeholder for missing summaries.
- Optionally derive a very short non-content metadata sentence from item type,
  source label, and scope.

### 7. Preview Status And Warnings Are Verbose By Default

The preview renders a Status section with `KnowledgeV2StatusReasonList` before
the Overview tabs, then a separate Warnings section with every warning message.
The Use as context section repeats context usability, safety boundary text,
target bridge availability, unavailable bridge reasons, and context warnings.

This is safe and explicit, but it is text-heavy for the normal preview. The
same concepts are repeated across chips, status reasons, warnings, and context
actions.

Minimal polish target:

- Show a compact status/warning summary near the preview heading, such as one
  primary state plus `2 warnings`.
- Move full status reasons and warning messages behind Details or a collapsed
  disclosure.
- Keep blocked/unavailable attach reasons visible when the operator tries to
  use context, but avoid repeating all bridge safety copy in the normal
  Overview.

### 8. Empty And Unavailable States Still Use Experimental/Bridge Language

The catalog empty state says:

`Import or create Knowledge in the existing Knowledge / Skills flow, then
return here to review it in the experimental catalog.`

Several action popups and unavailable states mention KnowledgeV2, experimental
surface, bridge callbacks, and existing production flows. That was useful
during exposure and bridge cleanup, but now KnowledgeV2 is the normal
Knowledge / Skills surface.

Minimal polish target:

- Replace normal empty-state copy with product language: no Knowledge items
  yet, import or create one explicitly.
- Keep bridge/debug wording in the information popup or development-only
  unavailable details.
- Avoid telling the operator to leave and return to an experimental catalog in
  the normal empty state.

## Recommended Implementation Path

### Slice 1: Table Row And Action Polish

Frontend-only files likely affected:

- `KnowledgeV2CatalogList.tsx`
- `widget-v2-knowledge.css`
- `KnowledgeV2Widget.test.tsx`

Recommended changes:

- Make the row action cell stable at normal widget width.
- Replace `Use` + `2w` adjacency with separate compact affordances.
- Quiet empty tags in rows.
- Reduce row metadata priority for Updated when unavailable.
- Add/adjust tests for warning action separation and no visible `Use2w` style
  concatenation.

### Slice 2: Preview Hierarchy Cleanup

Frontend-only files likely affected:

- `KnowledgeV2PreviewPanel.tsx`
- `knowledgeV2CatalogModel.ts`
- `knowledgeV2CatalogModel.test.ts`
- `KnowledgeV2Widget.test.tsx`

Recommended changes:

- Stop mapping document body content into Overview `What it does`.
- Stop using the first raw content line as primary summary copy.
- Keep bounded raw reference/source text behind Details disclosure only.
- Add tests for missing quick summary and source/code-like content.

### Slice 3: Compact Warning And Status Summary

Frontend-only files likely affected:

- `KnowledgeV2PreviewPanel.tsx`
- `knowledgeV2ItemStatus.tsx`
- `widget-v2-knowledge.css`
- `KnowledgeV2Widget.test.tsx`

Recommended changes:

- Render primary status and warning count in the preview heading.
- Move full status reason list and warning list behind Details or a collapsed
  disclosure.
- Preserve visible blocked/unavailable attach state where action safety
  requires it.

### Slice 4: Catalog And Empty-Space Polish

Frontend-only files likely affected:

- `KnowledgeV2CatalogList.tsx`
- `KnowledgeV2Actions.tsx`
- `KnowledgeV2CatalogBrowser.tsx`
- `widget-v2-knowledge.css`
- relevant KnowledgeV2 tests

Recommended changes:

- Replace experimental/bridge-first empty copy with normal product copy.
- Keep bridge availability details accessible through the existing info popup.
- Avoid adding new data flows, new widgets, new persistence, or new runtime
  behavior.

## Risks And Follow-Ups

- Tests currently assert some debug-honesty text, including `Unknown`, status
  reasons, and unavailable bridge explanations. A polish implementation should
  update tests intentionally rather than deleting coverage.
- Tight row CSS was added to avoid horizontal scroll; polish should preserve
  that constraint.
- Missing-summary cleanup may change search text if the raw first content
  line is removed from `summary`. If search should still include raw document
  content, keep it in `searchableText` explicitly without showing it as row or
  Overview copy.
- No backend/storage change is needed. The data quality gap should be handled
  as frontend presentation polish until a separate summary-generation or
  authoring workflow is explicitly requested.

## Intentionally Not Implemented

- No source code changes.
- No test changes.
- No backend, Rust, Tauri, storage, or SQLite schema changes.
- No Knowledge data migration.
- No route back to legacy Knowledge / Skills.
- No automatic create, import, attach, Queue task creation, Queue run,
  Workspace Agent send, Agent Executor launch, or hidden context injection.
