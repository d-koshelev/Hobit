# KnowledgeV2 Exposure Audit

## Status

Docs-only audit complete. The normal product catalog still opens the legacy
Knowledge / Skills UI because the current product catalog card inserts the
saved-widget-compatible `skill-library` definition, and `WidgetHost` maps that
definition's component key to `SkillLibraryWidget`.

KnowledgeV2 exists as an experimental frontend Widget V2 surface, but it is not
used by the normal Widget Catalog or the saved-instance render path.

## Current Routing Map

### Product Catalog

Source: `apps/desktop/frontend/src/workbench/catalogTemplates.ts`

- Catalog card title: `Knowledge / Skills`
- Catalog card id: `skill-library`
- Catalog category: `knowledge`
- Definition inserted by `addWidgetTemplate`: `template.futureWidgetDefinitionId ?? template.id`
- Current `futureWidgetDefinitionId`: `skill-library`
- Layout defaults: `getWidgetLayoutDefaults("skill-library")`

Source: `apps/desktop/frontend/src/workbench/workspaceWidgetActions.ts`

- `addWidgetTemplate()` persists a widget instance with:
  - `definitionId: template.futureWidgetDefinitionId ?? template.id`
  - `title: template.title`
  - `category: template.category`

Result: clicking the Knowledge / Skills catalog card creates a widget instance
with `definitionId = "skill-library"`.

### V1 Widget Registry

Source: `apps/desktop/frontend/src/workbench/widgetRegistry.ts`

- Definition id: `skill-library`
- User-facing title: `Knowledge / Skills`
- Component key: `skill-library-widget`
- Default title: `Knowledge / Skills`
- Compatibility title normalization: saved title `Skill Library` displays as
  `Knowledge / Skills`

The `skill-library` definition remains user-facing because it is in
`widgetRegistry` and is not in `internalCompatibilityWidgetDefinitionIds`.

### Canvas And Saved Instance Compatibility

Source: `apps/desktop/frontend/src/workbench/WorkbenchCanvas.tsx`

- The canvas filters persisted instances through
  `isUserFacingWidgetDefinition(widget.definitionId)`.
- `skill-library` passes that filter.
- The canvas renders each visible user-facing instance through `WidgetHost`.

Source: `apps/desktop/frontend/src/workbench/WidgetHost.tsx`

- `getWidgetDefinition(instance.definitionId)` resolves `skill-library`.
- `definition.componentKey` resolves to `skill-library-widget`.
- `widgetComponents["skill-library-widget"] = SkillLibraryWidget`.

Result: both newly added and previously saved `skill-library` instances render
the legacy `SkillLibraryWidget`.

### Render Props And Actions

Source: `apps/desktop/frontend/src/workbench/widgetHostRenderProps.ts`

- For `SKILL_LIBRARY_COMPONENT_KEY`, `WidgetHost` calls
  `knowledgeSkillsWidgetProps(...)`.

Source: `apps/desktop/frontend/src/workbench/widgetProps/knowledgeSkillsWidgetProps.ts`

The current props bridge supplies the existing production Knowledge / Skills
data/action surface:

- `onListKnowledgeDocuments`
- `onListKnowledgeDraftReviews`
- `onListSkills`
- `onCreateKnowledgeDocument`
- `onCreateAgentQueueTask`
- `onCreateSkill`
- `onDeleteKnowledgeDocument`
- `onDeleteSkill`
- `onGetKnowledgeDocument`
- `onGetSkill`
- `onReadKnowledgeDocumentImportFile`
- `onRecordKnowledgeDraftReview`
- `onUpdateKnowledgeDocument`
- `onUpdateSkill`
- `onAttachContextToCoordinator`
- `onAttachKnowledgeContextToQueueTask`

### KnowledgeV2 Registry And Manifest

Source: `apps/desktop/frontend/src/workbench/widgetV2/widgetV2Registry.ts`

- Widget V2 kind: `knowledge-v2`
- Name: `KnowledgeV2`
- Title: `Knowledge Catalog v2`
- Status: `experimental`
- Safety boundary explicitly says there is no replacement of the current
  `skill-library` Knowledge / Skills widget.
- `getAvailableWidgetV2Manifests()` returns only status `available`, so
  `knowledge-v2` is excluded.

Source: `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/KnowledgeV2Widget.tsx`

KnowledgeV2 can already consume the important existing render props/actions:

- `onListKnowledgeDocuments`
- `onListKnowledgeDraftReviews`
- `onListSkills`
- `onAttachContextToCoordinator`
- `onAttachKnowledgeContextToQueueTask`

KnowledgeV2 also accepts callback placeholders for explicit popup handoffs:

- `onNew`
- `onImport`
- `onDraftReview`
- `onManageSkills`

The current KnowledgeV2 shell does not directly consume create/update/delete,
import-file-read, or draft-review-record actions. Those remain owned by the
legacy production component unless a frontend wrapper maps the V2 popups to
safe legacy fallback flows.

## Why The Legacy UI Opens

The exposure path is:

1. Widget Catalog renders the `Knowledge / Skills` template from
   `catalogTemplates.ts`.
2. The template id and `futureWidgetDefinitionId` are both `skill-library`.
3. `addWidgetTemplate()` persists `definitionId = "skill-library"`.
4. `WorkbenchCanvas` allows `skill-library` because it is user-facing.
5. `WidgetHost` resolves `skill-library` to component key
   `skill-library-widget`.
6. `WidgetHost` maps `skill-library-widget` to `SkillLibraryWidget`.

No normal product route currently maps the `Knowledge / Skills` catalog card,
the `skill-library` saved instance id, or the `skill-library-widget` component
key to `KnowledgeV2Widget`.

## Recommended Routing Fix

Use a frontend-only replacement of the render component behind the existing
saved-widget-compatible identity:

1. Keep catalog card id `skill-library`.
2. Keep persisted widget definition id `skill-library`.
3. Keep title `Knowledge / Skills`.
4. Preserve current Knowledge / Skills backend, storage, schema, Workspace API,
   Queue context, Workspace Agent retrieval, and action contracts.
5. Add a production wrapper component, for example
   `KnowledgeSkillsV2Widget`, that renders `KnowledgeV2Widget` using the
   existing `knowledgeSkillsWidgetProps` bridge.
6. Map the normal `skill-library-widget` component key to that wrapper in
   `WidgetHost`.
7. Move the old `SkillLibraryWidget` behind an explicit fallback/dev-only
   component key such as `skill-library-legacy-widget`.

This makes both newly catalog-created and existing saved `skill-library`
instances open the KnowledgeV2 dense catalog + preview surface without a
backend/storage migration.

## Legacy Fallback Plan

Keep the legacy component available but remove it from the normal catalog and
normal saved-instance route.

Safe fallback options:

- Add a dev-only or feature-flagged legacy component key in `WidgetHost`.
- Keep `SkillLibraryWidget` importable for regression tests and emergency
  fallback.
- Route unsupported V2 popup actions to explicit legacy fallback flows only
  after the operator clicks New, Import file, Draft Review, or Manage Skills.
- Do not create a second product catalog card unless a later prompt explicitly
  asks for a dev/debug catalog entry.

The fallback should not introduce a new persisted widget definition id. The
compatibility id remains `skill-library`.

## Risks

- KnowledgeV2 currently has only partial action bridging. The wrapper must
  preserve current create/import/draft-review/manage-skill flows through
  explicit popups or safe legacy handoff, not silently drop them.
- KnowledgeV2 title currently comes from the V2 manifest as
  `Knowledge Catalog v2`; the production wrapper should keep the widget frame
  title and user-facing product label as `Knowledge / Skills`.
- `KnowledgeV2Widget` reports experimental status text. Production exposure
  should update visible copy only in frontend UI/docs, without changing backend
  behavior.
- Tests that assert `SkillLibraryWidget` legacy controls appear for
  `skill-library` will need focused updates in the implementation block.
- Saved `skill-library` instances should not be migrated or rewritten; the
  route change should be render-only.

## Not Implemented In This Audit

- No source code changes.
- No tests changed.
- No backend, Rust, Tauri, storage, or schema changes.
- No Knowledge data migration.
- No deletion of legacy Knowledge / Skills code.
- No new catalog entry or widget definition id.
