# Module Shell/Header Contract

## Purpose

This contract defines the shared visual foundation for Hobit module shell and
header presentation.

It does not migrate any real module, change `WidgetFrame`, change
`WidgetV2Shell`, add widget registry behavior, add runtime behavior, add
backend/Tauri/storage/schema behavior, or change any domain widget logic.

## Clean Canvas Module Model

A module is a clean canvas inside the active Workbench widget frame.

The visual model is:

- one top header;
- one body below it;
- one very thin horizontal separator line between header and body;
- no detached header block;
- no nested outer shell inside the active widget frame.

Everything below the separator line is module body content.

The module body is an opaque base canvas. A subtle grid texture may belong to
the Workbench canvas or a dev preview stage, but it must not show through the
core module body or make the module read as a transparent overlay.

The current ModuleShell visual direction is Flat Graphite Compact. The
Workbench/dev preview stage may use a very subtle graphite grid texture to
suggest a technical workbench surface. Module body regions and module-owned
popups must remain solid opaque graphite/charcoal surfaces with no glass,
neon, or blue/navy base treatment.

The ModuleShell base palette is graphite / charcoal. Base surfaces, body
regions, popups, rails, borders, skeletons, and preview-stage grid tones must
not use blue/navy as their foundation. Blue is reserved only for explicit
focus/selection/active accents in later product-ready states.

`WidgetFrame` remains the single active outer shell for current product widgets.
`ModuleShell` and `ModuleHeader` are presentational primitives only. They do
not replace `WidgetFrame`, bypass `WidgetHost`, or create another production
shell path.

## Module Theme Contract

The ModuleShell theme contract includes colors, radius, and elevation/shadow
behavior. ModuleShell visuals are not only a color palette.

The default Hobit direction is Flat Graphite Compact:

- graphite / charcoal is the base palette for module surfaces;
- blue is not a base surface color and is reserved for future explicit
  focus, selection, or active accents;
- default radius is compact, around 2px;
- radius uses a small direct token model: `--module-radius`,
  `--module-control-radius`, and `--module-popup-radius`;
- module shell, header, and notice radius consume `--module-radius`;
- inputs, text areas, buttons, status badges, mono text, and compact control
  surfaces consume `--module-control-radius`;
- module-owned popups consume `--module-popup-radius`;
- module shadow and popup shadow are theme-controlled;
- module shadow may default to none;
- popup shadow may be enabled as subtle elevation;
- no-shadow is a valid theme option for preview comparison.

The dummy ModuleShell visual preview may expose local radius and shadow
controls for visual-system development. Those controls are preview-only local
React state. They must not persist, write production settings, introduce an
app-wide theme manager, touch Workbench state, or change real widget behavior.
The preview radius control must update a local Module theme scope, with compact
as the default radius. That local scope must set the final direct radius
variables rather than an indirect bridge token, so the shell, popup, controls,
notices, inputs, buttons, badges, and static preview lines visibly change
together.

Selected or pressed module controls must be clearly readable while staying Flat
Graphite Compact. Use a flat stronger graphite surface, a calm low-contrast
graphite border around the whole button, and bright primary text. Ordinary
selected states must not use neon, glow, blue base surfaces, pill styling,
oversized radius, heavy outlines, left rails, left accent strips, or inset
left-side emphasis.
Preview option controls such as Radius, Shadows, and Background should share
the generic selected/pressed token path so the active option has an explicit
flat graphite color difference from inactive buttons without group-specific
selection styling.

The dummy visual preview may also expose local stage background variants for
visual-system evaluation: `plain`, `grid`, `fine-grid`, `dots`, `sparse-dots`,
`dense-grid`, `cross-grid`, and `noir`. These variants are preview/workbench
stage local only. They are not core ModuleShell body texture, production
settings, Workbench state, persisted preferences, or app-wide theme
management. The background hook belongs on the smoke preview root only. Module
body regions and module-owned popups must remain solid opaque
graphite/charcoal surfaces regardless of preview background.

Real user theme settings, persisted preferences, Workbench integration, and
real widget migration are future work and are not part of this contract.

## Header Structure

The module header has two anchored groups:

- left group flush to the left edge;
- right group flush to the right edge;
- the space between the groups is empty flexible space.

The header must not render a center placeholder segment.

The header must not become a continuous segmented toolbar across the whole
width. Segments may touch only inside the left group or inside the right group.
The flexible space between groups remains visually empty.

## Header Visual Rules

The header container has:

- no padding;
- minimal 2px corner radius;
- zero gap between elements inside each group;
- one full-width separator line below the header.

Module shell and header values must come from shared CSS variables in
`apps/desktop/frontend/src/styles/tokens.css`, with reusable selectors in
`apps/desktop/frontend/src/styles/ui/widget.css`.

State tones are visual-only and domain-free:

- idle;
- active;
- running;
- completed;
- blocked;
- error;
- draft;
- disabled.

The header state segment is an indicator, not a button or action. It shows only
a small semantic dot and the state label, such as `Completed`; the visible word
`State` is not rendered in the segment. The state segment shares the header
background by default and uses semantic color only as a dot and/or label accent.

Header action segments share the exact header background in their default
state. Visual change appears only on hover, active, open, focused, or disabled
states. Header actions have no visible default vertical separators, outlines,
raised surfaces, pill treatment, or floating button treatment. The only
permanent full-width header line is the header/body separator.

Module-owned popups should follow the same minimal header/body visual model:
solid opaque surface, 2px radius, calm border, quiet separation from the header
action area, and no glass or heavy shadow treatment.

Module-owned popups must not use bright default outlines or white edge
treatment. Default separation should come from a solid graphite surface, a
very subtle graphite shadow/elevation token, and at most a low-contrast
graphite edge. Stronger borders or shadows should appear only on hover, drag,
active, or focus-visible states when needed. Focus-visible styling must remain
keyboard-accessible while staying quiet, using muted graphite or an approved
calm accent rather than white, blue, neon, or OS-window-like outlines.

Module-owned popups are floating mini-module surfaces above the module canvas.
Opening from a header action must not make the popup part of the header layout
or a glued dropdown. Movement, when demonstrated in the dummy example, is
local, non-persistent visual state only.

## Module UI Blocks

Module-level inputs, buttons, statuses, text blocks, key/value rows, and
notices are visual-system primitives for future module body composition.

These primitives are domain-free. They must not know about Workspace Agent,
Queue, Knowledge / Skills, Terminal, Notes, Finder, runtime, storage, backend,
Tauri, widget registry, or business state. Real widgets may adopt them only in
later focused migration phases with explicit scope.

Module UI blocks should feel like parts of one graphite/charcoal module canvas:
use minimal frames, 2px radius, calm semantic tones, subtle focus states, and
compact action states. Prefer text hierarchy, alignment, thin separators, rails,
and local status signals over nested cards or heavy bordered boxes.

## ModulePopup Primitive

`ModulePopup` is the reusable floating mini-module surface for module-owned
visual popups. It follows the same header/body model as `ModuleShell`: a
compact header stripe, one thin separator, and a body slot that owns popup
content and scrolling.

The popup header is the drag handle. Popup movement is local React state only
for now, with no persistence, backend calls, Workbench layout integration, or
global drag manager. A popup opened from a module header action must remain a
floating surface above the module canvas; it must not become a dropdown glued
to the button or part of the header layout.

`ModulePopup` is domain-free visual-system code. It must not contain product
settings, Workspace Agent, Queue, Knowledge, Terminal, Notes, Finder, backend,
storage, runtime, registry, or real widget migration logic. Real modules may
adopt it later only in a dedicated migration phase with explicit scope.

When a dummy example demonstrates `ModulePopup` movement, the popup/floating
layer belongs in the local stage or Workbench overlay coordinate space, not as
a descendant constrained by the parent `ModuleShell` rectangle. The popup must
not be clipped or width-clamped by the module shell or module body. Any future
movement bounds should use only the local stage or visible app viewport safe
margins, remain local React state, and must not add persistence, Workbench
layout integration, or an app-wide popup manager.

## Movable Rail Primitive

Module-owned rails are reusable presentational splitters for module body
regions. They are visual-system primitives only.

Supported orientations:

- vertical rail: splits left and right regions and resizes horizontally;
- horizontal rail: splits top and bottom regions and resizes vertically.

Rail sizing state is local React state owned by the primitive. It must not
persist layout, call backend/Tauri APIs, integrate with Workbench layout,
create an app-wide drag manager, migrate real widgets, or mutate widget
instances.

Rails expose separator semantics with `role="separator"` and matching
`aria-orientation`. Pointer dragging may clamp local primary and secondary
region sizes so module regions do not collapse below configured minimums.
Keyboard resizing can be added later, but this visual-system block does not
require it.

Rail styling must stay thin and calm, use module/theme tokens, and avoid
blue/navy base colors, glow, heavy borders, or card-in-card composition.

## Minimize Behavior

The minimize control lives in the right header group.

Minimize collapses only the module body:

- the header remains visible;
- the left and right header groups remain visible;
- the body content is hidden;
- the module top-left visual position remains anchored and does not move when
  collapsed or expanded;
- no widget instance is created, removed, floated, docked, persisted, or
  migrated;
- module-local body collapses remain separate from shell minimize.

The first implementation keeps collapse state local to the caller or test
fixture. Persisted minimize, Dock behavior, external popout behavior, and
presence-zone behavior are later product decisions only.

## Dummy Example

`ModuleShellExample` exists only to validate the visual primitive in isolation.

The example must use static content only. It must not import or depend on real
Workspace Agent, Agent Queue, Knowledge / Skills, Terminal, Notes, Agent
Activity, scheduler, runtime, backend, Tauri, storage, or Workbench modules.

The example may demonstrate the movable rail primitive with one vertical split
and one nested horizontal split, using local state only and static placeholder
content.

The dummy example must not be added to the normal widget catalog or wired into
production Workbench flows.

## Forbidden Logic

`ModuleShell` and `ModuleHeader` must not contain:

- Workspace Agent logic;
- Agent Queue or QueueV2 logic;
- Knowledge / Skills logic;
- Terminal logic;
- Notes logic;
- Agent Activity logic;
- scheduler, worker, executor, provider, or Codex logic;
- persistence, storage, backend, Tauri, schema, or IPC logic;
- task, item, session, connector, note, skill, document, queue, run, or widget
  state derivation;
- natural-language routing;
- debug/report parsing.

The primitives may render slots, CSS classes, state tone class names, action
segments, body content, and a body-minimize button. Callers own all domain
state and behavior.

## Real Module Migration

No real module is migrated by this foundation block.

Real module migration must happen in later focused phases only, after the
relevant module contract and migration scope are explicit. Each migration must
preserve widget IDs, registry behavior, runtime behavior, storage, APIs,
operator approval boundaries, and existing product semantics.

## Explicit Non-Goals

Do not migrate or modify:

- Workspace Agent;
- Agent Activity;
- Agent Queue or QueueV2;
- Knowledge / Skills;
- Notes;
- Terminal;
- Finder, except for future shared import/export plumbing when explicitly
  requested.

Do not change:

- runtime behavior;
- Queue scheduler or execution;
- Workspace Agent execution;
- Knowledge APIs or storage;
- backend, Tauri, schema, or storage;
- persisted widget IDs;
- widget registry behavior;
- natural-language routing;
- CSS reset or broad app-wide visual style.
