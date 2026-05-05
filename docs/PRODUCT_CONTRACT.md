# Product Contract

## Definition

Hobit is a modular AI Workbench. It provides a configurable operator workspace where AI agents, tools, context, widgets, and presets are composed into a visible, controllable, modular working surface.

## Product Center

The workbench is the product center. Hobit is centered on the operator's active working surface, not on any single capability.

The product must make it clear:

- what the operator is working on
- what context is active
- what the agent is doing
- what tools or actions are available
- what needs approval

## Non-Goals

Hobit is not:

- a script executor
- a terminal wrapper
- an IDE clone
- a runbook runner
- a knowledge manager
- a chat app

These may appear as widgets or capabilities, but they must not define Hobit's product center.

## Minimal Product

The minimal product surface is an empty, composable AI Workbench shell. It must make the workbench model clear before any concrete capability widgets are added.

A future starter preset may include Terminal Widget and Agent CLI Widget, but those are optional widget capabilities rather than the product center.

## Expansion Model

Hobit expands through widgets and capabilities. A capability becomes visible to the operator through a widget, tool action, shared state object, or preset.

Widgets must be optional, composable, and reusable. New customer or domain needs should usually be handled by reusable widget templates and configuration rules, not hardcoded product modes.
