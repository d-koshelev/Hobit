# ModuleShell Theme Controls Audit

## Executive summary

Implementation follow-up: the simplification pass implemented the smaller
direct radius model from `docs/MODULE_VISUAL_SYSTEM_OVERENGINEERING_AUDIT.md`.
The active contract is now `--module-radius`, `--module-control-radius`, and
`--module-popup-radius`, with preview radius selectors setting those final
variables directly. The earlier recommendation to re-declare the full
`--module-theme-radius-*` bridge should be treated as superseded by that
simplification.

The Radius setting is wired through local React state and a local
`data-module-radius` hook, but the visible radius does not change because the
hook only overrides `--module-theme-radius`. The visible CSS rules consume
derived tokens such as `--module-shell-radius`,
`--module-header-radius`, `--module-theme-radius-control`, and
`--module-theme-radius-popup`. Those derived tokens are initialized from the
root default radius and are not re-declared inside the active Module theme
scope, so the selected radius value does not reach the properties that paint
the shell, popup, controls, notices, and preview placeholder lines.

The active settings options are semantically marked with `aria-pressed`, but
the only persistent visual difference is the active option using
`ModuleButton` variant `primary` while inactive options use `secondary`.
`ModuleButton` has no reusable selected/pressed/open visual state, no selected
tokens, and no CSS selector for `[aria-pressed="true"]`, so the option reads as
only a slightly different graphite button.

The current workbench texture is preview-local CSS on
`.module-shell-visual-preview`. The module body itself remains opaque graphite
and does not inherit the grid accidentally. The preview should get a
preview-local background variant control with `plain`, `grid`, `dots`, and
optional `dense-grid` variants. This should not become production settings,
Workbench state, persisted theme state, or part of the core module body theme.

## Current radius implementation trace

Radius state is stored in
`apps/desktop/frontend/src/design-system/widget/ModuleShellExample.tsx`.
`ModuleShellExample` defines:

- `moduleRadius`, defaulting to `"compact"`;
- `moduleShadow`, defaulting to `"popup"`;
- `settingsOpen`, defaulting to `false`.

The Radius UI is in the local Settings `ModulePopup`. The radius group maps
`MODULE_THEME_RADIUS_OPTIONS`:

- `Sharp` -> `"sharp"`;
- `Compact` -> `"compact"`;
- `Soft` -> `"soft"`.

Each radius option is rendered as a compact `ModuleButton` with:

- `aria-pressed={moduleRadius === option.value}`;
- `onClick={() => setModuleRadius(option.value)}`;
- `variant={moduleRadius === option.value ? "primary" : "secondary"}`.

The Shadow group follows the same pattern with `moduleShadow`,
`aria-pressed`, and `primary`/`secondary` variants.

The radius and shadow data hooks are written to the wrapper:

```tsx
<div
  className="module-theme-scope module-shell-example-theme"
  data-module-radius={moduleRadius}
  data-module-shadow={moduleShadow}
  data-module-theme-scope="true"
>
```

That wrapper is the current local Module theme scope. It contains the
`ModuleShell` and, after the popup movement work, the `ModulePopup` as a
sibling of the shell. The `ModuleShell` component itself only writes
`data-module-body-collapsed`; it does not receive `data-module-radius` or
`data-module-shadow`. `ModulePopup` also does not receive radius or shadow data
attributes in the current preview path.

The CSS selectors listening for the hook live in
`apps/desktop/frontend/src/styles/ui/widget.css`:

- `.module-theme-scope[data-module-radius="sharp"]`;
- `.module-theme-scope[data-module-radius="compact"]`;
- `.module-theme-scope[data-module-radius="soft"]`;
- direct fallback selectors for `.module-shell[data-module-radius="..."]`;
- direct fallback selectors for `.module-popup[data-module-radius="..."]`.

Those selectors set only `--module-theme-radius`:

- `sharp` sets it to `0px`;
- `compact` sets it to `2px`;
- `soft` sets it to `5px`.

The intended radius token chain is defined in
`apps/desktop/frontend/src/styles/tokens.css`:

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

The visible CSS consumes these derived tokens:

- `.module-shell` uses `border-radius: var(--module-shell-radius)`;
- `.module-header` uses `var(--module-header-radius) var(--module-header-radius) 0 0`;
- `.module-popup` uses `border-radius: var(--module-theme-radius-popup)`;
- `.module-text-input` and `.module-text-area` use `var(--module-theme-radius-control)`;
- `.module-button` uses `var(--module-theme-radius-control)`;
- `.module-status-badge` uses `var(--module-theme-radius-control)`;
- `.module-mono-text` uses `var(--module-theme-radius-control)`;
- `.module-notice` uses `var(--module-theme-radius-notice)`;
- `.module-shell-example-line` uses `var(--module-theme-radius-control)`.

Hardcoded or non-theme radius values still present in
`apps/desktop/frontend/src/styles/ui/widget.css` are mostly intentional:

- header actions and popup close actions use `border-radius: 0` to preserve
  the flat contiguous header segment model;
- status dots, scrollbar thumbs, and rail handles use `var(--radius-pill)`,
  which is correct for circular dots and thin handles rather than module
  corner theming.

The audited files do not show component-local `2px` radius declarations for
buttons, inputs, notices, popup, shell, or placeholder lines. The issue is not
that those controls still use hardcoded `2px`; it is that the scoped radius
choice does not update the final tokens those controls consume.

Selectors are not fundamentally scoped to the wrong DOM element. The current
`module-theme-scope` wrapper is the correct preview-local scope for the shell
and popup. The direct `.module-shell[data-module-radius]` and
`.module-popup[data-module-radius]` selectors are unused by the current
preview path, but they are not harmful.

CSS specificity is not the blocker. The data-attribute selectors are specific
enough to set `--module-theme-radius`. The problem is that the selectors stop
at the base token while the painted properties consume derived tokens that are
not re-declared in the scope.

The radius choices are also subtle by design: `compact` is `2px`, `soft` is
`5px`, and compact buttons are only 24px high. Even after the functional fix,
the strongest visible comparison will be `sharp` versus `soft` on the shell,
popup, input, textarea, notice, and placeholder line surfaces. That subtlety
should not hide the fact that the current root cause is functional token
propagation, not only visual smallness.

## Radius root cause

The precise root cause is the incomplete scoped token bridge.

The radius controls update `data-module-radius` on `.module-theme-scope`, and
the CSS correctly maps that data attribute to a new `--module-theme-radius`.
However, visible radius declarations do not use `--module-theme-radius`
directly. They use derived variables that were initialized in `:root` from the
default compact radius:

- `--module-shell-radius`;
- `--module-header-radius`;
- `--module-theme-radius-control`;
- `--module-theme-radius-notice`;
- `--module-theme-radius-popup`.

CSS custom property indirection is resolved for the element where the derived
custom property is declared before it is inherited. Because the derived radius
tokens are declared at the root default and are not re-declared inside
`.module-theme-scope[data-module-radius="..."]`, changing only
`--module-theme-radius` in the scope does not reliably change the inherited
final tokens consumed by `border-radius`.

The current tests miss this because they assert that:

- `data-module-radius` changes on the theme scope;
- the active button gets `aria-pressed="true"`;
- `widget.css` contains selectors for `data-module-radius`;
- `widget.css` contains `border-radius` declarations using theme variables.

They do not assert that the scoped radius selector updates the final consumed
radius tokens, and they do not verify computed radius on shell, popup, inputs,
buttons, notices, or placeholder lines.

The implemented fix removed the need for the complete bridge. Visible
declarations now consume the scoped final tokens directly:

- `--module-radius`;
- `--module-control-radius`;
- `--module-popup-radius`.

Each radius selector sets those final variables for `sharp`, `compact`, and
`soft`, so the local theme scope reaches the shell, header, popup, controls,
notices, badges, mono text, and static preview lines without relying on
root-level custom-property indirection.

## Active/selected state findings

The Radius control marks the active option with:

- `aria-pressed={moduleRadius === option.value}`;
- `variant="primary"` for the active option;
- `variant="secondary"` for inactive options.

The Shadow control uses the same mechanism:

- `aria-pressed={moduleShadow === option.value}`;
- `primary` when selected;
- `secondary` when not selected.

`ModuleButton` currently supports only these variants:

- `primary`;
- `secondary`;
- `ghost`;
- `danger`;
- `quiet`.

It supports `disabled` through the native button prop and CSS. It does not
support a first-class selected, pressed, checked, or open visual state. It
spreads `aria-pressed` through to the DOM, but `ModuleButton` does not add a
selected class or data attribute, and `widget.css` has no
`.module-button[aria-pressed="true"]` rule.

`ModuleHeaderAction` has a separate active path:

- `active` prop;
- `.module-header-action-active` class;
- `data-active="true"`;
- CSS that uses `--module-header-segment-active-background` and
  `--module-header-action-active-color`.

That header action state is not reused by `ModuleButton`, and it should not be
copied as header-specific styling into body/popup controls.

There is no reusable Module selected-state token for normal controls. Existing
related tokens are:

- global `--color-selected-surface` and `--color-selected-border`;
- module status/header tokens such as `--module-palette-active`,
  `--module-palette-active-surface`,
  `--module-header-segment-active-background`, and
  `--module-header-action-active-color`;
- module button variant tokens such as
  `--module-button-primary-background`,
  `--module-button-secondary-background`, and their hover/active states.

The active option is too subtle because the persistent selected state relies
on a variant swap:

- primary background is `#2a3139`;
- secondary background is `#1d232a`;
- both have transparent borders;
- both keep the same compact geometry and radius;
- text contrast is only modestly different;
- pointer `:active` styles are transient and do not represent selected state.

The next implementation should add a reusable selected button state that is
stronger than the current primary/secondary difference but still Flat Graphite
Compact. Recommended direction:

- keep square/compact geometry and the current radius token;
- style `.module-button[aria-pressed="true"]` as the reusable selected state;
- add module-specific selected tokens in `tokens.css`;
- use a stronger graphite surface, a calm graphite border, and optionally a
  thin inset accent rail;
- use graphite/charcoal active text, not neon and not blue as the base;
- avoid pill styling, oversized outline, glow, or heavy border.

The preview controls can continue using `aria-pressed` semantically. Once the
CSS selected state exists, the controls no longer need to rely solely on
`primary` versus `secondary` for visibility. The implementation may either
keep the variant swap and layer the `[aria-pressed="true"]` style on top, or
use a quieter base variant for all options and let `[aria-pressed="true"]`
carry the selected visual. The latter is visually cleaner, but it changes the
preview button composition slightly more.

## Workbench background findings

The current grid background is defined in
`apps/desktop/frontend/src/smoke/moduleShellVisualPreview.css` on
`.module-shell-visual-preview`.

It uses:

- `background-color: var(--module-preview-app-background)`;
- four linear gradients for fine and coarse grid lines;
- `--module-preview-grid-line`;
- `--module-preview-grid-line-muted`;
- `--workbench-grid-step`.

The grid selector is preview-local, but it consumes tokens from
`apps/desktop/frontend/src/styles/tokens.css`, including:

- `--module-preview-app-background`;
- `--module-preview-grid-line`;
- `--module-preview-grid-line-muted`;
- `--workbench-grid-step`.

The module body does not inherit the grid accidentally:

- `.module-body` has `background: var(--module-body-background)`;
- `.module-split` has `background: var(--module-body-background)`;
- `.module-shell-example-content` has
  `background: var(--module-body-background)`;
- the popup body has `background: var(--module-popup-background)`.

The module shell, module body, split regions, and popup remain opaque graphite
surfaces. The grid belongs to the preview app/stage, not to core module body
paint.

The current background cannot be varied through state. There is no
background-variant React state, no data attribute on the preview root, and no
CSS variant selectors such as
`.module-shell-visual-preview[data-module-preview-background="plain"]`.

The best owner for background selection is the smoke preview root, not the
ModuleShell primitive and not production Workbench state. The next
implementation should add preview-local state to the smoke preview app and a
data attribute on `.module-shell-visual-preview`. The Settings popup can
expose the controls, but the selected value should still only affect the local
preview root.

## Recommended background variants

Recommended preview-local variants:

- `plain`: solid graphite background using
  `--module-preview-app-background`; no texture.
- `grid`: the current subtle workbench grid. This should remain the default
  if the team wants continuity with the current preview.
- `dots`: a very subtle dot field, useful for judging whether texture can
  provide spatial reference with less visual directionality than a grid.
- `dense-grid`: a tighter engineering grid for stress-testing module edges,
  radius, shadows, and popup separation. It should remain quiet and optional.

These variants are useful because they test different visual questions:

- `plain` shows whether the ModuleShell can stand without canvas texture;
- `grid` tests the current technical Workbench direction;
- `dots` tests a quieter texture for dense operator surfaces;
- `dense-grid` tests whether the graphite palette and module edges hold up
  against more spatial detail.

The background selection must remain preview-local state. It must not write
local storage, Workspace state, Workbench state, widget state, persisted theme
preferences, backend/Tauri state, or production settings.

## Theme contract findings

`docs/MODULE_SHELL_HEADER_CONTRACT.md` already documents colors, radius, and
elevation/shadow as part of the ModuleShell theme contract. It explicitly says
the theme contract is not only a color palette, and it states:

- default radius is compact, around `2px`;
- module radius, popup radius, control radius, and notice radius should come
  from ModuleShell theme tokens;
- module and popup shadows are theme-controlled;
- the dummy visual preview may expose local radius and shadow controls;
- those controls are preview-only local React state;
- real persisted theme settings are future work.

The same contract already documents background texture correctly:

- the module body is an opaque base canvas;
- subtle grid texture may belong to the Workbench canvas or dev preview stage;
- the grid must not show through the core module body;
- module-owned popups remain solid opaque graphite/charcoal surfaces.

Background texture should remain preview/stage-only. It should not become part
of the core ModuleShell theme contract for module bodies, controls, popups, or
notices. The contract should be updated only to clarify that the dev visual
preview may offer local stage background variants for evaluation.

The contract does not yet say enough about selected/pressed control states.
It should add a short rule that selected module controls must be readable
without becoming neon, blue-based, pill-shaped, or heavily outlined. The
recommended contract language is that selected controls use a stronger
graphite surface, calm border or inset rail, and clear text contrast while
preserving compact radius.

## Implementation plan

Target display level: Minimal preview controls. The next block should keep the
settings popup compact and should not add Full/Expert theme editing UI.

Exact files to change:

- `apps/desktop/frontend/src/design-system/widget/ModuleControls.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModuleControls.test.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModulePopup.test.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModuleShellExample.tsx`;
- `apps/desktop/frontend/src/design-system/widget/ModuleShell.test.tsx`;
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.tsx`;
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.test.tsx`;
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreview.css`;
- `apps/desktop/frontend/src/styles/tokens.css`;
- `apps/desktop/frontend/src/styles/ui/widget.css`;
- `docs/MODULE_SHELL_HEADER_CONTRACT.md`.

`apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.tsx` is not in
the audit file list above, but it should be included in the implementation
because the preview root is the correct owner for the background data
attribute. Adding the background hook only inside `ModuleShellExample` would
either fail to reach `.module-shell-visual-preview` or require awkward parent
selection in CSS.

Radius fix approach:

- Keep `moduleRadius` as local preview state for now.
- Keep `data-module-radius` on the local Module theme scope.
- Update the radius selectors in `widget.css` so each selected radius updates
  the complete set of final radius tokens consumed by the shell, header,
  popup, controls, notices, badges, mono text, and preview placeholder lines.
- Avoid broad refactors of the token hierarchy.
- Prefer explicit scoped final-token declarations over relying on root-level
  custom-property indirection.
- Preserve `compact` as the default and keep values aligned with the contract:
  `sharp = 0px`, `compact = 2px`, `soft = 5px`.

Active/selected state approach:

- Add module-specific selected button tokens in `tokens.css`, for example:
  `--module-button-selected-background`,
  `--module-button-selected-border-color`,
  `--module-button-selected-color`, and
  `--module-button-selected-accent-color`.
- Add CSS for `.module-button[aria-pressed="true"]`.
- Keep the state flat, compact, and graphite-first.
- Use the existing 1px border slot or a small inset rail so layout does not
  shift.
- Do not use neon, bright blue, glow, pill radius, or heavy outline.
- Optionally add a derived data attribute from `ModuleButton` only if tests or
  future consumers need it. The smallest implementation can rely on
  `aria-pressed` because the preview controls already set it.

Background variant approach:

- Add a preview-local `ModulePreviewBackgroundVariant` union:
  `plain | grid | dots | dense-grid`.
- Store the background variant in local state owned by
  `ModuleShellVisualPreviewApp`.
- Write it as a data attribute on `.module-shell-visual-preview`, for example
  `data-module-preview-background={backgroundVariant}`.
- Pass the value and setter into `ModuleShellExample`, or expose a narrow
  callback so the existing Settings popup can render a Background group.
- Add a Background control group to the settings popup with compact
  `ModuleButton` options and `aria-pressed`.
- Implement variant CSS only in
  `apps/desktop/frontend/src/smoke/moduleShellVisualPreview.css`.
- Keep module body and popup backgrounds opaque.
- Do not add persisted settings or production theme plumbing.

Documentation updates:

- Update `docs/MODULE_SHELL_HEADER_CONTRACT.md` to clarify that radius scope
  must update the final module, popup, control, and notice radius tokens.
- Add selected/pressed control state guidance.
- Clarify that preview stage background variants are dev-preview-only and not
  part of module body theming.

## Test plan

Update focused tests only.

`ModuleShell.test.tsx`:

- Extend the radius hook test to assert that scoped radius selectors update
  the final consumed radius tokens, not only `--module-theme-radius`.
- Keep the existing interaction test for clicking `Soft` and `Sharp`.
- Add or adjust assertions so the active radius option remains
  `aria-pressed="true"`.

`ModuleControls.test.tsx`:

- Add source-level assertions for selected button tokens and the
  `.module-button[aria-pressed="true"]` selector.
- Render a `ModuleButton aria-pressed={true}` and assert the semantic
  attribute remains on the DOM node.
- Keep existing variant and disabled tests.

`ModulePopup.test.tsx`:

- Update radius/elevation source assertions so popup radius coverage checks
  final scoped popup radius behavior.

`moduleShellVisualPreviewApp.test.tsx`:

- Assert the preview root has the default background data attribute.
- Open Settings, select another Background option, and assert the preview root
  data attribute changes.
- Assert the selected background option gets `aria-pressed="true"`.
- Keep the isolation test that rejects product/runtime imports.

CSS/source checks:

- Add assertions that `moduleShellVisualPreview.css` contains the variant
  selectors for `plain`, `grid`, `dots`, and `dense-grid`.
- Avoid brittle pixel-perfect assertions.

Suggested validation for the implementation block:

- `git status --short --branch`;
- focused frontend tests covering ModuleControls, ModulePopup, ModuleShell,
  and moduleShellVisualPreviewApp;
- `npm.cmd run typecheck --prefix apps/desktop/frontend`;
- `npm.cmd run build --prefix apps/desktop/frontend`;
- `git diff --check`.

## Risks and non-goals

Risks:

- Fixing only `--module-theme-radius` again will leave the visible radius
  unchanged.
- Moving background state into ModuleShell primitives would make a preview
  stage concern look like a core module theme concern.
- Using global selected tokens may pull in blue/primary semantics and violate
  Flat Graphite Compact.
- Making the active option too strong can drift into heavy pill or outline
  styling.
- Adding background controls inside the popup requires a small prop/callback
  path from the preview app if the preview root owns the data attribute.

Non-goals:

- No real widget migration.
- No WidgetFrame, WidgetV2Shell, WidgetHost, registry, or catalog changes.
- No Workspace Agent, Agent Activity, Queue/QueueV2, Knowledge/Skills,
  Terminal, Notes, or Finder changes.
- No backend, Tauri, Rust, storage, schema, runtime, or business-logic
  changes.
- No persisted settings.
- No app-wide theme manager.
- No Workbench state or Workspace state mutation.
- No new dependencies.
- No broad formatter run.
- No commit for this audit block.

## Exact next implementation prompt

```text
ModuleShell Theme Controls Fix - Visual System Preview Only

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
- docs/FRONTEND_STRUCTURE_CONTRACT.md
- docs/UI_DESIGN_SYSTEM_CONTRACT.md
- docs/MODULE_SHELL_HEADER_CONTRACT.md
- docs/MODULE_THEME_CONTROLS_AUDIT.md

Scope:
Implement the recommendations from docs/MODULE_THEME_CONTROLS_AUDIT.md.
Keep all changes visual-system and smoke-preview local.

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

Do:
- Fix the Radius setting so Sharp, Compact, and Soft update the final visible
  radius tokens consumed by ModuleShell, ModuleHeader, ModulePopup,
  ModuleControls, notices, badges, mono text, and preview placeholder lines.
- Keep compact as the default radius.
- Preserve the preview-local `data-module-radius` path.
- Add a stronger but minimal selected state for ModuleButton when
  `aria-pressed="true"`.
- Keep selected styling Flat Graphite Compact: stronger graphite surface,
  calm border or small inset rail, readable text, no neon, no blue base, no
  pill styling, no heavy outline, no glow.
- Add preview-local background variants: `plain`, `grid`, `dots`, and
  `dense-grid`.
- Keep background variant state local to the smoke visual preview.
- Put the background data attribute on the `.module-shell-visual-preview`
  root.
- Add compact Background controls to the existing Settings popup.
- Keep module bodies, split regions, and popup bodies opaque graphite surfaces.
- Update focused tests for radius token propagation, selected button state,
  background variant interaction, and CSS variant selectors.
- Update docs/MODULE_SHELL_HEADER_CONTRACT.md with radius token bridge,
  selected/pressed control state, and preview-only background variant guidance.

Do not:
- Do not migrate real widgets.
- Do not touch Workspace Agent, Agent Activity, Queue/QueueV2, Knowledge/Skills,
  Terminal, Notes, Finder, WidgetFrame, WidgetV2Shell, WidgetHost, registry, or
  catalog.
- Do not touch backend, Tauri, Rust, storage, schema, runtime, or business
  logic.
- Do not add persistence, production settings, app-wide theme management,
  Workbench state, Workspace state, a global popup manager, or new
  dependencies.
- Do not run broad formatters.
- Do not redesign the full preview surface.

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
