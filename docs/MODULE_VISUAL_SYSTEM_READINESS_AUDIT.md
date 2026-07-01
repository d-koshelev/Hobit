# Module Visual System Readiness Audit

## Executive summary

Verdict: ready for a narrow first real widget pilot, with caveats.

The visual-system foundation is ready to prove `ModuleShell` and
`ModuleHeader` in one small current widget. The first pilot should be Agent
Activity because it has a small wrapper component, no storage mutation, no
runtime execution controls, and an already isolated timeline body with focused
tests. The pilot should keep the existing `WidgetFrame` outer shell and migrate
only the widget's internal product surface to the module shell/header/body
rhythm.

The system is not ready for a broad widget migration. `ModulePopup`,
`ModuleSplit`, `ModuleRail`, and the broader `ModuleControls` kit should remain
out of the first pilot except for a simple status/text primitive if needed.
Preview/demo CSS still lives in `styles/ui/widget.css`; that is a containment
caveat, not a blocker for an Agent Activity shell pilot, as long as the pilot
does not use preview-only classes or change the primitive CSS.

Recommended first pilot: Agent Activity.

Blocking pre-pilot fixes: none for the narrow Agent Activity pilot.

Non-blocking follow-up before broader migrations: move preview/demo selectors
out of stable widget CSS, or at least keep them explicitly off-limits for real
widgets.

## Primitive readiness table

| Primitive | Status | API small enough | Domain-free | Visual coherence | Overengineering risk | Tests | Safe for first pilot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ModuleShell` | Ready for pilot | Yes. `bodyCollapsed`, native section attributes, and children only. | Yes. No workbench, runtime, storage, or widget imports. | Yes. Flat graphite shell, one continuous surface, opaque body. | Low. Do not add theme or persistence props. | Useful render, collapse, radius, and import-boundary coverage. | Yes, inside existing `WidgetFrame` content only. |
| `ModuleHeader` | Ready for pilot | Yes. Left/right slots keep the model constrained. | Yes. | Yes. Two anchored groups, no center placeholder, flat actions. | Low. Avoid adding menus or product state derivation. | Useful group, action, and state-indicator coverage. | Yes. |
| `ModulePopup` | Preview-only for now | Moderate. Open, close, title, labels, body class, default position. | Yes. | Coherent mini-module surface with local drag. | Medium. It combines surface, layer, and movement; no footer/focus/escape contract yet. | Open/close, drag, containment, and domain-free tests are useful. | No. Defer until a popup-specific pilot. |
| `ModuleSplit` | Preview-only for now | Reasonable, but layout stateful. | Yes. | Coherent thin rail split. | Medium. Local resize is fine; persistence/keyboard behavior is deferred. | Rail semantics, drag, and clamping covered through shell tests. | No. Defer until a split-heavy widget such as Notes. |
| `ModuleRail` | Preview-only for now | Small, but only meaningful inside `ModuleSplit`. | Yes. | Coherent separator/handle. | Medium if treated as standalone. | Separator orientation and drag state covered. | No. |
| `ModuleControls` kit | Ready with minor caveats | Broad but still understandable. | Yes. | Coherent graphite body controls. | Medium. Stop adding more controls before a real migration proves need. | Good semantic coverage for fields, buttons, status, notices, selected state. | Use only individual primitives needed by the pilot. |
| `ModuleTextInput` | Ready with minor caveats | Yes. Thin input wrapper plus invalid state. | Yes. | Yes. | Low. | Label/helper/error wiring covered through `ModuleField`. | Not needed for Agent Activity. |
| `ModuleTextArea` | Ready with minor caveats | Yes. Thin textarea wrapper plus invalid state. | Yes. | Yes. | Low. | Invalid state and field wiring covered. | Not needed for Agent Activity. |
| `ModuleButton` | Ready with minor caveats | Yes. Variant, size, native button props. | Yes. | Yes, including selected `aria-pressed` state. | Low. Avoid adding menu/open/state systems now. | Variants, disabled, and selected state covered. | Not needed unless Agent Activity adds a module-local action, which it should not. |
| `ModuleStatus` | Ready for pilot | Yes. Tone, optional dot, children. | Yes. | Yes. | Low. Do not expand tone vocabulary before real need. | Tone rendering covered. | Yes, for an event-count or current-state indicator if used. |
| `ModuleNotice` | Ready with minor caveats | Yes. Tone, title, body. | Yes. | Yes. | Low. Could later add role guidance by tone. | Tone rendering covered. | Not needed for Agent Activity. |
| `ModuleTextBlock` | Ready for pilot | Yes. Children plus native div attributes. | Yes. | Yes. | Low. | Demo and text primitive coverage exists. | Yes, but Agent Activity likely does not need it. |

## Theme readiness findings

Colors are grouped clearly enough for pilot use. `tokens.css` separates module
palette, borders, text, status colors, radius, elevation, shell/header/body,
controls, popup, and preview-stage tokens. The graphite/charcoal direction is
consistent with the Flat Graphite Compact contract.

Radius tokens are simple enough now. The active direct model uses:

- `--module-radius`
- `--module-control-radius`
- `--module-popup-radius`

The older radius bridge model is not active in the inspected CSS. Shell,
header, notices, controls, and popups consume the direct tokens.

Shadows are optional and understandable. The current options are effectively
none, popup, and all through local data attributes and scoped variables. A few
shadow aliases remain in `tokens.css`, but they do not block the first pilot.
Do not expand the shadow model before a real widget exposes a need.

Background variants are correctly preview-only. The stage variants live in
`moduleShellVisualPreview.css` on `.module-shell-visual-preview` with
`data-module-background`. Module body, split regions, and popups stay opaque.
Real widgets should not use the preview background hook.

Selected states are clear enough for reuse. `ModuleButton` supports a flat
graphite selected state through `[aria-pressed="true"]` with selected
background, border, and text tokens. This is reusable for future segmented
options without adding a separate selected prop.

Remaining token complexity is acceptable for the first pilot. The shadow
aliases and palette-to-surface aliases should not grow, but there is no
remaining radius-token blocker.

Hardcoded values are mostly structural and acceptable: 1px separators, 2px
notice rails, 6px dots, scrollbar sizes, and local preview positions. No raw
production colors were found outside the dedicated token/CSS areas inspected
for this visual system.

## CSS ownership findings

Stable primitive selectors in `apps/desktop/frontend/src/styles/ui/widget.css`:

- `.module-theme-scope` and local radius/shadow data hooks
- `.module-shell`, `.module-header`, `.module-header-*`, `.module-body`
- `.module-popup`, `.module-popup-*`, `.module-shell-floating-layer`
- `.module-field`, `.module-text-input`, `.module-text-area`
- `.module-button`, `.module-button-*`, `[aria-pressed="true"]`
- `.module-status`, `.module-status-dot`, `.module-status-badge`
- `.module-text-block`, `.module-section-title`, `.module-muted-text`,
  `.module-mono-text`, `.module-key-value-row`
- `.module-notice`, `.module-notice-*`
- `.module-split`, `.module-split-region`, `.module-rail`

Preview-only selectors that real widgets should not use:

- `.module-shell-example-*`
- `.module-ui-kit-*`
- `.module-theme-preview-*`
- `.module-shell-visual-preview` selectors in `widget.css`
- all background variant selectors in `moduleShellVisualPreview.css`
- `data-module-background` on the smoke preview root

Preview-only selectors are leaking into stable design-system styling. The
example, UI-kit, preview-control, and preview scrollbar selectors live in
`styles/ui/widget.css`, which otherwise owns stable widget primitives. This is
not an Agent Activity pilot blocker because the pilot can use only stable
selectors, but it is the main cleanup to do before broad migrations.

Recommended ownership boundary:

- Leave stable `.module-*` primitive selectors in `styles/ui/widget.css`.
- Move `.module-shell-example-*`, `.module-ui-kit-*`,
  `.module-theme-preview-*`, and `.module-shell-visual-preview` scrollbar
  rules to `moduleShellVisualPreview.css` before the second or third real
  migration, or sooner if those selectors start confusing implementation work.

Selectors that could accidentally affect current production widgets are low
risk today because production widgets do not use `.module-*` classes. The main
future footgun is `.module-popup-body p:not([class])`, which styles arbitrary
unclassed popup paragraphs. Avoid using `ModulePopup` in a real widget until
that popup body text boundary is reviewed.

## Test readiness findings

Tests that protect useful behavior:

- `ModuleShell.test.tsx` covers header groups, body collapse, flat header
  actions, state indicator semantics, direct radius hooks, split rail behavior,
  dummy isolation, popup containment, popup movement, and domain-free imports.
- `ModulePopup.test.tsx` covers open/closed rendering, close callback, drag
  handle metadata, flat close action, local drag position, graphite popup
  elevation, and domain-free imports.
- `ModuleControls.test.tsx` covers field label/helper/error wiring, invalid
  controls, button variants, disabled state, selected `aria-pressed` styling,
  status tones, text blocks, key/value rows, notices, radius use, and
  domain-free imports.
- `moduleShellVisualPreviewApp.test.tsx` covers smoke preview isolation,
  preview-local background variants, local theme hooks, popup overlay
  containment, collapse anchoring, and no product/runtime imports.

Tests that are too tied to preview/demo internals:

- Exact dummy text and button order assertions.
- CSS source-string assertions that lock implementation details rather than
  behavior.
- Exact popup coordinate checks beyond one representative local movement.
- Repeated import deny lists across several files.
- Assertions that depend on the `Settings` preview lab shape rather than the
  stable primitive contract.

Sufficiency for first pilot: enough for a narrow Agent Activity shell/header
pilot. The existing primitive tests cover the shell, header, body, and simple
status/text pieces that pilot would use.

Additional tests needed for the first pilot:

- Update the existing `AgentActivityWidget` coverage in
  `AgentActivityPanel.test.tsx` to assert the widget still renders published
  events inside a module shell/header/body.
- Assert scoped workspace filtering and event count/status still render.
- Keep existing detail expansion/raw-preview behavior assertions unchanged.
- Add no tests for pixel-perfect shell styling.

Tests not to expand yet:

- Do not add screenshot or pixel-lock tests.
- Do not add broad CSS token-chain tests.
- Do not add `ModulePopup` production behavior tests during the Agent Activity
  pilot.
- Do not add `ModuleSplit` keyboard/persistence tests until a split migration
  is explicitly scoped.

## First pilot candidate comparison

| Candidate | Current shell/header complexity | Business logic coupling | Visual migration risk | Behavior risk | Likely files touched | Can `ModuleShell` wrap safely | Popup/Split/Controls relevance | Recommended phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent Activity | Low. `WidgetFrame` plus an internal section header and timeline panel. | Low. Filters events by workspace and passes them to `AgentActivityPanel`. | Low. Existing body is already compact and bounded. | Low if `AgentActivityPanel` stays unchanged. | `AgentActivityWidget.tsx`, `AgentActivityPanel.test.tsx`, maybe limited `.agent-activity-widget*` CSS. | Yes, inside existing `WidgetFrame` body. | `ModuleShell`, `ModuleHeader`, `ModuleBody`, maybe `ModuleStatus`. No popup/split. | First pilot. |
| Notes | Medium-high. `WidgetFrame`, custom toolbar/status, resizable split, editor/list panes. | Medium-high. Workspace Notes API controller, save/dirty state, Knowledge promotion. | Medium. Split/editor/list CSS is already specialized. | Medium. Resize, collapse, Ctrl+S, save, preview, and promotion flows must stay intact. | `NotesPlaceholderWidget.tsx`, notes components, `notes.css`, tests. | Yes, but not as first proof. | `ModuleSplit`, `ModuleRail`, inputs, textarea, buttons, notices are relevant later. | Second pilot after Agent Activity. |
| Workspace Agent | Very high. Large orchestrating component with status/actions, transcript, composer, direct work, activity pane. | Very high. Provider path, Queue, Knowledge, Direct Work, visible context, proposals. | High. Many local card and composer patterns. | High. Easy to disturb agent safety and visible-context boundaries. | Many Workspace Agent files and CSS. | Technically possible, not safe as first pilot. | Many controls and popups eventually, but scope would sprawl. | Later/high-risk. |
| QueueV2 | High. Active product route plus compatibility/smoke WidgetV2 route, board lanes, details popups. | High. Tasks, workers, Autorun state, validation/evidence, Knowledge draft review. | High. Existing board/card visual system is dense and domain-specific. | High. Selection, details, Queue actions, review evidence, and runner controls are sensitive. | Queue board, card, popup, CSS, tests. | Not as a shell-only pilot; already uses WidgetV2 patterns in one route. | Popup and split-like layout relevant later. | Later/high-risk. |
| Knowledge / Skills | High. Already uses `WidgetV2Shell`, action groups, catalog browser, popups, context picker, debug popup. | High. Data bridges, Skills/Documents, attach, import, draft review, delete/update. | High. Existing KnowledgeV2 visual system is substantial. | High. Context attach and Knowledge mutation boundaries are sensitive. | Knowledge widget/components/CSS/tests. | Not first. It already has a shell model. | Popup and controls relevant later. | Later/high-risk. |
| Terminal | High. `WidgetFrame` around PTY panels, settings, kill confirm, xterm surface, legacy fallback. | Very high. PTY lifecycle, process controls, session-only buffers, stop/kill/close. | High. Terminal output has specialized layout and xterm constraints. | Very high. Command/runtime behavior must not move accidentally. | Terminal panels, CSS, tests. | Not first. Surrounding chrome only, never xterm internals. | Popup/settings and controls relevant much later. | Later/high-risk. |

Agent Activity is the best first pilot. Notes is the best second pilot after
the shell/header path is proven.

## Recommended first pilot

Target module: Agent Activity.

Target display level: Minimal.

Exact narrow scope:

- Keep the existing `WidgetFrame` outer shell, frame actions, logs action,
  move handling, style, and title path unchanged.
- Replace only the internal `agent-activity-widget` surface/header composition
  with `ModuleShell`, `ModuleHeader`, and `ModuleBody`.
- Use the module header for `Current-session timeline` and a compact current
  event-count/state indicator.
- Leave `AgentActivityPanel` grouping, sorting, expansion, raw-preview
  collapse, capping, and auto-follow behavior unchanged.
- Do not introduce `ModulePopup`, `ModuleSplit`, `ModuleRail`, or broad
  `ModuleControls` adoption in this pilot.

Why this pilot:

- It exercises the real `WidgetFrame` plus inner module shell relationship
  without touching `WidgetFrame`, `WidgetHost`, registry, storage, or runtime.
- It has low product risk because Agent Activity is read-only current-session
  observability.
- The existing tests already cover the important behavior that must not
  regress.

## First pilot scope

Allowed files:

- `apps/desktop/frontend/src/workbench/AgentActivityWidget.tsx`
- `apps/desktop/frontend/src/workbench/AgentActivityPanel.test.tsx`
- `apps/desktop/frontend/src/styles/components.css` only for narrowly scoped
  `.agent-activity-widget*` cleanup if the old internal wrapper CSS becomes
  dead or conflicting

Forbidden files:

- `apps/desktop/frontend/src/design-system/widget/ModuleShell.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModulePopup.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModuleSplit.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModuleControls.tsx`
- `apps/desktop/frontend/src/styles/tokens.css`
- `apps/desktop/frontend/src/styles/ui/widget.css`
- `WidgetFrame`, `WidgetV2Shell`, `WidgetHost`, widget registry/catalog files
- Workspace APIs, backend/Tauri/Rust/storage/schema/runtime files
- Workspace Agent, QueueV2, Knowledge / Skills, Notes, Terminal, Finder files

Visual changes allowed:

- Agent Activity internal body becomes a module shell surface.
- Agent Activity internal title/count moves into `ModuleHeader`.
- Existing timeline content sits in `ModuleBody`.
- Remove or narrow obsolete `.agent-activity-widget*` CSS only if needed.

Behavior changes forbidden:

- No event filtering change.
- No timeline grouping/sorting/capping change.
- No scroll-follow change.
- No expansion/raw-preview/detail behavior change.
- No frame action/log/move/title behavior change.
- No persistence, runtime, backend, Tauri, storage, registry, or catalog
  change.

Tests to run for the pilot:

- `git status --short --branch`
- `npm.cmd run test --prefix apps/desktop/frontend -- AgentActivityPanel ModuleShell`
- `npm.cmd run typecheck --prefix apps/desktop/frontend`
- `git diff --check`

Manual smoke checklist:

- Agent Activity with no events still shows the existing empty state.
- Agent Activity with Workspace Agent or Executor activity still shows the
  compact timeline.
- Event count/status in the module header matches the scoped event count.
- Clicking a row still expands details and raw preview only after click.
- The timeline remains scrollable and bounded at normal and small widget sizes.
- Existing WidgetFrame title, actions, logs button, move/resize behavior, and
  widget layout remain unchanged.
- No controls overlap, no zero-padding product surface appears, and no raw
  details are exposed by default.

Rollback strategy:

- Revert `AgentActivityWidget.tsx`.
- Revert the focused `AgentActivityPanel.test.tsx` changes.
- Revert any narrowly scoped `.agent-activity-widget*` CSS adjustment.
- No persisted data, schema, runtime state, registry, or widget IDs are
  touched, so rollback is source-only.

Acceptance criteria:

- Agent Activity uses `ModuleShell`, `ModuleHeader`, and `ModuleBody` for its
  internal product surface.
- `WidgetFrame`, `WidgetHost`, registry/catalog, and widget identity are
  unchanged.
- Existing Agent Activity behavior remains intact.
- Focused tests and typecheck pass.
- No forbidden files are touched.
- No `ModulePopup`, `ModuleSplit`, `ModuleRail`, or broad control-kit
  migration is introduced.

## Remaining pre-pilot fixes

Blocking fixes before the Agent Activity pilot: none.

Small non-blocking fixes to consider before broader migration:

- Move preview-only `.module-shell-example-*`, `.module-ui-kit-*`,
  `.module-theme-preview-*`, and `.module-shell-visual-preview` scrollbar
  selectors out of `styles/ui/widget.css`.
- Add a short note near the preview CSS or contract that real widgets must not
  consume `data-module-background`.
- Before a popup pilot, decide whether `ModulePopup` needs Escape behavior,
  focus return, footer slots, and a less broad `.module-popup-body p:not([class])`
  rule.
- Before a split pilot, decide whether keyboard resizing is required for the
  real widget being migrated.

Do not treat those as blockers for the Agent Activity shell/header pilot.

## Risks and non-goals

Risks:

- Using `ModuleShell` inside `WidgetFrame` can create a double-header feel if
  the internal module header repeats the outer widget title. The Agent Activity
  pilot should keep the outer title as `Agent Activity` and the module header
  as `Current-session timeline`.
- Preview/demo CSS in `styles/ui/widget.css` can be copied accidentally into a
  real widget. The pilot prompt must forbid preview selectors.
- Expanding the first pilot to Notes, Queue, Workspace Agent, Knowledge, or
  Terminal would turn a visual-system proof into a product migration.
- Introducing `ModulePopup` or `ModuleSplit` in the first pilot would test too
  many primitives at once.

Non-goals:

- No real widget migration in this audit document.
- No frontend behavior change in this audit document.
- No TSX/CSS refactor in this audit document.
- No backend, Tauri, Rust, storage, schema, runtime, or persistence change.
- No `WidgetFrame`, `WidgetV2Shell`, `WidgetHost`, registry, or catalog
  behavior change.
- No production theme settings.
- No broad redesign.
- No commit for this audit unless explicitly requested.

## Exact next implementation prompt

```text
Agent Activity ModuleShell Pilot - Narrow Real Widget Migration

Repository/worktree:
C:\Users\Dmitry\Documents\prj\hobit-agent-worktrees\ui-module-shell-polish

Branch:
agent/ui-module-shell-polish

Task type:
Focused frontend implementation.

Read first:
- AGENTS.md
- docs/ACTIVE_CONTRACT_INDEX.md
- docs/CURRENT_WIDGET_SURFACE.md
- docs/CODE_ORGANIZATION.md
- docs/ARCHITECTURE.md
- docs/AGENT_UI_IMPLEMENTATION_RULES.md
- docs/FRONTEND_STRUCTURE_CONTRACT.md
- docs/UI_DESIGN_SYSTEM_CONTRACT.md
- docs/MODULE_SHELL_HEADER_CONTRACT.md
- docs/MODULE_VISUAL_SYSTEM_READINESS_AUDIT.md

Scope:
Run the first real widget visual-system pilot on Agent Activity only.
Use ModuleShell/ModuleHeader/ModuleBody for the internal Agent Activity product
surface while preserving the existing WidgetFrame outer shell and all current
Agent Activity behavior.

Allowed files:
- apps/desktop/frontend/src/workbench/AgentActivityWidget.tsx
- apps/desktop/frontend/src/workbench/AgentActivityPanel.test.tsx
- apps/desktop/frontend/src/styles/components.css only for narrowly scoped
  .agent-activity-widget* cleanup if required

Do:
- Keep WidgetFrame, frameActions, frame logs, move handling, title, style, and
  workspace event filtering unchanged.
- Replace only the internal Agent Activity wrapper/header with ModuleShell,
  ModuleHeader, and ModuleBody.
- Use the module header for "Current-session timeline" plus a compact event
  count/current state indicator.
- Keep AgentActivityPanel unchanged unless a test import/assertion update is
  strictly necessary.
- Preserve empty state, grouped run rows, newest-first ordering, collapsed raw
  details by default, click-to-expand details, capped previews, and auto-follow
  behavior.
- Add/update focused assertions in AgentActivityPanel.test.tsx proving Agent
  Activity still renders events inside the module shell/header/body.
- Keep the change visually minimal and contained.

Do not:
- Do not migrate Notes, Workspace Agent, QueueV2, Knowledge / Skills,
  Terminal, Finder, or any other widget.
- Do not touch WidgetFrame, WidgetV2Shell, WidgetHost, widget registry/catalog,
  presets, workspace APIs, backend/Tauri/Rust, storage/schema/runtime, or
  persistence.
- Do not modify ModuleShell, ModulePopup, ModuleSplit, ModuleControls,
  tokens.css, or styles/ui/widget.css unless a real blocker is found and
  explicitly justified before changing scope.
- Do not introduce ModulePopup, ModuleSplit, ModuleRail, production theme
  settings, persisted visual preferences, new behavior, new runtime paths, or
  new dependencies.
- Do not change event filtering, grouping, sorting, scroll-follow, expansion,
  raw preview, logging, or widget frame behavior.

Validation:
- git status --short --branch
- npm.cmd run test --prefix apps/desktop/frontend -- AgentActivityPanel ModuleShell
- npm.cmd run typecheck --prefix apps/desktop/frontend
- git diff --check

Manual smoke:
- Agent Activity empty state still renders.
- Activity rows render when current-session events exist.
- Event count/status matches the scoped event count.
- Row expansion still reveals details/raw preview only after click.
- Timeline remains bounded and scrollable at normal and small widget sizes.
- WidgetFrame title/actions/logs/move/resize behavior remains unchanged.

Final response:
- files changed
- what changed
- validation commands and results
- manual smoke results or why manual smoke was not run
- commit hash, or state clearly if no commit was created
- what was intentionally not implemented
```
