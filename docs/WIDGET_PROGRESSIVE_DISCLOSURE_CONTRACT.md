# Widget Progressive Disclosure Contract

## Purpose

This contract defines progressive widget complexity levels for Hobit:

1. Minimal
2. Operational
3. Full / Expert

Hobit should stay simple by default while still allowing widgets to grow over
time. Widgets should expose the smallest useful surface first, then reveal more
context, controls, raw payloads, logs, history, and advanced configuration only
when the operator explicitly needs them.

This is a documentation and product/domain contract only. It does not implement
frontend UI, runtime behavior, Tauri commands, storage, schema, Agent execution,
Terminal behavior, Queue execution, Tool execution, or new widgets.

## Core Principle

Full widget complexity must not be the default first experience.

Every widget should start from the smallest useful surface for the current
milestone. Operational and Full / Expert views should be added in later focused
blocks when the simpler surface has been proven.

## Display Levels

### Minimal

Minimal is the smallest useful widget surface.

Minimal should provide:

- one primary action or status
- the minimum context required to understand that action or status
- compact copy
- clear safety/status language when needed
- no raw/debug payloads by default
- no broad configuration by default
- no walls of planned future behavior

Minimal is suitable for:

- calm Workbench default views
- compact widget surfaces
- future Dock / Indicator placement
- first implementation slices
- first demo paths

Minimal is not incomplete if it honestly solves one small operator need.

### Operational

Operational is the practical working surface.

Operational may provide:

- more controls
- more status/context
- structured result summaries
- ordinary decision support
- current run/result identifiers
- safe configuration required for normal work
- enough information for the operator to make normal decisions

Operational should still avoid raw/debug overload by default. It should keep
advanced payloads, raw logs, large histories, and expert configuration behind an
explicit expansion or separate Full / Expert surface.

### Full / Expert

Full / Expert is the complete detail surface.

Full / Expert may provide:

- raw payloads
- raw logs
- result JSON
- run history
- detailed lifecycle traces
- advanced configuration
- debugging state
- expert controls
- full inspection views

Full / Expert is intended for:

- inspection
- debugging
- expert operation
- expanded or floating views
- later implementation slices after Minimal and Operational are clear

Full / Expert should usually require explicit expansion, selection, or mode
change. It should not be the first visible complexity layer for complex widgets.

## General Rules

- New widgets start with Minimal first unless a prompt explicitly targets a
  different level.
- Operational and Full / Expert views should be separate later blocks when
  practical.
- Full complexity must not be exposed by default.
- Disabled planned controls should be minimized.
- Prefer clear read-only status text over many disabled buttons.
- Widget prompts should declare the intended level: Minimal, Operational, or
  Full / Expert.
- Prefer one display level per implementation block.
- If a widget begins to mix all three levels, split or simplify before adding
  more behavior.
- Raw/debug payloads belong in Full / Expert surfaces unless they are the
  widget's primary purpose.
- Planned future behavior should be summarized briefly, not rendered as a large
  inactive interface.
- Empty states should point to the next useful action rather than previewing a
  whole future product.

## Relationship To Current Hobit Widgets

### Terminal

Current level: Operational one-shot command runner.

Current Terminal behavior is a desktop-only one-shot local command path for
persisted Terminal widget instances. It accepts explicit program + argv +
working directory and stores run/log/result records.

Future direction:

- Minimal: latest run status plus a basic Run command surface.
- Operational: explicit program, argv, working directory, bounded caps, timeout,
  final stdout/stderr preview, and widget-local logs.
- Full / Expert: run history, raw result payloads, cancellation if explicitly
  implemented later, settings, and deeper diagnostics.

Shell mode, PTY, interactive stdin, streaming, command history, and Agent-driven
Terminal execution remain out of scope unless explicitly implemented in later
blocks.

### Agent Chat

Current level: Minimal / Operational proposal-only mock.

Current Agent Chat behavior accepts an operator prompt, lets the operator
explicitly select safe current-view metadata, generates a structured proposal
preview through the backend AI proposal boundary when an explicit provider is
configured, falls back to local/mock proposal generation when unavailable, and
can persist a proposal-only run/result artifact in desktop mode.

Future direction:

- Minimal: prompt plus Generate proposal.
- Operational: approved context selection, structured proposal sections,
  proposal-only safety status, and persisted run id/result id.
- Full / Expert: raw proposal payload, run artifacts, context debug views, and
  advanced inspection surfaces after real safety models exist.

Agent Chat must not become a hidden context reader, tool executor, Terminal
launcher, Queue launcher, or mutation path.

### Agent Monitoring

Current level: closer to Full / Expert read-only view.

Current Agent Monitoring reads persisted Agent Chat proposal-only artifacts and
shows Overview, Result, and Raw sections. That structure is useful for
observability, but it is too detailed to be the first visible layer for simple
proposal review.

Future direction:

- Minimal: latest proposal/result status summary.
- Operational: selected result summary, source widget, safety flags, and a clear
  path to create a review-only Queue item.
- Full / Expert: Raw / Overview / Result, full JSON payload, traces, and deeper
  run artifact inspection.

Agent Monitoring should be secondary for the first demo. It must not imply real
Agent runtime, streaming, Terminal result monitoring, arbitrary widget result
monitoring, or Queue execution.

### Agent Queue

Current level: Operational review inbox.

Current Agent Queue lists persisted review-only items created explicitly from
Agent Chat local mock proposal results and shows read-only details. AI proposal
artifacts remain visible in Agent Monitoring but do not add Queue execution or
approval/apply behavior.

Future direction:

- Minimal: review item list plus `needs_review` status.
- Operational: item detail, source proposal, prompt summary, proposed plan,
  safety flags, and proposed actions marked not executed.
- Full / Expert: decision history, response validation, execution traces,
  request/response snapshots, Git review links, and run observability links.

Execution, approval, apply, automatic acceptance, and executor launch controls
remain future behavior and should not clutter Minimal view.

### Template Library

Current level: planned/static preview.

Template Library should be demoted from the next primary demo unless the demo is
specifically about request/response template direction.

Future direction:

- Minimal: selected template list or one template summary.
- Operational: request preview, response expectation preview, and explicit
  local-only generated request preview.
- Full / Expert: template editing, revisions, validation rules, response
  capture, and history when those features are intentionally implemented.

Template surfaces must not become hidden prompt mutation or automatic execution.

### Dock

Current level: placeholder/static preview.

Dock should be treated as future Minimal / Indicator presentation. A static Dock
preview should not dominate the Workbench before real parking or presence
behavior exists.

Future direction:

- Minimal: compact indicator for existing WidgetInstances.
- Operational: Compact preview of an existing WidgetInstance.
- Full / Expert: detailed presence, rail, and layout management after the Dock
  identity model is proven.

Dock must preserve WidgetInstance identity and must not execute, refresh, or
mutate hidden state from an indicator.

### Git

Current level: Minimal / Operational read-only status widget.

Current Git behavior reads one manual desktop-only status snapshot for an
explicit transient repository root and renders a visual status summary.

Future direction:

- Minimal: repository path, Refresh, and clean/dirty/error status.
- Operational: grouped changed files and warning/status summaries.
- Full / Expert: diff, log, review surfaces, validation association, and commit
  or recovery controls when explicitly implemented later.

Git mutations remain approval-gated and must not appear as active controls in
Minimal surfaces.

### Notes

Current level: Minimal persisted body draft.

Current Notes behavior persists one `{ "body": "..." }` draft through explicit
save.

Future direction:

- Minimal: body plus Save.
- Operational: future tabs, formatting controls, and structured notebook
  navigation.
- Full / Expert: Markdown/rendered preview, diagram rendering, raw tools,
  review notes, and AI-assisted editing after explicit approval models exist.

Notes body content must not become hidden Agent Chat / Coordinator context.

## Relationship To Workbench Zones

Display level and Workbench placement are related but not identical.

- Dock / Indicator can host Minimal surfaces.
- Canvas widgets can host Minimal or Operational surfaces.
- Floating or expanded widgets can host Operational or Full / Expert surfaces.
- Full / Expert should usually require explicit expansion, selection, or mode
  change.

Placement must preserve WidgetInstance identity, state, configuration, logs,
results, and Workspace ownership.

## Relationship To Product Simplification Audit

`docs/PRODUCT_SIMPLIFICATION_AUDIT.md` identifies current Workbench complexity
risks after the Terminal and Agent proposal milestones.

Follow-up simplification blocks should use this contract to decide:

- what stays visible
- what is demoted
- what is postponed
- which disabled planned controls should become copy instead of buttons
- which raw/debug surfaces should move behind explicit expansion
- which widget surfaces should be Minimal for the next demo

The next simplification work should prioritize Terminal plus Agent proposal
review demo clarity over additional future-product previews.

## Prompting Rules For Future Codex Blocks

Every future widget block should declare a target display level:

- Minimal
- Operational
- Full / Expert

Rules for executor prompts:

- Do not add Full / Expert UI while implementing Minimal.
- Do not add advanced controls unless the block explicitly targets Operational
  or Full / Expert.
- Prefer one level per block.
- State whether raw payloads, logs, debug details, history, or configuration are
  in scope.
- State whether disabled planned controls are allowed, and keep them rare.
- If implementation needs multiple levels at once, stop and propose a split
  unless the extra surface is tiny and necessary.

## Non-Goals

This contract does not implement:

- frontend UI
- runtime behavior
- Tauri commands
- storage or schema changes
- Agent execution
- Terminal behavior
- Queue execution
- Tool execution
- LLM calls
- new widgets
- widget deletion or hiding
- response validation
- Dock behavior
- layout behavior
- preset behavior
- broad visual redesign

## Architecture Boundary

Progressive disclosure must preserve:

- Workbench as the product center
- every visible block as a Widget
- widgets as optional capabilities
- WidgetInstance identity across placement changes
- explicit, visible, approval-aware tool/action behavior
- no hidden context access
- no hidden execution
- no hidden mutation
- calm defaults with deeper detail available only when intentionally added
