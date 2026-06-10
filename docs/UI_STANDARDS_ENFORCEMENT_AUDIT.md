# UI Standards Enforcement Audit

Status: docs-only implementation audit.

## Purpose

This audit compares the current frontend implementation against:

- `docs/UI_DESIGN_SYSTEM_CONTRACT.md`
- `docs/UI_SHARED_PRIMITIVES_INDEX.md`
- `docs/AGENT_UI_IMPLEMENTATION_RULES.md`
- `docs/UI_STANDARDS_REVIEW_AND_SELF_TEST_BACKLOG.md`

It does not implement frontend UI, CSS, shared primitives, backend behavior,
Tauri commands, storage/schema changes, runtime behavior, widget behavior,
tests, validation automation, or new widgets.

## Scope Inspected

Shared frontend primitives and styles inspected:

- `apps/desktop/frontend/src/styles/tokens.css`
- `apps/desktop/frontend/src/styles/hobit-theme.css`
- `apps/desktop/frontend/src/styles/components.css`
- `apps/desktop/frontend/src/styles/workbench-shell.css`
- `apps/desktop/frontend/src/styles/widget-v2.css`
- `apps/desktop/frontend/src/styles/widget-v2-knowledge.css`
- `apps/desktop/frontend/src/styles/widget-v2-queue.css`
- `apps/desktop/frontend/src/styles/widget-v2-workspace-agent.css`
- `apps/desktop/frontend/src/design-system/`
- `apps/desktop/frontend/src/workbench/widgetV2/`
- `apps/desktop/frontend/src/workbench/WidgetCatalogShell.tsx`
- Representative Notes, Finder, and Terminal components/styles where shared
  primitive reuse was visible or trivially applicable.

High-traffic surfaces considered:

- KnowledgeV2
- QueueV2
- Workspace Agent / WorkspaceAgentV2
- Widget Catalog
- Notes, Finder, and Terminal for shared primitive inheritance only.

## Current Reuse Baseline

The frontend already has useful shared foundations:

- `WidgetFrame` provides the current V1 widget chrome and widget-local logs.
- `WidgetV2Shell`, `WidgetV2Header`, `WidgetV2Toolbar`, and V2 panel slots
  provide the newer continuous widget surface vocabulary.
- `PopupShell` and `WidgetPopupShell` provide bounded dialog/popover
  foundations with header/body/footer structure, close behavior, focus return,
  and draggable header regions.
- `Button`, `Input`, `Select`, `Badge`, `StatusDot`, `Panel`, `EmptyState`,
  and `WidgetInfoPopover` cover basic controls and simple states.
- KnowledgeV2 already uses `WidgetPopupShell` for item details, delete
  confirmation, and context picker flows.
- QueueV2 uses `WidgetV2Shell`, `WidgetV2Toolbar`, and `WidgetPopupShell` for
  the board-first surface and task details popup.
- Widget Catalog already uses shared `Button` and `Badge`.
- Notes, Finder, and Terminal use shared `Button` and `Badge` in several
  visible flows.

## Standards / Code Gap Summary

### Spacing And Tokens

Gap: current spacing tokens do not match the new project-level minimum rhythm.
`tokens.css` defines `--space-xs: 3px`, `--space-sm: 5px`,
`--space-md: 7px`, and `--space-lg: 9px`, while the UI contract says the
minimum visible product spacing token is `4px` and normal widget, popup, panel,
form, and list composition should use at least `8px` visible padding/gap unless
a shared primitive defines a tighter rhythm.

Gap: several V2 styles reference token-like variables that are not present in
the inspected token file, including `--scaled-space-2xs`, `--radius-pill`, and
`--color-focus-ring`. These may currently fall back poorly or depend on stale
CSS assumptions. They should be normalized into the token layer before surface
polish continues.

Gap: the project has shared semantic color tokens, but component CSS still
contains many local density decisions and local chip/status classes. Most use
theme variables rather than raw colors, which is good, but the enforcement
layer cannot yet distinguish intentional dense output from accidental cramped
UI.

First minimal change: add/normalize spacing and shape utilities in the shared
token layer without redesigning surfaces. Keep existing token names stable
where possible, but make the shared rhythm explicit: tight `4px`, normal `8px`,
roomy `12px`, panel `8px+`, and a real pill radius/focus-ring variable.

### Widget / Module Shell

Gap: V1 and V2 shells coexist, which is acceptable, but enforcement is split.
`WidgetFrame` owns V1 chrome/logs while `WidgetV2Shell` owns V2 display
structure. There is no shared rule or test that every widget body starts with
a deliberate padded/scrollable content region.

Gap: `WidgetV2Shell` header and toolbar use current tiny token values
indirectly, so shell-level compliance depends on the token cleanup above.

First minimal change: harden `WidgetV2Shell` spacing, toolbar wrap behavior,
and scroll-region expectations after tokens are normalized. Do not rewrite
`WidgetHost` or migrate all V1 widgets in this phase.

### Bounded Popup Shell

Strength: `PopupShell` and `WidgetPopupShell` are close to the contract. They
support bounded placement, focus, Escape/outside close, draggable header
regions, and standard header/body/footer composition.

Gap: unsafe close behavior is not modeled as a shared option. `PopupShell`
closes on Escape and outside pointer by default. Flows with unsaved input,
destructive review, active operations, or risky state need a reusable close
guard rather than local ad hoc blocking.

Gap: footer stickiness and body scroll are provided by CSS/class convention,
not guaranteed by component API. Existing KnowledgeV2 and QueueV2 popups set
body max-heights locally.

First minimal change: extend the popup shell contract in code with explicit
close policy and standard scrollable-body/sticky-footer classes. Then migrate
KnowledgeV2 and QueueV2 popup class names onto that shared behavior.

### Topbar / Control Groups

Gap: `WidgetV2Toolbar` exists, but there is no shared `ActionGroup` or
command-bar primitive that distinguishes primary actions, secondary action
groups, filters, refresh/view controls, and disabled reasons.

Gap: KnowledgeV2, QueueV2, WorkspaceAgentV2, Workbench top bar, Notes toolbar,
and Terminal settings/action clusters each define local group layout and
responsive behavior.

First minimal change: add a small shared `ActionGroup`/toolbar utility layer
over existing `Button`, `Input`, and `Select`, focused on wrapping, visible
gaps, primary/secondary grouping, and disabled reason presentation. Avoid a
large navigation/topbar redesign.

### Table / List / Card Patterns

Gap: no generic shared dense list/table/card primitive exists. KnowledgeV2 has
the most complete catalog row/menu pattern; QueueV2 has board cards; Activity
has timeline rows; Finder has domain-specific columns. These should remain
domain-shaped, but shared row spacing, metadata, action-menu, and empty-state
rules are not enforced.

Gap: KnowledgeV2 dense table rows intentionally use `gap: 0` and very tight
padding for a table-like layout. That can be valid if owned by a shared dense
table primitive, but it is currently local CSS.

First minimal change: do not create a broad generic table framework yet.
Extract only the reusable pieces needed next: row action menu, status chip,
empty/unavailable state extension, and compact metadata row utilities.

### Action Menu / Menu Button

Gap: no shared `ActionMenu` / `MenuButton` primitive exists. KnowledgeV2 has
local topbar and row menu implementations with tests. QueueV2 task cards do
not yet expose a shared row action menu pattern.

Gap: new row action work would likely copy KnowledgeV2 local CSS/markup unless
a primitive is added first.

First minimal change: extract a small shared `ActionMenu` over existing button
styling and popup/menu conventions. Required features: accessible trigger,
menu role/labels, disabled item reason, close-on-select, no action on hover or
focus, and destructive/external item handoff to confirmation.

### Destructive Confirmation

Gap: no shared confirmation primitive exists. KnowledgeV2 has a local delete
popup. Finder has local push/commit confirmation sections. Terminal and Direct
Work have local kill/stop confirmation-like controls. Legacy SkillLibrary
paths still use `window.confirm`.

First minimal change: add a shared `ConfirmActionPopup` or
`DestructiveConfirmation` on top of `WidgetPopupShell`. Migrate only the next
touched high-traffic destructive flow first; do not bulk-rewrite all
confirmations.

### Status / Badges / Warnings

Strength: shared `Badge` and `StatusDot` exist and many surfaces use theme
status variables.

Gap: KnowledgeV2, QueueV2, WorkspaceAgentV2, Agent Queue legacy CSS, Finder,
Git, and Terminal all have local status/chip classes and local tone names.
Shared semantics for `ready`, `working`, `warning`, `error`, `unsupported`,
`blocked`, `needs approval`, `partial`, and `unavailable` are not centralized.

Gap: `Badge` is intentionally small and does not encode disabled reasons,
warning persistence, or detail disclosure.

First minimal change: add a shared status vocabulary/documented mapping and a
small `StatusBadge`/`WarningInline` layer only where it replaces repeated
status semantics across KnowledgeV2, QueueV2, and WorkspaceAgentV2.

### Empty / Unavailable / Partial States

Strength: `EmptyState` exists and several surfaces provide honest unavailable
states.

Gap: `EmptyState` only supports title/text. It does not encode tone, action,
details, unsupported runtime, partial data, filtered-empty, or blocked states.
As a result, KnowledgeV2, QueueV2, WorkspaceAgentV2, Notes, Finder, Terminal,
JDBC, and Git all keep local state presentations.

First minimal change: extend or add a shared compact state primitive with:
`empty`, `filtered-empty`, `loading`, `partial`, `unavailable`, `unsupported`,
`blocked`, `failed`, and `warning` tones, optional implemented action, and
optional details. Keep it visually compact and theme-token based.

## Surface Inheritance Plan

### KnowledgeV2

Should inherit first from:

- normalized spacing/tokens;
- popup body/footer hardening;
- shared action menu/menu button;
- shared destructive confirmation;
- shared status and unavailable-state primitives.

Notes:

- Keep the catalog-only main surface and popup-only details direction.
- Preserve `KnowledgeV2ContextPicker` until another surface needs a generic
  context picker.
- Do not reintroduce legacy Knowledge / Skills UI, permanent right preview, or
  hidden context attach behavior.

### QueueV2

Should inherit first from:

- normalized spacing/tokens;
- `WidgetV2Toolbar`/action-group hardening;
- shared task-details popup body/footer behavior;
- shared status vocabulary;
- shared row/card action menu before adding more per-card actions.

Notes:

- Keep the board-first surface.
- Do not reintroduce the old Queue V1 Flow Map or dense V1 right rail.
- Do not add hidden scheduling, hidden execution, Terminal launch, Git
  mutation, or automatic acceptance affordances.

### Workspace Agent / WorkspaceAgentV2

Should inherit first from:

- normalized spacing/tokens;
- shared action group for composer/run controls;
- shared status badge/warning primitives for run status, context warnings, and
  result cards;
- shared compact state primitive for transcript/activity empty states.

Notes:

- Keep raw activity details and developer diagnostics collapsed by default.
- Do not add hidden context access, provider tools, Queue auto-creation, or
  execution affordances beyond current contracts.

### Widget Catalog

Should inherit first from:

- normalized spacing/tokens;
- bounded drawer/popup layout hardening if catalog presentation is touched;
- shared catalog/list item pattern only if item cards are redesigned;
- shared unavailable-state pattern for disabled/unavailable templates.

Notes:

- Preserve current product-facing inventory.
- Do not surface deferred or compatibility widgets unless explicitly scoped.

### Notes / Finder / Terminal

Trivially covered by shared primitives:

- token normalization should improve spacing consistency without behavior
  changes;
- shared `Button`, `Badge`, and future compact state primitive can be adopted
  opportunistically;
- future destructive flows should use the shared confirmation primitive.

Do not force domain-specific surfaces into generic primitives prematurely:

- Finder column navigation should remain Finder-specific.
- Terminal xterm/output internals should remain specialized; shared primitives
  should own surrounding chrome, actions, and unavailable states.
- Notes should not gain Notebook tabs, formatting tools, autosave, AI-in-Notes,
  or local delete/archive behavior as part of UI enforcement.

## Minimal Shared Primitive Changes Needed First

1. Normalize tokens and utilities:
   - define a contract-compliant spacing ladder;
   - add missing `--scaled-space-2xs`, `--radius-pill`, and focus-ring alias;
   - provide compact utility classes for product gaps, inline groups, and
     scrollable dense output boundaries.

2. Harden `WidgetPopupShell`:
   - standard bounded body and sticky footer classes;
   - explicit close policy for normal, unsaved, destructive, and active flows;
   - tests for Escape/outside close, body scroll, and footer reachability.

3. Add shared action grouping:
   - `ActionGroup`/toolbar utility for primary, secondary, filter, and quiet
     action clusters;
   - disabled reason convention using `title`, inline reason, or an
     accessible description.

4. Add shared `ActionMenu` / `MenuButton`:
   - accessible trigger/menu/items;
   - disabled reasons;
   - close-on-select;
   - no action on hover/focus;
   - confirmation handoff for destructive/external effects.

5. Add shared confirmation primitive:
   - use `WidgetPopupShell`;
   - show affected object identity, risk, cancel, confirm, and pending state;
   - migrate away from `window.confirm` when touching legacy flows.

6. Extend compact state and status primitives:
   - richer `EmptyState` or new `SurfaceState`;
   - shared status tone vocabulary over `Badge`/`StatusDot`;
   - compact warning/partial/unavailable components.

## Recommended Phased Implementation

### Phase 1: Spacing / Tokens / Utilities

- Update the shared token layer to expose contract-compliant spacing while
  minimizing visual churn.
- Add missing token aliases currently referenced by V2 CSS.
- Add lightweight utility classes for inline control groups, compact metadata,
  scrollable dense output, and product-safe panel padding.
- Add focused token/CSS regression checks if the current test stack can assert
  class presence or computed styles reliably.

Primary inheritors: all surfaces.

### Phase 2: Popup Bounded Layout Hardening

- Harden `WidgetPopupShell`/`PopupShell` close policy, scroll body, sticky
  footer, and bounded layout API.
- Add tests using KnowledgeV2 context picker/details and QueueV2 task details
  as representative consumers.
- Migrate local popup body/footer max-height classes only where shared behavior
  cleanly covers them.

Primary inheritors: KnowledgeV2, QueueV2, future Widget Catalog drawer/popup
work.

### Phase 3: Topbar / Action Group / Menu / Confirmation Primitives

- Add shared action group and menu primitives before more row/topbar action
  work.
- Add shared destructive confirmation over `WidgetPopupShell`.
- Migrate one high-traffic surface first, preferably KnowledgeV2 row actions
  because it already has the strongest menu tests and delete popup behavior.

Primary inheritors: KnowledgeV2 first, then QueueV2 and WorkspaceAgentV2.

### Phase 4: High-Traffic Surface Adoption

- Adopt shared primitives in KnowledgeV2, QueueV2, WorkspaceAgentV2, and Widget
  Catalog in focused blocks.
- Keep each block scoped to presentation reuse and tests.
- Notes, Finder, and Terminal should inherit only through shared tokens,
  buttons/badges/states, and future confirmations unless a task explicitly
  targets those surfaces.

### Phase 5: Status Docs And Enforcement

- Update `docs/UI_SHARED_PRIMITIVES_INDEX.md` after primitives exist.
- Add a status document or update `docs/UI_STANDARDS_STATUS.md` with adopted
  primitives, remaining local exceptions, and manual smoke coverage.
- Add self-test candidates from
  `docs/UI_STANDARDS_REVIEW_AND_SELF_TEST_BACKLOG.md` as focused component
  tests instead of broad screenshot checks.

## Risks And Follow-Ups

- Token changes can create broad visual churn. Keep Phase 1 mechanical,
  reversible, and visually smoke-tested at small and normal widget sizes.
- Popup close-policy changes can alter user interaction. Add tests for normal
  close, guarded close, focus return, and footer reachability before adoption.
- A generic table/list/card primitive could become overbroad. Prefer small
  shared pieces first: action menu, status, compact state, and metadata rows.
- Legacy CSS files contain valid reset-style `padding: 0` and `gap: 0` uses
  mixed with product density choices. Enforcement should avoid simple grep
  failure until shared dense-output/table utilities exist.
- Legacy SkillLibrary code still has `window.confirm` confirmation paths.
  Because KnowledgeV2 is the current product surface, migrate those only when
  the legacy paths are touched or formally retired.
- Some V2 CSS depends on local Agent Queue tag variables from legacy CSS.
  Queue token ownership should be clarified before separating V2 styles from
  legacy Agent Queue styling.

## Validation Notes

This was a docs-only audit. No frontend source, tests, Rust, Tauri, storage,
schema, runtime, provider, Queue, Knowledge, Terminal, Finder, Notes, or widget
behavior was changed.
