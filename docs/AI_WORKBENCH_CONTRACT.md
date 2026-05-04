# AI Workbench Contract

## Workbench

A Workbench is the visible operator surface for an active task. It hosts widgets, exposes context, presents agent activity, and coordinates tool actions and approvals.

## Workbench Session

A Workbench Session is a running instance of a workbench. It has active context, widget instances, layout, shared state, event history, and available capabilities.

## Workbench Context

Workbench Context is the set of task-relevant information available during a session. It may include files, repositories, terminal state, agent state, selected records, knowledge items, stage status, tool results, and shared state objects.

Context is not owned by a single widget. Widgets may contribute to context or render parts of it through the workbench state and event model.

## Widgets

Widgets define available views and capabilities. A widget may display state, accept input, request approval, show agent activity, trigger tool actions, or expose domain-specific controls.

Examples include Terminal, Agent CLI, Stages, Knowledge, Git, Database/JDBC, SQL Results, Image Edit, Agent Activity, and Shared State.

## Presets

A Preset is a saved composition of widget instances, configuration, layout, and initial context rules. Presets make workbench setups reusable without turning them into hardcoded product modes.

## Minimal Mode

The agent can work in minimal mode with only a Terminal Widget and Agent CLI Widget. Knowledge and Stages widgets are optional capabilities, not requirements for agent operation.
