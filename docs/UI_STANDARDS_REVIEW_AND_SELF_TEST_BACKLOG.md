# UI Standards Review And Self-Test Backlog

## Purpose

This document defines a future backlog for enforcing Hobit's project-level UI
standards through review checks, self-tests, and manual smoke.

It is docs/contracts/backlog only. It does not implement frontend behavior,
test harnesses, screenshot infrastructure, CSS linting, backend behavior, Tauri
commands, storage/schema changes, widget behavior, runtime behavior, or new
validation automation.

The standards in `docs/UI_DESIGN_SYSTEM_CONTRACT.md`,
`docs/PRODUCT_UI_DESIGN_CONTRACT.md`, `docs/PRODUCT_UI_VISUAL_CONTRACT.md`,
and affected widget contracts remain authoritative for UI implementation work.
This backlog records candidate review and validation coverage so future blocks
can enforce those standards consistently across Hobit, not only in one widget.

## Review Checklist

Future UI implementation and polish reviews should verify:

- Spacing and padding: product surfaces use deliberate spacing tokens, controls
  do not touch, and zero-padding surfaces are not accepted outside intentionally
  bounded dense output areas.
- Popup bounds: popups, menus, dialogs, drawers, and overlays remain within the
  viewport, use bounded scrollable bodies for long content, and keep final
  actions reachable.
- Action discoverability: the primary action for the current workflow is
  visible, secondary actions are grouped or muted, and unavailable actions do
  not imply deferred behavior is currently available.
- Row action menu: list, table, board, and catalog rows use one clear row
  action menu when multiple row actions exist instead of spreading many buttons
  across every row.
- Destructive confirmation: delete, discard, stop, kill, reset, clean, push,
  publish, overwrite, or other destructive/external-effect actions require an
  explicit confirmation before mutation.
- Empty, unavailable, and partial states: empty, filtered-empty, loading,
  unsupported, not configured, blocked, failed, warning, and partial states are
  distinct, operator-facing, and actionable without raw diagnostics.
- Responsive behavior: normal, narrow, and small-widget layouts avoid overlap,
  clipped labels, unreachable controls, and popups that escape the viewport.
- No debug or raw views in primary UI: raw JSON, stack traces, backend command
  names, internal IDs, implementation flags, and raw payloads stay behind
  explicit developer details rather than default production UI.

## Self-Test Candidates

Future enforcement blocks may add focused tests for the following cases:

- Bounded popup overflow test: verify representative detail, action, and
  confirmation popups stay inside the viewport, expose scrollable bodies for
  long content, and keep footer actions reachable.
- Topbar control spacing test: verify dense topbar controls keep visible gaps,
  wrap or collapse predictably at narrow widths, and do not overlap widget
  titles, status chips, or primary actions.
- Table row action menu test: verify rows with multiple actions expose one row
  action menu and that row click/select does not execute, mutate, attach
  context, persist, dispatch, or delete.
- Disabled action reason test: verify disabled actions either expose a visible
  or discoverable reason, or are omitted when the underlying behavior is not
  implemented.
- Destructive confirmation test: verify destructive and external-effect actions
  show an explicit confirmation step before performing the mutation.
- No legacy route regression checks for KnowledgeV2: verify the current
  Knowledge / Skills route remains on the KnowledgeV2 product surface and does
  not reintroduce legacy primary UI routes or debug-first views.
- QueueV2 lane action tests: verify lane/task actions remain explicit,
  approval-aware where needed, and do not imply hidden scheduling, hidden
  execution, automatic acceptance, Terminal launch, Git mutation, or hidden
  Workspace Agent tool use.
- Workspace Agent activity collapse tests: verify raw activity details,
  command output, event payloads, and developer diagnostics remain collapsed by
  default while readable product summaries remain visible.

## Possible Future Enforcement

Future blocks may choose the smallest practical enforcement layer for the
surface being changed:

- Component tests for shared primitives, popups, topbars, tables/lists, row
  action menus, confirmations, empty states, disabled actions, and activity
  collapse behavior.
- Story or screenshot smoke later, once the project has an accepted visual
  smoke approach and stable representative surfaces.
- CSS lint or grep checks for forbidden classes, zero-padding product
  containers, raw color usage, gradients, debug-only class leakage, or other
  practical project-specific patterns.
- Prompt-runner validator checklist that asks future agents to explicitly
  report spacing, popup bounds, row actions, destructive confirmations,
  disabled reasons, responsive behavior, raw/debug primary UI exposure, and
  manual smoke results for UI tasks.

## Manual Smoke Expectations

Until automated enforcement exists, UI work should continue to report manual
smoke against the affected surface:

- Primary workflow and next action are visible without opening raw logs or
  developer details.
- Header, grouped controls, content, and footers are consistently spaced.
- Popups remain bounded, closable, scroll correctly, and keep actions
  reachable.
- Row selection and details opening do not execute or mutate.
- Destructive actions confirm before mutation.
- Disabled or unavailable actions explain what is missing or are omitted.
- Empty, loading, partial, unavailable, failed, blocked, and warning states are
  distinct.
- Raw diagnostic details are hidden behind explicit developer details.
- Narrow and small-widget layouts avoid overlap, clipped action labels, and
  unreachable controls.

## Non-Goals

This block does not implement:

- Visual snapshot infrastructure.
- Runtime test harnesses.
- Component tests.
- Screenshot/story smoke.
- CSS linting or grep validators.
- Prompt-runner validation tooling.
- Frontend, backend, Rust, Tauri, storage, schema, runtime, or widget behavior
  changes.
