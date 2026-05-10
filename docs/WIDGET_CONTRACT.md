# Widget Contract

## Rule

Every visible workbench block in Hobit is a Widget.

A widget is a first-class workbench entity, not only a React component. It has identity, configuration, layout state, input data, actions/commands, local logs, and structured result output.

Widgets are optional capabilities that can be added, removed, configured, popped out, resized, repositioned, and composed into workbench presets.

Every widget must comply with `DESIGN_SYSTEM_CONTRACT.md`. Widgets should normally use the shared WidgetFrame anatomy and the unified widget surface rule.

## WidgetDefinition

A WidgetDefinition describes a widget type. It defines the widget's purpose, supported configuration, input contract, command/action contract, output/result contract, events, capabilities, and rendering contract.

## WidgetInstance

A WidgetInstance is a configured, placed instance of a WidgetDefinition in a Workbench Session. Multiple instances of the same widget type may exist with different configuration.

A WidgetInstance keeps the same identity when it is moved, resized, popped out, minimized, or docked back into the workbench.

## WidgetTemplate

A WidgetTemplate is a reusable rule or starting configuration for creating widget instances. Templates allow Hobit to support different customers, systems, and domains without hardcoding custom product modes.

## Runtime Widget Contract

Every widget has this lifecycle shape:

```text
WidgetInput
  + WidgetCommand / WidgetAction
    -> WidgetRun
      -> Widget-local logs/activity output
      -> WidgetResult output
```

The important distinction is:

- logs/activity output explains what happened while the widget was working
- result output is the structured final result of the run/action

### WidgetInput

Input data can include current context, selected files, selected image regions, connection configuration, user values, or other widget-specific data.

### WidgetCommand / WidgetAction

A command/action describes what the widget should do. It should include:

- type
- payload
- source: operator, agent, or system
- approval requirement
- risk level when relevant

Use `WidgetAction` for general wording. Use `WidgetCommand` when the widget is truly command-like, such as Terminal, SQL, or Git.

### WidgetRun

A WidgetRun represents a single execution of a command/action. It has a run status such as:

- idle
- input ready
- waiting for approval
- running/loading
- result ready
- completed
- failed
- cancelled

### Widget Logs / Console

Every widget has a widget-local console/log view as a base property.

This console is not only for Terminal. Any widget may emit logs/activity during a run:

- Terminal: stdout, stderr, exit events
- Database: connecting, validating query, executing, fetching rows
- Image Edit: loading image, applying selection, generating variants
- Agent CLI: reading context, planning, proposing actions

The widget-local console may open through a small action in the widget header/meta zone, an inline drawer, a popover, or an expanded console mode. The UI mechanism can vary, but the capability is part of the base widget contract.

### WidgetResult

A WidgetResult is structured final output. It can contain summaries, data tables, edited images, generated files, action proposals, evidence, or other artifacts.

## Layout, Resize, And Pop-Out

Every widget is layout-managed.

A widget can be:

- moved inside the Workbench
- resized inside the Workbench
- popped out / detached
- moved and resized in pop-out mode
- minimized
- returned/docked back to its original or selected workbench slot

Changing size, position, or presentation mode must not create a new widget instance. It only changes layout/presentation state.

## Ghost Placeholder

When a widget is popped out, its original workbench slot remains occupied by a ghost placeholder.

The ghost placeholder should show:

- widget title
- detached status
- last known status if useful
- return/dock action

The ghost is the return anchor for the detached widget.

## Always On Top

Popped-out widgets must support an explicit optional `Always on Top` mode.

Rules:

- it is a presentation/window-management state
- it must be visible and user-toggleable
- it must not be enabled silently
- it must preserve widget identity, input, run state, logs, results, and context bindings

## Widget Behavior

Widgets may:

- render state
- accept input data
- accept commands/actions
- emit widget events
- request tool actions
- display tool results
- show local logs/activity
- produce structured results
- show agent activity
- present approval requests
- contribute context to the workbench

Widgets should communicate through workbench state and events, not direct widget-to-widget calls.

## Current Implementation Foundation

The current implemented widget lifecycle foundation is:

```text
Widget Catalog
  -> persisted WidgetInstance
  -> WidgetHost render
  -> widget state/layout mutations
  -> workspace-scoped activity events
  -> widget-local persisted logs
  -> Logs panel read/refresh
```

The Notes and Terminal placeholder templates are currently available for catalog insertion. Notes persists a minimal widget-state draft shaped as `{ "body": "..." }`; the full Notes document model, Markdown editor, autosave, and AI-in-Notes behavior are not implemented yet. The Terminal placeholder is static and does not execute commands, accept command input, stream output, or write widget state.

Docked widget size presets persist layout updates. Widgets can also be popped out into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. Drag/drop layout editing, resize handles, Tauri separate-window popouts, persisted popout geometry, always-on-top behavior, and preset editing are not implemented yet.

The widget-local Logs panel loads persisted logs and refreshes after successful state/layout actions when already open. Existing widget add/state/layout mutations emit basic logs. Runtime execution, runtime log emission, streaming, and polling are not implemented yet.

## Examples

Future widget types may include:

- Agent CLI
- Terminal
- Stages
- Knowledge
- Notes
- Database/JDBC
- Git
- Image Edit
- Agent Activity
- Shared State
- Notebook
- To-do List

Notes Widget behavior is further defined in `NOTES_WIDGET_CONTRACT.md`.

Future Git Widget / Git Plugin behavior is further defined in `GIT_WIDGET_CONTRACT.md`. Git must be a visual, approval-aware review/control surface for repository state, not only raw command output.
