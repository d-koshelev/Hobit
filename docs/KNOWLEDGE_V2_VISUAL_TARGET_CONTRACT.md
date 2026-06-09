# KnowledgeV2 Visual Target Contract

## Purpose

This document records the accepted KnowledgeV2 visual hardening target after
KnowledgeV2 Foundation Block 001.

It is a docs-only visual and product contract. It does not add frontend
behavior, backend behavior, Rust or Tauri commands, storage/schema changes,
indexing/search behavior, Workspace Agent behavior, Queue behavior, or a
replacement for the current Knowledge / Skills surface.

## Status

KnowledgeV2 remains an experimental future surface. The current production
Knowledge / Skills widget keeps the `skill-library` compatibility identity and
remains the active product surface until a separate replacement block
explicitly changes that.

This contract defines the target layout, visual decisions, catalog decisions,
context safety rules, and non-goals for future KnowledgeV2 UI hardening.

## Target Layout

KnowledgeV2 should render as a dark Hobit module surface focused on a dense,
unified catalog and selected-item review. The normal display level is
Operational: enough metadata and controls for real review work, without Full /
Expert administration or debug detail in the default view.

### Header And Actions Row

- The header is part of one continuous widget surface, not a detached block.
- The header identifies the surface as Knowledge and shows compact status or
  scope metadata only when useful.
- Primary actions are explicit: New, Import, Draft Review, and Manage Skills.
- Header actions open popup surfaces instead of expanding large forms inside
  the primary catalog layout.
- Header actions must not create, import, attach, accept, reject, run, or send
  anything by themselves.

### Search And Filter Row

- Search sits directly above the catalog list.
- Filters include item type, lifecycle/status, availability/usability, and
  scope where available.
- Documents, Skills, and Runbooks/Procedures are filters over one catalog, not
  competing primary tabs.
- Filter controls should remain compact and scannable. Advanced filtering,
  raw query syntax, graph views, and debug facets are out of scope for the
  default hardening target.

### Dense Catalog List

- The dense unified list is the default browsing mode.
- Each row should show title, item type, compact status, scope/source where
  available, short summary or preview text, tags/counts where useful, and
  relevant safety warnings.
- Selection updates the preview panel without changing context, creating
  tasks, or starting work.
- Cards may be added later as an optional presentation mode, but cards are not
  the default KnowledgeV2 hardening target.

### Preview Panel

- The selected item preview/details panel is the primary review surface.
- It shows bounded details for the selected catalog item: title, item type,
  status, scope, source/source refs, summary, preview text, tags, warnings,
  updated/review metadata where available, and explicit context-use controls.
- The preview panel must make unsupported, unavailable, stale, large, rejected,
  or draft behavior visible instead of hiding it.
- The preview panel must not render raw draft payloads or full large document
  bodies by default.

### Explicit Popups

- New, Import, Draft Review, and Manage Skills are explicit popup surfaces.
- Popups may be draggable and should remain visually subordinate to the owning
  KnowledgeV2 widget surface.
- Popups are opened by operator action and closed explicitly through visible
  controls or Escape.
- Popups may bridge to existing production flows when wired, but unavailable
  bridges must show honest unavailable/experimental state.
- Popups must not auto-create, auto-import, auto-accept, auto-reject,
  auto-attach, create Queue tasks, run Queue tasks, launch Agent Executor, or
  send Workspace Agent prompts.

## Visual Decisions

- Use the locked dark Hobit theme tokens for surfaces, text, borders, controls,
  and status treatment. Do not introduce raw one-off colors.
- Use the purple Knowledge accent only for selected state, primary Knowledge
  actions, and explicit context actions.
- Status colors should be restrained and semantic. They should support scanning
  without turning the list into a multicolor dashboard.
- The dense list view is the default. Optional cards may exist later only as a
  secondary view if they do not displace the list-first catalog workflow.
- Do not add a permanent right help rail or other persistent helper panel that
  consumes the primary layout. Help, unavailable details, and experimental
  explanations should be compact, contextual, or popup-based.
- Avoid a large marketing banner or explanatory hero inside the widget. The
  primary surface should start with controls, list, and preview.

## Catalog Decisions

- Documents are first-class catalog item types.
- Skills are first-class catalog item types.
- Runbook/Procedure should be represented as a document subtype unless the
  existing model already has a first-class supported type for it in the
  relevant implementation block.
- Documents, Skills, and Runbook/Procedure items share the same search,
  filter, selection, preview, and explicit context-use model.
- The catalog status vocabulary for this target is:
  - Published
  - Draft
  - Archived
  - Rejected
  - Stale
  - Large
  - Unavailable
- Statuses may be mapped from current lifecycle/review/availability fields in
  implementation, but this contract does not require storage or schema changes.
- Rejected draft content is not searchable, attachable, materialized, or
  treated as usable Knowledge.

## Context Safety Rules

- Every context attach must be explicit and target-based.
- The operator must choose the target, such as a visible Workspace Agent
  composer or a selected Queue task, before context is attached.
- Attach actions must show what will be attached at a bounded summary/snapshot
  level before or as part of the explicit action.
- Published and otherwise usable items can attach.
- Stale and Large items can attach only with visible warnings and bounded
  context behavior.
- Rejected and Unavailable items are disabled for attach.
- Draft items follow the active implementation policy. If Draft attach is
  allowed, it must show an explicit draft warning. If Draft attach is not
  allowed, the action must be visibly disabled with a clear reason.
- Archived items should not be treated as normal ready context. If an
  implementation allows attach, it must show a visible archived warning.
- Context attach must not auto-send a Workspace Agent message, auto-create a
  Queue task, auto-run Queue, launch Agent Executor, import files, accept
  drafts, or mutate Knowledge records.
- KnowledgeV2 must not perform hidden context injection, hidden widget reads,
  hidden Workspace reads, hidden file reads, or automatic provider prompt
  augmentation.

## Non-Goals

- No legacy Knowledge / Skills replacement in this block.
- No Widget Catalog insertion changes in this block.
- No backend, Rust, Tauri, storage, or SQLite schema changes.
- No indexing/search backend changes.
- No embeddings, vector database, folder scan, watcher, binary/PDF/DOCX
  parsing, Evidence store, Context Pack builder, team/server sharing, RBAC, or
  production Knowledge Catalog store.
- No hidden context injection.
- No automatic import, create, draft acceptance, draft rejection, context
  attach, Queue task creation, Queue run, Agent Executor launch, Workspace
  Agent send, or provider call.
- No Workspace Agent V1/V2 behavior changes.
- No QueueV2 behavior changes.
- No Runbook engine or procedure execution behavior.

## Implementation Notes For Future Blocks

- Future UI hardening should preserve KnowledgeV2 as an experimental surface
  until a separate acceptance and replacement block explicitly promotes it.
- The accepted shape is a list-first catalog with preview, not a tabbed
  document manager, hidden memory panel, runbook executor, or broad automation
  console.
- Unsupported behavior should be visible as unavailable or experimental rather
  than hidden or silently simulated.
