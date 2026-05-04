# Agent Runtime Contract

## Rule

The agent does not own the UI.

The agent participates in a Workbench Session by emitting structured runtime information and requesting actions. The workbench and widgets decide how that information is displayed.

## Agent Outputs

The agent may emit:

- messages
- activity events
- proposals
- decisions
- tool requests
- results

These outputs must be structured enough for widgets to render them without parsing unbounded text as UI state.

## Context And Capabilities

The agent works with the context and capabilities available in the active Workbench Session. Available capabilities are determined by session context, widgets, presets, and tool permissions.

The agent can operate in minimal mode with Terminal and Agent CLI widgets. Knowledge, Stages, Runbooks, Git, JDBC, and Image Edit are optional capabilities.

## Control Model

Agent proposes; operator controls.

The runtime must support explicit proposals, approval-aware tool requests, visible results, and operator decisions.
