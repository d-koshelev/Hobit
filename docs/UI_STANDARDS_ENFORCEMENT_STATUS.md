# UI Standards Enforcement Status

Status: docs-only project-level UI enforcement status record.

## Purpose

This document records the implementation status of the project-level UI
standards enforcement block.

It does not implement frontend behavior, CSS, shared primitives, backend
behavior, Tauri commands, Rust changes, storage/schema changes, tests,
validation automation, widget behavior, runtime behavior, commits, or pushes.

## Enforcement Status Summary

### Implementation Audit

The enforcement block audited high-traffic product surfaces against the current
UI standards contracts and shared primitive inventory. The audit focused on
operator-visible spacing, popup behavior, topbar/action grouping, row action
presentation, destructive confirmations, and places where local widget UI had
started to drift from shared product patterns.

The current accepted direction is project-level consistency rather than
surface-by-surface visual reinvention. New UI work must inspect
`docs/UI_SHARED_PRIMITIVES_INDEX.md` first and reuse shared primitives,
theme tokens, and existing high-traffic surface patterns before adding local
markup or CSS.

### Spacing Tokens And Utilities

Spacing enforcement is expected to use shared spacing tokens, shared control
rhythm, and reusable utility classes where available. Product surfaces must not
collapse into visible zero-padding, edge-touching controls, or unbounded raw
output areas.

Dense Hobit UI remains valid only when it is deliberate and readable: normal
widget, popup, panel, form, and list composition should use at least visible
`8px` padding or gap unless an established shared primitive defines a tighter
internal rhythm. The minimum visible product spacing token remains `4px` for
tight inline gaps, compact badges, and icon-label spacing.

### Popup Shell Enforcement

Popup and details flows are expected to use the shared popup shell foundation
before local popup implementations. Popups must be bounded to the viewport,
movable when they cover useful workbench context, structured into header,
body, and footer regions, and closable through a visible close control.

Long popup content belongs in a scrollable body. Final actions belong in a
sticky footer so confirmation, cancel, attach, delete, and review actions stay
reachable at constrained sizes. Destructive, risky, unsaved, or active flows
must not close silently through generic Escape/outside-close behavior.

### Topbar, Action Menu, And Confirmation Normalization

Topbars and command rows are expected to group the primary command, secondary
actions, refresh/view controls, filters, and mode controls into compact,
readable control groups. Controls must have visible gaps and must not touch or
overlap.

Rows with multiple secondary actions should expose one clean row action menu
rather than spreading many always-visible buttons across every row. Row
selection or opening details is never approval and must not execute, mutate,
persist, attach context, dispatch work, or delete.

Destructive or external-effect actions require confirmation before they mutate,
delete, stop, kill, discard, reset, clean, push, publish, commit, or otherwise
cause irreversible or external effects. Confirmation should identify the
affected object, state the risk, provide cancel, and execute only from the
explicit confirm action.

### High-Traffic Surface Adoption

The enforcement block targets adoption on the surfaces operators use most:
KnowledgeV2, QueueV2, Workspace Agent, Agent Activity, and the Widget Catalog.
These surfaces should follow shared widget shell, popup shell, button/input/
select, badge/status, empty state, row action, and context picker patterns
where available.

The expected product shape is dense and operator-focused, but not cramped:
catalogs, boards, details popups, run logs, activity details, and catalog
cards/actions must remain bounded, readable, and explicit about what actions
are available.

## Expected Behavior

- New UI work must use shared primitives, theme tokens, and existing
  high-traffic surface patterns first.
- Product surfaces must not show visible zero-padding, edge-touching controls,
  or overlapping actions.
- Draggable popups must be bounded to the viewport, with scrollable bodies and
  sticky footers for final actions.
- Topbars and action rows must group related commands instead of scattering
  controls across the surface.
- Row actions must use a clean action menu when multiple item-level actions
  exist.
- Destructive and external-effect actions must require confirmation before
  mutation.
- Selection, hover, render, refresh, tab change, popup open, and details
  expansion must not execute, mutate, persist, attach context, dispatch, or
  delete.
- Raw diagnostics, stack traces, internal IDs, raw payloads, and implementation
  flags belong behind explicit developer details, not primary product views.

## Manual Smoke Checklist

### KnowledgeV2

- Catalog surface has visible spacing, no edge-touching controls, readable
  rows, and clean row actions.
- Details opens in a bounded popup with header/body/footer structure,
  scrollable body, and reachable footer actions.
- Use as context requires an explicit target/review path, shows warnings or
  disabled reasons when applicable, and does not send/run automatically.
- Delete requires confirmation and identifies the affected item before
  mutation.

### QueueV2

- Board lanes and task cards remain dense but readable, with no overlapping
  controls or edge-touching actions.
- Task details open in a bounded popup with scrollable content and reachable
  footer actions at constrained sizes.
- Card or row secondary actions use a clean menu where multiple actions exist.
- Run, review, finalize, delete, stop, or other risky actions remain explicit
  and confirmation-gated where destructive or external-effecting.

### Workspace Agent / Agent Activity

- Workspace Agent activity, run details, and logs popups are bounded to the
  viewport and keep footer actions reachable.
- Log and raw detail content uses deliberate insets or scroll containers and
  does not turn the overview into a raw dump.
- Opening activity, run details, or logs does not run agents, create Queue
  tasks, attach context, mutate files, or dispatch work.
- Close/Escape behavior is safe for active, risky, or unsaved states.

### Widget Catalog

- Catalog cards/actions use shared spacing, button, badge/status, and empty
  state patterns where applicable.
- Cards do not advertise deferred or compatibility-only widgets as available
  product surfaces.
- Add actions are explicit, separated from secondary detail actions, and do not
  create hidden runtime behavior.
- Catalog content remains readable at constrained sizes without clipped action
  labels or touching controls.

## Remaining Gaps And Follow-Ups

- Some custom popups remain unmigrated. Future UI blocks should migrate them to
  `PopupShell` or `WidgetPopupShell` when the affected flow is touched.
- A shared `ActionMenu` / `MenuButton` primitive is still a follow-up before
  further row-action expansion.
- A shared confirmation primitive over the popup shell remains a follow-up for
  delete, stop, kill, discard, push, commit, and other risky actions.
- Shared dense list/table/card primitives remain useful extraction targets
  after another surface needs the same pattern.
- Future UI self-test or lint integration should check for popup bounds,
  scrollable bodies, sticky footers, destructive confirmations, disabled
  reasons, no zero-padding product surfaces, and no action on selection/open.
- Visual smoke automation remains later work. Manual smoke remains the current
  acceptance path for this enforcement status.

## Intentionally Not Implemented

This status record intentionally does not add or change source code, tests,
frontend behavior, CSS, shared primitives, backend behavior, Rust/Tauri code,
storage/schema, runtime/provider behavior, Queue behavior, Knowledge behavior,
auto-run, auto-import, auto-attach, auto-commit, auto-push, or auto-finalize.
