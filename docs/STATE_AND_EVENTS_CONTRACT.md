# State And Events Contract

## Rule

Widgets should not talk directly to each other. They communicate through workbench state and events.

The workbench coordinates session state, event routing, agent activity, action proposals, decision requests, widget events, shared state objects, and tool results.

## Common Concepts

### WorkbenchEvent

A structured event emitted within a Workbench Session.

### AgentActivityEvent

An event describing what the agent is doing, has done, or is waiting on.

### ActionProposal

A structured proposal from the agent or a widget describing an action before it is executed.

### DecisionRequest

A request for operator approval, rejection, selection, or clarification.

### SharedStateObject

A named piece of state available to the workbench and relevant widgets.

### WidgetEvent

An event emitted by a widget to describe user interaction, configuration changes, state changes, or requested workbench coordination.

### ToolResult

A structured result produced by a Tool Action.

### Workspace Event Log

A Workspace event log is part of resumable work. It stores the structured history needed to understand, summarize, replay, or restore relevant Workspace and Workbench state when the user returns later.

## Event Boundaries

Events should be explicit and typed. Widgets may render events differently, but they should not rely on private state from other widgets.

Events may be replayed, summarized, or restored to support resume behavior. The durable Workspace owns the persisted event history; a WorkspaceSession only represents the current runtime opening.
