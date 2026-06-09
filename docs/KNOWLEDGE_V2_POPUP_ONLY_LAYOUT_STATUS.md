# KnowledgeV2 Popup-Only Layout Status

## Purpose

This docs-only status record captures the KnowledgeV2 popup-only layout
transition and bounded popup architecture for the normal Knowledge / Skills
surface.

It does not add frontend behavior, backend/Rust/Tauri/storage/schema changes,
Queue or Workspace Agent runtime behavior, hidden context injection, automatic
create/import/attach/run behavior, or a route back to the legacy Knowledge /
Skills surface.

## Status

KnowledgeV2 remains the normal Knowledge / Skills surface through the retained
`skill-library` compatibility identity.

The popup-only layout direction is:

- The permanent right preview/sidebar is removed from the default catalog
  layout or default-hidden.
- Item details open in a bounded popup instead of consuming a permanent right
  column.
- Use as Context opens in a bounded, scrollable popup rather than expanding
  inline inside the details/preview area.
- Shared popup content follows a header/body/footer structure with a bounded
  scrollable body and a footer that remains visible for primary actions.
- Row actions are collected into a compact menu with Details, Use as Context,
  Archive, and Delete states.
- Delete and Archive remain explicit, discoverable, and constrained by
  existing safe frontend actions, confirmation, or disabled reasons.
- The topbar controls are grouped and spaced so the catalog remains the
  primary visible work area.

## Expected Behavior

- Knowledge / Skills should not show a permanent right sidebar by default.
- Selecting or clicking an item should open details in a popup, not attach
  context, create records, import files, run work, or send anything.
- Popup content must not fall below the visible viewport without a scroll path.
- Long details, warning lists, or many selectable context items should scroll
  inside the popup body.
- Footer actions such as Attach, Close, Delete confirmation, or Cancel should
  remain visible while the popup body scrolls.
- Details popups should support close behavior and the existing popup drag
  affordance where the shared shell provides it.
- Use as Context should remain operator-controlled and explicit. It should not
  auto-create context, auto-attach to Workspace Agent, auto-update Queue, or
  run anything.
- Row action menu entries should expose unavailable states honestly. Disabled
  actions should show a reason such as missing bridge callback, unsupported
  item type, archived/deleted state, or no selected target.
- Delete should require confirmation when available. If delete is unavailable,
  the UI should show a disabled reason rather than hiding the safety boundary.
- Archive should use only an existing safe document lifecycle update path when
  available. Skill archive should not be invented as a new lifecycle unless a
  later task explicitly adds that model.
- Topbar controls should keep primary actions discoverable while grouping
  secondary actions and avoiding cramped/duplicated controls.

## Manual Smoke Checklist

- Open a Workspace and add/open Knowledge / Skills.
- Verify KnowledgeV2 is the normal Knowledge / Skills surface and does not
  route back to the legacy default surface.
- Verify there is no permanent right preview/sidebar by default.
- Click a catalog item and confirm a details popup opens.
- In the details popup, verify body scrolling, visible footer actions, drag
  behavior where available, Escape/outside/close-button close behavior, and no
  hidden attach/run side effect.
- Open Use as Context with many items available.
- Verify the context popup body scrolls while footer actions remain visible.
- Verify Attach or equivalent primary context action remains explicit and does
  not send or run automatically.
- Test the row actions menu for Details and Use as Context.
- Test Archive availability. Confirm it is available only for supported
  document items and otherwise shows a disabled reason.
- Test Delete availability. Confirm delete is confirmation-gated when
  available and otherwise shows a disabled reason.
- Verify archived/deleted/unavailable/partial bridge states remain visible and
  honest.
- Resize the widget or narrow the viewport and verify topbar grouping/spacing
  remains usable without overlapping controls.

## Remaining Gaps And Follow-Ups

- Run the manual smoke checklist against the actual desktop/Vite surface after
  the popup-only UI implementation is present.
- Keep replacing any remaining embedded compatibility panels with bounded
  popup-contained flows where safe existing frontend actions already exist.
- Preserve the shared popup shell convention for future long forms: sticky
  header/body/footer, bounded body scroll, visible footer actions, and no
  hidden execution.
- Keep Archive/Delete limited to existing safe action bridges unless a later
  contract explicitly expands the Knowledge/Skill lifecycle model.
- Add focused frontend tests only in a later implementation/test block; this
  status record intentionally does not add tests.

## Validation Scope

This was a docs-only status update. Requested validation is limited to:

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`

No source code, tests, backend, Rust, Tauri, storage, schema, runtime, Queue,
Workspace Agent, persisted behavior, auto-create/import/attach/run behavior,
or hidden context behavior changes are included.
