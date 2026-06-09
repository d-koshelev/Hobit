# KnowledgeV2 Bridge Cleanup Audit

## Status

Docs-only audit for `KNOWLEDGE-V2-BRIDGE-CLEANUP-AUDIT-01`.

KnowledgeV2 is routed as the normal Knowledge / Skills surface through the
saved-compatible `skill-library` identity, but its bridge is still partial. The
partial state is mostly frontend bridge composition and UX presentation, not a
backend/storage/schema gap.

Current smoke symptoms reviewed:

- KnowledgeV2 opens.
- Header reports `Partial bridge`.
- A large bridge-status banner appears.
- Only two document rows are visible.
- No Skill rows are visible.
- Dense list can horizontally scroll.
- Draft Review reports a partial warning.
- Preview metadata can show values like `Updated Invalid`.

## Inspected Files

- `apps/desktop/frontend/src/workbench/KnowledgeSkillsV2Widget.tsx`
- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.tsx`
- `apps/desktop/frontend/src/workbench/widgetProps/knowledgeSkillsWidgetProps.ts`
- `apps/desktop/frontend/src/workbench/workspaceSkillWidgetActions.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Widget.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2CatalogBrowser.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2CatalogList.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Actions.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2PreviewPanel.tsx`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/knowledgeV2CatalogModel.ts`
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/knowledgeV2ContextAffordances.ts`
- `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts`
- `apps/desktop/frontend/src/workspace/types/skills.ts`
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`

## Bridge Shape

KnowledgeV2 data bridge:

- accepts direct `documents`, `skills`, and `draftReviews` props;
- can load documents through `onListKnowledgeDocuments`;
- can load skills through `onListSkills`;
- accepts `onListKnowledgeDraftReviews`, but does not call it because the
  current list action requires request fields such as `draftPackId`;
- marks draft review as missing/partial unless concrete `draftReviews` are
  provided.

Normal product routing:

- `KnowledgeSkillsV2Widget` renders `KnowledgeV2Widget` inside `WidgetFrame`;
- it passes `onListKnowledgeDocuments`, `onListSkills`,
  `onListKnowledgeDraftReviews`, Workspace Agent attach, Queue attach, and
  popup callbacks for New, Import, Draft Review, and Manage Skills;
- it renders the legacy `SkillLibraryDocumentsPanel` only after a popup action
  sets a compatibility flow.

Legacy Knowledge / Skills bridge:

- `knowledgeSkillsWidgetProps` exposes Skill CRUD, Knowledge Document CRUD,
  draft review list/record, import-file read, and context attach callbacks;
- `workspaceSkillWidgetActions` binds those callbacks to the open Workspace;
- `SkillLibraryDocumentsPanel` owns the full existing editor/import/draft/skills
  flows.

## Why The Bridge Is Partial

The primary partial marker is draft review bridging.

`KnowledgeV2Widget` computes `draftReviewBridgeAvailable` from the presence of
`draftReviews`, not from `onListKnowledgeDraftReviews`. When only the list
callback is present, it reports:

`Draft review item bridge is partial: the current list action requires a selected draft pack`

This is accurate for the current API shape. The frontend cannot list all draft
reviews without a selected draft pack/fingerprint request.

Document and Skill list bridges are available in the normal `skill-library`
route when `WidgetHost` passes `knowledgeSkillsWidgetProps`. If documents load
but Skills do not appear, likely causes are:

- the current Workspace has zero persisted Skill records;
- `onListSkills` is failing and the combined `Promise.all` load falls back to
  passed props/empty arrays;
- the route used in smoke is an experimental/dev path where `onListSkills` was
  not passed;
- less likely: filters are hiding skills. Default filters are `type: all`,
  `availability: all`, `lifecycle: all`, `scope: all`, and empty text/tag, so
  default KnowledgeV2 filtering should not hide Skills.

Normalized mapping itself supports Skills. `normalizeKnowledgeV2CatalogItems`
returns both document and skill normalized items. Skills map to
`recordKind: "skill"`, `type: "skill"`, workspace source, review-derived
lifecycle, tags, summary from `whenToUse` or `steps`, and searchable only when
reviewed.

## Action Availability

New:

- KnowledgeV2 has a popup action.
- In normal routing it receives `onNew`, which opens the legacy panel and calls
  `startNewDocument`.
- It does not directly create documents or Skills.

Import:

- KnowledgeV2 has a popup action.
- In normal routing it receives `onImport`, which opens the legacy import flow.
- It does not directly open a file picker, read a file, or import.

Draft Review:

- KnowledgeV2 has a popup action.
- In normal routing it receives `onDraftReview`, which opens the legacy draft
  review flow.
- Its own summary can count draft documents and draft/needs-review Skills from
  visible catalog records, but it does not own draft pack loading or acceptance.
- The bridge remains partial because all-review listing is not available from
  the current request-shaped draft-review API.

Manage Skills:

- KnowledgeV2 has a popup action.
- In normal routing it receives `onManageSkills`, which opens the legacy Skills
  flow inside `SkillLibraryDocumentsPanel`.
- It does not directly expose Skill CRUD in the V2 shell.

Use as Context:

- KnowledgeV2 has a context picker and explicit target model.
- Workspace Agent current-session attach is available when
  `onAttachContextToCoordinator` is passed.
- Queue selected-task attach is available when
  `onAttachKnowledgeContextToQueueTask` is passed.
- Copy reference depends on `navigator.clipboard.writeText`.
- Workspace Agent next-run context is explicitly unavailable.
- Attachable eligibility is local and conservative: Skills must be reviewed;
  documents must be enabled, searchable, not rejected/archived/draft; stale
  documents attach with a warning.

## Data And UX Gaps

Large partial banner:

- `KnowledgeV2BridgeNotice` renders a full section for `partial` status.
- Because draft review is always partial in normal routing, the banner becomes
  persistent even when document and skill list data are usable.
- This overstates severity and consumes catalog space.

Horizontal table scroll:

- `.knowledge-v2-row` has `min-width: 780px`.
- The list has seven columns plus row actions.
- In smaller widget sizes this forces horizontal overflow instead of adapting
  to a dense responsive layout.

Invalid metadata:

- `formatDate` in list and preview returns `Invalid` for unparsable date
  strings.
- Normalized document and Skill models pass `updatedAt` through directly.
- If backend/dev/mock data contains non-ISO or placeholder values, preview
  shows `Updated Invalid` instead of an honest unavailable/unknown label.

Version/source fields:

- Skills map `version: null`, `versionSummary: null`, source kind
  `operator_authored`, source label `Workspace Skill`, and no source refs.
- Documents can have empty source fields depending on creation/import path.
- Preview currently renders many absent values as `Unavailable`, which is
  honest but noisy when combined with the persistent partial bridge banner.

Per-action state:

- Global status is coarse: `ready`, `partial`, `unavailable`.
- Individual actions already know their callbacks, but the main bridge banner
  lists missing bridges globally.
- The UI would be clearer if data readiness and action readiness were separated.

## Recommended Cleanup Path

1. Complete available frontend list bridges.

   Keep using `onListKnowledgeDocuments` and `onListSkills` in KnowledgeV2.
   Add targeted instrumentation or UI detail that distinguishes `documents
   loaded`, `skills loaded`, and `skills list unavailable/failed`. Do not add
   backend, Tauri, storage, schema, or hidden ingestion behavior.

2. Treat draft review as per-action partial, not whole-catalog partial.

   Do not mark the entire KnowledgeV2 catalog `Partial bridge` solely because
   all-draft review data is unavailable. Show Draft Review availability inside
   the Draft Review popup/action status. Keep the legacy draft review flow as
   the explicit owner until a selected draft-pack bridge is defined.

3. Compact bridge status/details.

   Replace the large persistent partial banner with a compact status detail or
   disclosure when documents and skills are loaded. Reserve the large banner
   for true data unavailable or load-failed states.

4. Add per-action availability.

   Render New, Import, Draft Review, Manage Skills, Workspace Agent attach,
   Queue attach, and Copy Reference with separate available/unavailable/partial
   status. A missing Draft Review item bridge should not imply document/skill
   browsing is broken.

5. Make the dense table responsive.

   Remove the hard `780px` row minimum or replace the seven-column row with a
   responsive dense layout that can collapse secondary fields. Keep title,
   type/status, and explicit actions visible; move tags/source/updated into
   compact meta text or the preview at narrow widths.

6. Format preview metadata safely.

   Replace visible `Invalid` date output with `Unknown` or `Not set` and add
   one safe helper shared by list and preview. Keep raw invalid values out of
   normal UI; if needed, expose them only in a collapsed debug/detail area.
   For version/source, prefer concise domain-specific fallbacks such as
   `No version`, `Operator-authored Skill`, or `No source ref` instead of a
   broad repeated `Unavailable`.

7. Keep KnowledgeV2 as Knowledge / Skills, not a new runtime.

   The safe next work should stay frontend-only unless separately authorized.
   Do not add auto-create/import/attach/run behavior. Do not add Queue or Agent
   auto-run. Do not add backend/Rust/Tauri/storage/schema changes.

## Risks

- Hiding the partial banner without per-action status could overclaim Draft
  Review readiness.
- Directly wiring draft-review listing without a draft-pack request model could
  invent semantics the current API does not support.
- Making KnowledgeV2 directly own Skill/Document CRUD would duplicate the
  existing `SkillLibraryDocumentsPanel` ownership unless planned as a focused
  replacement block.
- Responsive table cleanup must preserve explicit action visibility and avoid
  turning catalog selection into implicit attach/use behavior.

## Implementation Boundary

Safe next implementation block:

- frontend-only;
- KnowledgeV2 and CSS only, plus focused tests;
- no backend/Rust/Tauri/storage/schema changes;
- no data migration;
- no new dependencies;
- no hidden context, hidden import, automatic attach, Queue dispatch, Agent
  execution, Git mutation, or provider behavior.

Legacy Knowledge / Skills should remain a fallback/dev-only compatibility
surface until KnowledgeV2 directly owns equivalent current flows or the legacy
panel is intentionally retired in a separate contract-backed block.
