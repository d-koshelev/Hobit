# UI Design System Contract

## Purpose

This contract defines project-level UI standards and hard rules for Hobit.

It is a docs/contracts-only product contract. It does not implement frontend
UI, CSS, layout behavior, runtime behavior, backend commands, Tauri commands,
storage/schema changes, widget behavior, Queue execution, Agent Executor
behavior, Git behavior, Terminal behavior, or new widgets.

Future UI work must preserve `docs/DESIGN_SYSTEM_CONTRACT.md`,
`docs/PRODUCT_UI_DESIGN_CONTRACT.md`, `docs/PRODUCT_UI_VISUAL_CONTRACT.md`,
`docs/WIDGET_CONTRACT.md`, and
`docs/WIDGET_PROGRESSIVE_DISCLOSURE_CONTRACT.md`. This contract adds
cross-surface hard rules for spacing, layout, popups, lists, actions, status,
context attachment, and agent-generated UI.

For the current reuse inventory and high-traffic surface map, see
`docs/UI_SHARED_PRIMITIVES_INDEX.md`. Future UI work must check that index
before reimplementing local frames, popups, action groups, lists, tables,
cards, badges, menus, confirmations, empty states, or context pickers.

## Core Principle

Hobit UI is dense, operator-focused, and dark-theme-first, but never cramped,
debug-looking, or visually careless.

Dense means the operator can scan and act efficiently. It does not mean
zero-padding panels, touching controls, raw data dumps, tiny unreadable rows,
or permanent inspectors that turn the Workbench into a debugging console.

## Mandatory Global Rules

- Product surfaces must use a visible spacing/padding token. The minimum
  visible product spacing token is `4px`, reserved for tight inline gaps,
  compact badges, and icon-label spacing.
- Normal widget, popup, panel, form, and list composition must use at least
  `8px` visible padding or gap unless a shared primitive defines a tighter
  internal control rhythm.
- Zero-padding product surfaces are forbidden. Terminal, code, SQL, log, and
  table output may be visually dense, but they still need a deliberate
  boundary, inset, or scroll container.
- Controls must not touch. Adjacent buttons, inputs, menus, badges, and row
  actions require a visible gap or a shared segmented-control primitive.
- Popups, drawers, menus, and overlays must not overflow the viewport without
  scroll. Long content belongs in a bounded scrollable body.
- Long popups must keep action controls reachable through a sticky footer.
- Permanent sidebars are forbidden unless the task explicitly justifies them
  as the primary product surface for that workflow. Prefer a selected-item
  detail popup, drawer, collapsible panel, or widget-owned view instead.
- Details views must be structured product views, not raw dumps. Raw JSON,
  logs, payloads, stack traces, IDs, and internal state belong behind explicit
  developer details.
- UI must use the locked theme palette and shared semantic variables. Do not
  add raw colors, gradients, or widget-local visual systems.
- Every visible block must have one responsibility and must remain compatible
  with the Workbench/widget/preset model.

## Layout Rules

Widget and module surfaces should use a consistent product structure:

1. Module header: short title, semantic status, selected object identity when
   relevant, and compact header actions.
2. Grouped topbar controls: primary command, secondary action group, refresh or
   view controls, and mode/filter controls only when needed.
3. Search/filter rows: one compact row or wrapped control group for query,
   filters, scope, and sort. Search/filter controls must not be mixed into row
   action menus.
4. Primary content area: table, list, board, editor, terminal, preview, or
   structured detail surface that owns the module's main responsibility.
5. Empty, partial, unavailable, loading, blocked, failed, and unsupported
   states: compact, honest, and actionable without raw diagnostics.

Layout rules:

- The primary action must be visible in the normal workflow.
- Secondary actions should be grouped and visually quieter than the primary
  action.
- Header, controls, content, and footer should read as one continuous product
  surface, not detached boxes.
- Avoid box-inside-box composition. Use internal panels only when they
  represent meaningful nested content.
- Forms must keep labels, help text, errors, and controls aligned and readable.
- Long prose does not belong in default surfaces. Use short labels, compact
  summaries, and expandable details.

## Popup Rules

Popups, modal dialogs, action sheets, and floating details surfaces must be:

- Draggable or movable when they cover meaningful workbench content and may
  need to stay open during reference/review.
- Bounded to the visible viewport with max width, max height, and safe margins.
- Structured as header, body, and footer.
- Header-owned for title, compact status, close action, and optional drag
  handle.
- Body-owned for content and scroll.
- Footer-owned for final actions only.
- Scrollable in the body when content exceeds the available height.
- Sticky in the footer when the body scrolls.
- Closable through a visible close control.
- Closable with Escape unless closing would lose unsaved input, discard a
  dangerous decision, or interrupt an active operation; in those cases Escape
  must confirm, refuse with explanation, or be disabled intentionally.

Popup footers must not contain long explanatory text. Put explanations,
warnings, validation details, previews, and help text in the popup body, above
the sticky footer actions.

## Table, List, And Card Rules

- Rows must be dense but readable. Compact rows still need line height,
  spacing, and visual separation sufficient for repeated scanning.
- Badges must be compact, semantic, and aligned. Badges should not dominate
  row height.
- Row click should select the row or open the structured details view. It must
  not trigger execution, mutation, persistence, context attachment, or
  destructive behavior.
- Each row should have one row action menu when multiple actions exist.
  Avoid spreading many buttons across every row.
- Primary row metadata should stay visible without opening developer details.
- Action labels must not be broken, clipped, or truncated into ambiguity.
  Prefer short explicit labels and menus over cramped inline buttons.
- Cards are for repeated items, summaries, and genuinely framed tools. Do not
  use decorative cards as page sections or nest cards inside cards.
- Lists and tables must handle empty, loading, filtered-empty, partial,
  unavailable, and error states distinctly.
- Long text in rows should truncate or wrap predictably and provide a details
  path when the full text matters.

## Action Rules

- The primary action for the current workflow must be visible and named in
  operator-facing language.
- Secondary actions must be grouped, muted, or moved into menus when they would
  crowd the surface.
- Destructive actions require confirmation before they mutate, delete, stop,
  kill, discard, reset, clean, push, publish, or otherwise cause irreversible
  or external effects.
- Actions that execute, mutate, persist, attach context, or publish must be
  explicit operator actions. They must not run on render, selection, hover,
  refresh, tab change, popup open, or details expansion.
- Unavailable actions must be disabled with a visible or discoverable reason,
  or hidden when showing them would imply future behavior is available.
- Disabled future controls should be rare. Prefer honest unavailable states or
  omit the control until the behavior exists.
- Selection is not approval. Opening details is not approval. Copying text is
  not approval. Attaching context is not sending.

## Status And Warning Rules

- Status should be compact by default: semantic chip, dot, short line, or
  inline summary.
- Details belong behind expand, help, details, or developer-details controls.
- Safety warnings must not disappear while the risky choice remains available.
- Blocking, failed, unsupported, not configured, dirty, destructive, and
  needs-approval states must remain visible without requiring raw logs.
- Warning text should state what is at risk and what the operator can do next.
- Do not use alarming visual weight for ordinary preview or unsupported states.
- Do not hide failures inside footers, tabs, raw logs, or developer details
  only.

## Context And Knowledge Rules

- No hidden context injection. Context, Knowledge, Skills, source snippets,
  run excerpts, files, notes, database results, terminal output, and logs must
  never enter Workspace Agent, Queue, Executor, provider prompts, or future
  tools invisibly.
- Context attachment must use an explicit target picker when more than one
  target could receive context, such as Workspace Agent, Queue task, Executor
  run, Note, Knowledge item, or future Context Pack.
- The target picker must identify the target in operator-facing language and
  must not default to a hidden or global recipient.
- Attach actions must show a visible attach result: what was attached, where
  it was attached, scope, approximate size when relevant, warnings, and how to
  remove or review it before send/run.
- Disabled, rejected, stale, capped, unsupported, or unsafe context must be
  visibly labeled and must not attach silently.
- Context attach is not execution and must not send, run, dispatch, mutate
  Git, query databases, launch Terminal, or create Queue work by itself.

## Agent-Output Rules

- New UI generated by agents must use shared primitives first: existing widget
  frame, popup shell, buttons, inputs, badges, status displays, list/table
  patterns, empty states, and theme variables.
- If a new primitive is needed, the implementation block must document why the
  existing primitives are insufficient and how the new primitive fits the
  shared design system.
- No local design forks without rationale. A widget may have domain-specific
  content and workflow, but not its own palette, spacing system, button
  language, popup behavior, or status vocabulary.
- Agent-generated UI must not add future-looking inactive controls, fake
  automation, hidden execution affordances, raw debug-first layouts, or
  workflow-specific sidebars unless the task explicitly asks for them and the
  relevant contract allows them.
- UI changes must preserve product honesty: implemented behavior can be
  visible; planned, deferred, compatibility, and deprecated behavior must not
  look available.

## Manual Smoke Checklist For UI Changes

Before accepting UI changes, manually inspect the affected surface and verify:

- The primary workflow is visible without reading raw logs or developer
  details.
- Header, grouped controls, search/filter row, content, and footer are
  consistently spaced and not cramped.
- No product surface has zero padding.
- No controls touch or overlap at normal and small widget sizes.
- Popups are bounded to the viewport, movable when needed, have header/body/
  footer structure, scroll the body, and keep footer actions reachable.
- Escape and visible close behavior work or are intentionally blocked with an
  explanation for unsaved/risky/active states.
- Lists and tables have readable rows, compact badges, a clear details path,
  and no broken action labels.
- Row selection or details opening does not execute, mutate, attach, persist,
  dispatch, or delete.
- Primary, secondary, destructive, disabled, and unavailable actions are
  visually distinct and correctly explained.
- Destructive and external-effect actions require confirmation.
- Empty, loading, filtered-empty, partial, unavailable, unsupported, blocked,
  failed, and warning states are distinct and operator-facing.
- Safety warnings remain visible while the risky action remains possible.
- Context and Knowledge attach flows require an explicit target when needed and
  show a visible attach result.
- Raw JSON, stack traces, internal IDs, raw payloads, and implementation flags
  are hidden behind developer details.
- The surface uses shared primitives and theme variables, with no raw colors,
  gradients, or widget-local visual forks.
- The UI remains understandable in dark theme and does not overclaim deferred
  or unimplemented capability.

## Non-Goals

This contract does not implement:

- Frontend changes.
- CSS changes.
- New components or shared primitives.
- Layout behavior changes.
- Popup behavior changes.
- Backend changes.
- Tauri changes.
- Storage/schema changes.
- Widget behavior changes.
- Queue, Executor, Git, Terminal, JDBC, Knowledge, Notes, or Workspace Agent
  runtime behavior.
- New validation automation.
