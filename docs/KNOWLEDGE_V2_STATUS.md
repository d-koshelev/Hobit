# KnowledgeV2 Status

## Purpose

This document records the docs-only status after KnowledgeV2 Foundation Block
001.

It is a status record only. It does not add frontend behavior, backend or Rust
behavior, Tauri commands, storage/schema changes, indexing/search behavior,
Queue runtime behavior, Workspace Agent behavior, or production Knowledge /
Skills replacement.

## Status

KnowledgeV2 now has an experimental frontend foundation for a future Knowledge
Catalog v2 surface. It remains separate from the current production
Knowledge / Skills widget, which keeps the `skill-library` compatibility
identity and remains the current product surface.

KnowledgeV2 is not an available product widget in the normal widget catalog.
It is an experimental V2 surface used to prove the catalog browsing, preview,
explicit-action, and safe-context affordance model before replacement work.

## Implemented In Foundation Block 001

### Implementation Audit

- Added `docs/KNOWLEDGE_V2_IMPLEMENTATION_AUDIT.md`.
- Audited current Knowledge / Skills implementation, frontend models, action
  hooks, workspace APIs, storage/backend paths by name, safety coverage, and
  risks.
- Chose a frontend-only experimental KnowledgeV2 path that reuses existing
  Knowledge Document and Skill models/actions without replacing production
  behavior.

### KnowledgeV2 Manifest And Shell

- Added a `KnowledgeV2` manifest under the Widget V2 registry with
  `knowledge-v2` kind, experimental status, minimal layout, and explicit
  safety boundaries.
- Kept `knowledge-v2` out of available V2 manifests and out of the V1 widget
  registry.
- Preserved the existing `skill-library` Knowledge / Skills widget identity.
- Added a KnowledgeV2 shell using the Widget V2 surface vocabulary instead of
  changing `WidgetHost`, `WorkbenchCanvas`, or persisted widget ids.

### Unified Catalog Model

- Added a unified frontend catalog model for Knowledge Documents and Skills.
- Treats documents and skills as catalog item types and filters, not as
  competing primary tabs.
- Normalizes item metadata including kind, type, lifecycle/review state, scope,
  source, refs, summary/preview text, tags, timestamps, and warnings.
- Supports frontend-only search, type filtering, lifecycle filtering, and
  availability filtering over the loaded records.

### Catalog Browser And Preview

- Added a primary KnowledgeV2 browser that renders documents and skills
  together.
- Added search/filter/select behavior and a selected-item preview panel.
- Preview shows bounded item information such as title, type/kind, scope,
  lifecycle/review state, source metadata, source refs, summary, preview text,
  warnings, and explicit context-use controls.
- The primary surface does not show a large banner and does not expose raw
  draft payloads as browsing content.

### Action Popups

- Added explicit action buttons for New Knowledge, Import file, Draft Review,
  and Manage Skills.
- Actions open popup surfaces instead of placing create/import/draft/manage
  forms in the primary browse/list/preview flow.
- Popups are draggable and close through explicit Close and Escape behavior.
- Existing flow callbacks are invoked only from explicit popup actions such as
  Open existing create flow, Open existing import flow, Open existing draft
  review flow, and Open existing skills flow.

### Data Integration

- KnowledgeV2 can load Knowledge Documents and Skills through existing list
  actions when bridges are provided.
- When the experimental path has no data bridge, it shows an honest
  unavailable state and does not fake production data.
- Draft review summaries can be shown inside the Draft Review popup through
  existing draft review data when supplied.
- No backend, Tauri, storage, schema, or indexing changes were added for
  KnowledgeV2 data integration.

### Safe Context And Use Affordances

- Added explicit context-use controls in the preview for eligible selected
  items.
- Workspace Agent attach uses only an explicit visible callback and visible
  bounded context text.
- Queue context attach uses only the explicit selected-task attach callback.
- Disabled, non-searchable, rejected, archived, draft, stale, and unreviewed
  items show visible unavailable or warning states instead of pretending they
  are ready for context use.
- Context attach does not create Queue tasks, run Queue tasks, start Agent
  Executor, or send prompts automatically.

## Product Decisions Recorded

- KnowledgeV2 uses one unified catalog; Knowledge Documents and Skills are item
  types and filters.
- Browsing, search, filtering, selection, and preview are the primary
  KnowledgeV2 surface.
- Create, import, draft review, and Skill management belong behind explicit
  popups/actions.
- The primary catalog surface should not spend space on a large explanatory
  banner.
- Draft payloads and raw draft contents do not belong in the primary browsing
  surface.

## Safety Boundary

- No hidden context injection.
- No automatic Knowledge import, document creation, Skill creation, draft
  acceptance, or run action.
- No Queue runtime changes.
- No Queue task auto-create or auto-run behavior.
- No Agent Executor launch.
- No Workspace Agent V1 or V2 runtime behavior changes.
- No backend, Tauri, Rust, storage, or SQLite schema changes.
- No new indexing, vector search, embeddings, folder scans, watchers,
  Evidence store, Context Pack builder, team/server sharing, or RBAC.
- No replacement of the current production Knowledge / Skills surface.

## Current Limitations

- KnowledgeV2 remains experimental and is not the production Knowledge / Skills
  widget.
- The action bridge is partial and callback-driven. If a bridge is unavailable,
  the UI reports unavailable behavior instead of faking success.
- The Import popup does not wire a file picker or raw path import form in the
  KnowledgeV2 shell. The existing production Knowledge / Skills import flow is
  still the available import path.
- Draft Review in KnowledgeV2 is a summarized popup surface; production polish
  for draft review details and edit-before-accept workflows remains future
  work.
- Source refs are previewed at a bounded summary/detail level. Deeper source
  reference replay and provenance inspection remain future work.
- Legacy Knowledge / Skills has not been replaced. Saved widgets, catalog
  insertion, current Workspace Agent retrieval, Queue context materialization,
  and production backend behavior remain owned by the existing surface.

## Manual Smoke Checklist

- Open the KnowledgeV2 experimental surface.
- Verify one unified catalog shows both Knowledge Documents and Skills when
  list bridges are provided.
- Search, filter by type/status/availability, select items, and verify the
  preview updates.
- Open New Knowledge, Import file, Draft Review, and Manage Skills popups.
- Verify the popups are draggable and can close through Close and Escape.
- Verify disabled, rejected, stale, draft, non-searchable, or unreviewed items
  show blocked/unavailable warnings for context use.
- Verify unavailable data or action bridges show explicit unavailable states.
- Verify no hidden context attach, Queue task creation, Queue run, Agent
  Executor launch, import, draft acceptance, or Workspace Agent send occurs
  without an explicit operator action.

## Recommended Next Blocks

- Replace the legacy Knowledge / Skills surface with KnowledgeV2 only after
  separate stable-surface acceptance, saved-widget compatibility, catalog
  insertion, and regression coverage are ready.
- Replace the KnowledgeV2 import placeholder with a production file-picker
  import bridge that preserves current single-file, supported-extension,
  capped-read, and unsupported-runtime behavior.
- Polish draft review for production use, including clearer accepted/rejected
  history, edit-before-accept flows, and bounded details.
- Add deeper source-ref preview and provenance inspection without adding an
  Evidence store or graph runtime implicitly.
- Harden Workspace Agent context attach bridging so KnowledgeV2 uses the same
  explicit visible-context boundary as production Knowledge / Skills.

## Intentionally Not Implemented

- No source code changes in this docs-only status block.
- No tests changed in this docs-only status block.
- No backend/Rust/Tauri/storage/schema changes.
- No new search/indexing backend.
- No auto-create, auto-import, auto-run, auto-attach, or hidden context
  behavior.
- No legacy Knowledge / Skills replacement.
