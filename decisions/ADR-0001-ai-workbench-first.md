# ADR-0001: AI Workbench First

## Status

Accepted

## Context

Hobit could be mistaken for a chat app, terminal wrapper, runbook runner, knowledge manager, IDE clone, or script executor. Those categories are too narrow and would make one capability dominate the product.

The intended product is a configurable operator workspace where agents, tools, context, widgets, and presets are composed into a visible, controllable working surface.

## Decision

Hobit is Workbench-first.

The AI Workbench is the product center. Individual capabilities must be expressed through widgets, tool actions, shared state, and presets.

## Consequences

- Knowledge, Stages, Runbooks, Terminal, Git, and JDBC are capabilities or widgets, not product centers.
- The operator workspace remains visible and controllable.
- The product can start minimal and expand through optional capabilities.
- New domains should be modeled through widget templates, rules, and presets instead of hardcoded product modes.
