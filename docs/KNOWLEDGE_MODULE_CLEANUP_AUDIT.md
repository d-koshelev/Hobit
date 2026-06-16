# Knowledge Module Cleanup Audit

## Purpose

This docs-only audit records the current Knowledge module route, compatibility
constraints, cleanup risks, and ordered refactor direction before any
rename/refactor/delete work. It is a reference cleanup contract, not a product
runtime contract. It does not add frontend behavior, backend behavior, Tauri
commands, storage/schema changes, widget ids, Queue behavior, Workspace Agent
behavior, or Knowledge data changes.

## A. Executive Summary

- Knowledge is the current product module.
- The active implementation still carries `skill-library`, `SkillLibrary*`,
  and `KnowledgeV2*` names.
- Persisted ids must remain compatible. Cleanup must not rename persisted
  widget identities or stored data shapes.
- Cleanup should remove V2/product debt and isolate legacy code gradually,
  with compatibility exports and tests before deletion.
- Current Knowledge APIs/storage are real and typed. Search is lexical and
  bounded, not RAG, vector search, or embeddings.

## B. Active Route Map

- Catalog/widget definition id: `skill-library`.
- Persisted widget id: `skill-library`.
- Component key: `skill-library-widget`.
- Active host route: `skill-library-widget -> KnowledgeSkillsV2Widget ->
  KnowledgeWidget`.
- Legacy wrapper: `SkillLibraryWidget = LegacyKnowledgeSkillsWidget`.
- `knowledge-v2` is a smoke/WidgetV2 metadata identity, not the persisted
  product widget id.
- Active source home after Block 003:
  `apps/desktop/frontend/src/workbench/knowledge/*`.
- Old `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/*` source paths
  remain as compatibility re-exports/wrappers.
- Legacy SkillLibrary implementation home after Block 004:
  `apps/desktop/frontend/src/workbench/knowledge/legacySkillLibrary/*`.
- Old root `apps/desktop/frontend/src/workbench/SkillLibrary*`,
  `useSkillLibrary*`, and `skillLibraryModel*` paths remain compatibility
  facades.

The current product route is therefore Knowledge through the saved-compatible
`skill-library` identity, while the active source/component route still uses
KnowledgeV2 and SkillLibrary compatibility names.

## C. Compatibility Constraints

Do not rename or rewrite:

- `skill-library`.
- `skill-library-widget`.
- saved `Skill Library` title compatibility.
- Tauri command names.
- SQLite tables or columns.
- backend storage schema.
- Queue context attachment data shape.

These names and shapes are compatibility boundaries for saved Workspaces,
frontend host routing, desktop IPC, local SQLite data, and Queue task context.

## D. Legacy/V2 Inventory

Active required:

- `KnowledgeSkillsV2Widget`.
- `KnowledgeWidget`.
- `apps/desktop/frontend/src/workbench/knowledge/*`.
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`.

Compatibility required:

- `KnowledgeV2*` exports.
- `apps/desktop/frontend/src/workbench/widgetV2/knowledgeV2/*` wrappers.
- `SkillLibraryWidget`.
- `SkillLibraryWidget = LegacyKnowledgeSkillsWidget`.
- `skill-library` definition id.
- `skill-library-widget` component key.
- saved `Skill Library` title normalization.

Transitional/removable later:

- `SkillLibraryDocumentsPanel`.
- `SkillLibrarySkillsPanel`.
- `SkillLibraryDraftReviewPanel`.
- `SkillLibraryDocumentImportControls`.
- `useSkillLibrary*`.
- `skillLibraryModel*`.
- old SkillLibrary tests after replacement-flow coverage exists.

Unsafe until usage checked:

- V2 test helpers, CSS selectors, and WidgetV2 smoke metadata tied to
  `knowledge-v2`.
- Legacy panels that still own New, Import, Draft Review, and Manage Skills
  flows.
- Queue/Workspace Agent attach tests that still import old names.

Dead code candidates:

- Legacy-only helpers, components, and tests with no active imports after New,
  Import, Draft Review, and Manage Skills are rehomed into the Knowledge
  module.
- Product-facing `KnowledgeV2` labels once compatibility aliases exist.

Dead code must be removed only after focused usage proof through `rg`,
typecheck, and relevant Knowledge/Queue/Workspace Agent tests.

## E. API/Storage Map

- Frontend workspace APIs: Skill create/list/get/update/delete; Knowledge
  Document create/list/get/update/delete/search; explicit import-file read;
  draft review record/list; Queue Knowledge/Skill attach/detach.
- Memory fallback APIs: development-only in-memory Skill and Knowledge
  Document CRUD/search plus draft review state where available; unsupported
  paths report visible runtime errors outside supported browser/dev cases.
- Tauri commands: desktop IPC exposes typed Knowledge Document, Skill, import,
  draft review, and Queue attach/detach commands.
- Backend workspace service: `WorkspaceService` owns validation and mutation
  for Knowledge Documents, Skills, draft review ledger records, and Queue
  context attachment/materialization.
- SQLite tables: `skills`, `knowledge_documents`,
  `knowledge_document_chunks`, `knowledge_document_versions`,
  `knowledge_draft_review_ledger`, and `agent_queue_tasks.context_json`.
- Import constraints: explicit single file only; `.txt`, `.md`, and
  `.markdown`; UTF-8 text; 1 MB maximum.
- Search: lexical/chunk based, bounded, enabled/searchable/lifecycle aware,
  not RAG, vector search, embeddings, or background indexing.
- Draft review ledger: accepted and rejected draft decisions are durable
  review records with Queue/run/source metadata where supplied; rejected draft
  content is not Knowledge.
- Queue context attachment/materialization: selected saved Knowledge Documents
  and Skills attach through typed APIs as durable Queue-owned refs/snapshots;
  materialization can prepend `Knowledge / Skills context` and append
  `Context used` evidence before explicit Queue execution.

## F. Code Organization Problems

- Active product code is hidden under V2 names.
- Legacy SkillLibrary panels still own core New, Import, Draft Review, and
  Manage Skills flows.
- Knowledge ownership is split across root `workbench`, `widgetV2`,
  `workspace`, Queue, Workspace Agent, styles, Tauri, app service, and storage.
- UI, API bridge loading, action availability, debug state, and product copy
  are mixed in large components.
- Queue context materialization policy is duplicated between frontend and
  backend paths.
- CSS and tests preserve `knowledge-v2-*` and `SkillLibrary*` naming debt.
- Large file hotspots from the audit include:
  - `KnowledgeV2Widget.test.tsx`.
  - `SkillLibraryWidget.test.tsx`.
  - `KnowledgeV2CatalogBrowser.tsx`.
  - `SkillLibraryDocumentsPanel.tsx`.
  - `KnowledgeV2Actions.tsx`.
  - `skillLibraryModel.ts`.
  - `agentQueueKnowledgeContext.ts`.
  - backend `agent_queue_context.rs`.
  - backend/storage `knowledge_documents.rs`.

## G. Agent Contract/Self-Test Direction

First safe Knowledge capabilities should be read-only:

- `knowledge.list`.
- `knowledge.search`.
- `knowledge.previewItem`.
- `knowledge.getDocument`.
- `knowledge.getSkill`.
- `knowledge.selfTest`.

Deferred capabilities:

- create/update/delete.
- `importFile`.
- `attachToQueue`.
- `attachToWorkspaceAgent`.
- `acceptDraft` / `rejectDraft`.

Knowledge self-test should start as metadata-only or safe read-only checks:
contract exists, adapter availability is honest, list/search declarations are
read-only, impossible-query search is safe, and fixture reads are skipped unless
an explicit safe fixture exists. It must not import, create, update, delete,
attach context, accept/reject drafts, call Codex, run shell commands, launch
Terminal, mutate Git, or start Queue workers.

## H. Regex Routing Warning

`workspaceAgentKnowledgeCommands.ts` currently contains regex command routing
for Knowledge command text. Do not broaden it.

Future cleanup must replace this path with typed capability/broker flow. The
core architecture rule is:

- No natural-language regex, phrase matching, keyword matching, or heuristic
  text routing for user prompts.
- Agents interpret prompts through model reasoning plus Hobit context plus the
  capability manifest.
- Agents emit structured action requests.
- The app may parse structured machine-readable envelopes only.

## I. Target Source Structure

Target frontend source shape:

```text
workbench/knowledge/
workbench/knowledge/components/
workbench/knowledge/model/
workbench/knowledge/api/
workbench/knowledge/agent/
workbench/knowledge/context/
workbench/knowledge/import/
workbench/knowledge/draftReview/
workbench/knowledge/legacySkillLibrary/
styles/widgets/knowledge.css
```

Compatibility re-exports should keep old `KnowledgeV2*` and `SkillLibrary*`
imports compiling during the transition.

## J. Ordered Cleanup Blocks

001 current-state audit/status doc:

- Add this audit and index it as a cleanup reference.
- Do not change runtime behavior.

002 remove product-facing V2 labels:

- Replace normal UI/debug-visible product labels that say KnowledgeV2 with
  Knowledge language.
- Keep persisted ids and compatibility exports.
- Status: completed for active product-facing copy in Block 002. Source
  symbols, file names, CSS selectors, compatibility aliases, and WidgetV2
  smoke/metadata identities may still carry V2 naming until later cleanup
  blocks.

003 move active source into `workbench/knowledge` with compatibility exports:

- Rehome active Knowledge catalog components/model/API wrappers.
- Preserve old import paths through aliases.
- Status: completed for active frontend source organization in Block 003.
  Persisted `skill-library` / `skill-library-widget` identities, `knowledge-v2`
  smoke metadata, backend/Tauri/API/storage behavior, and legacy SkillLibrary
  flows are unchanged.

004 isolate SkillLibrary legacy code:

- Move retained legacy flows behind `workbench/knowledge/legacySkillLibrary`.
- Keep New, Import, Draft Review, and Manage Skills behavior working.
- Status: completed in Block 004. Legacy SkillLibrary implementation now lives
  under `apps/desktop/frontend/src/workbench/knowledge/legacySkillLibrary/*`.
  Root SkillLibrary, useSkillLibrary, and skillLibraryModel paths remain thin
  compatibility facades. No legacy flows were deleted.

005 remove dead legacy pieces after usage proof:

- Delete only after focused import search, typecheck, and test coverage prove
  no active route depends on the pieces.

006 refresh Knowledge widget agent contract to read-only first:

- Keep write/import/attach/draft review capabilities deferred.
- Add `knowledge.getDocument` and `knowledge.getSkill` direction.

007 add read-only Knowledge capability adapter:

- Implement list/search/preview/getDocument/getSkill only.
- No hidden context access or mutation.

008 add brokered Knowledge self-test:

- Use typed broker flow and safe read-only evidence.
- No import, create, update, delete, attach, draft accept/reject, Codex,
  shell, Terminal, Git, or Queue worker side effects.

009 update docs/current surface/smoke:

- Reconcile current route, compatibility names, safe read-only capabilities,
  and self-test behavior across docs and smoke checklists.

010 full regression:

- Run full focused Knowledge, Queue context, Workspace Agent capability, docs,
  frontend, and Rust validation appropriate to the implementation scope.

## K. Risks / Do-Not-Break List

Do not break:

- persisted ids.
- SQLite schema.
- Tauri command names.
- Queue context attachments.
- `Context used` evidence section.
- draft review accepted/rejected semantics.
- global vs workspace Knowledge scope.
- import constraints.
- Workspace Agent visible context boundaries.
- Widget registry/catalog/host rendering.

High-risk areas:

- saved Workspaces containing `skill-library` widget instances.
- old saved title `Skill Library`.
- desktop IPC callers for existing Tauri commands.
- local SQLite databases with existing Knowledge/Skill/Queue context data.
- Queue execution paths that materialize attached Knowledge context.
- Workspace Agent paths that must stay visible-context-only and typed-capability
  based.

## L. Non-Goals

- No RAG, vector search, or embeddings.
- No PDF/DOCX parsing.
- No folder watcher.
- No server/team storage.
- No destructive delete/archive behavior changes.
- No backend schema migration unless proven necessary.
- No Finder work.
- No regex routing.

## M. Block 005A Legacy SkillLibrary Usage Audit

Status: completed as an investigation-only block. No files are approved for
deletion from this audit alone. No runtime behavior, persisted ids, backend
APIs, Tauri commands, storage schema, exports, or Finder code were changed.

### Usage Map Summary

- Product route remains `skill-library-widget -> KnowledgeSkillsV2Widget ->
  KnowledgeWidget`.
- `KnowledgeSkillsV2Widget` still imports
  `knowledge/legacySkillLibrary/SkillLibraryDocumentsPanel` and renders it only
  after explicit New, Import, Draft Review, or Manage Skills actions.
- `SkillLibraryDocumentsPanel` still owns the transitional flow shell for New
  Knowledge Document, Import Knowledge Document, Draft Review, Manage Skills,
  legacy attach controls, and refresh Queue task creation.
- Active Use as Context is owned by `workbench/knowledge/*` through
  `KnowledgeCatalogBrowser`, `KnowledgeContextPicker`, and
  `knowledge/context/knowledgeContextAffordances`.
- Queue Knowledge context attach/materialization is active outside the legacy
  source tree through `agentQueueKnowledgeContext` and Queue controllers, while
  the legacy panel can still call the same attach callback.
- `knowledgeDraftAcceptance` is a shared active helper used by legacy draft
  review and Queue draft review. It is not dead code.
- Root `SkillLibrary*`, `useSkillLibrary*`, and `skillLibraryModel*` files are
  compatibility facades. Some are test-only today, but `skillLibraryModel` is
  still production-imported by Notes and quick-summary warning code.
- Old `widgetV2/knowledgeV2/*` files are compatibility wrappers and smoke-test
  paths. They are not active implementation owners, but they are still covered
  by tests and WidgetV2 compatibility metadata.

### Classification Table

| Item | Classification | Evidence | Removal note |
| --- | --- | --- | --- |
| `SkillLibraryWidget` / `LegacyKnowledgeSkillsWidget` | compatibility required | Not mapped by `widgetHostComponents`; root and legacy exports are asserted by `KnowledgeSkillsV2Widget.routing.test.tsx`; legacy tests render it directly through `SkillLibraryWidget.test-helpers.tsx`. | Remove only after direct legacy render tests/dev fallback imports are retired and no public compatibility dependency remains. |
| `SkillLibraryDocumentsPanel` | transitional required until flow migration | Production import from `KnowledgeSkillsV2Widget`; exposes the imperative handles used for New, Import, Draft Review, and Manage Skills. | Migrate those flows into `workbench/knowledge/*` before considering deletion. |
| `SkillLibrarySkillsPanel` | transitional required until flow migration | Rendered by `SkillLibraryCatalogUtilityPanels` for Manage Skills and imported skill drafts. | Replace with active Knowledge skill-management flow first. |
| `SkillLibraryDraftReviewPanel` | transitional required until flow migration | Rendered by `SkillLibraryCatalogUtilityPanels`; backed by `useSkillLibraryDraftReview`. | Replace with active Knowledge draft-review flow after preserving ledger semantics. |
| `SkillLibraryDocumentImportControls` | transitional required until flow migration | Rendered by `SkillLibraryCatalogUtilityPanels`; backed by `useSkillLibraryDocumentImport`. | Replace with active Knowledge import flow while preserving explicit single-file constraints. |
| `SkillLibraryCatalogDetailPane` | transitional required | Rendered by `SkillLibraryDocumentsPanel`; depends on `SkillLibraryCatalogPreview`. | Removable only after the legacy panel is no longer rendered. |
| `SkillLibraryCatalogListView` | transitional required | Rendered by `SkillLibraryDocumentsPanel`; still owns legacy catalog list controls inside the flow shell. | Removable only after the legacy panel is no longer rendered. |
| `SkillLibraryCatalogPreview` | transitional required | Used by legacy detail and utility panels for document preview/editor pieces. | Extract any still-needed editor/preview pieces into neutral Knowledge modules before deletion. |
| `SkillLibraryCatalogUtilityPanels` | transitional required | Rendered by `SkillLibraryDocumentsPanel`; dispatches New, Import, Draft Review, and Skills panels. | Remove only after every utility flow has migrated. |
| `useSkillLibraryCatalogAttachments` | transitional required | Called by `SkillLibraryDocumentsPanel`; bridges legacy selected items to Workspace Agent and Queue context callbacks. | Remove after active Knowledge context attach fully covers legacy parity and legacy panel is gone. |
| `useSkillLibraryDocumentImport` | transitional required | Called by `SkillLibraryDocumentsPanel`; owns explicit import state and file-read handling. | Replace with active Knowledge import module first. |
| `useSkillLibraryDraftReview` | transitional required | Called by `SkillLibraryDocumentsPanel`; calls shared `acceptKnowledgeDraftItem` and ledger callbacks. | Replace with active Knowledge draft-review module first. |
| `useSkillLibrarySkillPanelActions` | transitional required | Called by `SkillLibraryDocumentsPanel`; coordinates Manage Skills startup and imported skill drafts. | Remove after skill management is active Knowledge-owned. |
| `skillLibraryModel` | active/transitional required | Used throughout legacy code; root facade is still imported by `notes/NotesEditor.tsx` and `knowledgeDocumentQuickSummaryWarning.ts`; active `knowledgeContextAffordances` imports legacy context text helpers. | Split neutral document options, draft types, catalog helpers, and context-text helpers into `workbench/knowledge/model` before facade removal. |
| `skillLibraryModelRelations` | transitional required | Used by `skillLibraryModel` and legacy preview/editor code. | Remove only after relation helpers are neutralized or no longer needed. |
| `knowledgeDraftAcceptance` | active required | Imported by `useSkillLibraryDraftReview`, `queue/details/AgentQueueKnowledgeDraftReview`, and focused tests. | Keep. Later move its dependency on legacy panel helpers into neutral draft-review helpers. |
| `knowledge/context/knowledgeContextAffordances` | active required | Imported by active Knowledge catalog/context picker/status/preview components and by the old KnowledgeV2 compatibility wrapper. | Keep. Later remove legacy model dependency after neutral context helpers exist. |
| `widgetV2/knowledgeV2/*` compatibility exports | compatibility required | Tests import `KnowledgeV2Widget`, catalog model aliases, context affordance aliases, and WidgetV2 smoke metadata still names `knowledge-v2`. | Remove only after explicit retirement of KnowledgeV2 compatibility tests/metadata and replacement imports. |

### Required Legacy Flow Status

| Flow | Current route | Coverage evidence | Migration status |
| --- | --- | --- | --- |
| New Knowledge Document | `KnowledgeWidget` New action -> `KnowledgeSkillsV2Widget` legacy flow `new` -> `SkillLibraryDocumentsPanel.startNewDocument` -> `CatalogDocumentEditor`. | `KnowledgeSkillsV2Widget.routing.test.tsx` proves the explicit route opens; `SkillLibraryWidget.test.tsx` covers legacy save/create behavior. | Migratable later as a focused active Knowledge editor block. |
| Import Knowledge Document | `KnowledgeWidget` Import action -> legacy flow `import` -> `SkillLibraryDocumentImportControls` and `useSkillLibraryDocumentImport`. | Routing tests prove reachability; legacy widget tests cover import behavior. | Migratable later, preserving explicit file selection, type, encoding, and size constraints. |
| Draft Review | `KnowledgeWidget` Draft Review action -> legacy flow `drafts` -> `SkillLibraryDraftReviewPanel` and `useSkillLibraryDraftReview`. | Routing tests prove reachability; `knowledgeDraftAcceptance.test.ts` covers acceptance helper behavior; Queue draft review uses the shared helper. | Migratable later after neutral draft-review helpers exist. |
| Manage Skills | `KnowledgeWidget` Manage Skills action -> legacy flow `skills` -> `SkillLibrarySkillsPanel`. | Routing tests prove reachability; legacy SkillLibrary tests cover skill CRUD and attach behavior. | Migratable later as an active Knowledge skill-management flow. |
| Use as Context / visible attach | Active `KnowledgeCatalogBrowser` -> `KnowledgeContextPicker` -> `knowledgeContextAffordances`; legacy panel also has attachment hooks. | Routing and KnowledgeV2 context tests cover active context UI; SkillLibrary workspace-agent/Queue attachment tests cover legacy parity. | Active path is already Knowledge-owned; legacy hook can go only with the legacy panel. |
| Queue context attach/use | Active Knowledge and legacy panel call `onAttachKnowledgeContextToQueueTask`, wired through widget props to Queue controller context APIs. | Queue context tests and Knowledge/SkillLibrary attachment tests cover the frontend path; backend materialization remains out of scope for this block. | Keep. No backend/storage changes in cleanup blocks unless separately requested. |
| Workspace Agent Knowledge context | Active visible context attach is explicit and bounded; Direct Work Knowledge lookup is in `workspaceAgentDirectWorkKnowledge`. | Workspace Agent Direct Work Knowledge tests cover bounded prompt materialization. | Keep visible-context-only boundaries. |

### Root Compatibility Facade Status

- Root component/hook facades are still compatibility exports. Most current
  imports are tests or compatibility assertions, but removing them would break
  existing focused coverage and any external in-repo imports not yet migrated.
- Root `skillLibraryModel` is not merely test compatibility: it is
  production-imported by Notes and quick-summary warning code.
- Imports can be migrated to explicit `knowledge/legacySkillLibrary/*` only as
  a cleanup step after deciding each caller should remain legacy-bound. For
  active Knowledge/Notes callers, migrate to neutral `workbench/knowledge/model`
  modules instead.
- A facade is removable later only with proof of zero production imports, zero
  compatibility test assertions, zero public export dependency, and no persisted
  widget or data identity dependency.

### Docs And Test Cleanup Candidates

- Keep for compatibility now:
  `KnowledgeSkillsV2Widget.routing.test.tsx`,
  `SkillLibraryWidget.*.test.tsx`,
  `SkillLibraryDocumentsPanel.helpers.test.ts`,
  `knowledgeDraftAcceptance.test.ts`, and
  `widgetV2/knowledgeV2/*` tests.
- Update in a later docs/status cleanup block: older docs that still describe
  root `SkillLibraryWidget` as the product host route or list pre-isolation file
  paths, including historical Knowledge V2 and Widget unification audits.
- Remove only after source deletion: tests whose sole purpose is proving direct
  legacy component behavior or old root facade equivalence.
- Stale/superseded: older notes that claim `SkillLibraryWidget` is the active
  `skill-library-widget` host component. The active host component is
  `KnowledgeSkillsV2Widget`.

### Dead Candidates

No requested legacy source item is a proven dead candidate in Block 005A. Each
item is currently covered by at least one production route, compatibility
export, active/shared helper dependency, focused test, or migration-dependent
feature flow.

Possible later deletion candidates after migration proof:

- Direct legacy `SkillLibraryWidget` wrapper and its root facade, after all
  direct legacy render coverage/fallback imports are intentionally retired.
- Legacy flow panels/hooks after New, Import, Draft Review, Manage Skills, and
  legacy attach parity are reimplemented under active Knowledge modules.
- Root component/hook facades after all imports/tests move to either active
  Knowledge modules or explicit legacy paths.
- Old `widgetV2/knowledgeV2/*` wrappers after explicit retirement of
  KnowledgeV2 compatibility imports, smoke metadata, CSS/test selectors, and
  tests.

### Unsafe Candidates / Architecture Risks

- `workspaceAgentKnowledgeCommands.ts` is active through
  `InteractiveAgentPlaceholderWidget` and tests, but it parses user prompt text
  with a regex command route. That conflicts with the cleanup rule that Hobit
  must parse only structured machine-readable action requests such as
  `hobit.action.request` envelopes. Do not broaden this path. Replace it with a
  typed action-request/capability flow in a later block before removing the
  command parser and its tests.
- `skillLibraryModel` is unsafe to classify as removable while active Knowledge
  context, Notes, quick-summary warning code, and legacy panels still depend on
  its types/constants/helpers.
- `knowledgeDraftAcceptance` is unsafe to classify as removable because Queue
  draft review depends on it independently of the legacy panel.

### Recommended Block 005B Plan

1. Extract neutral model helpers from `skillLibraryModel` into
   `workbench/knowledge/model` for document options, draft/source helpers,
   context text, catalog transforms, and relation helpers as needed.
2. Migrate active production callers away from root `skillLibraryModel` and
   away from legacy model imports where the caller is not itself legacy.
3. Move one legacy flow at a time into active Knowledge modules: New Document,
   Import, Draft Review, then Manage Skills. Preserve current explicit operator
   controls and tests for each flow before removing legacy code.
4. Split `knowledgeDraftAcceptance` away from
   `SkillLibraryDocumentsPanel.helpers` into neutral draft-review helpers.
5. Replace `workspaceAgentKnowledgeCommands` regex command routing with the
   structured `hobit.action.request` broker/capability path before deleting
   parser tests.
6. Re-run usage proof after each migration. Delete only files with no
   production imports, no compatibility/public exports, no persisted id
   dependency, no active test dependency, no backend/Tauri/storage dependency,
   and no feature-flow dependency.

### Block 005A Validation Evidence

- `npm.cmd run test -- --run Knowledge`: passed, 17 files / 119 tests.
- `npm.cmd run test -- --run SkillLibrary`: passed, 5 files / 25 tests.
- `npm.cmd run typecheck`: passed.
- Optional `npm.cmd run test -- --run`: passed, 203 files / 1705 tests.
- Optional `npm.cmd run build`: passed.
- Known validation warnings: Vitest/jsdom reported
  `HTMLCanvasElement's getContext()` as not implemented without the optional
  canvas package; Vite reported the existing large chunk size warning.
- `git diff --check`: passed; Git also reported the working-copy LF-to-CRLF
  normalization warning for this Markdown file.
- `git status --short --branch`: `## main...origin/main [ahead 43]` with only
  `docs/KNOWLEDGE_MODULE_CLEANUP_AUDIT.md` modified.
