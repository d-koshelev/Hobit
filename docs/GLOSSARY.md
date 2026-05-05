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

A configured and placed instance of a widget inside a Workspace Workbench. Its identity persists when moved, resized, popped out, or docked back, and its state is part of Workspace resume data.

## Widget Catalog

The set of available widget definitions and templates that can be instantiated in a workbench.

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
