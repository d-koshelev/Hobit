# Glossary

## AI Workbench

A configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

## Workbench

The visible product surface for an active task.

## Widget

A first-class workbench entity with one responsibility. A widget has identity, configuration, layout state, input data, actions/commands, local logs, and structured results. Every visible workbench capability should be expressed as a widget.

## Widget Template

A reusable rule or starting configuration for creating widget instances.

## Widget Instance

A configured and placed instance of a widget inside a Workbench Session. Its identity persists when moved, resized, popped out, or docked back.

## Widget Catalog

The set of available widget definitions and templates that can be instantiated in a workbench.

## Widget Console

A widget-local log/activity surface. Every widget has a console capability, even if it is opened through a small button or popover.

## Widget Result

Structured final output produced by a widget run/action. Results are separate from logs.

## Preset

A saved composition of widget instances, layout, configuration, and initial context rules.

## Agent CLI

A widget or capability for interacting with an agent through a command-oriented or conversation-oriented interface.

## Terminal Widget

A widget that exposes terminal interaction and terminal state.

## Agent Activity

Structured information about what the agent is doing, has done, or is waiting on.

## Shared State

Named state available to the workbench and relevant widgets through the common state and event model.

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
