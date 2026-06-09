# KnowledgeV2 Visual Hardening Status

## Purpose

This document records docs-only status after KnowledgeV2 Visual Hardening
Block 001.

It is a status record only. It does not add frontend behavior, backend or Rust
behavior, Tauri commands, storage/schema changes, indexing/search behavior,
Workspace Agent behavior, Queue behavior, or replacement of the current
Knowledge / Skills surface.

## Status

KnowledgeV2 visual hardening completed the experimental list-first catalog
surface target for manual smoke review. KnowledgeV2 remains separate from the
current production Knowledge / Skills widget, which keeps the `skill-library`
compatibility identity and remains the active product surface.

The replacement decision is not made in this block. Legacy Knowledge / Skills
must remain in place until KnowledgeV2 manual smoke, compatibility review, and
replacement acceptance pass in a separate block.

## Completed In Visual Hardening Block 001

### Visual Target Contract

- Recorded the accepted visual/product target in
  `docs/KNOWLEDGE_V2_VISUAL_TARGET_CONTRACT.md`.
- Set the target display level to Operational: a dense working catalog with
  enough metadata for real review, without Full / Expert administration or raw
  debug detail by default.
- Preserved the dark Hobit module surface direction, locked theme-token usage,
  compact controls, restrained status treatment, and no large banner or helper
  rail.

### Dense Catalog Layout

- Hardened the primary KnowledgeV2 screen around a dense unified catalog list
  plus selected-item preview.
- Made the list view the default browsing mode.
- Kept Documents and Skills as item types and filters in one catalog rather
  than competing primary tabs.
- Kept optional card presentation secondary where available; cards do not
  replace the list-first workflow.

### Preview Tabs And Details

- Hardened selected-item preview/details as the primary review surface.
- Preview supports bounded details such as item type, status, scope, source
  metadata, source refs, summary/preview text, tags, warnings, and review or
  update metadata where available.
- Preview states expose unsupported, unavailable, stale, large, draft, archived,
  or rejected behavior visibly instead of treating all items as ready context.

### Action Popups

- New Knowledge, Import file, Draft Review, and Manage Skills remain explicit
  operator actions.
- Actions open draggable popup surfaces instead of persistent helper panels or
  embedded large forms in the primary catalog layout.
- Popups close through explicit controls and do not create, import, accept,
  reject, attach, send, create Queue tasks, run Queue tasks, or launch Agent
  Executor by opening alone.
- Unavailable or partial bridges are shown as unavailable/experimental rather
  than silently simulated.

### Use As Context Picker

- Context use is target-based and explicit.
- The operator must choose an available target, such as a visible Workspace
  Agent composer or selected Queue task, before attaching context.
- Context attach uses bounded visible item summaries/snapshots and warning
  states for draft, stale, archived, or large items.
- Rejected and unavailable items are blocked for attach.
- Attach does not auto-send prompts, create Queue tasks, run Queue, launch
  Agent Executor, import files, accept drafts, or mutate Knowledge records.

### Lifecycle, Empty, And Unavailable State Polish

- Empty catalog and unavailable data/action bridge states are explicit.
- Disabled, rejected, stale, large, archived, draft, non-searchable, or
  unreviewed items surface visible warnings or disabled reasons.
- The experimental surface does not fake data, action success, import
  behavior, or attach availability when a bridge is missing.

## Product Decisions

- Primary screen is Catalog + Preview.
- Actions are explicit draggable popups.
- Dense list view is the default.
- Cards are optional and secondary.
- No persistent helper rail should consume the primary layout.
- No legacy Knowledge / Skills replacement yet.

## Safety Record

- No hidden context injection.
- No automatic context attach or prompt send.
- No automatic import, document creation, Skill creation, draft acceptance, or
  draft rejection.
- No automatic Queue task creation.
- No Queue run or Agent Executor launch.
- No backend, Rust, Tauri, storage, or SQLite schema changes.
- No indexing/search backend changes.
- No Workspace Agent V1/V2 behavior changes.
- No QueueV2 behavior changes.

## Manual Smoke Checklist

- Open the KnowledgeV2 experimental surface.
- Verify the dense unified list is the default view.
- Search, filter, sort where available, select an item, and verify the preview
  updates.
- Switch between cards and list if the view toggle is available.
- Open, drag, and close New Knowledge, Import file, Draft Review, and Manage
  Skills popups.
- Open Use as Context, choose each available target type, and verify target
  selection is explicit before attach.
- Verify disabled, rejected, stale, large, archived, draft, non-searchable,
  unreviewed, empty, and unavailable bridge states show visible reasons or
  warnings.
- Verify no hidden attach, Workspace Agent send, Queue task creation, Queue
  run, Agent Executor launch, import, draft accept/reject, or Knowledge record
  mutation occurs without an explicit operator action.

## Remaining Gaps

- Data and action bridges are still partial and callback-driven; unavailable
  bridges must remain explicit until production wiring is complete.
- Import file picker polish remains future work for KnowledgeV2 and must
  preserve the current single-file, supported-extension, capped-read, and
  unsupported-runtime boundaries.
- Draft Review needs production polish for review history, bounded details,
  edit-before-accept, and accepted/rejected state clarity.
- Legacy Knowledge / Skills replacement must wait until manual smoke passes
  and a separate replacement block handles saved-widget compatibility, catalog
  behavior, regression coverage, and current production retrieval/context
  behavior.

## Recommended Next Block

Run the manual smoke checklist against the KnowledgeV2 experimental surface.
Only after smoke passes should a separate replacement-readiness block decide
whether KnowledgeV2 can replace the legacy Knowledge / Skills visual surface.

## Intentionally Not Implemented

- No source code changes in this docs-only status block.
- No tests changed in this docs-only status block.
- No frontend behavior changes.
- No backend/Rust/Tauri/storage/schema changes.
- No new indexing/search backend.
- No auto-create, auto-import, auto-attach, auto-run, auto-send, or hidden
  context behavior.
- No legacy Knowledge / Skills replacement.
