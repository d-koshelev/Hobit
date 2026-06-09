# KnowledgeV2 Implementation Audit

## Status

Docs-only audit for `KNOWLEDGE-V2-IMPLEMENTATION-AUDIT-01`.

Recommended path: implement KnowledgeV2 as a frontend-only experimental
WidgetV2 / Workspace Module surface that reuses existing Knowledge / Skills
actions, frontend models, and current backend APIs. Do not replace the legacy
`skill-library` Knowledge / Skills widget yet. Do not add backend, Tauri,
storage, schema, indexing, provider, Queue runtime, or Workspace Agent behavior
in the first KnowledgeV2 block.

Target display level for the first implementation block: Minimal browsing
surface. Browsing, filtering, search, selection, and preview are primary.
Create/import/draft review/manage actions should be behind explicit actions,
popups, drawers, or side panels.

## Contract Baseline

Current authoritative behavior:

- `docs/CURRENT_WIDGET_SURFACE.md` defines Knowledge / Skills as Ready / MVP
  using the retained `skill-library` compatibility identity.
- `docs/KNOWLEDGE_SKILLS_EVIDENCE_CONTRACT.md` defines the current
  Knowledge Documents plus Skills boundary and explicitly excludes hidden
  memory, Evidence store, Context Packs, embeddings, folder scans, and
  automatic ingestion.
- `docs/KNOWLEDGE_CATALOG_CONTRACT.md` defines the future full Catalog model
  and records that current Knowledge Documents only have partial
  catalog-shaped fields.
- `docs/KNOWLEDGE_PRODUCTION_CONTRACT.md` defines production safety rules for
  lifecycle, enabled/searchable, source refs, versioning, draft review, and
  Queue context ownership.
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` defines current durable Queue
  task context attach/materialization semantics.

KnowledgeV2 must preserve current production behavior and should not claim that
the full Knowledge Catalog store, Evidence, Context Pack, graph runtime, vector
search, or team/server knowledge exists.

## Current Implementation Map

### Widget Surface

- `apps/desktop/frontend/src/workbench/SkillLibraryWidget.tsx`
  - Current widget shell for Knowledge / Skills.
  - Uses `WidgetFrame` and the compatibility `skill-library` identity through
    registry/host wiring.
  - Renders `SkillLibraryDocumentsPanel` as the active body.
  - The status popover already describes a unified catalog of Knowledge
    Documents plus Skill records, but the retained component names still say
    Skill Library for compatibility.

- `apps/desktop/frontend/src/workbench/SkillLibraryDocumentsPanel.tsx`
  - Current primary surface.
  - Loads Knowledge Documents and Skills, converts both into catalog list
    items, filters/searches them, and owns selected document/skill state.
  - Renders:
    - `SkillLibraryCatalogViewControls`
    - `SkillLibraryCatalogUtilityPanels`
    - `SkillLibraryCatalogListView`
    - `SkillLibraryCatalogDetailPane`
  - Also owns create/edit/delete, lifecycle changes, refresh Queue task
    creation, import, draft review, Skill editor startup routing, Workspace
    Agent attach, and Queue context attach.

- `apps/desktop/frontend/src/workbench/SkillLibraryCatalogListView.tsx`
  - Current unified list/filter/search surface.
  - Good reuse candidate for KnowledgeV2 browsing.

- `apps/desktop/frontend/src/workbench/SkillLibraryCatalogDetailPane.tsx`
  - Current preview/detail surface for selected Knowledge Documents and Skills.
  - Good reuse candidate after separating primary preview actions from
    management actions.

- `apps/desktop/frontend/src/workbench/SkillLibraryCatalogUtilityPanels.tsx`
  - Current mixed utility area for document editor, import controls, draft
    review, Skill editor, and related actions.
  - This is the main UI area to de-emphasize or move behind explicit
    KnowledgeV2 actions.

- `apps/desktop/frontend/src/workbench/SkillLibrarySkillsPanel.tsx`
  - Current Skill CRUD/editor surface.
  - It can run embedded in catalog editor mode, but KnowledgeV2 should expose
    it only from an explicit create/edit Skill action.

- `apps/desktop/frontend/src/workbench/SkillLibraryDraftReviewPanel.tsx`
  - Current draft review UI.
  - It should move behind an explicit "Review drafts" action/popup/side panel
    in KnowledgeV2, not remain part of primary browsing.

- `apps/desktop/frontend/src/workbench/SkillLibraryDocumentImportControls.tsx`
  - Current explicit import controls.
  - KnowledgeV2 should keep import explicit and secondary, not as primary list
    chrome.

### Frontend Models

- `apps/desktop/frontend/src/workbench/skillLibraryModel.ts`
  - Defines `KnowledgeCatalogView`, `KnowledgeCatalogListItem`,
    `KnowledgeDocumentDraft`, `SkillDraft`, catalog filter options, document
    type options, lifecycle options, and conversion from records to unified
    catalog items.
  - `knowledgeCatalogItemsFromRecords(documents, skills)` is the safest
    frontend adapter to reuse for KnowledgeV2.
  - `filterKnowledgeCatalogItems(items, view, query)` is the current
    frontend-only list filter/search helper.
  - `knowledgeDocumentWorkspaceAgentContextText` and
    `skillCoordinatorContextText` create visible bounded attachment text.

- `apps/desktop/frontend/src/workbench/skillLibraryModelRelations.ts`
  - Supplies current relation/full-content helpers for document and skill
    preview.

- `apps/desktop/frontend/src/workspace/types/knowledgeDocuments.ts`
  - Defines the current frontend Knowledge Document API/types:
    `KnowledgeDocument`, `CreateKnowledgeDocumentRequest`,
    `UpdateKnowledgeDocumentRequest`, `SearchKnowledgeDocumentsRequest`,
    `KnowledgeSourceRef`, `KnowledgeRelation`,
    `KnowledgeDraftReviewDecision`, lifecycle, source, version, and context
    snapshot vocabulary.

- `apps/desktop/frontend/src/workspace/types/skills.ts`
  - Defines current Skill CRUD types and review statuses:
    `draft`, `needs_review`, `reviewed`, `deprecated`.

### Frontend Actions And Hooks

- `apps/desktop/frontend/src/workbench/workspaceSkillWidgetActions.ts`
  - Aggregates widget actions for Skills, Knowledge Documents, document search,
    draft review ledger, and import file reads.
  - Adds the open Workspace id and guards with `requireOpenWorkbench`.
  - This is the safest action bundle for KnowledgeV2 reuse.

- `apps/desktop/frontend/src/workbench/widgetProps/knowledgeSkillsWidgetProps.ts`
  - Maps workbench actions into `WidgetRenderProps` for the current Knowledge /
    Skills surface.
  - KnowledgeV2 can use an equivalent prop builder without changing action
    definitions.

- `apps/desktop/frontend/src/workbench/useSkillLibraryCatalogAttachments.ts`
  - Current selected item attach flow for Workspace Agent and Queue tasks.
  - Enforces frontend safety blocks for disabled, non-searchable, rejected,
    archived, draft, and stale Knowledge Documents before attach.
  - Uses bounded visible snapshots for Workspace Agent and typed Queue attach
    action for Queue tasks.

- `apps/desktop/frontend/src/workbench/useSkillLibraryDocumentImport.ts`
  - Current explicit single-file `.txt`, `.md`, `.markdown` import flow.
  - Tauri desktop uses file picker plus import file API; browser/dev reads the
    selected file directly with a 1 MB cap.
  - Creates imported documents through the existing create document API and
    records structured `import_file` source refs and warnings.
  - Can also load imported content as an unsaved Skill draft for review.

- `apps/desktop/frontend/src/workbench/useSkillLibraryDraftReview.ts`
  - Current draft review flow.
  - Parses visible Queue result/fenced draft payload text, accepts drafts by
    creating Knowledge Documents or Skills through existing create APIs, and
    records accepted/rejected decisions through the draft review ledger when
    available.

- `apps/desktop/frontend/src/workbench/useSkillLibrarySkillPanelActions.ts`
  - Current routing helper for opening skill creation/import/select workflows
    from the catalog.

### Workspace APIs

- `apps/desktop/frontend/src/workspace/workspaceApiKnowledgeDocuments.ts`
  - Frontend facade for create/list/get/update/delete/search.

- `apps/desktop/frontend/src/workspace/workspaceApiKnowledgeDraftReview.ts`
  - Frontend facade for record/list draft review decisions.

- `apps/desktop/frontend/src/workspace/workspaceApiKnowledgeDocumentImport.ts`
  - Frontend facade for explicit Tauri-only local path import reads.

- `apps/desktop/frontend/src/workspace/workspaceApiSkills.ts`
  - Skill CRUD facade through the shared workspace API.

- `apps/desktop/frontend/src/workspace/tauriWorkspaceKnowledgeDocumentsApi.ts`
  - Tauri invoke adapter and DTO normalization for Knowledge Documents.
  - Preserves structured source refs/relations when supplied and falls back to
    legacy source fields.

- `apps/desktop/frontend/src/workspace/memoryWorkspaceKnowledgeDocumentsApi.ts`
  - Browser/Vite in-memory fallback for Knowledge Document CRUD/search.
  - Search only returns enabled, searchable, active documents and applies
    bounded lexical chunk scoring.

- `apps/desktop/frontend/src/workspace/tauriWorkspaceKnowledgeDraftReviewApi.ts`
  and `apps/desktop/frontend/src/workspace/memoryKnowledgeDraftReviewApi.ts`
  - Desktop and browser/dev draft review ledger adapters.

### Backend And Storage Files Inspected By Name

No backend code changes are recommended for this block, but the current
implementation exists in these areas:

- `crates/hobit-app/src/workspace_service/knowledge_documents.rs`
- `crates/hobit-app/src/workspace_service/knowledge_document_search.rs`
- `crates/hobit-app/src/workspace_service/knowledge_document_types.rs`
- `crates/hobit-app/src/workspace_service/knowledge_draft_review_ledger.rs`
- `crates/hobit-app/src/workspace_service/knowledge_draft_review_types.rs`
- `crates/hobit-app/src/workspace_service/skills.rs`
- `crates/hobit-app/src/workspace_service/agent_queue_context.rs`
- `crates/hobit-app/src/workspace_service/agent_queue_context/`
- `crates/hobit-storage-sqlite/src/store/knowledge_documents.rs`
- `crates/hobit-storage-sqlite/src/store/knowledge_search.rs`
- `crates/hobit-storage-sqlite/src/store/knowledge_draft_review_ledger.rs`
- `crates/hobit-storage-sqlite/src/store/skills.rs`
- `apps/desktop/src-tauri/src/knowledge_documents_commands.rs`
- `apps/desktop/src-tauri/src/knowledge_draft_review_commands.rs`
- `apps/desktop/src-tauri/src/knowledge_document_import_commands.rs`
- `apps/desktop/src-tauri/src/skills_commands.rs`
- `apps/desktop/src-tauri/src/agent_queue_task_commands.rs`

### Tests And Safety Coverage

Relevant frontend tests include:

- `SkillLibraryWidget.test.tsx`
- `SkillLibraryWidget.workspace-agent-attach.test.tsx`
- `SkillLibraryWidget.knowledge-attachments.test.tsx`
- `SkillLibraryWidget.runtime-context.test.tsx`
- `SkillLibraryDocumentsPanel.helpers.test.ts`
- `knowledgeDraftAcceptance.test.ts`
- `knowledgeDocumentQuickSummaryWarning.test.ts`
- `useSkillLibraryDraftReview` behavior covered through widget tests
- `agentQueueKnowledgeContext.test.ts`
- `workspaceAgentDirectWorkKnowledge.test.ts`
- `workspaceAgentKnowledgeCommands.test.ts`
- `memoryWorkspaceKnowledgeDocumentsApi.test.ts`
- `workspace/types/knowledgeDocuments.test.ts`

Relevant backend/storage/Tauri tests include Knowledge Document CRUD/search,
production fields, draft review ledger, import DTO/commands, skills, and Queue
context materialization tests under `crates/` and `apps/desktop/src-tauri/`.

## Existing API And Action Paths

### Create

- Knowledge Document manual create:
  - UI: `SkillLibraryDocumentsPanel.startNewDocument` and `saveDocument`
  - Action: `onCreateKnowledgeDocument`
  - Facade: `workspaceApiKnowledgeDocuments.createKnowledgeDocument`
  - Tauri command: `create_knowledge_document`
  - Browser/dev fallback: `memoryWorkspaceKnowledgeDocumentsApi.createKnowledgeDocument`

- Skill manual create:
  - UI: `SkillLibrarySkillsPanel.startNewSkill` and `saveSkill`
  - Action: `onCreateSkill`
  - Facade: `workspaceApiSkills.createSkill`
  - Tauri command: skill create command
  - Browser/dev fallback: memory Skill API

- Approved Workspace Agent catalog proposal create:
  - Current Workspace Agent proposal paths can create Knowledge Documents and
    Skills only from visible approved drafts plus a separate explicit create
    action.
  - KnowledgeV2 should not change these V1/V2 Workspace Agent paths.

- Draft review accept:
  - UI: `SkillLibraryDraftReviewPanel`
  - Hook: `useSkillLibraryDraftReview.acceptDraftItem`
  - Helper: `knowledgeDraftAcceptance.ts`
  - Actions: existing create document/create skill APIs
  - Ledger: `recordKnowledgeDraftReview`

### Read / Browse / Preview

- Documents:
  - `listKnowledgeDocuments`
  - `getKnowledgeDocument`
  - Current list is combined with skills using
    `knowledgeCatalogItemsFromRecords`.

- Skills:
  - `listSkills`
  - `getSkill`

- Preview:
  - Current `SkillLibraryCatalogDetailPane` displays selected item metadata,
    summary, lifecycle/review state, source/scope, and action availability.

### Search

- Frontend catalog filter/search:
  - `filterKnowledgeCatalogItems` searches the already-loaded unified list of
    document and skill catalog items.
  - This is the safest initial KnowledgeV2 browsing search because it requires
    no backend changes and covers both item kinds.

- Knowledge Document backend lexical search:
  - `searchKnowledgeDocuments`
  - Searches only Knowledge Documents, not Skills.
  - Existing dev fallback filters to enabled, searchable, active documents and
    bounded lexical chunks.
  - Workspace Agent Codex run retrieval uses enabled workspace-local and
    local-global Knowledge Documents only.

### Import

- UI/hook: `useSkillLibraryDocumentImport`.
- Desktop path import:
  - Tauri file picker selects one `.txt`, `.md`, or `.markdown` file.
  - `readKnowledgeDocumentImportFile` reads the selected path through Tauri.
- Browser/dev import:
  - Uses selected browser `File` text with a 1 MB cap.
- Imported document create:
  - Uses `onCreateKnowledgeDocument`.
  - Sets `catalogItemType: "documentation_knowledge"`,
    `lifecycleStatus: "active"`, `enabled: true`, source kind/ref
    `import_file`, and structured source refs/warnings.
- Skill import:
  - Loads imported file content as an unsaved Skill draft only; save remains
    explicit.

### Draft Review

- UI: `SkillLibraryDraftReviewPanel`.
- Parser/model: `knowledgeDraftPacks.ts`.
- Acceptance helper: `knowledgeDraftAcceptance.ts`.
- Hook: `useSkillLibraryDraftReview`.
- Ledger APIs:
  - `recordKnowledgeDraftReview`
  - `listKnowledgeDraftReviews`
- Current actions:
  - Accept creates a Knowledge Document or Skill through existing create APIs.
  - Reject records a ledger decision when available and marks local review
    state as rejected.
  - Ledger failures do not block the explicit create/reject local flow.

### Manage / Lifecycle

- Document edit/update/delete:
  - `saveDocument`, `updateSelectedDocumentLifecycle`,
    `deleteSelectedDocument`.
- Document lifecycle actions:
  - Mark stale: update lifecycle to `stale`.
  - Archive: update lifecycle to `archived`.
  - Restore: update lifecycle to `active`.
- Refresh task:
  - `createRefreshQueueTask` creates an Agent Queue task from source-backed
    documents through existing `onCreateAgentQueueTask`.
  - It does not mutate Knowledge and does not run analysis.
- Skill edit/update/delete:
  - `SkillLibrarySkillsPanel.saveSkill`, `deleteSelectedSkill`.

## Production Safety Behavior

### Lifecycle / Review State

- Knowledge Documents use lifecycle statuses:
  - `draft`
  - `active`
  - `stale`
  - `archived`
  - `rejected`
- Skills use review statuses:
  - `draft`
  - `needs_review`
  - `reviewed`
  - `deprecated`
- Current frontend maps Skill review statuses into catalog lifecycle states for
  unified list filtering:
  - `reviewed` -> `active`
  - `deprecated` -> `archived`
  - `draft` / `needs_review` -> `draft`

### Enabled / Searchable

- Knowledge Documents have `enabled` and optional `searchable`.
- Workspace Agent Codex retrieval searches only enabled documents.
- The in-memory search implementation additionally requires
  `searchable !== false` and `lifecycleStatus === "active"`.
- Queue and Workspace Agent manual attach blocks disabled, non-searchable,
  rejected, archived, and draft documents in the frontend. Stale documents
  require visible confirmation and warnings.

### Source Refs

- Knowledge Documents support legacy source fields:
  - `sourceLabel`
  - `sourceKind`
  - `sourceRef`
- They also support structured `sourceRefs` and `relations`.
- Tauri normalization preserves structured refs where present and falls back
  to legacy fields when absent.
- Import creates explicit `import_file` source refs with warnings.
- Draft acceptance can preserve Queue/task/run/source refs where supplied.
- Full provenance replay and separate Evidence storage are not implemented.

### Draft Review Ledger

- Current ledger records:
  - draft pack id
  - source fingerprint
  - source Queue item id
  - source run id
  - proposed item id/key
  - action
  - reviewed timestamp
  - accepted Knowledge Document id or Skill id
  - rejection reason
- Current frontend supports accepted/rejected local decisions and reads
  previous decisions for a loaded pack.
- Supported frontend action values are accepted, rejected, and
  edited-before-accept in the type layer. Full split/merge/blocked workflows
  remain future production work.

### Queue Durable Context Attach

- Current Queue context attach is typed and durable task-owned state through
  Knowledge/Skill attach APIs, not arbitrary context JSON mutation in normal
  product flow.
- `agentQueueKnowledgeContext.ts` defines frontend context refs, bounded
  snapshots, warnings, token estimates, and prompt materialization helpers.
- `docs/KNOWLEDGE_QUEUE_CONTEXT_CONTRACT.md` records that durable Queue-owned
  context is implemented, while separate immutable Evidence records and full
  warning acknowledgement policy remain future work.
- Attach does not start work, does not create Queue tasks, and does not grant
  tools.

## UI Issues To Avoid In KnowledgeV2

- Do not recreate competing Catalog vs Skills tabs. KnowledgeV2 should use one
  catalog where documents and skills are item kinds and filters.
- Do not spend primary vertical space on a large banner or explanation block.
  Use compact status/help affordances only.
- Do not mix draft review into the primary browse/list/preview surface.
  Draft review should open from an explicit "Review drafts" action.
- Do not make raw path import controls part of primary browsing UI.
  Import should be an explicit action and should keep file picker, supported
  extension, cap, and unsupported-runtime messaging.
- Do not mix create/import/editor controls into the list surface.
  Use an action bar plus side panel, popup, or drawer for create/edit/import.
- Do not imply full Catalog, graph, Evidence, Context Pack, vector search, or
  backend indexing exists.
- Do not expose raw content by default when a summary/preview is enough for
  browsing. Full content can remain in the detail/preview pane or explicit
  editor.
- Do not make disabled, rejected, archived, draft, or stale items appear
  equally attachable/use-ready in the browse surface.

## Recommended KnowledgeV2 Path

### One Safe Implementation Path

Implement KnowledgeV2 as an experimental WidgetV2 / Workspace Module frontend
surface, not as a replacement for the current Knowledge / Skills widget.

Use the existing actions/data model:

- Reuse `WorkspaceSkillWidgetActions` or a thin equivalent action adapter.
- Reuse `KnowledgeDocument` and `Skill` types.
- Reuse `knowledgeCatalogItemsFromRecords` for unified item construction.
- Reuse `filterKnowledgeCatalogItems` for initial frontend browsing/search.
- Reuse current `getKnowledgeDocument` and `getSkill` for selection preview.
- Reuse current attach hooks or extract their policy logic into small shared
  helpers before wiring KnowledgeV2 attach actions.
- Reuse current create/update/import/draft-review hooks behind secondary
  actions when needed.

Keep the first KnowledgeV2 block frontend-only:

- No backend changes.
- No Tauri command changes.
- No SQLite/schema changes.
- No search/indexing changes.
- No Workspace Agent behavior changes.
- No Queue runtime/materialization changes.
- No legacy widget removal.

### Minimal KnowledgeV2 Surface

Primary module layout:

- Compact top action row:
  - search input
  - item type filter
  - scope filter
  - lifecycle/review filter
  - explicit secondary actions: New, Import, Review drafts, Manage
- Main browse list:
  - one unified item list
  - documents and skills distinguished by compact type labels
  - scope, status, summary, tags, updated time
- Preview pane:
  - selected item title, kind/type, scope, lifecycle/review state, source,
    quick summary, bounded content/instruction preview, relations where present
  - explicit attach actions only when eligible
  - clear unavailable/blocked states for unsupported or unsafe actions

Secondary panels/popups:

- New/Edit Document
- New/Edit Skill
- Import Document / Skill Draft
- Draft Review
- Lifecycle management
- Source refs/relations details

### Migration Boundary

KnowledgeV2 should be a new experimental surface or module path that can sit
next to the current `skill-library` widget. It should not rename the
`skill-library` id, rewrite saved widgets, or remove current tests.

Do not make KnowledgeV2 the default Knowledge / Skills widget until a later
explicit replacement contract covers:

- saved widget compatibility;
- visual acceptance;
- smoke coverage;
- catalog insertion rules;
- test migration;
- legacy component retirement;
- no regression in Queue context attach;
- no regression in Workspace Agent visible attach and Codex retrieval.

## Risks And Follow-Ups

- The current code still has Skill Library naming in component/file names.
  KnowledgeV2 can reuse logic, but component extraction may need careful naming
  to avoid broad churn.
- Current frontend catalog search covers Skills and Documents but is
  client-side over loaded records. Backend `searchKnowledgeDocuments` searches
  Documents only. Do not advertise unified backend search until implemented.
- Current Knowledge Document `searchable` is not included in
  `KnowledgeDocumentDraft`; normal edit/save paths may preserve it only through
  helpers. Verify before any KnowledgeV2 management UI exposes searchable
  toggles.
- Draft review is useful but visually heavy. Moving it behind a secondary
  action should preserve ledger behavior and previous-decision loading.
- Queue context attach has both frontend helper behavior and durable backend
  semantics. Any extraction for KnowledgeV2 must preserve disabled/rejected
  blocking, stale confirmation, bounded snapshots, warnings, and no auto-run.
- Workspace Agent Codex retrieval currently searches enabled Knowledge
  Documents automatically before explicit Codex runs. KnowledgeV2 must not
  change that prompt boundary or imply Skills are auto-injected.
- Full Catalog item types differ slightly between docs/contracts and current
  frontend type unions, for example `architecture_decision` versus `decision`
  and current support for `prompt_template` / `investigation_summary`.
  Treat this as compatibility vocabulary, not as permission to add a new store.
- Current draft review frontend supports accepted/rejected flows; full
  edited/split/merged/blocked production workflows remain future.
- Manual smoke should cover desktop and browser/dev fallback because import
  behavior differs by runtime.

## Intentionally Not Implemented

- No source code changes.
- No tests changed.
- No backend, Rust, Tauri, storage, or SQLite/schema changes.
- No new indexing/search backend.
- No KnowledgeV2 widget implementation.
- No legacy Knowledge / Skills replacement.
- No Queue task creation or execution.
- No Workspace Agent V1/V2 behavior changes.
- No provider/tool/context behavior changes.
- No commit.
