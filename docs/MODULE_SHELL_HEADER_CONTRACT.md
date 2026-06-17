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

The module body is an opaque base canvas. Dotted grid texture may belong to the
Workbench canvas or a dev preview stage, but it must not show through the core
module body or make the module read as a transparent overlay.

The ModuleShell base palette is graphite / charcoal. Base surfaces, body
regions, popups, rails, borders, skeletons, and preview-stage dots must not use
blue/navy as their foundation. Blue is reserved only for explicit
focus/selection/active accents in later product-ready states.

`WidgetFrame` remains the single active outer shell for current product widgets.
`ModuleShell` and `ModuleHeader` are presentational primitives only. They do
not replace `WidgetFrame`, bypass `WidgetHost`, or create another production
shell path.

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

Module-owned popups should follow the same minimal header/body visual model:
solid opaque surface, 2px radius, calm border, quiet separation from the header
action area, and no glass or heavy shadow treatment.

Module-owned popups are floating mini-module surfaces above the module canvas.
Opening from a header action must not make the popup part of the header layout
or a glued dropdown. Movement, when demonstrated in the dummy example, is
local, non-persistent visual state only.

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
