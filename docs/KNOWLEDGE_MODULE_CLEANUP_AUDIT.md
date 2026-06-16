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
