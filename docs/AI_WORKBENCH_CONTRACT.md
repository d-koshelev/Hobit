# AI Workbench Contract

## Workbench

A Workbench is the visible operator surface for an active task. It hosts widgets, exposes context, presents agent activity, and coordinates tool actions and approvals.

## Workspace And WorkspaceSession

For resumable work, a Workbench exists inside a Workspace. The Workspace is the durable work container that persists the Workbench layout, widget instances, shared state, logs, results, and event history needed to continue later.

Opening or creating a Workspace starts a WorkspaceSession, which represents the current runtime opening of that Workspace.

## Workbench Session

A Workbench Session is a running instance of a workbench. It has active context, widget instances, layout, shared state, event history, and available capabilities.

## Workbench Context

Workbench Context is the set of task-relevant information available during a session. It may include files, repositories, terminal state, agent state, selected records, knowledge items, stage status, tool results, and shared state objects.

Context is not owned by a single widget. Widgets may contribute to context or render parts of it through the workbench state and event model.

## Widgets

Widgets define available views and capabilities. A widget may display state, accept input, request approval, show agent activity, trigger tool actions, or expose domain-specific controls.

Examples include Terminal, Agent CLI, Stages, Knowledge, Git, Database/JDBC, JIRA, Confluence, SQL Results, Image Edit, Agent Activity, and Shared State.

## Presets

A Preset is a saved composition of widget instances, configuration, layout, and initial context rules. Presets make workbench setups reusable without turning them into hardcoded product modes.

## Minimal Mode

The default implementation starts from an empty Workbench shell. Widgets are optional capabilities added through presets or the future widget catalog.

A future starter preset may include Terminal and Agent CLI widgets, but Knowledge, Stages, Runbooks, and other capabilities are never required for the workbench to exist.
