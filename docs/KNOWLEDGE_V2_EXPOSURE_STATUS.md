# KnowledgeV2 Exposure Status

## Purpose

This document records docs-only status after routing the user-facing
Knowledge / Skills product surface to KnowledgeV2.

It is a status record only. It does not add frontend behavior, backend or Rust
behavior, Tauri commands, storage/schema changes, indexing/search behavior,
Workspace Agent behavior, Queue behavior, or Knowledge data changes.

## Status

Knowledge / Skills now opens the KnowledgeV2 visual surface through the
saved-compatible `skill-library` widget identity. The product-facing Widget
Catalog card remains Knowledge / Skills, and normal widget insertion routes to
the KnowledgeV2 catalog layout rather than the old raw legacy layout.

The audit result is that KnowledgeV2 can be exposed as the normal visual
surface without changing Knowledge production backend behavior. Existing
Knowledge Documents, Skills, draft review data, Workspace Agent context attach,
and Queue context attach continue to use the existing Knowledge / Skills
frontend action bridge and workspace APIs.

## Exposure And Routing Summary

### Audit Result

- KnowledgeV2 has a dense unified catalog, selected-item preview tabs/details,
  explicit action popups, and target-based Use as Context behavior.
- The route can reuse existing Knowledge Documents, Skills, draft review, and
  context attach bridges.
- The exposure is visual/routing only. It does not create a new widget id,
  rewrite saved widgets, change Knowledge records, or add backend behavior.

### Catalog And Registry Routing Fix

- Add Widget -> Knowledge / Skills keeps the `skill-library` id and
  Knowledge / Skills catalog title.
- `skill-library` still resolves to the saved-compatible
  `skill-library-widget` component key.
- The normal host mapping for that component renders `KnowledgeSkillsV2Widget`,
  which wraps the KnowledgeV2 surface.
- The normal Widget Catalog does not expose a separate Legacy Knowledge /
  Skills card.

### Props And Action Bridge

- KnowledgeV2 receives the existing list bridges for Knowledge Documents,
  Skills, and draft review summaries.
- KnowledgeV2 receives explicit Workspace Agent and Queue context attach
  callbacks for Use as Context.
- New, Import, Draft Review, and Manage Skills open KnowledgeV2 popups first;
  explicit popup actions can hand off into retained existing Knowledge /
  Skills flows where those flows are still needed.
- Normal KnowledgeV2 render lists data only and does not create documents,
  create skills, import files, accept drafts, create Queue tasks, update
  records, or delete records.

### Legacy Containment

- The old Knowledge / Skills component remains directly renderable as
  compatibility/fallback code.
- The old raw full-content-first layout is not the normal primary surface.
- Legacy flows are reachable only through explicit KnowledgeV2 popup handoff
  actions, then shown as a compatibility surface.
- Legacy code is retained for existing create/import/draft/manage flows and
  fallback/dev compatibility; it has not been deleted or fully replaced.

## Expected Product Behavior

- Add Widget -> Knowledge / Skills opens the KnowledgeV2 visual surface.
- The header/layout should show the Knowledge / Skills widget frame with a
  Knowledge Catalog body, dense catalog list, and selected-item preview.
- The old inline raw full-content-first preview layout is not the normal
  primary surface.
- Existing Knowledge Documents and Skills remain visible when the existing
  list bridges return data.
- Legacy Knowledge / Skills code remains retained as compatibility/fallback
  where applicable.
- No backend, Rust, Tauri, storage, SQLite schema, Knowledge data, Queue
  runtime, Workspace Agent runtime, or indexing/search changes are part of
  this exposure.

## Manual Smoke Checklist

- Open the Widget Catalog.
- Add Knowledge / Skills.
- Verify the KnowledgeV2 header/layout appears with the Knowledge Catalog
  body, dense catalog list, and selected-item preview tabs/details.
- Verify New opens a popup.
- Verify Import opens a popup.
- Verify Draft Review opens a popup.
- Verify Manage opens a popup.
- Verify Use as Context opens the target picker before attach.
- Verify there is no old inline raw full-content-first preview layout in the
  normal primary surface.
- Verify existing Knowledge Documents and Skills are still visible.

## Remaining Gaps And Follow-Ups

- Action bridges remain callback-driven. Any unavailable bridge must continue
  to show honest unavailable behavior instead of fake success.
- KnowledgeV2 import still depends on the retained existing import flow for
  actual file picking/import behavior; direct KnowledgeV2 file picker polish
  remains a follow-up.
- Full legacy replacement remains a pending decision. The retained legacy code
  should stay until manual smoke, compatibility review, regression coverage,
  and import/draft/manage replacement acceptance prove deletion is safe.

## Safety Record

- No hidden context injection.
- No automatic create, import, draft accept/reject, attach, prompt send, Queue
  task creation, Queue run, or Agent Executor launch.
- No backend, Rust, Tauri, storage, SQLite schema, or Knowledge data changes.
- No production Knowledge backend behavior changes.

## Intentionally Not Implemented

- No source code changes in this docs-only status block.
- No tests changed in this docs-only status block.
- No backend/Rust/Tauri/storage/schema changes.
- No new Knowledge storage or data model.
- No automatic import, creation, attach, Queue run, or hidden context behavior.
- No deletion of legacy Knowledge / Skills code.
