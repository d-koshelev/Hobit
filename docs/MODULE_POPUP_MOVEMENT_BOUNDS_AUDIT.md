# ModulePopup Movement Bounds Audit

## Executive Summary

`ModulePopup` currently looks like a floating mini-module, but its DOM and CSS
positioning still make the parent `ModuleShell` rectangle the effective
coordinate and horizontal bounds model.

The popup is not rendered inside `.module-body` and is not clipped by
`.module-body`. However, the popup's local floating layer is rendered as a
child of `.module-shell`, and `.module-shell` is the positioned ancestor for
that layer. The popup uses absolute positioning plus CSS custom properties for
`x/y`. React drag state itself is not clamped, but CSS clamps the rendered
horizontal position against `100%` of the local floating layer, which currently
matches the module shell.

Recommended next implementation: move the popup layer out of the
`ModuleShell` rectangle and into a local preview/stage floating layer, while
keeping local React state only. Do not add persistence, backend calls,
Workbench integration, a global popup manager, or real widget migration.

## Current Rendering And Positioning Model

Inspected files:

- `apps/desktop/frontend/src/design-system/widget/ModulePopup.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModulePopup.test.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModuleShell.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModuleShellExample.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModuleShell.test.tsx`
- `apps/desktop/frontend/src/design-system/widget/ModuleSplit.tsx`
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.tsx`
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreviewApp.test.tsx`
- `apps/desktop/frontend/src/smoke/moduleShellVisualPreview.css`
- `apps/desktop/frontend/src/styles/tokens.css`
- `apps/desktop/frontend/src/styles/ui/widget.css`
- `docs/MODULE_SHELL_HEADER_CONTRACT.md`

Current DOM path:

- `ModuleShellVisualPreviewApp` renders `.module-shell-visual-preview__stage`.
- `ModuleShellExample` renders `ModuleShell`.
- Inside `ModuleShell`, `ModuleShellExample` renders `ModuleHeader`,
  then `ModulePopup`, then `ModuleBody`.
- `ModulePopup` returns a `.module-shell-floating-layer` wrapper.
- The `.module-popup` dialog is rendered inside that wrapper.

Current placement answer:

- `ModulePopup` is rendered inside `ModuleShell`.
- It is not rendered inside `.module-header`.
- It is not rendered inside `.module-body`.
- It is inside a local `.module-shell-floating-layer`.
- The preview stage contains the popup only indirectly through the
  `ModuleShell`.

Current coordinate system:

- `.module-shell` has `position: relative`.
- `.module-shell-floating-layer` has `position: absolute` and `inset: 0`.
- `.module-popup` has `position: absolute`.
- Therefore the popup's `top` and `left` are relative to
  `.module-shell-floating-layer`, and that layer is sized and positioned by
  `.module-shell`.
- The module shell is the effective containing block for current popup
  positioning.

Current position mechanics:

- React stores local `position` state in `ModulePopup`.
- Pointer drag updates `position.x` and `position.y` from pointer deltas.
- React writes `--module-popup-x` and `--module-popup-y` inline on
  `.module-popup`.
- CSS consumes those variables through `top` and `left`.
- The popup does not use a React portal.
- The popup does not use `position: fixed`.
- The popup does not use transforms for placement.

## Current Bounds And Clipping Findings

React drag behavior:

- Drag is not clamped in React state.
- `startPopupDrag` stores the initial position and pointer coordinates.
- Window-level `pointermove` updates `x` and `y` with a direct delta.
- No `getBoundingClientRect`, module width, stage width, viewport width, or
  measured bounds are used by `ModulePopup.tsx`.

CSS bounds behavior:

- Rendered horizontal position is clamped in CSS.
- `.module-popup` uses:
  - `left: max(var(--space-xl), min(var(--module-popup-x), max(... calc(100% - var(--module-popup-width) - var(--space-xl)))))`
  - `width: min(var(--module-popup-width), calc(100% - var(--space-2xl)))`
- Because `100%` resolves against the `.module-shell-floating-layer`, and the
  layer is currently inside the module shell, the rendered popup is
  horizontally constrained by the module shell/layer width.
- `top` is lower-clamped with `max(var(--space-xl), var(--module-popup-y))`.
  This prevents dragging above the layer's top safe margin.
- There is no rendered bottom clamp against the module shell.
- `max-height: min(var(--module-popup-max-height), calc(100vh - var(--space-2xl)))`
  is viewport-based, but only for popup height.

Default/open position:

- `ModulePopup` defaults to `{ x: 420, y: 44 }`.
- `ModuleShellExample` passes the same default as
  `DEFAULT_SETTINGS_POPUP_POSITION`.
- Open does not measure the settings button, module shell, stage, or viewport.
- Open does not compute collision or viewport-safe placement.

Measured module bounds:

- `ModulePopup.tsx` does not measure module width or height.
- `ModuleShellExample.tsx` does not measure module width or height.
- `ModuleSplit.tsx` does measure split bounds, but only for rail resizing.
  That clamp is unrelated to popup movement.

Current tests:

- `ModulePopup.test.tsx` asserts open/closed rendering, close action, drag
  handle metadata, drag-updated inline CSS variables, and domain-free imports.
- `ModuleShell.test.tsx` asserts the dummy settings popup opens/closes, is in
  `.module-shell-floating-layer`, is outside header/body layout, and drag
  updates inline CSS variables.
- `ModuleShell.test.tsx` includes a test named "places the dummy settings popup
  initial position inside the module width". That test reads the inline
  `--module-popup-x/y` variables and compares the hard-coded default x/width
  against a local `moduleWidth` constant. It does not prove measured
  module-bound clamping, and the mocked `.module-shell` bounds are not consumed
  by popup code.
- No current test asserts that a dragged popup is prevented from moving beyond
  the module width.
- No current test asserts that the computed rendered position can escape the
  module width.

## Overflow Chain Findings

Overflow rules in inspected files:

- `.module-shell-visual-preview` uses `overflow: visible`.
- `.module-shell-visual-preview__stage` uses `overflow: visible`.
- `.module-shell` uses `overflow: visible`.
- `.module-shell-floating-layer` uses `overflow: visible`.
- `.module-popup` uses `overflow: hidden`, clipping only the popup's own shell.
- `.module-popup-body` uses `overflow: auto`.
- `.module-body` uses `overflow: auto`.
- `.module-split-region` uses `overflow: auto`.
- Header/title text uses `overflow: hidden` for truncation.

Current clipping answer:

- `.module-body` is not the popup's ancestor, so its `overflow: auto` does not
  clip the popup.
- `.module-shell` is currently `overflow: visible`.
- The preview root and preview stage are `overflow: visible` in the inspected
  preview CSS.
- The popup body has its own scroll path and the popup shell clips its own
  contents intentionally.
- Within inspected files, no ancestor should clip the popup after it is painted
  outside the module shell.
- The remaining practical constraint is not clipping; it is the CSS
  horizontal clamp and containing-block model tied to the module shell.

Z-index behavior:

- `.module-shell-floating-layer` uses `z-index: var(--module-popup-z-index)`,
  currently `4`.
- `.module-popup` uses `z-index: 1` inside that layer.
- This is enough to place the popup above local module body content.
- It does not create an app-level or Workbench-level overlay stack.
- The popup remains in the local stage/module DOM rather than an app-wide
  overlay manager.

## Architecture Options Comparison

### Option A: Keep Popup Inside `ModuleShell`, Remove Module-Bound Clamp

Description:

- Keep the `.module-shell-floating-layer` as a child of `.module-shell`.
- Remove CSS clamping that derives from the module/layer `100%`.
- Optionally compute stage or viewport bounds and convert them back into
  module-relative coordinates.

Evaluation:

- Complexity: moderate. Removing CSS clamp is easy; adding correct
  stage/viewport bounds from inside the shell needs DOM measurement and
  coordinate conversion.
- Safety: acceptable for the isolated preview if kept local and domain-free.
- Testability: good for inline state; computed CSS escape behavior is harder
  in jsdom unless tests assert DOM structure plus style variables.
- Future Workbench compatibility: partial. It keeps module-owned state, but
  still relies on shell overflow staying visible and ancestor clipping staying
  permissive.
- Global popup manager risk: low.
- Module body clipping risk: low because popup remains outside `.module-body`.
- Overflow bug risk: medium. Any future shell or Workbench clipping ancestor
  can still trap the popup.

Conclusion:

- Useful as a minimal CSS fix, but it keeps the wrong owner for the popup
  coordinate space.

### Option B: Render Popup In A Preview/Stage-Level Floating Layer

Description:

- Render the popup layer outside the `.module-shell` rectangle and inside a
  local preview/stage overlay.
- Keep `settingsOpen` and popup position as local React state.
- Bound against the preview/app viewport or a stage overlay rect only if
  bounds are implemented.

Evaluation:

- Complexity: moderate. It requires moving the popup DOM location or splitting
  the shell and popup layer in the dummy preview. It does not require a portal
  or global manager.
- Safety: strong for this branch. It is still visual-system-only and keeps
  real widgets untouched.
- Testability: strong. Tests can assert the layer is not a child of
  `.module-shell`, popup is not inside `.module-body`, drag changes local
  position, and movement is not clamped by module width.
- Future Workbench compatibility: good. It mirrors the likely Workbench model:
  widget/module surfaces remain independent, while floating mini-modules live
  in a stage/workbench overlay.
- Global popup manager risk: low if the layer remains local to the smoke
  preview and no shared app service is introduced.
- Module body clipping risk: low. The popup is outside body and shell scroll
  areas.
- Overflow bug risk: lower than Option A because the popup no longer depends
  on the module shell as containing block.

Conclusion:

- Best fit for the intended model and this isolated visual-system branch.

### Option C: Use A Lightweight React Portal To A Local Smoke-Preview Root

Description:

- Create a local preview floating root and portal `ModulePopup` into it.
- Keep the root local to the smoke preview rather than app-wide.

Evaluation:

- Complexity: medium-high. Portal target lifecycle, test setup, and SSR/null
  target handling add moving parts.
- Safety: acceptable only if the portal target is explicitly local to the
  smoke preview.
- Testability: good but requires portal-aware tests.
- Future Workbench compatibility: good if a future Workbench overlay root is
  introduced intentionally.
- Global popup manager risk: medium. A portal can become a premature global
  overlay pattern if generalized now.
- Module body clipping risk: very low.
- Overflow bug risk: low, assuming the portal root is outside clipping
  ancestors.

Conclusion:

- Technically clean, but too much mechanism for the current isolated visual
  preview.

### Option D: Keep Current DOM But Change Popup To `position: fixed`

Description:

- Leave popup rendered inside `.module-shell`.
- Change the popup to viewport-fixed coordinates.

Evaluation:

- Complexity: low for the first visible change.
- Safety: mixed. It bypasses module bounds but bakes viewport positioning into
  the primitive.
- Testability: moderate. Fixed positioning can be asserted by CSS/source, but
  stage-relative behavior is not naturally modeled.
- Future Workbench compatibility: weak. Workbench/stage overlays may need
  local coordinate systems, scroll awareness, and z-index ownership rather
  than viewport-fixed behavior.
- Global popup manager risk: low, but it creates an implicit app-level visual
  behavior inside a module primitive.
- Module body clipping risk: low unless transformed ancestors or app shells
  create fixed-position containing behavior.
- Overflow bug risk: medium. Fixed popups can ignore preview padding, top bars,
  stage boundaries, or embedded scroll containers.

Conclusion:

- Fast but not the right architectural direction.

## Recommended Implementation Approach

Use Option B for the next implementation block.

Recommended model:

- `ModulePopup` remains a visual-system mini-module primitive.
- The settings popup is rendered in a local preview/stage floating layer, not
  as a descendant of `.module-shell`.
- Local React state remains the only state:
  - open/closed;
  - current popup x/y;
  - drag active state.
- No persistence.
- No backend/Tauri calls.
- No Workbench layout integration.
- No app-wide popup manager.
- No real widget migration.
- No product/runtime imports.
- The popup is not constrained by the parent module rectangle.
- Optional bounds, if implemented in the next block, should use the preview/app
  viewport or explicit stage overlay rect with safe margins only.

Implementation shape to consider:

- Move the settings `ModulePopup` render path out of the `ModuleShell` subtree
  in the dummy preview. A simple fragment from `ModuleShellExample` can keep
  local state while returning the `ModuleShell` and `ModulePopup` as siblings,
  as long as the popup layer's containing block becomes the preview/stage
  overlay instead of `.module-shell`.
- Prefer a local preview/stage floating layer over a portal for now.
- Remove CSS horizontal clamping that resolves against the module shell.
- If bounds are retained, clamp against a stage/viewport rect in React state or
  CSS tied to the stage overlay, not the module shell.
- Keep popup content and header/body structure unchanged unless needed for the
  movement fix.

## Tests Required For Implementation

Focused tests for the next block:

- `ModulePopup` renders when open and returns `null` when closed.
- Close action calls `onClose`.
- Popup header remains the drag handle.
- Drag changes local popup position.
- Drag can move the popup beyond the parent module width, or the implementation
  otherwise proves it is clamped only by the stage/viewport and not by the
  module shell.
- The settings popup is not rendered inside `.module-body`.
- The settings popup is not rendered inside `.module-header`.
- The settings popup layer is not a child of `.module-shell` when testing the
  visual preview model.
- The popup is not clipped by the module shell:
  - `.module-shell` remains `overflow: visible`;
  - popup overlay is outside the shell or otherwise not constrained by shell
    overflow.
- If stage/viewport bounds are implemented:
  - negative drag clamps to the stage/viewport safe margin;
  - large positive drag clamps to the stage/viewport safe margin;
  - the clamp uses stage/viewport dimensions, not module dimensions.
- `moduleShellVisualPreviewApp.test.tsx` continues to assert no product/runtime
  imports.
- `ModulePopup.test.tsx` or `ModuleShell.test.tsx` continues to assert
  domain-free imports for `ModulePopup` and `ModuleShellExample`.
- No tests should import Workspace Agent, Agent Activity, Queue/QueueV2,
  Knowledge/Skills, Terminal, Notes, Finder, WidgetFrame, WidgetV2Shell,
  WidgetHost, registry/catalog, backend/Tauri, storage, schema, or runtime
  paths.

Avoid brittle pixel-perfect tests. Prefer DOM containment, local style state,
and measured-bound behavior where supported.

## Documentation Impact

`docs/MODULE_SHELL_HEADER_CONTRACT.md` should be updated in the implementation
block to clarify:

- `ModulePopup` is a floating mini-module over the Workbench/stage, not a
  dropdown glued to the module header action.
- `ModulePopup` must not be constrained by the parent `ModuleShell` rectangle.
- `ModulePopup` may be bounded by the stage or app viewport with safe margins
  only to avoid losing the popup.
- `ModulePopup` remains local and non-persistent until a future explicit
  Workbench popup manager exists.
- Current visual-system work must not add persistence, backend calls,
  Workbench layout integration, app-wide popup management, or real widget
  migration.

This audit block intentionally does not edit the contract.

## Risks And Non-Goals

Risks:

- Moving the popup layer outside `ModuleShell` can create a mismatch between
  module-owned state and stage-owned positioning if ownership is not kept
  explicit.
- Using CSS percentages from the wrong containing block can recreate the same
  module-bound clamp under a new DOM shape.
- Using `position: fixed` now may appear to solve the issue but can conflict
  with future Workbench stage coordinates.
- Adding a portal now can accidentally establish a global popup manager before
  the product model is ready.

Non-goals:

- No real widget migration.
- No WidgetFrame, WidgetV2Shell, WidgetHost, registry, or catalog changes.
- No Workspace Agent, Agent Activity, Queue/QueueV2, Knowledge/Skills,
  Terminal, Notes, or Finder inspection/migration.
- No backend, Tauri, Rust, storage, schema, runtime, or business-logic changes.
- No persistence.
- No Workbench movement/layout integration.
- No app-wide popup manager.
- No new dependencies.

## Exact Next Implementation Prompt

```text
ModulePopup Stage-Level Movement Fix - Visual System Only

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
- docs/PRODUCT_UI_VISUAL_CONTRACT.md
- docs/MODULE_SHELL_HEADER_CONTRACT.md
- docs/MODULE_POPUP_MOVEMENT_BOUNDS_AUDIT.md

Scope:
Implement the recommended Option B from
docs/MODULE_POPUP_MOVEMENT_BOUNDS_AUDIT.md.

Allowed files:
- apps/desktop/frontend/src/design-system/widget/ModulePopup.tsx
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
- Keep the settings popup local to the ModuleShell dummy preview.
- Render the popup/floating layer outside the parent ModuleShell rectangle and
  in a local preview/stage overlay.
- Keep popup movement in local React state only.
- Ensure drag movement is not bounded by the parent ModuleShell width.
- If bounds are implemented, bound only to the preview/app viewport or explicit
  stage overlay safe margins.
- Preserve popup header/body visual structure and close behavior.
- Update focused tests for open/close, drag, non-body rendering, non-shell
  containment, and no product/runtime imports.
- Update docs/MODULE_SHELL_HEADER_CONTRACT.md with the popup bounds model
  clarified by the audit.

Do not:
- Do not migrate real widgets.
- Do not inspect or modify Workspace Agent, Agent Activity, Queue/QueueV2,
  Knowledge/Skills, Terminal, Notes, or Finder.
- Do not touch WidgetFrame, WidgetV2Shell, WidgetHost, widget registry/catalog,
  backend/Tauri/Rust, storage/schema/runtime/business logic.
- Do not add persistence, Workbench layout integration, app-wide popup manager,
  global drag manager, or new dependencies.
- Do not use position: fixed unless the implementation notes explicitly justify
  why the stage-level approach is impossible.

Validation:
- git status --short --branch
- npm.cmd run test --prefix apps/desktop/frontend -- ModulePopup ModuleShell moduleShellVisualPreviewApp
- npm.cmd run typecheck --prefix apps/desktop/frontend
- npm.cmd run build --prefix apps/desktop/frontend
- git diff --check

Final response:
- files changed
- what changed
- tests/validation and results
- whether a commit was created
- what was intentionally not implemented
```
