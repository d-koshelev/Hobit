# KnowledgeV2 Surface Polish Status

## Purpose

This document records docs-only status after the KnowledgeV2 final surface
polish completed after manual screenshot review.

It is a status record only. It does not add frontend behavior, backend or Rust
behavior, Tauri commands, storage/schema changes, indexing/search behavior,
Workspace Agent behavior, Queue behavior, automatic import/create/attach/run
behavior, hidden context injection, or Knowledge data changes.

KnowledgeV2 remains the normal Knowledge / Skills surface through the
saved-compatible `skill-library` identity. This status does not route
Knowledge / Skills back to the legacy surface.

## Status

KnowledgeV2 final surface polish is recorded as complete for the visible
product surface. The completed polish focused on table row/action readability,
preview Overview hierarchy, compact status and warning presentation, and small
catalog/responsive layout refinements.

Manual smoke remains the acceptance path for this status record.

## Polish Summary

### Table Row And Action Polish

- Table row actions are expected to remain visually separated and readable at
  normal widget width.
- Row action text should not collapse into broken combined labels such as
  `Use2w`.
- Warning counts should remain distinct from primary row actions.
- Secondary metadata should stay compact so the catalog can be scanned without
  horizontal scroll at normal width.

### Preview Overview Cleanup

- Overview should show clean product copy instead of raw document source.
- Imported code or reference documents without a supplied summary should use a
  product-friendly missing-summary fallback.
- Raw source or bounded original content should remain available only through
  Details/full view, not as the default Overview copy.

### Compact Warnings And Status

- Status and warning state should be compact by default.
- Full warning messages and detailed reasons should remain available through
  the deeper details surface.
- Use as Context should still show honest unavailable or warning states before
  any explicit attach action.

### Catalog And Responsive Layout Polish

- The catalog should preserve the KnowledgeV2 dense browse plus preview model.
- Empty, unavailable, and bridge-limited states should use normal Knowledge /
  Skills product language rather than legacy-route or experimental-route copy.
- Responsive layout should avoid normal-width horizontal scroll and keep row
  actions, status, and preview content readable.

## Expected Product Behavior

- Add Widget -> Knowledge / Skills opens KnowledgeV2 through the retained
  `skill-library` identity.
- No broken table action text such as `Use2w` appears.
- Overview does not show raw code/source dumps.
- Missing summaries use product-friendly fallback copy rather than raw source.
- Raw source remains visible in Details/full view.
- Warnings are compact by default but available for review.
- Use as Context exposes available, disabled, warning, or unavailable states
  honestly and does not attach without explicit operator action.
- The old legacy Knowledge / Skills route is not the normal product surface.

## Manual Smoke Checklist

- Open Knowledge / Skills from the Widget Catalog.
- Verify the KnowledgeV2 surface opens as the normal Knowledge / Skills
  surface.
- Inspect catalog table rows and row actions.
- Verify row actions and warning counts do not visually collapse into broken
  text such as `Use2w`.
- Select an imported code or reference document.
- Verify Overview is clean and does not show a raw code/source dump.
- Verify missing summary fallback copy is product-friendly.
- Verify Details/full view exposes source/raw preview where applicable.
- Verify Use as Context states, including enabled, disabled, warning, and
  unavailable cases where the current bridge data supports them.
- Verify warnings are compact by default but available for review.
- Verify there is no horizontal scroll at normal widget width.
- Verify there is no normal route back to the legacy Knowledge / Skills
  surface.

## Remaining Gaps

- Any unavailable bridge or action remains an explicit unavailable state until
  it is wired and accepted in a later block.
- Summary generation remains future work. This polish records a better
  missing-summary presentation, not automatic summarization.
- Full legacy removal remains a later decision after manual smoke,
  compatibility review, regression coverage, and replacement-flow readiness.

## Safety Record

- No hidden context injection.
- No automatic create, import, attach, prompt send, Queue task creation, Queue
  run, Agent Executor launch, or auto-finalize behavior.
- No backend, Rust, Tauri, storage, SQLite schema, or Knowledge data changes.
- No route back to the legacy Knowledge / Skills surface.

## Intentionally Not Implemented

- No source code changes in this docs-only status block.
- No test changes in this docs-only status block.
- No backend/Rust/Tauri/storage/schema changes.
- No auto-create/import/attach/run behavior.
- No Queue or Workspace Agent auto-run behavior.
- No deletion of legacy Knowledge / Skills code.
