# Widget Contract

## Rule

Every visible block in Hobit is a Widget.

Widgets are optional capabilities that can be added, removed, configured, and composed into workbench presets.

Every widget must comply with `DESIGN_SYSTEM_CONTRACT.md`. Widgets should normally use the shared WidgetFrame anatomy.

## WidgetDefinition

A WidgetDefinition describes a widget type. It defines the widget's purpose, supported configuration, required capabilities, events, state inputs, actions, and rendering contract.

## WidgetInstance

A WidgetInstance is a configured, placed instance of a WidgetDefinition in a Workbench Session. Multiple instances of the same widget type may exist with different configuration.

## WidgetTemplate

A WidgetTemplate is a reusable rule or starting configuration for creating widget instances. Templates allow Hobit to support different customers, systems, and domains without hardcoding custom product modes.

## Widget Behavior

Widgets may:

- render state
- emit widget events
- request tool actions
- display tool results
- show agent activity
- present approval requests
- contribute context to the workbench

Widgets should communicate through workbench state and events, not direct widget-to-widget calls.

## Examples

- Terminal
- Agent CLI
- Stages
- Knowledge
- Database/JDBC
- Git
- Image Edit
- Agent Activity
- Shared State
