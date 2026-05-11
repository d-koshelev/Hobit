# Widget Contract

## Rule

Every visible workbench block in Hobit is a Widget.

A widget is a first-class workbench entity, not only a React component. It has identity, configuration, layout state, input data, actions/commands, local logs, and structured result output.

Widgets are optional capabilities that can be added, removed, configured, floated in the workspace, resized, repositioned, and composed into workbench presets. A future true popout means a separate Tauri/OS window, not the current in-app floating overlay.

Every widget must comply with `DESIGN_SYSTEM_CONTRACT.md`. Widgets should normally use the shared WidgetFrame anatomy and the unified widget surface rule.

## WidgetDefinition

A WidgetDefinition describes a widget type. It defines the widget's purpose, supported configuration, input contract, command/action contract, output/result contract, events, capabilities, and rendering contract.

## WidgetInstance

A WidgetInstance is a configured, placed instance of a WidgetDefinition in a Workbench Session. Multiple instances of the same widget type may exist with different configuration.

A WidgetInstance keeps the same identity when it is moved, resized, floated, minimized, docked back into the workbench, or later moved into a true external popout window.

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

Future agent/task execution widgets have an additional observability contract: Raw Log, Overview Log, and Result Report views. See `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md`. The current Agent Run widget is only a static placeholder preview of those views; real run observability is not implemented by the current generic Logs panel.

### WidgetResult

A WidgetResult is structured final output. It can contain summaries, data tables, edited images, generated files, action proposals, evidence, or other artifacts.

## Layout, Resize, Floating, And Future Popout

Every widget is layout-managed.

A widget can be:

- moved inside the Workbench
- resized inside the Workbench
- floated in the workspace / detached
- moved in floating mode
- moved and resized in future true external popout mode
- minimized
- returned/docked back to its original or selected workbench slot

Changing size, position, or presentation mode must not create a new widget instance. It only changes layout/presentation state.

## Ghost Placeholder

When a widget is floated in the workspace, its original workbench slot remains occupied by a ghost placeholder. Future true external popout windows must keep the same ghost anchor behavior.

The ghost placeholder should show:

- widget title
- floating or detached status
- last known status if useful
- return/dock action

The ghost is the return anchor for the floating or detached widget.

## Always On Top

Future true external popout widgets must support an explicit optional `Always on Top` mode. The current in-app floating widget mode does not leave the main Hobit window and does not implement always-on-top behavior.

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

The Notes, Terminal placeholder, Agent Chat placeholder, Agent Run placeholder, Git placeholder, and Template Library placeholder templates are currently available for catalog insertion. Notes persists a minimal widget-state draft shaped as `{ "body": "..." }`; the full Notebook/Notes document model, multi-tab state, text formatting tools, Markdown editor, autosave, and AI-in-Notes behavior are not implemented yet. The Terminal placeholder is static and does not execute commands, accept command input, stream output, or write widget state. The Agent Chat placeholder is static and does not accept chat input, call agents or LLMs, access Workspace context, stream responses, propose actions, or write widget state. The Agent Run placeholder is static and previews future Overview Log, Result Report, and Raw Log views; it does not start runs, stream logs, persist run state, parse responses, validate results, summarize runtime events, integrate executor tasks, or write widget state. The Git widget placeholder has a transient explicit repository-root input and supports manual desktop-only read-only Git status refresh through `get_git_repository_status`, rendered as a visual status card and grouped changed-files summary. Git root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented. The Template Library placeholder is static and includes static Request Template, Response Template, and Coordinator Workflow previews; it does not persist template data, edit templates, fill variables, generate requests, copy or send requests, capture responses, parse or validate responses, launch or integrate executor tasks, associate Git review with responses, call agents, or write widget state. Agent Queue is defined in `docs/AGENT_QUEUE_CONTRACT.md` as a future operator-controlled queue and review inbox; no Agent Queue widget, storage, queue runner, response capture, response validation, or executor integration is implemented yet.

The frontend includes a layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final docked position and size persist through `update_widget_instance_layout`. Snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, always-on-top behavior, and preset editing are not implemented yet. Widgets can also be floated into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. This is transient frontend-only presentation state, not a separate OS window.

The widget-local Logs panel loads persisted logs and refreshes after successful state/layout actions when already open. Existing widget add/state/layout mutations emit basic logs. Runtime execution, runtime log emission, streaming, and polling are not implemented yet.

Future Agent Chat, Terminal, Agent CLI, or Executor widgets that run agent/task execution should follow `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` for Raw Log, Overview Log, and Result Report views.

## Examples

Future widget types may include:

- Agent CLI
- Agent Chat
- Terminal
- Stages
- Knowledge
- Notes
- Database/JDBC
- Git
- Template Library
- Image Edit
- Agent Activity
- Shared State
- Notebook
- To-do List
- Agent Queue

Notes/Notebook Widget behavior is further defined in `NOTES_WIDGET_CONTRACT.md`, including the current legacy `{ "body": "..." }` state boundary, future multi-tab Notebook direction, explicit formatting actions, and AI-editing safety rules.

Future Git Widget / Git Plugin behavior is further defined in `GIT_WIDGET_CONTRACT.md`. Git must be a visual, approval-aware review/control surface for repository state, not only raw command output.

Future agent/task run observability behavior is further defined in `AGENT_RUN_OBSERVABILITY_CONTRACT.md`.

Future Agent Queue behavior is further defined in `AGENT_QUEUE_CONTRACT.md`.
