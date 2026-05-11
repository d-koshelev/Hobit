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

WidgetInstances are scoped to their owning Workspace and Workbench. Moving, floating, or docking a widget changes presentation inside that Workspace; it must not leak widget state, logs, inputs, results, or layout into another Workspace. For the multi-Workspace and multi-Workbench boundary, see `docs/WORKSPACE_CONTRACT.md`.

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

Future Script Runner Widget behavior is defined in `docs/SCRIPT_RUNNER_WIDGET_CONTRACT.md`. It is a contract for an explicit operator-controlled configured local script action only. Script Runner may appear as planned/display-only catalog metadata, but no Script Runner widget, insertable catalog path, runtime execution, or backend behavior is implemented.

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

## Widget View Modes

Widget view mode is the rendered density of an existing WidgetInstance.

Suggested view modes:

- `Full`: the complete standard widget view with all primary functionality. Canvas normally uses Full view. In-app floating mode and future external popout/window mode normally use Full view.
- `Compact`: a reduced widget view with key status and limited controls. Compact is a future optional intermediate mode for constrained layouts, previews, or side surfaces.
- `Indicator`: a minimal status/access view with only title or icon, compact widget-specific status, badge/counter/warning marker, and open/focus affordance. Docking Station uses Indicator view.

Rules:

- Changing view mode must not create a new widget instance.
- Changing view mode must preserve widget identity, state, configuration, inputs, logs, results, and Workspace scope.
- Full view owns detailed interaction and primary functionality.
- Indicator view must not hide material risk or failure state, but detailed inspection belongs in Full view.
- Indicator view must not trigger hidden execution, refreshes, mutations, agent work, or tool actions.
- Compact and Indicator views are presentation contracts, not separate widget definitions or templates.

## Widget Presence Zones

Widget presence zone is the presentation/location of an existing WidgetInstance.

Suggested conceptual zones:

- `canvas`: the active Workbench surface for Full widget views.
- `station`: a future Docking Station rail using Indicator widget views.
- `floating`: the current in-app floating overlay or future equivalent temporary presentation.
- `external_window_future`: a future true separate Tauri/OS window.

Catalog is not a presence zone. The Widget Catalog is the source of templates and creates new WidgetInstances. Presence zones only describe where an existing WidgetInstance is shown.

Presence-zone changes should be operator-visible and may be persisted by future implementation when needed. The current implementation only has canvas rendering and frontend-only in-app floating presentation. Docking Station and true external windows are future work.

## Docking Station

Docking Station is a future compact, Workspace-local, perimeter-based station for already-created WidgetInstances that should remain visible and quickly accessible without permanently occupying the main Workbench canvas.

Docking Station is for:

- configured utility widgets
- monitoring or status widgets
- widgets that are useful but not always actively worked in
- quick access to existing WidgetInstances
- reducing main canvas clutter while keeping important state visible

Docking Station is not:

- Widget Catalog
- a source of new widget templates
- a second full canvas
- a hidden or archive state
- a dumping ground for every widget
- a way to bypass widget identity, state, logs, results, Workspace scope, or approval rules

### Perimeter Rails

Docking Station is not limited to one side. It may have independently enabled perimeter rails:

- top
- right
- bottom
- left

Future settings may include:

- enable or disable top rail
- enable or disable right rail
- enable or disable bottom rail
- enable or disable left rail
- per-rail item order
- compact or collapsed rail mode
- optional auto-collapse later

Example configuration:

```text
Docking Station:
  Top enabled
  Left enabled
  Right disabled
  Bottom enabled
```

### Station Items

Each Docking Station item represents one existing WidgetInstance.

Future conceptual fields may include:

- `widgetInstanceId`
- `stationEdge`: `top`, `right`, `bottom`, or `left`
- `viewMode`: `indicator`
- `order`
- `lastKnownCanvasLayout`
- `lastKnownFloatingPosition`
- `visibility/status summary`

These fields are conceptual only. They do not define a storage schema, API DTO, Rust type, TypeScript type, or current behavior.

### Station Status

Docking Station items must show clear, compact, widget-specific status.

Status requirements:

- readable at a glance
- compact enough for top, right, bottom, and left rails
- no long subtitles
- no repeated placeholder prose
- no hidden execution or refresh triggered by display
- detailed status and controls stay inside the Full widget view
- badges, counters, warning markers, ok/error dots, or short labels may be used

Status examples:

- Git: `Clean`, `Dirty 3`, `Not configured`, `Error`
- Agent Queue: `2 review`, `1 failed`, `All clear`
- Agent Run: `Running`, `Completed`, `Failed`, `Blocked`
- Notes/Notebook: `Saved`, `Unsaved`, `3 tabs`
- Template Library: `Ready`, `Static preview`, `Planned`
- Terminal: `Idle`, `Running`, `Failed`, `Unavailable`
- Script Runner: `Idle`, `Running`, `Failed`, `Passed`, `Needs review`

## Future Drag-And-Drop Semantics

Future drag-and-drop may move existing WidgetInstances between presentation zones:

- Canvas to Docking Station rail
- Docking Station rail to Canvas
- Canvas to Float
- Docking Station rail to Float
- Float to Canvas
- Float to Docking Station rail
- Future external popout/window to Canvas or Docking Station

Rules:

- Drag-and-drop moves the same widget instance.
- Drag-and-drop must not create a duplicate instance.
- Drag-and-drop must not lose widget state, configuration, logs, results, inputs, or Workspace scope.
- Drag-and-drop should only be available in explicit layout, edit, organize, or equivalent mode.
- Layout locked mode must prevent accidental drag-and-drop movement.
- Drag-and-drop must not start from text inputs, buttons, logs, or interactive widget body controls.
- Keyboard and accessibility alternatives should be designed before production use.

Current implementation has no drag-and-drop between Canvas, Docking Station, Float, or future external windows. Current docked widget move/resize remains Canvas behavior inside Edit layout mode. Current in-app Float is a frontend-only overlay, not an external OS/Tauri popout.

## Future Implementation Path

Likely safe implementation slices:

1. Add this contract only.
2. Add a static Docking Station placeholder rail with no storage behavior.
3. Add local frontend presentation state for send-to-station and open-on-canvas behavior.
4. Add persisted presence mode only after the product model is proven.
5. Add drag-and-drop between presentation zones.
6. Add per-widget Indicator status providers.

Each slice must preserve widget identity and avoid hidden execution or mutation.

## Docking Station Non-Goals

This contract does not implement:

- Docking Station UI
- station rails
- view-mode rendering
- widget status providers
- drag-and-drop
- persisted presence mode
- storage schema or migrations
- Tauri commands
- Workspace API changes
- external OS/Tauri popout windows
- widget behavior changes
- runtime execution
- hidden refresh, execution, mutation, or automation from station status

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

Future Workspace-aware Coordinator Agent behavior may read only intentional, approved widget context surfaces and may propose actions only through previewed, operator-approved flows. Widgets must not expose hidden private state to Agent Chat / Coordinator or accept direct Coordinator mutation outside the Workbench state/event and approval model. See `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`.

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

The Notes, Terminal placeholder, Agent Chat placeholder, Agent Run placeholder, Agent Queue placeholder, Git placeholder, and Template Library placeholder templates are currently available for catalog insertion. Notes persists a minimal widget-state draft shaped as `{ "body": "..." }`; the full Notebook/Notes document model, multi-tab state, text formatting tools, Markdown editor, Markdown rendering, Mermaid or diagram rendering, rendered block previews, autosave, checklists/todos, snippets, review notes, and AI-in-Notes behavior are not implemented yet. The Terminal placeholder is static and does not execute commands, accept command input, stream output, or write widget state. The Agent Chat placeholder is static and does not accept chat input, call agents or LLMs, access Workspace context, stream responses, propose actions, or write widget state. The Agent Run placeholder is static and previews future Overview Log, Result Report, and Raw Log views; it does not start runs, stream logs, persist run state, parse responses, validate results, summarize runtime events, integrate executor tasks, or write widget state. The Agent Queue placeholder is static and previews future command queue/history/review inbox cards, frontend-local static card selection, and selected item detail review surfaces for agent commands or blocks; it does not persist selected items, persist queue items, launch agents, capture responses, validate responses, associate Git review, run a background queue, automatically accept work, or write widget state. The Git widget placeholder has a transient explicit repository-root input and supports manual desktop-only read-only Git status refresh through `get_git_repository_status`, rendered as a visual status card and grouped changed-files summary. Git root/status persistence, polling, watching, diff/log/show, validation association, staging, commit, push, revert/reset, clean, stash, and other Git mutations are not implemented. The Template Library placeholder is static and includes static Request Template, Response Template, and Coordinator Workflow previews; it does not persist template data, edit templates, fill variables, generate requests, copy or send requests, capture responses, parse or validate responses, launch or integrate executor tasks, associate Git review with responses, call agents, or write widget state. Future Workspace-aware Coordinator Agent behavior is contract-only in `docs/WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`; Agent Chat / Coordinator does not currently read widget context, preview proposed actions, mutate other widgets, create Queue Items, edit Notebook content, or apply presentation changes.

The frontend includes a layout lock/edit-mode foundation. Docked widgets stay fixed in locked mode; edit mode allows docked widgets to be moved by dragging the widget header/top area and resized with right, bottom, and bottom-right handles. The final docked position and size persist through `update_widget_instance_layout`. Snapping, collision detection, auto-reflow, floating overlay resize, true external Tauri/OS popout windows, persisted external popout geometry, always-on-top behavior, and preset editing are not implemented yet. Widgets can also be floated into a frontend-only in-app overlay that leaves a ghost placeholder and can dock back without changing widget identity. This is transient frontend-only presentation state, not a separate OS window.

The widget-local Logs panel loads persisted logs and refreshes after successful state/layout actions when already open. Existing widget add/state/layout mutations emit basic logs. Runtime execution, runtime log emission, streaming, and polling are not implemented yet.

Future Agent Chat, Terminal, Agent CLI, or Executor widgets that run agent/task execution should follow `docs/AGENT_RUN_OBSERVABILITY_CONTRACT.md` for Raw Log, Overview Log, and Result Report views.

Future Script Runner Widget behavior is further defined in `SCRIPT_RUNNER_WIDGET_CONTRACT.md`, including explicit script path, argv argument model, working directory, timeout, output caps, operator Run action, safety boundaries, and non-goals. Script Runner is not implemented, is listed only as planned/display-only catalog metadata, and is not available for widget insertion.

## Examples

Future widget types may include:

- Agent CLI
- Agent Chat
- Terminal
- Script Runner
- Stages
- Knowledge
- Notes
- Notebook
- Database/JDBC
- Git
- Template Library
- Image Edit
- JIRA
- Confluence
- Agent Activity
- Shared State
- Agent Queue

Notes/Notebook Widget behavior is further defined in `NOTES_WIDGET_CONTRACT.md`, including the current legacy `{ "body": "..." }` state boundary, future multi-tab Notebook direction, Markdown and rendered-block preview direction, Mermaid fenced-block diagram rules, checklist/todo/snippet/review-note use cases, explicit formatting actions, and AI-editing safety rules. Standalone To-do List direction is folded into Notebook unless a future block explicitly defines a separate structured task-management widget.

JIRA and Confluence are future widget/integration candidates. JIRA should support work tracking and issue context; Confluence should support documentation and knowledge context. Both should start read-only when implemented, with operator-approved updates considered only in later explicit integration work.

Future Git Widget / Git Plugin behavior is further defined in `GIT_WIDGET_CONTRACT.md`. Git must be a visual, approval-aware review/control surface for repository state, not only raw command output.

Future agent/task run observability behavior is further defined in `AGENT_RUN_OBSERVABILITY_CONTRACT.md`.

Future Agent Queue behavior is further defined in `AGENT_QUEUE_CONTRACT.md`; it is an operator-controlled agent command queue, command history, and review inbox, not hidden automation or a generic task list.

Future Workspace-aware Coordinator Agent behavior is further defined in `WORKSPACE_COORDINATOR_AGENT_CONTRACT.md`; it is an approved-context, preview-before-apply proposal model, not unrestricted chat access or direct widget mutation.
