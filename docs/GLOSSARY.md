# Glossary

## AI Workbench

A configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

## Workspace

A durable, persisted, user-facing container for a specific piece of work. A Workspace owns the saved Workbench composition, widget instances, layout, shared state, logs, results, decisions, current focus, and event history needed to resume later.

## WorkspaceSession

The current runtime opening of a Workspace. A WorkspaceSession may contain transient UI state, live tool connections, live agent runs, and runtime-only details, but the durable product object is the Workspace.

## Workbench

The configurable working surface inside a Workspace. It hosts widgets, layout, presentation state, context bindings, active preset origin, and the current UI composition for the active work.

## Widget

A first-class workbench entity with one responsibility. A widget has identity, configuration, layout state, input data, actions/commands, local logs, and structured results. Every visible workbench capability should be expressed as a widget.

## Widget Template

A reusable rule or starting configuration for creating widget instances.

## Widget Instance

A configured and placed instance of a widget inside a Workspace Workbench. Its identity persists when moved, resized, floated in the workspace, docked back, or later moved into a true external popout window, and its state is part of Workspace resume data.

## Widget Catalog

The set of available widget definitions and templates that can be instantiated in a workbench.

## Docking Station

A future compact, Workspace-local perimeter station for already-created WidgetInstances. Docking Station shows parked widgets in Indicator view so they remain visible and quickly accessible without occupying the main canvas.

## Widget View Mode

The rendered density of an existing WidgetInstance. Future modes are Full, Compact, and Indicator. Changing view mode must preserve widget identity, state, configuration, logs, results, and Workspace scope.

## Widget Presence Zone

The presentation/location of an existing WidgetInstance, such as canvas, future station, current in-app floating, or future external window. Widget Catalog is not a presence zone because it creates instances from templates.

## Widget Console

A widget-local log/activity surface. Every widget has a console capability, even if it is opened through a small button or popover.

## Widget Result

Structured final output produced by a widget run/action. Results are separate from logs.

## Preset

A reusable saved Workbench layout/configuration. Choosing a Preset instantiates or copies it into a Workspace; editing the Workspace layout does not mutate the original Preset unless the user explicitly saves or updates it.

## CurrentFocus

The saved pointer to what the user was focused on inside a Workspace, such as an active widget, selected object, decision, result, or note. It should be restored on resume only when the target is still valid.

## Agent CLI

A widget or capability for interacting with an agent through a command-oriented or conversation-oriented interface.

## Terminal Widget

A widget that exposes terminal interaction and terminal state.

## Agent Activity

Structured information about what the agent is doing, has done, or is waiting on.

## SharedState / Shared State

Named state available to the Workbench and relevant widgets through the common state and event model. Workspace-local SharedState is persisted with the Workspace for resume behavior.

## EventLog

The ordered history of structured Workspace and Workbench events relevant to a piece of work. It supports auditability, summarization, replay, restore behavior, and operator understanding.

## Knowledge Widget

A widget that exposes knowledge sources, references, or retrieved context. It is an optional capability, not the product center.

## Notes Widget

A widget/capability for Markdown-based operator notes. Notes can be global or workspace-local and remain separate from Knowledge Catalog unless explicitly promoted or linked by the operator.

## Global Notes

Markdown notes independent of any Workspace and available across Workspaces. Global Notes are useful for personal or common reference.

## Workspace Notes

Markdown notes bound to one Workspace. Workspace Notes are persisted and restored with the Workspace as part of resumable work.

## NoteFolder

A hierarchical folder used to organize NoteDocuments within one note scope.

## NoteDocument

A Markdown text document stored in either Global Notes or Workspace Notes.

## Stages Widget

A widget that exposes staged workflow state. It is an optional capability, not the product center.

## Runbook Widget

A widget that exposes runbook-like guidance or execution surfaces. It is an optional capability, not the product center.

## Tool Action

A typed, approval-aware request to use a tool capability.

## Decision Request

A structured request for operator approval, rejection, selection, or clarification.

## Action Proposal

A structured proposal describing an action before it is executed.
