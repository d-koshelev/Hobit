# Queue Singleton Contract

## Purpose

This contract defines the strict singleton invariant for the Workspace Queue.
It is a frontend registry/domain metadata and product-boundary contract. It
does not add Queue runtime behavior, scheduler behavior, storage schema,
backend/Tauri/IPC behavior, Queue execution, Agent Executor execution, Git
mutation, Terminal launch, or prompt-pack execution.

## Status

Current for Queue identity and UI-surface rules.

## Required Invariant

- Each Workspace has exactly one logical Workspace Queue.
- Each Workspace may have exactly one Queue UI view/widget.
- The Queue widget is the single canonical control surface for the Workspace
  Queue.
- Creating two Queue widgets or two Queue views in one Workspace is a critical
  bug.
- Multiple Queue UI views are not allowed even when they would point at the
  same Queue state.
- Queue Active/Pause state belongs to the singleton Workspace Queue, not to
  local widget state.
- Removing or hiding the Queue view must not delete Queue domain data.
- Clearing Queue data must be a separate explicit destructive action with the
  appropriate confirmation boundary.

## Registry Metadata

The saved-compatible Queue widget definition is the singleton Queue surface:

- widget definition id: `agent-queue`
- singleton: `true`
- singleton scope: `workspace`
- singleton key: `workspace-queue`

Non-Queue widgets must not inherit singleton metadata by default. Multi-instance
widgets such as Workspace Agent, Notes, and Terminal remain multi-instance
unless a future contract explicitly changes them.

Compatibility and deprecated widget definitions must not become new Queue
surfaces. Retained compatibility ids such as `agent-run` and `git` are not
Queue identities and must not receive the `workspace-queue` singleton key.

## QueueV2 Boundary

QueueV2 is the current Agent Queue visual implementation through the existing
saved-compatible `agent-queue` widget identity. `queue-v2` is not a separate
insertable Queue widget id and must not become a second Queue UI surface.

The active user-facing Queue product route is:

```text
WidgetHost -> AgentQueuePlaceholderWidget -> AgentQueueV2Board
```

This route preserves the `agent-queue` widget definition id and the
`agent-queue-placeholder` component key for saved workspace compatibility.

The retained WidgetV2 Queue shell may exist for compatibility, smoke, and
regression coverage, but it must route conceptually to the same singleton
Workspace Queue and must not introduce a second product Queue view.

## Prompt-Pack Imports

Prompt-pack imports that create Queue tasks target the singleton Workspace
Queue. Import flows should focus or open the singleton Queue view when a view
is needed. They must not create a second Queue widget/view to show imported
tasks.

Prompt-pack import does not run Queue tasks by itself, arm Queue execution,
launch Agent Executor, mutate Git, launch Terminal, or create hidden runtime
work.

## Presentation Versus Domain Data

Docking, floating, hiding, showing, focusing, or removing the Queue view is a
presentation or widget-instance lifecycle action. These actions do not delete
Queue tasks, run links, worker config, reports, tags, context attachments, or
other Queue-owned domain data.

Queue data clearing is a distinct destructive domain action and must not be
coupled to view removal or hidden in widget layout/presentation flows.

## Persisted Duplicate View Repair

Persisted Workbench state may contain duplicate `agent-queue` widget/view
instances from earlier bugs. Frontend workspace/widget normalization must detect
these duplicate views and quarantine them before rendering the Workbench.

Canonical Queue view selection is deterministic:

- Prefer a currently visible Queue view over a hidden one.
- Then prefer the earliest `createdAt` timestamp when the widget model exposes
  one.
- Then prefer the lowest persisted layout order when the view model exposes
  one.
- Then prefer the lowest docked `y` and `x` coordinates when only persisted
  dock geometry is available.
- Finally, use widget instance id lexical order as the stable tiebreaker.

The repair keeps the canonical Queue view and hides duplicate Queue views when
the current widget model exposes a safe visibility field such as `visible` or
`isVisible`. If a future model has no safe visibility/quarantine field, the
repair must identify duplicates without deleting or rewriting Queue domain data,
and the exact integration gap must be documented in code and this contract.

Duplicate Queue view repair must never delete Queue tasks, run links, worker
config, reports, tags, context attachments, Queue validation data, Executor run
history, widget logs/results, or other Queue-owned domain data. Persisted view
repair is limited to widget/view presentation state.

## Current Add-View Behavior

The normal frontend Widget Catalog / Workbench add path must enforce the
registry singleton metadata before it asks the workspace API to create a widget
instance. Adding Agent Queue when the Workspace already has the singleton Queue
view must return the existing view path and must not create another
`agent-queue` instance.

If the existing singleton Queue view is hidden and the current product path can
restore widget visibility through the existing layout update API, the add path
restores that same widget instance. If the existing singleton Queue view is
already visible, the current frontend treats the add action as successful and
leaves the existing view in place. The current Workbench does not have a
separate persisted selected-widget or focus/open API for catalog additions; a
future focus affordance must reuse the existing singleton widget instance
rather than creating an independent Queue view.

## Implementation Boundaries

Allowed in this contract:

- Typed widget registry metadata that marks `agent-queue` as a workspace
  singleton.
- Frontend add/create/open flow enforcement that reuses or restores the
  existing singleton Queue widget instead of creating a duplicate.
- Tests that assert the singleton metadata and prevent compatibility/V2
  registry entries from becoming additional Queue surfaces.
- Documentation updates that make this contract required reading for Queue and
  Smart Queue work.

Not implemented by this contract:

- Queue scheduler/runtime changes.
- Queue Active/Pause persistence changes.
- Storage, schema, backend, Tauri, or IPC changes.
- Prompt-pack execution behavior.
- New widget ids or renamed widget/component/persisted ids.
- Finder behavior or Finder files.
