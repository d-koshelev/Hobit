# KnowledgeV2 Product Surface Correction Status

## Purpose

This docs-only status record captures the KnowledgeV2 product-surface
correction after popup-only manual smoke.

It does not add frontend behavior, backend/Rust/Tauri/storage/schema changes,
Queue or Workspace Agent runtime behavior, hidden context injection, automatic
create/import/attach/run behavior, or a route back to the legacy Knowledge /
Skills surface.

KnowledgeV2 remains the normal Knowledge / Skills surface through the retained
`skill-library` compatibility identity.

## Status

The product-surface correction is recorded after manual popup-only smoke. The
accepted surface direction is catalog-first: the main Knowledge / Skills body
is the catalog, and item inspection happens in explicit bounded popups rather
than a permanent right preview/sidebar.

The correction covers:

- Details popup product redesign with a wide, bounded, product-like item
  details surface.
- Verbose primary copy and warning/footer copy simplification so the normal
  surface stays focused on catalog work.
- Row actions moved into a clean product menu for Details, Use, Archive, and
  Delete.
- Catalog and topbar layout correction so controls are grouped, spaced, and do
  not crowd the catalog.

## Expected Behavior

- The main Knowledge / Skills surface is catalog only.
- There is no permanent right preview/sidebar in the normal surface.
- Clicking a catalog row opens item details in a wide, bounded, product-like
  popup.
- The item details popup remains bounded to the viewport, supports the current
  movable popup affordance where available, and provides a scroll path for long
  content.
- Popup footer content is limited to actions. Explanatory or warning copy does
  not crowd the footer.
- Row actions are exposed through a clean menu with Details, Use, Archive, and
  Delete entries where supported.
- Topbar controls are grouped and spaced so primary catalog actions remain
  readable.
- Knowledge / Skills does not route back to the legacy surface.
- Selecting, viewing details, using row menus, or opening popups does not
  auto-create, auto-import, auto-attach, send prompts, create Queue work, run
  Queue/Executor work, or inject hidden context.

## Manual Smoke Checklist

- Open a Workspace and open Knowledge / Skills.
- Verify the main surface is the KnowledgeV2 catalog and there is no right
  preview/sidebar.
- Click a row and verify item details open in a popup.
- Verify the details popup is wide, bounded to the viewport, and movable where
  the shared popup shell supports movement.
- Verify long details content scrolls inside the popup rather than pushing
  actions off-screen.
- Verify the popup footer contains only actions.
- Open the row actions menu and verify it includes Details, Use, Archive, and
  Delete entries where supported.
- Verify unsupported actions show honest disabled or unavailable states rather
  than hidden side effects.
- Verify the topbar controls are grouped and spaced cleanly at normal widget
  width.
- Verify there is no verbose primary-surface copy and no verbose footer
  warning copy.
- Verify there is no normal route back to the legacy Knowledge / Skills
  surface.
- Verify no action auto-creates, auto-imports, auto-attaches, sends to
  Workspace Agent, creates Queue tasks, starts Queue/Executor work, or finalizes
  anything without explicit operator action.

## Remaining Gaps And Follow-Ups

- Keep manual smoke as the acceptance path for this correction until focused
  frontend regression coverage is added in a later implementation/test block.
- Continue to keep any long-form details, warnings, confirmation states, and
  context selection flows inside bounded popups instead of restoring a
  permanent right preview/sidebar.
- Preserve row menu disabled/unavailable reasons while avoiding verbose normal
  catalog copy.
- Keep Archive/Delete constrained to existing safe action bridges and
  confirmation/availability states.
- Full legacy code removal remains a later compatibility decision; this status
  records that KnowledgeV2 is the normal Knowledge / Skills product surface,
  not that all legacy implementation files are deleted.

## Validation Scope

This is a docs-only status update. Requested validation is limited to:

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`

No source code, tests, backend, Rust, Tauri, storage, schema, runtime, Queue,
Workspace Agent, persisted behavior, auto-create/import/attach/run behavior,
or hidden context behavior changes are included.
