# ADR-0003: Minimal Hobit Is Terminal + Agent CLI

## Status

Accepted

## Context

Hobit should prove the AI Workbench foundation before building optional capability widgets such as Knowledge, Stages, Runbooks, Git, JDBC, SQL Results, or Image Edit.

Overbuilding early capabilities would obscure whether the workbench model itself is clear, useful, and controllable.

## Decision

The minimal valid Hobit product is:

- Terminal Widget
- Agent CLI Widget

## Consequences

- The early MVP avoids overbuilding Knowledge, Stages, and Runbooks.
- The workbench foundation is proven first.
- Agent operation does not require Knowledge or Stages widgets.
- Optional capability widgets can be introduced after the minimal workbench and event model are stable.
