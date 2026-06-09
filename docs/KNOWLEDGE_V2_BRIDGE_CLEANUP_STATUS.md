# KnowledgeV2 Bridge Cleanup Status

## Purpose

This document records docs-only status after the KnowledgeV2 bridge completion
and UX cleanup block.

It is a status record only. It does not add frontend behavior, backend or Rust
behavior, Tauri commands, storage/schema changes, indexing/search behavior,
Workspace Agent behavior, Queue behavior, or Knowledge data changes.

## Status

Knowledge / Skills now opens KnowledgeV2 as the normal product-facing surface
through the saved-compatible `skill-library` identity. The bridge cleanup
completed the visible data bridge, compact partial-state handling, table and
preview polish, and per-action availability cleanup needed for normal
operator use.

Legacy Knowledge / Skills code remains retained as fallback/dev-only
compatibility and for unfinished replacement flows. KnowledgeV2 is the normal
Knowledge / Skills surface; the legacy raw layout is not the normal primary
operator experience.

## Cleanup Summary

### Bridge Audit

- Audited the KnowledgeV2 exposure path from Widget Catalog insertion through
  the saved-compatible `skill-library` widget identity.
- Confirmed the KnowledgeV2 surface can be the normal Knowledge / Skills
  surface without changing Knowledge backend, storage, Workspace Agent, Queue,
  or runtime behavior.
- Retained the legacy component as fallback/dev-only compatibility until
  import and replacement gaps are explicitly closed.

### Data Bridge Completion

- Catalog data now expects all available bridged Knowledge Documents and Skills
  to appear in the unified KnowledgeV2 catalog.
- Document and Skill bridge gaps are represented explicitly instead of being
  hidden or filled with fake data.
- Metadata cleanup keeps invalid or placeholder values out of normal display,
  including invalid update/status labels.

### Compact Partial-State UX

- Partial bridge state is compact and explicit.
- Normal partial availability no longer consumes the primary screen with a
  giant banner.
- Blocking or unavailable states may still use prominent messaging when the
  operator cannot browse or act safely.

### Table And Preview Polish

- The catalog table is expected to remain usable at normal widget width without
  horizontal scroll.
- Dense catalog browsing remains the primary layout, with selected-item preview
  details adjacent to the list.
- Preview content should show honest summaries, source/status details,
  warnings, and unavailable states without raw debug-first layout.

### Per-Action Availability Cleanup

- New, Import, Draft Review, Manage Skills, and Use as Context expose action
  availability per bridge/callback.
- Unavailable actions stay disabled or explain their unavailable state rather
  than pretending success.
- Use as Context remains explicit and target-based; it opens a picker before
  attaching to a visible Workspace Agent or Queue target.

## Expected Product Behavior

- Add Widget -> Knowledge / Skills opens KnowledgeV2.
- The KnowledgeV2 catalog shows all available bridged Knowledge Documents and
  Skills.
- Bridge gaps are compact and explicit.
- Normal partial bridge state does not show a giant partial-state banner.
- Blocking bridge failures can still show prominent messaging when browsing or
  action safety is affected.
- The catalog table does not require horizontal scrolling at normal widget
  width.
- Selected-item preview remains readable and bounded.
- Invalid metadata is cleaned up; normal UI should not show labels such as
  `Updated Invalid`.
- Action states reflect actual bridge availability.
- Use as Context opens the target picker and does not attach, send, create
  Queue tasks, or run anything by itself.

## Manual Smoke Checklist

- Open the Widget Catalog and add Knowledge / Skills.
- Verify Knowledge / Skills opens the KnowledgeV2 surface, not the legacy raw
  layout.
- Verify the catalog is dense and readable.
- Verify available Knowledge Documents appear in the catalog.
- Verify available Skills appear in the catalog.
- Verify partial bridge details are compact and explicit.
- Verify there is no giant partial-state banner during normal partial
  availability.
- Verify a prominent banner appears only for blocking or unsafe unavailable
  states.
- Verify the catalog table has no horizontal scroll at normal widget width.
- Select documents and skills and verify the preview updates with bounded,
  readable details.
- Verify no item shows invalid placeholder metadata such as `Updated Invalid`.
- Verify New, Import, Draft Review, Manage Skills, and Use as Context show
  enabled, disabled, or unavailable states that match their bridge
  availability.
- Open Use as Context and verify the target picker appears before attach.
- Verify no hidden attach, prompt send, Queue task creation, Queue run, Agent
  Executor launch, import, draft accept/reject, or Knowledge mutation happens
  without an explicit operator action.

## Remaining Gaps

- Any unavailable bridge remains an explicit unavailable state until it is
  wired and accepted.
- Direct KnowledgeV2 file picker import polish remains a follow-up and must
  preserve the current explicit single-file plain text/Markdown import
  boundary.
- Legacy Knowledge / Skills code should remain fallback/dev-only compatibility
  until manual smoke, import replacement, draft/manage parity, regression
  coverage, and deletion readiness are complete.

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
- No automatic import, creation, attach, Queue run, prompt send, or hidden
  context behavior.
- No deletion of legacy Knowledge / Skills code.
