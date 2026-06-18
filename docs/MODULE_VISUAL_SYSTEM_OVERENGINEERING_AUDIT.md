# ModuleShell Visual System Overengineering Audit

## Executive summary

The current visual-system direction is useful, but the implementation is
starting to look like a theme engine before the first real widget migration.
The primitives themselves are mostly justified: `ModuleShell`,
`ModuleHeader`, `ModulePopup`, `ModuleSplit`/`ModuleRail`, and the basic
controls solve real upcoming layout and visual consistency problems. The
overengineering risk is concentrated in the token model, preview settings, CSS
ownership, and tests.

The strongest signal is the token inventory. `tokens.css` currently declares
189 unique `--module-*` variables. `widget.css` and the preview CSS consume
146 unique `--module-*` variables outside the token file, and 51 declared
module variables are not used outside token aliasing. Some of those are
legitimate base palette variables, but many are one-to-one aliases or
future-facing bridge variables.

Radius is the clearest example. The current model has ten radius-related
variables:

- `--module-theme-radius`;
- `--module-theme-radius-control`;
- `--module-theme-radius-module`;
- `--module-theme-radius-notice`;
- `--module-theme-radius-popup`;
- `--module-control-radius`;
- `--module-notice-radius`;
- `--module-popup-radius`;
- `--module-shell-radius`;
- `--module-header-radius`.

That is too much for three preview choices: Sharp, Compact, and Soft. The
previous `MODULE_THEME_CONTROLS_AUDIT` recommended bridging all final tokens so
radius works, but this audit treats that as a symptom that the radius token
model is wrong. The simpler model for this stage should be direct:
`--module-radius`, `--module-control-radius`, and `--module-popup-radius`.
Shell/header/notices can use `--module-radius`, controls can use
`--module-control-radius`, and popups can use `--module-popup-radius`.

The preview Settings popup is still useful as a visual laboratory, but it is
at risk of becoming fake production settings UI. Radius, shadow, and
background controls should remain local preview controls, clearly scoped to
the dummy preview, and should not become stable component props, Workbench
state, persistence, or an app-wide theme manager.

The immediate simplification should keep the visual concept and reduce the
machinery: simplify radius tokens, make selected buttons readable with one
direct `[aria-pressed="true"]` style, keep background variants preview-local,
and reduce tests that lock internal CSS implementation details.

Implementation status: the follow-up simplification pass implemented Phase A
for the isolated visual preview. Radius now uses `--module-radius`,
`--module-control-radius`, and `--module-popup-radius`; selected module
buttons use `[aria-pressed="true"]`; and the dev preview exposes local
`plain`, `grid`, `dots`, and `dense-grid` stage backgrounds.

## Component complexity audit

| Primitive | Classification | Findings | Recommendation |
| --- | --- | --- | --- |
| `ModuleShell` | Keep as stable primitive | Small prop surface: `bodyCollapsed`, `children`, native section attributes. No local state. It encodes only a visual shell and collapsed body data hook. Useful for migration. | Keep. Do not add theme props or production behavior. Consider making radius/background purely CSS-driven. |
| `ModuleHeader` | Keep as stable primitive | Small slot model: `left`, `right`. No state. Enforces the accepted two-group header structure. | Keep. This is useful stable infrastructure. |
| `ModuleHeaderGroup` | Keep but simplify public API | Internal layout helper exposed from `ModuleShell.tsx`. Useful inside the primitive, but less likely to be a public API real widgets should compose directly. | Keep implementation. Avoid promoting it in docs as primary API unless a real migration needs it. |
| `ModuleHeaderTitle` | Keep as stable primitive | Small wrapper for header title semantics and visual class. | Keep. |
| `ModuleHeaderState` | Keep as stable primitive | Visual-only state indicator with tone union. No behavior. Reusable for future module status. | Keep. Tone set is acceptable, but do not expand until real widgets need more states. |
| `ModuleHeaderAction` | Keep as stable primitive | Simple button segment with `active` prop. No state. Active state is header-specific and should not become generic button selection logic. | Keep. Avoid adding menus/open state until required. |
| `ModuleHeaderMinimize` | Keep but simplify expectations | Caller-controlled collapsed state and labels. Useful for previewing body collapse, but product minimize/dock behavior is explicitly future. | Keep as local body-collapse helper. Do not add persistence, dock, view mode, or widget instance behavior. |
| `ModuleBody` | Keep as stable primitive | Small wrapper with `collapsed`/`hidden`. Encodes the shell-body boundary and opaque body surface. | Keep. |
| `ModulePopup` | Keep but simplify | Prop surface is moderate: open, onClose, title, title id, body class, labels, default position. Local state manages dragging and position. It solves a real floating mini-module need, but combines layer, movement, dialog surface, and preview position in one primitive. | Keep for now. Postpone focus trap, portal, viewport collision, global manager, and production popup settings. Later consider splitting `ModulePopupLayer` from popup surface only if real migrations need it. |
| `ModuleSplit` | Keep but simplify tests | Prop surface is reasonable for a local splitter: orientation, default size, min/max. Local state and pointer drag are justified for visual split evaluation. | Keep. Do not add persistence or keyboard resizing yet. Tests should cover semantics and clamping, not exact internal style plumbing beyond the exposed CSS variable. |
| `ModuleRail` | Keep as paired primitive | Relies on `ModuleSplit` context. Separator semantics are useful. The rail itself is not useful outside split context. | Keep paired with `ModuleSplit`; do not make it a standalone layout system. |
| `ModuleControls` module | Keep but simplify surface | 19 exports and 453 lines. Core controls are useful, but the module now contains field helpers, status, text helpers, key/value, notice, and button variants. This is useful for a module body kit, but it is broad for pre-migration work. | Keep the core kit, but do not add more primitives until the first migration proves need. |
| `ModuleField` | Keep as stable primitive | Useful label/helper/error composition. It clones one child to wire id, `aria-describedby`, and invalid state. This is meaningful accessible infrastructure, not visual fluff. | Keep. Keep cloning logic small and documented by tests. |
| `ModuleFieldLabel` | Keep but do not emphasize API | Simple label wrapper. Mainly an internal part of `ModuleField`. | Keep export if already used, but treat as secondary. |
| `ModuleFieldHint` | Keep but do not emphasize API | Useful for helper/error text. Secondary API. | Keep. |
| `ModuleTextInput` | Keep as stable primitive | Thin input wrapper with invalid state. No local state. Reusable. | Keep. |
| `ModuleTextArea` | Keep as stable primitive | Thin textarea wrapper with invalid state. No local state. Reusable. | Keep. |
| `ModuleButton` | Keep as stable primitive | Useful and small. Variants are direct, but selected state is missing. | Keep. Add one simple selected style through `aria-pressed`; do not add a complex selected prop system. |
| `ModuleStatus` | Keep as stable primitive | Reusable visual state label with optional dot. No behavior. | Keep. |
| `ModuleStatusDot` | Keep but secondary API | Useful implementation piece, not likely a main migration entry point. | Keep as exported utility only if needed. |
| `ModuleStatusBadge` | Keep as stable primitive | Useful compact state badge. | Keep. |
| `ModuleTextBlock` | Keep as stable primitive | Very small text grouping primitive. Useful for consistent body typography. | Keep. |
| `ModuleSectionTitle` | Keep as stable primitive | Small heading wrapper. Useful. | Keep. |
| `ModuleMutedText` | Keep as preview/helper primitive | Useful but may be redundant with ordinary copy styles. | Keep for now; do not expand variants. |
| `ModuleMonoText` | Keep as preview/helper primitive | Useful for token/code labels. It may be more demo/documentation oriented than product-critical. | Keep for now; verify first migration need before treating as stable. |
| `ModuleKeyValueRow` | Keep but simplify if unused | Useful for structured metadata, but could become a table/list substitute if overused. | Keep for preview and early widgets. Do not add columns/actions yet. |
| `ModuleNotice` | Keep as stable primitive | Notices with thin accent rail match the visual direction and solve a real module-body need. | Keep. |
| `ModuleShellExample` | Keep only as preview/demo helper | It has four local states: body collapsed, radius, shadow, settings open. It imports many primitives and owns the dummy lab. It is not production UI. | Keep preview-only. Rename/copy should keep laboratory framing clear. |

No inspected primitive imports product widgets, runtime, backend, Tauri,
storage, registry, or business logic. The current accidental-product risk is
visual, not domain coupling.

## Theme token complexity audit

Current counts from inspected files:

- `tokens.css` declares 189 unique `--module-*` variables.
- `widget.css` references 143 unique `--module-*` variables.
- `moduleShellVisualPreview.css` references 3 unique `--module-*` variables.
- 51 declared module tokens are not used outside token aliasing or base-token
  indirection.
- `widget.css` has roughly 160 module-related selector blocks, including
  preview/example selectors.

Base token groups that are useful now:

- graphite/charcoal palette: app background, canvas, body, header, surface,
  popup surface, rail, text, semantic status colors;
- core spacing and size: header height, body padding/gap, rail thickness/hit
  area, popup width/max-height;
- control state colors: input surface/border, button variant backgrounds,
  notice tones;
- popup colors: background, border, separator, focus color.

Derived or bridge token groups:

- shell/header/body aliases such as `--module-shell-background`,
  `--module-header-background`, `--module-body-background`;
- status aliases such as `--module-status-active-color` through
  `--module-state-active-color` through `--module-palette-active`;
- radius bridge aliases;
- shadow bridge aliases;
- popup bridge aliases from palette tokens to popup-specific tokens.

Actually consumed painted tokens include:

- `--module-shell-border-color`, `--module-shell-radius`,
  `--module-shell-background`, `--module-theme-shadow-module`;
- `--module-header-height`, header separator/background/action tokens;
- `--module-popup-background`, `--module-popup-border-color`,
  `--module-theme-radius-popup`, `--module-theme-shadow-popup`;
- `--module-input-*` tokens for inputs;
- `--module-button-*` variant tokens;
- `--module-status-*` color tokens;
- `--module-notice-*` accent/background tokens;
- `--module-body-background`, padding/gap tokens;
- `--module-rail-*` tokens;
- preview grid tokens in `moduleShellVisualPreview.css`.

Tokens that appear unused or redundant at this stage:

- `--module-control-radius`, `--module-notice-radius`,
  `--module-popup-radius` are declared but painted CSS currently uses
  `--module-theme-radius-control`, `--module-theme-radius-notice`, and
  `--module-theme-radius-popup` instead.
- `--module-shell-shadow`, `--module-popup-shadow`, and
  `--module-popup-shadow-active` are declared but painted CSS uses
  `--module-theme-shadow-*`.
- `--module-body-rail-width` and `--module-body-rail-color` are declared but
  not used outside token aliasing.
- `--module-body-placeholder-border` and
  `--module-body-placeholder-surface` are declared but not consumed by the
  inspected painted CSS.
- `--module-state-*-background` tokens all resolve to the header state
  background and are not consumed outside token aliasing.
- Many `--module-palette-*` tokens are only base inputs to aliases. That is
  not inherently bad, but it becomes expensive when every alias is also
  exposed as if it were stable.

Hardcoded values that still exist despite tokens:

- `0px`, `2px`, and `5px` in radius selectors;
- `1px` borders/separators/outlines;
- `2px` notice rail and mono text padding;
- status dot sizes of `6px`;
- scrollbar width/height of `10px`;
- popup default width/height values are tokenized, but pointer position
  values are inline state.

These hardcoded values are not all problems. Pixel literals are acceptable for
small structural constants such as 1px separators, 2px accent rails, and 6px
dots. The over-tokenized area is not every pixel; it is alias chains that make
simple design decisions hard to reason about.

### Radius finding

Radius should not require a full final-token bridge. The need to re-declare
ten final radius variables for three preview choices shows that the model is
too indirect.

Recommended model for this stage:

- `--module-radius`: shell, header, notices, and neutral module surfaces;
- `--module-control-radius`: inputs, buttons, badges, mono text, placeholder
  lines;
- `--module-popup-radius`: popup shell;
- direct preview selectors that set those three values for `sharp`,
  `compact`, and `soft`.

This keeps flexibility where it matters: controls and popups can diverge later
without forcing a chain today. It removes the `--module-theme-radius-*` layer
and the unused radius aliases. If a future real migration proves that header
or notice radius must diverge from shell radius, add one token then.

## Preview settings complexity audit

Useful preview controls now:

- Radius: useful because it directly tests the Flat Graphite Compact geometry.
- Shadow: useful for comparing no-shadow, popup-only elevation, and
  module-plus-popup elevation.
- Background variant: useful only as stage/canvas evaluation, not as module
  body theming.

Controls that are too early:

- arbitrary color pickers;
- full theme preset editing;
- persisted visual preferences;
- production-looking settings categories;
- real Workbench theme integration.

The Settings popup is close to fake production settings UI because it is
called `Settings`, sits behind a header action, and contains choices that look
like app preferences. It should be framed as a visual preview lab. A future
simplification can rename the popup title to `Preview` or `Visual Preview`
and keep groups short: `Radius`, `Elevation`, `Stage`.

The controls should remain preview-only and should not become stable component
API. `ModuleShell`, `ModulePopup`, and `ModuleButton` should not gain props
like `radiusMode`, `shadowMode`, or `backgroundVariant`.

The control application path should be simple:

- one local wrapper data attribute for module radius/shadow;
- one preview root data attribute for stage background;
- no scattered per-component data hooks unless a component is used outside the
  scope wrapper;
- no persistence or global state.

`moduleShellVisualPreviewApp.tsx` was outside this audit's allowed inspection
list, but it is probably the right owner for a preview root background data
attribute in the next implementation prompt. That file should be explicitly
allowed in the next block if background variants are implemented.

## CSS selector complexity audit

Clearly scoped and understandable selectors:

- `.module-shell`, `.module-header`, `.module-body`;
- `.module-header-action` and its hover/focus/active states;
- `.module-popup`, `.module-popup-header`, `.module-popup-body`;
- `.module-split`, `.module-split-vertical`,
  `.module-split-horizontal`;
- `.module-rail` and orientation selectors;
- `.module-button-*` variant selectors;
- `.module-field-*`, `.module-status-*`, `.module-notice-*`.

Selectors that are too broad or likely to surprise future production widgets:

- `.module-popup-body p:not([class])` styles arbitrary unclassed paragraphs in
  popup bodies. It is convenient for the demo, but stable primitive CSS should
  prefer explicit text primitives.
- Shared scrollbar selectors include `.module-shell-visual-preview` inside
  `widget.css`, mixing preview-specific root styling into stable widget CSS.
- `.module-shell-example-*`, `.module-ui-kit-*`, and
  `.module-theme-preview-*` live in `widget.css`. They are preview/demo
  selectors and should not be part of stable primitive CSS long term.

Selectors that are too specific or redundant:

- radius and shadow selectors target `.module-theme-scope`,
  `.module-shell`, and `.module-popup`, but the current preview only uses the
  scope. Direct shell/popup data hooks are unused fallback surface area.
- repeated status tone selectors for status, dot, and badge are readable, but
  they add volume. Keep for now; do not expand until needed.
- popup movement selectors are understandable, but `ModulePopup` always
  renders a `.module-shell-floating-layer`. If real migrations need a stage
  layer owned by the host, this may become the wrong primitive boundary.

Preview/background selector status:

- current background grid is correctly preview-local in
  `moduleShellVisualPreview.css`;
- module body, split, and popup body remain opaque;
- no background variants exist yet;
- future background variant selectors should stay in the smoke preview CSS,
  not `widget.css`.

## Test complexity audit

Current visual-system test count:

- `ModuleShell.test.tsx`: 21 tests;
- `ModulePopup.test.tsx`: 9 tests;
- `ModuleControls.test.tsx`: 8 tests;
- `moduleShellVisualPreviewApp.test.tsx`: 5 tests;
- total: 43 tests.

Useful tests:

- basic shell/header/body rendering;
- body collapse keeps header visible;
- header actions are flat segments;
- header state is an indicator, not an action;
- popup open/close and close callback;
- popup is outside header/body layout in the preview;
- rail separator semantics and pointer resizing/clamping;
- field label/helper/error wiring;
- button variant rendering;
- status/notice tone rendering;
- no product/runtime imports in primitive and preview sources.

Brittle or over-specific tests:

- source-string tests that assert exact CSS token declarations;
- tests that assert exact inline popup coordinates such as `--module-popup-x`
  after drag;
- tests that assert exact parent class/DOM containment beyond the essential
  boundary;
- exhaustive dummy example text and button variant order assertions;
- repeated no-import deny lists across multiple files;
- tests that would fail if CSS variable names are simplified even when visual
  behavior remains correct.

Tests likely needed before real widget migration:

- domain-free import guard;
- stable primitive render/a11y smoke;
- popup open/close and non-body containment;
- rail resize/clamp if split rails are migrated;
- field label/helper/error wiring;
- button selected state semantics;
- preview-only controls do not touch product modules.

Tests that should be simplified or moved to smoke-level assertions:

- exact token chain tests should become simple assertions that radius variants
  set the small direct radius variables;
- popup movement tests should verify local movement and non-shell containment,
  not exact pixel math beyond one representative delta;
- dummy preview tests should verify presence of the lab and controls without
  locking every static text string;
- CSS source assertions should avoid encoding the full internal bridge model.

## Overengineering risk map

| Area | Current complexity | Value | Risk | Recommendation | Priority |
| --- | --- | --- | --- | --- | --- |
| ModuleShell | Low | High | Low | Keep stable and small. | Keep |
| ModuleHeader | Low | High | Low | Keep stable two-group model. | Keep |
| ModulePopup | Medium | High | Medium | Keep, but do not add portal/focus trap/bounds manager yet. | Simplify later |
| ModuleSplit/Rail | Medium | Medium | Medium | Keep local splitter; defer keyboard/persistence. | Keep |
| ModuleControls | Medium-high | High | Medium | Keep core controls; stop adding primitives before migration. | Keep |
| Theme tokens | High | High | High | Reduce alias chains, especially radius/shadow. | Immediate |
| Radius controls | High for the problem size | High | High | Replace ten-token bridge with three direct radius tokens. | Immediate |
| Shadow controls | Medium | Medium | Medium | Keep three preview modes, but reduce unused shadow aliases. | Soon |
| Background variants | Low currently, planned medium | Medium | Medium | Keep only preview-local root data attribute and CSS. | Immediate if implemented |
| Preview Settings popup | Medium | Medium | High | Reframe as preview lab; avoid production settings vocabulary. | Immediate |
| CSS selectors | High | High | Medium-high | Move preview/example selectors away from stable widget CSS over time. | Soon |
| Tests | High | High | Medium-high | Keep behavior tests; reduce CSS string and exact pixel locks. | Immediate |
| Documentation | Medium-high | Medium | Medium | Keep contracts shorter and mark preview-only features clearly. | Soon |

## Simplification principles

- Do not build a full theme engine before the first real widget migration.
- Preview controls are allowed, but they must stay local and simple.
- Stable primitives should expose small APIs and native attributes, not theme
  modes.
- Prefer one direct CSS variable over chains of aliases.
- Tokenize semantic decisions, not every pixel.
- Keep radius to a small set: module radius, control radius, popup radius.
- Keep background texture out of module body and out of stable primitive CSS.
- Do not create a production settings model inside the dummy preview.
- Do not let tests lock internal CSS implementation unnecessarily.
- Keep popup movement local; defer app-wide overlay managers.
- Keep rail resizing local; defer persistence and keyboard resizing.
- Do not add more primitives until one real widget migration proves the need.

## Recommended simplification plan

### Phase A: immediate simplification before continuing visual work

Goal: make the existing preview easier to understand and safer to continue.

Files likely affected:

- `apps/desktop/frontend/src/design-system/widget/ModuleControls.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModuleControls.test.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModulePopup.test.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModuleShellExample.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModuleShell.test.tsx`;
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.tsx`
  if background variants are implemented;
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.test.tsx`;
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreview.css`;
- `apps/desktop/frontend/src/styles/tokens.css`;
- `apps/desktop/frontend/src/styles/ui/widget.css`;
- `docs/MODULE_SHELL_HEADER_CONTRACT.md`;
- `docs/MODULE_THEME_CONTROLS_AUDIT.md` only if it would otherwise conflict
  with the simplified radius recommendation.

What to simplify:

- Replace the radius chain with direct tokens:
  `--module-radius`, `--module-control-radius`,
  `--module-popup-radius`.
- Make Sharp/Compact/Soft set those direct tokens from one local preview scope.
- Update painted CSS to consume those direct tokens.
- Add one selected button rule for `.module-button[aria-pressed="true"]`.
- Keep selected state graphite-first and compact.
- Add background variants only as preview-root CSS/data state.
- Rename or frame the Settings popup as preview-only if copy changes are in
  scope.
- Reduce tests that assert token chains and exact pixel internals.

What not to touch:

- real widgets;
- `WidgetFrame`, `WidgetV2Shell`, `WidgetHost`, registry/catalog;
- backend/Tauri/Rust/storage/runtime/business logic;
- production theme preferences;
- Workbench state;
- app-wide popup manager.

Validation needed:

- focused tests for ModuleShell, ModulePopup, ModuleControls, and the visual
  preview;
- frontend typecheck and build for implementation blocks;
- `git diff --check`;
- no broad formatter run.

### Phase B: keep useful primitives

Goal: preserve the reusable infrastructure that can support the first real
widget migration.

Keep:

- `ModuleShell`;
- `ModuleHeader`;
- `ModuleHeaderTitle`;
- `ModuleHeaderState`;
- `ModuleHeaderAction`;
- `ModuleHeaderMinimize` as caller-controlled body collapse only;
- `ModuleBody`;
- `ModulePopup`;
- `ModuleSplit` and `ModuleRail`;
- core `ModuleControls`: field, input, textarea, button, status, badge,
  notice, text block.

Simplify later:

- public API emphasis around helper exports such as `ModuleHeaderGroup`,
  `ModuleStatusDot`, `ModuleFieldLabel`, and `ModuleFieldHint`;
- preview/demo selectors currently living in `widget.css`;
- repeated no-import test helpers.

Validation needed:

- focused primitive tests;
- one preview smoke test;
- manual visual smoke before migration.

### Phase C: defer

Defer until a real widget migration or explicit product block:

- production theme settings;
- persisted visual preferences;
- app-wide or Workbench-level popup manager;
- React portals for ModulePopup;
- viewport collision/bounds manager for popups;
- full focus trap/modal behavior;
- keyboard resizing for rails;
- split layout persistence;
- widget migration;
- catalog/registry changes;
- global theme editor;
- color/theme controls beyond preview-local comparison.

## Exact next implementation prompt

```text
ModuleShell Visual System Simplification - Preview Only

Repository/worktree:
C:\Users\Dmitry\Documents\prj\hobit-agent-worktrees\ui-module-shell-polish

Branch:
agent/ui-module-shell-polish

Task type:
Focused implementation.

Read first:
- AGENTS.md
- docs/ACTIVE_CONTRACT_INDEX.md
- docs/CURRENT_WIDGET_SURFACE.md
- docs/CODE_ORGANIZATION.md
- docs/ARCHITECTURE.md
- docs/AGENT_UI_IMPLEMENTATION_RULES.md
- docs/UI_DESIGN_SYSTEM_CONTRACT.md
- docs/MODULE_SHELL_HEADER_CONTRACT.md
- docs/MODULE_THEME_CONTROLS_AUDIT.md
- docs/MODULE_VISUAL_SYSTEM_OVERENGINEERING_AUDIT.md

Scope:
Implement Phase A from docs/MODULE_VISUAL_SYSTEM_OVERENGINEERING_AUDIT.md.
This is simplification of the isolated ModuleShell visual preview and design
system primitives only. Do not add new product behavior.

Allowed files:
- apps/desktop/frontend/src/design-system/widget/ModuleControls.tsx
- apps/desktop/frontend/src/design-system/widget/ModuleControls.test.tsx
- apps/desktop/frontend/src/design-system/widget/ModulePopup.test.tsx
- apps/desktop/frontend/src/design-system/widget/ModuleShellExample.tsx
- apps/desktop/frontend/src/design-system/widget/ModuleShell.test.tsx
- apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.tsx
- apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.test.tsx
- apps/desktop/frontend/src/smoke/moduleShellVisualPreview.css
- apps/desktop/frontend/src/styles/tokens.css
- apps/desktop/frontend/src/styles/ui/widget.css
- docs/MODULE_SHELL_HEADER_CONTRACT.md
- docs/MODULE_THEME_CONTROLS_AUDIT.md

Do:
- Simplify radius tokens to a direct model:
  --module-radius, --module-control-radius, --module-popup-radius.
- Make Sharp, Compact, and Soft visibly work by setting those direct tokens
  from one local preview theme scope.
- Remove or stop using the over-indirect radius aliases:
  --module-theme-radius-control, --module-theme-radius-module,
  --module-theme-radius-notice, --module-theme-radius-popup,
  --module-shell-radius, --module-header-radius, --module-notice-radius,
  --module-popup-radius aliases that only point through another radius token.
- Keep compact as the default radius.
- Add a simple selected button style using .module-button[aria-pressed="true"].
- Keep selected styling Flat Graphite Compact: stronger graphite surface,
  calm border or small inset rail, readable text, no neon, no blue base,
  no pill styling, no glow, no heavy outline.
- Keep Radius and Shadow controls preview-local.
- Add background variants only as preview-local stage/root state and CSS:
  plain, grid, dots, dense-grid.
- Put background variant data on the .module-shell-visual-preview root.
- Keep module body, split regions, shell, and popup bodies opaque graphite.
- Keep the preview Settings popup clearly local to the visual lab; do not make
  it look like production settings.
- Simplify tests so they verify behavior and small direct token names, not the
  old internal token bridge or exact CSS string chains.
- Keep no-product-import tests, but avoid duplicating fragile deny-list logic
  more than necessary.
- Update docs to reflect the simpler radius model and preview-only settings.

Do not:
- Do not migrate real widgets.
- Do not touch Workspace Agent, Agent Activity, Queue/QueueV2,
  Knowledge/Skills, Terminal, Notes, Finder, WidgetFrame, WidgetV2Shell,
  WidgetHost, registry, or catalog.
- Do not touch backend, Tauri, Rust, storage, schema, runtime, or business
  logic.
- Do not add persistence, production settings, app-wide theme management,
  Workbench state, Workspace state, global popup manager, focus trap, portal,
  rail keyboard resizing, split persistence, or new dependencies.
- Do not run broad formatters.

Validation:
- git status --short --branch
- npm.cmd run test --prefix apps/desktop/frontend -- ModuleControls ModulePopup ModuleShell moduleShellVisualPreviewApp
- npm.cmd run typecheck --prefix apps/desktop/frontend
- npm.cmd run build --prefix apps/desktop/frontend
- git diff --check

Final response:
- files changed
- what changed
- tests/validation and results
- commit hash, or state clearly if no commit was created
- what was intentionally not implemented
```

## Explicit non-goals

- No code changes in this audit.
- No real widget migration.
- No production theme settings.
- No persistence.
- No Workbench state or Workspace state changes.
- No WidgetFrame, WidgetV2Shell, WidgetHost, registry, or catalog changes.
- No backend, Tauri, Rust, storage, schema, runtime, or business-logic
  changes.
- No global popup manager.
- No global drag manager.
- No new dependencies.
- No broad formatter run.
- No commit.
